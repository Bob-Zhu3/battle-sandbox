# Battle Sandbox

A Canvas 2D battle sandbox. Draw a formation on the field or open **Play modes** for the two-player room and the example battles. The game draws its own meadow, flags, units and arrows.

## Run locally

Use Node.js 22.18 or later. In this directory, run `npm ci` and `npm run dev`, then open the local URL Vite prints. The development server hosts the game and its WebSocket endpoint on the same port. For a built game, run `npm run build` followed by `npm start`. The standalone Node server defaults to `http://127.0.0.1:4173` and accepts `HOST` and `PORT` environment variables.

## Two-player room

Open `/room` in two browser windows on the same server. The first connection gets Red on the left and the second gets Blue on the right. Each player can draw while the other is drawing. A stroke previews locally and appears in both windows on release. **Undo** and **Clear** affect only the player's own squads.

**Ready** locks a player's formation after they place at least one unit. When both players are ready, the Node server runs the existing simulation at 60 fixed ticks per second. It sends both clients the same full world every three ticks and immediately on deployment changes, start and finish. Each browser projects the shared 960 × 360 arena onto its own canvas. The server assigns unit IDs and computes movement, arrows, damage and the result.

The server checks stroke type, length, finite coordinates, arena bounds, team half and the 100-unit budget per player before committing any part of a stroke. Each player numbers their strokes starting at 1 each round. The browser saves each stroke before sending it. The server records the exact unit IDs it assigned and returns them in a receipt. If the browser reconnects before receiving that receipt, it resends the same stroke. A matching retry gets the original IDs, even after Undo or Ready. Reusing the number for a different stroke or sending a stroke from an older round produces an error.

After a dropped connection the server holds the player's seat and formation for 60 seconds. The tab reconnects automatically using its private seat token. Refreshing the page or reopening the room in the same browser profile within that minute also works. A fresh tab can take the other seat while the first player is connected. The room and its receipts live in the Node process. **Leave room** releases a seat immediately, and an expired seat also opens for a new player. In either case the remaining player keeps their formation in the next round. **New round** after a battle restores both starting formations.

## Verify the room

Run `npm run demo:retry` for the lost-confirmation demo. It builds the game and opens two differently sized browser windows in a fresh local room. Red draws five Warriors. The demo drops the server's first receipt at Red's browser and disconnects Red. Blue keeps the squad on screen. Red automatically rejoins and retries. Only Red presses Ready, so both windows still show deployment at tick zero. The demo checks the original receipt, every unit's coordinates, the painted discs, and the five visible ID labels in both windows. It prints **PASS** and leaves the result visible. Close either window to finish.

For an unattended run use `npm run demo:retry -- --headless`. The demo uses a Playwright Chromium installation when available, otherwise installed Chrome. Pass `--channel msedge` to select Edge. Add `--output <directory>` to save the two views and the receipt record.

`npm test` includes a real WebSocket match that compares both clients' snapshots against the original Node simulation through the simultaneous tick-61 duel.

After `npm run build`, run `npm run demo:room -- --headed --channel chrome` for the two-window demonstration using installed Chrome. Alternatively run `npx playwright install chromium` and omit `--channel chrome`. The demo opens 960 × 600 and 600 × 480 viewports, holds both pointers down at once, draws Warriors and Archers, and presses Ready in each window. It checks every deployed unit's ID and arena coordinates, samples the rendered team colors at those positions in both canvases, and compares the battle snapshots through the final tick.

The demonstration normally starts an isolated local server. Pass `--url http://127.0.0.1:5173/room` to use an empty running room. Add `--keep-open` to leave both windows on the restored formation for another match, or `--output <directory>` to save both views and the coordinate record.

## Deployment

Select **Warrior** or **Archer**, then click to place one unit. Drag to place the first unit and one more every 24 arena units along the path, including around bends. The brush remembers which type you selected when you started the stroke. The left half is red. The center line and right half are blue. A stroke that crosses the line can place units on both teams.

Releasing the pointer saves the entire stroke. **Undo stroke** removes that gesture, and **Clear** empties the field. After placing both teams, **Start** runs the battle. **Pause** freezes it, **Replay** starts the same formation with full health, and **Edit formation** returns it to the drawing board. Positions and the order used to assign unit IDs are stored in the fixed 960 × 360 arena.

**Archer screen** (`/?demo=archers`) sets five red Warriors in front of five red Archers against two ranks of blue Warriors. **20 vs 20 Warriors** (`/?demo=20v20`) starts four ranks of five Warriors on each side. **Back to field** restores your drawn formation. In combat, the camera frames the units and draws both axes at the same scale. The pennants count the living units, and the narrow stripes show each team's remaining health.

The [Node regression](tests/deployment.test.mjs) checks sparse and frequent pointer samples against the same five expected positions. With the development server running, open `/tests/brush-browser.html` and press **Run pointer check** to send both sample streams through the browser's pointer listeners with each brush. All checks use a horizontal 96-unit stroke from x = 120 to x = 216.

## Combat rules

The browser and Node tests use the same [simulation](src/simulation.ts). Each tick lasts 1/60 second. Both unit types target the closest living enemy, with the lower numeric ID winning distance ties. Speed is in arena units per second. Reach is measured between centers. The [unit definitions](src/units.ts) supply the combat values.

| Unit | HP | Speed | Reach | Damage | Cooldown |
| --- | ---: | ---: | ---: | ---: | ---: |
| Warrior | 30 | 90 | 48 | 10 | 30 ticks |
| Archer | 20 | 72 | 120 | 8 | 48 ticks |

Warriors land melee hits in reach and keep walking until their footprints touch the enemy. Archers stop in reach and release an arrow when ready. An arrow travels at 300 units per second along its original firing line, starting on the tick after release. It passes allies, hits the first living enemy circle it crosses, then disappears. A miss exits the arena. Hits from arrows and melee on the same tick add together, and an arrow can finish its flight after its Archer falls.

Warriors have an 11-unit footprint radius and Archers have a 10-unit radius. For each overlapping pair, the simulation pushes the two centers apart along their connecting line. Exact overlaps use a repeatable direction from the pair's IDs. Up to four passes resolve crowded neighbors. Movement and separation together are limited to the unit's walking speed, and the full circle stays within the arena. Fallen units stop blocking movement.

The [in-reach test](tests/duel.test.mjs) starts two Warriors 48 units apart. Their health after ticks 1, 31, and 61 is 20, 10, and 0 respectively.

The [arrow tests](tests/archer.test.mjs) include a single shot at a stationary enemy 100 units away. The target keeps all 20 HP on release and through tick 18, then drops to 12 HP on tick 19 when the tip reaches its footprint.

The [crowd tests](tests/crowd.test.mjs) cover allies sharing a starting point, stacks against all four walls, and the full 20-vs-20 fight. In that formation, the test requires the opposing ranks to touch while all 40 are standing and verifies that each living pair stays at least 90% of one diameter apart.

The local Git tag `project-start` marks the runnable blank-canvas starter. Codex implemented the duel, brush, crowd demo, Archer and two-player room from the supplied specifications.
