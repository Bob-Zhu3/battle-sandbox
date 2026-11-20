import { CLOSE, ROOM_SOCKET, type ClientMessage, type PlacementMessage, type RoomAction, type ServerMessage, type Snapshot } from "./room-protocol.ts";
import type { Team } from "./simulation.ts";

export type ConnectionState = "joining" | "online" | "reconnecting" | "full" | "expired" | "replaced";
interface Callbacks {
  state(value: ConnectionState): void;
  joined(team: Team): void;
  snapshot(value: Snapshot): void;
  error(message: string): void;
}

interface TabSession { resumeToken?: string; team?: Team; round: number; nextId: number; pending: PlacementMessage[] }
const storageKey = "battle-room.session.v1";
function emptySession(): TabSession { return { round: 0, nextId: 1, pending: [] }; }
function stored(team?: Team): TabSession {
  try {
    const raw = team ? localStorage.getItem(storageKey + "." + team) : sessionStorage.getItem(storageKey);
    const item = JSON.parse(raw ?? "null") as TabSession | null;
    if (item && typeof item.resumeToken === "string" && Number.isSafeInteger(item.round) &&
        Number.isSafeInteger(item.nextId) && item.nextId > 0 && Array.isArray(item.pending)) return item;
  } catch { /* The tab can still reconnect from memory when storage is unavailable. */ }
  return emptySession();
}

export function connectRoom(callbacks: Callbacks) {
  let session = stored();
  let socket: WebSocket;
  let online = false;
  let stopped = false;
  let seq = 0;
  let backoff = 350;
  let retryTimer: number | undefined;
  const url = new URL(ROOM_SOCKET, location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";

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
    if (release && session.team && stored(session.team).resumeToken === session.resumeToken) {
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

  function connect() {
    socket = new WebSocket(url);
    seq = 0;
    socket.addEventListener("open", () => {
      if (stopped) return;
      if (session.resumeToken) transmit({ type: "join", resumeToken: session.resumeToken });
      else {
        const remembered = [stored("red"), stored("blue")].flatMap(seat => seat.resumeToken ? [seat.resumeToken] : []);
        transmit({ type: "join", remembered });
      }
    });
    socket.addEventListener("message", ({ data }) => {
      if (stopped) return;
      const event = JSON.parse(data) as ServerMessage;
      switch (event.type) {
        case "joined": {
          if (session.resumeToken !== event.resumeToken) session = emptySession();
          const previous = stored(event.team);
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
    socket.addEventListener("close", ({ code }) => {
      online = false;
      if (stopped) return;
      if (code === CLOSE.full) { callbacks.state("full"); return; }
      if (code === CLOSE.expired || code === CLOSE.replaced) {
        clearSession(code === CLOSE.expired);
        callbacks.state(code === CLOSE.expired ? "expired" : "replaced");
        return;
      }
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
    if (leave) {
      clearSession(true);
      socket.close(CLOSE.leave, "Left room");
    } else socket.close();
  }
  connect();
  return { send, close };
}
