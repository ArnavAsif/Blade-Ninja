/**
 * Core game loop and engine coordinator.
 * Operates independently of React component render cycles.
 */

import { STATES } from './GameState.js';
import { InputManager } from './InputManager.js';
import { BladeTrail } from '../entities/BladeTrail.js';
import { FruitManager } from './FruitManager.js';
import { ParticleManager } from './ParticleManager.js';
import { CollisionManager } from './CollisionManager.js';
import { AudioManager } from './AudioManager.js';
import { getDevicePixelRatio } from '../utils/device.js';

export class GameEngine {
  constructor(canvas, gameState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.gameState = gameState;

    this.dpr = getDevicePixelRatio();
    this.logicalWidth = 0;
    this.logicalHeight = 0;

    // Subsystems
    this.inputManager = new InputManager(canvas);
    this.bladeTrail = new BladeTrail(this.inputManager);
    this.fruitManager = new FruitManager();
    this.particleManager = new ParticleManager();
    this.collisionManager = new CollisionManager();
    this.audioManager = new AudioManager();

    // Synchronize mode configuration with FruitManager
    this.modeUnsubscribe = this.gameState.subscribeMode((_mode, config) => {
      this.fruitManager.setModeConfig(config);
    });

    // Audio swoosh throttling
    this.lastSwooshTime = 0;
    this.screenShake = 0;
    this.missVignetteAlpha = 0;
    this.isGameOverTransition = false;
    this.gameOverTimer = 0;

    // Offscreen background cache for zero-allocation blitting
    this.bgCanvas = null;

    // Loop state
    this.isRunning = false;
    this.isPaused = false;
    this.lastTime = 0;
    this.animationFrameId = null;

    // Bound loop function for requestAnimationFrame
    this.loop = this.tick.bind(this);
    this.handleResize = this.resize.bind(this);
    this.handleVisibilityChange = this.onVisibilityChange.bind(this);

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    if (typeof window !== 'undefined' && window.screen && window.screen.orientation) {
      try {
        window.screen.orientation.addEventListener('change', this.handleResize);
      } catch {
        // Ignore
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.resize();
  }

  onVisibilityChange() {
    if (typeof document === 'undefined') return;

    if (document.hidden) {
      if (this.audioManager) {
        this.audioManager.stopAmbientMusic();
      }
    } else {
      this.lastTime = performance.now();
      if (this.audioManager && this.audioManager.musicEnabled && !this.isPaused) {
        this.audioManager.startAmbientMusic();
      }
    }
  }

  updateBackgroundCache(w, h) {
    if (w <= 0 || h <= 0) return;

    if (!this.bgCanvas) {
      this.bgCanvas = document.createElement('canvas');
    }
    this.bgCanvas.width = Math.max(1, Math.round(w * this.dpr));
    this.bgCanvas.height = Math.max(1, Math.round(h * this.dpr));

    const bgCtx = this.bgCanvas.getContext('2d');
    bgCtx.imageSmoothingEnabled = true;
    bgCtx.imageSmoothingQuality = 'high';
    bgCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 1. Rich dark obsidian dojo wood base
    bgCtx.fillStyle = '#0B0F15';
    bgCtx.fillRect(0, 0, w, h);

    // 2. Vertical dojo wood planks tailored for landscape arena
    const plankWidth = Math.max(64, Math.round(w / 16));
    const plankCount = Math.ceil(w / plankWidth) + 1;

    for (let i = 0; i < plankCount; i++) {
      const px = i * plankWidth;
      const shadeOffset = (i % 2 === 0) ? 0.015 : 0.0;

      // Plank body
      bgCtx.fillStyle = `rgba(255, 255, 255, ${0.012 + shadeOffset})`;
      bgCtx.fillRect(px, 0, plankWidth - 2, h);

      // Plank seam line
      bgCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      bgCtx.fillRect(px + plankWidth - 2, 0, 2, h);

      // Subtle vertical wood grain striations
      bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.008)';
      bgCtx.lineWidth = 1;
      const subGrains = 2;
      for (let g = 1; g <= subGrains; g++) {
        const gx = px + (plankWidth * g) / (subGrains + 1);
        bgCtx.beginPath();
        bgCtx.moveTo(gx, 0);
        bgCtx.lineTo(gx, h);
        bgCtx.stroke();
      }
    }

    // 3. Warm central lantern spotlighting
    const spotlight = bgCtx.createRadialGradient(
      w * 0.5,
      h * 0.42,
      Math.min(w, h) * 0.08,
      w * 0.5,
      h * 0.48,
      Math.max(w, h) * 0.75
    );
    spotlight.addColorStop(0, 'rgba(30, 41, 59, 0.85)');
    spotlight.addColorStop(0.35, 'rgba(15, 23, 42, 0.70)');
    spotlight.addColorStop(0.70, 'rgba(10, 15, 26, 0.85)');
    spotlight.addColorStop(1, 'rgba(5, 7, 12, 0.98)');

    bgCtx.fillStyle = spotlight;
    bgCtx.fillRect(0, 0, w, h);

    // 4. Subtle arcade perimeter edge vignette
    const edgeVignette = bgCtx.createRadialGradient(
      w * 0.5,
      h * 0.5,
      Math.min(w, h) * 0.45,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.75
    );
    edgeVignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edgeVignette.addColorStop(1, 'rgba(0, 0, 0, 0.65)');

    bgCtx.fillStyle = edgeVignette;
    bgCtx.fillRect(0, 0, w, h);
  }

  resize() {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.logicalWidth = rect.width;
    this.logicalHeight = rect.height;
    this.dpr = getDevicePixelRatio();

    // Scale canvas buffer for high-DPI crisp rendering
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));

    // Explicit CSS dimensions to eliminate fractional rendering blur
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    // Normalize context coordinate system to match CSS pixels
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Pre-render static background into offscreen buffer
    this.updateBackgroundCache(rect.width, rect.height);
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this.fruitManager.setModeConfig(this.gameState.getModeConfig());
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  pause() {
    this.isPaused = true;
    this.bladeTrail.reset();
    this.audioManager.playPause();
    if (this.gameState.is(STATES.PLAYING)) {
      this.gameState.setState(STATES.PAUSED);
    }
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.lastTime = performance.now();
      this.audioManager.playResume();
      if (this.gameState.is(STATES.PAUSED)) {
        this.gameState.setState(STATES.PLAYING);
      }
    }
  }

  reset() {
    this.fruitManager.setModeConfig(this.gameState.getModeConfig());
    this.fruitManager.reset();
    this.particleManager.reset();
    this.bladeTrail.reset();
    this.screenShake = 0;
    this.missVignetteAlpha = 0;
    this.isGameOverTransition = false;
    this.gameOverTimer = 0;
    this.gameState.resetSession();
    this.lastTime = performance.now();
  }

  tick(timestamp) {
    if (!this.isRunning) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    if (!this.isPaused) {
      this.update(dt);
    }

    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  update(dt) {
    // Always update blade trail and input so responsive slashing visual works
    this.bladeTrail.update();

    const cut = this.inputManager.getActiveCutSegment();
    if (cut && cut.speed > 550 && performance.now() - this.lastSwooshTime > 220) {
      this.audioManager.init();
      this.audioManager.playSwoosh();
      this.lastSwooshTime = performance.now();
    }

    // Smooth exponential damping for screen micro-shake
    if (this.screenShake > 0.05) {
      this.screenShake *= Math.pow(0.04, dt);
    } else {
      this.screenShake = 0;
    }

    // Decay crimson miss flash
    if (this.missVignetteAlpha > 0.01) {
      this.missVignetteAlpha *= Math.pow(0.02, dt);
    } else {
      this.missVignetteAlpha = 0;
    }

    // Handle game over transition countdown
    if (this.isGameOverTransition) {
      this.gameOverTimer -= dt;
      if (this.gameOverTimer <= 0) {
        this.isGameOverTransition = false;
        this.gameState.setState(STATES.GAME_OVER);
      }
    }

    const currentState = this.gameState.getState();

    if (currentState === STATES.PLAYING) {
      this.gameState.update(dt);

      // Check if round timer reached 0 in timed modes (e.g. Zen or Arcade)
      if (this.gameState.hasTimer() && this.gameState.timeRemaining <= 0) {
        this.triggerGameOverSequence();
      }

      // Check multi-segment slice cuts against active entities
      const cuts = this.inputManager.getActiveCutSegments();
      if (cuts.length > 0) {
        this.collisionManager.checkSliceCollisions(
          cuts,
          this.fruitManager,
          (fruit, cutSegment, hitPoint) => {
            // 1. Scoring update decoupled from frame loop
            const result = this.gameState.registerSlice(fruit.type);

            // 2. Play procedural slice audio with fruit-specific timbre and combo chord
            this.audioManager.playFruitSlice(fruit.type);
            if (result.isCombo) {
              this.audioManager.playCombo(result.combo);
            }

            // 3. Directional juice particles, pulp, impact star spark, and splash flash at exact hitPoint
            this.particleManager.spawnSliceEffects(
              fruit.x,
              fruit.y,
              cutSegment,
              fruit.type,
              fruit.radius,
              hitPoint
            );

            // 4. Floating canvas score / combo popup centered on slice contact
            const popupText = result.multiplier > 1
              ? `+${result.pointsEarned} (${result.combo}x)`
              : `+${result.pointsEarned}`;
            const popupColor = result.multiplier >= 3 ? '#FBBF24' : '#F8FAFC';
            const popupX = hitPoint ? hitPoint.x : fruit.x;
            const popupY = (hitPoint ? hitPoint.y : fruit.y) - 14;
            this.particleManager.spawnScorePopup(popupX, popupY, popupText, popupColor);

            // 5. Crisp physical screen micro-jolt
            this.screenShake = Math.min(this.screenShake + 3.2, 5.5);
          },
          (bomb, _cutSegment, hitPoint) => {
            // 1. Play synthesized sub-bass explosion
            this.audioManager.init();
            this.audioManager.playBombExplosion();

            // 2. Spawn shockwave rings, fiery embers, and billowing smoke puffs at exact contact point
            const bombX = hitPoint ? hitPoint.x : bomb.x;
            const bombY = hitPoint ? hitPoint.y : bomb.y;
            this.particleManager.spawnBombExplosion(bombX, bombY);

            // 3. Trigger 12px maximum explosion screen shake
            this.screenShake = 12.0;

            // 4. Deduct score penalty, reset combo, and apply strike/life loss
            const penalty = this.gameState.registerBombHit();

            // 5. Floating canvas penalty popup
            const penaltyText = penalty.scoreLost > 0 ? `-${penalty.scoreLost}` : '-10';
            this.particleManager.spawnScorePopup(bombX, bombY - 18, penaltyText, '#EF4444');

            if (penalty.isGameOver) {
              this.triggerGameOverSequence();
            }
          }
        );
      }

      this.fruitManager.update(
        dt,
        this.logicalWidth,
        this.logicalHeight,
        (fruit) => this.handleFruitMissed(fruit)
      );
      this.particleManager.update(dt);
    } else {
      this.particleManager.update(dt);
    }
  }

  handleFruitMissed(fruit) {
    if (!this.gameState.is(STATES.PLAYING) || this.isGameOverTransition) return;

    // In modes where misses do not cost lives (Zen, Arcade), falling fruits are harmless
    if (!this.gameState.missCostsLife()) return;

    // 1. Audio feedback
    this.audioManager.init();
    this.audioManager.playFruitMissed();

    // 2. Spawn red missed 'X' marker particle at the bottom where fruit dropped
    const markerX = Math.max(30, Math.min(this.logicalWidth - 30, fruit.x));
    const markerY = this.logicalHeight - 25;
    this.particleManager.spawnMissedMarker(markerX, markerY);

    // 3. Tactile feedback: micro screen shake & bottom crimson flash
    this.screenShake = Math.max(this.screenShake, 4.2);
    this.missVignetteAlpha = 0.5;

    // 4. Centralized life deduction
    const isFatal = this.gameState.loseLife();

    if (isFatal) {
      this.triggerGameOverSequence();
    }
  }

  triggerGameOverSequence() {
    if (this.isGameOverTransition) return;

    this.fruitManager.stopSpawning = true;
    this.isGameOverTransition = true;
    this.gameOverTimer = 0.75;
    this.audioManager.playGameOver();
  }

  render() {
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    if (w <= 0 || h <= 0) return;

    const hasShake = this.screenShake > 0.08;
    if (hasShake) {
      this.ctx.save();
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(sx, sy);
    }

    // 1. Blit pre-rasterized dark cinematic background
    if (this.bgCanvas) {
      this.ctx.drawImage(this.bgCanvas, 0, 0, w, h);
    } else {
      this.ctx.fillStyle = '#07090C';
      this.ctx.fillRect(0, 0, w, h);
    }

    // 2. Render game entities
    this.fruitManager.render(this.ctx);
    this.particleManager.render(this.ctx);

    // 3. Render active blade trail over game objects
    this.bladeTrail.render(this.ctx);

    // 4. Render subtle crimson miss impact vignette along bottom
    if (this.missVignetteAlpha > 0.01) {
      const missGrad = this.ctx.createLinearGradient(0, h, 0, h - 120);
      missGrad.addColorStop(0, `rgba(239, 68, 68, ${this.missVignetteAlpha * 0.42})`);
      missGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      this.ctx.fillStyle = missGrad;
      this.ctx.fillRect(0, h - 120, w, 120);
    }

    if (hasShake) {
      this.ctx.restore();
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    if (typeof window !== 'undefined' && window.screen && window.screen.orientation) {
      try {
        window.screen.orientation.removeEventListener('change', this.handleResize);
      } catch {
        // Ignore
      }
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.audioManager) {
      this.audioManager.destroy();
    }
    if (this.modeUnsubscribe) {
      this.modeUnsubscribe();
      this.modeUnsubscribe = null;
    }
    this.inputManager.destroy();
    this.bgCanvas = null;
    this.canvas = null;
    this.ctx = null;
  }
}
