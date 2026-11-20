import { battleOutcome, createDuel, stepBattle, TICKS_PER_SECOND } from "./simulation.ts";
import { archerScreen, battleFromDeployment, overTheShoulder, twentyVsTwenty, type ArenaPoint, type PlacementCommand } from "./deployment.ts";
import { attachDeploymentBrush } from "./brush-input.ts";
import { drawArena } from "./renderer.ts";
import { createField, element, updateFieldScore } from "./field.ts";
import type { UnitKind } from "./units.ts";

const field = createField();
const { canvas, ctx } = field;
const play = element<HTMLButtonElement>("play");
const replay = element<HTMLButtonElement>("replay");
const edit = element<HTMLButtonElement>("edit");
const undo = element<HTMLButtonElement>("undo");
const clear = element<HTMLButtonElement>("clear");
const demoPicker = element<HTMLDetailsElement>("demo-picker");
const demoBack = element<HTMLButtonElement>("demo-back");
const scenarioName = element("scenario-name");
const hint = element("deploy-hint");
const emptyGuide = element("empty-guide");
const brushTool = element("brush-tool");
const keyAction = element("key-action");
const playLabel = element("play-label");
const playIcon = element("play-icon");
const stateLabel = element("match-state");
const result = element("result");
const resultTitle = element("result-title");
const resultDetail = element("result-detail");
const millisecondsPerTick = 1000 / TICKS_PER_SECOND;
const labels = {
  deploy: { status: "Deployment", button: "Start" },
  staged: { status: "Ready", button: "Start" },
  running: { status: "Live", button: "Pause" },
  paused: { status: "Paused", button: "Resume" },
  finished: { status: "Finished", button: "Replay" },
};
type Playback = keyof typeof labels;

const formation: PlacementCommand[] = [];
const demos = {
  shoulder: { name: "Over the shoulder", battle: () => battleFromDeployment(overTheShoulder()) },
  duel: { name: "Warrior duel", battle: createDuel },
  "20v20": { name: "20 vs 20 Warriors", battle: () => battleFromDeployment(twentyVsTwenty()) },
  archers: { name: "Archer screen", battle: () => battleFromDeployment(archerScreen()) },
};
type Demo = keyof typeof demos;
let activeDemo: Demo | null = null;
let draftKind: UnitKind = "warrior";
let draft: readonly ArenaPoint[] = [];
let mode: Playback = "deploy";
let battle = battleFromDeployment(formation);
let previous = battle;
let remainder = 0;
let lastTime = 0;
let frameId = 0;
let paintedBlend = 1;

function updateGuide() {
  emptyGuide.hidden = mode !== "deploy" || battle.units.length > 0 || draft.length > 0;
}

function updateScore() {
  const totals = updateFieldScore(battle);
  if (mode === "deploy") {
    const red = totals.red.units, blue = totals.blue.units;
    play.disabled = !red || !blue;
    undo.disabled = clear.disabled = !formation.length;
    hint.hidden = Boolean(red) === Boolean(blue);
    hint.textContent = red ? "Place a blue unit on the right to start." : "Place a red unit on the left to start.";
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
    ? "Battlefield. Draw red units on the left and blue units on the right."
    : "Battlefield. The pennants show how many units remain on each side.");
  play.disabled = false;
  undo.hidden = clear.hidden = brushTool.hidden = !deploying;
  edit.hidden = deploying || activeDemo !== null;
  replay.hidden = mode !== "running" && mode !== "paused";
  demoPicker.hidden = !deploying;
  demoBack.hidden = activeDemo === null;
  scenarioName.hidden = activeDemo === null;
  scenarioName.textContent = activeDemo ? demos[activeDemo].name : "";
  if (!deploying) hint.hidden = true;
  result.hidden = mode !== "finished";
  updateGuide();
}

function paint(blend = paintedBlend) {
  paintedBlend = blend;
  drawArena(ctx, previous, battle, blend, mode === "deploy", draft, draftKind);
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

function loadFormation(next: "deploy" | "staged" | "running") {
  cancelAnimationFrame(frameId);
  cancelStroke();
  battle = activeDemo ? demos[activeDemo].battle() : battleFromDeployment(formation);
  previous = battle;
  remainder = 0;
  paintedBlend = 1;
  setMode(next);
  updateScore();
  paint();
  if (next === "running") startClock();
}

function startClock() {
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
  selectedKind: field.selectedKind,
  preview(points, kind) {
    draft = points;
    draftKind = kind;
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
function openDemo(name: Demo | null) {
  activeDemo = name;
  demoPicker.open = false;
  loadFormation(name === "shoulder" ? "staged" : name ? "running" : "deploy");
  canvas.focus({ preventScroll: true });
}
element("demo-shoulder").addEventListener("click", () => openDemo("shoulder"));
element("demo-duel").addEventListener("click", () => openDemo("duel"));
element("demo-archers").addEventListener("click", () => openDemo("archers"));
element("demo-warriors").addEventListener("click", () => openDemo("20v20"));
demoBack.addEventListener("click", () => openDemo(null));
document.addEventListener("pointerdown", (event) => {
  if (demoPicker.open && event.target instanceof Node && !demoPicker.contains(event.target)) demoPicker.open = false;
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
  if (event.key === "Escape" && demoPicker.open) {
    demoPicker.open = false;
    demoPicker.querySelector("summary")?.focus();
    return;
  }
  if (event.code !== "Space" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof HTMLElement && event.target.closest("summary")) return;
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

const requestedDemo = new URLSearchParams(location.search).get("demo");
if (requestedDemo === "shoulder" || requestedDemo === "duel" || requestedDemo === "20v20" || requestedDemo === "archers") activeDemo = requestedDemo;
field.watchSize(() => paint());
loadFormation(activeDemo === "shoulder" ? "staged" : activeDemo ? "running" : "deploy");
