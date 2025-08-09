import { ObjectId } from "mongodb";
import { Server } from "./server";
import { ChatManager } from "./manager";

export interface SerializedChannel {
    _id: ObjectId;
    server: ObjectId;
    name: string;
}
export class Channel {
    public uuid: ObjectId;
    public server: Server;
    public name: string;

    public setUUID(uuid: ObjectId) {
        this.uuid = uuid;
    }

    public serialize(): SerializedChannel {
        return {
            _id: this.uuid,
            server: this.server.uuid,
            name: this.name
        }
    }
    public async deserialize(data: SerializedChannel, chatManager: ChatManager) {
        this.uuid = data._id;
        this.server = await chatManager.getServer(data.server);
        this.name = data.name;
    }
}