import assets from "virtual:battle-assets";
import { isMatchId } from "../src/match-link.ts";
import { matchDatabase, type Database } from "./match-database.ts";
import { exchange } from "./online-match.ts";
import { openHostedSocket, type WorkerContext } from "./hosted-socket.ts";

const noStore = {"Cache-Control":"no-store"};
function text(message: string, status: number) { return new Response(message,{status,headers:noStore}); }

export default {
  async fetch(request: Request, env: {DB: Database}, ctx: WorkerContext) {
    const url = new URL(request.url), path = url.pathname;
    const api = /^\/api\/matches\/(duel|ffa)\/(lobby|[a-f0-9]{20})$/.exec(path);
    const socket = path === "/room/socket" || path === "/ffa/socket";
    if (api || socket) {
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) return text("This match belongs to a different site.",403);
      const store = matchDatabase(env.DB);
      if (socket) {
        if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return text("A WebSocket upgrade is required.",426);
        const id = url.searchParams.get("match");
        if (id !== null && !isMatchId(id)) return text("Invalid match link.",400);
        return openHostedSocket(store,path === "/ffa/socket" ? "ffa" : "duel",id ?? "lobby",ctx);
      }
      if (request.method !== "POST") return text("Use POST.",405);
      if (Number(request.headers.get("Content-Length")) > 16_384) return text("Command too large.",413);
      const reader = request.body?.getReader();
      if (!reader) return text("Missing command.",400);
      const decoder = new TextDecoder();
      let body = "", length = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 16_384) { void reader.cancel(); return text("Command too large.",413); }
        body += decoder.decode(part.value,{stream:true});
      }
      body += decoder.decode();
      let input: unknown;
      try { input = JSON.parse(body); } catch { return text("Invalid JSON.",400); }
      const result = await exchange(store,api![1] === "ffa" ? "ffa" : "duel",api![2],input);
      return Response.json(result,{headers:noStore});
    }
    if (request.method !== "GET" && request.method !== "HEAD") return text("Method not allowed.",405);
    const page = ["/","/room","/room/","/ffa","/ffa/","/index.html"].includes(path);
    const file = Object.hasOwn(assets,page?"/index.html":path) ? assets[page?"/index.html":path] : undefined;
    if (!file) return text("Page not found.",404);
    const headers = {"Content-Type":file.type,"Cache-Control":page?"no-cache":"public, max-age=31536000, immutable","X-Content-Type-Options":"nosniff"};
    if (request.method === "HEAD") return new Response(null,{headers});
    const bytes = Uint8Array.from(atob(file.data),c => c.charCodeAt(0));
    return new Response(bytes,{headers});
  },
};
