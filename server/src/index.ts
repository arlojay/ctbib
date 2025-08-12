import * as ServerApi from "@common/serverApi";
import express from "express";
import path from "node:path";
import bodyParser from "body-parser";
import { Account, AccountManager } from "./accounts";
import { IncomingHttpHeaders } from "node:http";
import { Router, WebSocketExpress } from "websocket-express";
import { UserSocketSession } from "./user/userSocketSession";
import { AuthorizationStatePacket, ChannelPacket, MessagePacket, UserJoinPacket } from "@common/packet";
import { ObjectId } from "mongodb";
import { Channel, ChatManager, Message, Server } from "./chat";
import { createServer } from "node:https";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { validateChannelName, validateMessage, validatePassword, validateServerName, validateUsername } from "@common/validation";

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
        let { username, password } = req.body as ServerApi.RegisterCredentials;

        if(typeof username != "string" || typeof password != "string") return res.status(400).send({ error: "Malformed request" });

        try {
            username = validateUsername(username);
            password = validatePassword(password);
        } catch(e) {
            return res.status(400).send({ error: e });
        }

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
        const socket = new UserSocketSession(await res.accept());

        const authPacket = new AuthorizationStatePacket;
        if(account == null) {
            authPacket.success = false;
            authPacket.error = "Forbidden";

            setTimeout(() => {
                socket.ws.close();
            }, 5000);
        } else {
            authPacket.success = true;
            const socketList = sessionSocketLists.get(token) ?? new Set;
            
            socket.once("close", () => socketList.delete(socket));
            socketList.add(socket);
            sessionSocketLists.set(token, socketList);
        }
        socket.send(authPacket);
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
        
        if(typeof content != "string" || typeof serverUUID != "string" || typeof channelUUID != "string") {
            return res.status(400).send({ error: "Malformed request" });
        }

        let trimmedContent = content;
        try {
            trimmedContent = validateMessage(trimmedContent);
        } catch(e) {
            return res.status(400).send({ error: "Invalid message" });
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

        sessionSocketLists.entries().forEach(([sessionToken, socketList]) => {
            const socketAccount = accountManager.findBySessionToken(sessionToken);
            if(socketAccount == account) return;

            if(!socketAccount.servers.some(uuid => uuid.toHexString() == channel.server.uuid.toHexString())) return;

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
        
        if(typeof uuid != "string" || typeof server != "string") return res.status(400).send({ error: "Malformed request" });

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
        const account: Account = res.locals.account;
        
        if(typeof uuid != "string") return res.status(400).send({ error: "Malformed request" });

        const server = await chatManager.getServer(
            ObjectId.createFromHexString(uuid),
            accountManager
        );

        if(server == null) {
            return res.status(404).send({ error: "Server not found" });
        }

        if(!account.servers.some(id => id.equals(server.uuid))) return res.status(403).send({ error: "Forbidden" });

        res.status(200).send({
            uuid: server.uuid.toHexString(),
            name: server.name,
            channels: server.channels.keys().toArray(),
            owner: server.owner?.uuid.toHexString()
        } as ServerApi.GetServerResponse);
    });
    api.get("/members", async (req, res) => {
        const { uuid } = req.query as any as ServerApi.GetMembersRequest;
        const account: Account = res.locals.account;
        
        if(typeof uuid != "string") return res.status(400).send({ error: "Malformed request" });

        const server = await chatManager.getServer(
            ObjectId.createFromHexString(uuid),
            accountManager
        );
        if(!account.servers.some(id => id.equals(server.uuid))) return res.status(403).send({ error: "Forbidden" });

        if(server == null) {
            return res.status(404).send({ error: "Server not found" });
        }

        const members = await accountManager.getServerMembers(server);

        res.status(200).send({
            members: members.map(member => ({
                uuid: member.uuid.toHexString(),
                username: member.username
            }))
        } as ServerApi.GetMembersResponse);
    });
    api.post("/create-server", async (req, res) => {
        const { name } = req.body as any as ServerApi.CreateServerRequest;
        const account: Account = res.locals.account;

        if(typeof name != "string") return res.status(400).send({ error: "Malformed request" });

        let trimmedName = name;
        try {
            trimmedName = validateServerName(trimmedName);
        } catch(e) {
            return res.status(400).send({ error: e });
        }

        const server = new Server;
        server.name = trimmedName;
        server.owner = account;
        await chatManager.createServer(server);

        account.servers.push(server.uuid);
        await accountManager.updateAccount(account);

        res.status(200).send({
            name: server.name,
            uuid: server.uuid.toHexString()
        } as ServerApi.CreateServerResponse);
    });
    api.post("/create-channel", async (req, res) => {
        const { name, server: serverUUID } = req.body as any as ServerApi.CreateChannelRequest;
        const account: Account = res.locals.account;

        if(typeof name != "string") return res.status(400).send({ error: "Malformed request" });

        let trimmedName = name;
        try {
            trimmedName = validateChannelName(trimmedName);
        } catch(e) {
            return res.status(400).send({ error: e });
        }

        const server = await chatManager.getServer(ObjectId.createFromHexString(serverUUID), accountManager);
        if(!account.uuid.equals(server.owner.uuid)) return res.status(403).send({ error: "Forbidden" });

        const channel = new Channel;
        channel.name = trimmedName;
        channel.server = server;
        await chatManager.createChannel(channel);

        server.addChannel(channel);
        await chatManager.updateServer(server);

        const packet = new ChannelPacket;
        packet.channel.uuid = channel.uuid.toHexString();
        packet.channel.name = channel.name;
        packet.channel.server = channel.server.uuid.toHexString();

        sessionSocketLists.entries().forEach(([sessionToken, socketList]) => {
            const socketAccount = accountManager.findBySessionToken(sessionToken);
            if(socketAccount == account) return;

            if(!socketAccount.servers.some(uuid => uuid.toHexString() == channel.server.uuid.toHexString())) return;
            
            socketList.forEach(socket => {
                socket.send(packet);
            });
        });
        
        return res.status(200).send({
            uuid: channel.uuid.toHexString(),
            server: serverUUID,
            name: channel.name
        } as ServerApi.CreateChannelResponse)
    });
    api.post("/create-invite", async (req, res) => {
        const { server: serverUUID } = req.body as any as ServerApi.CreateInviteRequest;
        const account: Account = res.locals.account;

        if(typeof serverUUID != "string") return res.status(400).send({ error: "Malformed request" });

        const server = await chatManager.getServer(ObjectId.createFromHexString(serverUUID), accountManager);
        if(server == null) return res.status(404).send({ error: "Server not found" });
        if(!account.uuid.equals(server.owner?.uuid)) return res.status(403).send({ error: "Forbidden" });

        const invite = await chatManager.createInvite(server, account);

        res.status(200).send({
            code: invite.code
        } as ServerApi.CreateInviteResponse);
    });
    api.post("/join-server", async (req, res) => {
        const { code } = req.body as any as ServerApi.JoinServerRequest;
        const account: Account = res.locals.account;

        const invite = await chatManager.getInvite(code, accountManager);
        if(invite == null) return res.status(404).send({ error: "Invite not found" });

        const server = await chatManager.getServer(invite.server, accountManager);
        if(invite == null) return res.status(404).send({ error: "Target server not found" });

        if(account.servers.some(uuid => uuid.toHexString() == server.uuid.toHexString()))  {
            return res.status(400).send({ error: "Already in server" });
        }

        const packet = new UserJoinPacket;
        packet.server = server.uuid.toHexString();
        packet.user.uuid = account.uuid.toHexString();
        packet.user.username = account.username;
        
        account.servers.push(server.uuid);
        await accountManager.updateAccount(account);

        sessionSocketLists.entries().forEach(([sessionToken, socketList]) => {
            const socketAccount = accountManager.findBySessionToken(sessionToken);
            if(socketAccount == account) return;

            if(!socketAccount.servers.some(uuid => uuid.toHexString() == server.uuid.toHexString())) return;
            
            socketList.forEach(socket => {
                socket.send(packet);
            });
        });

        res.status(200).send({
            uuid: server.uuid.toHexString()
        } as ServerApi.JoinServerResponse)
    });
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
    const accountsClusterURI = process.env.ACCOUNTS_CLUSTER_URI ?? readFileSync("/run/secrets/accounts_cluster_uri").toString();
    console.log(accountsClusterURI);
    accountManager = new AccountManager(accountsClusterURI);
    await accountManager.connect();
    
    chatManager = new ChatManager(process.env.CHAT_CLUSTER_URI ?? readFileSync("/run/secrets/chat_cluster_uri").toString());
    await chatManager.connect();
}