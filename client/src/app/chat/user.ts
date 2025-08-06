import { BinaryUser } from "@common/chatbin";

export class User {
    public binary: BinaryUser;

    constructor(
        public uuid: string,
        public username: string
    ) {
        this.binary = new BinaryUser;
        this.binary.uuid = uuid;
        this.binary.username = username;
    }
}