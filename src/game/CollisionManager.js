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
    }));
    this.hitFruits = [];
  }

  /**
   * Checks multiple blade segments against all active fruits and hazards.
   * Uses continuous segment-circle projection to prevent tunneling on fast swipes,
   * detects exact contact hit points, and guarantees each fruit is sliced at most once.
   * Employs zero-allocation object pooling for 60fps performance.
   */
  checkSliceCollisions(cutSegments, fruitManager, onFruitHit, onBombHit) {
    if (!cutSegments || !fruitManager) return 0;

    // Support both single segment object and array of segments
    const segments = Array.isArray(cutSegments) ? cutSegments : [cutSegments];
    if (segments.length === 0) return 0;

    this.hitFruits.length = 0;
    let hitCount = 0;
    const fruits = fruitManager.fruitPool.getActiveItems();
    const bombs = fruitManager.bombPool.getActiveItems();

    // 1. Check fruits against each cutting segment
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      const { p1, p2 } = seg;

      for (let i = fruits.length - 1; i >= 0; i--) {
        const fruit = fruits[i];
        if (!fruit.active || fruit.sliced) continue;

        const hit = getSegmentCircleIntersection(p1.x, p1.y, p2.x, p2.y, fruit.x, fruit.y, fruit.radius);
        if (hit) {
          // Immediately mark sliced to prevent multiple intersections across segments
          fruit.sliced = true;
          if (hitCount >= this.hitFruitsPool.length) {
            this.hitFruitsPool.push({ fruit: null, segment: null, hitPoint: { x: 0, y: 0 } });
          }
          const entry = this.hitFruitsPool[hitCount++];
          entry.fruit = fruit;
          entry.segment = seg;
          if (!entry.hitPoint) {
            entry.hitPoint = { x: 0, y: 0 };
          }
          entry.hitPoint.x = hit.hitX;
          entry.hitPoint.y = hit.hitY;
          this.hitFruits.push(entry);
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

    // 2. Process all sliced fruits cleanly with exact contact point
    const totalHits = this.hitFruits.length;
    for (let i = 0; i < totalHits; i++) {
      const { fruit, segment, hitPoint } = this.hitFruits[i];
      fruitManager.sliceFruit(fruit, segment, hitPoint);
      if (onFruitHit) {
        onFruitHit(fruit, segment, hitPoint, totalHits);
      }
    }

    return totalHits;
  }
}
