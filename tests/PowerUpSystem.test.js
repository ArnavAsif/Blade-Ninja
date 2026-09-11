import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { PowerUpManager, POWER_UP_TYPES, POWER_UP_CONFIGS } from '../src/game/PowerUpManager.js';
import { GameState, GAME_MODES } from '../src/game/GameState.js';
import { FruitManager } from '../src/game/FruitManager.js';
import { CollisionManager } from '../src/game/CollisionManager.js';
import { BladeTrail } from '../src/entities/BladeTrail.js';

describe('Premium Power-Up System Tests', () => {
  let powerUpManager;
  let gameState;

  beforeEach(() => {
    gameState = new GameState();
    powerUpManager = new PowerUpManager();
    powerUpManager.setGameState(gameState);
    gameState.setPowerUpManager(powerUpManager);
  });

  describe('PowerUpManager Lifecycle & Modifiers', () => {
    it('activates SLOW_MOTION and correctly reports factor', () => {
      assert.equal(powerUpManager.isSlowMotionActive().active, false);
      assert.equal(powerUpManager.isSlowMotionActive().factor, 1.0);

      powerUpManager.activate(POWER_UP_TYPES.SLOW_MOTION);
      const slow = powerUpManager.isSlowMotionActive();
      assert.equal(slow.active, true);
      assert.equal(slow.factor, 0.40);
    });

    it('activates FRENZY and reports active state', () => {
      assert.equal(powerUpManager.isFrenzyActive(), false);
      powerUpManager.activate(POWER_UP_TYPES.FRENZY);
      assert.equal(powerUpManager.isFrenzyActive(), true);
    });

    it('activates DOUBLE_SCORE and multiplies score', () => {
      assert.equal(powerUpManager.isDoubleScoreActive(), false);
      assert.equal(powerUpManager.getScoreMultiplier(), 1);

      powerUpManager.activate(POWER_UP_TYPES.DOUBLE_SCORE);
      assert.equal(powerUpManager.isDoubleScoreActive(), true);
      assert.equal(powerUpManager.getScoreMultiplier(), 2);
    });

    it('activates BLADE_BOOST and reports active state', () => {
      assert.equal(powerUpManager.isBladeBoostActive(), false);
      powerUpManager.activate(POWER_UP_TYPES.BLADE_BOOST);
      assert.equal(powerUpManager.isBladeBoostActive(), true);
    });

    it('counts down remaining time and fires expiration callback', () => {
      let expiredType = null;
      powerUpManager.onExpire = (type) => {
        expiredType = type;
      };

      powerUpManager.activate(POWER_UP_TYPES.SLOW_MOTION);
      const duration = POWER_UP_CONFIGS[POWER_UP_TYPES.SLOW_MOTION].duration;

      // Advance by half duration
      powerUpManager.update(duration * 0.5);
      assert.equal(powerUpManager.isSlowMotionActive().active, true);
      assert.equal(expiredType, null);

      // Advance past remaining duration
      powerUpManager.update(duration * 0.6);
      assert.equal(powerUpManager.isSlowMotionActive().active, false);
      assert.equal(expiredType, POWER_UP_TYPES.SLOW_MOTION);
    });

    it('notifies subscribers with normalized progress and remaining time', () => {
      let latestActive = [];
      const unsub = powerUpManager.subscribe((list) => {
        latestActive = list;
      });

      powerUpManager.activate(POWER_UP_TYPES.DOUBLE_SCORE);
      assert.equal(latestActive.length, 1);
      assert.equal(latestActive[0].type, POWER_UP_TYPES.DOUBLE_SCORE);
      assert.equal(latestActive[0].progress, 1.0);

      // Advance time by 3 seconds out of 6
      powerUpManager.update(3.0);
      assert.equal(latestActive.length, 1);
      assert.ok(Math.abs(latestActive[0].progress - 0.5) < 0.05);
      assert.ok(Math.abs(latestActive[0].remainingTime - 3.0) < 0.05);

      unsub();
    });

    it('enforces spawn cooldown and suppresses power-up spawning during Frenzy', () => {
      powerUpManager.spawnCooldown = 0;
      assert.equal(powerUpManager.canSpawnPowerUp(false), true);

      // If active power-up entity is on screen, don't spawn
      assert.equal(powerUpManager.canSpawnPowerUp(true), false);

      // If in Frenzy, don't spawn
      powerUpManager.activate(POWER_UP_TYPES.FRENZY);
      assert.equal(powerUpManager.canSpawnPowerUp(false), false);
    });
  });

  describe('GameState Integration', () => {
    it('multiplies score by 2x when DOUBLE_SCORE is active', () => {
      gameState.resetSession();
      // Slice a watermelon (base 1 point) with 1 combo = 1 point
      const normalResult = gameState.registerSlice('watermelon');
      assert.equal(normalResult.pointsEarned, 1);

      // Reset and activate DOUBLE_SCORE
      gameState.resetSession();
      powerUpManager.activate(POWER_UP_TYPES.DOUBLE_SCORE);
      const boostedResult = gameState.registerSlice('watermelon');
      assert.equal(boostedResult.pointsEarned, 2);
      assert.equal(boostedResult.isDoubleScore, true);
    });

    it('awards +1 bonus score per fruit sliced during FRENZY', () => {
      gameState.resetSession();
      const normalResult = gameState.registerSlice('watermelon');
      assert.equal(normalResult.pointsEarned, 1);

      gameState.resetSession();
      powerUpManager.activate(POWER_UP_TYPES.FRENZY);
      const frenzyResult = gameState.registerSlice('watermelon');
      // base is 1 + 1 (frenzy) = 2
      assert.equal(frenzyResult.pointsEarned, 2);
    });

    it('extends combo opportunity timeout window during FRENZY', () => {
      gameState.resetSession();
      const normalTimeout = gameState.getEffectiveComboTimeout();

      powerUpManager.activate(POWER_UP_TYPES.FRENZY);
      const frenzyTimeout = gameState.getEffectiveComboTimeout();
      assert.ok(frenzyTimeout >= 0.85);
      assert.ok(frenzyTimeout > normalTimeout);
    });

    it('restores lost life up to maximum life limit', () => {
      gameState.setMode(GAME_MODES.CLASSIC);
      gameState.resetSession();
      assert.equal(gameState.lives, 3);
      assert.equal(gameState.maxLives, 3);

      // Lose 1 life
      gameState.loseLife();
      assert.equal(gameState.lives, 2);

      // Recover 1 life
      const res = gameState.recoverLife(1, 'powerup_life');
      assert.equal(res.recovered, true);
      assert.equal(gameState.lives, 3);

      // Trying to recover above max lives fails cleanly
      const overMax = gameState.recoverLife(1, 'powerup_life');
      assert.equal(overMax.recovered, false);
      assert.equal(gameState.lives, 3);
    });
  });

  describe('FruitManager & Physics Modulation', () => {
    let fruitManager;

    beforeEach(() => {
      fruitManager = new FruitManager();
      fruitManager.setGameState(gameState);
      fruitManager.setPowerUpManager(powerUpManager);
    });

    it('slows fruit and hazard physics during SLOW_MOTION', () => {
      // Launch a fruit with zero gravity to test pure velocity integration
      fruitManager.launchFruit({
        x: 400,
        y: 500,
        vx: 100,
        vy: -400,
        gravity: 0,
        type: 'watermelon',
        rotationSpeed: 2,
      });

      const fruits = fruitManager.fruitPool.getActiveItems();
      assert.equal(fruits.length, 1);
      const fruit = fruits[0];
      const initialY = fruit.y;

      // Update in normal mode by 0.1s: deltaY should be -400 * 0.1 = -40
      fruitManager.update(0.1, 800, 600);
      const normalDeltaY = fruit.y - initialY;
      assert.equal(normalDeltaY, -40);

      // Reset position and activate SLOW_MOTION: deltaY should be -400 * (0.1 * 0.4) = -16
      fruit.y = initialY;
      powerUpManager.activate(POWER_UP_TYPES.SLOW_MOTION);

      fruitManager.update(0.1, 800, 600);
      const slowDeltaY = fruit.y - initialY;
      assert.equal(slowDeltaY, -16);
      assert.equal(slowDeltaY / normalDeltaY, 0.40);
    });

    it('launches, tracks, and slices power-up entities into halves', () => {
      fruitManager.launchPowerUp(800, 600, POWER_UP_TYPES.SLOW_MOTION);
      const powerUps = fruitManager.powerUpPool.getActiveItems();
      assert.equal(powerUps.length, 1);
      const pu = powerUps[0];
      assert.equal(pu.type, POWER_UP_TYPES.SLOW_MOTION);
      assert.equal(pu.active, true);

      // Slice power-up
      const cut = { p1: { x: pu.x - 20, y: pu.y }, p2: { x: pu.x + 20, y: pu.y }, speed: 500 };
      fruitManager.slicePowerUp(pu, cut, { x: pu.x, y: pu.y });

      assert.equal(pu.active, false);
      const slicedHalves = fruitManager.slicedPowerUpPool.getActiveItems();
      assert.equal(slicedHalves.length, 2);
      assert.equal(slicedHalves[0].type, POWER_UP_TYPES.SLOW_MOTION);
      assert.equal(slicedHalves[1].type, POWER_UP_TYPES.SLOW_MOTION);
    });
  });

  describe('CollisionManager Integration', () => {
    let collisionManager;
    let fruitManager;

    beforeEach(() => {
      collisionManager = new CollisionManager();
      fruitManager = new FruitManager();
      fruitManager.setGameState(gameState);
      fruitManager.setPowerUpManager(powerUpManager);
    });

    it('detects blade cuts on active power-up entities', () => {
      fruitManager.launchPowerUp(800, 600, POWER_UP_TYPES.DOUBLE_SCORE);
      const pu = fruitManager.powerUpPool.getActiveItems()[0];
      pu.x = 400;
      pu.y = 300;

      let hitDetected = false;
      let hitType = null;

      const cutSegment = { p1: { x: 350, y: 300 }, p2: { x: 450, y: 300 }, speed: 600 };

      collisionManager.checkSliceCollisions(
        [cutSegment],
        fruitManager,
        () => {},
        () => {},
        (powerUp) => {
          hitDetected = true;
          hitType = powerUp.type;
        }
      );

      assert.equal(hitDetected, true);
      assert.equal(hitType, POWER_UP_TYPES.DOUBLE_SCORE);
      assert.equal(pu.active, false);
    });

    it('expands slice reach when BLADE_BOOST is active', () => {
      fruitManager.launchFruit({
        x: 400,
        y: 300,
        vx: 0,
        vy: 0,
        gravity: 0,
        type: 'watermelon',
        rotationSpeed: 0,
      });
      const fruit = fruitManager.fruitPool.getActiveItems()[0];
      fruit.radius = 35;

      // Cut passes 42px away: outside normal radius 35, but within boosted radius (35 + 14 = 49)
      const nearMissCut = { p1: { x: 300, y: 342 }, p2: { x: 500, y: 342 }, speed: 600 };

      // Normal mode: should miss
      let hitNormal = false;
      collisionManager.checkSliceCollisions(
        [nearMissCut],
        fruitManager,
        () => { hitNormal = true; },
        () => {},
        null,
        false
      );
      assert.equal(hitNormal, false);

      // Boosted mode: should hit!
      let hitBoosted = false;
      collisionManager.checkSliceCollisions(
        [nearMissCut],
        fruitManager,
        () => { hitBoosted = true; },
        () => {},
        null,
        true
      );
      assert.equal(hitBoosted, true);
    });
  });

  describe('BladeTrail Boost Mode', () => {
    it('toggles Blade Boost on BladeTrail', () => {
      const inputMock = { update: () => {}, isDown: false, getSwipeSpeed: () => 0, getTrailPoints: () => [], reset: () => {} };
      const bladeTrail = new BladeTrail(inputMock);

      assert.equal(bladeTrail.isBladeBoostActive, false);
      bladeTrail.setBladeBoost(true);
      assert.equal(bladeTrail.isBladeBoostActive, true);
      bladeTrail.setBladeBoost(false);
      assert.equal(bladeTrail.isBladeBoostActive, false);
    });
  });
});
