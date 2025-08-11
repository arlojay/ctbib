import { BinaryBuffer } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";
import { BinaryChannel } from "../chatbin";

export class ChannelPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = ChannelPacket.id;

    public channel: BinaryChannel = new BinaryChannel;

    protected serialize(bin: BinaryBuffer): void {
        this.channel.write(bin);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.channel.read(bin);
    }
    protected getOwnExpectedSize(): number {
        return this.channel.getExpectedSize();
    }
}