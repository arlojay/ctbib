import { ObjectId } from "mongodb";
import { ChatManager } from "./manager";
import { Account, AccountManager } from "../accounts";
import { Server } from "./server";
import { randomUUID } from "node:crypto";

export interface SerializedServerInvite {
    _id: ObjectId;
    server: ObjectId;
    creationDate: Date;
    creator: ObjectId;
    code: string;
}
export class ServerInvite {
    public uuid: ObjectId;
    public server: Server;
    public creationDate = new Date;
    public creator: Account;
    public code: string;

    constructor() {
        this.code = randomUUID().split("-").shift();
    }

    public setUUID(uuid: ObjectId) {
        this.uuid = uuid;
    }

    public serialize(): SerializedServerInvite {
        return {
            _id: this.uuid,
            server: this.server.uuid,
            creator: this.creator.uuid,
            creationDate: this.creationDate,
            code: this.code
        }
    }
    public async deserialize(data: SerializedServerInvite, accountManager: AccountManager, chatManager: ChatManager) {
        this.uuid = data._id;
        this.server = await chatManager.getServer(data.server, accountManager);
        this.creator = await accountManager.findByUUID(data.creator);
        this.creationDate.setTime(data.creationDate.getTime());
        this.code = data.code;
    }
}