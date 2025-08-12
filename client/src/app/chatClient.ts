import { AuthorizationStatePacket, ChannelPacket, MessagePacket, Packet, packetRegistry, PingPacket, UserJoinPacket } from "@common/packet";
import { serverEndpoint } from "./serverApi";
import { TypedEmitter } from "tiny-typed-emitter";
import { BinaryBuffer } from "@common/serialization/binaryBuffer";
import { BinaryMessage } from "@common/chatbin/message";
import { BinaryChannel, BinaryUser } from "@common/chatbin";

interface ChatClientEvents {
    "disconnected": () => void;
    "auth-invalid": () => void;
    "connected": () => void;
    "message": (message: BinaryMessage) => void;
    "channel-create": (channel: BinaryChannel) => void;
    "user-join": (user: BinaryUser, server: string) => void;
}

export class ChatClient extends TypedEmitter<ChatClientEvents> {
    public socket: WebSocket;
    private connecting = false;
    private lastReceivedPing = 0;
    private authenticationValid = true;
    private lastAuth: string;

    constructor() {
        super();

        setInterval(() => {
            if(this.socket == null || this.socket.readyState != this.socket.OPEN) return;

            this.send(new PingPacket);
        }, 5000);
        setInterval(() => {
            if(this.socket == null || this.socket.readyState != this.socket.OPEN) return;

            if(performance.now() - this.lastReceivedPing > 10000) {
                this.socket.close();
            }
        }, 1000);
    }

    private async hashToken(token: string) {
        return new TextDecoder().decode(await crypto.subtle.digest({ name: "SHA-256" }, new TextEncoder().encode(token)));
    }

    public async connect(authorizationToken: string) {
        if(this.socket != null || this.connecting) return;
        this.connecting = true;

        const tokenHash = await this.hashToken(authorizationToken);
        this.lastAuth = tokenHash;

        if(!this.authenticationValid && this.lastAuth != tokenHash) {
            console.log("trying to connect with new token");
            this.authenticationValid = true;
        } else if(!this.authenticationValid && this.lastAuth == tokenHash) {
            console.log("tried to connect with old, failed token");
            return;
        }
        const url = new URL("api/ws", serverEndpoint);
        url.searchParams.set("token", authorizationToken);
        this.socket = new WebSocket(url);

        const onConnected = Promise.withResolvers<void>();

        this.socket.addEventListener("open", async () => {
            this.connecting = false;
            this.emit("connected");
            onConnected.resolve();
        });
        this.socket.addEventListener("close", () => {
            this.socket = null;
            this.connecting = false;
            if(this.authenticationValid) {
                this.emit("disconnected");
            } else {
                this.emit("auth-invalid");
            }
            onConnected.reject(new Error("Socket closed"));
        });
        this.socket.addEventListener("error", event => {
            this.socket = null;
            this.connecting = false;
            if(this.authenticationValid) {
                this.emit("disconnected");
            } else {
                this.emit("auth-invalid");
            }
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
        this.lastReceivedPing = performance.now();
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
        if(packet instanceof UserJoinPacket) {
            this.emit("user-join", packet.user, packet.server);
        }
        if(packet instanceof PingPacket) {
            this.lastReceivedPing = performance.now();
        }
        if(packet instanceof AuthorizationStatePacket) {
            if(!packet.success) {
                this.authenticationValid = false;
                this.socket.close();
            }
        }
    }
}