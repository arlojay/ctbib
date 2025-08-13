import { BinaryBuffer, BOOL } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class UserStatusChangePacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = UserStatusChangePacket.id;

    public uuid: string;
    public online: boolean;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_boolean(this.online);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.online = bin.read_boolean();
    }
    protected getOwnExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.uuid) + BOOL;
    }
}