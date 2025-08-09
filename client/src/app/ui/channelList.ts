import { TypedEmitter } from "tiny-typed-emitter";
import { Channel, Server } from "../chat";

export class ChannelListEvents extends TypedEmitter<{
    "load": (channels: Channel[]) => void;
    "fetch": () => void;
    "open": (channel: Channel) => void;
}> {}

function createChannelBox(channel: Channel) {
    const root = document.createElement("div");
    root.classList.add("channel");

    const buttonElement = document.createElement("button");
    buttonElement.textContent = channel.name;

    root.append(buttonElement);
    
    return root;
}

export function createChannelListScreen(server: Server, events: ChannelListEvents) {
    const root = document.createElement("div");
    root.classList.add("channel-list");

    const serverHead = document.createElement("div");
    serverHead.classList.add("server");

    const serverName = document.createElement("span");
    serverName.textContent = server.name;
    serverName.classList.add("name");

    serverHead.append(serverName);
    

    const list = document.createElement("div");
    list.classList.add("list");

    events.on("load", channels => {
        for(const channel of channels) {
            const box = createChannelBox(channel);
            box.addEventListener("click", () => {
                events.emit("open", channel);
            })
            list.append(box);
        }
    });


    root.append(serverHead, list);
    events.emit("fetch");

    return root;
}