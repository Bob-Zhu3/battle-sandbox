import { drawLandscape } from "./landscape.ts";
import { drawUnitToken } from "./characters.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";
import { ARMIES, BASE_HP, TEAMS, MATCHES, type MatchMode, type Team } from "./battlefield.ts";
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

export function createField(mode?: MatchMode) {
  const canvas = element<HTMLCanvasElement>("arena");
  const landscape = element<HTMLCanvasElement>("landscape");
  const ctx = contextFor(canvas);
  const ground = contextFor(landscape);
  const buttons = { warrior: element<HTMLButtonElement>("brush-warrior"), archer: element<HTMLButtonElement>("brush-archer") };
  let selected: UnitKind = "warrior";
  const sides = mode ? MATCHES[mode].teams : TEAMS;
  const score = element("score");
  for (const side of sides) {
    if (mode === "duel" && side === "blue") {
      const versus = document.createElement("span");
      versus.className = "versus"; versus.textContent = "vs"; score.append(versus);
    }
    const panel = document.createElement("div");
    panel.id = side + "-score"; panel.className = "pennant " + side;
    panel.style.setProperty("--cloth", ARMIES[side].hem);
    panel.innerHTML = '<span class="pennant-name">' + ARMIES[side].name + '</span><strong id="' + side + '-count">0</strong>'
      + '<span class="life-line" aria-hidden="true"><i id="' + side + '-bar"></i></span>'
      + '<span id="' + side + '-seat" class="seat-label" hidden></span>'
      + '<span class="sr-only"><span id="' + side + '-hp">0</span> of <span id="' + side + '-max">0</span> HP</span>';
    score.append(panel);
  }

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
    const cost = element("cost-" + kind);
    cost.textContent = definition.cost + "g";
    cost.hidden = !mode;
    button.title = definition.name + (mode ? " · " + definition.cost + " gold" : "") + " · " + definition.maxHp + " HP · " + definition.damage + " damage · " + definition.reach + " reach · " + definition.cooldownTicks + " ticks between attacks";
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
  const health = sides.map(side => ({
    side, score: element(side + "-score"), hp: element(side + "-hp"), max: element(side + "-max"),
    count: element(side + "-count"), bar: element(side + "-bar"),
  }));
  const tick = element("tick");
  function updateScore(world: World, visible = sides) {
    tick.textContent = String(world.tick).padStart(3, "0");
    for (const display of health) {
      const army = world.units.filter(u => u.team === display.side);
      const living = army.filter(u => u.hp > 0);
      const hp = living.reduce((sum, u) => sum + u.hp, 0);
      const max = army.reduce((sum, u) => sum + UNIT_DEFINITIONS[u.kind].maxHp, 0);
      const warriors = living.filter(u => u.kind === "warrior").length;
      display.score.hidden = !visible.includes(display.side) || (!mode && !living.length);
      display.count.textContent = String(living.length);
      display.hp.textContent = String(hp); display.max.textContent = String(max);
      display.score.title = living.length + " of " + army.length + " alive · Warriors " + warriors + " · Archers " + (living.length - warriors) + " · " + hp + "/" + max + " HP";
      const base = world.bases?.find(base => base.team === display.side);
      if (base) { display.score.dataset.baseHp = String(base.hp); display.score.title += " · Base " + base.hp + "/" + BASE_HP + " HP"; }
      display.bar.style.transform = "scaleX(" + (base ? base.hp / BASE_HP : max ? hp / max : 0) + ")";
    }
  }

  const balance = element("gold-balance");
  function setGold(amount: number | undefined) {
    balance.textContent = amount === undefined ? (mode ? "…" : "∞") : String(amount);
    for (const kind of ["warrior", "archer"] as const) buttons[kind].disabled = amount !== undefined && amount < UNIT_DEFINITIONS[kind].cost;
  }
  setGold(undefined);
  return { canvas, ctx, selectedKind: () => selected, colorBrush, watchSize, updateScore, setGold };
}
