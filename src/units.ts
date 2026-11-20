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
    cost: 14, bounty: 7, attack: "melee", radius: 11.5, maxHp: 26, speed: 102, reach: 50, damage: 7, cooldownTicks: 42, runUp: 52, bonus: 9,
  },
  bomber: {
    name: "Bomber", command: "place-bombers", description: "Lobs a sparking bomb at a patch of ground. Enemies still inside the circle take the blast together.",
    cost: 16, bounty: 8, attack: "arrow", radius: 11, maxHp: 25, speed: 65, reach: 145, damage: 13, cooldownTicks: 87, arrowSpeed: 222, blastRadius: 43,
  },
  musketeer: {
    name: "Musketeer", command: "place-musketeers", description: "Fires a bright bullet through two enemies in line. A raised shield stops the shot.",
    cost: 17, bounty: 8, attack: "arrow", radius: 10.5, maxHp: 23, speed: 70, reach: 158, damage: 11, cooldownTicks: 66, arrowSpeed: 535, throughDamage: 6,
  },
  scout: {
    name: "Venom Scout", command: "place-venom-scouts", description: "Blows a violet dart that poisons living enemies. A Medic's finished bandage draws out the venom.",
    cost: 13, bounty: 6, attack: "arrow", radius: 9, maxHp: 19, speed: 88, reach: 115, damage: 3, cooldownTicks: 61, arrowSpeed: 276,
  },
  cyclops: {
    name: "Cyclops", command: "place-cyclopes", description: "Raises a spiked club, then smashes, stuns and scatters a crowd. Scoops up wounded humans within arm's reach.",
    cost: 33, bounty: 16, attack: "smash", radius: 20, maxHp: 96, speed: 63, reach: 55, damage: 16, cooldownTicks: 116,
    windup: 27, blastRadius: 54, stunTicks: 29, shove: 35, swallowRange: 39, swallowHp: 12, swallowTicks: 16, swallowCooldown: 150,
  },
  zombie: {
    name: "Zombie", command: "place-zombies", description: "Bites leave a green mark. A marked human who falls gets back up as a Zombie for the biting army.",
    cost: 10, bounty: 5, attack: "melee", radius: 10, maxHp: 25, speed: 70, reach: 33, damage: 5, cooldownTicks: 43, markTicks: 155, riseTicks: 32,
  },
  frostqueen: {
    name: "Frost Queen", command: "place-frost-queens", description: "Sends an ice crystal into the front line. On impact it blooms and slows enemies under its frost.",
    cost: 24, bounty: 12, attack: "arrow", radius: 14, maxHp: 34, speed: 69, reach: 134, damage: 7, cooldownTicks: 77, arrowSpeed: 230,
    frostRadius: 43, slowTicks: 100, speedFactor: 0.48,
  },
  mouse: {
    name: "Clockmouse", command: "place-mice", description: "A wind-up mouse. Its squeak at a Cyclops's boots can interrupt a raised club.",
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
    name: "Storm Kirin", command: "place-kirins", description: "Lightning leaps between up to four enemies, stunning each. Metal carries the next jump farther.",
    cost: 23, bounty: 11, attack: "lightning", radius: 14, maxHp: 30, speed: 79, reach: 116, damage: 9, cooldownTicks: 76, jumpRange: 78, metalRange: 110, stunTicks: 21,
  },
  phoenix: {
    name: "Phoenix", command: "place-phoenixes", description: "Its talons set enemies on fire. Its first fall leaves an ember egg. Guard it to hatch, fan it with Gust, or douse an enemy egg with Rain.",
    cost: 22, bounty: 11, attack: "melee", radius: 14.5, maxHp: 32, speed: 96, reach: 36, damage: 7, cooldownTicks: 39, hatchTicks: 90,
  },
} as const;

export type UnitKind = keyof typeof UNIT_DEFINITIONS;
export const UNIT_KINDS = Object.keys(UNIT_DEFINITIONS) as UnitKind[];
export const isMachine = (kind: UnitKind) => kind === "mouse" || kind === "drone" || kind === "post" || kind === "workshop";
export const isHuman = (kind: UnitKind) => kind === "warrior" || kind === "archer" || kind === "shieldbearer" ||
  kind === "medic" || kind === "lancer" || kind === "bomber" || kind === "engineer" || kind === "musketeer" || kind === "scout";
export const isBuilding = (kind: UnitKind) => kind === "workshop" || kind === "post";
export type PlacementType = (typeof UNIT_DEFINITIONS)[UnitKind]["command"];

export function placementKind(type: PlacementType): UnitKind;
export function placementKind(type: unknown): UnitKind | undefined;
export function placementKind(type: unknown) {
  if (type === "place-giants") return "cyclops";
  if (type === "place-coopers") return "bomber";
  return UNIT_KINDS.find(kind => UNIT_DEFINITIONS[kind].command === type);
}
