import assert from "node:assert/strict";
import { UNIT_DEFINITIONS as defs } from "../src/units.ts";

export async function playSiege({place,show,clear,hp}) {
  await place("Red","Bell Tower",420,177);
  await place("Blue","Watchpost",544,177);
  await place("Red","Mirror Ward",420,177);
  await show(850,"A Watchpost fires into the Mirror Ward.");
  assert.equal(await hp("red"),defs.belltower.maxHp);
  assert.equal(await hp("blue"),defs.post.maxHp-6);
  await show(2150,"Each returning bolt costs one glass pane.");
  assert.equal(await hp("blue"),defs.post.maxHp-18);
  await clear();

  await place("Red","Stone Lobber",370,178);
  await place("Red","Bell Tower",453,185);
  await place("Blue","Lancer",565,167);
  await place("Blue","Lancer",566,192);
  await place("Red","Vines",537,180);
  await show(1250,"Vines hold the Lancers under the falling stone.");
  assert.equal(await hp("blue"),2*(defs.lancer.maxHp-defs.lobber.damage));
  await show(1250,"The bell rings as they reach the front line.");
  assert.ok(await hp("blue")<=2*(defs.lancer.maxHp-defs.lobber.damage-defs.belltower.damage));
  await clear();

  await place("Red","Sun Lens",418,179);
  await place("Blue","Bell Tower",550,179);
  await show(1550,"The Sun Lens heats up on a single target.");
  const scorched=await hp("blue");
  assert.equal(scorched,defs.belltower.maxHp-28);
  await place("Blue","Healing Rain",418,179);
  await show(400,"Healing Rain fogs the glass and breaks its focus.");
  const fogged=await hp("blue");
  assert.ok(fogged===scorched || fogged===scorched-defs.sunlens.fullDamage);
  await show(1350,"The bell is safe while the glass is clouded.");
  assert.equal(await hp("blue"),fogged);
  await show(550,"The glass clears. The first beam is weak again.");
  assert.equal(await hp("blue"),fogged-defs.sunlens.damage);
  await clear();

  await place("Blue","Watchpost",527,203);
  await place("Blue","Miner",375,176);
  await show(900,"Follow the dirt ridge toward the Miner's flag.");
  await place("Red","Fault Line",531,176);
  await show(550,"The first tremor brings the Miner up early.");
  assert.equal(await hp("blue"),defs.miner.maxHp+defs.post.maxHp-15);
  await show(850,"An aftershock hits the exposed Miner and Watchpost.");
  assert.equal(await hp("blue"),defs.miner.maxHp+defs.post.maxHp-30);
}
