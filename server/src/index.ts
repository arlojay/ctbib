process.loadEnvFile("../.env");
process.loadEnvFile("../server.env");
import * as ServerApi from "@common/serverApi.js";
import express from "express";
import path from "node:path";
import bodyParser from "body-parser";
import { Account, AccountManager } from "./accounts";
import { IncomingHttpHeaders } from "node:http";
import { Router, WebSocketExpress } from "websocket-express";
import { UserSocketSession } from "./chat/userSocketSession";
import { MessagePacket } from "@common/packet";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";

let accountManager: AccountManager;
const sessionSocketLists: Map<string, Set<UserSocketSession>> = new Map;

main();

async function main() {
    await initMongo();
    await initExpress();
}

function getBearerToken(headers: IncomingHttpHeaders) {
    const { authorization } = headers;
    if(authorization.startsWith("Bearer ")) return authorization.slice(7);

    return null;
}

async function initExpress() {
    const app = new WebSocketExpress;

    app.use(express.static(path.join(process.cwd(), "../client/dist/")));

    const api = new Router();
    app.use("/api", api);

    api.use(bodyParser.json());
    api.post("/login", async (req, res) => {
        const { username, password } = req.body as ServerApi.LoginCredentials;

        try {
            const sessionToken = await accountManager.login(username, password);
            res.send({ sessionToken });
            
            const account = accountManager.findBySessionToken(sessionToken);
            account.lastLoginDate.setDate(Date.now());
            await accountManager.updateAccount(account);
        } catch(e) {
            while(e.cause != null) e = e.cause;

            console.error(e);
            res.send({ error: e.message });
        }
    });
    api.post("/register", async (req, res) => {
        const { username, password } = req.body as ServerApi.RegisterCredentials;

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
    api.get("/whoami", async (req, res) => {
        const token = getBearerToken(req.headers);

        if(token == null) {
            res.status(403).send({ error: "Unauthorized" });
            return;
        }

        const account = accountManager.findBySessionToken(token);
        if(account == null) {
            res.status(400).send({ error: "Invalid session" });
            return;
        }
        
        res.send({
            uuid: account.uuid.toHexString(),
            username: account.username
        } as ServerApi.WhoamiResponse);
    });
    api.get("/user", async (req, res) => {
        const token = getBearerToken(req.headers);

        if(token == null) {
            res.status(403).send({ error: "Unauthorized" });
            return;
        }

        const account = accountManager.findBySessionToken(token);
        if(account == null) {
            res.status(400).send({ error: "Invalid session" });
            return;
        }

        const { uuid } = req.query;
        if(uuid == null || typeof uuid != "string") {
            return res.status(400).send({ error: "Malformed request" });
        }
        const queriedAccount = await accountManager.findByUUID(ObjectId.createFromHexString(uuid));

        if(queriedAccount == null) {
            return res.status(404).send({ error: "Not found" });
        }
        
        res.send({
            uuid: queriedAccount.uuid.toHexString(),
            username: queriedAccount.username
        } as ServerApi.GetUserResponse);
    });
    api.ws("/ws", async (req, res) => {
        const { token } = req.query;
        if(token == null || typeof token != "string") return res.status(403).send("Unauthorized");

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
    api.post("/send", async (req, res) => {
        const token = getBearerToken(req.headers);
        if(token == null || typeof token != "string") return res.status(403).send({ error: "Unauthorized" });
        
        const account = accountManager.findBySessionToken(token);
        if(account == null) {
            res.status(400).send("Invalid session");
            return;
        }

        const { content } = req.body as ServerApi.SendMessageRequest;
        if(content == null || typeof content != "string" || content.replace(/[\s\t\r\n]/g, "").length == 0) {
            return res.status(400).send({ error: "Malformed request" });
        }

        const packet = new MessagePacket;
        packet.message.uuid = randomUUID();
        packet.message.content = content;
        packet.message.author = account.uuid.toHexString();

        res.status(200).send({ uuid: packet.message.uuid } as ServerApi.SendMessageResponse);

        sessionSocketLists.values().forEach(socketList => {
            socketList.forEach(socket => {
                socket.send(packet);
            });
        });
    });
    api.use((req, res) => {
        res.status(404).send({ error: "Not found" });
    })
    

    app.listen(3000, () => console.log("Listening on http://localhost:3000"));
}
async function initMongo() {
    accountManager = new AccountManager;
    await accountManager.connect();
}