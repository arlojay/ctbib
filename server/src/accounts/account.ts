import crypto from "node:crypto";
import { Login } from "./login";
import { AccountManager } from "./manager";
import { ObjectId } from "mongodb";

export interface SerializedAccount {
    _id: ObjectId;
    login: ObjectId;
    username: string;
    creationDate: Date;
    lastLoginDate: Date;
    servers: ObjectId[];
}
export class Account {
    public uuid: ObjectId;
    public login = new Login;
    public username: string;
    public creationDate = new Date;
    public lastLoginDate = new Date;
    public sessions: Set<string> = new Set;
    public servers: ObjectId[] = new Array;

    public create(username: string, password: string) {
        this.username = username;
        this.login.create(password);
    }

    public setUUID(uuid: ObjectId) {
        this.uuid = uuid;
    }

    public serialize(): SerializedAccount {
        return {
            _id: this.uuid,
            login: this.login.uuid,
            username: this.username,
            creationDate: this.creationDate,
            lastLoginDate: this.lastLoginDate,
            servers: this.servers
        }
    }
    public async deserialize(data: SerializedAccount, accountManager: AccountManager) {
        this.uuid = data._id;
        this.login = await accountManager.getLogin(data.login);
        this.username = data.username;
        this.creationDate = data.creationDate ?? new Date;
        this.lastLoginDate = data.lastLoginDate ?? new Date;
        if(data.servers != null) this.servers = data.servers;
    }

    public createSession() {
        const token = crypto.randomBytes(96).toString("base64url");
        this.sessions.add(token);
        return token;
    }

    public sharesServers(account: Account) {
        for(const server of account.servers) {
            if(this.servers.some(uuid => uuid.equals(server))) return true;
        }
        return false;
    }
}