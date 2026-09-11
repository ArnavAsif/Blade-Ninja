import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  GAME_MODES,
  getGameModeConfig,
} from '../src/game/GameModeConfig.js';
import { GameState, STATES } from '../src/game/GameState.js';

function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
  };
}

describe('Game Modes & Menu Architecture Tests', () => {
  let mockStorage;
  let originalWindow;

  beforeEach(() => {
    mockStorage = createMockStorage();
    originalWindow = globalThis.window;
    globalThis.localStorage = mockStorage;
    globalThis.window = {
      localStorage: mockStorage,
      innerHeight: 400,
      innerWidth: 800,
      matchMedia: (query) => ({
        matches: query.includes('landscape') || (query.includes('portrait') && false),
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    };
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    delete globalThis.localStorage;
  });

  describe('Game Mode Configuration Integrity', () => {
    it('defines all four required game modes', () => {
      assert.equal(GAME_MODES.CLASSIC, 'classic');
      assert.equal(GAME_MODES.ZEN, 'zen');
      assert.equal(GAME_MODES.ARCADE, 'arcade');
      assert.equal(GAME_MODES.CHALLENGE, 'challenge');
    });

    it('configures CLASSIC mode with 3 lives, no timer, and missed fruits remove lives', () => {
      const config = getGameModeConfig(GAME_MODES.CLASSIC);
      assert.equal(config.lives, 3);
      assert.equal(config.maxLives, 3);
      assert.equal(config.timer, null);
      assert.equal(config.missCostsLife, true);
      assert.equal(config.bombEnabled, true);
      assert.equal(config.bombInstantGameOver, true);
    });

    it('configures ZEN mode with no bombs, relaxed gameplay, no lives, and no game over from missed fruits', () => {
      const config = getGameModeConfig(GAME_MODES.ZEN);
      assert.equal(config.lives, null);
      assert.equal(config.timer, null);
      assert.equal(config.missCostsLife, false);
      assert.equal(config.bombEnabled, false);
      assert.equal(config.bombProbability.max, 0);
      assert.ok(config.difficultyMultiplier <= 0.85);
    });

    it('configures ARCADE mode with 60 second timer, aggressive spawning, and combo focus', () => {
      const config = getGameModeConfig(GAME_MODES.ARCADE);
      assert.equal(config.timer, 60);
      assert.equal(config.lives, null);
      assert.equal(config.missCostsLife, false);
      assert.equal(config.bombEnabled, true);
      assert.equal(config.bombInstantGameOver, false);
      assert.equal(config.bombScorePenalty, 10);
      assert.ok(config.spawnRate.minInterval <= 1.0);
      assert.ok(config.comboRules.maxMultiplier >= 8);
    });

    it('configures CHALLENGE mode with progressively harder gameplay', () => {
      const config = getGameModeConfig(GAME_MODES.CHALLENGE);
      assert.equal(config.lives, 3);
      assert.equal(config.missCostsLife, true);
      assert.equal(config.bombEnabled, true);
      assert.equal(config.dynamicGravity, true);
      assert.equal(config.dynamicSpeed, true);
      assert.equal(config.dynamicComboPressure, true);
      assert.ok(config.difficultyMultiplier >= 1.5);
    });
  });

  describe('Configuration-Driven GameState Integration (Single Engine)', () => {
    it('initializes GameState in Classic mode by default', () => {
      const gameState = new GameState();
      assert.equal(gameState.mode, GAME_MODES.CLASSIC);
      assert.equal(gameState.hasLives(), true);
      assert.equal(gameState.lives, 3);
      assert.equal(gameState.hasTimer(), false);
      assert.equal(gameState.missCostsLife(), true);
    });

    it('switches to Zen mode dynamically without creating duplicate engine instances', () => {
      const gameState = new GameState();
      let modeNotification = null;
      gameState.subscribeMode((mode, config) => {
        modeNotification = { mode, config };
      });

      gameState.setMode(GAME_MODES.ZEN);

      assert.equal(gameState.mode, GAME_MODES.ZEN);
      assert.equal(gameState.hasLives(), false);
      assert.equal(gameState.lives, null);
      assert.equal(gameState.hasTimer(), false);
      assert.equal(gameState.missCostsLife(), false);
      assert.ok(modeNotification);
      assert.equal(modeNotification.mode, GAME_MODES.ZEN);
    });

    it('Zen mode ignores fruit misses and does not decrement lives or trigger game over', () => {
      const gameState = new GameState();
      gameState.setMode(GAME_MODES.ZEN);
      gameState.setState(STATES.PLAYING);

      gameState.loseLife();
      assert.equal(gameState.lives, null);
      assert.equal(gameState.getState(), STATES.PLAYING);

      assert.equal(gameState.missCostsLife(), false);
    });

    it('switches to Arcade mode with 60-second countdown timer and score-penalty bombs', () => {
      const gameState = new GameState();
      gameState.setMode(GAME_MODES.ARCADE);
      gameState.setState(STATES.PLAYING);

      assert.equal(gameState.mode, GAME_MODES.ARCADE);
      assert.equal(gameState.hasTimer(), true);
      assert.equal(gameState.timeRemaining, 60);

      // Countdown test
      gameState.update(5.0);
      assert.equal(Math.ceil(gameState.timeRemaining), 55);

      // Bomb strike penalty without ending game
      gameState.setScore(100);
      gameState.registerBombHit();
      assert.equal(gameState.score, 90);
      assert.equal(gameState.getState(), STATES.PLAYING);
    });

    it('switches to Challenge mode with progressive ramping rules', () => {
      const gameState = new GameState();
      gameState.setMode(GAME_MODES.CHALLENGE);

      assert.equal(gameState.mode, GAME_MODES.CHALLENGE);
      assert.equal(gameState.hasLives(), true);
      assert.equal(gameState.lives, 3);
      assert.equal(gameState.getModeConfig().dynamicGravity, true);
      assert.equal(gameState.getModeConfig().dynamicSpeed, true);
    });

    it('tracks independent High Scores for each game mode', () => {
      const gameState = new GameState();

      // Classic High Score
      gameState.setMode(GAME_MODES.CLASSIC);
      gameState.setScore(450);
      assert.equal(gameState.loadBestScore(GAME_MODES.CLASSIC), 450);

      // Arcade High Score
      gameState.setMode(GAME_MODES.ARCADE);
      assert.equal(gameState.bestScore, 0);
      gameState.setScore(1280);
      assert.equal(gameState.loadBestScore(GAME_MODES.ARCADE), 1280);

      // Zen High Score
      gameState.setMode(GAME_MODES.ZEN);
      assert.equal(gameState.bestScore, 0);
      gameState.setScore(820);
      assert.equal(gameState.loadBestScore(GAME_MODES.ZEN), 820);

      // Verify Classic best score was preserved independently
      assert.equal(gameState.loadBestScore(GAME_MODES.CLASSIC), 450);
    });
  });
});
