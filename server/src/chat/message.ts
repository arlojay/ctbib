import { ChatManager } from "./manager";
import { ObjectId } from "mongodb";
import { Account, AccountManager } from "../accounts";
import { Channel } from "./channel";

export interface SerializedMessage {
    _id: ObjectId;
    author: ObjectId;
    channel: ObjectId;
    server: ObjectId;
    content: string;
    creationDate: Date;
}
export class Message {
    public uuid: ObjectId;
    public author: Account;
    public channel: Channel;
    public content: string;
    public creationDate: Date = new Date;

    public setUUID(uuid: ObjectId) {
        this.uuid = uuid;
    }

    public serialize(): SerializedMessage {
        return {
            _id: this.uuid,
            author: this.author.uuid,
            channel: this.channel.uuid,
            server: this.channel.server.uuid,
            content: this.content,
            creationDate: this.creationDate
        }
    }
    public async deserialize(data: SerializedMessage, chatManager: ChatManager, accountManager: AccountManager) {
        this.uuid = data._id;
        this.author = await accountManager.findByUUID(data.author);
        this.channel = await chatManager.getChannel(data.channel, data.server, accountManager);
        this.content = data.content;
        this.creationDate.setTime(data.creationDate.getTime());
    }
}