export interface LoginCredentials {
    username: string;
    password: string;
}
export interface RegisterCredentials {
    username: string;
    password: string;
}
export interface SessionStartResponse {
    sessionToken: string;
}
export interface WhoamiResponse {
    uuid: string;
    username: string;
    servers: string[];
}
export interface SendMessageRequest {
    content: string;
    server: string;
    channel: string;
}
export interface SendMessageResponse {
    uuid: string;
}
export interface GetUserRequest {
    uuid: string;
}
export interface GetUserResponse {
    uuid: string;
    username: string;
}
export interface JsonMessage {
    uuid: string;
    server: string;
    channel: string;
    author: string;
    content: string;
    creationDate: string;
}
export interface JsonChannel {
    uuid: string;
}
export interface GetMessageRequest {
    uuid: string;
    channel: string;
    server: string;
}
export interface GetMessageResponse {
    message: JsonMessage;
}
export interface GetMessagesRequest {
    count: number;
    from?: string;
    channel: string;
    server: string;
}
export interface GetMessagesResponse {
    messages: JsonMessage[];
}
export interface GetChannelRequest {
    uuid: string;
    server: string;
}
export interface GetChannelResponse {
    uuid: string;
    server: string;
    name: string;
}
export interface GetServerRequest {
    uuid: string;
}
export interface GetServerResponse {
    uuid: string;
    name: string;
    channels: string[];
}
export interface CreateServerRequest {
    name: string;
}
export interface CreateServerResponse {
    uuid: string;
    name: string;
    channels: string[];
}