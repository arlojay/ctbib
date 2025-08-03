import path from "path";
import CopyWebpackPlugin from "copy-webpack-plugin";

export default {
    entry: "./src/app/index.ts",
    output: {
        filename: "bundle.js",
        path: path.resolve(process.cwd(), "dist"),
        clean: true,
    },
    resolve: {
        extensions: [".ts", ".js"],
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
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: "src/index.html", to: "index.html" },
                { from: "src/assets", to: "assets" },
            ]
        })
    ],
    devtool: "source-map",
    mode: "development",
};