import crypto from "node:crypto";

export interface SerializedPassword {
    hash: string;
    salt: string;
}
export class Password {
    public hash: string;
    public salt: string;

    public generate(password: string) {
        this.salt = crypto.randomUUID();
        this.hash = crypto.hash("sha256", password + this.salt, "hex");
    }

    public test(password: string) {
        return this.hash == crypto.hash("sha256", password + this.salt, "hex");
    }

    public serialize(): SerializedPassword {
        return {
            hash: this.hash,
            salt: this.salt
        }
    }
    public deserialize(data: SerializedPassword) {
        this.hash = data.hash;
        this.salt = data.salt;
    }
}