import { BinaryBuffer } from "@common/serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class AuthorizationPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = AuthorizationPacket.id;

    public token: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.token);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.token = bin.read_string();
    }
    protected getOwnExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.token)
        )
    }
}