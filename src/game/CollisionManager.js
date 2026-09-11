/**
 * Coordinates slice intersection checks between blade trails and targets.
 * Supports multi-segment continuous collision detection to prevent tunneling
 * during high-speed swipes and handles multi-fruit slice combos.
 */

import { lineSegmentIntersectsCircle } from '../utils/collision.js';

export class CollisionManager {
  constructor() {
    this.slicedThisFrame = [];
    this.hitFruitsPool = Array.from({ length: 16 }, () => ({ fruit: null, segment: null }));
    this.hitFruits = [];
  }

  /**
   * Checks multiple blade segments against all active fruits and hazards.
   * Prevents tunneling on fast swipes and guarantees each fruit is sliced at most once.
   * Employs internal pooling to prevent frame-rate jitter and heap allocations.
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
      const { p1, p2 } = segments[s];

      for (let i = fruits.length - 1; i >= 0; i--) {
        const fruit = fruits[i];
        if (!fruit.active || fruit.sliced) continue;

        if (lineSegmentIntersectsCircle(p1.x, p1.y, p2.x, p2.y, fruit.x, fruit.y, fruit.radius)) {
          // Immediately mark sliced to prevent multiple intersections across segments
          fruit.sliced = true;
          if (hitCount >= this.hitFruitsPool.length) {
            this.hitFruitsPool.push({ fruit: null, segment: null });
          }
          const entry = this.hitFruitsPool[hitCount++];
          entry.fruit = fruit;
          entry.segment = segments[s];
          this.hitFruits.push(entry);
        }
      }

      // Check bombs
      for (let i = bombs.length - 1; i >= 0; i--) {
        const bomb = bombs[i];
        if (!bomb.active || bomb.exploded) continue;

        if (lineSegmentIntersectsCircle(p1.x, p1.y, p2.x, p2.y, bomb.x, bomb.y, bomb.radius)) {
          bomb.exploded = true;
          bomb.active = false;
          fruitManager.bombPool.release(bomb);
          if (onBombHit) {
            onBombHit(bomb, segments[s]);
          }
        }
      }
    }

    // 2. Process all sliced fruits cleanly
    const totalHits = this.hitFruits.length;
    for (let i = 0; i < totalHits; i++) {
      const { fruit, segment } = this.hitFruits[i];
      fruitManager.sliceFruit(fruit, segment);
      if (onFruitHit) {
        onFruitHit(fruit, segment, totalHits);
      }
    }

    return totalHits;
  }
}
