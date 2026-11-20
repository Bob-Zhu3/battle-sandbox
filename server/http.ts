import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import sirv from "sirv";
import { attachRoom } from "./socket.ts";

export function createGameServer() {
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  const serve = sirv(dist, { single: true });
  const http = createServer((request, response) => serve(request, response));
  const closeRoom = attachRoom(http);
  return { http, closeRoom };
}
