import { ARENA, type Team } from "./battlefield.ts";
import type { RecruitKind } from "./units.ts";

// The playable crowd and the benchmark start with these same two mirrored armies.
export function crowdFormation(count: 80 | 200) {
  const ranks: RecruitKind[] = ["warrior", "archer", "shieldbearer", "lancer", "musketeer",
    "warrior", "phoenix", "kirin", "warrior", "archer"];
  const positions: {team: Team; kind: RecruitKind; x: number; y: number}[] = [];
  for (let i = 0; i < count / 2; i++) {
    const col = Math.floor(i / 8);
    const x = 444 - 24 * col;
    const y = 70 + 29 * (i % 8) + (col % 2) * 6;
    const kind = ranks[i % ranks.length];
    positions.push({team:"red", kind, x, y}, {team:"blue", kind, x:ARENA.width - x, y:y + 3});
  }
  return positions;
}
