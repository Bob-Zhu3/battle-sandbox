import assert from "node:assert/strict";
import { ROOM_SOCKET } from "../src/room-protocol.ts";

function warriors(frame) {
  return frame.world.units.map(({ id, team, hp }) => ({ id, team, hp }));
}

function checkHealth(frame, hp) {
  assert.deepEqual(warriors(frame), [{ id: 1, team: "red", hp }, { id: 2, team: "blue", hp }]);
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
  const wait = { timeout: 8000, polling: 10 };
  for (const [player, x] of [[red, 325], [blue, 640]]) {
    await move(player, x, 180);
    await player.page.mouse.down();
    await player.page.mouse.up();
    await red.page.waitForFunction(team => document.getElementById(team + "-count").textContent === "1", player.team, wait);
  }
  const deployed = red.frames.at(-1);
  checkHealth(deployed, 30);
  await capture(players, "One Warrior on each team", 900);
  await red.page.getByRole("button", { name: "Ready", exact: true }).click();
  await blue.page.getByRole("button", { name: "Ready", exact: true }).click();
  console.log("Red and Blue start a duel with 30 HP each.");

  // Disconnect only after Blue's canvas has actually drawn the first damage.
  await blue.page.waitForFunction(() => window.arenaLabels.join("|") === "#1 · 20 HP|#2 · 20 HP", null, wait);
  const firstHit = links[0].frames.find(f => f.world.units.some(u => u.lastHitTick !== null));
  assert.equal(firstHit.world.tick, 90);
  checkHealth(firstHit, 20);
  await disconnect();
  console.log("Tick 90   Both Warriors have 20 HP. Blue loses its connection.");

  async function observeMissedHit() {
    await red.page.waitForFunction(() => document.getElementById("blue-seat").textContent === "Reconnecting" &&
      !document.getElementById("blue-seat").hidden && window.arenaLabels.join("|") === "#1 · 10 HP|#2 · 10 HP", null, wait);
    const missedHit = red.frames.find(f => f.phase === "running" && f.seats.blue.reserved && f.world.units[0].hp === 10);
    assert.deepEqual([missedHit.world.tick, missedHit.seats.blue.connected, missedHit.seats.red.connected], [120, false, true]);
    checkHealth(missedHit, 10);
    const frozen = await blue.page.evaluate(() => ({
      state: document.getElementById("match-state").textContent, tick: Number(document.getElementById("tick").textContent),
      labels: window.arenaLabels,
    }));
    assert.equal(frozen.state, "Reconnecting");
    assert.ok(frozen.tick >= firstHit.world.tick && frozen.tick < missedHit.world.tick);
    assert.deepEqual(frozen.labels, ["#1 · 20 HP", "#2 · 20 HP"]);
    console.log("Tick 120  Red sees both at 10 HP. Disconnected Blue still shows 20 HP.");
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
    outage.then(() => capture(players, "Red shows 10 HP while disconnected Blue still shows 20 HP", 1900)),
  ]);

  await blue.page.waitForFunction(() => Object.values(window.battleLabels).some(labels =>
    labels.join("|") === "#1 · 10 HP|#2 · 10 HP"), null, wait);
  assert.equal(red.connections.length, 1);
  assert.equal(links.length, 2);
  const [original, returned] = links;
  assert.deepEqual([original.seat.team, returned.seat.team], ["blue", "blue"]);
  assert.ok(original.seat.resumeToken === returned.seat.resumeToken, "Blue must reclaim the original player's seat");
  const caughtUp = returned.frames[0];
  assert.equal(caughtUp.round, deployed.round);
  assert.equal(caughtUp.phase, "running");
  assert.deepEqual(caughtUp.seats.blue, { connected: true, reserved: false, ready: true });
  assert.ok(caughtUp.world.tick >= missedHit.world.tick && caughtUp.world.tick < 150);
  checkHealth(caughtUp, 10);
  console.log("Tick " + caughtUp.world.tick + "  Blue rejoins its team with #1 and #2 at 10 HP each.");
  await capture(players, "Blue has rejoined the same battle", 1200);

  await Promise.all(players.map(p => p.page.waitForFunction(() => !document.getElementById("result").hidden &&
    document.getElementById("match-state").textContent === "Finished", null, wait)));
  const shared = red.frames.filter(f => f.revision >= caughtUp.revision);
  assert.deepEqual(returned.frames, shared);
  const end = shared.at(-1);
  assert.deepEqual([end.round, end.phase, end.world.tick, end.outcome], [deployed.round, "finished", 150, "draw"]);
  checkHealth(end, 0);
  const views = {};
  for (const player of players) {
    const { paints, ...view } = await player.page.evaluate(() => ({
      paints: window.battleLabels, team: document.querySelector(".game").dataset.team,
      labels: window.arenaLabels, hp: ["red","blue"].map(side => Number(document.getElementById(side + "-hp").textContent)),
      result: document.getElementById("result-title").textContent, detail: document.getElementById("result-detail").textContent,
    }));
    // Compare the labels each canvas drew at every shared tick, including death.
    for (const frame of [firstHit, ...shared]) {
      assert.deepEqual(paints[frame.world.tick], frame.world.units.map(u => "#" + u.id + " · " + u.hp + " HP"));
    }
    assert.deepEqual(view, { team: player.team, labels: ["#1 · 0 HP", "#2 · 0 HP"], hp: [0, 0], result: "Draw", detail: "Battle ended on tick 150." });
    assert.ok(await player.page.evaluate(() => {
      const top = document.getElementById("result").getBoundingClientRect().top;
      return [...document.querySelectorAll(".pennant")].every(flag => flag.getBoundingClientRect().bottom < top);
    }), player.team + " must be able to read the result below the score flags");
    assert.deepEqual(player.errors, []);
    views[player.team] = view;
  }
  console.log("PASS      Both windows show #1 and #2 at 0 HP and a draw on tick 150.");
  await capture(players, "Both browsers show the same Warriors, HP and final draw", 2000);
  const checkpoint = frame => ({ tick: frame.world.tick, revision: frame.revision, units: warriors(frame) });
  return { players, proof: {
    round: deployed.round, firstHit: checkpoint(firstHit), whileDisconnected: { red: checkpoint(missedHit), blue: frozen },
    returnedTeam: returned.seat.team, caughtUp: checkpoint(caughtUp), identicalSnapshots: shared.length,
    final: { ...checkpoint(end), outcome: end.outcome }, views,
  } };
}
