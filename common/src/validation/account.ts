export function validateUsername(username: string) {
    username = username.trim();

    if(/[^a-zA-Z0-9_\-\s]/.test(username)) throw "Must only use alphanumerics and spaces";
    if(username.length < 4) throw "Too short";
    if(username.length > 32) throw "Too long";

    return username;
}
export function validatePassword(password: string) {
    if (password.length < 8) throw "Too short";
    if (!/[A-Z]/.test(password)) throw "Must contain at least one uppercase letter";
    if (!/[a-z]/.test(password)) throw "Must contain at least one lowercase letter";
    if (!/[0-9]/.test(password)) throw "Must contain at least one digit";
    if (!/[^a-zA-Z0-9]/.test(password)) throw "Must contain at least one symbol";

    return password;
}