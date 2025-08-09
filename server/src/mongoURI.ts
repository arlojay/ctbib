interface MongoURIOptions {
    username: string;
    password: string;
    host: string;
    cluster: string;
}
export function buildMongoURI(options: MongoURIOptions) {
    let str = "mongodb+srv://";
    str += options.username;
    str += ":";
    str += options.password;
    str += "@";
    str += options.host;
    str += "/?retryWrites=true&w=majority&appName=";
    str += options.cluster;

    return str;
}