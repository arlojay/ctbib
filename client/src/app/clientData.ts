import { loadObjectStoreIntoJson, openDb, saveJsonAsObjectStore } from "./dbUtils";

export interface AuthenticationOptions {
    token: string;
}

export class ClientData {
    public static readonly VERSION = 1 as const;
    private db: IDBDatabase;

    public authentication: AuthenticationOptions = {
        token: ""
    };

    public async open() {
        this.db = await openDb("ctbib-clientdata", {
            version: ClientData.VERSION,
            upgrade(db, target) {
                if(target == 1) {
                    db.createObjectStore("authentication", { keyPath: "name" });
                }
            },
        })
    }

    public async loadAll() {
        await this.loadAuthentication();
    }
    public async saveAll() {
        await this.saveAuthentication();
    }

    public async saveAuthentication() {
        await saveJsonAsObjectStore(this.authentication, this.db.transaction("authentication", "readwrite").objectStore("authentication"), { packArrays: false });
    }
    public async loadAuthentication() {
        await loadObjectStoreIntoJson(this.authentication, this.db.transaction("authentication", "readonly").objectStore("authentication"));
    }
}