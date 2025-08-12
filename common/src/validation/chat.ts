export function validateMessage(message: string) {
    if(message.replace(/[\s\t\r\n]/g, "").length == 0) throw "Too short";
    if(message.length > 2000) throw "Too long";
    
    return message.trim();
}
export function validateServerName(name: string) {
    name = name.trim();

    if(/[^a-zA-Z0-9_\-\s]/.test(name)) throw "Must only use alphanumerics and spaces";
    if(name.length < 1) throw "Too short";
    if(name.length > 32) throw "Too long";

    return name;
}
export function validateChannelName(name: string) {
    name = name.trim();

    if(/[^a-zA-Z0-9_\-\s]/.test(name)) throw "Must only use alphanumerics and spaces";
    if(name.length < 1) throw "Too short";
    if(name.length > 32) throw "Too long";

    return name;
}