import { ChannelPacket, MessagePacket, Packet, packetRegistry } from "@common/packet";
import { serverEndpoint } from "./serverApi";
import { TypedEmitter } from "tiny-typed-emitter";
import { BinaryBuffer } from "@common/serialization/binaryBuffer";
import { BinaryMessage } from "@common/chatbin/message";
import { BinaryChannel } from "@common/chatbin";

interface ChatClientEvents {
    "disconnected": () => void;
    "connected": () => void;
    "message": (message: BinaryMessage) => void;
    "channel-create": (channel: BinaryChannel) => void;
}

export class ChatClient extends TypedEmitter<ChatClientEvents> {
    public socket: WebSocket;

    public async connect(authorizationToken: string) {
        const url = new URL("api/ws", serverEndpoint);
        url.searchParams.set("token", authorizationToken);
        this.socket = new WebSocket(url);

        const onConnected = Promise.withResolvers<void>();

        this.socket.addEventListener("open", async () => {
            this.emit("connected");
            onConnected.resolve();
        });
        this.socket.addEventListener("close", () => {
            this.emit("disconnected");
            onConnected.reject(new Error("Socket closed"));
        });
        this.socket.addEventListener("error", event => {
            this.emit("disconnected");
            onConnected.reject(new Error("Websocket error", { cause: event }));
        });
        this.socket.addEventListener("message", async event => {
            let data = event.data;
            if(data instanceof Blob) {
                data = await data.arrayBuffer();
            }

            if(data instanceof ArrayBuffer) {
                const packet = packetRegistry.createFromBinary(data);
                this.handlePacket(packet);
            }
        });

        await onConnected.promise;
    }

    public send(packet: Packet) {
        const buffer = packet.allocateBuffer();
        const bin = new BinaryBuffer(buffer);
        packet.write(bin);
        this.socket.send(buffer);
    }

    private handlePacket(packet: Packet) {
        if(packet instanceof MessagePacket) {
            this.emit("message", packet.message);
        }
        if(packet instanceof ChannelPacket) {
            this.emit("channel-create", packet.channel);
        }
    }
}