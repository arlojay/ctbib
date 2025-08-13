import { BinaryBuffer, BOOL } from "../serialization/binaryBuffer";
import { Serializable } from "../serialization/serializable";

export class BinaryUser extends Serializable {
    public uuid: string;
    public username: string;
    public online: boolean;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_string(this.username);
        bin.write_boolean(this.online);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.username = bin.read_string();
        this.online = bin.read_boolean();
    }
    public getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            BinaryBuffer.stringByteCount(this.username) +
            BOOL
        )
    }
}