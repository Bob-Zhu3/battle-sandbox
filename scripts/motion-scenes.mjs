import assert from "node:assert/strict";
import { UNIT_DEFINITIONS as defs } from "../src/units.ts";

export async function playMotion({place,show,clear,hp}) {
  await place("Blue","Phoenix",429,184);
  await show(1100,"The Phoenix glides between wingbeats.");
  await place("Red","Shieldbearer",525,184);
  await show(1550,"Watch the talons extend and the wings open on the climb.");
  assert.ok(await hp("red") < defs.shieldbearer.maxHp);
  await clear();

  await place("Red","Lancer",389,184);
  await place("Blue","Cyclops",520,184);
  await show(1850,"The Lancer lowers its spear. The Cyclops plants a foot and swings.");
  assert.ok(await hp("blue") < defs.cyclops.maxHp);
  await clear();

  await place("Red","Musketeer",397,184);
  await place("Blue","Reaper",526,184);
  await show(1650,"The musket kicks and lowers to reload as the Reaper closes.");
  assert.ok(await hp("blue") < defs.reaper.maxHp);
  await clear();

  await place("Violet","Storm Kirin",393,184);
  await place("Blue","Frost Queen",523,184);
  await show(1650,"The Queen flicks her staff. The Kirin rears as lightning leaps.");
  assert.ok(await hp("blue") < defs.frostqueen.maxHp);
}
