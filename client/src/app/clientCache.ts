import { BinaryChannel, BinaryMessage } from "@common/chatbin";
import * as ServerApi from "./serverApi";
import { User, Message, Channel, Server } from "./chat";
import { GetChannelResponse, JsonChannel, JsonMessage, WhoamiResponse } from "@common/serverApi";

function messageCacheKey(messageUUID: string, channelUUID: string, serverUUID: string) {
    return messageUUID + "." + channelUUID + "." + serverUUID;
}
function channelCacheKey(channelUUID: string, serverUUID: string) {
    return channelUUID + "." + serverUUID;
}

export const clientCache = new class ClientCache {
    private readonly messages: Map<string, Message> = new Map;
    private readonly channels: Map<string, Channel> = new Map;
    private readonly servers: Map<string, Server> = new Map;
    private readonly users: Map<string, User> = new Map;
    private selfUser: User;
    private whoami: WhoamiResponse;

    public async setSelfUser(whoami: WhoamiResponse) {
        this.whoami = whoami;
        this.selfUser = await this.getUser(whoami.uuid);
    }
    public getWhoami() {
        return this.whoami;
    }
    public getSelfUser() {
        return this.selfUser;
    }

    public async getUser(uuid: string) {
        if(this.users.has(uuid)) return this.users.get(uuid);

        const userInfo = await ServerApi.userInfo({ uuid });
        
        const user = new User(userInfo.uuid, userInfo.username);

        this.users.set(uuid, user);
        return user;
    }
    public async getMessage(uuid: string, channelUUID: string, serverUUID: string) {
        const cacheKey = messageCacheKey(uuid, channelUUID, serverUUID);
        if(this.messages.has(cacheKey)) return this.messages.get(cacheKey);

        const { message: messageInfo } = await ServerApi.messageInfo({ uuid, channel: channelUUID, server: serverUUID });
        const userInfo = await this.getUser(messageInfo.author);
        const channelInfo = await this.getChannel(messageInfo.channel, messageInfo.server);

        const message = new Message(messageInfo.uuid, userInfo, channelInfo, messageInfo.content, new Date(messageInfo.creationDate));

        this.messages.set(cacheKey, message);
        return message;
    }
    public async getChannel(uuid: string, serverUUID: string) {
        const cacheKey = channelCacheKey(uuid, serverUUID);
        if(this.channels.has(cacheKey)) return this.channels.get(cacheKey);

        const channelInfo = await ServerApi.channelInfo({ uuid, server: serverUUID });
        const serverInfo = await this.getServer(channelInfo.server);

        const channel = new Channel(channelInfo.uuid, channelInfo.name);
        channel.setServer(serverInfo);

        this.channels.set(cacheKey, channel);
        return channel;
    }
    public async getServer(uuid: string) {
        if(this.servers.has(uuid)) return this.servers.get(uuid);

        const serverInfo = await ServerApi.serverInfo({ uuid });
        const owner = await this.getUser(serverInfo.owner).catch(() => null);

        const server = new Server(serverInfo.uuid, serverInfo.name, owner);
        this.servers.set(serverInfo.uuid, server);

        for await(const channel of serverInfo.channels) {
            server.addChannel(await this.getChannel(channel, server.uuid)); // setServer gets called twice (once in getChannel, one in addChannel)
        }

        return server;
    }
    public async addMessage(messageData: BinaryMessage | JsonMessage): Promise<Message> {
        const author = await this.getUser(messageData.author);
        const channel = await this.getChannel(messageData.channel, messageData.server);
        let message: Message;

        if(messageData instanceof BinaryMessage) {
            message = new Message(messageData.uuid, author, channel, messageData.content, messageData.creationDate);
        } else {
            message = new Message(messageData.uuid, author, channel, messageData.content, new Date(messageData.creationDate));
        }
        this.messages.set(messageData.uuid, message);
        return message;
    }
    public async addChannel(channelData: BinaryChannel | JsonChannel) {
        const server = await this.getServer(channelData.server);

        const cacheKey = channelCacheKey(channelData.uuid, channelData.server);
        const channel = new Channel(channelData.uuid, channelData.name);
        server.addChannel(channel);
        
        this.channels.set(cacheKey, channel);
        return channel;
    }
}