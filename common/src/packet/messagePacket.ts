import { BinaryBuffer } from "@common/serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";
import { BinaryMessage } from "@common/chatbin/message";

export class MessagePacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = MessagePacket.id;

    public message: BinaryMessage = new BinaryMessage;

    protected serialize(bin: BinaryBuffer): void {
        this.message.write(bin);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.message.read(bin);
    }
    protected getOwnExpectedSize(): number {
        return this.message.getExpectedSize();
    }
}