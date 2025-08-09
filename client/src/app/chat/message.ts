import { BinaryMessage } from "@common/chatbin";
import { User } from "./user";
import { Channel } from "./channel";

export class Message {
    public binary: BinaryMessage;
    
    public constructor(
        public uuid: string,
        public author: User,
        public channel: Channel,
        public content: string,
        public creationDate: Date
    ) {
        this.binary = new BinaryMessage;
        this.binary.uuid = uuid;
        this.binary.author = author.uuid;
        this.binary.channel = channel.uuid;
        this.binary.server = channel.server.uuid;
        this.binary.content = content;
        this.binary.creationDate.setTime(creationDate.getTime());
    }
}