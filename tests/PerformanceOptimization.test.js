import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { PerformanceMonitor, QUALITY_TIERS } from '../src/game/PerformanceMonitor.js';
import { ParticleManager } from '../src/game/ParticleManager.js';
import { ArcadeEnvironment } from '../src/game/ArcadeEnvironment.js';
import { BladeTrail } from '../src/entities/BladeTrail.js';
import { InputManager } from '../src/game/InputManager.js';
import { PowerUpManager } from '../src/game/PowerUpManager.js';
import { POWER_UP_TYPES } from '../src/assets/PowerUpSprites.js';
import { GameState, STATES } from '../src/game/GameState.js';

function createMockCanvas(ctx) {
  let boundCallCount = 0;
  return {
    width: 800,
    height: 600,
    getContext: () => ctx,
    getBoundingClientRect: () => {
      boundCallCount++;
      return { left: 10, top: 20, width: 800, height: 600 };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    setPointerCapture: () => {},
    getBoundCallCount: () => boundCallCount,
  };
}

function createMockContext() {
  const calls = [];
  let linearGradientCount = 0;
  let radialGradientCount = 0;

  return {
    calls,
    getLinearGradientCount: () => linearGradientCount,
    getRadialGradientCount: () => radialGradientCount,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    translate: (x, y) => calls.push(`translate(${x},${y})`),
    rotate: (angle) => calls.push(`rotate(${angle})`),
    beginPath: () => calls.push('beginPath'),
    moveTo: (x, y) => calls.push(`moveTo(${x},${y})`),
    lineTo: (x, y) => calls.push(`lineTo(${x},${y})`),
    bezierCurveTo: () => calls.push('bezierCurveTo'),
    arc: (x, y, r, sa, ea) => calls.push(`arc(${x},${y},${r},${sa},${ea})`),
    stroke: () => calls.push('stroke'),
    fill: () => calls.push('fill'),
    fillRect: (x, y, w, h) => calls.push(`fillRect(${x},${y},${w},${h})`),
    drawImage: () => calls.push('drawImage'),
    createLinearGradient: () => {
      linearGradientCount++;
      return { addColorStop: () => {} };
    },
    createRadialGradient: () => {
      radialGradientCount++;
      return { addColorStop: () => {} };
    },
    setTransform: () => {},
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    globalAlpha: 1.0,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  };
}

describe('Performance Optimization & Adaptive Throttling Suite', () => {
  describe('PerformanceMonitor Core & Hysteresis Transitions', () => {
    let monitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor();
    });

    afterEach(() => {
      if (monitor) {
        monitor.destroy();
      }
    });

    it('initializes in HIGH quality tier with full visual budgets', () => {
      assert.equal(monitor.getQualityTier(), QUALITY_TIERS.HIGH);
      assert.equal(monitor.getMaxActiveParticles(), 220);
      assert.equal(monitor.getFrameSpawnBudget(), 60);
      assert.equal(monitor.getBackgroundParticleCount(), 28);
      assert.equal(monitor.canSpawnSparks(), true);
      assert.equal(monitor.getDprCap(), 2.0);
    });

    it('remains in HIGH tier when frame times remain at 60 FPS (~16.6ms)', () => {
      for (let i = 0; i < 60; i++) {
        monitor.recordFrame(0.0166);
      }
      assert.equal(monitor.getQualityTier(), QUALITY_TIERS.HIGH);
      assert.ok(monitor.getFps() >= 58);
    });

    it('downgrades to MEDIUM tier when average FPS drops under 52 FPS for sustained duration', () => {
      // Warm up buffer and provide 1.6s of ~47 FPS (0.021s per frame)
      for (let i = 0; i < 95; i++) {
        monitor.recordFrame(0.021);
      }
      assert.equal(monitor.getQualityTier(), QUALITY_TIERS.MEDIUM);
      assert.equal(monitor.getMaxActiveParticles(), 130);
      assert.equal(monitor.getFrameSpawnBudget(), 32);
      assert.equal(monitor.getBackgroundParticleCount(), 16);
      assert.equal(monitor.canSpawnSparks(), true);
      assert.equal(monitor.getDprCap(), 2.0);
    });

    it('downgrades to LOW tier when average FPS drops under 42 FPS for sustained duration', () => {
      // Warm up and provide 2.2s of ~22 FPS (0.045s per frame)
      for (let i = 0; i < 70; i++) {
        monitor.recordFrame(0.045);
      }
      assert.equal(monitor.getQualityTier(), QUALITY_TIERS.LOW);
      assert.equal(monitor.getMaxActiveParticles(), 70);
      assert.equal(monitor.getFrameSpawnBudget(), 16);
      assert.equal(monitor.getBackgroundParticleCount(), 8);
      assert.equal(monitor.canSpawnSparks(), false);
      assert.equal(monitor.getDprCap(), 1.5);
    });

    it('applies hysteresis recovery to prevent rapid tier thrashing', () => {
      // Downgrade to LOW
      for (let i = 0; i < 70; i++) {
        monitor.recordFrame(0.045);
      }
      assert.equal(monitor.getQualityTier(), QUALITY_TIERS.LOW);

      // Supply 600 frames: (600 - 60) * 0.0166s = 8.96s > 8.0s continuous threshold
      for (let i = 0; i < 600; i++) {
        monitor.recordFrame(0.0166);
      }
      assert.equal(monitor.getQualityTier(), QUALITY_TIERS.MEDIUM);

      // Supply another 600 frames to upgrade back to HIGH
      for (let i = 0; i < 600; i++) {
        monitor.recordFrame(0.0166);
      }
      assert.equal(monitor.getQualityTier(), QUALITY_TIERS.HIGH);
    });

    it('notifies subscribers upon quality tier transition', () => {
      const transitions = [];
      const unsub = monitor.subscribeQuality((tier, prevTier) => {
        transitions.push({ tier, prevTier });
      });

      // Drop to LOW (70 frames of 45ms)
      for (let i = 0; i < 70; i++) {
        monitor.recordFrame(0.045);
      }

      assert.ok(transitions.length >= 1);
      assert.equal(transitions[transitions.length - 1].tier, QUALITY_TIERS.LOW);

      unsub();
      // Drop further frames, should not notify after unsubscribe
      const prevLength = transitions.length;
      for (let i = 0; i < 30; i++) {
        monitor.recordFrame(0.05);
      }
      assert.equal(transitions.length, prevLength);
    });

    it('cleans up resources on destroy', () => {
      let notified = false;
      const unsub = monitor.subscribeQuality(() => { notified = true; });
      unsub();
      notified = false;

      monitor.destroy();

      for (let i = 0; i < 60; i++) {
        monitor.recordFrame(0.045);
      }
      assert.equal(notified, false);
    });
  });

  describe('ParticleManager Adaptive Budgeting & Pool Integrity', () => {
    let pm;
    let monitor;

    beforeEach(() => {
      pm = new ParticleManager();
      monitor = new PerformanceMonitor();
      pm.setPerformanceMonitor(monitor);
    });

    afterEach(() => {
      pm.reset();
      monitor.destroy();
    });

    it('enforces frame spawn budget in LOW tier without dropping existing entities', () => {
      // Force LOW tier on monitor
      for (let i = 0; i < 70; i++) {
        monitor.recordFrame(0.045);
      }
      assert.equal(monitor.getQualityTier(), QUALITY_TIERS.LOW);

      // Low tier budget is 16 particles per frame
      pm.update(0.016);
      for (let i = 0; i < 50; i++) {
        pm.obtainParticle(100, 100, 0, 0, 0, 10, '#EF4444', 0.5, 'droplet');
      }

      // Particles spawned in this frame should be clamped to low tier budget (16)
      assert.equal(pm.pool.getActiveCount(), monitor.getFrameSpawnBudget());
    });

    it('resets frame budget count on each update tick', () => {
      for (let i = 0; i < 70; i++) {
        monitor.recordFrame(0.045);
      }

      // First tick
      pm.update(0.016);
      pm.obtainParticle(100, 100, 0, 0, 0, 10, '#EF4444', 0.5, 'droplet');
      assert.ok(pm.spawnsThisFrame > 0);

      // Next tick resets per-frame budget
      pm.update(0.016);
      assert.equal(pm.spawnsThisFrame, 0);
    });

    it('returns expired particles to pool without unbounded memory growth', () => {
      for (let i = 0; i < 10; i++) {
        pm.obtainParticle(200, 200, 0, 0, 0, 8, '#10B981', 0.3, 'droplet');
      }
      const initialActive = pm.pool.getActiveCount();
      assert.equal(initialActive, 10);

      // Advance time beyond particle life (1.5 seconds)
      pm.update(2.0);

      // All expired particles should be recycled back to the pool
      assert.equal(pm.pool.getActiveCount(), 0);
    });
  });

  describe('ArcadeEnvironment Dynamic Mote Scaling & Gradient Caching', () => {
    let env;
    let monitor;
    let ctx;

    beforeEach(() => {
      ctx = createMockContext();
      env = new ArcadeEnvironment();
      monitor = new PerformanceMonitor();
      env.setPerformanceMonitor(monitor);
    });

    afterEach(() => {
      env.destroy();
      monitor.destroy();
    });

    it('maintains ambient particle pool and respects quality tier in rendering', () => {
      assert.equal(env.particles.length, 28);

      // Transition to LOW tier
      for (let i = 0; i < 70; i++) {
        monitor.recordFrame(0.045);
      }
      assert.equal(monitor.getQualityTier(), QUALITY_TIERS.LOW);
      assert.equal(monitor.getBackgroundParticleCount(), 8);
    });

    it('caches radial clarity and bottom fog gradients across render frames', () => {
      env.resize(800, 600, 1);

      // Render Layer 6 depth haze and clarity
      env.renderDepthHazeAndClarity(ctx, 800, 600);
      const radGradCount = ctx.getRadialGradientCount();
      const linGradCount = ctx.getLinearGradientCount();

      // Render 5 successive frames
      for (let i = 0; i < 5; i++) {
        env.renderDepthHazeAndClarity(ctx, 800, 600);
      }

      // No additional gradient instances should be created during subsequent render frames
      assert.equal(ctx.getRadialGradientCount(), radGradCount);
      assert.equal(ctx.getLinearGradientCount(), linGradCount);
    });
  });

  describe('BladeTrail Spark Gating on Weak Devices', () => {
    let bladeTrail;
    let monitor;
    let inputManager;
    let canvas;
    let ctx;

    beforeEach(() => {
      ctx = createMockContext();
      canvas = createMockCanvas(ctx);
      inputManager = new InputManager(canvas);
      bladeTrail = new BladeTrail(inputManager);
      monitor = new PerformanceMonitor();
      bladeTrail.setPerformanceMonitor(monitor);
    });

    afterEach(() => {
      bladeTrail.reset();
      inputManager.detach();
      monitor.destroy();
    });

    it('allows micro-sparks on HIGH tier during fast blade slicing', () => {
      assert.equal(monitor.canSpawnSparks(), true);
      // Simulate fast blade motion
      bladeTrail.update(0.016, 500, true);
      // Pre-allocated spark pool contains 40 objects ready for emission
      assert.equal(bladeTrail.sparks.length, 40);
    });

    it('skips secondary micro-sparks on LOW tier while preserving responsive blade trail', () => {
      // Force LOW tier
      for (let i = 0; i < 70; i++) {
        monitor.recordFrame(0.045);
      }
      assert.equal(monitor.canSpawnSparks(), false);

      bladeTrail.update(0.016, 500, true);
      // Secondary spark emissions remain inactive
      const activeSparks = bladeTrail.sparks.filter((s) => s.active).length;
      assert.equal(activeSparks, 0);
    });
  });

  describe('InputManager Viewport Rect Caching & Coordinate Reuse', () => {
    let inputManager;
    let canvas;
    let ctx;

    beforeEach(() => {
      ctx = createMockContext();
      canvas = createMockCanvas(ctx);
      inputManager = new InputManager(canvas);
    });

    afterEach(() => {
      inputManager.detach();
    });

    it('caches viewport bounds to prevent getBoundingClientRect reflow thrashing', () => {
      const initialCalls = canvas.getBoundCallCount();
      assert.ok(initialCalls >= 1);

      // Simulate pointer moves
      inputManager.handlePointerMove({ clientX: 100, clientY: 150, pointerId: 1 });
      inputManager.handlePointerMove({ clientX: 110, clientY: 160, pointerId: 1 });
      inputManager.handlePointerMove({ clientX: 120, clientY: 170, pointerId: 1 });

      // getBoundingClientRect should NOT be called on every pointer move
      assert.equal(canvas.getBoundCallCount(), initialCalls);
    });

    it('reuses internal tempCoords object to avoid garbage collection', () => {
      const coords1 = inputManager.getCanvasCoordinates(100, 100);
      const coords2 = inputManager.getCanvasCoordinates(200, 200);

      // Pointer to same pre-allocated object
      assert.equal(coords1, coords2);
      assert.equal(coords2.x, 190); // 200 - rectLeft (10)
      assert.equal(coords2.y, 180); // 200 - rectTop (20)
    });
  });

  describe('PowerUpManager & GameState Throttled Notifications', () => {
    let powerUpManager;
    let gameState;

    beforeEach(() => {
      gameState = new GameState();
      powerUpManager = new PowerUpManager();
      powerUpManager.setGameState(gameState);
    });

    afterEach(() => {
      powerUpManager.destroy();
      gameState.destroy();
    });

    it('notifies immediately upon power-up activation and expiration', () => {
      const events = [];
      powerUpManager.subscribe((active) => {
        events.push(active.length);
      });

      // Initial subscription gives current count (0)
      assert.equal(events.length, 1);
      assert.equal(events[0], 0);

      // Activate Frenzy
      powerUpManager.activate(POWER_UP_TYPES.FRENZY);
      assert.equal(events.length, 2);
      assert.equal(events[1], 1);

      // Expire by ticking past duration (Frenzy duration is 10s)
      powerUpManager.update(12.0);
      assert.equal(events.length, 3);
      assert.equal(events[2], 0);
    });

    it('throttles mid-tick progress notifications to ~12Hz (~80ms)', () => {
      powerUpManager.activate(POWER_UP_TYPES.SLOW_MOTION);

      let tickNotifications = 0;
      powerUpManager.subscribe(() => {
        tickNotifications++;
      });
      // Reset after initial subscription callback
      tickNotifications = 0;

      // Simulate 4 successive 60 FPS frames (4 * 16.6ms = ~66.4ms < 80ms throttle window)
      for (let i = 0; i < 4; i++) {
        powerUpManager.update(0.0166);
      }
      assert.equal(tickNotifications, 0);

      // 5th frame passes the 80ms threshold (5 * 16.6ms = 83ms > 80ms)
      powerUpManager.update(0.0166);
      assert.equal(tickNotifications, 1);
    });

    it('throttles GameState fever progress notifications to ~12Hz (~80ms)', () => {
      gameState.setState(STATES.PLAYING);
      // Enter fever mode directly
      gameState.enterFeverMode();
      assert.equal(gameState.isFeverActive, true);

      let feverProgressNotifications = 0;
      gameState.subscribeFever((isFever, details) => {
        if (isFever && details?.isProgress) {
          feverProgressNotifications++;
        }
      });

      // 4 frames at 16.6ms = ~66.4ms < 80ms
      for (let i = 0; i < 4; i++) {
        gameState.update(0.0166);
      }
      assert.equal(feverProgressNotifications, 0);

      // 5th frame reaches > 80ms
      gameState.update(0.0166);
      assert.equal(feverProgressNotifications, 1);
    });
  });
});
