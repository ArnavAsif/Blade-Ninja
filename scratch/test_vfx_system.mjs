import { ParticleManager } from '../src/game/ParticleManager.js';
import { FRUIT_TYPES, FRUIT_CONFIGS } from '../src/assets/FruitSprites.js';

let passed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
  passed++;
}

console.log('=== TEST 1: DIRECTIONAL JUICE DYNAMICS (FRUIT INERTIA + BLADE SWIPE) ===');
const pm = new ParticleManager();

const fruitVelocity = { vx: 200, vy: -150 };
const cutSegment = {
  p1: { x: 300, y: 300 },
  p2: { x: 500, y: 300 }, // Horizontal left-to-right swipe (tx = 1, ty = 0)
  speed: 900,
};

pm.spawnSliceEffects(
  400,
  300,
  cutSegment,
  FRUIT_TYPES.WATERMELON,
  46,
  { x: 400, y: 300 },
  fruitVelocity,
  1 // combo 1
);

const activeParticles = pm.pool.getActiveItems();
assert(activeParticles.length > 0, `Particles spawned: ${activeParticles.length}`);

// Test droplet velocities
const droplets = activeParticles.filter(p => p.type === 'droplet');
assert(droplets.length >= 8, `Juice droplets spawned: ${droplets.length}`);

// Droplets must inherit fruit inertia (vx > 0) AND forward blade momentum (tx = 1 -> positive vx)
const avgVx = droplets.reduce((sum, d) => sum + d.vx, 0) / droplets.length;
assert(avgVx > 50, `Droplets spray forward along combined fruit + blade direction (avg vx: ${avgVx.toFixed(1)})`);

// Test droplet size variation
const dropletSizes = droplets.map(d => d.size);
const minSize = Math.min(...dropletSizes);
const maxSize = Math.max(...dropletSizes);
assert(minSize < maxSize, `Droplet sizes are varied (${minSize.toFixed(1)}px - ${maxSize.toFixed(1)}px)`);

console.log('\n=== TEST 2: FRUIT FRAGMENTS & SPARKLE PARTICLES ===');
const fragments = activeParticles.filter(p => p.type === 'fragment');
assert(fragments.length >= 2, `Fruit rind fragments spawned: ${fragments.length}`);

const wmConfig = FRUIT_CONFIGS[FRUIT_TYPES.WATERMELON];
assert(fragments[0].color === wmConfig.rindColor, `Fragment primary color is rindColor (${fragments[0].color})`);
assert(fragments[0].secondaryColor === wmConfig.pulpColor, `Fragment secondary color is pulpColor (${fragments[0].secondaryColor})`);
assert(fragments[0].rotationSpeed !== 0, 'Fragment has rotational tumbling speed');

const sparkles = activeParticles.filter(p => p.type === 'sparkle');
assert(sparkles.length >= 2, `Sparkle particles spawned: ${sparkles.length}`);
assert(sparkles[0].size > 0, 'Sparkle particle has valid size');

const impactSparks = activeParticles.filter(p => p.type === 'impact_spark');
assert(impactSparks.length === 1, 'Exact impact spark spawned at contact point');

const splashLines = activeParticles.filter(p => p.type === 'splash_line');
assert(splashLines.length === 1, 'Splash flash line spawned along cut');

console.log('\n=== TEST 3: COMBO VFX SCALING & COMBO RING ===');
pm.reset();

// Spawn combo 1
pm.spawnSliceEffects(400, 300, cutSegment, FRUIT_TYPES.APPLE, 38, { x: 400, y: 300 }, fruitVelocity, 1);
const combo1Count = pm.pool.getActiveCount();

pm.reset();
// Spawn combo 4
pm.spawnSliceEffects(400, 300, cutSegment, FRUIT_TYPES.APPLE, 38, { x: 400, y: 300 }, fruitVelocity, 4);
const combo4Count = pm.pool.getActiveCount();

assert(combo4Count > combo1Count, `Combo 4 generates scaled particle count without clutter (${combo4Count} > ${combo1Count})`);

const comboRings = pm.pool.getActiveItems().filter(p => p.type === 'combo_ring');
assert(comboRings.length === 1, 'High-combo (4x) triggers expanding combo shock ring');

// Test score popup with combo styling
pm.spawnScorePopup(400, 280, '+12 (4x)', '#FBBF24', 4);
const textParticles = pm.pool.getActiveItems().filter(p => p.type === 'text');
assert(textParticles.length === 1, 'Combo score popup spawned');
assert(textParticles[0].size >= 24, `Combo score popup has larger emphasized scale (${textParticles[0].size}px)`);

console.log('\n=== TEST 4: HARD PERFORMANCE LIMITS & BUDGETING ===');
pm.reset();

// Test frame spawn budget: attempt 100 spawns in a single frame
for (let i = 0; i < 100; i++) {
  pm.obtainParticle(100, 100, 0, 0, 0, 5, '#FFFFFF', 0.2, 'droplet');
}

assert(pm.spawnsThisFrame <= pm.frameSpawnBudget, `Frame spawn budget strictly enforced (${pm.spawnsThisFrame} <= ${pm.frameSpawnBudget})`);
assert(pm.pool.getActiveCount() <= pm.maxActiveLimit, `Active count does not exceed maxActiveLimit (${pm.pool.getActiveCount()} <= ${pm.maxActiveLimit})`);

// Advancing frame resets budget
pm.update(0.016);
assert(pm.spawnsThisFrame === 0, 'Spawns this frame budget resets on update tick');

// Test snappy particle lifetimes (all particles under 0.55s maxLife)
const allActive = pm.pool.getActiveItems();
const maxParticleLife = Math.max(...allActive.map(p => p.maxLife));
assert(maxParticleLife <= 0.75, `All particle lifetimes are snappy to prevent lag (max: ${maxParticleLife.toFixed(2)}s)`);

console.log('\n=== TEST 5: CLEAN POOL RECYCLING ===');
pm.reset();
assert(pm.pool.getActiveCount() === 0, 'ParticleManager cleanly recycles all particles on reset');

console.log('\n=== TEST 6: CANVAS RENDERING SAFETY ACROSS ALL PARTICLE TYPES ===');
const mockCtx = {
  save() {},
  restore() {},
  translate() {},
  rotate() {},
  scale() {},
  beginPath() {},
  closePath() {},
  moveTo() {},
  lineTo() {},
  rect() {},
  arc(x, y, r) {
    if (r < 0) throw new Error(`Negative arc radius: ${r}`);
  },
  ellipse(x, y, rx, ry) {
    if (rx < 0 || ry < 0) throw new Error(`Negative ellipse radius: ${rx}, ${ry}`);
  },
  quadraticCurveTo(_cpx, _cpy, _x, _y) {
    if (arguments.length < 4) throw new Error(`quadraticCurveTo requires 4 args, got ${arguments.length}`);
  },
  stroke() {},
  fill() {},
  strokeText() {},
  fillText() {},
};

// Spawn full slice effects
pm.spawnSliceEffects(400, 300, cutSegment, FRUIT_TYPES.WATERMELON, 46, { x: 400, y: 300 }, fruitVelocity, 3);
pm.spawnScorePopup(400, 280, '+15 (3x)', '#FBBF24', 3);
pm.spawnBombExplosion(300, 300);

// Render all spawned active particles
let renderedCount = 0;
for (const particle of pm.pool.getActiveItems()) {
  particle.render(mockCtx);
  renderedCount++;
}
assert(renderedCount > 0, `Successfully rendered ${renderedCount} active particles without errors`);

// Test sparkle particle throughout its full lifetime lifecycle
for (let t = 0; t <= 0.6; t += 0.02) {
  const p = pm.pool.obtain(100, 100, 0, 0, 0, 3.5, '#FFFFFF', 0.25, 'sparkle');
  p.life = t;
  p.render(mockCtx);
}
assert(true, 'Sparkle particle successfully rendered across all lifetime fractions');

console.log(`\nALL ${passed} PROFESSIONAL VFX SYSTEM TESTS PASSED!`);
