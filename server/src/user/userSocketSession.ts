import { TypedEmitter } from "tiny-typed-emitter";
import { Packet, packetRegistry, PingPacket } from "@common/packet";
import { BinaryBuffer } from "@common/serialization/binaryBuffer";
import { ExtendedWebSocket } from "websocket-express";

export class UserSocketSession extends TypedEmitter<{
    "close": () => void;
}> {
    public open = true;

    public constructor(
        public ws: ExtendedWebSocket
    ) {
        super();

        ws.onclose = () => {
            this.open = false;
            this.emit("close");
        };
        ws.onmessage = (event) => {
            if(event.data instanceof Buffer) {
                const arrayBuffer = new ArrayBuffer(event.data.byteLength);
                const view = new Uint8Array(arrayBuffer);
                for(let i = 0; i < view.length; i++) {
                    view[i] = event.data.readUint8(i);
                }
                const bin = new BinaryBuffer(view.buffer as ArrayBuffer);
                const packet = packetRegistry.createFromBinary(bin);

                this.handlePacket(packet);
            }
        }
    }
    private handlePacket(packet: Packet) {
        if(packet instanceof PingPacket) {
            this.send(new PingPacket);
        }
    }

    public send(packet: Packet) {
        const buffer = packet.allocateBuffer();
        const bin = new BinaryBuffer(buffer);
        packet.write(bin);
        this.ws.send(buffer);
    }
}