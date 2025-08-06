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
}
export interface SendMessageRequest {
    content: string;
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
export interface GetMessageRequest {
    uuid: string;
}
export interface GetMessageResponse {
    uuid: string;
    author: string;
    content: string;
}