import { CLOSE } from "../src/room-protocol.ts";
import type { MatchMode } from "../src/battlefield.ts";
import { exchange, type MatchStore } from "./online-match.ts";
import { record } from "./room.ts";

interface ServerSocket extends WebSocket { accept(): void }
declare const WebSocketPair: new () => {0:WebSocket; 1:ServerSocket};
export interface WorkerContext { waitUntil(work: Promise<unknown>): void }

export function openHostedSocket(store: MatchStore, mode: MatchMode, id: string, ctx: WorkerContext) {
  const pair = new WebSocketPair(), socket = pair[1];
  let client: string = crypto.randomUUID(), hello: Record<string,unknown> | undefined, joined = false;
  let closed = false, after = -1, delay = 250, task: Promise<void> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const queued: unknown[] = [];
  async function flush() {
    if (!hello || closed) return;
    const batch = joined ? queued.splice(0,16) : [];
    const result = await exchange(store,mode,id,joined ? {op:"sync",client,after,commands:batch} : {op:"join",client,hello});
    if (closed) return;
    if (result.retry) { queued.unshift(...batch); return; }
    for (const event of result.events) {
      if (event.type === "joined") joined = true;
      if (event.type === "snapshot") {
        after = event.revision;
        delay = event.phase === "running" ? 45 : event.phase === "countdown" ? 120 : 250;
      }
      socket.send(JSON.stringify(event));
    }
    if (result.close !== undefined) socket.close(result.close,"Match connection ended.");
  }
  function pump() {
    if (closed || task) return;
    clearTimeout(timeout);
    task = flush().catch(() => socket.close(1011,"Room temporarily unavailable.")).finally(() => {
      task = undefined;
      if (!closed) timeout = setTimeout(pump,queued.length ? 0 : delay);
    });
  }
  socket.accept();
  timeout = setTimeout(() => socket.close(1008,"Join timed out."),10_000);
  socket.addEventListener("message",event => {
    if (typeof event.data !== "string" || event.data.length > 16_384 || queued.length >= 64) { socket.close(1008,"Invalid command."); return; }
    let message: unknown;
    try { message = JSON.parse(event.data); } catch { socket.close(1008,"Invalid command."); return; }
    if (!hello) {
      if (!record(message) || message.type !== "join") { socket.close(1008,"Join first."); return; }
      hello = message;
      if (typeof message.client === "string" && /^[a-f0-9-]{36}$/.test(message.client)) client = message.client;
    } else queued.push(message);
    pump();
  });
  socket.addEventListener("close",event => {
    closed = true; clearTimeout(timeout);
    if (hello) ctx.waitUntil(Promise.resolve(task).then(() => exchange(store,mode,id,{op:event.code===CLOSE.leave?"leave":"disconnect",client})));
  });
  return new Response(null,{status:101,webSocket:pair[0]} as ResponseInit);
}
