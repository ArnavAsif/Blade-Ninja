/**
 * Geometric collision routines optimized for high-speed blade slicing.
 */

import { distanceSquared } from './math.js';

export function pointInCircle(px, py, cx, cy, radius) {
  return distanceSquared(px, py, cx, cy) <= radius * radius;
}

export function circleIntersectsCircle(c1x, c1y, r1, c2x, c2y, r2) {
  const sumRadius = r1 + r2;
  return distanceSquared(c1x, c1y, c2x, c2y) <= sumRadius * sumRadius;
}

/**
 * Checks if a line segment between (x1, y1) and (x2, y2) intersects a circle
 * centered at (cx, cy) with given radius.
 */
export function lineSegmentIntersectsCircle(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return pointInCircle(x1, y1, cx, cy, radius);
  }

  // Projection parameter t of circle center onto segment
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));

  // Nearest point on segment
  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;

  return pointInCircle(nearestX, nearestY, cx, cy, radius);
}
