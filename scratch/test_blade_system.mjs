import { InputManager } from '../src/game/InputManager.js';
import { BladeTrail } from '../src/entities/BladeTrail.js';

let passed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
  passed++;
}

console.log('=== TEST 1: INPUT MANAGER VELOCITY & POOLING ===');
// Mock DOM canvas
const mockCanvas = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  hasPointerCapture: () => false,
};

const input = new InputManager(mockCanvas);

// Simulate pointer down
input.handlePointerDown({
  preventDefault: () => {},
  pointerId: 1,
  clientX: 100,
  clientY: 100,
});
assert(input.isDown === true, 'Input isDown is true after pointerDown');
assert(input.pointerId === 1, 'PointerId tracked');
assert(input.activePoints.length === 1, 'Initial trail point recorded');

// Simulate high-speed move
const now = performance.now();
input.handlePointerMove({
  preventDefault: () => {},
  pointerId: 1,
  clientX: 250,
  clientY: 100,
});

assert(input.activePoints.length === 2, 'Second trail point recorded');
const speed = input.getSwipeSpeed();
assert(speed > 0, `Swipe speed calculated (> 0, got ${speed.toFixed(1)} px/s)`);

const cutSeg = input.getActiveCutSegment();
assert(cutSeg !== null, 'Active cut segment generated for fast swipe');
assert(cutSeg.p1.x === 100 && cutSeg.p2.x === 250, 'Cut segment spans swipe positions');
assert(cutSeg.speed >= 120, 'Cut segment speed satisfies minSliceSpeed');

// Add more points to test pooling
for (let i = 0; i < 60; i++) {
  input.handlePointerMove({
    preventDefault: () => {},
    pointerId: 1,
    clientX: 250 + i * 5,
    clientY: 100 + i * 2,
  });
}
assert(input.activePoints.length <= input.maxTrailPoints, `Trail points capped at maxTrailPoints (${input.activePoints.length} <= ${input.maxTrailPoints})`);

console.log('\n=== TEST 2: BLADE TRAIL CATMULL-ROM & VARIABLE THICKNESS ===');
const blade = new BladeTrail(input);

// Test Catmull-Rom spline sampling
blade.sampleCatmullRom(input.getTrailPoints(), input.activePoints.length);
assert(blade.sampleCount >= 2, `Catmull-Rom generated ${blade.sampleCount} smooth samples`);
assert(blade.sampleCount <= 96, 'Sample count does not exceed pre-allocated buffer');

// Verify samples do not have NaN or Infinity
let hasInvalidSample = false;
for (let i = 0; i < blade.sampleCount; i++) {
  if (!Number.isFinite(blade.samplesX[i]) || !Number.isFinite(blade.samplesY[i])) {
    hasInvalidSample = true;
    break;
  }
}
assert(!hasInvalidSample, 'All spline samples are valid finite coordinates');

// Test geometry & variable thickness
const duration = input.trailDurationMs;
blade.computeGeometry(performance.now(), duration, 0.8); // fast swipe factor 0.8

// Verify tapered tail: tail width must be 0 (needle-fine point)
const tailWidth = blade.samplesWidth[0];
assert(tailWidth === 0, `Tail width is exactly 0 for needle taper (got ${tailWidth})`);

// Verify peak width is in upper portion of trail
let maxCalculatedWidth = 0;
let maxIdx = 0;
for (let i = 0; i < blade.sampleCount; i++) {
  if (blade.samplesWidth[i] > maxCalculatedWidth) {
    maxCalculatedWidth = blade.samplesWidth[i];
    maxIdx = i;
  }
}
assert(maxCalculatedWidth > 0, `Peak half-width calculated: ${maxCalculatedWidth.toFixed(2)}px`);
assert(maxIdx > blade.sampleCount * 0.5, `Peak width occurs in leading half of blade (index ${maxIdx} / ${blade.sampleCount})`);
// Verify blade is not excessively thick
assert(maxCalculatedWidth * 2 <= 16.0, `Total blade width is capped and sleek (<= 16px, got ${(maxCalculatedWidth * 2).toFixed(2)}px)`);

console.log('\n=== TEST 3: SLOW SWIPE VS FAST SWIPE MODULATION ===');
// Slow swipe
blade.computeGeometry(performance.now(), duration, 0.0);
const slowMaxWidth = Math.max(...blade.samplesWidth.subarray(0, blade.sampleCount));

// Fast swipe
blade.computeGeometry(performance.now(), duration, 1.0);
const fastMaxWidth = Math.max(...blade.samplesWidth.subarray(0, blade.sampleCount));

assert(fastMaxWidth > slowMaxWidth, `Fast swipe produces wider, sharper trail than slow swipe (${fastMaxWidth.toFixed(2)} > ${slowMaxWidth.toFixed(2)})`);

console.log('\n=== TEST 4: MICRO SPARK EMISSION & POOLING ===');
assert(blade.sparks.length === blade.maxSparks, 'Spark pool initialized to maxSparks');

// Spawn sparks
blade.spawnSpark(300, 200, 0);
blade.spawnSpark(305, 200, 0);
let activeSparks = blade.sparks.filter(s => s.active);
assert(activeSparks.length === 2, `2 sparks active in pool (got ${activeSparks.length})`);

// Update sparks over time to verify clean expiration
for (let t = 0; t < 10; t++) {
  blade.update(now + 200 + t * 30);
}
activeSparks = blade.sparks.filter(s => s.active);
assert(activeSparks.length === 0, 'Sparks naturally expire and return to pool');

console.log('\n=== TEST 5: CLEAN RESET ===');
blade.reset();
assert(input.activePoints.length === 0, 'Input trail points cleared on reset');
assert(blade.sampleCount === 0, 'Blade sample count reset to 0');
assert(blade.sparks.every(s => !s.active), 'All sparks inactive after reset');

console.log(`\nALL ${passed} BLADE SYSTEM VERIFICATION TESTS PASSED!`);
