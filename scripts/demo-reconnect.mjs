import assert from "node:assert/strict";
import { UNIT_DEFINITIONS } from "../src/units.ts";
import { ROOM_SOCKET } from "../src/room-protocol.ts";

function warriors(frame) {
  return frame.world.units.map(({ id, team, hp }) => ({ id, team, hp }));
}

function checkHealth(frame, hp) {
  assert.deepEqual(warriors(frame).slice(0, 2), [{ id: 1, team: "red", hp }, { id: 2, team: "blue", hp }]);
}

export async function runBattleReconnect({ openPlayer, move, capture }) {
  const links = [];
  const allowRejoin = Promise.withResolvers();
  let disconnect;
  async function interceptBlue(page) {
    await page.routeWebSocket(url => url.pathname === ROOM_SOCKET, route => {
      const upstream = route.connectToServer();
      const link = { frames: [] };
      links.push(link);
      if (links.length === 1) {
        disconnect = () => {
          const close = { code: 4010, reason: "Battle demo disconnect" };
          return Promise.all([upstream.close(close), route.close(close)]);
        };
      } else {
        route.onMessage(async raw => {
          if (JSON.parse(String(raw)).type === "join") await allowRejoin.promise;
          upstream.send(raw);
        });
      }
      upstream.onMessage(raw => {
        const event = JSON.parse(String(raw));
        if (event.type === "joined") link.seat = event;
        if (event.type === "snapshot") link.frames.push(event);
        route.send(raw);
      });
    });
  }

  const red = await openPlayer("red", 960, 600, 8);
  const blue = await openPlayer("blue", 600, 480, 992, interceptBlue);
  const players = [red, blue];
  const wait = { timeout: 16_000, polling: 10 };
  for (const [player, x] of [[red, 325], [blue, 640]]) {
    await move(player, x, 180);
    await player.page.mouse.down();
    await player.page.mouse.up();
    await red.page.waitForFunction(team => document.getElementById(team + "-count").textContent === "1", player.team, wait);
  }
  const deployed = red.frames.at(-1);
  const warrior = UNIT_DEFINITIONS.warrior;
  const afterFirst = warrior.maxHp - warrior.damage, afterSecond = afterFirst - warrior.damage;
  const labelsAt = hp => [1,2].map(id => "#"+id+" · "+hp+" HP");
  checkHealth(deployed, warrior.maxHp);
  await capture(players, "One Warrior on each team", 900);
  await red.page.getByRole("button", { name: "Ready", exact: true }).click();
  await blue.page.getByRole("button", { name: "Ready", exact: true }).click();
  console.log(`Red and Blue start a duel with ${warrior.maxHp} HP each.`);

  // Disconnect only after Blue's canvas has actually drawn the first damage.
  await blue.page.waitForFunction(labels => window.arenaLabels.join("|") === labels, labelsAt(afterFirst).join("|"), wait);
  const firstHit = links[0].frames.find(f => f.world.units.some(u => u.lastHitTick !== null));
  assert.equal(firstHit.world.tick, 90);
  checkHealth(firstHit, afterFirst);
  const wipeTick = firstHit.world.tick + (Math.ceil(warrior.maxHp/warrior.damage)-1)*warrior.cooldownTicks;
  await disconnect();
  console.log(`Tick ${firstHit.world.tick}   Both Warriors have ${afterFirst} HP. Blue loses its connection.`);

  async function observeMissedHit() {
    await red.page.waitForFunction(labels => document.getElementById("blue-seat").textContent === "Reconnecting" &&
      !document.getElementById("blue-seat").hidden && window.arenaLabels.join("|") === labels, labelsAt(afterSecond).join("|"), wait);
    const missedHit = red.frames.find(f => f.phase === "running" && f.seats.blue.reserved && f.world.units[0].hp === afterSecond);
    assert.deepEqual([missedHit.world.tick, missedHit.seats.blue.connected, missedHit.seats.red.connected], [120, false, true]);
    checkHealth(missedHit, afterSecond);
    const frozen = await blue.page.evaluate(() => ({
      state: document.getElementById("match-state").textContent, tick: Number(document.getElementById("tick").textContent),
      labels: window.arenaLabels,
    }));
    assert.equal(frozen.state, "Reconnecting");
    assert.ok(frozen.tick >= firstHit.world.tick && frozen.tick < missedHit.world.tick);
    assert.deepEqual(frozen.labels, labelsAt(afterFirst));
    console.log(`Tick ${missedHit.world.tick}  Red sees both at ${afterSecond} HP. Disconnected Blue still shows ${afterFirst} HP.`);
    return { missedHit, frozen };
  }
  const outage = observeMissedHit();
  const [{ missedHit, frozen }] = await Promise.all([
    outage.then(async observation => {
      // Keep the two readings visible for 12 more simulation ticks. Capturing the
      // windows can take longer, so it must never hold up the actual reconnect.
      await red.page.waitForFunction(tick => Number(document.getElementById("tick").textContent) >= tick,
        observation.missedHit.world.tick + 12, wait);
      return observation;
    }).finally(() => allowRejoin.resolve()),
    outage.then(() => capture(players, `Red shows ${afterSecond} HP while disconnected Blue still shows ${afterFirst} HP`, 1900)),
  ]);

  await blue.page.waitForFunction(expected => Object.values(window.battleLabels).some(labels =>
    labels.join("|") === expected), labelsAt(afterSecond).join("|"), wait);
  assert.equal(red.connections.length, 1);
  assert.equal(links.length, 2);
  const [original, returned] = links;
  assert.deepEqual([original.seat.team, returned.seat.team], ["blue", "blue"]);
  assert.ok(original.seat.resumeToken === returned.seat.resumeToken, "Blue must reclaim the original player's seat");
  const caughtUp = returned.frames[0];
  assert.equal(caughtUp.round, deployed.round);
  assert.equal(caughtUp.phase, "running");
  assert.deepEqual(caughtUp.seats.blue, { connected: true, reserved: false, ready: true });
  assert.ok(caughtUp.world.tick >= missedHit.world.tick && caughtUp.world.tick < missedHit.world.tick + warrior.cooldownTicks);
  checkHealth(caughtUp, afterSecond);
  console.log("Tick " + caughtUp.world.tick + `  Blue rejoins its team with #1 and #2 at ${afterSecond} HP each.`);
  await capture(players, "Blue has rejoined the same battle", 1200);

  await red.page.waitForFunction(() => window.arenaLabels.join("|") === "#1 · 0 HP|#2 · 0 HP" &&
    document.getElementById("match-state").textContent === "Live", null, wait);
  const wipe = red.frames.find(f => f.world.tick === wipeTick);
  checkHealth(wipe, 0);
  assert.equal(wipe.phase, "running");
  assert.deepEqual(wipe.world.bases.map(base => base.hp), [160, 160]);
  console.log(`Tick ${wipeTick}  Both Warriors fall. Both bases stand. Red recruits five reinforcements.`);
  await move(red, 460, 132);
  await red.page.mouse.down();
  await red.page.waitForFunction(() => window.arenaLabels.length === 3, null, wait);
  await move(red, 460, 230);
  await red.page.mouse.up();

  await Promise.all(players.map(p => p.page.waitForFunction(() => !document.getElementById("result").hidden &&
    document.getElementById("match-state").textContent === "Finished", null, wait)));
  const shared = red.frames.filter(f => f.revision >= caughtUp.revision);
  assert.deepEqual(returned.frames, shared);
  const end = shared.at(-1);
  assert.deepEqual([end.round, end.phase, end.outcome], [deployed.round, "finished", "red"]);
  assert.deepEqual(end.world.units.map(u => u.id), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(end.world.bases.map(b => b.hp), [160, 0]);
  checkHealth(end, 0);
  const views = {};
  for (const player of players) {
    const { paints, ...view } = await player.page.evaluate(() => ({
      paints: window.battleLabels, team: document.querySelector(".game").dataset.team,
      labels: window.arenaLabels, hp: ["red","blue"].map(side => Number(document.getElementById(side + "-hp").textContent)),
      result: document.getElementById("result-title").textContent, detail: document.getElementById("result-detail").textContent,
    }));
    // Compare the labels each canvas drew at every shared tick, including death.
    const byTick = new Map([firstHit, ...shared].map(frame => [frame.world.tick, frame]));
    for (const [tick, frame] of byTick) {
      assert.deepEqual(paints[tick], frame.world.units.map(u => "#" + u.id + " · " + u.hp + " HP"));
    }
    assert.deepEqual(view, { team: player.team, labels: end.world.units.map(u => "#" + u.id + " · " + u.hp + " HP"),
      hp: ["red", "blue"].map(side => end.world.units.filter(u => u.team === side).reduce((sum, u) => sum + u.hp, 0)),
      result: "Red wins", detail: "Battle ended on tick " + end.world.tick + "." });
    assert.equal(Number(await player.page.locator("#gold-balance").textContent()), end.gold[player.team]);
    assert.ok(await player.page.evaluate(() => {
      const top = document.getElementById("result").getBoundingClientRect().top;
      return [...document.querySelectorAll(".pennant")].every(flag => flag.getBoundingClientRect().bottom < top);
    }), player.team + " must be able to read the result below the score flags");
    assert.deepEqual(player.errors, []);
    views[player.team] = view;
  }
  console.log("PASS      Both windows agree on seven IDs, HP, gold and the fall of the Blue base on tick " + end.world.tick + ".");
  await capture(players, "Both browsers show the same Warriors, HP and winning base", 2000);
  const checkpoint = frame => ({ tick: frame.world.tick, revision: frame.revision, units: warriors(frame) });
  return { players, proof: {
    round: deployed.round, firstHit: checkpoint(firstHit), whileDisconnected: { red: checkpoint(missedHit), blue: frozen },
    returnedTeam: returned.seat.team, caughtUp: checkpoint(caughtUp), identicalSnapshots: shared.length,
    final: { ...checkpoint(end), bases: end.world.bases, gold: end.gold, outcome: end.outcome }, views,
  } };
}
