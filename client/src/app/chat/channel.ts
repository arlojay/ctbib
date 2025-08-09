import { Message } from "./message";
import { Server } from "./server";

export class Channel {
    public server: Server;

    public constructor(
        public uuid: string,
        public name: string
    ) {
        
    }

    public setServer(server: Server) {
        this.server = server;
    }
}