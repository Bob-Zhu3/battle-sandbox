import { battleOutcome, stepBattle, TICKS_PER_SECOND, WARRIOR } from "./simulation.ts";
import { battleFromDeployment, type ArenaPoint, type PlacementCommand } from "./deployment.ts";
import { attachDeploymentBrush } from "./brush-input.ts";
import { drawArena } from "./renderer.ts";

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing interface element: ${id}`);
  return found as T;
}

const canvas = element<HTMLCanvasElement>("arena");
const context = canvas.getContext("2d");
if (!context) throw new Error("This browser could not open a 2D canvas.");
const ctx = context;
const play = element<HTMLButtonElement>("play");
const replay = element<HTMLButtonElement>("replay");
const edit = element<HTMLButtonElement>("edit");
const undo = element<HTMLButtonElement>("undo");
const clear = element<HTMLButtonElement>("clear");
const hint = element("deploy-hint");
const rules = element("rules");
const playLabel = element("play-label");
const playIcon = element("play-icon");
const stateLabel = element("match-state");
const tickLabel = element("tick");
const result = element("result");
const resultTitle = element("result-title");
const resultDetail = element("result-detail");
const health = {
  red: { value: element("red-hp"), max: element("red-max"), count: element("red-count"), bar: element("red-bar") },
  blue: { value: element("blue-hp"), max: element("blue-max"), count: element("blue-count"), bar: element("blue-bar") },
};

const millisecondsPerTick = 1000 / TICKS_PER_SECOND;
const labels = {
  deploy: { status: "Deployment", button: "Start" },
  running: { status: "Live", button: "Pause" },
  paused: { status: "Paused", button: "Resume" },
  finished: { status: "Finished", button: "Replay" },
};
type Playback = keyof typeof labels;

const formation: PlacementCommand[] = [];
let draft: readonly ArenaPoint[] = [];
let mode: Playback = "deploy";
let battle = battleFromDeployment(formation);
let previous = battle;
let remainder = 0;
let lastTime = 0;
let frameId = 0;

function updateScore() {
  tickLabel.textContent = String(battle.tick).padStart(3, "0");
  const totals = { red: { units: 0, alive: 0, hp: 0 }, blue: { units: 0, alive: 0, hp: 0 } };
  for (const unit of battle.warriors) {
    const team = totals[unit.team];
    team.units++;
    if (unit.hp > 0) team.alive++;
    team.hp += unit.hp;
  }
  for (const side of ["red", "blue"] as const) {
    const { units, alive, hp } = totals[side];
    const maxHp = units * WARRIOR.maxHp;
    const display = health[side];
    display.count.textContent = mode === "deploy" ? `${units} Warrior${units === 1 ? "" : "s"}` : `${alive} / ${units} alive`;
    display.value.textContent = String(hp);
    display.max.textContent = String(maxHp);
    display.bar.style.transform = `scaleX(${maxHp ? hp / maxHp : 0})`;
  }
  if (mode === "deploy") {
    play.disabled = !totals.red.units || !totals.blue.units;
    undo.disabled = clear.disabled = formation.length === 0;
    if (totals.red.units && !totals.blue.units) hint.textContent = "Place a blue Warrior on the right to start.";
    else if (totals.blue.units && !totals.red.units) hint.textContent = "Place a red Warrior on the left to start.";
    else hint.textContent = "Click to place one Warrior. Drag to place a line.";
  }
}

function setMode(next: Playback) {
  mode = next;
  stateLabel.textContent = labels[mode].status;
  stateLabel.dataset.mode = mode;
  playLabel.textContent = labels[mode].button;
  playIcon.classList.toggle("pause", mode === "running");
  const deploying = mode === "deploy";
  canvas.dataset.deploying = String(deploying);
  play.disabled = false;
  undo.hidden = clear.hidden = !deploying;
  edit.hidden = deploying;
  replay.hidden = mode !== "running" && mode !== "paused";
  hint.hidden = !deploying;
  rules.hidden = deploying;
  result.hidden = mode !== "finished";
}

function paint(blend = 1) {
  drawArena(ctx, previous, battle, blend, mode === "deploy", draft);
}

function resizeArena() {
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
  paint(mode === "running" ? remainder / millisecondsPerTick : 1);
}

function frame(time: number) {
  remainder += Math.max(0, time - lastTime);
  lastTime = time;
  const startTick = battle.tick;
  while (remainder >= millisecondsPerTick) {
    remainder -= millisecondsPerTick;
    previous = battle;
    battle = stepBattle(battle);
    const outcome = battleOutcome(battle);
    if (outcome !== null) {
      const isDraw = outcome === "draw";
      resultTitle.textContent = isDraw ? "Draw" : `${outcome === "red" ? "Red" : "Blue"} wins`;
      resultDetail.textContent = isDraw ? `Both teams fell on tick ${battle.tick}.` : `Battle ended on tick ${battle.tick}.`;
      setMode("finished");
      break;
    }
  }
  if (battle.tick !== startTick) updateScore();
  paint(mode === "running" ? remainder / millisecondsPerTick : 1);
  if (mode === "running") frameId = requestAnimationFrame(frame);
}

function loadFormation(next: "deploy" | "running") {
  cancelAnimationFrame(frameId);
  cancelStroke();
  battle = battleFromDeployment(formation);
  previous = battle;
  remainder = 0;
  setMode(next);
  updateScore();
  paint();
  if (next === "running") startClock();
}

function startClock() {
  previous = battle;
  remainder = 0;
  lastTime = performance.now();
  frameId = requestAnimationFrame(frame);
}

function pauseBattle() {
  cancelAnimationFrame(frameId);
  setMode("paused");
  paint();
}

const cancelStroke = attachDeploymentBrush(canvas, {
  canDraw: () => mode === "deploy",
  preview(points) {
    draft = points;
    paint();
  },
  commit(command) {
    formation.push(command);
    loadFormation("deploy");
  },
});

play.addEventListener("click", () => {
  if (mode === "running") {
    pauseBattle();
  } else if (mode === "paused") {
    setMode("running");
    startClock();
  } else {
    loadFormation("running");
  }
});
replay.addEventListener("click", () => loadFormation("running"));
edit.addEventListener("click", () => loadFormation("deploy"));
undo.addEventListener("click", () => {
  formation.pop();
  loadFormation("deploy");
});
clear.addEventListener("click", () => {
  formation.length = 0;
  loadFormation("deploy");
});
window.addEventListener("blur", cancelStroke);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelStroke();
    if (mode === "running") pauseBattle();
  }
});

element("tick-rate").textContent = String(TICKS_PER_SECOND);
element("damage").textContent = String(WARRIOR.damage);
element("cooldown").textContent = String(WARRIOR.cooldownTicks);
setMode("deploy");
updateScore();
resizeArena();
new ResizeObserver(resizeArena).observe(canvas);
