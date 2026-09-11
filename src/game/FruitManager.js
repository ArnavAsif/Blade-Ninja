/**
 * FruitManager handles wave choreography, parabolic ballistic launching,
 * progressive difficulty scaling, and zero-allocation object pooling.
 */

import { Fruit, FRUIT_TYPES, FRUIT_CONFIGS } from '../entities/Fruit.js';
import { Bomb } from '../entities/Bomb.js';
import { SlicedFruit } from '../entities/SlicedFruit.js';
import { ObjectPool } from '../utils/pool.js';
import { randomRange, randomChoice, lerp } from '../utils/math.js';
import { getGameModeConfig } from './GameModeConfig.js';

const AVAILABLE_FRUIT_TYPES = [
  FRUIT_TYPES.WATERMELON,
  FRUIT_TYPES.APPLE,
  FRUIT_TYPES.ORANGE,
  FRUIT_TYPES.BANANA,
  FRUIT_TYPES.PINEAPPLE,
  FRUIT_TYPES.STRAWBERRY,
  FRUIT_TYPES.DRAGON_FRUIT,
  FRUIT_TYPES.COCONUT,
  FRUIT_TYPES.KIWI,
  FRUIT_TYPES.PEACH,
];

export class FruitManager {
  constructor() {
    this.fruitPool = new ObjectPool(
      () => new Fruit(),
      (fruit, ...args) => fruit.reset(...args),
      35
    );

    this.bombPool = new ObjectPool(
      () => new Bomb(),
      (bomb, ...args) => bomb.reset(...args),
      6
    );

    this.slicedFruitPool = new ObjectPool(
      () => new SlicedFruit(),
      (sliced, ...args) => sliced.reset(...args),
      50
    );

    // Difficulty and pacing configuration
    this.config = {
      initialDelay: 0.8,
      baseInterval: 2.6,
      minInterval: 1.25,
      difficultyRampDuration: 75,
      baseGravity: 1020,
      minApexRatio: 0.20,
      maxApexRatio: 0.40,
      maxActiveCap: 8,
    };

    // Mode configuration
    this.mode = 'classic';
    this.modeConfig = getGameModeConfig(this.mode);
    this.allowBombs = true;

    this.sessionTime = 0;
    this.waveTimer = this.config.initialDelay;
    this.difficulty = 0; // 0.0 to 1.0
    this.stopSpawning = false;
    this.onFruitMissed = null;

    // Queue for staggered multi-fruit wave launches
    this.pendingLaunches = [];
  }

  setModeConfig(modeConfig) {
    if (!modeConfig) return;
    this.modeConfig = modeConfig;
    this.mode = modeConfig.id;
    this.allowBombs = Boolean(modeConfig.bombEnabled);
    this.config.baseInterval = modeConfig.spawnRate.baseInterval;
    this.config.minInterval = modeConfig.spawnRate.minInterval;
    this.config.initialDelay = modeConfig.spawnRate.initialDelay;
    this.config.maxActiveCap = modeConfig.spawnRate.maxActiveCap;
    this.config.difficultyRampDuration = modeConfig.difficultyRampDuration;
  }

  setMode(mode) {
    this.setModeConfig(getGameModeConfig(mode));
  }

  update(dt, screenWidth = 800, screenHeight = 600, onFruitMissed = null) {
    this.sessionTime += dt;

    // Calculate normalized difficulty progression based on mode ramp and multiplier
    const rampDuration = this.config.difficultyRampDuration;
    const diffMultiplier = this.modeConfig ? this.modeConfig.difficultyMultiplier : 1.0;
    this.difficulty = Math.min(1.0, (this.sessionTime / rampDuration) * diffMultiplier);

    if (!this.stopSpawning) {
      // 1. Process delayed launches in staggered waves
      for (let i = this.pendingLaunches.length - 1; i >= 0; i--) {
        const pending = this.pendingLaunches[i];
        pending.delay -= dt;
        if (pending.delay <= 0) {
          if (pending.isBomb) {
            this.launchBomb(screenWidth, screenHeight);
          } else {
            this.launchFruit(pending.params);
          }
          this.pendingLaunches.splice(i, 1);
        }
      }

      // 2. Wave trigger countdown
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.triggerNextWave(screenWidth, screenHeight);

        // Interpolate next wave interval based on difficulty
        const nextInterval = lerp(
          this.config.baseInterval,
          this.config.minInterval,
          this.difficulty
        );
        // Add slight jitter so waves do not feel metronomic
        this.waveTimer = nextInterval * randomRange(0.88, 1.12);
      }
    }

    // 3. Update active fruits and report missed ones
    const activeFruits = this.fruitPool.getActiveItems();
    for (let i = activeFruits.length - 1; i >= 0; i--) {
      const fruit = activeFruits[i];
      fruit.update(dt, screenWidth, screenHeight);

      if (!fruit.active) {
        if (!fruit.sliced && !fruit.missedHandled) {
          fruit.missedHandled = true;
          const callback = onFruitMissed || this.onFruitMissed;
          if (callback) {
            callback(fruit);
          }
        }
        this.fruitPool.release(fruit);
      }
    }

    // 4. Active hazards and sliced fruit pieces
    const activeBombs = this.bombPool.getActiveItems();
    for (let i = activeBombs.length - 1; i >= 0; i--) {
      const bomb = activeBombs[i];
      bomb.update(dt, screenWidth, screenHeight);
      if (!bomb.active) {
        this.bombPool.release(bomb);
      }
    }

    const activeSliced = this.slicedFruitPool.getActiveItems();
    for (let i = activeSliced.length - 1; i >= 0; i--) {
      const piece = activeSliced[i];
      piece.update(dt, screenHeight);
      if (!piece.active) {
        this.slicedFruitPool.release(piece);
      }
    }
  }

  /**
   * Plans and schedules the next wave of fruits.
   */
  triggerNextWave(screenWidth, screenHeight) {
    if (this.stopSpawning) return;

    const activeCount = this.fruitPool.getActiveCount() + this.pendingLaunches.length;
    if (activeCount >= this.config.maxActiveCap) {
      // Defer wave if screen is already congested
      this.waveTimer = 0.6;
      return;
    }

    // Determine fruits in wave based on active mode and difficulty
    let waveCount = 1;
    if (this.mode === 'challenge') {
      if (this.difficulty < 0.20) {
        waveCount = Math.random() < 0.35 ? 2 : 1;
      } else if (this.difficulty < 0.50) {
        waveCount = Math.random() < 0.55 ? 3 : 2;
      } else if (this.difficulty < 0.80) {
        waveCount = Math.random() < 0.45 ? 4 : 3;
      } else {
        waveCount = Math.random() < 0.4 ? 5 : 4;
      }
    } else if (this.mode === 'arcade') {
      if (this.difficulty < 0.3) {
        waveCount = Math.random() < 0.5 ? 2 : 1;
      } else if (this.difficulty < 0.7) {
        waveCount = Math.random() < 0.5 ? 3 : 2;
      } else {
        waveCount = Math.random() < 0.45 ? 4 : 3;
      }
    } else if (this.mode === 'zen') {
      if (this.difficulty < 0.4) {
        waveCount = Math.random() < 0.35 ? 2 : 1;
      } else {
        waveCount = Math.random() < 0.6 ? 2 : 3;
      }
    } else {
      // Classic
      if (this.difficulty < 0.25) {
        waveCount = Math.random() < 0.3 ? 2 : 1;
      } else if (this.difficulty < 0.55) {
        waveCount = Math.random() < 0.6 ? 2 : (Math.random() < 0.25 ? 3 : 1);
      } else if (this.difficulty < 0.8) {
        waveCount = Math.random() < 0.5 ? 3 : 2;
      } else {
        waveCount = Math.random() < 0.4 ? 4 : 3;
      }
    }

    // Ensure we do not exceed active cap
    const allowed = Math.max(1, this.config.maxActiveCap - activeCount);
    waveCount = Math.min(waveCount, allowed);

    // Pick wave strategy
    if (waveCount === 1) {
      this.spawnSingleFruit(screenWidth, screenHeight);
    } else if (waveCount === 2) {
      if (Math.random() < 0.6) {
        this.spawnCrossingDualWave(screenWidth, screenHeight);
      } else {
        this.spawnStaggeredWave(2, screenWidth, screenHeight);
      }
    } else {
      if (Math.random() < 0.5) {
        this.spawnSpreadWave(waveCount, screenWidth, screenHeight);
      } else {
        this.spawnStaggeredWave(waveCount, screenWidth, screenHeight);
      }
    }

    // Scale hazardous bomb appearance using mode configuration
    if (this.allowBombs && this.modeConfig?.bombProbability) {
      const bp = this.modeConfig.bombProbability;
      if (this.difficulty >= bp.minDifficulty) {
        const progress = (this.difficulty - bp.minDifficulty) / Math.max(0.01, 1.0 - bp.minDifficulty);
        const bombChance = lerp(bp.min, bp.max, Math.min(1.0, Math.max(0, progress)));
        const activeBombs = this.bombPool.getActiveCount();
        if (activeBombs < bp.maxActive && Math.random() < bombChance) {
          this.pendingLaunches.push({
            delay: randomRange(0.12, 0.38),
            isBomb: true,
          });
        }
      }
    }
  }

  /**
   * Computes a safe vertical apex tailored specifically for landscape aspect ratios.
   * Prevents fruits from flying underneath top HUD components (Score, Combo, Lives, Pause)
   * while maintaining full, natural arc flight across mobile and desktop landscape screens.
   */
  getSafeApexY(screenHeight, minBias = 0, maxBias = 0) {
    const hudSafeTop = Math.max(105, screenHeight * 0.26);
    const lowerApexLimit = Math.max(hudSafeTop + 45, screenHeight * 0.50);

    const minRatio = this.config.minApexRatio + minBias;
    const maxRatio = this.config.maxApexRatio + maxBias;
    const rawApex = screenHeight * randomRange(minRatio, maxRatio);

    return Math.max(hudSafeTop, Math.min(lowerApexLimit, rawApex));
  }

  /**
   * Calculates ballistic trajectory guaranteeing fruits stay within visible canvas bounds
   * with generous horizontal travel space optimized for landscape viewports.
   */
  computeLaunchParams(xStart, targetApexX, targetApexY, screenWidth, screenHeight, fruitType = null) {
    const minX = Math.max(50, screenWidth * 0.08);
    const maxX = Math.min(screenWidth - 50, screenWidth * 0.92);
    const safeXStart = Math.max(minX, Math.min(maxX, xStart));
    const safeTargetApexX = Math.max(minX, Math.min(maxX, targetApexX));

    // Dynamic gravity scaling to fit current screen height + mode configuration
    let gravityMultiplier = this.modeConfig?.gravityMultiplier ?? 1.0;
    if (this.modeConfig?.dynamicGravity) {
      gravityMultiplier = lerp(1.0, 1.25, this.difficulty);
    }

    let speedMultiplier = this.modeConfig?.launchSpeedMultiplier ?? 1.0;
    if (this.modeConfig?.dynamicSpeed) {
      speedMultiplier = lerp(1.0, 1.18, this.difficulty);
    }

    // Gravity tuned specifically for landscape viewports (height 320px - 900px)
    const gravityScale = Math.max(0.68, Math.min(1.35, screenHeight / 750));
    const gravity = this.config.baseGravity * gravityScale * gravityMultiplier;
    const fruitConfig = fruitType ? FRUIT_CONFIGS[fruitType] : null;
    const weight = fruitConfig?.weight ?? 1.0;
    const effectiveGravity = gravity * weight;

    const yStart = screenHeight + 50 + randomRange(10, 30);
    const deltaY = yStart - targetApexY;

    // Initial vertical velocity needed to peak at targetApexY taking weight into account
    let vy = -Math.sqrt(2 * effectiveGravity * deltaY);

    // Time to reach peak apex: vy / effectiveGravity
    const timeToApex = -vy / effectiveGravity;

    // Horizontal velocity to arrive at targetApexX at peak
    let vx = (safeTargetApexX - safeXStart) / timeToApex;

    // Apply speed multiplier for challenge/arcade modes while preserving trajectory shape
    if (speedMultiplier !== 1.0) {
      vy *= speedMultiplier;
      vx *= speedMultiplier;
    }

    // Natural spin biased toward flight direction with fruit-specific rotation profile
    const spinDirection = vx >= 0 ? 1 : -1;
    const [minRot, maxRot] = fruitConfig?.rotationSpeedRange ?? [1.8, 4.2];
    const rotationSpeed = spinDirection * randomRange(minRot, maxRot);

    return {
      x: safeXStart,
      y: yStart,
      vx,
      vy,
      gravity,
      type: fruitType,
      rotationSpeed,
    };
  }

  spawnSingleFruit(screenWidth, screenHeight) {
    const xStart = screenWidth * randomRange(0.14, 0.86);
    const targetApexX = screenWidth * (xStart < screenWidth * 0.5 ? randomRange(0.42, 0.76) : randomRange(0.24, 0.58));
    const targetApexY = this.getSafeApexY(screenHeight);
    const type = randomChoice(AVAILABLE_FRUIT_TYPES);

    const params = this.computeLaunchParams(xStart, targetApexX, targetApexY, screenWidth, screenHeight, type);
    this.launchFruit(params);
  }

  spawnCrossingDualWave(screenWidth, screenHeight) {
    const types = this.pickDistinctFruitTypes(2);

    // Fruit 1: Launched from left side aiming toward right center
    const x1 = screenWidth * randomRange(0.10, 0.26);
    const apexX1 = screenWidth * randomRange(0.48, 0.74);
    const apexY1 = this.getSafeApexY(screenHeight, 0.03, 0);
    const params1 = this.computeLaunchParams(x1, apexX1, apexY1, screenWidth, screenHeight, types[0]);

    // Fruit 2: Launched from right side aiming toward left center
    const x2 = screenWidth * randomRange(0.74, 0.90);
    const apexX2 = screenWidth * randomRange(0.26, 0.52);
    const apexY2 = this.getSafeApexY(screenHeight, 0, -0.03);
    const params2 = this.computeLaunchParams(x2, apexX2, apexY2, screenWidth, screenHeight, types[1]);

    this.launchFruit(params1);
    // Slight stagger of 80ms for natural feel
    this.pendingLaunches.push({ delay: 0.08, params: params2 });
  }

  spawnSpreadWave(count, screenWidth, screenHeight) {
    const types = this.pickDistinctFruitTypes(count);
    const centerZoneX = screenWidth * randomRange(0.36, 0.64);
    const spacing = Math.min(100, (screenWidth * 0.65) / count);

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spacing;
      const xStart = centerZoneX + offset;
      const targetApexX = xStart + offset * 0.45;
      const targetApexY = this.getSafeApexY(screenHeight);

      const params = this.computeLaunchParams(xStart, targetApexX, targetApexY, screenWidth, screenHeight, types[i]);

      if (i === 0) {
        this.launchFruit(params);
      } else {
        this.pendingLaunches.push({ delay: i * 0.07, params });
      }
    }
  }

  spawnStaggeredWave(count, screenWidth, screenHeight) {
    const types = this.pickDistinctFruitTypes(count);
    const baseSide = Math.random() < 0.5 ? 'left' : 'right';

    for (let i = 0; i < count; i++) {
      let xStart;
      let targetApexX;

      if (baseSide === 'left') {
        xStart = screenWidth * randomRange(0.12 + i * 0.07, 0.28 + i * 0.07);
        targetApexX = screenWidth * randomRange(0.44, 0.80);
      } else {
        xStart = screenWidth * randomRange(0.72 - i * 0.07, 0.88 - i * 0.07);
        targetApexX = screenWidth * randomRange(0.20, 0.56);
      }

      const targetApexY = this.getSafeApexY(screenHeight);

      const params = this.computeLaunchParams(xStart, targetApexX, targetApexY, screenWidth, screenHeight, types[i]);

      if (i === 0) {
        this.launchFruit(params);
      } else {
        this.pendingLaunches.push({ delay: i * randomRange(0.12, 0.18), params });
      }
    }
  }

  launchFruit(params) {
    this.fruitPool.obtain(
      params.x,
      params.y,
      params.vx,
      params.vy,
      params.gravity,
      params.type,
      params.rotationSpeed,
      performance.now()
    );
  }

  launchBomb(screenWidth, screenHeight) {
    const xStart = screenWidth * randomRange(0.18, 0.82);
    const targetApexX = screenWidth * (xStart < screenWidth * 0.5 ? randomRange(0.40, 0.70) : randomRange(0.30, 0.60));
    const targetApexY = this.getSafeApexY(screenHeight, 0.05, 0);
    const params = this.computeLaunchParams(xStart, targetApexX, targetApexY, screenWidth, screenHeight);

    this.bombPool.obtain(
      params.x,
      params.y,
      params.vx,
      params.vy,
      params.gravity,
      params.rotationSpeed,
      performance.now()
    );
  }

  pickDistinctFruitTypes(count) {
    const shuffled = [...AVAILABLE_FRUIT_TYPES].sort(() => 0.5 - Math.random());
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(shuffled[i % shuffled.length]);
    }
    return result;
  }

  /**
   * Slices an active fruit into two separating halves with physical outward impulses,
   * tangential forward blade momentum transfer, and rotational torque.
   */
  sliceFruit(fruit, cutSegment, hitPoint = null) {
    if (!fruit.active) return;

    fruit.sliced = true;
    fruit.active = false;

    const { p1, p2 } = cutSegment;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const sliceAngle = Math.atan2(dy, dx);
    const len = Math.sqrt(dx * dx + dy * dy);

    // Tangent unit vector along cut direction (swipe vector)
    const tx = len > 0 ? dx / len : 1;
    const ty = len > 0 ? dy / len : 0;

    // Normal unit vector perpendicular to cut line
    const nx = len > 0 ? -dy / len : 0;
    const ny = len > 0 ? dx / len : 1;

    // Transfer blade tangential momentum to both halves based on swipe speed
    const swipeSpeed = cutSegment?.speed || 320;
    const tangentialImpulse = Math.min(180, Math.max(40, swipeSpeed * 0.16));
    const forwardVx = tx * tangentialImpulse;
    const forwardVy = ty * tangentialImpulse;

    // Outward separation impulse and angular kick configured per fruit variety
    const fruitConfig = FRUIT_CONFIGS[fruit.type] || FRUIT_CONFIGS[FRUIT_TYPES.WATERMELON];
    const baseSep = fruitConfig.sliceBehavior?.separationSpeed ?? 220;
    const sepSpeed = baseSep + (Math.random() - 0.5) * 40;
    const baseKick = fruitConfig.sliceBehavior?.angularKick ?? 4.5;
    const spinMagnitude = baseKick + (Math.random() - 0.5) * 1.5;

    // Off-center torque from exact contact hit point
    let torqueBias = 0;
    if (hitPoint) {
      const cross = (hitPoint.x - fruit.x) * ty - (hitPoint.y - fruit.y) * tx;
      torqueBias = Math.max(-2.5, Math.min(2.5, (cross / fruit.radius) * 2.2));
    }

    // Initial separation gap along cut normal to prevent frame 1 overlap
    const initialGap = 4;

    // Half 1 (top / left piece): dome is at y <= 0 in local frame (negative normal direction)
    this.slicedFruitPool.obtain(
      fruit.x - nx * initialGap,
      fruit.y - ny * initialGap,
      fruit.vx + forwardVx - nx * sepSpeed,
      fruit.vy + forwardVy - ny * sepSpeed - 35,
      fruit.gravity,
      fruit.radius,
      sliceAngle,
      'top',
      fruit.type,
      -spinMagnitude + torqueBias
    );

    // Half 2 (bottom / right piece): dome is at y >= 0 in local frame (positive normal direction)
    this.slicedFruitPool.obtain(
      fruit.x + nx * initialGap,
      fruit.y + ny * initialGap,
      fruit.vx + forwardVx + nx * sepSpeed,
      fruit.vy + forwardVy + ny * sepSpeed - 35,
      fruit.gravity,
      fruit.radius,
      sliceAngle,
      'bottom',
      fruit.type,
      spinMagnitude + torqueBias
    );

    this.fruitPool.release(fruit);
  }

  render(ctx) {
    const fruits = this.fruitPool.getActiveItems();
    for (let i = 0; i < fruits.length; i++) {
      fruits[i].render(ctx);
    }

    const bombs = this.bombPool.getActiveItems();
    for (let i = 0; i < bombs.length; i++) {
      bombs[i].render(ctx);
    }

    const sliced = this.slicedFruitPool.getActiveItems();
    for (let i = 0; i < sliced.length; i++) {
      sliced[i].render(ctx);
    }
  }

  reset() {
    this.fruitPool.releaseAll();
    this.bombPool.releaseAll();
    this.slicedFruitPool.releaseAll();
    this.pendingLaunches = [];
    this.sessionTime = 0;
    this.waveTimer = this.config.initialDelay;
    this.difficulty = 0;
    this.stopSpawning = false;
  }
}
