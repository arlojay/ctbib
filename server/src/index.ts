import * as ServerApi from "@common/serverApi";
import express from "express";
import path from "node:path";
import bodyParser from "body-parser";
import { Account, AccountManager } from "./accounts";
import { IncomingHttpHeaders } from "node:http";
import { Router, WebSocketExpress } from "websocket-express";
import { UserSocketSession } from "./user/userSocketSession";
import { MessagePacket } from "@common/packet";
import { ObjectId } from "mongodb";
import { Channel, ChatManager, Message, Server } from "./chat";
import { createServer } from "node:https";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

let accountManager: AccountManager;
let chatManager: ChatManager;
const sessionSocketLists: Map<string, Set<UserSocketSession>> = new Map;

main();

async function main() {
    await initMongo();
    await initExpress();
}

function getBearerToken(headers: IncomingHttpHeaders) {
    const { authorization } = headers;
    if(authorization == null) return;
    if(authorization.startsWith("Bearer ")) return authorization.slice(7);

    return null;
}

async function initExpress() {
    const app = new WebSocketExpress;

    app.use((req, res, next) => {
        const proxyIp = req.headers["x-forwarded-for"];
        const socketIp = req.socket.remoteAddress;
        let ipid = socketIp;
        if(proxyIp != null && proxyIp.length > 0) ipid = proxyIp + "(" + ipid + ")";
        console.log(`[${new Date().toLocaleString()}] ${ipid} ${req.method} ${req.path}`);
        
        next();
    })
    
    const hostClient = (process.env.HOST_CLIENT ?? "true").toLowerCase() == "true";
    if(hostClient) {
        const dir = path.resolve(path.join(process.cwd(), process.env.CLIENT_DIRECTORY ?? "../client/dist/"));
        console.log("Serving client from " + dir);
        app.use(express.static(dir));
    }

    const api = new Router();
    app.use("/api", api);

    api.use(bodyParser.json());
    api.post("/login", async (req, res) => {
        const { username, password } = req.body as ServerApi.LoginCredentials;

        if(typeof username != "string" || typeof password != "string") return res.status(400).send({ error: "Malformed request" });

        try {
            const sessionToken = await accountManager.login(username, password);
            res.send({ sessionToken });
            
            const account = accountManager.findBySessionToken(sessionToken);
            account.lastLoginDate.setTime(Date.now());
            await accountManager.updateAccount(account);
        } catch(e) {
            while(e.cause != null) e = e.cause;

            console.error(e);
            res.send({ error: e.message });
        }
    });
    api.post("/register", async (req, res) => {
        const { username, password } = req.body as ServerApi.RegisterCredentials;

        if(typeof username != "string" || typeof password != "string") return res.status(400).send({ error: "Malformed request" });

        try {
            const account = new Account;
            account.create(username, password);

            const sessionToken = await accountManager.register(account);
        res.send({ sessionToken } as ServerApi.SessionStartResponse);
        } catch(e) {
            while(e.cause != null) e = e.cause;

            console.error(e);
            res.send({ error: e.message });
        }
    });
    api.ws("/ws", async (req, res) => {
        const { token } = req.query;
        if(typeof token != "string") return res.status(403).send("Unauthorized");

        const account = accountManager.findBySessionToken(token);
        if(account == null) {
            res.status(400).send("Invalid session");
            return;
        }

        const socket = new UserSocketSession(await res.accept());
        const socketList = sessionSocketLists.get(token) ?? new Set;

        socket.once("close", () => socketList.delete(socket));
        socketList.add(socket);
        sessionSocketLists.set(token, socketList);
    });
    api.use((req, res, next) => {
        const token = getBearerToken(req.headers);
        if(typeof token != "string") return res.status(403).send({ error: "Unauthorized" });
        
        const account = accountManager.findBySessionToken(token);
        if(account == null) {
            res.status(400).send("Invalid session");
            return;
        }
        
        res.locals.token = token;
        res.locals.account = account;
        next();
    })
    api.get("/whoami", async (req, res) => {
        const account: Account = res.locals.account;

        if(account.servers.length == 0 && process.env.DEFAULT_SERVER_UUID) {
            account.servers.push(ObjectId.createFromHexString(process.env.DEFAULT_SERVER_UUID));
        }
        
        res.send({
            uuid: account.uuid.toHexString(),
            username: account.username,
            servers: account.servers.map(uuid => uuid.toHexString())
        } as ServerApi.WhoamiResponse);
    });
    api.get("/user", async (req, res) => {
        const { uuid } = req.query;
        if(typeof uuid != "string") {
            return res.status(400).send({ error: "Malformed request" });
        }
        const queriedAccount = await accountManager.findByUUID(ObjectId.createFromHexString(uuid));

        if(queriedAccount == null) {
            return res.status(404).send({ error: "User not found" });
        }
        
        res.send({
            uuid: queriedAccount.uuid.toHexString(),
            username: queriedAccount.username
        } as ServerApi.GetUserResponse);
    });
    api.post("/send", async (req, res) => {
        const account: Account = res.locals.account;

        const { content, server: serverUUID, channel: channelUUID } = req.body as ServerApi.SendMessageRequest;
        if(typeof content != "string" || content.replace(/[\s\t\r\n]/g, "").length == 0) {
            return res.status(400).send({ error: "Malformed request" });
        }
        if(typeof serverUUID != "string" || typeof channelUUID != "string") {
            return res.status(400).send({ error: "Malformed request" });
        }

        const channel = await chatManager.getChannel(ObjectId.createFromHexString(channelUUID), ObjectId.createFromHexString(serverUUID), accountManager);

        if(channel == null) {
            return res.status(404).send({ error: "Channel not found" });
        }

        const message = new Message;
        message.author = account;
        message.channel = channel;
        message.content = content;
        await chatManager.createMessage(message);

        const packet = new MessagePacket;
        packet.message.uuid = message.uuid.toHexString();
        packet.message.content = content;
        packet.message.server = channel.server.uuid.toHexString();
        packet.message.channel = channel.uuid.toHexString();
        packet.message.author = account.uuid.toHexString();

        res.status(200).send({ uuid: packet.message.uuid } as ServerApi.SendMessageResponse);

        sessionSocketLists.values().forEach(socketList => {
            socketList.forEach(socket => {
                socket.send(packet);
            });
        });
    });
    api.get("/message", async (req, res) => {
        const { uuid, channel, server } = req.query as any as ServerApi.GetMessageRequest;

        const message = await chatManager.getMessage(
            ObjectId.createFromHexString(uuid),
            ObjectId.createFromHexString(channel),
            ObjectId.createFromHexString(server),
            accountManager
        );

        if(message == null) {
            return res.status(404).send({ error: "Message not found" });
        }

        res.status(200).send({
            message: {
                uuid: message.uuid.toHexString(),
                channel: message.channel.uuid.toHexString(),
                server: message.channel.server.uuid.toHexString(),
                author: message.author.uuid.toHexString(),
                content: message.content,
                creationDate: message.creationDate.toISOString()
            }
        } as ServerApi.GetMessageResponse);
    });
    api.get("/messages", async (req, res) => {
        const { count, from, channel, server } = req.query as any as ServerApi.GetMessagesRequest;

        if(
            typeof count != "string" ||
            typeof channel != "string" ||
            typeof server != "string"
        ) return res.status(400).send({ error: "Malformed request" });

        const messages = await chatManager.getMessages(
            from == null ? null : ObjectId.createFromHexString(from),
            ObjectId.createFromHexString(channel),
            ObjectId.createFromHexString(server),
            +count,
            accountManager
        );

        res.status(200).send({
            messages: messages.map(message => ({
                uuid: message.uuid.toHexString(),
                channel: message.channel.uuid.toHexString(),
                server: message.channel.server.uuid.toHexString(),
                author: message.author.uuid.toHexString(),
                content: message.content,
                creationDate: message.creationDate.toISOString()
            }))
        } as ServerApi.GetMessagesResponse);
    });
    api.get("/channel", async (req, res) => {
        const { uuid, server } = req.query as any as ServerApi.GetChannelRequest;

        const channel = await chatManager.getChannel(
            ObjectId.createFromHexString(uuid),
            ObjectId.createFromHexString(server),
            accountManager
        );

        if(channel == null) {
            return res.status(404).send({ error: "Channel not found" });
        }

        res.status(200).send({
            uuid: channel.uuid.toHexString(),
            server: channel.server.uuid.toHexString(),
            name: channel.name
        } as ServerApi.GetChannelResponse);
    });
    api.get("/server", async (req, res) => {
        const { uuid } = req.query as any as ServerApi.GetServerRequest;

        const server = await chatManager.getServer(
            ObjectId.createFromHexString(uuid),
            accountManager
        );

        if(server == null) {
            return res.status(404).send({ error: "Server not found" });
        }

        res.status(200).send({
            uuid: server.uuid.toHexString(),
            name: server.name,
            channels: server.channels.keys().toArray(),
            owner: server.owner?.uuid.toHexString()
        } as ServerApi.GetServerResponse);
    });
    api.post("/create-server", async (req, res) => {
        const { name } = req.body as any as ServerApi.CreateServerRequest;
        const account: Account = res.locals.account;

        if(typeof name != "string") return res.status(400).send({ error: "Malformed request" });

        const server = new Server;
        server.name = name;
        server.owner = account;
        await chatManager.createServer(server);

        account.servers.push(server.uuid);
        await accountManager.updateAccount(account);

        res.status(200).send({
            name,
            uuid: server.uuid.toHexString()
        } as ServerApi.CreateServerResponse);
    });
    api.post("/create-channel", async (req, res) => {
        const { name, server: serverUUID } = req.body as any as ServerApi.CreateChannelRequest;
        const account: Account = res.locals.account;

        const server = await chatManager.getServer(ObjectId.createFromHexString(serverUUID), accountManager);
        if(account != server.owner) return res.status(403).send({ error: "Forbidden" });

        const channel = new Channel;
        channel.name = name;
        channel.server = server;
        await chatManager.createChannel(channel);

        server.addChannel(channel);
        await chatManager.updateServer(server);
        
        return res.status(200).send({
            uuid: channel.uuid.toHexString(),
            server: serverUUID,
            name
        } as ServerApi.CreateChannelResponse)
    })
    api.use((req, res) => {
        res.status(404).send({ error: "Not found" });
    });


    {
        const useTLS = (process.env.USE_TLS ?? "true").toLowerCase() == "true";

        const httpPort = +(process.env.HTTP_PORT ?? 80);
        const httpsPort = +(process.env.HTTPS_PORT ?? 443);
        const certFolder = path.resolve(process.env.CERTIFICATES_DIR ?? "/etc/letsencrypt/");

        const certificates = useTLS ? getSSLCertificates(certFolder) : null;
        if(certificates == null) {
            if(useTLS) console.log("No certificates found in " + certFolder);
            else console.log("TLS is disabled; no certificates scanned");
            app.listen(httpPort, () => console.log("Listening on http://localhost:" + httpPort));
        } else {
            console.log("Found certificates!");
            const server = createServer({
                key: certificates.get("privkey.pem"),
                cert: certificates.get("cert.pem")
            });
            app.attach(server);
            server.listen(httpsPort, () => console.log("Listening on https://*:" + httpsPort));

            const httpApp = express();
            httpApp.use((req, res) => {
                res.status(303).send("HTTPS required");
            });
            httpApp.listen(httpPort);
        }
}
}
function getSSLCertificates(directory: string) {
    const liveDirectory = path.join(directory, "live");
    if(!existsSync(liveDirectory)) return null;

    const domains = readdirSync(liveDirectory);
    for(const domain of domains) {
        try {
            const domainDir = path.join(liveDirectory, domain);
            const stat = statSync(domainDir);
            if(!stat.isDirectory()) continue;

            console.log("Trying to load certificate directory " + domain);

            const files = readdirSync(domainDir);
            const certificates: Map<string, Buffer> = new Map;

            for(const file of files) {
                certificates.set(file, readFileSync(path.join(domainDir, file)));
            }

            return certificates;
        } catch(e) {
            console.warn(e);
        }
    }
    return null;
}
async function initMongo() {
    accountManager = new AccountManager;
    await accountManager.connect();
    
    chatManager = new ChatManager;
    await chatManager.connect();
}