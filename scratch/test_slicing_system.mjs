import { getSegmentCircleIntersection, lineSegmentIntersectsCircle } from '../src/utils/collision.js';
import { FruitManager } from '../src/game/FruitManager.js';
import { CollisionManager } from '../src/game/CollisionManager.js';
import { ParticleManager } from '../src/game/ParticleManager.js';
import { FRUIT_TYPES } from '../src/assets/FruitSprites.js';

let passed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
  passed++;
}

console.log('=== TEST 1: CONTINUOUS BLADE COLLISION & EXACT CONTACT POINT ===');
// Fast horizontal swipe passing through circle at (100, 100) radius 40
const cut1 = getSegmentCircleIntersection(0, 100, 200, 100, 100, 100, 40);
assert(cut1 !== null, 'Horizontal swipe intersects circle');
assert(cut1.hit === true, 'Hit flag is true');
assert(Math.abs(cut1.hitX - 100) < 0.01, `Exact hitX is center projection: 100 (got ${cut1.hitX})`);
assert(Math.abs(cut1.hitY - 100) < 0.01, `Exact hitY is 100 (got ${cut1.hitY})`);

// Fast diagonal swipe passing through circle at (200, 200) radius 40
const cut2 = getSegmentCircleIntersection(150, 150, 250, 250, 200, 200, 40);
assert(cut2 !== null, 'Diagonal swipe intersects circle');
assert(Math.abs(cut2.hitX - 200) < 0.01 && Math.abs(cut2.hitY - 200) < 0.01, 'Diagonal hit point projected correctly');

// Swipe that misses circle
const missCut = getSegmentCircleIntersection(0, 0, 50, 50, 200, 200, 40);
assert(missCut === null, 'Non-intersecting swipe returns null');
assert(!lineSegmentIntersectsCircle(0, 0, 50, 50, 200, 200, 40), 'lineSegmentIntersectsCircle returns false for miss');

console.log('\n=== TEST 2: SLICE DIRECTION & TANGENTIAL MOMENTUM TRANSFER ===');
const fruitMgr = new FruitManager();
const fruit = fruitMgr.fruitPool.obtain(400, 300, 0, 0, 1000, FRUIT_TYPES.WATERMELON, 0, performance.now());

// Left-to-right swipe (dx > 0, dy = 0)
const cutLtoR = {
  p1: { x: 300, y: 300 },
  p2: { x: 500, y: 300 },
  speed: 800,
};

fruitMgr.sliceFruit(fruit, cutLtoR, { x: 400, y: 300 });
assert(fruit.sliced === true, 'Original fruit marked as sliced');
assert(fruit.active === false, 'Original fruit deactivated');

const pieces = fruitMgr.slicedFruitPool.getActiveItems();
assert(pieces.length === 2, `Exactly 2 fruit halves spawned (got ${pieces.length})`);

const [halfTop, halfBottom] = pieces;
// Forward momentum: dx is positive, so both halves must have forward Vx > 0
assert(halfTop.vx > 0, `Top half received forward swipe momentum (vx: ${halfTop.vx.toFixed(1)})`);
assert(halfBottom.vx > 0, `Bottom half received forward swipe momentum (vx: ${halfBottom.vx.toFixed(1)})`);

// Separation normal: cut is horizontal, normal is vertical (nx = 0, ny = 1 or -1)
assert(halfTop.vy !== halfBottom.vy, 'Halves separate with opposing vertical separation impulses');
// Initial positions should have gap along normal so they do not overlap
assert(halfTop.y !== halfBottom.y, `Halves initial positions are offset along cut normal (${halfTop.y} vs ${halfBottom.y})`);
// Opposing angular spin
assert(halfTop.angularVelocity * halfBottom.angularVelocity < 0, 'Halves spin in opposite directions away from cut line');

console.log('\n=== TEST 3: CLEAVE POP & NATURAL FADE ===');
// Cleave pop scale
assert(halfTop.scale > 1.1, `Cleave scale pop initialized > 1.1 (got ${halfTop.scale.toFixed(3)})`);
// Update for 0.2s - scale should settle toward 1.0
halfTop.update(0.2, 800);
assert(halfTop.scale < 1.05 && halfTop.scale >= 1.0, `Scale settles smoothly toward 1.0 (got ${halfTop.scale.toFixed(3)})`);

// Test natural fading when falling past 72% screen height
halfTop.y = 800 * 0.75; // 600px
halfTop.update(0.016, 800);
assert(halfTop.alpha < 1.0, `Alpha starts fading below 72% screen height (got ${halfTop.alpha.toFixed(2)})`);

// Below viewport + margin, piece should deactivate cleanly
halfTop.y = 800 + halfTop.radius * 2 + 100;
halfTop.update(0.016, 800);
assert(halfTop.active === false, 'Piece deactivated when fully past bottom boundary');

console.log('\n=== TEST 4: MULTI-FRUIT COLLISION & TUNNELING PREVENTION ===');
fruitMgr.reset();
const f1 = fruitMgr.fruitPool.obtain(200, 300, 0, 0, 1000, FRUIT_TYPES.APPLE, 0, performance.now());
const f2 = fruitMgr.fruitPool.obtain(350, 300, 0, 0, 1000, FRUIT_TYPES.ORANGE, 0, performance.now());
const f3 = fruitMgr.fruitPool.obtain(500, 300, 0, 0, 1000, FRUIT_TYPES.BANANA, 0, performance.now());

const colMgr = new CollisionManager();
const multiCut = [
  { p1: { x: 100, y: 300 }, p2: { x: 600, y: 300 }, speed: 1200 },
];

let hitCallbacks = 0;
const hitCount = colMgr.checkSliceCollisions(
  multiCut,
  fruitMgr,
  (hitFruit, _seg, hitPoint, totalHits) => {
    hitCallbacks++;
    assert(hitPoint !== null, 'hitPoint provided in collision callback');
    assert(typeof hitPoint.x === 'number' && typeof hitPoint.y === 'number', 'hitPoint coordinates are valid numbers');
    assert(totalHits === 3, 'totalHits indicates 3 fruits in combo');
  }
);

assert(hitCount === 3, `All 3 fruits cleaved in single multi-fruit swipe (got ${hitCount})`);
assert(hitCallbacks === 3, `onFruitHit callback called 3 times (got ${hitCallbacks})`);
assert(f1.sliced && f2.sliced && f3.sliced, 'All 3 fruits marked sliced');

// Second pass with same segment should detect 0 new hits (duplicate prevention)
const secondPass = colMgr.checkSliceCollisions(multiCut, fruitMgr, () => {});
assert(secondPass === 0, 'Duplicate slice prevention verified: already sliced fruits ignored');

console.log('\n=== TEST 5: PARTICLE MANAGER & IMPACT SPARK POOLING ===');
const partMgr = new ParticleManager();
partMgr.spawnSliceEffects(300, 300, { p1: { x: 250, y: 300 }, p2: { x: 350, y: 300 }, speed: 700 }, FRUIT_TYPES.WATERMELON, 40, { x: 300, y: 300 });

const activeParticles = partMgr.pool.getActiveItems();
assert(activeParticles.length > 10, `Particles spawned for slice (got ${activeParticles.length})`);

const spark = activeParticles.find(p => p.type === 'impact_spark');
assert(Boolean(spark), 'impact_spark particle spawned at contact point');
assert(spark.x === 300 && spark.y === 300, 'impact_spark centered at exact hit point');

const droplets = activeParticles.filter(p => p.type === 'droplet');
assert(droplets.length >= 8, `Juice droplets spawned (got ${droplets.length})`);
// Forward momentum in droplets: swipe was left-to-right (dx > 0)
const avgDropletVx = droplets.reduce((sum, d) => sum + d.vx, 0) / droplets.length;
assert(avgDropletVx > 0, `Juice droplets spray forward along blade swipe direction (avg vx: ${avgDropletVx.toFixed(1)})`);

// Clean recycling
partMgr.reset();
assert(partMgr.pool.getActiveCount() === 0, 'Particle pool clean reset with 0 leaks');

console.log('\n=== TEST 6: MULTI-ANGLE CUT EDGE & PHYSICAL SEPARATION ALIGNMENT ===');
const angles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4];

for (const angle of angles) {
  const fm = new FruitManager();
  const f = fm.fruitPool.obtain(400, 300, 0, 0, 1000, FRUIT_TYPES.WATERMELON, 0, performance.now());

  const dx = Math.cos(angle) * 200;
  const dy = Math.sin(angle) * 200;
  const cutSeg = {
    p1: { x: 400 - dx * 0.5, y: 300 - dy * 0.5 },
    p2: { x: 400 + dx * 0.5, y: 300 + dy * 0.5 },
    speed: 750,
  };

  fm.sliceFruit(f, cutSeg, { x: 400, y: 300 });
  const pieces = fm.slicedFruitPool.getActiveItems();
  assert(pieces.length === 2, `Spawned 2 halves at angle ${(angle * 180 / Math.PI).toFixed(0)} deg`);

  const topPiece = pieces.find(p => p.side === 'top');
  const bottomPiece = pieces.find(p => p.side === 'bottom');
  assert(Boolean(topPiece && bottomPiece), 'Both top and bottom pieces identified');

  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;

  // topPiece must separate in -normal direction (matching its local negative Y dome)
  const topDot = (topPiece.x - 400) * nx + (topPiece.y - 300) * ny;
  assert(topDot < -0.1, `Top piece displaced in negative normal direction (dot: ${topDot.toFixed(2)})`);

  // bottomPiece must separate in +normal direction (matching its local positive Y dome)
  const bottomDot = (bottomPiece.x - 400) * nx + (bottomPiece.y - 300) * ny;
  assert(bottomDot > 0.1, `Bottom piece displaced in positive normal direction (dot: ${bottomDot.toFixed(2)})`);

  // Relative velocity must be separating outward along cut normal
  const relVx = bottomPiece.vx - topPiece.vx;
  const relVy = bottomPiece.vy - topPiece.vy;
  const sepDot = relVx * nx + relVy * ny;
  assert(sepDot > 100, `Halves separate outward along cut normal (sep speed: ${sepDot.toFixed(1)} px/s)`);
}

console.log('\n=== TEST 7: CUT-EDGE CLIPPING & BOUNDARY CONFINEMENT ===');
const recordedCalls = [];
const mockCtx = {
  save() { recordedCalls.push({ method: 'save' }); },
  restore() { recordedCalls.push({ method: 'restore' }); },
  translate(x, y) { recordedCalls.push({ method: 'translate', x, y }); },
  rotate(angle) { recordedCalls.push({ method: 'rotate', angle }); },
  scale(x, y) { recordedCalls.push({ method: 'scale', x, y }); },
  beginPath() { recordedCalls.push({ method: 'beginPath' }); },
  closePath() { recordedCalls.push({ method: 'closePath' }); },
  clip() { recordedCalls.push({ method: 'clip' }); },
  moveTo(x, y) { recordedCalls.push({ method: 'moveTo', x, y }); },
  lineTo(x, y) { recordedCalls.push({ method: 'lineTo', x, y }); },
  arc(x, y, r, sa, ea) { recordedCalls.push({ method: 'arc', x, y, r, sa, ea }); },
  stroke() { recordedCalls.push({ method: 'stroke' }); },
  fill() { recordedCalls.push({ method: 'fill' }); },
  drawImage() { recordedCalls.push({ method: 'drawImage' }); },
};

import { SlicedFruit } from '../src/entities/SlicedFruit.js';

for (const type of Object.values(FRUIT_TYPES)) {
  for (const side of ['top', 'bottom']) {
    recordedCalls.length = 0;

    const sf = new SlicedFruit();
    sf.reset(300, 300, 10, -20, 1000, 40, Math.PI / 4, side, type);
    sf.render(mockCtx);

    // 1. Verify clip() is called to mask the highlight
    const clipCall = recordedCalls.find(c => c.method === 'clip');
    assert(clipCall !== undefined, `ctx.clip() called for fruit '${type}' side '${side}'`);

    // 2. Verify cut-edge stroke was recorded inside the clipped scope
    const clipIndex = recordedCalls.findIndex(c => c.method === 'clip');
    const moveLines = recordedCalls.slice(clipIndex).filter(c => c.method === 'moveTo' || c.method === 'lineTo');
    assert(moveLines.length >= 2, `Cut-edge line coordinates recorded inside clip for '${type}'`);

    // 3. Verify line coordinates are aligned on cut face (y = 0 or slight inset)
    const cutLineMoves = moveLines.filter(c => Math.abs(c.y) < 2.0);
    assert(cutLineMoves.length >= 2, `Line coordinates stay exactly aligned to cut face y=0 for '${type}'`);

    // 4. Verify all coordinates are finite numbers
    for (const call of recordedCalls) {
      for (const [key, val] of Object.entries(call)) {
        if (typeof val === 'number') {
          assert(Number.isFinite(val), `Finite parameter ${key}=${val} for '${type}'`);
        }
      }
    }
  }
}

console.log(`\nALL ${passed} SLICING SYSTEM UPGRADE TESTS PASSED!`);
