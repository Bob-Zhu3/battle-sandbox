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

// Open on the return stroke while the meteor is still in flight. All targets
// and hit locations come from a normal playground battle.
export function spellShowcase(play: Playground) {
  const troops: [Team,RecruitKind,number,number][] = [
    ["red","bomber",174,155],["red","monk",197,169],["red","warrior",215,145],
    ["blue","lobber",241,175],["blue","harpoon",302,135],["blue","prism",356,170],
    ["red","archer",418,184],["blue","cyclops",511,161],["red","shieldbearer",471,177],
    ["blue","warrior",664,168],["blue","monk",695,186],["red","monk",728,163],
    ["red","lancer",778,208],["blue","rhinorider",812,190],
  ];
  for (const [team,kind,x,y] of troops) play.place(team,{type:UNIT_DEFINITIONS[kind].command,positions:[{x,y}]});
  play.cast("red","rain",173,158); play.cast("red","meteor",516,178); play.cast("red","fault",660,169);
  for (let i=0;i<15;i++) play.advance();
  play.cast("red","lightning",299,157); play.cast("red","briar",784,198);
  for (let i=0;i<19;i++) play.advance();
  play.paused=true;
}
