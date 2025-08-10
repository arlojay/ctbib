import { BinaryBuffer, BOOL } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class AuthorizationStatePacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = AuthorizationStatePacket.id;

    public success: boolean;
    public error: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_boolean(this.success);

        if(!this.success) {
            bin.write_string(this.error);
        }
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.success = bin.read_boolean();

        if(!this.success) {
            this.error = bin.read_string();
        }
    }
    protected getOwnExpectedSize(): number {
        return (
            BOOL +
            (
                this.success
                ? 0
                : BinaryBuffer.stringByteCount(this.error)
            )
        )
    }

}