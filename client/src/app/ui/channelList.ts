import { TypedEmitter } from "tiny-typed-emitter";
import { Channel, Server } from "../chat";

export class ChannelListEvents extends TypedEmitter<{
    "load": (channels: Channel[]) => void;
    "add-channel": (channel: Channel) => void;
    "fetch": () => void;
    "open": (channel: Channel) => void;
    "create-channel": () => void;
    "select-channel": (channel: Channel) => void;
}> {}

function createChannelBox(channel: Channel) {
    const root = document.createElement("div");
    root.classList.add("channel");

    const buttonElement = document.createElement("button");
    buttonElement.textContent = channel.name;

    root.append(buttonElement);
    
    return root;
}

interface ChannelListServerOptions {
    serverName: string;
    canModifyChannels: boolean;
}

export function createChannelListScreen(events: ChannelListEvents, options: ChannelListServerOptions) {
    const root = document.createElement("div");
    root.classList.add("channel-list");

    const serverHead = document.createElement("div");
    serverHead.classList.add("server");

    const serverName = document.createElement("span");
    serverName.textContent = options.serverName;
    serverName.classList.add("name");

    serverHead.append(serverName);
    

    const list = document.createElement("div");
    list.classList.add("list");

    let lastSelected: Channel;
    const channelElements: Map<Channel, HTMLDivElement> = new Map;
    
    function addChannel(channel: Channel) {
        const box = createChannelBox(channel);
        box.addEventListener("click", () => {
            if(channel == lastSelected) return;
            events.emit("open", channel);
        })
        list.append(box);
        channelElements.set(channel, box);
    }

    events.on("load", channels => {
        for(const channel of channels) {
            addChannel(channel);
        }
    });
    events.on("add-channel", addChannel);

    events.on("select-channel", channel => {
        channelElements.get(lastSelected)?.classList.remove("selected");
        channelElements.get(channel)?.classList.add("selected");

        lastSelected = channel;
    })


    const actions = document.createElement("div");
    actions.classList.add("actions");    

    if(options.canModifyChannels) {
        const createChannelButton = document.createElement("button");
        createChannelButton.textContent = "New Channel";

        createChannelButton.addEventListener("click", () => {
            events.emit("create-channel");
        });

        actions.append(createChannelButton);
    }

    root.append(serverHead, list, actions);
    events.emit("fetch");

    return root;
}