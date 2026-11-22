import { attachDeploymentBrush, attachSpellBrush } from "./brush-input.ts";
import { ARMIES, TEAMS, type Team } from "./battlefield.ts";
import { createField, element } from "./field.ts";
import { crowdFormation } from "./crowd-formation.ts";
import { reinforcements } from "./deployment.ts";
import { Playground } from "./playground.ts";
import { drawArena } from "./renderer.ts";
import { UNIT_DEFINITIONS, type RecruitKind } from "./units.ts";
import { castHint } from "./spells.ts";
import { TICKS_PER_SECOND } from "./simulation.ts";

const field = createField();
const play = new Playground();
const game = document.querySelector<HTMLElement>(".game")!;
const picker = element<HTMLDetailsElement>("demo-picker");
const guide = element("empty-guide");
const undo = element<HTMLButtonElement>("undo");
const clear = element<HTMLButtonElement>("clear");
const clockButton = element<HTMLButtonElement>("playground-pause");
const colors = element("team-tools");
const scenario = element("scenario-name");
let team: Team = "red", strokeTeam: Team = team;
let previous = play.world;
let lastTime = performance.now(), remainder = 0;
let lastBlend = 1;
let animation = 0;
const tickMs = 1000 / TICKS_PER_SECOND;
const query = new URLSearchParams(location.search);
const demo = query.get("demo");
let soundHint=demo==="sound";

game.dataset.mode = "playground";
document.title = "Playground · Battle Sandbox";
element("match-state").textContent = "Playground";
field.canvas.dataset.deploying = "true";
scenario.hidden = false;
undo.title = "Remove the last squad you drew";
clear.title = "Clear the playground";
clockButton.hidden = false;

function choose(color: Team) {
  team = color;
  game.dataset.team = color;
  game.style.setProperty("--army", ARMIES[color].coat);
  scenario.textContent = ARMIES[color].name + " brush";
  field.colorBrush(color);
  for (const button of colors.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.color === color));
}
for (const color of TEAMS) {
  const button = document.createElement("button");
  button.type = "button"; button.className = "swatch"; button.dataset.color = color;
  button.style.setProperty("--dye", ARMIES[color].coat);
  button.title = ARMIES[color].name; button.setAttribute("aria-label", ARMIES[color].name + " army");
  button.addEventListener("click", () => {choose(color);updateBrushHint();}); colors.append(button);
}
choose(team);

function updateBrushHint() {
  const spell = field.selectedSpell(), hint = element("deploy-hint");
  hint.textContent = spell ? castHint(spell) : field.selectedKind() === "miner" ? "Choose a tunnel exit anywhere on the field." :
    soundHint && team==="blue" && field.selectedKind()==="cyclops" ? "Place the blue Cyclops just to the right of the red trio." : "";
  hint.hidden = !hint.textContent;
  field.canvas.setAttribute("aria-label", hint.textContent || "Playground. Choose a color and draw troops anywhere.");
}
game.addEventListener("brushchange",updateBrushHint);
if (demo === "siege") {
  const lineup = ["lobber", "sunlens", "belltower"] as const;
  lineup.forEach((kind,index) => {
    play.place("blue",{type:UNIT_DEFINITIONS[kind].command,positions:[{x:405+index*75,y:178}]});
  });
  previous = play.world;
  field.armBrush("fault");
} else if (demo === "sound") {
  play.place("red",{type:"place-archers",positions:[{x:390,y:150}]});
  play.place("red",{type:"place-clowns",positions:[{x:406,y:201}]});
  play.place("red",{type:"place-lancers",positions:[{x:359,y:177}]});
  previous=play.world;
  choose("blue");field.armBrush("cyclops");
} else if (demo === "crowd") {
  for (const {team,kind,x,y} of crowdFormation(query.get("size") === "80" ? 80 : 200)) {
    play.place(team, {type:UNIT_DEFINITIONS[kind].command, positions:[{x,y}]});
  }
  previous = play.world;
  play.paused = true;
} else if (demo === "reinforcements") {
  for (const [side,kind,x,y] of reinforcements) play.place(side,{type:UNIT_DEFINITIONS[kind].command,positions:[{x,y}]});
  previous=play.world;
  play.paused=true;
  field.armBrush("wormhole");
} else if (demo === "expressions") {
  const cast: [Team, RecruitKind, number, number][] = [
    ["red","archer",170,115], ["red","warrior",197,115], ["blue","warrior",286,115],
    ["red","medic",212,151], ["red","lancer",223,207], ["blue","shieldbearer",336,203],
    ["red","phoenix",420,120], ["blue","archer",479,125], ["blue","archer",520,146],
    ["red","cyclops",693,141], ["blue","mouse",720,145], ["blue","mouse",748,161],
    ["red","kirin",528,252], ["blue","lancer",634,258], ["blue","musketeer",704,256],
  ];
  for (const [side,kind,x,y] of cast) play.place(side,{type:UNIT_DEFINITIONS[kind].command,positions:[{x,y}]});
  for (let i=0; i<11; i++) { previous=play.world; play.advance(); }
  play.paused = true;
}
updateBrushHint();

function paint(blend = play.paused ? lastBlend : 1) {
  lastBlend = blend;
  drawArena(field.ctx, previous, play.world, blend);
}
function syncClockButton() {
  field.pauseSound(play.paused);
  const label = play.paused ? "Resume playground" : "Pause playground";
  clockButton.setAttribute("aria-label", label);
  clockButton.title = label + " (Space)";
  clockButton.toggleAttribute("data-paused", play.paused);
  clockButton.firstElementChild!.classList.toggle("pause", !play.paused);
  element("match-state").textContent = play.paused ? "Paused" : "Playground";
}
function toggleClock() {
  play.paused = !play.paused;
  syncClockButton();
  if (play.paused) {
    cancelAnimationFrame(animation);
    update();
  } else {
    lastTime = performance.now();
    animation = requestAnimationFrame(frame);
  }
}
clockButton.addEventListener("click", toggleClock);
document.addEventListener("keydown", event => {
  if (event.code !== "Space" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof Element && event.target.closest("button, input, textarea, select, summary, a, [contenteditable=true]")) return;
  event.preventDefault();
  toggleClock();
});
function update() {
  if(soundHint && play.world.units.length<3){soundHint=false;updateBrushHint();}
  guide.hidden = !!(play.world.units.length || play.world.arrows.length || play.world.spells?.length || play.world.effects?.length);
  undo.disabled = !play.canUndo;
  clear.disabled = !play.canUndo && !play.world.units.length && !play.world.arrows.length;
  field.updateScore(play.world);
}
attachSpellBrush(field.canvas, field.selectedSpell, (spell, point) => {
  const before = play.world;
  play.cast(team, spell, point.x, point.y);
  if (!play.paused) { field.hear(before,play.world); previous = play.world; }
  update(); paint();
});
const cancel = attachDeploymentBrush(field.canvas, {
  canDraw: () => !field.selectedSpell(),
  selectedKind() { strokeTeam = team; return field.selectedKind(); },
  livePlace(points, kind, first) {
    const before = play.world;
    if (soundHint) {soundHint=false;updateBrushHint();}
    play.place(strokeTeam, { type: UNIT_DEFINITIONS[kind].command, positions: points }, !first);
    field.hear(before,play.world);
    if (!play.paused) previous = play.world;
    update(); paint();
  },
});
undo.addEventListener("click", () => { cancel(); play.undo(); if (!play.paused) previous = play.world; update(); paint(); });
clear.addEventListener("click", () => { cancel(); play.clear(); previous = play.world; update(); paint(); });
document.addEventListener("pointerdown", e => { if (picker.open && e.target instanceof Node && !picker.contains(e.target)) picker.open = false; });
document.addEventListener("keydown", e => { if (e.key === "Escape") picker.open = false; });
window.addEventListener("blur", cancel);
document.addEventListener("visibilitychange", () => { lastTime = performance.now(); if (!play.paused) remainder = 0; if (document.hidden) cancel(); });

function frame(time: number) {
  remainder += Math.min(250, Math.max(0, time - lastTime));
  lastTime = time;
  const startWorld = play.world, before = startWorld.tick;
  const beforeCount = play.world.units.length;
  const beforeSpells = (play.world.spells?.length ?? 0) + (play.world.effects?.length ?? 0);
  while (remainder >= tickMs) {
    remainder -= tickMs; previous = play.world; play.advance();
  }
  if (before !== play.world.tick) field.hear(startWorld,play.world);
  if (beforeCount !== play.world.units.length || beforeSpells !== (play.world.spells?.length ?? 0) + (play.world.effects?.length ?? 0) || Math.floor(before / 6) !== Math.floor(play.world.tick / 6)) update();
  if (play.world.units.length || play.world.arrows.length || play.world.spells?.length || play.world.effects?.length || beforeSpells || beforeCount) paint(remainder / tickMs);
  animation = requestAnimationFrame(frame);
}
syncClockButton();
update();
field.watchSize(() => paint());
if (!play.paused) animation = requestAnimationFrame(frame);
