import { TypedEmitter } from "tiny-typed-emitter";
import { Server } from "../chat";

export class ServerListEvents extends TypedEmitter<{
    "load": (servers: Server[]) => void;
    "fetch": () => void;
    "open": (server: Server) => void;
}> {}

function createServerBox(server: Server) {
    const root = document.createElement("div");
    root.classList.add("server");

    const buttonElement = document.createElement("button");
    buttonElement.textContent = server.name;

    root.append(buttonElement);
    
    return root;
}

export function createServerListScreen(events: ServerListEvents) {
    const root = document.createElement("div");
    root.classList.add("server-list");


    const list = document.createElement("div");
    list.classList.add("list");

    events.on("load", servers => {
        for(const server of servers) {
            const box = createServerBox(server);
            box.addEventListener("click", () => {
                events.emit("open", server);
            })
            list.append(box);
        }
    });


    root.append(list);
    events.emit("fetch");

    return root;
}