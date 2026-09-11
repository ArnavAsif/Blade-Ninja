/**
 * Coordinates slice intersection checks between blade trails and targets.
 * Supports multi-segment continuous collision detection to prevent tunneling
 * during high-speed swipes and handles multi-fruit slice combos.
 */

import { getSegmentCircleIntersection } from '../utils/collision.js';

export class CollisionManager {
  constructor() {
    this.slicedThisFrame = [];
    this.hitFruitsPool = Array.from({ length: 16 }, () => ({
      fruit: null,
      segment: null,
      hitPoint: { x: 0, y: 0 },
      isPerfectSlice: false,
      offsetRatio: 1.0,
      distToCenter: 0,
      swipeSliceIndex: 1,
    }));
    this.hitFruits = [];

    // Continuous swipe tracking across frames
    this.activeSwipeId = -1;
    this.swipeSliceCount = 0;
    this.lastSwipeSliceTime = 0;
  }

  reset() {
    this.activeSwipeId = -1;
    this.swipeSliceCount = 0;
    this.lastSwipeSliceTime = 0;
    this.hitFruits.length = 0;
  }

  /**
   * Checks multiple blade segments against all active fruits and hazards.
   * Uses continuous segment-circle projection to prevent tunneling on fast swipes,
   * detects exact contact hit points, perfect cuts near center, and multi-slice chains.
   * Employs zero-allocation object pooling for 60fps performance.
   */
  checkSliceCollisions(cutSegments, fruitManager, onFruitHit, onBombHit, onPowerUpHit = null, isBladeBoost = false) {
    if (!cutSegments || !fruitManager) return 0;

    // Support both single segment object and array of segments
    const segments = Array.isArray(cutSegments) ? cutSegments : [cutSegments];
    if (segments.length === 0) return 0;

    this.hitFruits.length = 0;
    let hitCount = 0;
    const fruits = fruitManager.fruitPool.getActiveItems();
    const bombs = fruitManager.bombPool.getActiveItems();
    const powerUps = fruitManager.powerUpPool.getActiveItems();

    const now = performance.now();
    const currentSwipeId = segments[0]?.swipeId ?? 1;
    if (currentSwipeId !== this.activeSwipeId || (now - this.lastSwipeSliceTime > 320)) {
      this.activeSwipeId = currentSwipeId;
      this.swipeSliceCount = 0;
    }

    // 1. Check fruits, bombs, and power-ups against each cutting segment
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      const { p1, p2 } = seg;

      // Check fruits with optional Blade Boost reach expansion
      for (let i = fruits.length - 1; i >= 0; i--) {
        const fruit = fruits[i];
        if (!fruit.active || fruit.sliced) continue;

        const effectiveFruitRadius = isBladeBoost ? fruit.radius + 14 : fruit.radius;
        const hit = getSegmentCircleIntersection(p1.x, p1.y, p2.x, p2.y, fruit.x, fruit.y, effectiveFruitRadius);
        if (hit) {
          // Immediately mark sliced to prevent multiple intersections across segments
          fruit.sliced = true;
          this.swipeSliceCount++;
          this.lastSwipeSliceTime = now;

          if (hitCount >= this.hitFruitsPool.length) {
            this.hitFruitsPool.push({
              fruit: null,
              segment: null,
              hitPoint: { x: 0, y: 0 },
              isPerfectSlice: false,
              offsetRatio: 1.0,
              distToCenter: 0,
              swipeSliceIndex: 1,
            });
          }
          const entry = this.hitFruitsPool[hitCount++];
          entry.fruit = fruit;
          entry.segment = seg;
          if (!entry.hitPoint) {
            entry.hitPoint = { x: 0, y: 0 };
          }
          entry.hitPoint.x = hit.hitX;
          entry.hitPoint.y = hit.hitY;

          // Perfect Slice criteria: cut passes cleanly near fruit center (<= 28% of radius)
          const offsetRatio = typeof hit.offsetRatio === 'number' ? hit.offsetRatio : 1.0;
          entry.offsetRatio = offsetRatio;
          entry.distToCenter = hit.distToCenter || 0;
          entry.isPerfectSlice = offsetRatio <= 0.28;
          entry.swipeSliceIndex = this.swipeSliceCount;

          this.hitFruits.push(entry);
        }
      }

      // Check power-ups
      for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        if (!powerUp.active || powerUp.sliced) continue;

        const effectivePowerUpRadius = isBladeBoost ? powerUp.radius + 12 : powerUp.radius;
        const puHit = getSegmentCircleIntersection(p1.x, p1.y, p2.x, p2.y, powerUp.x, powerUp.y, effectivePowerUpRadius);
        if (puHit) {
          powerUp.sliced = true;
          powerUp.active = false;
          fruitManager.slicePowerUp(powerUp, seg, { x: puHit.hitX, y: puHit.hitY });
          if (onPowerUpHit) {
            onPowerUpHit(powerUp, seg, { x: puHit.hitX, y: puHit.hitY });
          }
        }
      }

      // Check bombs
      for (let i = bombs.length - 1; i >= 0; i--) {
        const bomb = bombs[i];
        if (!bomb.active || bomb.exploded) continue;

        const bombHit = getSegmentCircleIntersection(p1.x, p1.y, p2.x, p2.y, bomb.x, bomb.y, bomb.radius);
        if (bombHit) {
          bomb.exploded = true;
          bomb.active = false;
          fruitManager.bombPool.release(bomb);
          if (onBombHit) {
            onBombHit(bomb, seg, { x: bombHit.hitX, y: bombHit.hitY });
          }
        }
      }
    }

    // 2. Process all sliced fruits cleanly with exact contact point & arcade metadata
    const totalHits = this.hitFruits.length;
    for (let i = 0; i < totalHits; i++) {
      const entry = this.hitFruits[i];
      const { fruit, segment, hitPoint, isPerfectSlice, offsetRatio, distToCenter, swipeSliceIndex } = entry;
      const multiSliceCount = Math.max(totalHits, swipeSliceIndex);

      fruitManager.sliceFruit(fruit, segment, hitPoint);
      if (onFruitHit) {
        onFruitHit(fruit, segment, hitPoint, totalHits, {
          isPerfectSlice,
          offsetRatio,
          distToCenter,
          multiSliceCount,
        });
      }
    }

    return totalHits;
  }
}
