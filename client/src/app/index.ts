import { TypedEmitter } from "tiny-typed-emitter";
import { ChatClient } from "./chatClient";
import { ClientData } from "./clientData";
import { createLoginPrompt, createRegisterPrompt } from "./ui/login";
import { SessionStartResponse, WhoamiResponse } from "@common/serverApi";
import * as ServerApi from "./serverApi";
import { ChatScreenEvents, createChatScreen } from "./ui/chat";
import { clientCache } from "./clientCache";
import { Channel, Server } from "./chat";
import { createServerListScreen as createServerList, ServerListEvents } from "./ui/serverList";
import { ChannelListEvents, createChannelListScreen as createChannelList } from "./ui/channelList";
import { MainUI } from "./ui/mainui";
import { createMembersListScreen, MemberListEvents } from "./ui/membersList";

const chatClient = new ChatClient;
const clientData = new ClientData;
const clientEvents = new TypedEmitter<{
    "login": (whoami: WhoamiResponse) => void;
}>;
const mainUI = new MainUI;

main();
async function main() {
    await clientData.open();
    await clientData.loadAll();

    document.body.appendChild(mainUI.root);
    
    mainUI.loginScreen.hidden = true;
    mainUI.loginScreen.appendChild(createLoginPrompt(onSessionStart));
    mainUI.loginScreen.appendChild(createRegisterPrompt(onSessionStart));

    clientEvents.once("login", async (whoami) => {
        await clientCache.setSelfUser(whoami);

        ServerApi.setToken(clientData.authentication.token);

        mainUI.loginScreen.hidden = true;
        openServerList(whoami);
    });

    const whoami = await tryAuth();

    if(whoami != null) {
        clientEvents.emit("login", whoami);
        await chatClient.connect(clientData.authentication.token);
        mainUI.loginScreen.hidden = true;
    } else {
        mainUI.loginScreen.hidden = false;
    }

    chatClient.addListener("disconnected", () => {
        setTimeout(() => {
            chatClient.connect(clientData.authentication.token);
            openServerList(clientCache.getWhoami());
            openChannelList(null);
            openChatScreen(null);
            openMembersList(null);
        }, 2000);
    });
    chatClient.addListener("auth-invalid", () => {
        console.trace("Authentication expired");
        if(confirm("Your authentication has expired. Confirm tab reload.")) {
            document.location.reload();
        }
    })
}

async function tryAuth() {
    if(clientData.authentication.token == "") return null;
    ServerApi.setToken(clientData.authentication.token);

    try {
        return await ServerApi.whoami();
    } catch(e) {
        console.warn(e);
    }
    return null;
}

function openServerList(whoami: WhoamiResponse) {
    const events = new ServerListEvents;
    events.on("fetch", async () => {
        const servers: Server[] = new Array;
        for await(const server of whoami.servers) {
            servers.push(await clientCache.getServer(server));
        }
        events.emit("load", servers);
    });
    events.on("open", server => {
        openChannelList(server);
        events.emit("select-server", server);

        openMembersList(server);
    });
    events.on("create-server", async () => {
        const serverName = prompt("Enter server name:");
        if(serverName == null) return;

        try {
            const serverData = await ServerApi.createServer({ name: serverName });
            const server = await clientCache.getServer(serverData.uuid);
            events.emit("add-server", server);
            events.emit("select-server", server);
            openChannelList(server);
            openMembersList(server);
        } catch(e) {
            let baseError = e;
            while(baseError.cause != null) baseError = baseError.cause;

            if(baseError instanceof ServerApi.ServerError) {
                alert("Error while making server: " + baseError.message);
            } else {
                throw e;
            }
        }
    });
    events.on("join-server", async () => {
        const inviteCode = prompt("Enter invite code:");
        if(inviteCode == null) return;

        const joinServerResponse = await ServerApi.joinServer({ code: inviteCode });
        const server = await clientCache.getServer(joinServerResponse.uuid);
        events.emit("add-server", server);
        events.emit("select-server", server);
        openChannelList(server);
        openMembersList(server);
    });
    const serverList = createServerList(events);
    mainUI.serverList.replaceWith(serverList);
    mainUI.serverList = serverList;
}

function openMembersList(server: Server) {
    const events = new MemberListEvents;
    chatClient.on("user-join", async (user, serverUUID) => {
        if(serverUUID != server.uuid) return;
        
        events.emit("add-user", user);
    });
    chatClient.on("user-status-change", (uuid, online) => {
        events.emit("user-status-change", uuid, online);
    })
    events.on("fetch", async () => {
        const response = await ServerApi.getMembers({ uuid: server.uuid });

        events.emit("load", response.members);
    });
    events.on("create-invite", async () => {
        const response = await ServerApi.createInvite({ server: server.uuid });
        console.log("Created invite " + response.code);
        alert("Created invite (only shown once!)\n" + response.code);
    });
    if(server != null) {
        const membersList = createMembersListScreen(events, {
            serverOwner: server.owner?.uuid,
            canInviteUsers: clientCache.getSelfUser().uuid == server.owner?.uuid
        });

        mainUI.membersList.replaceWith(membersList)
        mainUI.membersList = membersList;
    } else {
        mainUI.membersList.replaceChildren();
    }
}

function openChannelList(server: Server) {
    const events = new ChannelListEvents;
    chatClient.on("channel-create", async binaryChannel => {
        const channel = await clientCache.addChannel(binaryChannel);
        events.emit("add-channel", channel);
    })
    events.on("fetch", () => {
        events.emit("load", server.channels);
    })
    events.on("open", channel => {
        openChatScreen(channel);
        events.emit("select-channel", channel);
    });
    events.on("create-channel", async () => {
        const channelName = prompt("Enter channel name:");
        if(channelName == null) return;

        try {
            const channelData = await ServerApi.createChannel({ name: channelName, server: server.uuid });
            const channel = await clientCache.addChannel(channelData);
            events.emit("add-channel", channel);
        } catch(e) {
            let baseError = e;
            while(baseError.cause != null) baseError = baseError.cause;

            if(baseError instanceof ServerApi.ServerError) {
                alert("Error while making channel: " + baseError.message);
            } else {
                throw e;
            }
        }
    });
    
    if(server != null) {
        const channelList = createChannelList(events, {
            serverName: server.name,
            canModifyChannels: server.owner?.uuid == clientCache.getSelfUser().uuid
        });
        mainUI.channelList.replaceWith(channelList);
        mainUI.channelList = channelList;
        
        const firstChannel = server.channels[0];
        openChatScreen(firstChannel);
        if(firstChannel != null) events.emit("select-channel", firstChannel);
    } else {
        mainUI.channelList.replaceChildren();
    }
}

function openChatScreen(channel: Channel) {
    const events = new ChatScreenEvents;
    
    chatClient.on("message", async binaryMessage => {
        if(channel == null) return;
        if(binaryMessage.channel != channel.uuid || binaryMessage.server != channel.server.uuid) return;
        const message = await clientCache.addMessage(binaryMessage);

        events.emit("receive", message);
    });

    events.on("send", async (message, nonce) => {
        await ServerApi.sendMessage({ content: message, channel: channel.uuid, server: channel.server.uuid });
        events.emit("send-success", nonce);
    });
    events.on("fetch", async (fromMessage, count) => {
        const response = await ServerApi.fetchMessages({ from: fromMessage, channel: channel.uuid, server: channel.server.uuid, count });

        for(const jsonMessage of response.messages) {
            const message = await clientCache.addMessage(jsonMessage);
            events.emit("load", message);
        }
    });
    
    const chatScreen = createChatScreen(events, {
        channel,
        exists: channel != null
    });
    mainUI.chatScreen.replaceWith(chatScreen);
    mainUI.chatScreen = chatScreen;
}

async function onSessionStart(response: SessionStartResponse) {
    clientData.authentication.token = response.sessionToken;
    
    const whoami = await tryAuth();

    if(whoami != null) {
        await clientData.saveAuthentication();
        clientEvents.emit("login", whoami);
        await chatClient.connect(response.sessionToken);
    }
}

export function getClientData() {
    return clientData;
}
export function getChatClient() {
    return chatClient;
}
export function getClientEvents() {
    return clientEvents;
}