import assert from "node:assert/strict";

export async function checkPausedPlacement(browser, url) {
  for (const touch of [false, true]) {
    const page = await browser.newPage({viewport: touch ? {width:390,height:700} : {width:960,height:540},
      isMobile:touch, hasTouch:touch});
    try {
      await page.addInitScript(() => {
        window.speakers = [];
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (...args) {
          const result = connect.apply(this, args);
          if (args[0] === this.context.destination) {
            const meter = this.context.createAnalyser();
            meter.fftSize = 512;
            connect.call(this, meter);
            window.speakers.push(meter);
          }
          return result;
        };
      });
      await page.goto(new URL("?demo=expressions", url).href);
      const resume = page.getByRole("button", {name:"Resume playground"});
      await resume.waitFor();
      if (!touch) {
        await resume.click();
        await page.waitForFunction(() => Number(document.querySelector("#tick").textContent) >= 18);
        await page.evaluate(() => { window.combatAudio = window.speakers[0].context; });
        await page.getByRole("button", {name:"Pause playground"}).click();
        await page.waitForFunction(() => window.combatAudio.state === "suspended");
      }
      const tick = await page.locator("#tick").textContent();
      const count = () => page.locator("#red-count").textContent().then(Number);
      const box = await page.locator("#arena").boundingBox();
      const x = box.x + box.width / 4, y = box.y + box.height * .65;
      async function place(drag = false) {
        // Sample every speaker, including the very first touch on a page opened paused.
        await page.evaluate(() => {
          window.placementAudio = new Promise(resolve => {
            document.querySelector("#arena").addEventListener("pointerdown", () => {
              const samples = new Float32Array(512), start = performance.now();
              let peak = 0, combatRan = false;
              function measure() {
                if (window.combatAudio?.state === "running") combatRan = true;
                for (const meter of window.speakers) {
                  if (meter.context.state !== "running") continue;
                  meter.getFloatTimeDomainData(samples);
                  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
                }
                if (performance.now() - start < 330) setTimeout(measure, 4);
                else resolve({peak, combatRan});
              }
              measure();
            }, {capture:true, once:true});
          });
        });
        if (touch) await page.touchscreen.tap(x,y);
        else if (drag) {
          await page.mouse.move(x,y);
          await page.mouse.down();
          await page.mouse.move(x+96,y,{steps:8});
          await page.mouse.up();
        } else await page.mouse.click(x,y);
        const {peak, combatRan} = await page.evaluate(() => window.placementAudio);
        assert.equal(combatRan, false, "A paused purchase must not wake a battle sound");
        assert.equal(await page.locator("#tick").textContent(), tick);
        return peak;
      }
      const original = await count();
      assert.ok(await place() > .002, "A paused troop placement reaches the speaker");
      assert.equal(await count(), original + 1);
      await page.locator("#sound-toggle").click();
      assert.ok(await place() < .0005, "Mute silences placement feedback");
      await page.locator("#sound-toggle").click();
      assert.ok(await place(!touch) > .002, "Feedback returns while the same tick is still paused");
      assert.equal(await count(), original + (touch ? 3 : 7));
    } finally { await page.context().close(); }
  }
  console.log("Paused troops sound on click, drag and first touch. Mute silences the brush and battle time stays frozen.");
}
