function troopHealth(base: number) {
  return Math.round(base * 4 / 3);
}

const recruits = {
  warrior: {
    name: "Warrior", command: "place-warriors", description: "Closes with the nearest enemy and swings its sword.", cost: 12, bounty: 6, attack: "melee", radius: 11, maxHp: troopHealth(30),
    speed: 90, reach: 48, damage: 10, cooldownTicks: 30,
  },
  archer: {
    name: "Archer", command: "place-archers", description: "Stops at bow range and shoots past friendly troops.", cost: 8, bounty: 4, attack: "arrow", radius: 10, maxHp: troopHealth(20),
    speed: 72, reach: 120, damage: 8, cooldownTicks: 48, arrowSpeed: 300,
  },
  shieldbearer: {
    name: "Shieldbearer", command: "place-shieldbearers", description: "Raises a tall shield against incoming arrows and tower bolts. Exposed from behind.",
    cost: 16, bounty: 8, attack: "melee", radius: 12, maxHp: troopHealth(46),
    speed: 65, reach: 37, damage: 6, cooldownTicks: 44, guardCosine: 0.5, warningDistance: 64, damageFraction: 0.25,
  },
  medic: {
    name: "Field Medic", command: "place-medics", description: "Follows the line and bandages wounded allies. A hit interrupts treatment.",
    cost: 10, bounty: 5, attack: "melee", radius: 9, maxHp: troopHealth(20),
    speed: 87, reach: 31, damage: 3, cooldownTicks: 54,
    sight: 140, aidReach: 32, aidAmount: 8, wrapTicks: 24, recoveryTicks: 60, flinchTicks: 24, escortGap: 32,
  },
  lancer: {
    name: "Lancer", command: "place-lancers", description: "Gets a running start for a heavy thrust. A squarely facing shield stops the charge.",
    cost: 14, bounty: 7, attack: "melee", radius: 11.5, maxHp: troopHealth(26), speed: 102, reach: 50, damage: 7, cooldownTicks: 42, runUp: 52, bonus: 9,
  },
  bomber: {
    name: "Bomber", command: "place-bombers", description: "Lobs a sparking bomb at a patch of ground. Enemies still inside the circle take the blast together.",
    cost: 16, bounty: 8, attack: "arrow", radius: 11, maxHp: troopHealth(25), speed: 65, reach: 145, damage: 13, cooldownTicks: 87, arrowSpeed: 222, blastRadius: 43,
  },
  musketeer: {
    name: "Musketeer", command: "place-musketeers", description: "Fires a bright bullet through two enemies in line. A raised shield stops the shot.",
    cost: 17, bounty: 8, attack: "arrow", radius: 10.5, maxHp: troopHealth(23), speed: 70, reach: 158, damage: 11, cooldownTicks: 66, arrowSpeed: 535, throughDamage: 6,
  },
  scout: {
    name: "Venom Scout", command: "place-venom-scouts", description: "Blows a violet dart that poisons living enemies. A Medic's finished bandage draws out the venom.",
    cost: 13, bounty: 6, attack: "arrow", radius: 9, maxHp: troopHealth(19), speed: 88, reach: 115, damage: 3, cooldownTicks: 61, arrowSpeed: 276,
  },
  miner: {
    name: "Miner", command: "place-miners", description: "Choose any spot. A ridge of dirt travels from home, then the Miner breaks through with a pickaxe.",
    cost: 19, bounty: 9, attack: "melee", radius: 10, maxHp: troopHealth(33), speed: 81, reach: 35, damage: 7, cooldownTicks: 38,
    tunnelSpeed: 385, digTicks: 8, emergeTicks: 9,
  },
  clown: {
    name: "Clown", command: "place-clowns", description: "Juggles little glass poison bottles. They shatter on the ground and leave a purple cloud. An enemy Gust blows it away.",
    cost: 18, bounty: 9, attack: "arrow", radius: 10, maxHp: troopHealth(25), speed: 74, reach: 121, damage: 3, cooldownTicks: 104, arrowSpeed: 215,
    cloudRadius: 38, cloudTicks: 81, puffEvery: 10,
  },
  reaper: {
    name: "Reaper", command: "place-reapers", description: "Hunts a nearby wounded foe. A fatal scythe stroke draws a soul into its lantern and restores health.",
    cost: 25, bounty: 12, attack: "melee", radius: 13, maxHp: troopHealth(42), speed: 92, reach: 42, damage: 10, cooldownTicks: 48,
    huntRange: 118, harvestHp: 8,
  },
  witch: {
    name: "Witch", command: "place-witches", description: "Her spiral permanently turns an enemy into a Hex Pig. It keeps its health and fights for her side until it dies.",
    cost: 29, bounty: 14, attack: "arrow", radius: 12, maxHp: troopHealth(28), speed: 69, reach: 134, damage: 6, cooldownTicks: 225, arrowSpeed: 256,
  },
  cyclops: {
    name: "Cyclops", command: "place-cyclopes", description: "Raises a spiked club, then smashes, stuns and scatters a crowd. Scoops up wounded humans within arm's reach.",
    cost: 33, bounty: 16, attack: "smash", radius: 20, maxHp: troopHealth(96), speed: 63, reach: 55, damage: 16, cooldownTicks: 116,
    windup: 27, blastRadius: 54, stunTicks: 29, shove: 35, swallowRange: 39, swallowHp: 12, swallowTicks: 16, swallowCooldown: 150,
  },
  zombie: {
    name: "Zombie", command: "place-zombies", description: "A bite turns an enemy human into a green Zombie for the biting army. Look for its old headgear as it spreads the bite.",
    cost: 10, bounty: 5, attack: "melee", radius: 10, maxHp: troopHealth(25), speed: 70, reach: 33, damage: 5, cooldownTicks: 43, turnTicks: 20,
  },
  frostqueen: {
    name: "Frost Queen", command: "place-frost-queens", description: "Sends an ice crystal into the front line. On impact it blooms and slows enemies under its frost.",
    cost: 24, bounty: 12, attack: "arrow", radius: 14, maxHp: troopHealth(34), speed: 69, reach: 134, damage: 7, cooldownTicks: 77, arrowSpeed: 230,
    frostRadius: 43, slowTicks: 100, speedFactor: 0.48,
  },
  mouse: {
    name: "Clockmouse", command: "place-mice", description: "A wind-up mouse. Its squeak at a Cyclops's boots can interrupt a raised club.",
    cost: 8, bounty: 4, attack: "melee", radius: 6, maxHp: troopHealth(10), speed: 114, reach: 22, damage: 3, cooldownTicks: 34,
  },
  workshop: {
    name: "Mouse Workshop", command: "place-workshops", description: "Winds up and releases three Clockmice when enemies are on the field.",
    cost: 23, bounty: 11, attack: "build", radius: 15, maxHp: troopHealth(48), speed: 0, reach: 0, damage: 0, cooldownTicks: 96, windup: 45, capacity: 3,
  },
  engineer: {
    name: "Engineer", command: "place-engineers", description: "Builds one Watchpost near the fight, then repairs damaged machines with a wrench.",
    cost: 21, bounty: 10, attack: "melee", radius: 10, maxHp: troopHealth(24), speed: 70, reach: 31, damage: 4, cooldownTicks: 48, buildRange: 145, buildTicks: 38,
  },
  post: {
    name: "Watchpost", command: "place-watchposts", description: "A fixed lookout that shoots bolts. Engineers can repair its frame.",
    cost: 15, bounty: 7, attack: "arrow", radius: 12, maxHp: troopHealth(37), speed: 0, reach: 135, damage: 6, cooldownTicks: 65, arrowSpeed: 280,
  },
  lobber: {
    name: "Stone Lobber", command: "place-lobbers", description: "Slings a boulder at the marked patch of ground. Rush inside its blind spot or fly over the splash.",
    cost: 24, bounty: 12, attack: "arrow", radius: 16, maxHp: troopHealth(43), speed: 0, reach: 218, minimumRange: 65,
    damage: 16, cooldownTicks: 100, arrowSpeed: 215, blastRadius: 35,
  },
  sunlens: {
    name: "Sun Lens", command: "place-sun-lenses", description: "Focuses sunlight on one enemy. Each lit facet strengthens its beam. Enemy Healing Rain fogs the glass.",
    cost: 27, bounty: 13, attack: "beam", radius: 14, maxHp: troopHealth(44), speed: 0, reach: 148,
    damage: 3, cooldownTicks: 18, focusTicks: 12, tierTicks: 36, focusedDamage: 6, fullDamage: 10, fogTicks: 27,
  },
  belltower: {
    name: "Bell Tower", command: "place-bell-towers", description: "Tolls when ground troops come close. The sound shoves them outward and interrupts a Lancer's charge.",
    cost: 19, bounty: 9, attack: "toll", radius: 14, maxHp: troopHealth(40), speed: 0, reach: 65,
    damage: 4, cooldownTicks: 90, shove: 32, stunTicks: 10,
  },
  drone: {
    name: "Bolt Drone", command: "place-drones", description: "Hovers and fires three bolts along one sight line. A moving target can slip past the last shots.",
    cost: 15, bounty: 7, attack: "arrow", radius: 9, maxHp: troopHealth(22), speed: 82, reach: 128, damage: 4, cooldownTicks: 64, arrowSpeed: 315, burstGap: 7,
  },
  kirin: {
    name: "Storm Kirin", command: "place-kirins", description: "Lightning leaps between up to four enemies, stunning each. Metal carries the next jump farther.",
    cost: 23, bounty: 11, attack: "lightning", radius: 14, maxHp: troopHealth(30), speed: 79, reach: 116, damage: 9, cooldownTicks: 76, jumpRange: 78, metalRange: 110, stunTicks: 21,
  },
  phoenix: {
    name: "Phoenix", command: "place-phoenixes", description: "Its talons set enemies on fire. Its first fall leaves an ember egg. Guard it to hatch, fan it with Gust, or douse an enemy egg with Rain.",
    cost: 22, bounty: 11, attack: "melee", radius: 14.5, maxHp: troopHealth(32), speed: 96, reach: 36, damage: 7, cooldownTicks: 39, hatchTicks: 90,
  },
} as const;

// The pig is a combat form. Only recruits have a placement command.
export const UNIT_DEFINITIONS = { ...recruits, pig: {
  name: "Hex Pig", radius: 9, maxHp: troopHealth(30), speed: 141, reach: 30, damage: 6, cooldownTicks: 28, attack: "melee", bounty: 0, cost: 0,
} } as const;
export type RecruitKind = keyof typeof recruits;
export type UnitKind = keyof typeof UNIT_DEFINITIONS;
export const RECRUIT_KINDS = Object.keys(recruits) as RecruitKind[];
export const UNIT_KINDS = Object.keys(UNIT_DEFINITIONS) as UnitKind[];
export const isBuilding = (kind: UnitKind) => kind === "workshop" || kind === "post" || kind === "lobber" || kind === "sunlens" || kind === "belltower";
export const isMachine = (kind: UnitKind) => kind === "mouse" || kind === "drone" || isBuilding(kind);
export const airborne = (target: {kind: UnitKind | "base"; emberUntil?: number}) => target.kind === "drone" || (target.kind === "phoenix" && target.emberUntil === undefined);
export const isHuman = (kind: UnitKind) => kind === "warrior" || kind === "archer" || kind === "shieldbearer" ||
  kind === "medic" || kind === "lancer" || kind === "bomber" || kind === "engineer" || kind === "musketeer" || kind === "scout" || kind === "miner" || kind === "clown";
export type PlacementType = (typeof recruits)[RecruitKind]["command"];

export function placementKind(type: PlacementType): RecruitKind;
export function placementKind(type: unknown): RecruitKind | undefined;
export function placementKind(type: unknown) {
  if (type === "place-giants") return "cyclops";
  if (type === "place-coopers") return "bomber";
  return RECRUIT_KINDS.find(kind => recruits[kind].command === type);
}
