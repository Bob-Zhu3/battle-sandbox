import type { Team } from "../battlefield.ts";
import type { Playground } from "../playground.ts";
import { UNIT_DEFINITIONS, type RecruitKind } from "../units.ts";

// This is an ordinary playground state. Every pose, projectile and cast is produced by the simulation.
export function pixelSkirmish(play: Playground) {
  const ranks: [Team, RecruitKind, number, number][] = [
    ["red","archer",124,127], ["red","musketeer",155,104], ["red","archer",174,147],
    ["red","lancer",220,109], ["red","warrior",234,136], ["red","shieldbearer",208,153],
    ["blue","warrior",293,130], ["blue","lancer",327,109], ["blue","musketeer",372,93],
    ["red","phoenix",434,110], ["red","warrior",426,151], ["red","medic",394,165],
    ["red","drone",375,69], ["blue","drone",690,101],
    ["blue","cyclops",513,145], ["blue","archer",569,104], ["blue","medic",556,153],
    ["red","shieldbearer",542,197], ["red","archer",493,202], ["red","musketeer",485,229],
    ["blue","frostqueen",654,197], ["blue","lancer",602,215], ["blue","warrior",579,193],
    ["red","bomber",702,135], ["red","lancer",739,151], ["blue","irongolem",797,143], ["blue","prism",839,114],
    ["red","firedragon",289,237], ["blue","archer",389,240], ["blue","warrior",354,228],
    ["red","medic",180,174], ["blue","shieldbearer",533,94],
  ];
  for (const [team,kind,x,y] of ranks) {
    play.place(team,{type:UNIT_DEFINITIONS[kind].command,positions:[{x,y}]});
  }
  play.cast("red","meteor",778,157);
  for (let i=0;i<14;i++) play.advance();
  play.cast("blue","freeze",543,202);
  for (let i=0;i<20;i++) play.advance();
  play.paused=true;
}
