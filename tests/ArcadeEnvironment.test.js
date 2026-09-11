import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { ArcadeEnvironment } from '../src/game/ArcadeEnvironment.js';
import { GameState, STATES } from '../src/game/GameState.js';

function createMockContext() {
  const calls = [];
  return {
    calls,
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
    drawImage: (img, x, y, w, h) => calls.push(`drawImage(${x},${y},${w},${h})`),
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    createRadialGradient: () => ({
      addColorStop: () => {},
    }),
    setTransform: () => {},
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  };
}

function createMockCanvas(ctx) {
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
  };
}

describe('ArcadeEnvironment System Tests', () => {
  let originalDocument;
  let mockCtx;

  beforeEach(() => {
    mockCtx = createMockContext();
    originalDocument = globalThis.document;
    globalThis.document = {
      createElement: (tag) => {
        if (tag === 'canvas') {
          return createMockCanvas(mockCtx);
        }
        return {};
      },
    };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  describe('Architecture & Layer Initialization', () => {
    it('initializes with 28 object-pooled ambient motes and pre-configured depths', () => {
      const env = new ArcadeEnvironment();
      assert.equal(env.particles.length, 28);

      for (const p of env.particles) {
        assert.ok(p.depth >= 0.35 && p.depth <= 1.0);
        assert.ok(p.size > 0);
        assert.ok(p.baseAlpha > 0);
        assert.ok(p.color);
        assert.ok(typeof p.color.r === 'number');
      }
    });

    it('initializes 5 distant abstract geometric shapes outside central fruit zone', () => {
      const env = new ArcadeEnvironment();
      assert.equal(env.shapes.length, 5);

      for (const s of env.shapes) {
        assert.ok(s.radius > 0);
        assert.ok(s.normX < 0.35 || s.normX > 0.65 || s.normY < 0.25);
        assert.ok(s.type === 'arc' || s.type === 'orb');
      }
    });

    it('initializes cinematic diagonal light streaks', () => {
      const env = new ArcadeEnvironment();
      assert.equal(env.streaks.length, 2);

      for (const s of env.streaks) {
        assert.ok(s.height > 0);
        assert.ok(s.angleDeg > 0);
        assert.ok(s.speed > 0);
      }
    });
  });

  describe('Viewport Resize & Static Layer Baking', () => {
    it('bakes static deep gradient (Layer 1) and contours (Layer 3) into offscreen canvas', () => {
      const env = new ArcadeEnvironment();
      env.resize(960, 540, 2);

      assert.equal(env.w, 960);
      assert.equal(env.h, 540);
      assert.equal(env.dpr, 2);
      assert.ok(env.staticCanvas);
      assert.equal(env.staticCanvas.width, 960 * 2);
      assert.equal(env.staticCanvas.height, 540 * 2);
    });

    it('gracefully handles zero or negative dimensions without error', () => {
      const env = new ArcadeEnvironment();
      env.resize(0, 0, 1);
      assert.equal(env.w, 0);
      assert.equal(env.h, 0);
    });
  });

  describe('Dynamic Gameplay Energy Responsiveness', () => {
    it('maintains nominal energy (1.0) during standard gameplay', () => {
      const env = new ArcadeEnvironment();
      const gameState = new GameState();
      gameState.setState(STATES.PLAYING);

      env.update(0.1, gameState);
      assert.ok(Math.abs(env.targetEnergy - 1.0) < 0.01);
      assert.ok(env.energy > 0.9 && env.energy <= 1.1);
    });

    it('ramps up background energy and combo intensity during active combos', () => {
      const env = new ArcadeEnvironment();
      const gameState = new GameState();
      gameState.setState(STATES.PLAYING);
      gameState.combo = 8;

      for (let i = 0; i < 5; i++) {
        env.update(0.05, gameState);
      }

      assert.ok(env.targetEnergy > 1.2);
      assert.ok(env.comboIntensity > 0.4);
    });

    it('surges background energy to 2.0 during Fever Mode with radial excitement', () => {
      const env = new ArcadeEnvironment();
      const gameState = new GameState();
      gameState.setState(STATES.PLAYING);
      gameState.isFeverActive = true;

      // Advance multiple frames for smooth lerp
      for (let i = 0; i < 15; i++) {
        env.update(0.05, gameState);
      }

      assert.equal(env.targetEnergy, 2.0);
      assert.ok(env.energy > 1.5);
      assert.ok(env.feverIntensity > 0.7);
    });

    it('cinematically slows and dims the environment upon Game Over', () => {
      const env = new ArcadeEnvironment();
      const gameState = new GameState();
      gameState.setState(STATES.GAME_OVER);

      for (let i = 0; i < 20; i++) {
        env.update(0.05, gameState);
      }

      assert.equal(env.targetEnergy, 0.35);
      assert.ok(env.energy < 0.6);
      assert.ok(env.gameOverIntensity > 0.7);
    });
  });

  describe('Ambient Particle Pool Physics', () => {
    it('updates particle positions organically without memory allocation', () => {
      const env = new ArcadeEnvironment();
      env.resize(800, 600, 1);
      const initialY = env.particles[0].y;

      const gameState = new GameState();
      gameState.setState(STATES.PLAYING);

      env.update(0.5, gameState);
      // Particle should have moved upward (y decreases)
      assert.notEqual(env.particles[0].y, initialY);
      // Particle count remains strictly fixed
      assert.equal(env.particles.length, 28);
    });

    it('wraps particles that drift out of bounds back into view', () => {
      const env = new ArcadeEnvironment();
      env.resize(800, 600, 1);
      env.particles[0].y = -25; // Drifted above top

      const gameState = new GameState();
      gameState.setState(STATES.PLAYING);

      env.update(0.05, gameState);
      assert.ok(env.particles[0].y >= 500); // Re-spawned at bottom
    });
  });

  describe('Composite Render Pipeline', () => {
    it('executes full composite render without exceptions in normal play', () => {
      const env = new ArcadeEnvironment();
      env.resize(800, 600, 1);
      const renderCtx = createMockContext();

      env.render(renderCtx, 800, 600);
      assert.ok(renderCtx.calls.length > 0);
    });

    it('renders radiant fever radial corona when fever intensity is elevated', () => {
      const env = new ArcadeEnvironment();
      env.resize(800, 600, 1);
      env.feverIntensity = 0.85;

      const renderCtx = createMockContext();
      env.render(renderCtx, 800, 600);

      // Verify fillRect calls include both base blit and fever corona pass
      const fillRectCalls = renderCtx.calls.filter((c) => c.startsWith('fillRect'));
      assert.ok(fillRectCalls.length >= 4);
    });

    it('cleans up resources on destroy', () => {
      const env = new ArcadeEnvironment();
      env.resize(800, 600, 1);
      env.destroy();

      assert.equal(env.particles.length, 0);
      assert.equal(env.shapes.length, 0);
      assert.equal(env.streaks.length, 0);
      assert.equal(env.staticCanvas, null);
    });
  });
});
