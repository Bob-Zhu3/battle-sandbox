import type { Cue } from "../sound-events.ts";
import type { SpellKind } from "../spells.ts";
import { actions, damageAccents } from "./action-score.ts";
import { arrivals } from "./deployment-score.ts";
import { air, glass, hide, iron, note, stone, string, voice, wood, type Score } from "./foley.ts";

// With the clock stopped, acknowledge a cast in the hand. Its impact belongs to the field.
const spellSet = {
  meteor: [stone(0,164,.115,.63),air(.024,510,2130,.14,.60,27)],
  rain: [note(0,778,1320,.065,.57),note(.069,1110,1670,.08,.48)],
  gust: [air(0,530,2210,.155,.82),air(.095,1840,640,.086,.35)],
  briar: [wood(0,670,.060,.42),string(.032,207,.155,.74)],
  mirror: [glass(0,664,.17,.54),glass(.049,995,.15,.40)],
  fault: [stone(0,228,.089,.65),stone(.046,142,.11,.49),air(.06,748,272,.075,.37)],
  freeze: [glass(0,1990,.105,.50),air(.029,6100,3200,.14,.44,65)],
  lightning: [air(0,5900,1270,.041,.67),iron(.037,1530,.063,.41),note(.079,900,1850,.069,.40)],
  rage: [voice(0,117,197,.15,.66,"jaw"),hide(.077,173,.092,.41)],
  wormhole: [note(0,234,601,.16,.63),note(.073,601,319,.13,.41)],
} satisfies Record<SpellKind,Score>;

export function scoreForCue(cue: Cue): Score | undefined {
  if(cue.kind==="place" && cue.unit)return arrivals[cue.unit];
  if(cue.kind==="spellSet" && cue.spell)return spellSet[cue.spell];
  // Only damage and placement cues carry the struck unit's identity.
  if(cue.unit && damageAccents[cue.unit])return damageAccents[cue.unit];
  if(Object.hasOwn(actions,cue.kind))return actions[cue.kind as keyof typeof actions];
}
