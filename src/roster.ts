import type { Team } from "./battlefield.ts";
import { drawUnitToken } from "./characters.ts";
import { drawSpellIcon } from "./magic-art.ts";
import { SPELLS, type SpellKind } from "./spells.ts";
import { UNIT_DEFINITIONS, type UnitKind } from "./units.ts";

type Brush = UnitKind | SpellKind;
const shelves: {name: string; items: Brush[]}[] = [
  {name: "People", items: ["warrior","archer","shieldbearer","medic","lancer","cooper","engineer"]},
  {name: "Machines", items: ["mouse","drone","workshop","post"]},
  {name: "Myths", items: ["giant","kirin","phoenix"]},
  {name: "Spells", items: ["gust","meteor","rain"]},
];
const catalog = { ...UNIT_DEFINITIONS, ...SPELLS };
function isSpell(key: Brush): key is SpellKind { return Object.hasOwn(SPELLS,key); }

export function createRoster(strip: HTMLElement, priced: boolean) {
  let selected: Brush = "warrior", team: Team = "red", shelf = 0;
  let balance: number | undefined, casting = !priced;
  const panel = document.createElement("section");
  panel.className = "roster-panel"; panel.id = "roster-panel"; panel.hidden = true;
  panel.setAttribute("aria-label","Troops and spells");
  const tabs = document.createElement("div"), cards = document.createElement("div"), note = document.createElement("p");
  tabs.className="roster-tabs"; cards.className="roster-cards"; note.className="roster-note"; note.hidden=true;
  const close = document.createElement("button");
  close.type="button";close.textContent="×";close.className="roster-close";close.setAttribute("aria-label","Close roster");

  const quick = new Map<Brush,HTMLButtonElement>(), options = new Map<Brush,HTMLButtonElement>();
  const opener = document.createElement("button");
  opener.type="button";opener.id="roster-open";opener.className="brush-tool roster-open";
  opener.setAttribute("aria-label","Roster");opener.setAttribute("aria-controls",panel.id);

  function icon(key: Brush) {
    const art = document.createElement("canvas");art.width=art.height=72;art.className="brush-icon";art.setAttribute("aria-hidden","true");
    const c=art.getContext("2d")!;
    if(isSpell(key)){c.translate(36,36);c.scale(1.95,1.95);drawSpellIcon(c,key);}
    else drawUnitToken(c,36,43,key==="giant"?21:key==="mouse"?17:20,team,key);
    return art;
  }
  function toggle(open: boolean) {
    panel.hidden=!open;opener.setAttribute("aria-expanded",String(open));
    if(open) renderShelf();
  }
  function choose(key: Brush) {
    selected=key;toggle(false);renderQuick();refresh();
    strip.dispatchEvent(new Event("brushchange",{bubbles:true}));
  }
  function textLabel(key: Brush, withCost: boolean) {
    const label=document.createElement("span");
    label.textContent=catalog[key].name;
    if(priced && withCost){const price=document.createElement("small");price.textContent=catalog[key].cost+"g";price.setAttribute("aria-hidden","true");label.append(price);}
    return label;
  }
  function renderQuick() {
    strip.replaceChildren();quick.clear();
    for(const kind of ["warrior","archer"] as const){
      const button=document.createElement("button");button.type="button";button.id="brush-"+kind;button.className="brush-tool";
      button.title=catalog[kind].description;button.setAttribute("aria-pressed",String(selected===kind));
      button.append(icon(kind),textLabel(kind,true));button.addEventListener("click",()=>choose(kind));
      quick.set(kind,button);strip.append(button);
    }
    const special=selected!=="warrior" && selected!=="archer";
    opener.replaceChildren();opener.dataset.selected=String(special);
    if(special){opener.append(icon(selected),textLabel(selected,true));opener.title=catalog[selected].description;}
    else {const tiles=document.createElement("i");tiles.className="roster-mark";tiles.setAttribute("aria-hidden","true");opener.append(tiles,"Roster");opener.title="Choose troops, buildings or spells";}
    const arrow=document.createElement("small");arrow.textContent="▴";arrow.setAttribute("aria-hidden","true");
    opener.append(arrow);strip.append(opener);
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
      card.addEventListener("click",()=>{ choose(key);opener.focus({preventScroll:true}); });
      cards.append(card);options.set(key,card);
    }
    refresh();
  }
  function refresh() {
    const unavailable=(key:Brush)=>(balance!==undefined && balance<catalog[key].cost) || (isSpell(key) && !casting);
    for(const [key,button] of quick) button.disabled=unavailable(key);
    if(!panel.hidden){
      for(const [key,button] of options)button.disabled=unavailable(key);
      note.hidden=shelves[shelf].name!=="Spells";
      note.textContent=casting?"Tap any spot on the field to cast.":"Spells unlock after the countdown.";
    }
  }
  shelves.forEach((group,i)=>{
    const button=document.createElement("button");button.type="button";button.className="shelf";button.textContent=group.name;
    button.addEventListener("click",()=>{shelf=i;renderShelf();});tabs.append(button);
  });
  tabs.append(close);panel.append(tabs,note,cards);
  strip.closest(".tools")!.append(panel);
  opener.addEventListener("click",()=>toggle(!!panel.hidden));
  close.addEventListener("click",()=>{toggle(false);opener.focus();});
  document.addEventListener("pointerdown",event=>{if(!panel.hidden && event.target instanceof Node && !panel.contains(event.target) && !strip.contains(event.target))toggle(false);});
  document.addEventListener("keydown",event=>{if(event.key==="Escape" && !panel.hidden){toggle(false);opener.focus();}});
  toggle(false);renderQuick();refresh();
  return {
    selectedKind: (): UnitKind => isSpell(selected)?"warrior":selected,
    selectedSpell: (): SpellKind | undefined => isSpell(selected)?selected:undefined,
    colorBrush(color:Team){team=color;renderQuick();if(!panel.hidden)renderShelf();refresh();},
    setCasting(enabled:boolean){if(casting===enabled)return;casting=enabled;if(!enabled && isSpell(selected))choose("warrior");else refresh();},
    closeRoster(){toggle(false);},
    setBudget(gold:number|undefined){balance=gold;refresh();},
  };
}
