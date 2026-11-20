import { battleOutcome, stepBattle, TICKS_PER_SECOND, WARRIOR } from "./simulation.ts";
import { battleFromDeployment, twentyVsTwenty, type ArenaPoint, type PlacementCommand } from "./deployment.ts";
import { attachDeploymentBrush } from "./brush-input.ts";
import { drawLandscape } from "./landscape.ts";
import { drawArena, drawWarriorToken } from "./renderer.ts";

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error("Missing interface element: " + id);
  return found as T;
}

function contextFor(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not open a 2D canvas.");
  return context;
}

const canvas = element<HTMLCanvasElement>("arena");
const landscape = element<HTMLCanvasElement>("landscape");
const ctx = contextFor(canvas);
const ground = contextFor(landscape);
const play = element<HTMLButtonElement>("play");
const replay = element<HTMLButtonElement>("replay");
const edit = element<HTMLButtonElement>("edit");
const undo = element<HTMLButtonElement>("undo");
const clear = element<HTMLButtonElement>("clear");
const demo = element<HTMLButtonElement>("demo");
const demoLabel = element("demo-label");
const hint = element("deploy-hint");
const emptyGuide = element("empty-guide");
const brushTool = element("brush-tool");
const keyAction = element("key-action");
const playLabel = element("play-label");
const playIcon = element("play-icon");
const stateLabel = element("match-state");
const tickLabel = element("tick");
const result = element("result");
const resultTitle = element("result-title");
const resultDetail = element("result-detail");
const health = {
  red: { score: element("red-score"), hp: element("red-hp"), max: element("red-max"), count: element("red-count"), bar: element("red-bar") },
  blue: { score: element("blue-score"), hp: element("blue-hp"), max: element("blue-max"), count: element("blue-count"), bar: element("blue-bar") },
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
const demoFormation = twentyVsTwenty();
let watchingDemo = false;
let draft: readonly ArenaPoint[] = [];
let mode: Playback = "deploy";
let battle = battleFromDeployment(formation);
let previous = battle;
let remainder = 0;
let lastTime = 0;
let frameId = 0;

function updateGuide() {
  emptyGuide.hidden = mode !== "deploy" || battle.warriors.length > 0 || draft.length > 0;
}

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
    const max = units * WARRIOR.maxHp;
    const display = health[side];
    if (display.count.textContent !== String(alive)) display.count.textContent = String(alive);
    if (display.max.textContent !== String(max)) display.max.textContent = String(max);
    if (display.hp.textContent !== String(hp)) display.hp.textContent = String(hp);
    display.score.title = alive + " of " + units + " " + side + " Warriors alive · " + hp + "/" + max + " HP";
    display.bar.style.transform = "scaleX(" + (max ? hp / max : 0) + ")";
  }
  if (mode === "deploy") {
    const red = totals.red.units, blue = totals.blue.units;
    play.disabled = !red || !blue;
    undo.disabled = clear.disabled = !formation.length;
    hint.hidden = Boolean(red) === Boolean(blue);
    hint.textContent = red ? "Place a blue Warrior on the right to start." : "Place a red Warrior on the left to start.";
  }
  updateGuide();
}

function setMode(next: Playback) {
  mode = next;
  stateLabel.textContent = labels[mode].status;
  playLabel.textContent = keyAction.textContent = labels[mode].button;
  playIcon.classList.toggle("pause", mode === "running");
  const deploying = mode === "deploy";
  canvas.dataset.deploying = String(deploying);
  canvas.setAttribute("aria-label", deploying
    ? "Battlefield. Draw red Warriors on the left and blue Warriors on the right."
    : "Battlefield. The pennants show how many Warriors remain on each side.");
  play.disabled = false;
  undo.hidden = clear.hidden = brushTool.hidden = !deploying;
  edit.hidden = deploying || watchingDemo;
  replay.hidden = mode !== "running" && mode !== "paused";
  demo.hidden = !deploying && !watchingDemo;
  demoLabel.textContent = watchingDemo ? "Back to field" : "20 vs 20 demo";
  if (!deploying) hint.hidden = true;
  result.hidden = mode !== "finished";
  updateGuide();
}

function paint(blend = 1) {
  drawArena(ctx, previous, battle, blend, mode === "deploy", draft);
}

function resizeArena() {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  for (const layer of [landscape, canvas]) {
    layer.width = width;
    layer.height = height;
  }
  drawLandscape(ground);
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
      resultTitle.textContent = isDraw ? "Draw" : (outcome === "red" ? "Red wins" : "Blue wins");
      resultDetail.textContent = (isDraw ? "Both armies fell on tick " : "Battle ended on tick ") + battle.tick + ".";
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
  battle = battleFromDeployment(watchingDemo ? demoFormation : formation);
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
    updateGuide();
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
demo.addEventListener("click", () => {
  watchingDemo = !watchingDemo;
  loadFormation(watchingDemo ? "running" : "deploy");
  canvas.focus({ preventScroll: true });
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
document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof HTMLButtonElement && event.target !== play) return;
  event.preventDefault();
  if (!play.disabled) play.click();
});
window.addEventListener("blur", cancelStroke);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelStroke();
    if (mode === "running") pauseBattle();
  }
});

drawWarriorToken(contextFor(element<HTMLCanvasElement>("brush-icon")), 36, 36, 31, "red");
brushTool.title = "Warrior · " + WARRIOR.maxHp + " HP · " + WARRIOR.damage + " damage per hit";
watchingDemo = new URLSearchParams(location.search).get("demo") === "20v20";
resizeArena();
loadFormation(watchingDemo ? "running" : "deploy");
new ResizeObserver(resizeArena).observe(canvas);
