# Battle Sandbox

Draw a squad into a meadow and watch it fight. Open **Roster** to choose from fourteen troops and buildings or three spells. The home screen is a live playground. Open **Play modes** for a two-player duel or a three- or four-player free-for-all.

![Four armies in a live free-for-all, with a base in each corner and recruitment controls below the field](media/free-for-all.png)

## Play locally

Use Node.js 22.18 or newer. Run these commands in the project directory.

```sh
npm ci
npm run play
```

The playground opens in your browser. To play together on the same network, have everyone open the **same Network URL** printed in the terminal and choose the same mode. Separate browsers or fresh tabs can also take different seats on one computer.

| Mode | Players | Where you can draw | Objective |
| --- | --- | --- | --- |
| Playground (`/`) | 1 | Anywhere, with any of four army colors | Experiment as long as you like |
| Duel (`/room`) | 2 | Red's left half or Blue's right half | Destroy the opposing base |
| Free-for-all (`/ffa`) | 3–4 | One fixed corner per player | Be the last player with a standing base |

### Playground

Click to place one troop. Hold and drag to add another every 24 arena units. Friendly troops breathe and blink while they wait. Place an enemy nearby and they react while your pointer is still down. Gold is unlimited. When a fight ends, you can paint the next one straight onto the same field. **Undo** removes the last stroke. **Clear** empties the field.

Place a red Giant opposite a blue Barrel Roller. When the barrel reaches his hands, the Giant hoists it over his head and bowls it back. Try again and place a red Clockmouse by his boots while he's holding it. He drops the barrel where he stands and runs. [Starting position](media/giant-setup.jpg) · [Watch the two outcomes](media/giant-and-clockmouse.mp4)

This command plays both encounters on the field, then leaves the controls in your hands.

```sh
npm run demo:encounters
```

A friendly Warrior standing between an Archer and its target ducks as the arrow passes its shoulder. The Archer rises to follow the shot. [Watch the Archer and Warrior](media/over-the-shoulder.mp4)

### Multiplayer

1. **Deploy.** Each commander starts with **120 gold** and a **160 HP base**. Draw an opening army inside your territory. A drag previews its total cost and commits the whole squad when released. **Undo** and **Clear** refund your own opening purchases.
2. **Ready up.** Once each player has a troop and everyone presses **Ready**, the field counts down **3, 2, 1**. Remaining gold carries into battle. A fourth free-for-all player can join before the countdown begins.
3. **Reinforce.** Collect **4 gold per second** while your base stands. Draw reinforcements in your territory during the fight. The first troop appears on press and the others join as your brush travels. Tap to cast spells anywhere on the field, including in an opponent's camp. Defeating a troop pays its bounty on the tick it falls.
4. **Take the bases.** The lookout on each base tracks a hostile troop within 160 arena units. It takes 0.3 seconds to aim, then fires a 6-damage bolt up to once every 1.2 seconds. A Shieldbearer in the firing line can absorb most of the hit. Even an empty army can rebuild while its base stands. When a base falls, its remaining troops retreat from play. The last base standing wins. If all remaining bases fall on the same tick, the match is a draw. **New round** restores every occupied base and starting purse.

A free-for-all pays one bounty per defeated troop. If more than one army deals damage on the fatal tick, the largest contribution earns the reward. Ties use the fixed seat order of Red, Blue, Violet, then Amber. Troops removed when their base falls pay no bounty.

### The roster

| Troop or building | Gold | Bounty | What to watch |
| --- | ---: | ---: | --- |
| Warrior | 12 | 6 | Hurries into sword range and ducks under a friendly arrow. |
| Archer | 8 | 4 | Stops at bow range and peeks over a friendly shield or sword when shooting. |
| Shieldbearer | 16 | 8 | Lifts the shield when a shot approaches. Takes one quarter of frontal projectile damage, rounded up. A barrel gets through. |
| Field Medic | 10 | 5 | Crouches and unrolls a bandage toward a wounded ally. Hitting the Medic interrupts the wrap. |
| Lancer | 14 | 7 | Lowers the lance after a straight run. A shield facing the charge stops the bonus hit and briefly staggers the Lancer. |
| Barrel Roller | 13 | 6 | Bowls a heavy wooden barrel along the ground. A Giant facing the roll can catch it. |
| Engineer | 21 | 10 | Hammers together one Watchpost near the fight, then repairs damaged machines. |
| Clockmouse | 8 | 4 | Squeaks and sends a nearby Giant running, even one wearing the same colors. |
| Bolt Drone | 15 | 7 | Commits to one line for a three-bolt burst. A sidestepping enemy can escape the later shots. |
| Mouse Workshop | 23 | 11 | Winds the drum and releases up to three Clockmice, one at a time. |
| Watchpost | 15 | 7 | Stays where it was built and fires at enemies in range. An Engineer can mend it. |
| Giant | 28 | 14 | Holds a caught barrel overhead before returning it. A Clockmouse can make him drop it. |
| Storm Kirin | 20 | 10 | Its lightning jumps from one enemy to the next. A metal body or shield lets the next spark cross a wider gap. |
| Phoenix | 19 | 9 | Falls into a glowing ember once and returns at half health if the ember survives 1.5 seconds. |

| Spell | Gold | What happens |
| --- | ---: | --- |
| Gust | 10 | Shoves enemies and scatters hostile arrows and bolts in its circle. Barrels keep rolling. A friendly Phoenix ember hatches immediately. |
| Meteor | 20 | Marks the ground for 0.8 seconds before dealing 17 damage to enemies still inside or 6 to a base. |
| Healing Rain | 15 | Three showers each restore 5 HP to friendly people and creatures. An enemy Phoenix ember goes out in the rain. |

### Reconnecting

A connection loss reserves your seat for 60 seconds. Reopen the match to reclaim your color, gold and current view of the battle. The server keeps running while you are away. Accepted purchases have IDs scoped to the player and round. Retrying a stroke or spell returns the original IDs and charges once. **Leave match** releases the seat immediately. A departure before battle unlocks the other players' formations. During battle, a departed army fights on while another player remains.

## Run the checks

| Command | What it demonstrates |
| --- | --- |
| `npm test` | Fixed-tick combat, troop interactions, towers, spells, returning to a full-roster fight, brush spacing, spending and two real WebSocket clients |
| `npm run demo:encounters` | A Giant returns a barrel, then a Clockmouse changes the same encounter. The playground stays open for you. |
| `npm run check:modes` | Every roster entry, a cross-field Meteor in a desktop-and-phone duel, and complete three- and four-player matches with reconnection and rematches |
| `npm run demo:room -- --headed` | Two browser windows drawing at the same time, then recruiting during a base battle |
| `npm run demo:retry` | Drop confirmation of a five-Warrior stroke, disconnect and return with the original five IDs and one charge |
| `npm run demo:reconnect` | Disconnect Blue after the first hit, catch up to the live fight and verify both browsers agree through the fall of a base |

Browser checks use Playwright Chromium when available or installed Chrome. Use `npx playwright install chromium` to install the test browser. The two disconnect demos leave their result windows open until you close one. Add `-- --headless` for unattended use or `-- --output <directory>` to save both views and the comparison.

## How the field works

The browser playground and Node match server share a deterministic 60-tick simulation. Targets break distance ties by stable ID. Troops have circular footprints, separate when crowded and stay inside the arena. Buildings stay rooted. Arrows fly at 300 arena units per second, starting on the tick after release. They pass allies and strike the first living enemy troop or base along their line. All impacts on a tick resolve together. A Warrior duel beginning in reach deals simultaneous hits on ticks 1, 31 and 61. [Combat simulation](src/simulation.ts) · [Troop definitions](src/units.ts)

The server validates territory and funds, assigns IDs and broadcasts the same world to every browser. It normally sends 20 snapshots per second, with additional updates for purchases, payouts and changes of phase. Each browser projects the same 960 × 360 arena onto its own canvas.

For a local development server on loopback, use `npm run dev`. To serve the production build, run `npm run build` and `npm start`. The Node server defaults to `127.0.0.1:4173` and accepts `HOST` and `PORT`.
