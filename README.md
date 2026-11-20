# Battle Sandbox

A Canvas 2D battle sandbox. Draw the starting formation on the empty field, then start the battle, pause it, or replay the same opening.

## Run locally

Use Node.js 22.18 or later. In this directory, run `npm ci` and `npm run dev`, then open the local URL Vite prints. Run `npm test` for the deployment and combat tests and `npm run build` for type checking and the production build.

## Deployment

Click to place one Warrior. Drag to place the first Warrior and one more every 24 arena units along the path, including around bends. The left half is red. The center line and right half are blue. A stroke that crosses the line can place Warriors on both teams.

Releasing the pointer saves the entire stroke. **Undo stroke** removes that gesture, and **Clear** empties the field. After placing both teams, **Start** runs the battle. **Pause** freezes it, **Replay** starts the same formation with full health, and **Edit formation** returns it to the drawing board. Positions and the order used to assign unit IDs are stored in the fixed 960 × 360 arena.

The [Node regression](tests/deployment.test.mjs) checks sparse and frequent pointer samples against the same five expected positions. With the development server running, open `/tests/brush-browser.html` and press **Run pointer check** to send the two sample streams through the browser's pointer listeners. Both checks use a horizontal 96-unit stroke from x = 120 to x = 216.

## Combat rules

The browser and the Node tests use the same [simulation](src/simulation.ts). Each tick lasts 1/60 second. A Warrior moves at 90 arena units per second toward the closest living opponent, with the lower numeric ID winning distance ties. A Warrior starting a tick within 48 units of an opponent's center can hit for 10 damage, then waits 30 ticks before attacking again. All attacks for a tick use the same starting state, so a Warrior can land a hit on the tick it dies.

The [in-reach test](tests/duel.test.mjs) starts two Warriors 48 units apart. Their health after ticks 1, 31, and 61 is 20, 10, and 0 respectively.

The local Git tag `project-start` marks the runnable blank-canvas starter. Codex implemented the duel and deployment brush from the supplied specifications.
