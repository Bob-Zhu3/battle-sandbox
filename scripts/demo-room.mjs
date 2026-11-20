import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { createGameServer } from "../server/http.ts";
import { ROOM_SOCKET } from "../src/room-protocol.ts";
import { ARENA } from "../src/simulation.ts";
import { runRetryDemo } from "./demo-retry.mjs";
import { runBattleReconnect } from "./demo-reconnect.mjs";

const { values } = parseArgs({ options: {
  headed: { type: "boolean" }, "keep-open": { type: "boolean" }, channel: { type: "string" },
  output: { type: "string" }, url: { type: "string" },
  retry: { type: "boolean" }, reconnect: { type: "boolean" }, headless: { type: "boolean" },
} });
const recoveryDemo = values.retry || values.reconnect;
const headed = !values.headless && (recoveryDemo || values.headed || values["keep-open"] || false);
const channel = values.channel ?? (existsSync(chromium.executablePath()) ? undefined : "chrome");
const output = values.output && resolve(values.output);
if (output) await mkdir(output, { recursive: true });
let ownedServer;
let url = values.url;
if (recoveryDemo && url) throw Error("The disconnect demos use their own empty room. Omit --url.");
if (!url) {
  if (!existsSync(new URL("../dist/index.html", import.meta.url))) throw Error("Run npm run build first.");
  ownedServer = createGameServer();
  ownedServer.http.listen(0, "127.0.0.1");
  await once(ownedServer.http, "listening");
  url = "http://127.0.0.1:" + ownedServer.http.address().port + "/room";
  if (recoveryDemo) url += "?ids=1";
}
const browsers = [], captures = [];
const teams = ["red", "blue"];

// Observe the actual arena labels. Keep combat paints by tick so differently sized
// windows can be compared at the same point even after the match has finished.
async function observeArenaLabels(page) {
  await page.addInitScript(() => {
    window.arenaLabels = [];
    window.battleLabels = {};
    const proto = CanvasRenderingContext2D.prototype;
    const clear = proto.clearRect, write = proto.fillText;
    proto.clearRect = function (...args) {
      if (this.canvas.id === "arena") window.arenaLabels = [];
      return clear.apply(this, args);
    };
    proto.fillText = function (label, ...args) {
      if (this.canvas.id === "arena" && /^#\d+/.test(label)) {
        window.arenaLabels.push(label);
        if (label.endsWith(" HP")) window.battleLabels[Number(document.getElementById("tick").textContent)] = window.arenaLabels;
      }
      return write.call(this, label, ...args);
    };
  });
}

async function openPlayer(team, width, height, left, prepare) {
  const args = headed ? ["--force-device-scale-factor=1", "--window-position=" + left + ",40", "--window-size=" + (width + 16) + "," + (height + 92)] : [];
  const browser = await chromium.launch({ channel, headless: !headed, args });
  browsers.push(browser);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const frames = [], errors = [], connections = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("websocket", socket => {
    if (new URL(socket.url()).pathname !== ROOM_SOCKET) return;
    connections.push(socket);
    socket.on("framereceived", ({ payload }) => {
      const event = JSON.parse(String(payload));
      if (event.type === "snapshot") frames.push(event);
      if (event.type === "error") errors.push(event.message);
    });
  });
  if (recoveryDemo) await observeArenaLabels(page);
  await prepare?.(page);
  await page.goto(url);
  await page.waitForFunction(team => document.querySelector(".game")?.dataset.team === team &&
    document.querySelector("#arena")?.dataset.deploying === "true", team);
  await page.evaluate(() => {
    // Observe real input from the two browser windows, without altering the game.
    window.roomDemoPresses = [];
    for (const type of ["pointerdown", "pointerup", "pointercancel"]) {
      document.querySelector("#arena").addEventListener(type, event => window.roomDemoPresses.push({
        type, trusted: event.isTrusted, time: performance.timeOrigin + performance.now(),
      }));
    }
  });
  const box = await page.locator("#arena").boundingBox();
  assert.equal(Math.round(box.width), width);
  assert.equal(Math.round(box.height), height);
  return { team, page, width, height, box, frames, errors, connections };
}

async function capture(players, caption, duration) {
  if (!output) return;
  const prefix = String(captures.length).padStart(3, "0");
  await Promise.all(players.map(p => p.page.screenshot({ path: join(output, prefix + "-" + p.team + ".png"), timeout: 5000 })));
  captures.push({ prefix, caption, duration });
}

function move(player, x, y) {
  const box = player.box;
  return player.page.mouse.move(box.x + x * box.width / ARENA.width, box.y + y * box.height / ARENA.height);
}

async function counts(players, n) {
  await Promise.all(players.map(p => p.page.waitForFunction(n =>
    ["red","blue"].every(team => Number(document.getElementById(team + "-count").textContent) === n), n)));
}

async function drawTogether(players, kind, xs, before) {
  const name = kind === "warrior" ? "Warrior" : "Archer";
  await Promise.all(players.map(p => p.page.getByRole("button", { name, exact: true }).click()));
  await Promise.all(players.map((p, i) => move(p, xs[i], 120)));
  await Promise.all(players.map(p => p.page.mouse.down()));
  for (const y of [144,168,192,216]) {
    await Promise.all(players.map((p, i) => move(p, xs[i], y)));
    await capture(players, "Both players draw " + name.toLowerCase() + " squads", 155);
  }
  // Both pointer gestures are still open. A new squad is private until release.
  assert.ok(players.every(p => p.frames.at(-1).world.units.length === before));
  if (kind === "archer") {
    // A committed opponent stroke arrives while Blue still holds its pointer.
    await players[0].page.mouse.up();
    await players[1].page.waitForFunction(() => document.querySelector("#red-count").textContent === "10");
    await players[1].page.mouse.up();
  } else await Promise.all(players.map(p => p.page.mouse.up()));
  await counts(players, before / 2 + 5);
  await capture(players, "Both windows show the committed squads", 850);
}

async function checkCanvas(player, units) {
  const missing = await player.page.locator("#arena").evaluate((canvas, { units, arena }) => {
    const ctx = canvas.getContext("2d");
    const sx = canvas.width / arena.width, sy = canvas.height / arena.height;
    return units.filter(unit => {
      const radius = Math.floor(8 * Math.min(sx, sy));
      const pixels = ctx.getImageData(Math.round(unit.x*sx) - radius, Math.round(unit.y*sy) - radius, 2*radius, 2*radius).data;
      let matches = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i+3] < 200) continue;
        const r = pixels[i], b = pixels[i+2];
        if (unit.team === "red" ? r > 1.7*b : b > 1.7*r) matches++;
      }
      return matches < 5;
    }).map(unit => unit.id);
  }, { units, arena: ARENA });
  assert.deepEqual(missing, [], player.team + " failed to paint these units at their projected coordinates");
}

async function runBattleDemo() {
  const red = await openPlayer("red", 960, 600, 8);
  const blue = await openPlayer("blue", 600, 480, 992);
  const players = [red, blue];
  await counts(players, 0);
  await capture(players, "Red and Blue join the same room", 650);
  await drawTogether(players, "warrior", [360,600], 0);
  await drawTogether(players, "archer", [288,672], 10);

  const deployed = red.frames.at(-1);
  assert.deepEqual(deployed, blue.frames.at(-1));
  const units = deployed.world.units.map(({id,team,kind,x,y}) => ({id,team,kind,x,y}));
  assert.equal(new Set(units.map(u => u.id)).size, 20);
  for (const [index, team] of teams.entries()) {
    for (const [kind, xs] of [["warrior",[360,600]],["archer",[288,672]]]) {
      assert.deepEqual(units.filter(u => u.team === team && u.kind === kind).map(u => [u.x,u.y]),
        [120,144,168,192,216].map(y => [xs[index],y]));
    }
  }
  await Promise.all(players.map(p => checkCanvas(p, units)));
  const presses = await Promise.all(players.map(p => p.page.evaluate(() => window.roomDemoPresses)));
  for (const events of presses) {
    assert.deepEqual(events.map(e => e.type), ["pointerdown","pointerup","pointerdown","pointerup"]);
    assert.ok(events.every(e => e.trusted));
  }
  const overlapMs = [0,2].map(i => Math.round(Math.min(...presses.map(p => p[i+1].time)) - Math.max(...presses.map(p => p[i].time))));
  assert.ok(overlapMs.every(ms => ms > 0), "the two real pointer gestures must overlap");

  await red.page.getByRole("button", { name: "Ready", exact: true }).click();
  await blue.page.waitForFunction(() => document.querySelector("#red-seat").textContent === "Ready");
  assert.equal(blue.frames.at(-1).phase, "deploy");
  assert.equal(blue.frames.at(-1).world.tick, 0);
  await capture(players, "Red is ready. Blue is still deploying.", 800);
  await blue.page.getByRole("button", { name: "Ready", exact: true }).click();
  await red.page.locator("#countdown").waitFor({ state: "visible" });
  await red.page.waitForFunction(() => Number(document.querySelector("#tick").textContent) >= 240);
  assert.deepEqual([...new Set(red.frames.filter(f => f.phase === "countdown").map(f => f.countdown))], [3, 2, 1]);
  const beforeRecruitment = red.frames.at(-1);
  const reinforcements = Math.min(5, Math.floor(beforeRecruitment.gold.red / 12));
  assert.ok(reinforcements >= 3);
  await red.page.getByRole("button", { name: "Warrior", exact: true }).click();
  await move(red, 460, 106);
  await red.page.mouse.down();
  await move(red, 460, 108 + 24 * (reinforcements - 1));
  await red.page.mouse.up();
  for (let i = 0; output && !red.frames.some(f => f.phase === "finished") && i < 75; i++) {
    await capture(players, "Both browsers receive the server's battle", 100);
    await delay(35);
  }
  await Promise.all(players.map(p => p.page.waitForFunction(() => document.querySelector("#match-state").textContent === "Finished", null, { timeout: 25_000 })));
  await capture(players, "Both browsers receive the same final tick", 900);
  const shared = p => p.frames.filter(f => f.revision >= deployed.revision);
  assert.deepEqual(shared(red), shared(blue));
  assert.ok(shared(red).some(f => f.phase === "running" && f.world.arrows.length));
  assert.deepEqual(players.flatMap(p => p.errors), []);
  const end = red.frames.at(-1);
  assert.equal(end.world.units.length, units.length + reinforcements);
  assert.ok(end.world.bases.filter(base => base.hp > 0).length <= 1);
  const proof = {
    reinforcements, bases: end.world.bases.map(({ team, hp }) => ({ team, hp })), gold: end.gold,
    viewports: players.map(({team,width,height}) => ({team,width,height})),
    gestureOverlapMs: { warrior: overlapMs[0], archer: overlapMs[1] },
    deploymentRevision: deployed.revision, units, paintedInBothCanvases: units.length,
    identicalSnapshotsCompared: shared(red).length, finalTick: end.world.tick, outcome: end.outcome,
  };
  if (output) {
    await writeFile(join(output,"room-proof.json"), JSON.stringify(proof,null,2) + "\n");
    await writeFile(join(output,"frames.json"), JSON.stringify(captures));
  }
  console.log("Verified both windows:", JSON.stringify({ ...proof, units: units.length }));
  if (values["keep-open"]) {
    await red.page.getByRole("button", { name: "New round" }).click();
    await counts(players, 0);
    assert.deepEqual(red.frames.at(-1).world, { tick: 0, units: [], arrows: [], bases: deployed.world.bases });
    assert.deepEqual(red.frames.at(-1), blue.frames.at(-1));
    console.log("Both windows are open on a fresh round at " + url);
    await Promise.all(players.map(p => p.page.waitForEvent("close", { timeout: 0 })));
  }
}

try {
  if (recoveryDemo) {
    const demo = values.reconnect ? runBattleReconnect : runRetryDemo;
    const { players, proof } = await demo({ openPlayer, move, checkCanvas, capture, headed });
    if (output) {
      const filename = values.reconnect ? "battle-reconnect-proof.json" : "retry-proof.json";
      await writeFile(join(output, filename), JSON.stringify(proof, null, 2) + "\n");
      await writeFile(join(output, "frames.json"), JSON.stringify(captures));
    }
    if (headed) {
      console.log("Close either demo window to finish.");
      await Promise.race(players.map(({ page }) => page.waitForEvent("close", { timeout: 0 })));
    }
  } else await runBattleDemo();
} finally {
  await Promise.all(browsers.map(b => b.close()));
  if (ownedServer) {
    ownedServer.closeRoom();
    await new Promise(resolve => ownedServer.http.close(resolve));
  }
}
