import { battleOutcome, createDuel, stepBattle, TICKS_PER_SECOND, WARRIOR } from "./simulation.ts";
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
const reset = element<HTMLButtonElement>("reset");
const playLabel = element("play-label");
const playIcon = element("play-icon");
const stateLabel = element("match-state");
const tickLabel = element("tick");
const result = element("result");
const resultTitle = element("result-title");
const resultDetail = element("result-detail");
const health = {
  red: { value: element("red-hp"), bar: element("red-bar") },
  blue: { value: element("blue-hp"), bar: element("blue-bar") },
};

const millisecondsPerTick = 1000 / TICKS_PER_SECOND;
const labels = {
  ready: { status: "Ready", button: "Start duel" },
  running: { status: "Live", button: "Pause" },
  paused: { status: "Paused", button: "Resume" },
  finished: { status: "Finished", button: "Replay duel" },
};
type Playback = keyof typeof labels;

let mode: Playback = "ready";
let battle = createDuel();
let previous = battle;
let remainder = 0;
let lastTime = 0;
let frameId = 0;

function updateScore() {
  tickLabel.textContent = String(battle.tick).padStart(3, "0");
  for (const unit of battle.warriors) {
    const display = health[unit.team];
    display.value.textContent = String(unit.hp);
    display.bar.style.transform = `scaleX(${unit.hp / WARRIOR.maxHp})`;
  }
}

function setMode(next: Playback) {
  mode = next;
  stateLabel.textContent = labels[mode].status;
  stateLabel.dataset.mode = mode;
  playLabel.textContent = labels[mode].button;
  playIcon.classList.toggle("pause", mode === "running");
  reset.disabled = mode === "ready";
  result.hidden = mode !== "finished";
}

function resizeArena() {
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
  drawArena(ctx, previous, battle, mode === "running" ? remainder / millisecondsPerTick : 1);
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
      resultDetail.textContent = isDraw ? `Both Warriors fell on tick ${battle.tick}.` : `Duel ended on tick ${battle.tick}.`;
      setMode("finished");
      break;
    }
  }
  if (battle.tick !== startTick) updateScore();
  drawArena(ctx, previous, battle, mode === "running" ? remainder / millisecondsPerTick : 1);
  if (mode === "running") frameId = requestAnimationFrame(frame);
}

function resetDuel() {
  cancelAnimationFrame(frameId);
  battle = createDuel();
  previous = battle;
  remainder = 0;
  setMode("ready");
  updateScore();
  drawArena(ctx, previous, battle, 1);
}

function pauseDuel() {
  cancelAnimationFrame(frameId);
  setMode("paused");
  drawArena(ctx, previous, battle, 1);
}

play.addEventListener("click", () => {
  if (mode === "running") {
    pauseDuel();
    return;
  }
  if (mode === "finished") resetDuel();
  previous = battle;
  remainder = 0;
  lastTime = performance.now();
  setMode("running");
  frameId = requestAnimationFrame(frame);
});
reset.addEventListener("click", resetDuel);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode === "running") pauseDuel();
});

element("tick-rate").textContent = String(TICKS_PER_SECOND);
element("damage").textContent = String(WARRIOR.damage);
element("cooldown").textContent = String(WARRIOR.cooldownTicks);
setMode("ready");
updateScore();
resizeArena();
new ResizeObserver(resizeArena).observe(canvas);
