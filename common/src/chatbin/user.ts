import { BinaryBuffer } from "../serialization/binaryBuffer";
import { Serializable } from "../serialization/serializable";

export class BinaryUser extends Serializable {
    public uuid: string;
    public username: string;

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_string(this.username);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.username = bin.read_string();
    }
    public getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            BinaryBuffer.stringByteCount(this.username)
        )
    }
}