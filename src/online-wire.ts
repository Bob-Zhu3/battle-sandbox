import { CLOSE, type ClientMessage, type OnlineExchange } from "./room-protocol.ts";

// Some front doors accept HTTPS but do not forward a WebSocket upgrade. Keep the same
// server-owned room, receipt IDs and reconnect tokens on either transport.
export class OnlineWire extends EventTarget {
  readonly client: string;
  readyState: number = WebSocket.CONNECTING;
  private readonly url: URL;
  private queue: ClientMessage[] = [];
  private hello?: ClientMessage;
  private joined = false;
  private busy = false;
  private timer = 0;
  private after = -1;
  private interval = 350;
  private failures = 0;

  constructor(url: URL, client: string) {
    super();
    this.url = url;
    this.client = client;
    queueMicrotask(() => {
      if (this.readyState !== WebSocket.CONNECTING) return;
      this.readyState = WebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    });
  }

  send(data: string) {
    const message = JSON.parse(data) as ClientMessage;
    if ("type" in message && message.type === "join") this.hello = message;
    else this.queue.push(message);
    this.schedule(0);
  }

  private schedule(ms: number) {
    if (this.busy || this.readyState !== WebSocket.OPEN) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { void this.poll(); },ms);
  }

  private async poll() {
    if (this.busy || !this.hello || this.readyState !== WebSocket.OPEN) return;
    this.busy = true;
    const commands = this.joined ? this.queue.slice(0,16) : [];
    const body = this.joined ? {op:"sync",client:this.client,after:this.after,commands} : {op:"join",client:this.client,hello:this.hello};
    let next = this.interval;
    try {
      const res = await fetch(this.url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(7500)});
      if (!res.ok) throw Error("Match connection unavailable.");
      const result: OnlineExchange = await res.json();
      if (this.readyState !== WebSocket.OPEN) return;
      this.failures = 0;
      if (result.retry) { next = 30; return; }
      this.queue.splice(0,commands.length);
      for (const event of result.events) {
        if (event.type === "joined") this.joined = true;
        if (event.type === "snapshot") {
          this.after = event.revision;
          this.interval = event.phase === "running" ? 55 : event.phase === "countdown" ? 140 : 350;
        }
        this.dispatchEvent(new MessageEvent("message",{data:JSON.stringify(event)}));
      }
      if (result.close !== undefined) { this.finish(result.close); return; }
      next = this.queue.length ? 0 : this.interval;
    } catch {
      this.failures++;
      // A first join may already have been accepted. Retry its same connection ID.
      if (this.joined) { this.finish(1006); return; }
      next = Math.min(3000,250*2**Math.min(4,this.failures));
    } finally { this.busy = false; this.schedule(next); }
  }

  private finish(code: number) {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    window.clearTimeout(this.timer);
    this.dispatchEvent(new CloseEvent("close",{code}));
  }

  close(code=1000) {
    if (this.readyState === WebSocket.CLOSED) return;
    const data = JSON.stringify({op:code === CLOSE.leave ? "leave" : "disconnect",client:this.client});
    void fetch(this.url,{method:"POST",headers:{"Content-Type":"application/json"},body:data,keepalive:true}).catch(() => {});
    this.finish(code);
  }
}
