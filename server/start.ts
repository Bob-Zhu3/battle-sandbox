import { existsSync } from "node:fs";
import { createGameServer } from "./http.ts";

if (!existsSync(new URL("../dist/index.html", import.meta.url))) throw new Error("Build the game with npm run build first.");
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";
const { http } = createGameServer();
http.listen(port, host, () => console.log("Two-player room: http://" + host + ":" + port + "/room"));
