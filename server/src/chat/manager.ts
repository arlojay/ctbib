import { Db, Document, MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { Channel, SerializedChannel } from "./channel";
import { Message, SerializedMessage } from "./message";
import { SerializedServer, Server } from "./server";
import { AccountManager } from "../accounts";
import { buildMongoURI } from "../mongoURI";

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
        const uri = buildMongoURI({
            username: process.env.ACCOUNTS_CLUSTER_USERNAME,
            password: process.env.ACCOUNTS_CLUSTER_PASSWORD,
            host: process.env.ACCOUNTS_CLUSTER_HOST,
            cluster: process.env.ACCOUNTS_CLUSTER_NAME
        });
        this.mongo = new MongoClient(uri, {
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
            .db(serverUUID.toHexString())
            .collection("channel-" + channelUUID.toHexString())
            .findOne({ _id: uuid }) as SerializedMessage;
        
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
                $sort: { creationDate: -1 }
            },
            {
                $limit: count
            }
        ];

        if(from != null) {
            const fromMessage = await this.getMessage(from, channelUUID, serverUUID, accountManager);
            if(fromMessage == null) return [];
            
            pipeline.unshift({
                $match: { creationDate: { $lt: fromMessage.creationDate.toISOString() } }
            });
        }

        const messageDocuments = await this.mongo
            .db(serverUUID.toHexString())
            .collection("channel-" + channelUUID.toHexString())
            .aggregate(pipeline)
            .toArray() as SerializedMessage[];

        const messages: Message[] = new Array;
        for(const messageDocument of messageDocuments) {
            console.log(messageDocument);
            const cacheKey = messageCacheKey(messageDocument._id, channelUUID, serverUUID);
            const message = new Message;
            message.setUUID(messageDocument._id);
            message.author = await accountManager.findByUUID(messageDocument.author);
            message.channel = await this.getChannel(messageDocument.channel, messageDocument.server);
            message.creationDate.setTime(messageDocument.creationDate.getTime());
            message.content = messageDocument.content;
            
            this.messages.set(cacheKey, message);
            messages.push(message);
        }

        return messages;
    }
    public async getChannel(uuid: ObjectId, serverUUID: ObjectId) {
        console.log(uuid, serverUUID);
        const cacheKey = channelCacheKey(uuid, serverUUID);
        if(this.channels.has(cacheKey)) return this.channels.get(cacheKey);

        const channelDocument = await this.mongo
            .db(serverUUID.toHexString())
            .collection("channels")
            .findOne({ _id: uuid }) as SerializedChannel;
        
        const channel = new Channel;
        channel.setUUID(uuid);
        channel.server = await this.getServer(serverUUID);
        channel.name = channelDocument.name;

        this.channels.set(cacheKey, channel);

        return channel;
    }
    public async getServer(uuid: ObjectId) {
        if(this.servers.has(uuid.toHexString())) return this.servers.get(uuid.toHexString());

        const dbServer = await this.mongo
            .db(uuid.toHexString())
            .collection("data")
            .findOne({ _id: uuid }) as SerializedServer;

        if(dbServer == null) return null;

        const server = new Server;
        this.servers.set(uuid.toHexString(), server);

        await server.deserialize(dbServer, this);

        return server;
    }
    public async createMessage(message: Message) {
        const messageDocument = await this.mongo
            .db(message.channel.server.uuid.toHexString())
            .collection("channel-" + message.channel.uuid)
            .insertOne(message.serialize());
        
        message.setUUID(messageDocument.insertedId);
        
        return message;
    }
    public async createChannel(channel: Channel) {
        const channelDocument = await this.mongo
            .db(channel.server.uuid.toHexString())
            .collection("channels")
            .insertOne(channel.serialize());
        
        channel.setUUID(channelDocument.insertedId);
        
        return channel;
    }
    public async createServer(server: Server) {
        server.setUUID(new ObjectId);

        const serverDocument = await this.mongo
            .db(server.uuid.toHexString())
            .collection("data")
            .insertOne(server.serialize());
        
        server.setUUID(serverDocument.insertedId);
        
        return server;
    }
    public async updateServer(server: Server) {
        await this.mongo.db(server.uuid.toHexString()).collection("data").replaceOne({ _id: server.uuid }, server.serialize());
    }
}