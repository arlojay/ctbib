import { BinaryMessage } from "@common/chatbin";
import { TypedEmitter } from "tiny-typed-emitter";
import { clientCache } from "../clientCache";

export class ChatScreenEvents extends TypedEmitter<{
    "send": (message: string) => void;
    "receive": (message: BinaryMessage) => void;
    "load": (message: BinaryMessage) => void;
    "fetch": (fromMessage: string, count: number) => void;
}> {}

export interface ChatScreenInfo {
    lastMessage: string;
}

function createChatMessage(info: ChatScreenInfo, binaryMessage: BinaryMessage) {
    const root = document.createElement("div");
    root.classList.add("message");

    const timeElement = document.createElement("time");
    timeElement.textContent = binaryMessage.creationDate.toLocaleTimeString(navigator.language, { hour: "2-digit", minute: "2-digit" });

    const authorElement = document.createElement("span");
    clientCache.getUser(binaryMessage.author).then(user => {
        authorElement.textContent = "<" + user.username + ">";
    })

    const contentElement = document.createElement("span");
    contentElement.textContent = binaryMessage.content;

    root.append(timeElement, authorElement, contentElement);
    
    return root;
}

export function createChatScreen(info: ChatScreenInfo, events: ChatScreenEvents) {
    const root = document.createElement("div");
    root.classList.add("chat");


    const logs = document.createElement("div");
    logs.classList.add("logs");

    events.on("receive", message => {
        logs.append(createChatMessage(info, message));
    });
    events.on("load", message => {
        logs.append(createChatMessage(info, message));
    });


    const inputContainer = document.createElement("div");
    inputContainer.classList.add("input");

    const inputForm = document.createElement("form");
    inputForm.addEventListener("submit", event => {
        event.preventDefault();
        const content = messageField.value;
        if(content.replace(/[\s\t\r\n]/g, "").length == 0) return;
        events.emit("send", content);
    })

    const messageField = document.createElement("input");
    messageField.type = "text";

    const submitButton = document.createElement("input");
    submitButton.type = "submit";
    submitButton.value = "Send";

    inputForm.append(messageField, submitButton);
    inputContainer.append(inputForm);


    root.append(logs, inputContainer);
    events.emit("fetch", info.lastMessage, 50);

    return root;
}