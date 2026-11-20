export const UNIT_DEFINITIONS = {
  warrior: {
    name: "Warrior", attack: "melee", radius: 11, maxHp: 30,
    speed: 90, reach: 48, damage: 10, cooldownTicks: 30,
  },
  archer: {
    name: "Archer", attack: "arrow", radius: 10, maxHp: 20,
    speed: 72, reach: 120, damage: 8, cooldownTicks: 48, arrowSpeed: 300,
  },
} as const;

export type UnitKind = keyof typeof UNIT_DEFINITIONS;
