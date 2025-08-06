import { TypedEmitter } from "tiny-typed-emitter";
import { ChatClient } from "./chatClient";
import { ClientData } from "./clientData";
import { createLoginPrompt, createRegisterPrompt } from "./ui/login";
import { SessionStartResponse } from "@common/serverApi";
import * as ServerApi from "./serverApi";
import { ChatScreenEvents, createChatScreen } from "./ui/chat";
import { clientCache } from "./clientCache";

const chatClient = new ChatClient;
const clientData = new ClientData;
const clientEvents = new TypedEmitter<{
    "login": () => void;
}>;

main();
async function main() {
    await clientData.open();
    await clientData.loadAll();

    const authenticated = await tryAuth();

    clientEvents.once("login", () => {
        ServerApi.setToken(clientData.authentication.token);
        openChatScreen();
    })

    if(authenticated) {
        clientEvents.emit("login");
        await chatClient.connect(clientData.authentication.token);
    } else {
        const loginPrompt = createLoginPrompt(onSessionStart);
        document.body.appendChild(loginPrompt);
        
        const registerPrompt = createRegisterPrompt(onSessionStart);
        document.body.appendChild(registerPrompt);

        clientEvents.once("login", () => {
            loginPrompt.remove();
            registerPrompt.remove();
        });
    }
}

async function tryAuth() {
    if(clientData.authentication.token == "") return false;
    ServerApi.setToken(clientData.authentication.token);

    try {
        const whoami = await ServerApi.whoami();
        console.log(whoami);
        return true;
    } catch(e) {
        console.warn(e);
    }
    return false;
}

function openChatScreen() {
    const chatEvents = new ChatScreenEvents;
    const chatScreen = createChatScreen({
        lastMessage: ""
    }, chatEvents);

    document.body.appendChild(chatScreen);

    chatClient.addListener("message", message => {
        clientCache.addMessage(message);
        chatEvents.emit("receive", message);
    })

    chatEvents.on("send", async message => {
        await ServerApi.sendMessage({ content: message });
    });
    chatEvents.on("fetch", (fromMessage, count) => {

    });
}

async function onSessionStart(response: SessionStartResponse) {
    clientData.authentication.token = response.sessionToken;
    
    const authenticated = await tryAuth();

    if(authenticated) {
        await clientData.saveAuthentication();
        clientEvents.emit("login");
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