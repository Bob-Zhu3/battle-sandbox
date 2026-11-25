# Live demo guide

## Before the demo

Use a fresh clone, Node.js 22.18 or later, and Chrome or Playwright Chromium. Run `npm ci` once. With the dependencies and browser installed, the crash demo runs locally, including its database. Put the terminal where the audience can see the restart messages alongside the two browser windows.

## Demonstration

| Time | What to show |
| --- | --- |
| 0–2 min | Open the [playground](https://bob-zhu3.github.io/battle-sandbox/), place two opposing troops and pause on an exchange. Explain that both browsers in a match receive the server's view of the same fixed-tick battle. |
| 2–7 min | Predict the two restart states in the table below. Run `npm run demo:crash`. Watch the old and new process IDs, the state read from disk, the retry and the five IDs drawn in each window. |
| 7–11 min | Walk through one purchase from the [client's pending commands](../src/room-connection.ts) to the [server's receipt](../server/room.ts) and the [database save](../server/match-database.ts). A confirmation can be lost even when the purchase succeeded. |
| 11–14 min | Run `node --test --test-name-pattern="online invites isolate" tests/online-match.test.mjs`. Red buys five Warriors while Blue buys one. One save reads an old version and is rejected. The request reloads, and both browsers get the same six troops. The test checks for the rejected save itself. |
| 14–17 min | Open the [200-troop fixture](https://bob-zhu3.github.io/battle-sandbox/?demo=crowd). The [before-and-after measurements](../README.md#measuring-a-crowded-field) show how turning drawing off isolated the slow part. Explain what still stutters at this size. |
| 17–20 min | Demonstrate or explain the limit on Ready below. Leave time for questions. |

## Predict the outcome

Red starts with 120 gold. Five Warriors at 12 gold each cost 60. Blue buys nothing. In both cases Red sends the same player, round and command ID again.

| When the server dies | At restart, before Red retries | After the retry |
| --- | --- | --- |
| Immediately before saving | Empty army, 120 gold, zero receipts | IDs 1–5, 60 gold, one receipt |
| After saving and before replying | IDs 1–5, 60 gold, one receipt | IDs 1–5, 60 gold, one receipt |

The [demo](../scripts/demo-crash.mjs) checks the local SQLite file and the IDs actually drawn in both browsers. Each browser's gold counter belongs to its own player, so Blue's counter stays at 120. The process being restarted runs the hosted match handler against a disposable local database. Ordinary local WebSocket rooms live in memory.

## One question to practice

**If Blue presses Ready and the connection drops before the message arrives, what does the server remember?** Blue is still unready. Purchases get a saved receipt and are resent on reconnect. Ready currently has neither guarantee, so Blue must press it again. A next test would drop just that message, reconnect, and check that both browsers agree about whether the countdown started.
