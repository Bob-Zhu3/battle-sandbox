# Battle Sandbox

A Canvas 2D battle sandbox. Draw a formation on the field or open **Demos** to watch a battle. The local game draws its own meadow, flags, units and arrows.

## Run locally

Use Node.js 22.18 or later. In this directory, run `npm ci` and `npm run dev`, then open the local URL Vite prints. Run `npm test` for the deployment and combat tests and `npm run build` for type checking and the production build.

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

The local Git tag `project-start` marks the runnable blank-canvas starter. Codex implemented the duel, brush, crowd demo and Archer from the supplied specifications.
