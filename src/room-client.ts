import { attachDeploymentBrush } from "./brush-input.ts";
import { teamAt, type ArenaPoint } from "./deployment.ts";
import { createField, element, updateFieldScore } from "./field.ts";
import { drawArena } from "./renderer.ts";
import { connectRoom, type ConnectionState } from "./room-connection.ts";
import type { RoomAction, Snapshot, World } from "./room-protocol.ts";
import type { Team } from "./simulation.ts";
import type { UnitKind } from "./units.ts";

const field = createField();
const game = document.querySelector<HTMLElement>(".game")!;
const guide = element("empty-guide");
const heading = guide.querySelector("h2")!;
const instructions = guide.querySelector("p")!;
const hint = element("deploy-hint");
const play = element<HTMLButtonElement>("play");
const undo = element<HTMLButtonElement>("undo");
const clear = element<HTMLButtonElement>("clear");
const state = element("match-state");
const scenario = element("scenario-name");
const result = element("result");
const seatLabels = { red: element("red-seat"), blue: element("blue-seat") };
const empty: World = { tick: 0, units: [], arrows: [] };
const showIds = new URLSearchParams(location.search).get("ids") === "1";
let latest: Snapshot | undefined;
let team: Team | undefined;
let link: ConnectionState = "joining";
let notice = "";
let draft: readonly ArenaPoint[] = [];
let draftKind: UnitKind = "warrior";

document.title = "Two-player room · Battle Sandbox";
game.dataset.room = "";
element("demo-picker").hidden = true;
element("room-leave").hidden = false;
element("key-action").parentElement!.hidden = true;
scenario.hidden = false;

function canDraw() {
  return link === "online" && team !== undefined && latest?.phase === "deploy" && !latest.seats[team].ready;
}

function paint() {
  const world = latest?.world ?? empty;
  drawArena(field.ctx, world, world, 1, !latest || latest.phase === "deploy", draft, draftKind, { ownTeam: team, showIds });
}

function showHint(message: string) {
  hint.textContent = message;
  hint.hidden = !message;
}

function updateInterface() {
  const snapshot = latest;
  const closed = link === "full" || link === "expired" || link === "replaced";
  const reconnecting = link === "reconnecting";
  const deploy = snapshot?.phase === "deploy";
  const edit = canDraw();
  const ownReady = Boolean(team && snapshot?.seats[team].ready);
  const ownCount = snapshot?.world.units.filter(unit => unit.team === team).length ?? 0;
  const side = team === "blue" ? "right" : "left";
  const name = team === "blue" ? "Blue" : "Red";
  const other = team === "red" ? "blue" : "red";
  field.canvas.dataset.deploying = String(edit);
  field.canvas.setAttribute("aria-label", edit ? "Your " + name + " field. Draw on the " + side + " half." : "Shared battlefield.");
  scenario.textContent = team ? "You are " + name : "Two-player room";
  if (team) game.dataset.team = team;
  for (const color of ["red", "blue"] as const) {
    const seat = snapshot?.seats[color];
    seatLabels[color].hidden = closed || !deploy;
    const offline = seat?.reserved || (reconnecting && color === team);
    seatLabels[color].textContent = offline ? "Reconnecting" : seat?.ready ? "Ready" : seat?.connected ? "Drawing" : "Open seat";
  }
  element("brush-tool").hidden = undo.hidden = clear.hidden = !edit;
  undo.disabled = clear.disabled = !ownCount;
  undo.title = "Undo your last stroke";
  clear.title = "Clear your own formation";
  play.hidden = !closed && (reconnecting || snapshot?.phase === "running" || !snapshot);
  play.disabled = !closed && (link !== "online" || (deploy && (!edit || !ownCount)));
  const action = closed ? "Join again" : snapshot?.phase === "finished" ? "New round" : ownReady ? "Ready ✓" : "Ready";
  element("play-label").textContent = action;
  state.textContent = closed ? "Disconnected" : reconnecting ? "Reconnecting" : !snapshot ? "Connecting" : deploy ? "Deployment" : snapshot.phase === "running" ? "Live" : "Finished";

  guide.hidden = !closed && !!snapshot && (!deploy || snapshot.world.units.length > 0 || draft.length > 0);
  heading.textContent = link === "full" ? "Room full" : link === "expired" ? "Seat expired" : link === "replaced" ? "Seat open in another tab" : !snapshot ? "Joining room" : "Deploy on the " + side;
  instructions.textContent = closed ? (link === "full" ? "Both seats are taken." : "Join again to take an open seat.") : !snapshot ? "Connecting to the field…" : "Choose a brush and draw your " + name.toLowerCase() + " squads.";
  let status = "";
  if (!closed && deploy && snapshot) {
    if (snapshot.seats[other].reserved) status = "Your opponent is reconnecting.";
    else if (!snapshot.seats[other].connected) status = "Waiting for " + (other === "red" ? "Red" : "Blue") + " to join.";
    else if (ownReady) status = "Formation locked. Waiting for the other player.";
    else if (snapshot.seats[other].ready) status = "Your opponent is ready.";
    else if (ownCount) status = "Press Ready when your formation is set.";
  }
  showHint(closed ? "" : reconnecting ? "Reconnecting to your seat…" : notice || status);
  result.hidden = closed || snapshot?.phase !== "finished";
  if (!result.hidden && snapshot) {
    element("result-title").textContent = snapshot.outcome === "draw" ? "Draw" : snapshot.outcome === "red" ? "Red wins" : "Blue wins";
    element("result-detail").textContent = "Battle ended on tick " + snapshot.world.tick + ".";
  }
}

function send(action: RoomAction) {
  notice = "";
  connection.send(action);
}

function onOwnHalf(points: readonly ArenaPoint[]) {
  return points.every(point => teamAt(point.x) === team);
}
function halfHint() { return "Keep the whole stroke on your " + (team === "red" ? "left" : "right") + " half."; }

const cancelStroke = attachDeploymentBrush(field.canvas, {
  canDraw, selectedKind: field.selectedKind,
  preview(points, kind) {
    draftKind = kind;
    const valid = onOwnHalf(points);
    draft = valid ? points : [];
    if (points.length) notice = valid ? "" : halfHint();
    updateInterface();
    paint();
  },
  commit(command) {
    if (onOwnHalf(command.positions)) send(command);
    else { notice = halfHint(); updateInterface(); }
  },
});

const connection = connectRoom({
  state(value) {
    link = value;
    if (value !== "online") cancelStroke();
    updateInterface();
  },
  joined(side) {
    team = side;
    document.title = (team === "red" ? "Red" : "Blue") + " · Two-player room · Battle Sandbox";
    field.colorBrush(team);
    notice = "";
    updateInterface();
  },
  error(message) {
    notice = message;
    updateInterface();
  },
  snapshot(event) {
    const old = latest;
    latest = event;
    if (!canDraw() || (old && old.round !== event.round)) cancelStroke();
    if (team && old) {
      const other = team === "red" ? "blue" : "red";
      if (old.round !== event.round && !event.seats[other].connected && !event.seats[other].reserved) notice = "Your opponent left. Your formation is still here.";
      else if (old.round !== event.round || old.seats[other].connected !== event.seats[other].connected || event.phase !== "deploy") notice = "";
    }
    updateFieldScore(event.world);
    paint();
    updateInterface();
  },
});
play.addEventListener("click", () => {
  if (link !== "online") { location.reload(); return; }
  cancelStroke();
  if (latest?.phase === "finished") send({ type: "new-round" });
  else if (canDraw()) send({ type: "ready" });
});
undo.addEventListener("click", () => send({ type: "undo" }));
clear.addEventListener("click", () => send({ type: "clear" }));
window.addEventListener("blur", cancelStroke);
element("room-leave").addEventListener("click", (event) => {
  if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) connection.close(true);
});
window.addEventListener("pagehide", () => connection.close());
window.addEventListener("pageshow", (event) => { if (event.persisted) location.reload(); });
updateInterface();
field.watchSize(paint);
