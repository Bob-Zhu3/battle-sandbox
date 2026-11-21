import { attachDeploymentBrush, attachSpellBrush } from "./brush-input.ts";
import { ARMIES, TEAMS, type Team } from "./battlefield.ts";
import { createField, element } from "./field.ts";
import { Playground } from "./playground.ts";
import { drawArena } from "./renderer.ts";
import { UNIT_DEFINITIONS } from "./units.ts";
import { SPELLS } from "./spells.ts";
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

function updateBrushHint() {
  const spell = field.selectedSpell(), hint = element("deploy-hint");
  hint.textContent = spell ? "Tap anywhere to cast " + SPELLS[spell].name + "." : field.selectedKind() === "miner" ? "Choose a tunnel exit anywhere on the field." : "";
  hint.hidden = !hint.textContent;
  field.canvas.setAttribute("aria-label", hint.textContent || "Playground. Choose a color and draw troops anywhere.");
}
game.addEventListener("brushchange",updateBrushHint);
if (new URLSearchParams(location.search).get("demo") === "siege") {
  const lineup = ["lobber", "sunlens", "belltower"] as const;
  lineup.forEach((kind,index) => {
    play.place("blue",{type:UNIT_DEFINITIONS[kind].command,positions:[{x:405+index*75,y:178}]});
  });
  previous = play.world;
  field.armBrush("fault");
}
updateBrushHint();

function paint(blend = 1) {
  drawArena(field.ctx, previous, play.world, blend);
}
function update() {
  guide.hidden = !!(play.world.units.length || play.world.arrows.length || play.world.spells?.length || play.world.effects?.length);
  undo.disabled = !play.canUndo;
  clear.disabled = !play.canUndo && !play.world.units.length && !play.world.arrows.length;
  field.updateScore(play.world);
}
attachSpellBrush(field.canvas, field.selectedSpell, (spell, point) => {
  const before = play.world;
  play.cast(team, spell, point.x, point.y); field.hear(before,play.world); previous = play.world; update(); paint();
});
const cancel = attachDeploymentBrush(field.canvas, {
  canDraw: () => !field.selectedSpell(),
  selectedKind() { strokeTeam = team; return field.selectedKind(); },
  livePlace(points, kind, first) {
    const before = play.world;
    play.place(strokeTeam, { type: UNIT_DEFINITIONS[kind].command, positions: points }, !first);
    field.hear(before,play.world);
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
  const startWorld = play.world, before = startWorld.tick;
  const beforeCount = play.world.units.length;
  const beforeSpells = (play.world.spells?.length ?? 0) + (play.world.effects?.length ?? 0);
  while (remainder >= tickMs) {
    remainder -= tickMs; previous = play.world; play.advance();
  }
  if (before !== play.world.tick) field.hear(startWorld,play.world);
  if (beforeCount !== play.world.units.length || beforeSpells !== (play.world.spells?.length ?? 0) + (play.world.effects?.length ?? 0) || Math.floor(before / 6) !== Math.floor(play.world.tick / 6)) update();
  if (play.world.units.length || play.world.arrows.length || play.world.spells?.length || play.world.effects?.length || beforeSpells || beforeCount) paint(remainder / tickMs);
  requestAnimationFrame(frame);
}
update();
field.watchSize(() => paint());
requestAnimationFrame(frame);
