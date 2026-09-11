/**
 * Configurable Game Mode Architecture.
 * Encapsulates game rules, scoring, spawning, hazards, and difficulty progression
 * without duplicating gameplay systems.
 */

export const GAME_MODES = Object.freeze({
  CLASSIC: 'classic',
  ZEN: 'zen',
  ARCADE: 'arcade',
  CHALLENGE: 'challenge',
});

export const GAME_MODE_CONFIGS = Object.freeze({
  [GAME_MODES.CLASSIC]: {
    id: GAME_MODES.CLASSIC,
    name: 'Classic',
    tagline: 'Traditional Arcade',
    description: '3 Lives · Misses cost lives · Avoid Bombs',
    lives: 3,
    timer: null,
    missCostsLife: true,
    bombEnabled: true,
    bombStrikePenalty: 1,
    bombScorePenalty: 10,
    bombProbability: {
      min: 0.12,
      max: 0.35,
      minDifficulty: 0.15,
      maxActive: 2,
    },
    spawnRate: {
      baseInterval: 2.6,
      minInterval: 1.25,
      initialDelay: 0.8,
      maxActiveCap: 8,
    },
    difficultyMultiplier: 1.0,
    difficultyRampDuration: 75,
    gravityMultiplier: 1.0,
    launchSpeedMultiplier: 1.0,
    dynamicGravity: false,
    dynamicSpeed: false,
    dynamicComboPressure: false,
    comboRules: {
      timeout: 0.45,
      minTimeout: 0.45,
      maxMultiplier: 5,
      bonusPerFruit: 1,
    },
  },

  [GAME_MODES.ZEN]: {
    id: GAME_MODES.ZEN,
    name: 'Zen',
    tagline: 'Pure Slicing',
    description: '90s Timer · No Bombs · No Miss Penalties',
    lives: null,
    timer: 90,
    missCostsLife: false,
    bombEnabled: false,
    bombStrikePenalty: 0,
    bombScorePenalty: 0,
    bombProbability: {
      min: 0,
      max: 0,
      minDifficulty: 1.0,
      maxActive: 0,
    },
    spawnRate: {
      baseInterval: 2.8,
      minInterval: 1.4,
      initialDelay: 0.6,
      maxActiveCap: 8,
    },
    difficultyMultiplier: 0.75,
    difficultyRampDuration: 90,
    gravityMultiplier: 0.95,
    launchSpeedMultiplier: 1.0,
    dynamicGravity: false,
    dynamicSpeed: false,
    dynamicComboPressure: false,
    comboRules: {
      timeout: 0.50,
      minTimeout: 0.50,
      maxMultiplier: 5,
      bonusPerFruit: 1,
    },
  },

  [GAME_MODES.ARCADE]: {
    id: GAME_MODES.ARCADE,
    name: 'Arcade',
    tagline: '60s Blitz',
    description: '60s Blitz · High Combos · Bombs -10 Pts',
    lives: null,
    timer: 60,
    missCostsLife: false,
    bombEnabled: true,
    bombStrikePenalty: 0,
    bombScorePenalty: 10,
    bombProbability: {
      min: 0.18,
      max: 0.40,
      minDifficulty: 0.10,
      maxActive: 3,
    },
    spawnRate: {
      baseInterval: 1.9,
      minInterval: 0.95,
      initialDelay: 0.4,
      maxActiveCap: 10,
    },
    difficultyMultiplier: 1.4,
    difficultyRampDuration: 45,
    gravityMultiplier: 1.05,
    launchSpeedMultiplier: 1.05,
    dynamicGravity: false,
    dynamicSpeed: false,
    dynamicComboPressure: false,
    comboRules: {
      timeout: 0.52,
      minTimeout: 0.52,
      maxMultiplier: 8,
      bonusPerFruit: 2,
    },
  },

  [GAME_MODES.CHALLENGE]: {
    id: GAME_MODES.CHALLENGE,
    name: 'Challenge',
    tagline: 'Progressive Trial',
    description: '3 Lives · Dynamic Gravity & Speed · Ramping Combo Pressure',
    lives: 3,
    timer: null,
    missCostsLife: true,
    bombEnabled: true,
    bombStrikePenalty: 1,
    bombScorePenalty: 15,
    bombProbability: {
      min: 0.15,
      max: 0.48,
      minDifficulty: 0.08,
      maxActive: 3,
    },
    spawnRate: {
      baseInterval: 2.3,
      minInterval: 0.85,
      initialDelay: 0.6,
      maxActiveCap: 11,
    },
    difficultyMultiplier: 1.8,
    difficultyRampDuration: 65,
    gravityMultiplier: 1.0,
    launchSpeedMultiplier: 1.0,
    dynamicGravity: true,
    dynamicSpeed: true,
    dynamicComboPressure: true,
    comboRules: {
      timeout: 0.42,
      minTimeout: 0.28,
      maxMultiplier: 6,
      bonusPerFruit: 2,
    },
  },
});

export function getGameModeConfig(modeId) {
  return GAME_MODE_CONFIGS[modeId] || GAME_MODE_CONFIGS[GAME_MODES.CLASSIC];
}
