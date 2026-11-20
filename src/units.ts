export const UNIT_DEFINITIONS = {
  warrior: {
    name: "Warrior", command: "place-warriors", description: "Closes with the nearest enemy and swings its sword.", cost: 12, bounty: 6, attack: "melee", radius: 11, maxHp: 30,
    speed: 90, reach: 48, damage: 10, cooldownTicks: 30,
  },
  archer: {
    name: "Archer", command: "place-archers", description: "Stops at bow range and shoots past friendly troops.", cost: 8, bounty: 4, attack: "arrow", radius: 10, maxHp: 20,
    speed: 72, reach: 120, damage: 8, cooldownTicks: 48, arrowSpeed: 300,
  },
  shieldbearer: {
    name: "Shieldbearer", command: "place-shieldbearers", description: "Raises a tall shield against incoming arrows and tower bolts. Exposed from behind.",
    cost: 16, bounty: 8, attack: "melee", radius: 12, maxHp: 46,
    speed: 65, reach: 37, damage: 6, cooldownTicks: 44, guardCosine: 0.5, warningDistance: 64, damageFraction: 0.25,
  },
  medic: {
    name: "Field Medic", command: "place-medics", description: "Follows the line and bandages wounded allies. A hit interrupts treatment.",
    cost: 10, bounty: 5, attack: "melee", radius: 9, maxHp: 20,
    speed: 87, reach: 31, damage: 3, cooldownTicks: 54,
    sight: 140, aidReach: 32, aidAmount: 8, wrapTicks: 24, recoveryTicks: 60, flinchTicks: 24, escortGap: 32,
  },
  lancer: {
    name: "Lancer", command: "place-lancers", description: "Gets a running start for a heavy thrust. A squarely facing shield stops the charge.",
    cost: 14, bounty: 7, attack: "melee", radius: 10, maxHp: 26, speed: 102, reach: 50, damage: 7, cooldownTicks: 42, runUp: 52, bonus: 9,
  },
  cooper: {
    name: "Barrel Roller", command: "place-coopers", description: "Bowls a wooden barrel down the field. A calm Giant can catch it.",
    cost: 13, bounty: 6, attack: "arrow", radius: 11, maxHp: 25, speed: 66, reach: 150, damage: 13, cooldownTicks: 92, arrowSpeed: 152,
  },
  giant: {
    name: "Giant", command: "place-giants", description: "Catches barrels coming toward his hands. Even a friendly Clockmouse makes him drop one and run.",
    cost: 28, bounty: 14, attack: "melee", radius: 17, maxHp: 84, speed: 64, reach: 43, damage: 18, cooldownTicks: 65, fearRange: 76, fleeTicks: 40, holdTicks: 72,
  },
  mouse: {
    name: "Clockmouse", command: "place-mice", description: "A wind-up mouse. Its squeak sends nearby Giants running.",
    cost: 8, bounty: 4, attack: "melee", radius: 6, maxHp: 10, speed: 114, reach: 22, damage: 3, cooldownTicks: 34,
  },
  workshop: {
    name: "Mouse Workshop", command: "place-workshops", description: "Winds up and releases three Clockmice when enemies are on the field.",
    cost: 23, bounty: 11, attack: "build", radius: 15, maxHp: 48, speed: 0, reach: 0, damage: 0, cooldownTicks: 96, windup: 45, capacity: 3,
  },
  engineer: {
    name: "Engineer", command: "place-engineers", description: "Builds one Watchpost near the fight, then repairs damaged machines with a wrench.",
    cost: 21, bounty: 10, attack: "melee", radius: 10, maxHp: 24, speed: 70, reach: 31, damage: 4, cooldownTicks: 48, buildRange: 145, buildTicks: 38,
  },
  post: {
    name: "Watchpost", command: "place-watchposts", description: "A fixed lookout that shoots bolts. Engineers can repair its frame.",
    cost: 15, bounty: 7, attack: "arrow", radius: 12, maxHp: 37, speed: 0, reach: 135, damage: 6, cooldownTicks: 65, arrowSpeed: 280,
  },
  drone: {
    name: "Bolt Drone", command: "place-drones", description: "Hovers and fires three bolts along one sight line. A moving target can slip past the last shots.",
    cost: 15, bounty: 7, attack: "arrow", radius: 9, maxHp: 22, speed: 82, reach: 128, damage: 4, cooldownTicks: 64, arrowSpeed: 315, burstGap: 7,
  },
  kirin: {
    name: "Storm Kirin", command: "place-kirins", description: "A horned thunder beast. Its lightning jumps farther from metal armor and machines.",
    cost: 20, bounty: 10, attack: "lightning", radius: 12, maxHp: 30, speed: 79, reach: 106, damage: 9, cooldownTicks: 70,
  },
  phoenix: {
    name: "Phoenix", command: "place-phoenixes", description: "Falls into a live ember once. A friendly Gust fans it back to life and enemy rain puts it out.",
    cost: 19, bounty: 9, attack: "melee", radius: 10, maxHp: 28, speed: 96, reach: 36, damage: 7, cooldownTicks: 39, hatchTicks: 90,
  },
} as const;

export type UnitKind = keyof typeof UNIT_DEFINITIONS;
export const UNIT_KINDS = Object.keys(UNIT_DEFINITIONS) as UnitKind[];
export const isMachine = (kind: UnitKind) => kind === "mouse" || kind === "drone" || kind === "post" || kind === "workshop";
export const isBuilding = (kind: UnitKind) => kind === "workshop" || kind === "post";
export type PlacementType = (typeof UNIT_DEFINITIONS)[UnitKind]["command"];

export function placementKind(type: PlacementType): UnitKind;
export function placementKind(type: unknown): UnitKind | undefined;
export function placementKind(type: unknown) {
  return UNIT_KINDS.find(kind => UNIT_DEFINITIONS[kind].command === type);
}
