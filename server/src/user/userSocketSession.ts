import { TypedEmitter } from "tiny-typed-emitter";
import { Packet } from "@common/packet";
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
    }

    public send(packet: Packet) {
        const buffer = packet.allocateBuffer();
        const bin = new BinaryBuffer(buffer);
        packet.write(bin);
        this.ws.send(buffer);
    }
}