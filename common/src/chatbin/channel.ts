import { Serializable } from "../serialization/serializable";
import { BinaryBuffer } from "../serialization/binaryBuffer";

export class BinaryChannel extends Serializable {
    public uuid: string;
    public server: string;
    public name: string;
    
    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_string(this.server);
        bin.write_string(this.name);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.server = bin.read_string();
        this.name = bin.read_string();
    }
    public getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            BinaryBuffer.stringByteCount(this.server) +
            BinaryBuffer.stringByteCount(this.name)
        )
    }
}