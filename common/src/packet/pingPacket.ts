import { BinaryBuffer } from "@common/serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class PingPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = PingPacket.id;

    protected serialize(bin: BinaryBuffer): void {
        
    }
    protected deserialize(bin: BinaryBuffer): void {
        
    }
    protected getOwnExpectedSize(): number {
        return 0;
    }
}