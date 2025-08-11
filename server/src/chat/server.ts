import { ObjectId } from "mongodb";
import crypto from "node:crypto";
import { Channel } from "./channel";
import { ChatManager } from "./manager";
import { Account, AccountManager } from "../accounts";

export interface SerializedServer {
    _id: ObjectId;
    name: string;
    owner: ObjectId;
    channels: ObjectId[];
}
export class Server {
    public uuid: ObjectId;
    public name: string;
    public owner: Account;
    public channels: Map<string, Channel> = new Map;

    public setUUID(uuid: ObjectId) {
        this.uuid = uuid;
    }

    public addChannel(channel: Channel) {
        channel.server = this;
        this.channels.set(channel.uuid.toHexString(), channel);
    }

    public serialize(): SerializedServer {
        return {
            _id: this.uuid,
            name: this.name,
            owner: this.owner?.uuid,
            channels: this.channels.values().map(channel => channel.uuid).toArray()
        }
    }
    public async deserialize(data: SerializedServer, accountManager: AccountManager, chatManager: ChatManager) {
        this.uuid = data._id;
        this.name = data.name;
        this.owner = await accountManager.findByUUID(data.owner);
        for await(const uuid of data.channels) {
            const channel = await chatManager.getChannel(uuid, this.uuid, accountManager);
            channel.server = this;
            this.channels.set(uuid.toHexString(), channel);
        }
    }
}