import assert from "node:assert/strict";

export async function checkPausedPlacement(browser, url) {
  for (const touch of [false, true]) {
    const page = await browser.newPage({viewport: touch ? {width:390,height:700} : {width:960,height:540},
      isMobile:touch, hasTouch:touch});
    try {
      await page.addInitScript(() => {
        window.speakers = [];
        window.brushSamples = [];
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
          if(this.buffer)window.brushSamples.push({seconds:this.buffer.duration,offset:args[1]??0});
          return start.apply(this,args);
        };
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
      // A longer arrival can still be in the output buffer when the player mutes it.
      await page.waitForFunction(()=>window.speakers.every(meter=>{
        if(meter.context.state!=="running")return true;
        const pcm=new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(pcm);
        return pcm.every(v=>Math.abs(v)<.0005);
      }));
      const beforeMute=await page.evaluate(()=>window.brushSamples.length);
      assert.ok(await place() < .0005, "Mute silences placement feedback");
      assert.equal(await page.evaluate(()=>window.brushSamples.length),beforeMute);
      await page.locator("#sound-toggle").click();
      assert.ok(await place(!touch) > .002, "Feedback returns while the same tick is still paused");
      assert.equal(await count(), original + (touch ? 3 : 7));
      const first=await page.evaluate(()=>window.brushSamples.length);
      for(const [shelf,card] of [["Machines","drone"],["Towers","belltower"],["Spells","freeze"],["Spells","lightning"]]){
        const tab=page.getByRole("tab",{name:shelf,exact:true}), button=page.locator("#brush-"+card);
        if(touch){await tab.tap();await button.tap();}else{await tab.click();await button.click();}
        assert.ok(await place()>.002,card+" can be heard while paused");
      }
      const samples=await page.evaluate(n=>window.brushSamples.slice(n),first);
      assert.equal(samples.length,4);
      assert.deepEqual(samples[0],{seconds:1,offset:.5*(1-.045)});
      assert.deepEqual(samples[1],samples[0],"Troop and tower share the original brush tap");
      assert.ok(samples[2].seconds>20 && samples[3].seconds===samples[2].seconds);
      assert.notEqual(samples[2].offset,samples[3].offset,"Freeze and Lightning use different recorded cuts");
    } finally { await page.context().close(); }
  }
  console.log("Desktop and touch use one paused troop and tower tap, with separate spell sounds. Mute and the frozen battle clock hold.");
}
