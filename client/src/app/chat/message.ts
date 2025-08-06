import { BinaryMessage } from "@common/chatbin";
import { User } from "./user";

export class Message {
    public binary: BinaryMessage;
    
    public constructor(
        public uuid: string,
        public author: User,
        public content: string
    ) {
        this.binary = new BinaryMessage;
        this.binary.uuid = uuid;
        this.binary.author = author.uuid;
        this.binary.content = content;
    }
}