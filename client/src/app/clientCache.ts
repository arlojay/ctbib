import { BinaryMessage } from "@common/chatbin";
import * as ServerApi from "./serverApi";
import { User } from "./chat/user";
import { Message } from "./chat/message";

export const clientCache = new class ClientCache {
    private readonly messages: Map<string, Message> = new Map;
    private readonly users: Map<string, User> = new Map;

    public async getUser(uuid: string) {
        if(this.users.has(uuid)) return this.users.get(uuid);

        const userInfo = await ServerApi.userInfo({ uuid });
        
        const user = new User(userInfo.uuid, userInfo.username);

        this.users.set(uuid, user);
        return user;
    }
    public async getMessage(uuid: string) {
        if(this.messages.has(uuid)) return this.messages.get(uuid);

        const messageInfo = await ServerApi.messageInfo({ uuid });
        const userInfo = await this.getUser(messageInfo.author);

        const message = new Message(messageInfo.uuid, userInfo, messageInfo.content);

        this.messages.set(uuid, message);
        return message;
    }
    public async addMessage(binaryMessage: BinaryMessage) {
        const author = await this.getUser(binaryMessage.author);
        const message = new Message(binaryMessage.uuid, author, binaryMessage.content);
        this.messages.set(binaryMessage.uuid, message);
        return message;
    }
}