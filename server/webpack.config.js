import path from "path";
import { TsconfigPathsPlugin } from "tsconfig-paths-webpack-plugin";

export default {
    entry: "./src/index.ts",
    target: "node",
    output: {
        filename: "server.js",
        path: path.resolve(process.cwd(), "dist"),
        clean: true,
    },
    resolve: {
        extensions: [".ts", ".js"],
        plugins: [
            new TsconfigPathsPlugin({
                configFile: "./tsconfig.json"
            })
        ]
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    mode: "development",
};