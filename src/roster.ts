import { ARMIES, type Team } from "./battlefield.ts";
import { drawUnitToken } from "./characters.ts";
import { drawSpellIcon } from "./magic-art.ts";
import { SPELLS, type SpellKind } from "./spells.ts";
import { UNIT_DEFINITIONS, type RecruitKind } from "./units.ts";

type Brush = RecruitKind | SpellKind;
const shelves: {name: string; items: Brush[]}[] = [
  {name: "People", items: ["warrior","archer","shieldbearer","medic","lancer","bomber","musketeer","scout","miner","clown","engineer"]},
  {name: "Machines", items: ["mouse","drone"]},
  {name: "Towers", items: ["post","workshop","lobber","sunlens","belltower"]},
  {name: "Mythical", items: ["cyclops","kirin","frostqueen","phoenix","reaper","witch","zombie"]},
  {name: "Spells", items: ["gust","meteor","rain","fault","briar","mirror","freeze","lightning","rage"]},
];
const catalog = { ...UNIT_DEFINITIONS, ...SPELLS };
function isSpell(key: Brush): key is SpellKind { return Object.hasOwn(SPELLS,key); }

export function createRoster(strip: HTMLElement, priced: boolean) {
  const storageKey = "battle.palette." + location.pathname;
  let selected: Brush = "warrior", shelf = 0, team: Team = "red";
  let balance: number | undefined, casting = !priced;
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (saved && shelves.some(group => group.items.includes(saved.brush))) selected = saved.brush;
    const savedShelf = saved?.shelf === "Machines" && (saved.brush === "post" || saved.brush === "workshop") && saved.version !== 2 ? "Towers" : saved?.shelf;
    const index = shelves.findIndex(group => group.name === savedShelf);
    if (index >= 0) shelf = index;
  } catch { /* The palette works without storage. */ }

  const tabs = document.createElement("div"), row = document.createElement("div"), track = document.createElement("div");
  tabs.className = "palette-tabs"; tabs.setAttribute("role","tablist"); tabs.setAttribute("aria-label","Troop categories");
  row.className = "palette-row";
  track.id = "palette-track"; track.className = "palette-track"; track.setAttribute("role","tabpanel");
  const tabButtons: HTMLButtonElement[] = [], cards = new Map<Brush,HTMLButtonElement>();
  const offsets = shelves.map(() => 0);

  function icon(key: Brush) {
    const art = document.createElement("canvas");art.width=art.height=144;art.className="brush-icon";art.setAttribute("aria-hidden","true");
    const c=art.getContext("2d")!;
    c.scale(2,2);
    if(isSpell(key)){c.translate(36,36);c.scale(1.95,1.95);drawSpellIcon(c,key);}
    else if (key === "phoenix") {
      drawUnitToken(c, 36 + ARMIES[team].facing * 9.5, 49, 13.5, team, key);
    } else {
      const myth = key === "cyclops" || key === "frostqueen" || key === "kirin" || key === "reaper" || key === "witch";
      const longWeapon = key === "musketeer" || key === "lancer" || key === "miner";
      const size = myth ? (key === "cyclops" ? 15.5 : 14.5) : longWeapon || key === "mouse" ? 17 : 19;
      const shift = key === "reaper" || key === "miner" ? -7 : longWeapon || key === "cyclops" ? -4 : 0;
      drawUnitToken(c,36 + ARMIES[team].facing * shift,myth ? 49 : 44,size,team,key);
    }
    return art;
  }
  function remember() {
    try { sessionStorage.setItem(storageKey,JSON.stringify({version:2, brush:selected, shelf:shelves[shelf].name})); }
    catch { /* Use the in-memory selection. */ }
  }
  function refresh() {
    for (const [kind,card] of cards) {
      const locked = isSpell(kind) && !casting;
      const tooDear = balance !== undefined && balance < catalog[kind].cost;
      card.disabled = locked || tooDear;
      card.setAttribute("aria-pressed",String(kind === selected));
      const help = locked ? "Spells unlock when battle begins." : tooDear ? "You need " + catalog[kind].cost + " gold." : catalog[kind].description;
      card.title = catalog[kind].name + " · " + help;
      card.setAttribute("aria-description",(priced ? catalog[kind].cost + " gold. " : "") + help);
    }
    for (let i=0; i<tabButtons.length; i++) {
      tabButtons[i].setAttribute("aria-selected",String(i === shelf));
      tabButtons[i].tabIndex = i === shelf ? 0 : -1;
      tabButtons[i].toggleAttribute("data-armed", i !== shelf && shelves[i].items.includes(selected));
    }
  }
  function choose(kind: Brush) {
    selected = kind;
    remember(); refresh();
    strip.dispatchEvent(new Event("brushchange",{bubbles:true}));
  }
  function scrollArrow(direction: -1 | 1) {
    const button = document.createElement("button"); button.type = "button"; button.className = "palette-arrow";
    button.setAttribute("aria-label", direction < 0 ? "Scroll troops left" : "Scroll troops right");
    button.setAttribute("aria-controls", track.id); button.dataset.direction = String(direction);
    button.addEventListener("click",() => track.scrollBy({left: direction * Math.max(70,track.clientWidth * .72), behavior:"instant"}));
    return button;
  }
  const back = scrollArrow(-1), next = scrollArrow(1);
  function updateEdges() {
    const end = track.scrollWidth - track.clientWidth;
    // Keep both arrow gutters in place while scrolling so portraits never jump under a finger.
    row.toggleAttribute("data-overflow",end > 1);
    back.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= end - 1;
  }
  function reveal(card: HTMLButtonElement) {
    const box = card.getBoundingClientRect(), visible = track.getBoundingClientRect();
    if (box.left < visible.left) track.scrollLeft += box.left - visible.left - 3;
    if (box.right > visible.right) track.scrollLeft += box.right - visible.right + 3;
  }
  function renderShelf() {
    track.replaceChildren(); cards.clear();
    track.setAttribute("aria-labelledby",tabButtons[shelf].id);
    shelves[shelf].items.forEach((kind,index) => {
      const card = document.createElement("button");
      card.type = "button"; card.id = "brush-" + kind; card.className = "palette-card";
      card.setAttribute("aria-label",catalog[kind].name);
      if (index < 10) card.setAttribute("aria-keyshortcuts",String((index+1)%10));
      const name = document.createElement("span"); name.className = "card-name"; name.textContent = catalog[kind].name;
      card.append(icon(kind),name);
      if (priced) {
        const price = document.createElement("small"); price.className = "card-price"; price.textContent = catalog[kind].cost + "g"; card.append(price);
      }
      card.addEventListener("click",() => { choose(kind); reveal(card); });
      track.append(card); cards.set(kind,card);
    });
    refresh();
    track.scrollLeft = offsets[shelf]; updateEdges();
  }
  function browse(index: number) {
    if (index === shelf) return;
    offsets[shelf] = track.scrollLeft; shelf = index;
    renderShelf(); remember();
  }
  function arrowIndex(event: KeyboardEvent, current: number, length: number) {
    switch (event.key) {
      case "ArrowLeft": return (current + length - 1) % length;
      case "ArrowRight": return (current + 1) % length;
      case "Home": return 0;
      case "End": return length - 1;
    }
  }
  shelves.forEach((group,index) => {
    const tab = document.createElement("button"); tab.type = "button"; tab.textContent = group.name;
    tab.id = "category-" + group.name.toLowerCase(); tab.setAttribute("role","tab"); tab.setAttribute("aria-controls",track.id);
    tab.addEventListener("click",() => browse(index));
    // A first tap during touch-scroll momentum can arrive without a synthetic click.
    tab.addEventListener("pointerup", e => {
      if (e.pointerType === "touch" && e.isPrimary && document.elementFromPoint(e.clientX,e.clientY) === tab) browse(index);
    });
    tab.addEventListener("keydown",e => {
      const i = arrowIndex(e,index,shelves.length); if (i === undefined) return;
      e.preventDefault(); browse(i); tabButtons[i].focus();
    });
    tabs.append(tab); tabButtons.push(tab);
  });
  track.addEventListener("keydown", e => {
    const enabled = [...cards.values()].filter(card => !card.disabled);
    const index = enabled.indexOf(e.target as HTMLButtonElement);
    if (index < 0) return;
    const i = arrowIndex(e,index,enabled.length); if (i === undefined) return;
    e.preventDefault(); enabled[i].focus({preventScroll:true}); reveal(enabled[i]);
  });
  track.addEventListener("wheel", e => {
    if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY) || track.scrollWidth <= track.clientWidth) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? track.clientWidth : 1;
    track.scrollLeft += e.deltaY * unit;
  },{passive:false});
  track.addEventListener("scroll",updateEdges,{passive:true});
  document.addEventListener("keydown", e => {
    if (strip.hidden || e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey ||
        !/^[0-9]$/.test(e.key) || (e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable=true]"))) return;
    const card = [...cards.values()][(Number(e.key)+9)%10];
    if (card && !card.disabled) { e.preventDefault(); card.click(); }
  });
  row.append(back,track,next); strip.append(tabs,row);
  renderShelf();
  const armed = cards.get(selected); if (armed) reveal(armed);
  new ResizeObserver(updateEdges).observe(track);
  return {
    selectedKind: (): RecruitKind => isSpell(selected) ? "warrior" : selected,
    selectedSpell: (): SpellKind | undefined => isSpell(selected) && casting ? selected : undefined,
    armBrush(kind: Brush) {
      browse(shelves.findIndex(group => group.items.includes(kind)));
      choose(kind); reveal(cards.get(kind)!);
    },
    colorBrush(color: Team) {
      if (team === color) return;
      team = color;
      for (const [key,card] of cards) card.querySelector("canvas")!.replaceWith(icon(key));
    },
    setCasting(enabled: boolean, deploying: boolean) {
      if (deploying && isSpell(selected)) { selected = "warrior"; remember(); refresh(); }
      if (casting !== enabled) { casting = enabled; refresh(); }
    },
    setBudget(gold: number | undefined) { if (balance !== gold) { balance = gold; refresh(); } },
  };
}
