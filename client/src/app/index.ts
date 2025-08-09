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
        ServerApi.setToken(clientData.authentication.token);

        mainUI.loginScreen.hidden = true;
        openServerList(whoami);
    })

    const whoami = await tryAuth();

    if(whoami != null) {
        clientEvents.emit("login", whoami);
        await chatClient.connect(clientData.authentication.token);
        mainUI.loginScreen.hidden = true;
    } else {
        mainUI.loginScreen.hidden = false;
    }
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
    });
    const serverList = createServerList(events);
    mainUI.serverList.replaceWith(serverList);
}

function openChannelList(server: Server) {
    const events = new ChannelListEvents;
    events.on("fetch", () => {
        events.emit("load", server.channels);
    })
    events.on("open", channel => {
        openChatScreen(channel);
    });
    const channelList = createChannelList(server, events);
    mainUI.channelList.replaceWith(channelList);
}

function openChatScreen(channel: Channel) {
    const chatEvents = new ChatScreenEvents;

    chatClient.addListener("message", async binaryMessage => {
        const message = await clientCache.addMessage(binaryMessage);
        chatEvents.emit("receive", message);
    })

    chatEvents.on("send", async message => {
        await ServerApi.sendMessage({ content: message, channel: channel.uuid, server: channel.server.uuid });
    });
    chatEvents.on("fetch", async (fromMessage, count) => {
        const response = await ServerApi.fetchMessages({ from: fromMessage, channel: channel.uuid, server: channel.server.uuid, count });

        for(const jsonMessage of response.messages) {
            const message = await clientCache.addMessage(jsonMessage);
            chatEvents.emit("load", message);
        }
    });
    
    const chatScreen = createChatScreen(chatEvents);
    mainUI.chatScreen.replaceWith(chatScreen);
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