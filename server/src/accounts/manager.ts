import { Db, MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { Account, SerializedAccount } from "./account";
import { Login, SerializedLogin } from "./login";

export class AccountManager {
    private mongo: MongoClient;
    private db: Db;
    private accounts: Map<string, Account> = new Map;
    private sessions: Map<string, Account> = new Map;

    public constructor() {
        this.mongo = new MongoClient(process.env.CHAT_CLUSTER_URI, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });
        this.db = this.mongo.db("accounts");
    }

    public async connect() {
        await this.mongo.connect();
    }
    
    public async getLogin(uuid: ObjectId) {
        const dbAccount = await this.db.collection("logins").findOne<SerializedLogin>({ _id: uuid });

        if(dbAccount == null) return null;

        const login = new Login;
        login.deserialize(dbAccount);

        return login;
    }

    public async findByUUID(uuid: ObjectId) {
        if(uuid == null) return null;

        if(this.accounts.has(uuid.toHexString())) return this.accounts.get(uuid.toHexString());
        const dbAccount = await this.db.collection("accounts").findOne<SerializedAccount>({ _id: uuid });

        if(dbAccount == null) return null;

        const account = new Account;
        await account.deserialize(dbAccount, this);

        this.accounts.set(account.uuid.toHexString(), account);

        return account;
    }

    public async findByUsername(username: string) {
        const dbAccount = await this.db.collection("accounts").findOne<SerializedAccount>({ username });
        if(dbAccount == null) return null;

        if(this.accounts.has(dbAccount._id.toHexString())) return this.accounts.get(dbAccount._id.toHexString());

        const account = new Account;
        await account.deserialize(dbAccount, this);

        this.accounts.set(account.uuid.toHexString(), account);

        return account;
    }
    public findBySessionToken(token: string) {
        return this.sessions.get(token);
    }

    public async register(account: Account) {
        const existingAccountWithUsername = await this.findByUsername(account.username);
        if(existingAccountWithUsername != null) throw new Error("Account with username already exists");

        const loginDocument = await this.db.collection("logins").insertOne(account.login.serialize());
        account.login.setUUID(loginDocument.insertedId);

        const accountDocument = await this.db.collection("accounts").insertOne(account.serialize());
        account.setUUID(accountDocument.insertedId);

        const session = account.createSession();
        this.sessions.set(session, account);
        return session;
    }

    public async login(username: string, password: string) {
        const account = await this.findByUsername(username);

        if(account == null) throw new Error("Username not found");
        if(!account.login.testPassword(password)) throw new Error("Incorrect password");

        const session = account.createSession();
        this.sessions.set(session, account);
        return session;
    }

    public async updateAccount(account: Account) {
        await this.db.collection("accounts").replaceOne({ _id: account.uuid }, account.serialize());
    }
}