import type { Cue, CueKind } from "../sound-events.ts";
import type { SpellKind } from "../spells.ts";
import type { UnitKind } from "../units.ts";
import type { Take } from "./field-takes.ts";

interface Layer {
  take: Take | readonly Take[];
  gain: number;
  delay: number;
  speed: number;
  limit?: number;
}
type Sound = readonly Layer[];
function cut(take: Layer["take"], gain: number, delay=0, speed=1, limit?: number): Layer {
  return {take,gain,delay,speed,limit};
}

const flurry: readonly Sound[] = [
  [cut("knuckles",.51),cut("shortSwish",.11)],
  [cut("palm",.52),cut("reedSwish",.12,0,1.16,.09)],
  [cut("bodyHit",.60),cut("shortSwish",.13)],
  [cut("shoulder",.69,0,.94),cut("staffSwish",.17,0,.96,.12)],
];

// The first layer is the physical action. A second layer is its contact, debris or breath.
const combat = {
  bowDraw: [cut("draw",.48)],
  bow: [cut("loose",.72)],
  clash: [cut(["sword","shield"],.48),cut("leather",.12,.025)],
  block: [cut(["shield","sword"],.65),cut("timberHit",.25,.009)],
  shieldBash: [cut("timberHit",.59),cut("mail",.26,.018)],
  thrust: [cut("reedSwish",.40),cut("metalClip",.27,.064)],
  staff: [cut("woodKnock",.43),cut("palm",.26,.012)],
  punch: flurry[0],
  backKick: [cut("shoulder",.64),cut("cymbal",.21,.052,1.04,.16)],
  fuse: [cut("tinder",.49),cut("flame",.20,.046,1.10,.14)],
  bombBlast: [cut("shell",.79),cut("splinters",.30,.045),cut("pebbles",.20,.091)],
  shot: [cut("report",.65),cut("buckle",.14,.078)],
  dart: [cut("shortSwish",.33),cut("airIntake",.16,0,1.32,.08)],
  toss: [cut("glassTick",.30),cut("shortSwish",.32,.028)],
  glass: [cut(["glassA","glassB"],.78)],
  pickaxe: [cut("rockHit",.52),cut("metalClip",.37,.014)],
  breakSoil: [cut("gravel",.55),cut("pebbles",.36,.058),cut("boot",.24,.085)],
  scythe: [cut("wideSwish",.53),cut(["bladeScrape","bladePass"],.31,.079)],
  soulCatch: [cut("airIntake",.47,0,.80),cut("leather",.20,.147,.83)],
  hex: [cut("cackle",.41),cut("staffSwish",.30,.082,.83)],
  smash: [cut("timberHit",.67),cut("rockBreak",.62,.006),cut("gravel",.37,.094)],
  gulp: [cut("jaw",.32),cut("swallow",.53,.082)],
  bite: [cut("jaw",.56),cut("rasp",.26,.012,1.07,.16)],
  shard: [cut("iceCrack",.42),cut("reedSwish",.28,.046,1.12)],
  frostLand: [cut("iceShards",.52),cut("snowPress",.30,.018)],
  clockBite: [cut("ratchet",.28,0,1.22,.09),cut("rat",.34,.015,1.08)],
  squeak: [cut("rat",.48)],
  windKey: [cut("ratchet",.41),cut("switchClick",.34,.176)],
  wrench: [cut("hammer",.48),cut("metalHit",.27,.010)],
  bandage: [cut("cloth",.29),cut("paperRip",.46,.055,1.08,.17)],
  repair: [cut("ratchet",.41),cut("hammer",.35,.119)],
  raisePost: [cut("timberHit",.39),cut("hammer",.51,.091),cut("latch",.30,.205)],
  bolt: [cut("latch",.46),cut("loose",.35,.018,1.12)],
  keepBolt: [cut("creak",.25,0,.84,.12),cut("loose",.58,.034,.76),cut("woodKnock",.37,.038)],
  sling: [cut("leather",.29),cut("wideSwish",.48,.031),cut("woodKnock",.26,.067)],
  boulderLand: [cut("rockHit",.62),cut("rockBreak",.42,.033),cut("pebbles",.32,.078)],
  lens: [cut("current",.32,0,1.10),cut("tinder",.19,.039)],
  toll: [cut("bell",.58),cut("woodKnock",.20,.015)],
  droneBolt: [cut("switchClick",.29),cut("discharge",.41,.008,1.12,.09)],
  thunder: [cut("discharge",.61),cut("current",.18,.016,.95,.075)],
  kirinCall: [cut("whinny",.48,0,1.04,.40)],
  screech: [cut("caw",.50),cut("wingBeat",.26,.035)],
  rebirth: [cut("flame",.43,0,.84),cut("wingBeat",.50,.106),cut("cawShort",.32,.192)],
  cymbals: [cut("cymbal",.50),cut("heel",.22,.045)],
  snort: [cut("snort",.53,0,.83),cut("boot",.27,.068,.81)],
  hornJab: [cut("shoulder",.49),cut("snort",.25,0,.89,.16)],
  hornCrash: [cut("shoulder",.74,0,.76),cut("timberHit",.53,.011),cut("gravel",.36,.072)],
  timberRam: [cut("timberHit",.67,0,.88),cut("creak",.34,.036)],
  hatch: [cut("creak",.48),cut("gate",.49,.136)],
  sails: [cut("wideSwish",.34,0,.77),cut("creak",.27,.092)],
  fan: [cut("staffSwish",.43,0,.93),cut("shortSwish",.22,.072)],
  winch: [cut("ratchet",.41),cut("chain",.46,.047),cut("reedSwish",.34,.083)],
  hook: [cut("metalHit",.54),cut("mail",.31,.042)],
  prism: [cut("current",.36),cut("glassChip",.21,0,.91,.15)],
  facet: [cut("discharge",.31,0,.93),cut("current",.24,.050)],
  snow: [cut("snowStep",.38),cut("shortSwish",.20,.039)],
  packSnow: [cut("snowPress",.43),cut("cloth",.16,.080,.94,.13)],
  hiss: [cut("airIntake",.45,0,1.23),cut("dogSnarl",.22,.04,1.12,.20)],
  regrow: [cut("gurgle",.38),cut("beastRoar",.46,.069,1.07,.27)],
  stoneGaze: [cut("bladeScrape",.27,0,.84),cut("rockBreak",.49,.096),cut("pebbles",.26,.136)],
  flutter: [cut("wingBeat",.44,0,1.43)],
  drain: [cut("suck",.39,0,1.04),cut("exhale",.20,.113)],
  burrow: [cut("gravel",.55,0,.78),cut("rockHit",.24,.055,.80)],
  breach: [cut("rockBreak",.66),cut("gravel",.52,.059),cut("beastRoar",.30,.096,.90)],
  squelch: [cut("squelch",.45),cut("slime",.17,.021,1.08)],
  slimeSplit: [cut("slime",.47),cut("wetPop",.40,.090,1.14)],
  fuseSlime: [cut("suck",.47,0,.90),cut("squelch",.29,.102)],
  pumpkinThrow: [cut("wideSwish",.40),cut("woodSnap",.19,.045,1.05,.12)],
  pumpkinLand: [cut("timberHit",.44),cut("wetPop",.34,.023),cut("woodKnock",.19,.125)],
  traveler: [cut("woodKnock",.39),cut("staffSwish",.23)],
  wolfClaw: [cut("shortSwish",.45),cut("dogSnarl",.45,.015)],
  bark: [cut("bark",.57),cut("barkHigh",.34,.065),cut("dogGrowl",.28,.110,.89)],
  splash: [cut("wideSwish",.31),cut("waterSlap",.60,.069,.92),cut("suck",.29,.147)],
  inhale: [cut("airIntake",.49,0,.73),cut("dogGrowl",.22,.017,.86)],
  fireBreath: [cut("exhale",.43,0,.76),cut("flame",.66,.053,.82),cut("beastRoar",.25,.091)],
  anvil: [cut("metalHit",.59,0,.80),cut("metalDrop",.39,.024,.82)],
  rivet: [cut("latch",.34),cut("hammer",.38,.071),cut("metalClip",.28,.108)],
  pigButt: [cut("oink",.49),cut("bodyHit",.32,.049)],
  charge: [cut(["shoutA","shoutB"],.64)],
  howl: [cut("howl",.56)],
  roar: [cut("roar",.67)],
  groan: [cut("groan",.48)],
  whisper: [cut("breath",.42)],
  squeal: [cut("pigCry",.49)],
  hit: [cut(["gruntA","yelpA","gruntB","yelpB"],.34)],
  beastHurt: [cut(["growl","whine"],.47)],
  birdHurt: [cut("cawShort",.43)],
  wood: [cut(["timberHit","woodKnock"],.42)],
  metal: [cut(["metalClip","metalHit"],.40)],
  keepFall: [cut("rockBreak",.66,0,.78),cut("gate",.48,.063),cut("gravel",.46,.127)],
  kindle: [cut("tinder",.39),cut("flame",.22,.074,1.06,.22)],
  venom: [cut("wetPop",.31,0,1.12),cut("gurgle",.24,.045)],
  // Leave room for the Meteor to land. The rush starts with the falling body.
  fall: [cut("wideSwish",.22,0,.63),cut("flame",.20,.191,.87)],
  impact: [cut("concussion",.93),cut("rockBreak",.52,.012),cut("gravel",.34,.102)],
  lightning: [cut("discharge",.74),cut("shell",.54,.022),cut("thunderRoll",.67,.072)],
  freeze: [cut("iceCrack",.56),cut("snowPress",.34,.017),cut("iceShards",.39,.066)],
  rain: [cut("rainBed",.48),cut("waterScatter",.23,.038,1.12)],
  gust: [cut("wideSwish",.49,0,.68),cut("wingBeat",.25,.102,.83)],
  fault: [cut("rockBreak",.63,0,.80),cut("thunderRoll",.45,.03),cut("gravel",.39,.084)],
  briar: [cut("woodSnap",.50),cut("splinters",.31,.091),cut("leather",.24,.121,.83)],
  mirror: [cut("glassTick",.43),cut("bladeScrape",.26,.018,.81,.19)],
  reflect: [cut("glassChip",.42),cut("reedSwish",.26,.022,1.13)],
  rage: [cut("exhale",.39,0,.78),cut("shoutA",.42,.070,.95)],
  portalOpen: [cut("airIntake",.52,0,.73),cut("suck",.39,.083,.84)],
  wormhole: [cut("shortSwish",.39,0,.86),cut("wetPop",.31,.068,.77),cut("reedSwish",.32,.107,1.12)],
  ready: [cut("latch",.29)],
  count: [cut("woodKnock",.30,0,.95,.11)],
  march: [cut("gate",.42),cut("boot",.27,.12),cut("heel",.21,.208)],
  victory: [cut("cloth",.35),cut("shoutB",.32,.083)],
  defeat: [cut("gate",.40,0,.72),cut("mail",.27,.075)],
  stalemate: [cut("boot",.27),cut("timberHit",.26,.112)],
} satisfies Record<Exclude<CueKind,"place"|"spellSet">,Sound>;

// A held spell gets a quiet sound in the hand; the field supplies its full effect on impact.
const preparations = {
  meteor: [cut("gravel",.27,0,1.08,.15)], rain: [cut("waterScatter",.25,0,1.12,.14)],
  gust: [cut("shortSwish",.28)], briar: [cut("leather",.29,0,1.1,.14)],
  mirror: [cut("glassTick",.26)], fault: [cut("rockHit",.27,0,.88,.14)],
  freeze: [cut("snowPress",.29,0,1.09,.15)], lightning: [cut("discharge",.25,0,1.08,.07)],
  rage: [cut("airIntake",.25,0,.93,.16)], wormhole: [cut("suck",.23,0,1.08,.16)],
} satisfies Record<SpellKind,Sound>;

const injuries: Partial<Record<UnitKind,Sound>> = {
  kirin:[cut("horseBreath",.39)], hydra:[cut("rasp",.39,0,1.18)], firedragon:[cut("beastRoar",.43,0,.82,.31)],
  kraken:[cut("waterSlap",.32),cut("gurgle",.27,.021)], rhinorider:[cut("snort",.42,0,.78)],
  sandworm:[cut("graveVoice",.36,0,.72),cut("gravel",.20,.025)], cerberus:[cut("dogSnarl",.43)],
  reaper:[cut("exhale",.36,0,.79)], zombie:[cut("rasp",.39,0,.87)], vampire:[cut("airIntake",.34,0,1.08)],
  horseman:[cut("horseBreath",.32,0,.82),cut("mail",.19,.023)], werewolf:[cut("dogGrowl",.42)],
  irongolem:[cut("metalHit",.44,0,.79)], drone:[cut("buckle",.30),cut("motor",.22,.018,.86,.14)],
  sunlens:[cut("glassChip",.38),cut("metalClip",.16,.016)], harpoon:[cut("chain",.38,0,.94)],
  prism:[cut("glassChip",.39,0,1.08)], snowman:[cut("snowPress",.37)], windmill:[cut("creak",.36)],
  trojanhorse:[cut("woodSnap",.37,0,.88)], pig:[cut("oink",.39)],
};

export function soundFor(cue: Cue): Sound | undefined {
  if(cue.kind==="place")return;
  if(cue.kind==="spellSet")return cue.spell && preparations[cue.spell];
  if(cue.kind==="punch" && cue.beat!==undefined)return flurry[cue.beat%flurry.length];
  if(cue.unit && injuries[cue.unit])return injuries[cue.unit];
  return combat[cue.kind];
}
