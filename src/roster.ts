import { ARMIES, type Team } from "./battlefield.ts";
import { drawUnitToken } from "./characters.ts";
import { drawSpellIcon } from "./magic-art.ts";
import { SPELLS, type SpellKind } from "./spells.ts";
import { UNIT_DEFINITIONS, type RecruitKind } from "./units.ts";

type Brush = RecruitKind | SpellKind;
const shelves: {name: string; items: Brush[]}[] = [
  {name: "People", items: ["warrior","archer","shieldbearer","medic","lancer","bomber","musketeer","scout","miner","clown","engineer"]},
  {name: "Machines", items: ["mouse","drone","workshop","post"]},
  {name: "Mythical", items: ["cyclops","kirin","frostqueen","phoenix","reaper","witch","zombie"]},
  {name: "Spells", items: ["gust","meteor","rain"]},
];
const catalog = { ...UNIT_DEFINITIONS, ...SPELLS };
function isSpell(key: Brush): key is SpellKind { return Object.hasOwn(SPELLS,key); }

const starters: Brush[] = ["warrior", "archer", "lancer", "medic", "meteor", "rain"];
function loadSlots(key: string): Brush[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (Array.isArray(saved) && saved.length === starters.length && new Set(saved).size === saved.length &&
        saved.every(item => shelves.some(group => group.items.includes(item)))) return saved;
  } catch { /* The bar also works when browser storage is unavailable. */ }
  return [...starters];
}

export function createRoster(strip: HTMLElement, priced: boolean) {
  const storageKey = "battle.quickbar." + location.pathname;
  const slots = loadSlots(storageKey);
  const useOrder = [2, 3, 0, 1, 5, 4];
  let selected: Brush = slots.find(kind => !isSpell(kind))!, team: Team = "red", shelf = 0;
  let editSlot: number | undefined;
  let balance: number | undefined, casting = !priced;
  const panel = document.createElement("section");
  panel.className = "roster-panel"; panel.id = "roster-panel"; panel.hidden = true;
  panel.setAttribute("aria-label","Troops and spells");
  const tabs = document.createElement("div"), cards = document.createElement("div"), note = document.createElement("p");
  tabs.className="roster-tabs"; cards.className="roster-cards"; note.className="roster-note"; note.hidden=true;
  const assignment = document.createElement("p");
  assignment.className="roster-assignment"; assignment.setAttribute("aria-live","polite");
  const close = document.createElement("button");
  close.type="button";close.textContent="×";close.className="roster-close";close.setAttribute("aria-label","Close roster");

  const quick = new Map<Brush,HTMLButtonElement>(), options = new Map<Brush,HTMLButtonElement>();
  const opener = document.createElement("button");
  opener.type="button";opener.id="roster-open";opener.className="brush-tool roster-open";
  opener.setAttribute("aria-label","Roster");opener.setAttribute("aria-controls",panel.id);
  const tiles=document.createElement("i");tiles.className="roster-mark";tiles.setAttribute("aria-hidden","true");
  opener.append(tiles,"Roster");opener.title="Choose troops or change a quick slot";
  strip.after(opener);

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
  function toggle(open: boolean) {
    editSlot=undefined;
    panel.hidden=!open;opener.setAttribute("aria-expanded",String(open));
    if(open) renderShelf(); else refresh();
  }
  function unavailable(key: Brush) {
    return (balance!==undefined && balance<catalog[key].cost) || (isSpell(key) && !casting);
  }
  function remember(index: number) {
    useOrder.splice(useOrder.indexOf(index),1);useOrder.push(index);
  }
  function choose(key: Brush) {
    selected=key;
    remember(slots.indexOf(key));
    toggle(false);
    strip.dispatchEvent(new Event("brushchange",{bubbles:true}));
  }
  function equip(key: Brush) {
    const existing=slots.indexOf(key);
    const index=editSlot ?? (existing>=0 ? existing : useOrder.find(i=>isSpell(slots[i])===isSpell(key)) ?? useOrder[0]);
    if (slots[index] !== key) {
      if(existing>=0) slots[existing]=slots[index];
      slots[index]=key;
      try { sessionStorage.setItem(storageKey,JSON.stringify(slots)); } catch { /* Use the in-memory bar. */ }
      renderQuick();
    }
    if(unavailable(key)){
      if(!slots.includes(selected)) choose(slots.find(kind=>!unavailable(kind)) ?? slots.find(kind=>!isSpell(kind))!);
      else toggle(false);
      remember(index);opener.focus({preventScroll:true});
    } else {
      choose(key);quick.get(key)?.focus({preventScroll:true});
    }
  }
  function renderQuick() {
    strip.replaceChildren();quick.clear();
    for(const [i,kind] of slots.entries()){
      const button=document.createElement("button");button.type="button";button.id="brush-"+kind;button.className="brush-tool quick-card";
      button.setAttribute("aria-label",catalog[kind].name);button.setAttribute("aria-keyshortcuts",String(i+1));
      button.title=(i+1)+" · "+catalog[kind].name+" · "+catalog[kind].description;
      const number=document.createElement("kbd");number.textContent=String(i+1);number.setAttribute("aria-hidden","true");
      const label=document.createElement("span");label.className="quick-name";label.textContent=catalog[kind].name;
      button.append(number,icon(kind),label);
      if(priced){const cost=document.createElement("small");cost.className="quick-price";cost.textContent=catalog[kind].cost+"g";button.append(cost);button.setAttribute("aria-description",catalog[kind].cost+" gold");}
      button.addEventListener("click",()=>{
        if(panel.hidden) choose(kind);
        else {editSlot=i;refresh();}
      });
      quick.set(kind,button);strip.append(button);
    }
  }
  function renderShelf() {
    cards.replaceChildren();options.clear();
    for(const [i,tab] of [...tabs.querySelectorAll<HTMLButtonElement>(".shelf")].entries()) tab.setAttribute("aria-pressed",String(i===shelf));
    for(const key of shelves[shelf].items) {
      const card=document.createElement("button");card.type="button";card.className="roster-card";card.setAttribute("aria-label",catalog[key].name);
      card.setAttribute("aria-pressed",String(key===selected));
      const text=document.createElement("span"), name=document.createElement("strong"), hint=document.createElement("small");
      name.textContent=catalog[key].name;hint.textContent=catalog[key].description;text.append(name,hint);card.append(icon(key),text);
      if(priced){const price=document.createElement("b");price.textContent=catalog[key].cost+"g";card.append(price);}
      card.addEventListener("click",()=>equip(key));
      cards.append(card);options.set(key,card);
    }
    refresh();
  }
  function refresh() {
    for(const [key,button] of quick){
      button.disabled=panel.hidden && unavailable(key);
      button.setAttribute("aria-pressed",String(selected===key));
      button.toggleAttribute("data-editing",editSlot!==undefined && slots[editSlot]===key);
    }
    if(!panel.hidden){
      assignment.textContent=editSlot===undefined ? "Pick a card to keep it on your bar, or tap a slot below to replace it." :
        "Choose a card for slot "+(editSlot+1)+" · "+catalog[slots[editSlot]].name;
      for(const [key,button] of options)button.disabled=editSlot===undefined && unavailable(key);
      note.hidden=shelves[shelf].name!=="Spells";
      note.textContent=casting?"Tap any spot on the field to cast.":"Equip spells in a slot now. Cast them after the countdown.";
    }
  }
  shelves.forEach((group,i)=>{
    const button=document.createElement("button");button.type="button";button.className="shelf";button.textContent=group.name;
    button.addEventListener("click",()=>{shelf=i;renderShelf();});tabs.append(button);
  });
  tabs.append(close);panel.append(tabs,assignment,note,cards);
  strip.closest(".tools")!.append(panel);
  opener.addEventListener("click",()=>toggle(!!panel.hidden));
  close.addEventListener("click",()=>{toggle(false);opener.focus();});
  document.addEventListener("pointerdown",event=>{if(!panel.hidden && event.target instanceof Node && !panel.contains(event.target) && !strip.contains(event.target) && !opener.contains(event.target))toggle(false);});
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && !panel.hidden){toggle(false);opener.focus();return;}
    if(strip.hidden || event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
        (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable=true]"))) return;
    if(/^[1-6]$/.test(event.key)){
      const button=quick.get(slots[Number(event.key)-1])!;
      if(!button.disabled){event.preventDefault();button.click();}
    }
  });
  toggle(false);renderQuick();refresh();
  return {
    selectedKind: (): RecruitKind => isSpell(selected)?"warrior":selected,
    selectedSpell: (): SpellKind | undefined => isSpell(selected)?selected:undefined,
    colorBrush(color:Team){team=color;renderQuick();if(!panel.hidden)renderShelf();refresh();},
    setCasting(enabled:boolean){if(casting===enabled)return;casting=enabled;if(!enabled && isSpell(selected))choose(slots.find(kind=>!isSpell(kind))!);else refresh();},
    closeRoster(){if(!panel.hidden)toggle(false);},
    setBudget(gold:number|undefined){if(balance!==gold){balance=gold;refresh();}},
  };
}
