process.loadEnvFile(".env");
const fs = require("node:fs");

const { MONGO_ROOT_USERNAME, MONGO_ROOT_PASSWORD } = process.env;

if(!fs.existsSync("secrets")) fs.mkdirSync("secrets");

fs.writeFileSync("secrets/accounts_cluster_uri", `mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@database:27017/accounts?authSource=admin&authMechanism=SCRAM-SHA-256`);
fs.writeFileSync("secrets/chat_cluster_uri", `mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@database:27017/chat?authSource=admin&authMechanism=SCRAM-SHA-256`);