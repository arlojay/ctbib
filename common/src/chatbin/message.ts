import { Serializable } from "@common/serialization/serializable";
import { BinaryBuffer, U64 } from "@common/serialization/binaryBuffer";

export class BinaryMessage extends Serializable {
    public uuid: string;
    public author: string;
    public channel: string;
    public server: string;
    public content: string;
    public creationDate: Date = new Date;
    
    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.uuid);
        bin.write_string(this.author);
        bin.write_string(this.channel);
        bin.write_string(this.server);
        bin.write_string(this.content);
        bin.write_u64(BigInt(this.creationDate.getTime()));
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.uuid = bin.read_string();
        this.author = bin.read_string();
        this.channel = bin.read_string();
        this.server = bin.read_string();
        this.content = bin.read_string();
        this.creationDate.setTime(Number(bin.read_u64()));
    }
    public getExpectedSize(): number {
        return (
            BinaryBuffer.stringByteCount(this.uuid) +
            BinaryBuffer.stringByteCount(this.author) +
            BinaryBuffer.stringByteCount(this.channel) +
            BinaryBuffer.stringByteCount(this.server) +
            BinaryBuffer.stringByteCount(this.content) +
            U64
        )
    }
}