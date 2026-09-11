import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GameState, GAME_MODES } from '../src/game/GameState.js';
import { CollisionManager } from '../src/game/CollisionManager.js';
import { FruitManager } from '../src/game/FruitManager.js';
import { BladeTrail } from '../src/entities/BladeTrail.js';
import { getSegmentCircleIntersection } from '../src/utils/collision.js';

describe('Arcade Combo & Fever System Tests', () => {
  let gameState;

  beforeEach(() => {
    gameState = new GameState();
    gameState.setMode(GAME_MODES.CLASSIC);
    gameState.resetSession();
  });

  describe('Combo Tracking & Window Expiry', () => {
    it('tracks consecutive slices and refreshes combo timer', () => {
      assert.equal(gameState.combo, 0);
      assert.equal(gameState.consecutiveSlices, 0);

      const r1 = gameState.registerSlice('watermelon');
      assert.equal(r1.combo, 1);
      assert.equal(gameState.consecutiveSlices, 1);
      assert.ok(gameState.comboTimer > 0);

      const initialTimer = gameState.comboTimer;
      // Advance time slightly
      gameState.update(0.5);
      assert.ok(gameState.comboTimer < initialTimer);

      // Subsequent slice refreshes window
      const r2 = gameState.registerSlice('apple');
      assert.equal(r2.combo, 2);
      assert.equal(gameState.consecutiveSlices, 2);
      assert.ok(gameState.comboTimer >= initialTimer - 0.05);
    });

    it('resets combo and multiplier when combo timer expires', () => {
      gameState.registerSlice('watermelon');
      gameState.registerSlice('apple');
      gameState.registerSlice('orange');

      assert.equal(gameState.consecutiveSlices, 3);
      assert.ok(gameState.comboMultiplier >= 2);

      // Advance time beyond the combo window timeout
      gameState.update(3.0);

      assert.equal(gameState.combo, 0);
      assert.equal(gameState.consecutiveSlices, 0);
      assert.equal(gameState.comboMultiplier, 1);
      assert.equal(gameState.comboTimer, 0);
    });

    it('tracks and saves highest combo in session and progression', () => {
      assert.equal(gameState.maxCombo, 0);

      for (let i = 0; i < 5; i++) {
        gameState.registerSlice('watermelon');
      }

      assert.equal(gameState.maxCombo, 5);
      assert.equal(gameState.highestCombo, 5);
      assert.ok(gameState.progression.highestCombo >= 5);

      // Expire combo
      gameState.update(3.0);
      assert.equal(gameState.combo, 0);

      // Highest combo remains intact
      assert.equal(gameState.maxCombo, 5);
      assert.equal(gameState.highestCombo, 5);
    });

    it('escalates combo multiplier across consecutive slices', () => {
      // 1-2 slices = 1x multiplier
      const s1 = gameState.registerSlice('watermelon');
      assert.equal(s1.multiplier, 1);

      const s2 = gameState.registerSlice('apple');
      assert.equal(s2.multiplier, 1);

      // 3-5 slices = 2x multiplier
      const s3 = gameState.registerSlice('orange');
      assert.equal(s3.multiplier, 2);

      // 6-8 slices = 3x multiplier
      gameState.registerSlice('banana');
      gameState.registerSlice('banana');
      const s6 = gameState.registerSlice('banana');
      assert.equal(s6.multiplier, 3);
    });
  });

  describe('Perfect Slice Detection & Scoring', () => {
    it('detects a clean center cut with offsetRatio <= 0.28', () => {
      // Circle at (100, 100) with radius 40
      // Slicing through (100, 100) exactly: offset is 0
      const centerHit = getSegmentCircleIntersection(50, 100, 150, 100, 100, 100, 40);
      assert.ok(centerHit !== null);
      assert.equal(centerHit.hit, true);
      assert.ok(centerHit.offsetRatio <= 0.05);

      // Slicing through y = 108: dist is 8, 8 / 40 = 0.20 <= 0.28 (Perfect Slice)
      const nearHit = getSegmentCircleIntersection(50, 108, 150, 108, 100, 100, 40);
      assert.ok(nearHit !== null);
      assert.ok(nearHit.offsetRatio <= 0.25);

      // Slicing through y = 130: dist is 30, 30 / 40 = 0.75 > 0.28 (Normal Slice)
      const edgeHit = getSegmentCircleIntersection(50, 130, 150, 130, 100, 100, 40);
      assert.ok(edgeHit !== null);
      assert.ok(edgeHit.offsetRatio > 0.5);
    });

    it('awards +10 bonus points on a Perfect Slice', () => {
      gameState.resetSession();
      // Normal slice on 1-point watermelon
      const normalResult = gameState.registerSlice('watermelon', { isPerfectSlice: false });
      assert.equal(normalResult.pointsEarned, 1);
      assert.equal(normalResult.isPerfectSlice, false);

      gameState.resetSession();
      // Perfect slice on 1-point watermelon
      const perfectResult = gameState.registerSlice('watermelon', { isPerfectSlice: true });
      assert.equal(perfectResult.isPerfectSlice, true);
      assert.equal(perfectResult.perfectBonus, 10);
      // 1 (base * 1) + 10 (perfect) = 11
      assert.equal(perfectResult.pointsEarned, 11);
    });
  });

  describe('Multi-Slice Continuous Swipes', () => {
    it('awards chain bonus points for slicing multiple fruits in one swipe', () => {
      gameState.resetSession();
      // 2-fruit multi-slice: chain bonus is +2
      const doubleSlice = gameState.registerSlice('watermelon', { multiSliceCount: 2 });
      assert.equal(doubleSlice.multiSliceCount, 2);
      assert.equal(doubleSlice.chainBonus, 2);
      assert.equal(doubleSlice.pointsEarned, 3); // 1 + 2

      gameState.resetSession();
      // 3-fruit multi-slice: chain bonus is +5
      const tripleSlice = gameState.registerSlice('apple', { multiSliceCount: 3 });
      assert.equal(tripleSlice.chainBonus, 5);
      assert.equal(tripleSlice.pointsEarned, 6); // 1 + 5

      gameState.resetSession();
      // 4-fruit multi-slice: chain bonus is +10
      const quadSlice = gameState.registerSlice('orange', { multiSliceCount: 4 });
      assert.equal(quadSlice.chainBonus, 10);
      assert.equal(quadSlice.pointsEarned, 11); // 1 + 10

      gameState.resetSession();
      // 5-fruit multi-slice: chain bonus is +20
      const ultraSlice = gameState.registerSlice('banana', { multiSliceCount: 5 });
      assert.equal(ultraSlice.chainBonus, 20);
      // banana base is 2: 2 + 20 = 22
      assert.equal(ultraSlice.pointsEarned, 22);
    });

    it('integrates with CollisionManager to track multi-slice batches', () => {
      const collisionManager = new CollisionManager();
      const fruitManager = new FruitManager();

      // Spawn two fruits on screen
      fruitManager.launchFruit({ x: 200, y: 300, vx: 0, vy: -50, type: 'apple' });
      fruitManager.launchFruit({ x: 300, y: 300, vx: 0, vy: -50, type: 'orange' });

      let slicesReported = 0;
      let highestMultiSlice = 0;

      // Slice through both fruits in a single horizontal swipe segment
      const cutSegment = {
        p1: { x: 150, y: 300 },
        p2: { x: 350, y: 300 },
        speed: 500,
        swipeId: 101,
      };

      collisionManager.checkSliceCollisions(
        [cutSegment],
        fruitManager,
        (_fruit, _seg, _pt, totalHits, meta) => {
          slicesReported++;
          if (meta.multiSliceCount > highestMultiSlice) {
            highestMultiSlice = meta.multiSliceCount;
          }
        }
      );

      assert.equal(slicesReported, 2);
      assert.equal(highestMultiSlice, 2);
    });
  });

  describe('Fever Mode Mechanics & Transitions', () => {
    it('triggers Fever Mode when reaching configurable combo threshold', () => {
      assert.equal(gameState.isFeverActive, false);
      const threshold = gameState.feverThreshold;
      assert.ok(threshold >= 7);

      for (let i = 0; i < threshold - 1; i++) {
        gameState.registerSlice('watermelon');
        assert.equal(gameState.isFeverActive, false);
      }

      // Reaching threshold activates Fever
      const triggerSlice = gameState.registerSlice('watermelon');
      assert.equal(gameState.isFeverActive, true);
      assert.equal(triggerSlice.isFever, true);
      assert.ok(gameState.feverTimer > 0);
    });

    it('increases score multiplier during Fever Mode', () => {
      gameState.enterFeverMode();
      assert.equal(gameState.isFeverActive, true);

      // Multiplier should include +2x fever bonus
      const feverMult = gameState.comboMultiplier;
      assert.ok(feverMult >= 3); // 1 (base) + 2 (fever)

      const result = gameState.registerSlice('watermelon');
      assert.ok(result.multiplier >= 3);
      assert.equal(result.isFever, true);
    });

    it('counts down Fever duration and ends with score preserved', () => {
      gameState.enterFeverMode();
      const initialScore = 150;
      gameState.setScore(initialScore);

      let feverEventActive = null;
      gameState.subscribeFever((active) => {
        feverEventActive = active;
      });

      assert.equal(feverEventActive, true);

      // Update less than fever duration
      gameState.update(3.0);
      assert.equal(gameState.isFeverActive, true);

      // Update past remaining fever duration
      gameState.update(5.0);
      assert.equal(gameState.isFeverActive, false);
      assert.equal(feverEventActive, false);

      // Score is strictly preserved upon Fever end!
      assert.equal(gameState.score, initialScore);
    });

    it('modulates FruitManager wave interval during Fever', () => {
      const fruitManager = new FruitManager();
      fruitManager.setGameState(gameState);

      // Normal wave update
      gameState.isFeverActive = false;
      fruitManager.waveTimer = 0;
      fruitManager.update(0.016, 800, 600);
      const normalWaveInterval = fruitManager.waveTimer;

      // Fever wave update
      gameState.isFeverActive = true;
      fruitManager.waveTimer = 0;
      fruitManager.update(0.016, 800, 600);
      const feverWaveInterval = fruitManager.waveTimer;

      // Fever waves spawn significantly faster (shorter interval)
      assert.ok(feverWaveInterval < normalWaveInterval);
    });

    it('updates BladeTrail fever mode state', () => {
      const bladeTrail = new BladeTrail({
        update: () => {},
        isDown: false,
        getSwipeSpeed: () => 0,
        getTrailPoints: () => [],
        reset: () => {},
      });

      assert.equal(bladeTrail.isFeverActive, false);
      bladeTrail.setFever(true);
      assert.equal(bladeTrail.isFeverActive, true);
      bladeTrail.setFever(false);
      assert.equal(bladeTrail.isFeverActive, false);
    });

    it('ends Fever and resets combo on bomb strike while preserving remaining score', () => {
      gameState.enterFeverMode();
      gameState.setScore(200);

      assert.equal(gameState.isFeverActive, true);

      // Bomb strike in Classic mode fatal or penalty
      gameState.registerBombHit();

      assert.equal(gameState.isFeverActive, false);
      assert.equal(gameState.combo, 0);
      assert.equal(gameState.consecutiveSlices, 0);
      assert.equal(gameState.comboMultiplier, 1);
    });
  });
});
