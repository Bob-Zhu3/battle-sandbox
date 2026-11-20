import { attachDeploymentBrush, attachSpellBrush } from "./brush-input.ts";
import { ARMIES, BASE_HP, GOLD_PER_SECOND, MATCHES, campFor, inCamp, type MatchMode, type Team } from "./battlefield.ts";
import type { ArenaPoint } from "./deployment.ts";
import { createField, element } from "./field.ts";
import { drawArena } from "./renderer.ts";
import { SPELLS } from "./spells.ts";
import { connectRoom, type ConnectionState } from "./room-connection.ts";
import type { RoomAction, Snapshot, World } from "./room-protocol.ts";
import { bountyFor } from "./transformations.ts";
import { UNIT_DEFINITIONS, placementKind, type RecruitKind } from "./units.ts";

const mode: MatchMode = location.pathname.replace(/\/$/, "") === "/ffa" ? "ffa" : "duel";
const match = MATCHES[mode];
const field = createField(mode);
const game = document.querySelector<HTMLElement>(".game")!;
const guide = element("empty-guide");
const heading = guide.querySelector("h2")!;
const instructions = guide.querySelector("p")!;
const hint = element("deploy-hint");
const play = element<HTMLButtonElement>("play"), undo = element<HTMLButtonElement>("undo"), clear = element<HTMLButtonElement>("clear");
const state = element("match-state"), scenario = element("scenario-name"), result = element("result");
const empty: World = { tick: 0, units: [], arrows: [] };
const showIds = new URLSearchParams(location.search).get("ids") === "1";
let latest: Snapshot | undefined, team: Team | undefined;
let link: ConnectionState = "joining", notice = "";
let bounty: { tick: number; amount: number } | undefined;
let draft: readonly ArenaPoint[] = [], draftKind: RecruitKind = "warrior";

document.title = match.name + " · Battle Sandbox";
game.dataset.room = ""; game.dataset.mode = mode;
element("demo-picker").hidden = element("team-tools").hidden = true;
element("room-leave").hidden = scenario.hidden = false;

function canDraw() {
  if (link !== "online" || !team || !latest) return false;
  return latest.phase === "deploy" ? !latest.seats[team]?.ready
    : latest.phase === "running" && !!latest.world.bases?.some(base => base.team === team && base.hp > 0);
}
function paint() {
  const world = latest?.world ?? empty;
  drawArena(field.ctx, world, world, 1, !latest || latest.phase === "deploy", draft, draft.length ? draftKind : field.selectedKind(), { mode, ownTeam: team, showIds });
}
function problem(points: readonly ArenaPoint[], kind: RecruitKind) {
  if (!team || !latest) return "Joining the match…";
  if (kind !== "miner" && !points.every(point => inCamp(mode, team!, point.x, point.y))) return "Keep the whole stroke in your " + campFor(mode, team).label + ".";
  const price = points.length * UNIT_DEFINITIONS[kind].cost, balance = latest.gold[team] ?? 0;
  return price > balance ? "This stroke costs " + price + " gold. You have " + balance + "." : "";
}

function updateInterface() {
  const snap = latest;
  const closed = link === "full" || link === "expired" || link === "replaced";
  const reconnecting = link === "reconnecting", deploy = snap?.phase === "deploy", edit = canDraw();
  const live = snap?.phase === "running", countdown = snap?.phase === "countdown";
  const ready = !!(team && snap?.seats[team]?.ready);
  const ownCount = snap?.world.units.filter(unit => unit.team === team).length ?? 0;
  const name = team ? ARMIES[team].name : "";
  const camp = team ? campFor(mode, team).label : "";
  const roster = match.teams.filter(side => snap?.seats[side]?.connected || snap?.seats[side]?.reserved);
  field.canvas.dataset.deploying = String(edit);
  const spell = live && edit ? field.selectedSpell() : undefined;
  const miner = edit && field.selectedKind() === "miner" && !spell;
  const castingHint = spell ? "Tap anywhere to cast " + SPELLS[spell].name + "." : miner ? "Choose a tunnel exit anywhere on the field." : "";
  field.canvas.setAttribute("aria-label", castingHint || (edit ? name + " army. Draw squads in the " + camp + "." : "Shared battlefield."));
  scenario.textContent = team ? name + " · " + match.name : match.name;
  for (const color of match.teams) {
    const seat = snap?.seats[color], tag = element(color + "-seat");
    const offline = seat?.reserved || (reconnecting && color === team);
    const base = snap?.world.bases?.find(b => b.team === color);
    tag.hidden = closed || (!deploy && !offline && !base);
    tag.textContent = offline ? "Reconnecting" : !deploy && base ? (base.hp ? "Base " + base.hp + "/" + BASE_HP : "Base fallen") : seat?.ready ? "Ready" : seat?.connected ? "Drawing" : "Open seat";
  }
  field.setGold(team ? snap?.gold[team] : undefined);
  const rate = element("gold-rate");
  rate.hidden = !live || !edit;
  rate.textContent = bounty && snap && snap.world.tick - bounty.tick < 75 ? "+" + bounty.amount + " bounty" : "+" + GOLD_PER_SECOND + "/s";
  field.setCasting(!!live && edit);
  if (!edit) field.closeRoster();
  element("brush-tool").hidden = !edit;
  undo.hidden = clear.hidden = !edit || !deploy;
  undo.disabled = clear.disabled = !ownCount;
  undo.title = "Refund your last squad"; clear.title = "Refund your whole formation";
  play.hidden = !closed && (reconnecting || live || countdown || !snap);
  play.disabled = !closed && (link !== "online" || (!!deploy && (!edit || !ownCount)));
  element("play-label").textContent = closed ? "Join again" : snap?.phase === "finished" ? "New round" : ready ? "Ready ✓" : "Ready";
  state.textContent = closed ? "Disconnected" : reconnecting ? "Reconnecting" : !snap ? "Joining" : deploy ? "Deployment" : countdown ? "Starting" : live ? (edit ? "Live" : "Eliminated") : "Finished";
  element("countdown").hidden = !countdown;
  element("countdown-number").textContent = String(snap?.countdown ?? 3);
  guide.hidden = !closed && !!snap && (!deploy || !!(snap.world.units.length || draft.length));
  heading.textContent = closed ? (link === "full" ? "Match unavailable" : link === "expired" ? "Seat expired" : "Seat open in another tab") : !snap ? "Joining match" : "Deploy in the " + camp;
  instructions.textContent = closed ? notice || "Join again for an open seat." : !snap ? "Connecting to the field…" : "Draw your army, then press Ready. Keep your base standing.";
  let status = "";
  if (deploy && snap) {
    const missing = Math.max(0, match.minimum - roster.length);
    if (roster.some(side => snap.seats[side]?.reserved)) status = "Waiting for a player to reconnect.";
    else if (missing) status = "Waiting for " + missing + " more player" + (missing === 1 ? "" : "s") + " to join.";
    else if (ready) status = "Formation locked. Waiting for everyone to be ready.";
    else if (ownCount) status = "Press Ready when your army is set.";
  }
  if (live && !reconnecting) status = !edit ? "Your base fell. The remaining armies are still fighting." : castingHint || "Recruit in your " + camp + ". Take down the enemy " + (mode === "duel" ? "base." : "bases.");
  hint.textContent = closed ? "" : reconnecting ? "Reconnecting to your seat…" : notice || (miner ? castingHint : status);
  hint.hidden = !hint.textContent;
  result.hidden = closed || snap?.phase !== "finished";
  if (!result.hidden && snap?.outcome) {
    element("result-title").textContent = snap.outcome === "draw" ? "Draw" : ARMIES[snap.outcome].name + " wins";
    element("result-detail").textContent = "Battle ended on tick " + snap.world.tick + ".";
  }
}

game.addEventListener("brushchange", () => { notice = ""; updateInterface(); paint(); });

function send(action: RoomAction) { notice = ""; connection.send(action); }
attachSpellBrush(field.canvas, field.selectedSpell, (spell, point) => {
  if (canDraw() && latest?.phase === "running") send({type: SPELLS[spell].command, positions: [point]});
});
const cancelStroke = attachDeploymentBrush(field.canvas, {
  canDraw: () => canDraw() && !field.selectedSpell(), selectedKind: field.selectedKind, useLive: () => latest?.phase === "running",
  livePlace(points, kind) {
    if (!team || !latest) return;
    const cost = UNIT_DEFINITIONS[kind].cost;
    let remaining = latest.gold[team] ?? 0;
    for (const point of points) {
      const issue = problem([point], kind);
      if (issue || remaining < cost) { notice = issue || "Waiting for more gold."; updateInterface(); break; }
      send({ type: UNIT_DEFINITIONS[kind].command, positions: [point] });
      remaining -= cost;
    }
  },
  preview(points, kind) {
    draftKind = kind;
    const issue = points.length ? problem(points, kind) : "";
    draft = issue ? [] : points;
    notice = issue || (points.length ? points.length + " × " + UNIT_DEFINITIONS[kind].name + " · " + (points.length * UNIT_DEFINITIONS[kind].cost) + " gold" : "");
    updateInterface(); paint();
  },
  commit(command) {
    const issue = problem(command.positions, placementKind(command.type));
    if (issue) { notice = issue; updateInterface(); }
    else send(command);
  },
});

const connection = connectRoom(mode, {
  state(value) { link = value; if (value !== "online") cancelStroke(); updateInterface(); },
  joined(side) {
    team = side; game.dataset.team = side; game.style.setProperty("--army", ARMIES[side].coat);
    document.title = ARMIES[side].name + " · " + match.name + " · Battle Sandbox";
    field.colorBrush(side); notice = ""; updateInterface();
  },
  error(message) { notice = message; updateInterface(); },
  snapshot(event) {
    const previous = latest;
    latest = event;
    if (!canDraw() || (previous && previous.round !== event.round)) cancelStroke();
    if (previous?.round !== event.round || previous.phase !== event.phase) { notice = ""; bounty = undefined; }
    if (team && previous?.phase === "running" && event.world.tick > previous.world.tick) {
      const earned = event.world.units.reduce((sum, u) => sum + (u.killedBy === team && u.lastHitTick !== null && u.lastHitTick > previous.world.tick ? bountyFor(u) : 0), 0);
      if (earned) bounty = { tick: event.world.tick, amount: earned };
    }
    const visible = match.teams.filter(side => event.phase === "deploy" || event.world.bases?.some(b => b.team === side));
    field.updateScore(event.world, visible);
    paint(); updateInterface();
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
element("room-leave").addEventListener("click", e => {
  if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) connection.close(true);
});
window.addEventListener("pagehide", () => connection.close());
window.addEventListener("pageshow", e => { if (e.persisted) location.reload(); });
updateInterface(); field.watchSize(paint);
