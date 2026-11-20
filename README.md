# Battle Sandbox

A Canvas 2D duel between two Warriors. Start the duel to watch them approach, attack, and lose health. You can pause, reset, or replay the same fight.

## Run locally

Use Node.js 22.18 or later. In this directory, run `npm ci` and `npm run dev`, then open the local URL Vite prints. Run `npm test` for the Node simulation tests and `npm run build` for type checking and the production build.

## Combat rules

The browser and the Node tests use the same [simulation](src/simulation.ts). Each tick lasts 1/60 second. A Warrior moves at 90 arena units per second toward the closest living opponent, with the lower numeric ID winning distance ties. A Warrior starting a tick within 48 units of an opponent's center can hit for 10 damage, then waits 30 ticks before attacking again. All attacks for a tick use the same starting state, so a Warrior can land a hit on the tick it dies.

The browser opens with the Warriors apart. They first hit on tick 165 and both fall on tick 225. The [in-reach test](tests/duel.test.mjs) starts the Warriors 48 units apart. Their health after ticks 1, 31, and 61 is 20, 10, and 0 respectively.

The local Git tag `project-start` marks the runnable blank-canvas starter. Codex implemented this iteration from the supplied duel specification.
