import { TypedEmitter } from "tiny-typed-emitter";
import { Server } from "../chat";

export class ServerListEvents extends TypedEmitter<{
    "load": (servers: Server[]) => void;
    "add-server": (server: Server) => void;
    "fetch": () => void;
    "open": (server: Server) => void;
    "create-server": () => void;
        "select-server": (server: Server) => void;
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
    
    let lastSelected: Server;
    const serverElements: Map<Server, HTMLDivElement> = new Map;

    function addServer(server: Server) {
        const box = createServerBox(server);
        box.addEventListener("click", () => {
            if(server == lastSelected) return;
            events.emit("open", server);
        })
        list.append(box);
        serverElements.set(server, box);
    }
    events.on("load", servers => {
        for(const server of servers) {
            addServer(server);
        }
    });
    events.on("add-server", addServer);

    events.on("select-server", server => {
        serverElements.get(lastSelected)?.classList.remove("selected");
        serverElements.get(server)?.classList.add("selected");

        lastSelected = server;
    })

    const actions = document.createElement("div");
    actions.classList.add("actions");

    const createServerButton = document.createElement("button");
    createServerButton.textContent = "New Server";

    createServerButton.addEventListener("click", () => {
        events.emit("create-server");
    });

    actions.append(createServerButton);


    root.append(list, actions);
    events.emit("fetch");

    return root;
}