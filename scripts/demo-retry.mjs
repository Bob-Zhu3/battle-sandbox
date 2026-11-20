import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { ROOM_SOCKET } from "../src/room-protocol.ts";

export async function runRetryDemo({ openPlayer, move, checkCanvas, capture, headed }) {
  const attempts = [], delivered = [], joins = [], redSnapshots = [];
  const allowRejoin = Promise.withResolvers();
  let dropped, held;
  let connections = 0;

  async function interceptRed(page) {
    await page.routeWebSocket(url => url.pathname === ROOM_SOCKET, route => {
      const connection = ++connections;
      const server = route.connectToServer();
      route.onMessage(async raw => {
        const message = JSON.parse(String(raw));
        if (connection === 2 && message.type === "join") await allowRejoin.promise;
        if (message.action?.type === "place-warriors") attempts.push({ connection, message });
        server.send(raw);
      });
      server.onMessage(async raw => {
        const event = JSON.parse(String(raw));
        if (event.type === "joined") joins.push(event);
        if (event.type === "snapshot") redSnapshots.push(event);
        if (event.type === "placement-ack") {
          if (!dropped) {
            // This is the real receipt from the server after it committed the stroke.
            dropped = event;
            const close = { code: 4010, reason: "Demo connection lost" };
            await Promise.all([server.close(close), route.close(close)]);
            return;
          }
          delivered.push(event);
        }
        route.send(raw);
      });
    });
  }

  const red = await openPlayer("red", 960, 600, 8, interceptRed);
  const blue = await openPlayer("blue", 600, 480, 992);
  const players = [red, blue];
  const ids = [1, 2, 3, 4, 5];
  const points = [120, 144, 168, 192, 216].map(y => ({ x: 312, y }));
  const expected = ids.map((id, i) => ({ id, team: "red", kind: "warrior", ...points[i] }));
  const units = frame => frame.world.units.map(({ id, team, kind, x, y }) => ({ id, team, kind, x, y }));
  const timeout = { timeout: 10_000 };
  await red.page.waitForFunction(() => document.querySelector("#blue-seat").textContent === "Drawing", null, timeout);
  console.log("1. Red draws one 96-unit stroke. Blue watches.");
  await red.page.getByRole("button", { name: "Warrior", exact: true }).click();
  await move(red, points[0].x, points[0].y);
  await red.page.mouse.down();
  for (const point of points.slice(1)) {
    await move(red, point.x, point.y);
    if (headed) await delay(170);
  }
  await capture(players, "Red draws a five-Warrior stroke", 650);
  await red.page.mouse.up();

  try {
    await blue.page.waitForFunction(() => document.querySelector("#red-seat").textContent === "Reconnecting" &&
      document.querySelector("#red-count").textContent === "5", null, timeout);
    await red.page.waitForFunction(() => document.querySelector("#match-state").textContent === "Reconnecting", null, timeout);
    held = blue.frames.at(-1);
    assert.deepEqual([held.round, held.phase, held.world.tick, held.seats.red.connected, held.seats.red.reserved], [1, "deploy", 0, false, true]);
    assert.deepEqual(units(held), expected);
    assert.deepEqual(attempts, [{ connection: 1, message: { round: 1, commandId: 1, action: { type: "place-warriors", positions: points } } }]);
    assert.deepEqual(dropped, { type: "placement-ack", round: 1, commandId: 1, unitIds: ids });
    assert.equal(delivered.length, 0);
    const pending = await red.page.evaluate(() => JSON.parse(sessionStorage.getItem("battle-room.session.v1")).pending);
    assert.deepEqual(pending, [attempts[0].message]);
    console.log("2. The server placed Warriors 1–5. Red's confirmation was dropped. Blue still shows all five.");
    await capture(players, "Red disconnected after the server accepted the five Warriors", 1600);
    if (headed) await delay(1400);
  } finally {
    // The game itself handles the reconnect and resends its saved command.
    allowRejoin.resolve();
  }

  await red.page.waitForFunction(() => document.querySelector("#arena").dataset.deploying === "true" &&
    JSON.parse(sessionStorage.getItem("battle-room.session.v1")).pending.length === 0, null, timeout);
  assert.equal(connections, 2);
  assert.deepEqual(joins.map(e => e.team), ["red", "red"]);
  assert.ok(joins[0].resumeToken === joins[1].resumeToken, "the returning tab must own the original seat");
  assert.deepEqual(attempts.map(a => a.connection), [1, 2]);
  assert.deepEqual(attempts[0].message, attempts[1].message);
  assert.deepEqual(delivered, [dropped]);
  console.log("3. Red reclaimed its seat and retried stroke 1. The server returned the same five IDs.");

  // With only Red ready the server publishes a fresh post-retry snapshot at tick zero.
  await red.page.getByRole("button", { name: "Ready", exact: true }).click();
  await Promise.all(players.map(p => p.page.waitForFunction(() => document.querySelector("#red-seat").textContent === "Ready" &&
    document.querySelector("#red-count").textContent === "5" && document.querySelector("#blue-count").textContent === "0", null, timeout)));
  const final = blue.frames.at(-1);
  assert.equal(blue.connections.length, 1);
  assert.deepEqual(redSnapshots.at(-1), final);
  assert.deepEqual(units(final), expected);
  assert.deepEqual([final.round, final.phase, final.world.tick], [1, "deploy", 0]);
  for (const stream of [redSnapshots, blue.frames]) {
    const firstSquad = stream.findIndex(f => f.world.units.length > 0);
    assert.ok(firstSquad >= 0);
    for (const frame of stream.slice(firstSquad)) {
      assert.deepEqual(units(frame), expected);
      assert.ok(frame.seats.blue.connected);
    }
  }
  const paintedIds = {};
  for (const p of players) {
    await checkCanvas(p, expected);
    paintedIds[p.team] = await p.page.evaluate(() => window.arenaLabels.map(label => Number(label.slice(1))));
    assert.deepEqual(paintedIds[p.team], ids);
    assert.deepEqual(p.errors, []);
  }
  await capture(players, "Both windows show the same five labeled Warriors", 2000);
  console.log("PASS  Red shows [1, 2, 3, 4, 5]. Blue shows [1, 2, 3, 4, 5]. Round 1, deployment, tick 0.");
  return { players, proof: {
    round: final.round, phase: final.phase, tick: final.world.tick,
    player: "red", commandId: dropped.commandId, strokeSends: attempts,
    joinedTeams: joins.map(event => event.team), droppedConfirmation: dropped, receivedConfirmations: delivered,
    observerIdsDuringDisconnect: held.world.units.map(unit => unit.id), observerConnections: blue.connections.length,
    viewports: players.map(({ team, width, height }) => ({ team, width, height })),
    bothCanvases: paintedIds, units: units(final),
  } };
}
