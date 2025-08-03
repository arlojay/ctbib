import express from "express";
import path from "node:path";

const app = express();

app.use(express.static(path.join(process.cwd(), "../client/dist/")));

app.listen(3000, () => console.log("Listening on http://localhost:3000"));