import { TypedEmitter } from "tiny-typed-emitter";
import { Message } from "../chat/message";
import { Channel } from "../chat";
import { validateMessage } from "@common/validation";
import { clientCache } from "../clientCache";

export class ChatScreenEvents extends TypedEmitter<{
    "send": (message: string, nonce: Symbol) => void;
    "send-success": (nonce: Symbol) => void;
    "receive": (message: Message) => void;
    "load": (message: Message) => void;
    "fetch": (fromMessage: string, count: number) => void;
}> {}

function findChronologicallyAdjacentMessages(messages: Iterable<Message>, message: Message) {
    let bestSucDt = Infinity;
    let bestSucMessage: Message = null;
    let bestPreDt = Infinity;
    let bestPreMessage: Message = null;
    
    for(const testingMessage of messages) {
        const dt = testingMessage.creationDate.getTime() - message.creationDate.getTime();

        if(dt >= 0) {
            if(dt < bestSucDt) {
                bestSucDt = dt;
                bestSucMessage = testingMessage;
            }
        } else if(dt <= 0) {
            if(-dt < bestPreDt) {
                bestPreDt = -dt;
                bestPreMessage = testingMessage;
            }
        }
    }

    return { succeeding: bestSucMessage, preceding: bestPreMessage };
}

function formatTime(date: Date) {
    const current = new Date;
    if(date.getDate() == current.getDate()) {
        return date.toLocaleTimeString(navigator.language, {
            hour: "2-digit",
            minute: "2-digit"
        });
    } else if(date.getDate() == current.getDate() - 1) {
        return "Yesterday at " + date.toLocaleTimeString(navigator.language, {
            hour: "2-digit",
            minute: "2-digit"
        });
    } else {
        return date.toLocaleString(navigator.language, {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        });
    }
}

function formatText(text: string): HTMLElement[] {
    const span = document.createElement("span");
    span.textContent = text;
    return [ span ];
}

function createChatMessage(message: Message, mergeBefore: HTMLDivElement, assimilateAfter: HTMLDivElement) {
    const textElement = document.createElement("div");
    textElement.replaceChildren(...formatText(message.content));
    textElement.classList.add("text");

    if(assimilateAfter != null) {
        const timeElement = assimilateAfter.querySelector("time");
        timeElement.textContent = formatTime(message.creationDate);
        timeElement.title = message.creationDate.toLocaleString();

        const contentElement = assimilateAfter.querySelector(".content");
        contentElement.insertAdjacentElement("afterbegin", textElement);
        
        return assimilateAfter;
    } else if(mergeBefore != null) {
        const contentElement = mergeBefore.querySelector(".content");
        contentElement.insertAdjacentElement("beforeend", textElement);
        
        return mergeBefore;
    } else {
        const root = document.createElement("div");
        root.classList.add("message");

        const timeElement = document.createElement("time");
        timeElement.textContent = formatTime(message.creationDate);
        timeElement.title = message.creationDate.toLocaleString();

        const authorElement = document.createElement("span");
        authorElement.textContent = message.author.username;
        authorElement.classList.add("author");

        const contentElement = document.createElement("div");
        contentElement.classList.add("content");
        contentElement.append(textElement);

        root.append(timeElement, authorElement, contentElement);
        
        return root;
    }
}

interface ChatChannelOptions {
    channel: Channel;
    exists: boolean;
}

export function createChatScreen(events: ChatScreenEvents, options: ChatChannelOptions) {
    const root = document.createElement("div");
    root.classList.add("chat");


    const logs = document.createElement("div");
    logs.classList.add("logs");

    const messageElements: Map<Message, HTMLDivElement> = new Map;
    const outgoingMessages: Map<Symbol, HTMLElement> = new Map;

    function addMessage(message: Message) {
        const { succeeding, preceding } = findChronologicallyAdjacentMessages(messageElements.keys(), message);

        const mergeBefore = (
            preceding != null &&
            preceding.author == message.author &&
            message.creationDate.getTime() - preceding.creationDate.getTime() < (1000 * 60 * 7)
        );
        const mergeAfter = (
            succeeding != null &&
            succeeding.author == message.author &&
            succeeding.creationDate.getTime() - message.creationDate.getTime() < (1000 * 60 * 7)
        );
        let scrollFactor = 0;
        let boxHeight = 0;
        let scrollHeight = 0;
        if(succeeding == null) {
            boxHeight = logs.getBoundingClientRect().height;
            scrollHeight = logs.scrollHeight;
            scrollFactor = scrollHeight - (boxHeight + logs.scrollTop);
        }
        const element = createChatMessage(
            message,
            mergeBefore ? messageElements.get(preceding) : null,
            mergeAfter ? messageElements.get(succeeding) : null
        );

        
        if(succeeding == null) {
            logs.append(element);
        } else {
            messageElements.get(succeeding).insertAdjacentElement("beforebegin", element);
        }
        if(scrollFactor < 4 || scrollHeight < boxHeight) {
            logs.scrollTop = logs.scrollHeight;
        }

        messageElements.set(message, element);
        return (mergeBefore ? element.querySelector(".text:last-child") : element.querySelector(".text")) as HTMLElement;
    }

    events.on("receive", addMessage);
    events.on("load", addMessage);

    events.on("send-success", nonce => {
        const element = outgoingMessages.get(nonce);
        element.classList.remove("sending");
    })

    if(options.exists) {
        const inputContainer = document.createElement("div");
        inputContainer.classList.add("input");

        const inputForm = document.createElement("form");
        inputForm.addEventListener("submit", event => {
            event.preventDefault();
            const content = messageField.value;
            messageField.value = "";

            let trimmedContent = content;
            try {
                trimmedContent = validateMessage(trimmedContent);
            } catch(e) {
                console.debug(e);
                return;
            }
            const nonce = Symbol(crypto.randomUUID());
            const localMessage = new Message(nonce.toString(), clientCache.getSelfUser(), options.channel, trimmedContent, new Date);
            events.emit("send", trimmedContent, nonce);
            const textElement = addMessage(localMessage);
            
            textElement.classList.add("sending");
            outgoingMessages.set(nonce, textElement);
        });

        const messageField = document.createElement("input");
        messageField.type = "text";
        messageField.autocomplete = "off";
        messageField.maxLength = 2000;

        const submitButton = document.createElement("input");
        submitButton.type = "submit";
        submitButton.value = "Send";

        inputForm.append(messageField, submitButton);
        inputContainer.append(inputForm);
    

        const channelTitlebar = document.createElement("div");
        channelTitlebar.classList.add("titlebar");

        const channelName = document.createElement("span");
        channelName.classList.add("name");
        channelName.textContent = options.channel?.name ?? "Unknown Channel";

        channelTitlebar.append(channelName);


        root.append(channelTitlebar, logs, inputContainer);
        events.emit("fetch", null, 50);
    } else {
        const noChannelsModal = document.createElement("div");
        noChannelsModal.classList.add("no-channels-modal");
        noChannelsModal.textContent = "No channels!";

        root.append(noChannelsModal);
    }

    return root;
}