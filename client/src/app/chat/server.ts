import { Channel } from "./channel";
import { User } from "./user";

export class Server {
    public channels: Channel[] = new Array;

    public constructor(
        public uuid: string,
        public name: string,
        public owner: User
    ) {

    }

    public addChannel(channel: Channel) {
        channel.setServer(this);
        this.channels.push(channel);
    }
}