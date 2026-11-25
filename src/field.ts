import { maxHealth } from "./transformations.ts";
import { whenEffectsLoad } from "./pixel-art/effect-player.ts";
import { paintCrest } from "./pixel-art/crest.ts";
import { createRoster } from "./roster.ts";
import { createBattleSound } from "./battle-sound.ts";
import { UNIT_DEFINITIONS, UNIT_KINDS } from "./units.ts";
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
  paintCrest(element<HTMLCanvasElement>("battle-crest"));
  const canvas = element<HTMLCanvasElement>("arena");
  const ctx = contextFor(canvas);
  const roster = createRoster(element("brush-tool"), !!mode);
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

  function watchSize(paint: () => void) {
    function resize() {
      const ratio = window.devicePixelRatio || 1;
      // Use whole device pixels per texel. Pointer and room coordinates stay in arena units.
      const step = Math.max(1, Math.round(ratio * Math.max(1, canvas.clientWidth / 750)));
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio / step));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio / step));
      canvas.width = width;
      canvas.height = height;
      paint();
    }
    resize();
    whenEffectsLoad(paint);
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
      const max = army.reduce((sum, u) => sum + maxHealth(u), 0);
      display.score.hidden = !visible.includes(display.side) || (!mode && !living.length);
      display.count.textContent = String(living.length);
      display.hp.textContent = String(hp); display.max.textContent = String(max);
      const counts = new Map<string, number>();
      for (const unit of living) counts.set(unit.kind, (counts.get(unit.kind) ?? 0) + 1);
      const roster = UNIT_KINDS.filter(kind => counts.has(kind)).map(kind => UNIT_DEFINITIONS[kind].name + " " + counts.get(kind));
      display.score.title = [living.length + " of " + army.length + " alive", ...roster, hp + "/" + max + " HP"].join(" · ");
      const base = world.bases?.find(base => base.team === display.side);
      if (base) { display.score.dataset.baseHp = String(base.hp); display.score.title += " · Base " + base.hp + "/" + BASE_HP + " HP"; }
      display.bar.style.transform = "scaleX(" + (base ? base.hp / BASE_HP : max ? hp / max : 0) + ")";
    }
  }

  const balance = element("gold-balance");
  function setGold(amount: number | undefined) {
    balance.textContent = amount === undefined ? (mode ? "…" : "∞") : String(amount);
    roster.setBudget(amount);
  }
  setGold(undefined);
  const sound = createBattleSound(element<HTMLButtonElement>("sound-toggle"));
  return { canvas, ctx, ...roster, ...sound, watchSize, updateScore, setGold };
}
