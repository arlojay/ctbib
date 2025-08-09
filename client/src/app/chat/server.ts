import { Channel } from "./channel";

export class Server {
    public channels: Channel[] = new Array;

    public constructor(
        public uuid: string,
        public name: string
    ) {

    }

    public addChannel(channel: Channel) {
        channel.setServer(this);
        this.channels.push(channel);
    }
}