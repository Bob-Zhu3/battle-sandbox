import { chromium } from "playwright";
import { build, preview } from "vite";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { crowdFormation } from "../src/crowd-formation.ts";

const {values} = parseArgs({options: {
  root: {type: "string", default: "."}, dpr: {type: "string", default: "1"},
  headed: {type: "boolean"}, profile: {type: "boolean"}, "sim-only": {type: "boolean"},
}});
const counts = [80, 200];
const samples = 3;
const viewport = { width: 1280, height: 720 };
const deviceScaleFactor = Number(values.dpr);
if (!Number.isFinite(deviceScaleFactor) || deviceScaleFactor <= 0) throw Error("DPR must be a positive number.");
const output = await mkdtemp(join(tmpdir(), "battle-crowd-build-"));
const root = resolve(values.root);
const profile = values.profile;
const simulationOnly = values["sim-only"];
const formations = Object.fromEntries(counts.map(count => [count, crowdFormation(count)]));
const expected = {
  80: "36e31553e2b06b2248c2c055c89a67f0abb801ef8c679b91f8a42c5357a349ce",
  200: "e4a56e810ac2ed97e00131c8d3995d0f0d01eab5722b1ef682fa4447856c5628",
};

// This hook is compiled into a temporary copy only. It seeds the normal playground and
// times its own RAF loop, real simulation steps and draw calls without extra pixel reads.
function instrument(play, definitions, armies) {
  const advance = play.advance.bind(play);
  let run;
  play.advance = () => {
    const begin = performance.now();
    const result = advance();
    if (run) {
      const tick = play.world.tick;
      if (tick > 32 && tick <= 152) run.sim.push(performance.now() - begin);
      if (tick === 152) run.final = play.world;
    }
    return result;
  };
  window.measureCrowdDraw = ms => {
    if (run && play.world.tick > 32 && play.world.tick <= 152) run.draw.push(ms);
  };
  window.runCrowd = async count => {
    play.clear();
    for (const {team, kind, x, y} of armies[count]) {
      play.place(team, {type: definitions[kind].command, positions: [{x, y}]});
    }
    const sample = { sim: [], draw: [], raf: [], final: null };
    run = sample;
    await new Promise(resolveSample => {
      let previous;
      function observe(timestamp) {
        if (previous !== undefined && play.world.tick > 32 && play.world.tick <= 152)
          sample.raf.push(timestamp - previous);
        previous = timestamp;
        if (play.world.tick >= 152) { run = undefined; resolveSample(); }
        else requestAnimationFrame(observe);
      }
      requestAnimationFrame(observe);
    });
    const { units, arrows, spells, effects, tick } = sample.final;
    const bytes = new TextEncoder().encode(JSON.stringify({tick, units, arrows, spells, effects}));
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return { sim: sample.sim, draw: sample.draw, raf: sample.raf,
      alive: units.filter(u => u.hp > 0).length,
      hash: Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("") };
  };
}
const benchPlugin = {
  name: "crowd-measurement",
  enforce: "pre",
  transform(code, id) {
    const path = id.replaceAll("\\", "/");
    if (path.endsWith("/src/main.ts"))
      return code + "\n(" + instrument.toString() + ")(play, UNIT_DEFINITIONS, " + JSON.stringify(formations) + ");";
    if (path.endsWith("/src/renderer.ts")) {
      if (!code.includes("export function drawArena(")) throw Error("Arena draw entry point changed");
      return code.replace("export function drawArena(", "function drawMeasuredArena(") + `
export function drawArena(...args: Parameters<typeof drawMeasuredArena>) {
  const start = performance.now();
  ${simulationOnly ? "" : "drawMeasuredArena(...args);"}
  window.measureCrowdDraw?.(performance.now() - start);
}`;
    }
  },
};

function stats(values) {
  const sort = [...values].sort((a, b) => a - b);
  const percentile = p => Number(sort[Math.ceil(sort.length * p) - 1].toFixed(2));
  return {p50: percentile(.5), p95: percentile(.95)};
}

let browser, server;
try {
  await build({root, configFile: false, logLevel: "error", plugins: [benchPlugin],
    build: {outDir: output, emptyOutDir: true, minify: !profile}});
  server = await preview({root, configFile: false, logLevel: "error", build: {outDir: output},
    preview: {host: "127.0.0.1", port: 0}});
  const address = server.httpServer.address();
  const headless = !values.headed;
  browser = await chromium.launch({headless, channel: existsSync(chromium.executablePath()) ? undefined : "chrome"});
  const page = await browser.newPage({viewport, deviceScaleFactor});
  await page.addInitScript(() => localStorage.setItem("battle.sound.muted", "true"));
  await page.goto("http://127.0.0.1:" + address.port + "/");
  await page.waitForFunction(() => typeof window.runCrowd === "function");
  const infoSession = await browser.newBrowserCDPSession();
  const {gpu} = await infoSession.send("SystemInfo.getInfo");
  console.log("Graphics:", gpu.auxAttributes?.glRenderer || gpu.devices[0]?.deviceString || "unreported", headless ? "(headless)" : "(headed)");
  await infoSession.detach();
  console.log("Chromium", browser.version(), "1280x720 DPR " + deviceScaleFactor + ", muted; measures ticks 33–152, " + samples + " runs per size after one warm-up.");
  for (const count of counts) {
    await page.evaluate(n => window.runCrowd(n), count);
    const runs = [];
    for (let i = 0; i < samples; i++) runs.push(await page.evaluate(n => window.runCrowd(n), count));
    if (runs.some(r => r.hash !== expected[count])) throw Error("World at tick 152 differs from the reference for " + count + " troops: " + runs[0].hash);
    const intervals = runs.flatMap(r => r.raf);
    const elapsed = intervals.reduce((a,b) => a+b, 0);
    const slow = intervals.filter(dt => dt > 25).length;
    console.log(JSON.stringify({troops: count, draw: !simulationOnly, aliveAt152: runs[0].alive, hash: runs[0].hash,
      measuredFrames: intervals.length, fps: Number((1000*intervals.length/elapsed).toFixed(1)),
      rafMs: stats(intervals), framesOver25ms: slow, framePercentOver25ms: Number((100*slow/intervals.length).toFixed(1)),
      simMs: stats(runs.flatMap(r => r.sim)), canvasSubmitMs: stats(runs.flatMap(r => r.draw))}));
  }
  if (profile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", {interval: 500});
    await cdp.send("Profiler.start");
    await page.evaluate(() => window.runCrowd(200));
    const {profile: cpu} = await cdp.send("Profiler.stop");
    const busy = cpu.nodes.filter(n => n.hitCount && n.callFrame.functionName !== "(idle)")
      .sort((a,b) => b.hitCount-a.hitCount).slice(0, 25);
    console.log("CPU samples",busy.map(n => [n.callFrame.functionName, n.hitCount, n.callFrame.lineNumber]).map(row=>row.join(" ")).join("\n"));
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolveClose => server.httpServer.close(resolveClose));
  if (dirname(resolve(output)) === resolve(tmpdir()) && output.startsWith(join(tmpdir(), "battle-crowd-build-")))
    await rm(output, {recursive: true, force: true});
}

