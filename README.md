# Battle Sandbox

A Canvas 2D battle sandbox. Draw a formation on the field, or choose **20 vs 20 demo** to watch two armies meet. The local game draws its own meadow, flags and Warriors.

## Run locally

Use Node.js 22.18 or later. In this directory, run `npm ci` and `npm run dev`, then open the local URL Vite prints. Run `npm test` for the deployment and combat tests and `npm run build` for type checking and the production build.

## Deployment

Click to place one Warrior. Drag to place the first Warrior and one more every 24 arena units along the path, including around bends. The left half is red. The center line and right half are blue. A stroke that crosses the line can place Warriors on both teams.

Releasing the pointer saves the entire stroke. **Undo stroke** removes that gesture, and **Clear** empties the field. After placing both teams, **Start** runs the battle. **Pause** freezes it, **Replay** starts the same formation with full health, and **Edit formation** returns it to the drawing board. Positions and the order used to assign unit IDs are stored in the fixed 960 × 360 arena.

**20 vs 20 demo** starts four ranks of five Warriors on each side. **Back to field** restores your drawn formation. Open `/?demo=20v20` to start the example directly. In combat, the camera frames the Warriors and draws both axes at the same scale. The pennants count the living Warriors, and the narrow stripes show each team's remaining health.

The [Node regression](tests/deployment.test.mjs) checks sparse and frequent pointer samples against the same five expected positions. With the development server running, open `/tests/brush-browser.html` and press **Run pointer check** to send the two sample streams through the browser's pointer listeners. Both checks use a horizontal 96-unit stroke from x = 120 to x = 216.

## Combat rules

The browser and the Node tests use the same [simulation](src/simulation.ts). Each tick lasts 1/60 second. A Warrior moves at 90 arena units per second toward the closest living opponent, with the lower numeric ID winning distance ties. A Warrior starting a tick within 48 units of an opponent's center can hit for 10 damage, then waits 30 ticks before attacking again. All attacks for a tick use the same starting state, so a Warrior can land a hit on the tick it dies.

Every living Warrior has an 11-unit circular footprint and keeps closing until the circles touch. For each overlapping pair, the simulation pushes the two centers apart along their connecting line. Exact overlaps use a repeatable direction from the pair's IDs. Up to four passes resolve crowded neighbors. Movement and separation together are limited to 1.5 units per tick, and the full circle stays within the arena. Fallen Warriors stop blocking movement.

The [in-reach test](tests/duel.test.mjs) starts two Warriors 48 units apart. Their health after ticks 1, 31, and 61 is 20, 10, and 0 respectively.

The [crowd tests](tests/crowd.test.mjs) cover allies sharing a starting point, stacks against all four walls, and the full 20-vs-20 fight. In that formation, the test requires the opposing ranks to touch while all 40 are standing and verifies that each living pair stays at least 90% of one diameter apart.

The local Git tag `project-start` marks the runnable blank-canvas starter. Codex implemented the duel, deployment brush and crowd demo from the supplied specifications.
