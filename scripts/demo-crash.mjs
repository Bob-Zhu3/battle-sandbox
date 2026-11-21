import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const headless = process.argv.includes("--headless");
const channel = existsSync(chromium.executablePath()) ? undefined : "chrome";
const ids = [1, 2, 3, 4, 5];
const paid = {ids, gold: 60, receipts: [[1, ids]]};
const empty = {ids: [], gold: 120, receipts: []};
const folder = await mkdtemp(join(tmpdir(), "battle-crash-"));
const browsers = [];
const servers = new Set();

function message(child, type) {
  return new Promise((resolve, reject) => {
    function finish(error, value) {
      clearTimeout(timer);
      child.off("message", receive).off("exit", exited).off("error", failed);
      if (error) reject(error); else resolve(value);
    }
    const receive = packet => { if (packet.type === type) finish(null, packet); };
    const exited = (code, signal) => finish(Error("Server exited before " + type + " (" + (signal ?? code) + ")"));
    const failed = error => finish(error);
    const timer = setTimeout(() => finish(Error("Timed out waiting for server " + type)), 20_000);
    child.on("message", receive).once("exit", exited).once("error", failed);
  });
}
async function start(file, port, match, fault) {
  const child = fork(new URL("./crash-server.mjs", import.meta.url), [file, String(port), match, fault],
    {windowsHide: true, stdio: ["ignore", "inherit", "inherit", "ipc"]});
  servers.add(child);
  const ready = await message(child, "listening");
  return {child, ...ready};
}
async function kill(child) {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    assert.ok(child.kill("SIGKILL"));
    await exited;
  }
  servers.delete(child);
}

async function player(browser, team, url, prepare) {
  const context = await browser.newContext({viewport: team === "red" ? {width: 960, height: 600} : {width: 610, height: 500}});
  const page = await context.newPage();
  const events = [];
  page.on("response", async response => {
    if (response.status() !== 200 || !response.url().includes("/api/matches/")) return;
    try { events.push(...(await response.json()).events); } catch { /* The process may die mid-request. */ }
  });
  await page.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype, clear = proto.clearRect, fill = proto.fillText;
    proto.clearRect = function (...args) {
      if (this.canvas.id === "arena") window.paintedIds = [];
      return clear.apply(this, args);
    };
    proto.fillText = function (label, ...args) {
      if (this.canvas.id === "arena" && /^#\d+$/.test(label)) window.paintedIds.push(Number(label.slice(1)));
      return fill.call(this, label, ...args);
    };
  });
  if (prepare) await prepare(page);
  await page.goto(url);
  await page.waitForFunction(team => document.querySelector(".game")?.dataset.team === team &&
    document.querySelector("#arena").dataset.deploying === "true" && document.querySelector("#gold-balance").textContent === "120", team);
  return {context, page, events};
}

async function caption(peers, stage, detail) {
  if (headless) return;
  await Promise.all(peers.map(({page}) => page.evaluate(([stage, detail]) => {
    let panel = document.getElementById("crash-caption");
    if (!panel) {
      panel = document.createElement("aside");
      panel.id = "crash-caption";
      panel.style.cssText = "position:fixed;z-index:5;top:22%;left:50%;transform:translateX(-50%);padding:6px 13px;background:#fff;color:#252e2a;border:1px solid #252e2a;border-radius:6px;text-align:center;pointer-events:none;font:600 14px system-ui;width:max-content;max-width:94vw";
      panel.append(document.createElement("strong"), document.createElement("br"), document.createElement("span"));
      document.body.append(panel);
    }
    panel.firstElementChild.textContent = stage;
    panel.lastElementChild.textContent = detail;
  }, [stage, detail])));
}

async function demo(fault) {
  const file = join(folder, fault + ".sqlite");
  const match = randomBytes(10).toString("hex");
  const original = await start(file, 0, match, fault);
  assert.equal(original.value, null);
  const url = "http://127.0.0.1:" + original.port + "/room/?match=" + match + "&ids=1";
  const retry = Promise.withResolvers();
  const attempts = [];
  const peers = [];
  console.log("\n" + (fault === "before" ? "1. Crash immediately BEFORE saving" : "2. Crash immediately AFTER saving, before replying"));
  try {
    const red = await player(browsers[0], "red", url, page => page.route("**/api/matches/duel/*", async route => {
      const command = route.request().postDataJSON()?.commands?.find(c => c.action?.type === "place-warriors");
      if (command) {
        attempts.push(command);
        // Let the new server report the on-disk state before the browser's own retry arrives.
        if (attempts.length > 1) await retry.promise;
      }
      await route.continue().catch(() => {});
    }));
    peers.push(red);
    peers.push(await player(browsers[1], "blue", url));
    const title = fault === "before" ? "Case 1 · Kill before the save" : "Case 2 · Kill after the save, before the reply";
    await caption(peers, title, "Red draws five Warriors at 12 gold each.");
    const box = await red.page.locator("#arena").boundingBox();
    await red.page.mouse.move(box.x + 200, box.y + box.height / 2);
    await red.page.mouse.down();
    await red.page.mouse.move(box.x + 296, box.y + box.height / 2, {steps: 8});
    if (!headless) await delay(700);
    const boundary = message(original.child, "boundary");
    await red.page.mouse.up();
    const stopped = await boundary;
    assert.equal(stopped.fault, fault);
    assert.equal(attempts[0].action.positions.length, 5);
    assert.equal(red.events.some(e => e.type === "placement-ack"), false);
    await kill(original.child);
    console.log("   Killed server PID " + stopped.pid + " before Red received a reply.");
    const restarted = await start(file, original.port, match, "off");
    assert.notEqual(restarted.pid, stopped.pid);
    assert.deepEqual(restarted.value, fault === "before" ? empty : paid);
    const disk = restarted.value;
    console.log("   Restarted PID " + restarted.pid + " from disk: Warriors [" + disk.ids + "], " + disk.gold + " gold, " + disk.receipts.length + " receipt(s).");
    await caption(peers, title, "Recovered from disk · " + disk.ids.length + " Warriors · " + disk.gold + " red gold · " + disk.receipts.length + " saved receipts");
    if (!headless) await delay(1700);
    retry.resolve();
    for (const [index, {page}] of peers.entries()) {
      await page.waitForFunction(gold => document.querySelector("#red-count").textContent === "5" &&
        document.querySelector("#gold-balance").textContent === gold &&
        window.paintedIds?.slice().sort((a,b) => a-b).join(",") === "1,2,3,4,5", index ? "120" : "60");
    }
    for (let i = 0; i < 100 && !red.events.some(e => e.type === "placement-ack"); i++) await delay(40);
    assert.ok(attempts.length >= 2, "The actual browser resent the purchase");
    for (const attempt of attempts.slice(1)) assert.deepEqual(attempt, attempts[0]);
    const ack = red.events.find(e => e.type === "placement-ack");
    assert.deepEqual(ack, {type:"placement-ack", round:attempts[0].round, commandId:attempts[0].commandId, unitIds:ids});
    for (const {events} of peers) {
      const snap = events.findLast(event => event.type === "snapshot" && event.world.units.length === 5);
      assert.ok(snap);
      assert.deepEqual(snap.world.units.map(u => [u.id, u.team, u.kind]), ids.map(id => [id,"red","warrior"]));
      assert.equal(snap.gold.red, 60);
    }
    const state = message(restarted.child, "state");
    restarted.child.send("inspect");
    assert.deepEqual((await state).value, paid);
    console.log("   PASS  Red automatically retried round " + ack.round + ", command " + ack.commandId +
      ". Both browsers drew Warriors 1–5. Red has 60 gold. One purchase receipt on disk.");
    await caption(peers, title, "Retry verified · Warrior IDs " + ack.unitIds.join(", ") + " · " + paid.gold + " red gold");
    if (!headless) await delay(2500);
  } finally {
    retry.resolve();
    await Promise.all(peers.map(peer => peer.context.close()));
    for (const child of [...servers]) await kill(child);
    for (const suffix of ["", "-shm", "-wal"]) await rm(file + suffix, {force: true});
  }
}

try {
  for (const [index, width] of [960, 610].entries()) browsers.push(await chromium.launch({channel, headless,
    args: ["--window-position=" + (index ? 955 : 0) + ",35", "--window-size=" + (width + 16) + ",690"]}));
  await demo("before");
  await demo("after");
  console.log("\nBoth crash boundaries passed.");
} finally {
  for (const child of [...servers]) await kill(child);
  await Promise.all(browsers.map(browser => browser.close()));
  await rmdir(folder);
}
