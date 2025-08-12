import { Db, Document, MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { Channel, SerializedChannel } from "./channel";
import { Message, SerializedMessage } from "./message";
import { SerializedServer, Server } from "./server";
import { Account, AccountManager } from "../accounts";
import { SerializedServerInvite, ServerInvite } from "./serverInvite";

function messageCacheKey(messageUUID: ObjectId, channelUUID: ObjectId, serverUUID: ObjectId) {
    return messageUUID.toHexString() + "." + channelUUID.toHexString() + "." + serverUUID.toHexString();
}
function channelCacheKey(channelUUID: ObjectId, serverUUID: ObjectId) {
    return channelUUID.toHexString() + "." + serverUUID.toHexString();
}

export class ChatManager {
    private mongo: MongoClient;

    public servers: Map<string, Server> = new Map;
    private channels: Map<string, Channel> = new Map;
    private messages: Map<string, Message> = new Map;

    public constructor() {
        this.mongo = new MongoClient(process.env.ACCOUNTS_CLUSTER_URI, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });
    }

    public async connect() {
        await this.mongo.connect();
    }

    public async getMessage(uuid: ObjectId, channelUUID: ObjectId, serverUUID: ObjectId, accountManager: AccountManager) {
        const cacheKey = messageCacheKey(uuid, channelUUID, serverUUID);
        if(this.messages.has(cacheKey)) return this.messages.get(cacheKey);

        const messageDocument = await this.mongo
            .db("messages")
            .collection(serverUUID.toHexString())
            .findOne({ _id: uuid, channel: channelUUID }) as SerializedMessage;
        
        const message = new Message;
        message.setUUID(uuid);
        message.author = await accountManager.findByUUID(messageDocument.author);
        message.creationDate.setTime(messageDocument.creationDate.getTime());
        message.content = messageDocument.content;
        
        this.messages.set(cacheKey, message);

        return message;
    }
    public async getMessages(from: ObjectId, channelUUID: ObjectId, serverUUID: ObjectId, count: number, accountManager: AccountManager): Promise<Message[]> {
        const pipeline: Document[] = [
            {
                $match: { channel: channelUUID }
            },
            {
                $sort: { creationDate: -1 }
            },
            {
                $limit: count
            }
        ];

        if(from != null) {
            const fromMessage = await this.getMessage(from, channelUUID, serverUUID, accountManager);
            if(fromMessage == null) return [];
            
            pipeline.unshift(pipeline.shift(), {
                $match: { creationDate: { $lt: fromMessage.creationDate.toISOString() } }
            });
        }

        const messageDocuments = await this.mongo
            .db("messages")
            .collection(serverUUID.toHexString())
            .aggregate(pipeline)
            .toArray() as SerializedMessage[];

        const messages: Message[] = new Array;
        for(const messageDocument of messageDocuments) {
            const cacheKey = messageCacheKey(messageDocument._id, channelUUID, serverUUID);
            const message = new Message;
            message.setUUID(messageDocument._id);
            message.author = await accountManager.findByUUID(messageDocument.author);
            message.channel = await this.getChannel(messageDocument.channel, messageDocument.server, accountManager);
            message.creationDate.setTime(messageDocument.creationDate.getTime());
            message.content = messageDocument.content;
            
            this.messages.set(cacheKey, message);
            messages.push(message);
        }

        return messages;
    }
    public async getChannel(uuid: ObjectId, serverUUID: ObjectId, accountManager: AccountManager) {
        const cacheKey = channelCacheKey(uuid, serverUUID);
        if(this.channels.has(cacheKey)) return this.channels.get(cacheKey);

        const channelDocument = await this.mongo
            .db("channels")
            .collection(serverUUID.toHexString())
            .findOne({ _id: uuid }) as SerializedChannel;
        
        const channel = new Channel;
        channel.setUUID(uuid);
        channel.server = await this.getServer(serverUUID, accountManager);
        channel.name = channelDocument.name;

        this.channels.set(cacheKey, channel);

        return channel;
    }
    public async getServer(uuid: ObjectId, accountManager: AccountManager) {
        if(this.servers.has(uuid.toHexString())) return this.servers.get(uuid.toHexString());

        const dbServer = await this.mongo
            .db("chat")
            .collection("servers")
            .findOne({ _id: uuid }) as SerializedServer;

        if(dbServer == null) return null;

        const server = new Server;
        this.servers.set(uuid.toHexString(), server);

        await server.deserialize(dbServer, accountManager, this);

        return server;
    }
    public async createMessage(message: Message) {
        const messageDocument = await this.mongo
            .db("messages")
            .collection(message.channel.server.uuid.toHexString())
            .insertOne(message.serialize());
        
        message.setUUID(messageDocument.insertedId);
        
        return message;
    }
    public async createChannel(channel: Channel) {
        const channelDocument = await this.mongo
            .db("channels")
            .collection(channel.server.uuid.toHexString())
            .insertOne(channel.serialize());
        
        channel.setUUID(channelDocument.insertedId);
        
        return channel;
    }
    public async createServer(server: Server) {
        server.setUUID(new ObjectId);

        const serverDocument = await this.mongo
            .db("chat")
            .collection("servers")
            .insertOne(server.serialize());
        
        server.setUUID(serverDocument.insertedId);
        
        return server;
    }
    public async updateServer(server: Server) {
        await this.mongo.db("chat").collection("servers").replaceOne({ _id: server.uuid }, server.serialize());
    }
    public async createInvite(server: Server, creator: Account) {
        const invite = new ServerInvite;
        invite.creator = creator;
        invite.server = server;

        const inviteDocument = await this.mongo.db("chat").collection("invites").insertOne(invite.serialize());
        invite.setUUID(inviteDocument.insertedId);

        return invite;
    }
    public async getInvite(inviteId: string, accountManager: AccountManager) {
        const inviteDocument = await this.mongo.db("chat").collection("invites").findOne({ code: inviteId }) as SerializedServerInvite;
        if(inviteDocument == null) return null;

        const invite = new ServerInvite;
        invite.deserialize(inviteDocument, accountManager, this);

        return inviteDocument;
    }
}