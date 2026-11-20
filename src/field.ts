import { drawLandscape } from "./landscape.ts";
import { drawUnitToken } from "./characters.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";
import type { Team } from "./simulation.ts";
import type { World } from "./room-protocol.ts";

export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error("Missing interface element: " + id);
  return found as T;
}

function contextFor(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not open a 2D canvas.");
  return context;
}

export function createField() {
  const canvas = element<HTMLCanvasElement>("arena");
  const landscape = element<HTMLCanvasElement>("landscape");
  const ctx = contextFor(canvas);
  const ground = contextFor(landscape);
  const buttons = { warrior: element<HTMLButtonElement>("brush-warrior"), archer: element<HTMLButtonElement>("brush-archer") };
  let selected: UnitKind = "warrior";

  function colorBrush(team: Team) {
    for (const kind of ["warrior", "archer"] as const) {
      const icon = contextFor(element<HTMLCanvasElement>("icon-" + kind));
      icon.clearRect(0, 0, 72, 72);
      drawUnitToken(icon, 36, 42, 22, team, kind);
    }
  }
  colorBrush("red");
  for (const kind of ["warrior", "archer"] as const) {
    const definition = UNIT_DEFINITIONS[kind];
    const button = buttons[kind];
    button.title = definition.name + " · " + definition.maxHp + " HP · " + definition.damage + " damage · " + definition.reach + " reach · " + definition.cooldownTicks + " ticks between attacks";
    button.addEventListener("click", () => {
      buttons[selected].setAttribute("aria-pressed", "false");
      selected = kind;
      button.setAttribute("aria-pressed", "true");
    });
  }

  function watchSize(paint: () => void) {
    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      for (const layer of [landscape, canvas]) {
        layer.width = width;
        layer.height = height;
      }
      drawLandscape(ground);
      paint();
    }
    resize();
    new ResizeObserver(resize).observe(canvas);
  }
  return { canvas, ctx, selectedKind: () => selected, colorBrush, watchSize };
}

const tickLabel = element("tick");
const health = {
  red: { score: element("red-score"), hp: element("red-hp"), max: element("red-max"), count: element("red-count"), bar: element("red-bar") },
  blue: { score: element("blue-score"), hp: element("blue-hp"), max: element("blue-max"), count: element("blue-count"), bar: element("blue-bar") },
};

export function updateFieldScore(battle: World) {
  tickLabel.textContent = String(battle.tick).padStart(3, "0");
  const totals = { red: { units: 0, warrior: 0, archer: 0, hp: 0, max: 0 }, blue: { units: 0, warrior: 0, archer: 0, hp: 0, max: 0 } };
  for (const unit of battle.units) {
    const team = totals[unit.team];
    team.units++;
    if (unit.hp > 0) team[unit.kind]++;
    team.hp += unit.hp;
    team.max += UNIT_DEFINITIONS[unit.kind].maxHp;
  }
  for (const side of ["red", "blue"] as const) {
    const { units, warrior, archer, hp, max } = totals[side];
    const alive = warrior + archer;
    const display = health[side];
    if (display.count.textContent !== String(alive)) display.count.textContent = String(alive);
    if (display.max.textContent !== String(max)) display.max.textContent = String(max);
    if (display.hp.textContent !== String(hp)) display.hp.textContent = String(hp);
    display.score.title = alive + " of " + units + " alive · Warriors " + warrior + " · Archers " + archer + " · " + hp + "/" + max + " HP";
    display.bar.style.transform = "scaleX(" + (max ? hp / max : 0) + ")";
  }
  return totals;
}
