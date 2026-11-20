import { attachDeploymentBrush } from "./brush-input.ts";
import { ARMIES, TEAMS, type Team } from "./battlefield.ts";
import { createField, element } from "./field.ts";
import { Playground } from "./playground.ts";
import { drawArena } from "./renderer.ts";
import { TICKS_PER_SECOND } from "./simulation.ts";

const field = createField();
const play = new Playground();
const game = document.querySelector<HTMLElement>(".game")!;
const picker = element<HTMLDetailsElement>("demo-picker");
const guide = element("empty-guide");
const undo = element<HTMLButtonElement>("undo");
const clear = element<HTMLButtonElement>("clear");
const colors = element("team-tools");
const scenario = element("scenario-name");
let team: Team = "red", strokeTeam: Team = team;
let previous = play.world;
let lastTime = performance.now(), remainder = 0;
const tickMs = 1000 / TICKS_PER_SECOND;

game.dataset.mode = "playground";
document.title = "Playground · Battle Sandbox";
element("match-state").textContent = "Playground";
field.canvas.dataset.deploying = "true";
scenario.hidden = false;
undo.title = "Remove the last squad you drew";
clear.title = "Clear the playground";

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
  button.addEventListener("click", () => choose(color)); colors.append(button);
}
choose(team);

function paint(blend = 1) {
  drawArena(field.ctx, previous, play.world, blend);
}
function update() {
  guide.hidden = !!(play.world.units.length || play.world.arrows.length);
  undo.disabled = !play.canUndo;
  clear.disabled = !play.canUndo && !play.world.units.length && !play.world.arrows.length;
  field.updateScore(play.world);
}
const cancel = attachDeploymentBrush(field.canvas, {
  canDraw: () => true,
  selectedKind() { strokeTeam = team; return field.selectedKind(); },
  livePlace(points, kind, first) {
    play.place(strokeTeam, { type: kind === "archer" ? "place-archers" : "place-warriors", positions: points }, !first);
    previous = play.world;
    update(); paint();
  },
});
undo.addEventListener("click", () => { cancel(); play.undo(); previous = play.world; update(); paint(); });
clear.addEventListener("click", () => { cancel(); play.clear(); previous = play.world; update(); paint(); });
document.addEventListener("pointerdown", e => { if (picker.open && e.target instanceof Node && !picker.contains(e.target)) picker.open = false; });
document.addEventListener("keydown", e => { if (e.key === "Escape") picker.open = false; });
window.addEventListener("blur", cancel);
document.addEventListener("visibilitychange", () => { lastTime = performance.now(); remainder = 0; if (document.hidden) cancel(); });

function frame(time: number) {
  remainder += Math.min(250, Math.max(0, time - lastTime));
  lastTime = time;
  const before = play.world.tick;
  const beforeCount = play.world.units.length;
  while (remainder >= tickMs) {
    remainder -= tickMs; previous = play.world; play.advance();
  }
  if (beforeCount !== play.world.units.length || Math.floor(before / 6) !== Math.floor(play.world.tick / 6)) update();
  if (play.world.units.length || play.world.arrows.length || beforeCount) paint(remainder / tickMs);
  requestAnimationFrame(frame);
}
update();
field.watchSize(() => paint());
requestAnimationFrame(frame);
