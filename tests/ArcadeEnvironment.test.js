import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { ArcadeEnvironment } from '../src/game/ArcadeEnvironment.js';
import { GameState, STATES } from '../src/game/GameState.js';
import {
  BACKGROUND_IDS,
  BACKGROUND_CONFIGS,
  BACKGROUND_LIST,
  DEFAULT_BACKGROUND_ID,
  RANDOM_STAGE_ID,
  getBackgroundConfig,
  getRandomBackgroundId,
} from '../src/game/BackgroundConfig.js';

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
    drawImage: (img, x, y, w, h) => calls.push(`drawImage(${img?.src || 'img'},${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(h)})`),
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
    globalAlpha: 1.0,
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

class MockImage {
  constructor() {
    this.src = '';
    this.naturalWidth = 766;
    this.naturalHeight = 338;
    this.width = 766;
    this.height = 338;
    this.complete = true;
  }
}

describe('ArcadeEnvironment System Tests', () => {
  let originalDocument;
  let originalImage;
  let mockCtx;

  beforeEach(() => {
    mockCtx = createMockContext();
    originalDocument = globalThis.document;
    originalImage = globalThis.Image;

    globalThis.Image = MockImage;
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
    globalThis.Image = originalImage;
  });

  describe('Stage Configuration & Variants', () => {
    it('defines all 6 distinct arcade stage environments with valid assets and colors', () => {
      assert.equal(BACKGROUND_LIST.length, 6);
      const expectedIds = ['cosmic', 'sunset', 'mystic', 'volcanic', 'sky', 'neon'];

      for (const id of expectedIds) {
        const config = BACKGROUND_CONFIGS[id];
        assert.ok(config, `Missing config for stage ${id}`);
        assert.equal(config.id, id);
        assert.ok(config.name.length > 0);
        assert.ok(config.tagline.length > 0);
        assert.ok(config.image.startsWith('/backgrounds/bg_'));
        assert.ok(config.primaryColor.startsWith('#'));
        assert.ok(config.accentColor.startsWith('#'));
        assert.ok(config.glow1 && typeof config.glow1.r === 'number');
        assert.ok(config.glow2 && typeof config.glow2.r === 'number');
        assert.ok(Array.isArray(config.particleColors) && config.particleColors.length >= 3);
        assert.ok(config.hazeRgb && typeof config.hazeRgb.r === 'number');
        assert.ok(config.vignetteStrength > 0.5 && config.vignetteStrength <= 1.0);
        assert.ok(config.clarityMaskStrength > 0.1 && config.clarityMaskStrength <= 0.5);
      }
    });

    it('returns default stage config when given invalid stage id', () => {
      const fallback = getBackgroundConfig('non_existent_stage');
      assert.equal(fallback.id, DEFAULT_BACKGROUND_ID);
      assert.equal(fallback.name, 'Cosmic Astral');
    });

    it('returns a valid stage id from getRandomBackgroundId', () => {
      for (let i = 0; i < 20; i++) {
        const randomId = getRandomBackgroundId();
        assert.ok(Object.values(BACKGROUND_IDS).includes(randomId));
      }
    });
  });

  describe('Architecture & Layer Initialization', () => {
    it('initializes with default stage Cosmic Astral and preloads stage assets', () => {
      const env = new ArcadeEnvironment();
      assert.equal(env.getStageId(), DEFAULT_BACKGROUND_ID);
      assert.equal(env.getStageConfig().id, DEFAULT_BACKGROUND_ID);
      assert.ok(env.currentImage);
      assert.equal(env.transitionProgress, 1.0);
    });

    it('initializes with custom stage when specified', () => {
      const env = new ArcadeEnvironment(BACKGROUND_IDS.SUNSET);
      assert.equal(env.getStageId(), BACKGROUND_IDS.SUNSET);
      assert.equal(env.getStageConfig().name, 'Sunset Pagoda');
    });

    it('initializes with 28 object-pooled ambient motes tuned to stage palette', () => {
      const env = new ArcadeEnvironment(BACKGROUND_IDS.VOLCANIC);
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

  describe('Stage Selection & Crossfading', () => {
    it('initiates smooth crossfade when switching stages', () => {
      const env = new ArcadeEnvironment(BACKGROUND_IDS.COSMIC);
      assert.equal(env.getStageId(), BACKGROUND_IDS.COSMIC);
      assert.equal(env.transitionProgress, 1.0);

      env.setBackground(BACKGROUND_IDS.MYSTIC, true);

      assert.equal(env.getStageId(), BACKGROUND_IDS.MYSTIC);
      assert.equal(env.transitionProgress, 0.0);
      assert.ok(env.prevConfig);
      assert.equal(env.prevConfig.id, BACKGROUND_IDS.COSMIC);
      assert.ok(env.prevImage);
    });

    it('advances crossfade progression across updates until complete', () => {
      const env = new ArcadeEnvironment(BACKGROUND_IDS.COSMIC);
      env.setBackground(BACKGROUND_IDS.NEON, true);
      assert.equal(env.transitionProgress, 0.0);

      // Advance half transition duration with frame-sized steps
      for (let i = 0; i < 5; i++) {
        env.update(0.085);
      }
      assert.ok(env.transitionProgress > 0.4 && env.transitionProgress < 0.6);

      // Complete transition
      for (let i = 0; i < 8; i++) {
        env.update(0.085);
      }
      assert.equal(env.transitionProgress, 1.0);
      assert.equal(env.prevConfig, null);
      assert.equal(env.prevImage, null);
    });

    it('retints ambient particles to new stage palette upon stage switch', () => {
      const env = new ArcadeEnvironment(BACKGROUND_IDS.COSMIC);
      const cosmicColors = BACKGROUND_CONFIGS[BACKGROUND_IDS.COSMIC].particleColors;
      assert.deepEqual(env.particles[0].color, cosmicColors[0]);

      env.setBackground(BACKGROUND_IDS.VOLCANIC);
      const volcanicColors = BACKGROUND_CONFIGS[BACKGROUND_IDS.VOLCANIC].particleColors;
      assert.deepEqual(env.particles[0].color, volcanicColors[0]);
    });

    it('supports immediate stage switch without crossfade when requested', () => {
      const env = new ArcadeEnvironment(BACKGROUND_IDS.COSMIC);
      env.setBackground(BACKGROUND_IDS.SKY, false);

      assert.equal(env.getStageId(), BACKGROUND_IDS.SKY);
      assert.equal(env.transitionProgress, 1.0);
      assert.equal(env.prevConfig, null);
      assert.equal(env.prevImage, null);
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
      assert.notEqual(env.particles[0].y, initialY);
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
    it('renders base stage artwork using cover scaling and drawImage', () => {
      const env = new ArcadeEnvironment(BACKGROUND_IDS.COSMIC);
      env.resize(800, 600, 1);
      const renderCtx = createMockContext();

      env.render(renderCtx, 800, 600);

      // Verify drawImage was called with stage artwork
      const drawImageCalls = renderCtx.calls.filter((c) => c.startsWith('drawImage'));
      assert.ok(drawImageCalls.length >= 1);
    });

    it('renders both previous and current images during crossfade transition', () => {
      const env = new ArcadeEnvironment(BACKGROUND_IDS.COSMIC);
      env.resize(800, 600, 1);
      env.setBackground(BACKGROUND_IDS.VOLCANIC, true);
      env.transitionProgress = 0.5; // Mid-crossfade

      const renderCtx = createMockContext();
      env.render(renderCtx, 800, 600);

      // In mid-crossfade, drawImage is called for static canvas, prevImage, and currentImage
      const drawImageCalls = renderCtx.calls.filter((c) => c.startsWith('drawImage'));
      assert.ok(drawImageCalls.length >= 2);
    });

    it('renders radiant fever radial corona when fever intensity is elevated', () => {
      const env = new ArcadeEnvironment();
      env.resize(800, 600, 1);
      env.feverIntensity = 0.85;

      const renderCtx = createMockContext();
      env.render(renderCtx, 800, 600);

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
      assert.equal(env.currentImage, null);
      assert.equal(env.prevImage, null);
      assert.equal(env.staticCanvas, null);
    });
  });

  describe('GameState Background Selection & Persistence', () => {
    let mockStorage;
    let originalLocalStorage;
    let originalWindow;

    beforeEach(() => {
      mockStorage = {};
      originalLocalStorage = globalThis.localStorage;
      originalWindow = globalThis.window;

      const storageMock = {
        getItem: (k) => mockStorage[k] ?? null,
        setItem: (k, v) => { mockStorage[k] = v.toString(); },
        removeItem: (k) => { delete mockStorage[k]; },
      };

      globalThis.localStorage = storageMock;
      globalThis.window = { localStorage: storageMock };
    });

    afterEach(() => {
      globalThis.localStorage = originalLocalStorage;
      globalThis.window = originalWindow;
    });

    it('initializes GameState with default stage Cosmic Astral', () => {
      const gameState = new GameState();
      assert.equal(gameState.getSelectedBackground(), DEFAULT_BACKGROUND_ID);
      assert.equal(gameState.getActiveBackground(), DEFAULT_BACKGROUND_ID);
    });

    it('sets and persists selected background to localStorage', () => {
      const gameState = new GameState();
      gameState.setBackground(BACKGROUND_IDS.SUNSET);

      assert.equal(gameState.getSelectedBackground(), BACKGROUND_IDS.SUNSET);
      assert.equal(gameState.getActiveBackground(), BACKGROUND_IDS.SUNSET);
      assert.equal(mockStorage['blade_ninja_selected_background'], BACKGROUND_IDS.SUNSET);
    });

    it('notifies subscribers upon stage change', () => {
      const gameState = new GameState();
      const events = [];

      const unsubscribe = gameState.subscribeBackground((active, selected) => {
        events.push({ active, selected });
      });

      // Initial call
      assert.equal(events.length, 1);
      assert.equal(events[0].active, DEFAULT_BACKGROUND_ID);

      // Change stage
      gameState.setBackground(BACKGROUND_IDS.NEON);
      assert.equal(events.length, 2);
      assert.equal(events[1].active, BACKGROUND_IDS.NEON);
      assert.equal(events[1].selected, BACKGROUND_IDS.NEON);

      unsubscribe();
      gameState.setBackground(BACKGROUND_IDS.MYSTIC);
      assert.equal(events.length, 2); // Unsubscribed
    });

    it('picks a fresh random stage on session reset when Random Arena is selected', () => {
      const gameState = new GameState();
      gameState.setBackground(RANDOM_STAGE_ID);

      assert.equal(gameState.getSelectedBackground(), RANDOM_STAGE_ID);
      assert.ok(Object.values(BACKGROUND_IDS).includes(gameState.getActiveBackground()));

      // Reset session picks and notifies
      let lastActive = null;
      gameState.subscribeBackground((active) => {
        lastActive = active;
      });

      gameState.resetSession();
      assert.ok(Object.values(BACKGROUND_IDS).includes(lastActive));
    });
  });
});
