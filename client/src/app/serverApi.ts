import { GetMessagesRequest, GetMessagesResponse, GetMessageRequest, GetMessageResponse, GetUserRequest, GetUserResponse, LoginCredentials, RegisterCredentials, SendMessageRequest, SendMessageResponse, SessionStartResponse, WhoamiResponse, GetChannelRequest, GetChannelResponse, GetServerRequest, GetServerResponse } from "@common/serverApi";
import path from "path";

export const serverEndpoint = "http://localhost:3000";

type RequestMethod = "POST" | "GET";

export class ServerError extends Error {}

async function request(endpoint: string, method: RequestMethod, payload?: object, authorization?: string) {
    const options: RequestInit = { method, headers: {} };

    const endpointURL = new URL(path.join("api", endpoint), serverEndpoint);
    
    if(method == "POST") {
        (options.headers as any)["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload);
    } else {
        for(const key in payload) {
            if(payload[key] == null) continue;
            endpointURL.searchParams.set(key, (payload as any)[key]);
        }
    }
    if(authorization != null) {
        (options.headers as any)["Authorization"] = "Bearer " + authorization;
    }

    try {
        const response = await fetch(endpointURL, options);
        if(response.status == 500) throw new ServerError("Internal server error");

        const data = await response.json();

        if("error" in data) {
            throw new ServerError(data.error);
        }

        return data;
    } catch(cause) {
        throw new Error("Error during server request to " + endpoint, { cause });
    }
}


let token: string;
export function setToken(authenticationToken: string) {
    token = authenticationToken;
}

export async function login(credentials: LoginCredentials) {
    return await request("login", "POST", credentials) as SessionStartResponse;
}
export async function register(credentials: RegisterCredentials) {
    return await request("register", "POST", credentials) as SessionStartResponse;
}
export async function whoami() {
    return await request("whoami", "GET", undefined, token) as WhoamiResponse;
}
export async function sendMessage(message: SendMessageRequest) {
    return await request("send", "POST", message, token) as SendMessageResponse;
}
export async function userInfo(user: GetUserRequest) {
    return await request("user", "GET", user, token) as GetUserResponse;
}
export async function messageInfo(message: GetMessageRequest) {
    return await request("message", "GET", message, token) as GetMessageResponse;
}
export async function fetchMessages(query: GetMessagesRequest) {
    return await request("messages", "GET", query, token) as GetMessagesResponse;
}
export async function channelInfo(query: GetChannelRequest) {
    return await request("channel", "GET", query, token) as GetChannelResponse;
}
export async function serverInfo(query: GetServerRequest) {
    return await request("server", "GET", query, token) as GetServerResponse;
}