import { CLOSE, type ClientMessage, type PlacementMessage, type RoomAction, type ServerMessage, type Snapshot } from "./room-protocol.ts";
import { MATCHES, type MatchMode, type Team } from "./battlefield.ts";
import { isMatchId } from "./match-link.ts";
import { OnlineWire } from "./online-wire.ts";

export type ConnectionState = "joining" | "online" | "reconnecting" | "full" | "expired" | "replaced";
interface Callbacks {
  state(value: ConnectionState): void;
  joined(team: Team): void;
  snapshot(value: Snapshot): void;
  error(message: string): void;
}

interface TabSession { resumeToken?: string; team?: Team; round: number; nextId: number; pending: PlacementMessage[] }
function emptySession(): TabSession { return { round: 0, nextId: 1, pending: [] }; }
function stored(storageKey: string, team?: Team): TabSession {
  try {
    const raw = team ? localStorage.getItem(storageKey + "." + team) : sessionStorage.getItem(storageKey);
    const item = JSON.parse(raw ?? "null") as TabSession | null;
    if (item && typeof item.resumeToken === "string" && Number.isSafeInteger(item.round) &&
        Number.isSafeInteger(item.nextId) && item.nextId > 0 && Array.isArray(item.pending)) return item;
  } catch { /* The tab can still reconnect from memory when storage is unavailable. */ }
  return emptySession();
}

interface Wire extends EventTarget { readyState: number; send(data: string): void; close(code?: number, reason?: string): void }

export function connectRoom(mode: MatchMode, callbacks: Callbacks) {
  const id = new URL(location.href).searchParams.get("match");
  const storageKey = (mode === "duel" ? "battle-room.session.v1" : "battle-ffa.session.v1") + (id ? "." + id : "");
  let session = stored(storageKey);
  let socket: Wire;
  let online = false;
  let stopped = false;
  let seq = 0;
  let backoff = 350;
  let retryTimer: number | undefined;
  const url = new URL(MATCHES[mode].socket, location.href);
  if (id !== null) url.searchParams.set("match",id);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const hosted = !!document.querySelector('meta[name="battle-online"]');
  const api = new URL("/api/matches/"+mode+"/"+(id ?? "lobby"),location.origin);
  let useHttp = false;

  function save() {
    try {
      if (session.resumeToken) sessionStorage.setItem(storageKey, JSON.stringify(session));
      else sessionStorage.removeItem(storageKey);
    } catch { /* Keep the in-memory copy on this connection. */ }
    try {
      if (session.team && session.resumeToken) localStorage.setItem(storageKey + "." + session.team, JSON.stringify(session));
    } catch { /* A tab session also works without shared browser storage. */ }
  }
  function clearSession(release: boolean) {
    if (release && session.team && stored(storageKey, session.team).resumeToken === session.resumeToken) {
      try { localStorage.removeItem(storageKey + "." + session.team); } catch { /* Storage is optional. */ }
    }
    session = emptySession();
    save();
  }
  function forget(round: number | undefined, commandId: number | undefined) {
    if (session.round !== round || commandId === undefined) return;
    const index = session.pending.findIndex(entry => entry.commandId === commandId);
    if (index < 0) return;
    session.pending.splice(index, 1);
    save();
  }
  function transmit(message: ClientMessage) { socket.send(JSON.stringify(message)); }

  function connect(client = hosted ? crypto.randomUUID() : "") {
    const current = socket = useHttp ? new OnlineWire(api,client) : new WebSocket(url);
    let welcomed = false;
    const fallback = () => {
      if (stopped || current !== socket || welcomed || !hosted || useHttp) return;
      useHttp = true; connect(client); current.close();
    };
    const handshake = hosted && !useHttp ? window.setTimeout(fallback,2600) : undefined;
    seq = 0;
    socket.addEventListener("open", () => {
      if (stopped || current !== socket) return;
      const remembered = MATCHES[mode].teams.map(team => stored(storageKey, team)).flatMap(seat => seat.resumeToken ? [seat.resumeToken] : []);
      const seat = session.resumeToken ? {resumeToken:session.resumeToken} : {remembered};
      current.send(JSON.stringify({type:"join",...seat,...(hosted?{client}:{})}));
    });
    socket.addEventListener("message", (raw) => {
      if (stopped || current !== socket) return;
      const { data } = raw as MessageEvent<string>;
      const event = JSON.parse(data) as ServerMessage;
      switch (event.type) {
        case "joined": {
          welcomed = true; window.clearTimeout(handshake);
          if (session.resumeToken !== event.resumeToken) session = emptySession();
          const previous = stored(storageKey, event.team);
          if (previous.resumeToken === event.resumeToken &&
              (previous.round > session.round || (previous.round === session.round && previous.nextId >= session.nextId))) session = previous;
          session.resumeToken = event.resumeToken;
          session.team = event.team;
          save();
          callbacks.joined(event.team);
          break;
        }
        case "placement-ack":
          forget(event.round, event.commandId);
          break;
        case "error":
          forget(event.round, event.commandId);
          callbacks.error(event.message);
          break;
        case "snapshot":
          if (session.round !== event.round) {
            session = { ...session, round: event.round, nextId: 1, pending: [] };
            save();
          }
          if (!online) {
            online = true;
            backoff = 350;
            callbacks.state("online");
            // Only the first snapshot on this connection authorizes retries for this round.
            for (const entry of session.pending) transmit(entry);
          }
          callbacks.snapshot(event);
          break;
      }
    });
    socket.addEventListener("close", raw => {
      const {code} = raw as CloseEvent;
      window.clearTimeout(handshake);
      if (current !== socket) return;
      online = false;
      if (stopped) return;
      if (code === CLOSE.full) { callbacks.state("full"); return; }
      if (code === CLOSE.expired || code === CLOSE.replaced) {
        clearSession(code === CLOSE.expired);
        callbacks.state(code === CLOSE.expired ? "expired" : "replaced");
        return;
      }
      if (hosted && !useHttp && !welcomed) { fallback(); return; }
      callbacks.state("reconnecting");
      retryTimer = window.setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 3000);
    });
  }

  function send(action: RoomAction) {
    if (!online || stopped || socket.readyState !== WebSocket.OPEN) return;
    if ("positions" in action) {
      const entry = { round: session.round, commandId: session.nextId++, action };
      session.pending.push(entry);
      save();
      transmit(entry);
    } else transmit({ round: session.round, seq: ++seq, action });
  }

  function close(leave = false) {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(retryTimer);
    if (!socket) return;
    if (leave) {
      clearSession(true);
      socket.close(CLOSE.leave, "Left room");
    } else socket.close();
  }
  if (id !== null && !isMatchId(id)) queueMicrotask(() => { callbacks.state("full"); callbacks.error("This invite link is incomplete. Ask the host to copy it again."); });
  else connect();
  return { send, close };
}
