import { BinaryBuffer } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";
import { BinaryUser } from "../chatbin";

export class UserJoinPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = UserJoinPacket.id;

    public user: BinaryUser = new BinaryUser;
    public server: string;

    protected serialize(bin: BinaryBuffer): void {
        this.user.write(bin);
        bin.write_string(this.server);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.user.read(bin);
        this.server = bin.read_string();
    }
    protected getOwnExpectedSize(): number {
        return this.user.getExpectedSize() + BinaryBuffer.stringByteCount(this.server);
    }
}