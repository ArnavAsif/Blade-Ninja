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
import { PowerUpManager } from './PowerUpManager.js';
import { initPowerUpSprites, POWER_UP_TYPES } from '../assets/PowerUpSprites.js';
import { ArcadeEnvironment } from './ArcadeEnvironment.js';
import { getDevicePixelRatio } from '../utils/device.js';
import { lerp } from '../utils/math.js';

export class GameEngine {
  constructor(canvas, gameState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.gameState = gameState;

    this.dpr = getDevicePixelRatio();
    this.logicalWidth = 0;
    this.logicalHeight = 0;

    // Pre-warm high-DPI procedural vector power-up sprites
    initPowerUpSprites();

    // Subsystems
    this.inputManager = new InputManager(canvas);
    this.bladeTrail = new BladeTrail(this.inputManager);
    this.fruitManager = new FruitManager();
    this.particleManager = new ParticleManager();
    this.collisionManager = new CollisionManager();
    this.audioManager = new AudioManager();
    this.powerUpManager = new PowerUpManager();
    const initialStage = this.gameState && typeof this.gameState.getActiveBackground === 'function'
      ? this.gameState.getActiveBackground()
      : undefined;
    this.environment = new ArcadeEnvironment(initialStage);

    // Synchronize active stage background with GameState
    this.bgUnsubscribe = this.gameState && typeof this.gameState.subscribeBackground === 'function'
      ? this.gameState.subscribeBackground((activeBg) => {
          if (this.environment) {
            this.environment.setBackground(activeBg);
          }
        })
      : null;

    // Wire PowerUpManager with GameState, FruitManager, and audio callbacks
    this.powerUpManager.setGameState(this.gameState);
    this.fruitManager.setPowerUpManager(this.powerUpManager);
    this.gameState.setPowerUpManager(this.powerUpManager);

    this.powerUpManager.onActivate = (type, _config, _isInstant) => {
      this.audioManager.init();
      this.audioManager.playPowerUpActivate(type);
    };
    this.powerUpManager.onExpire = (type, _config) => {
      this.audioManager.playPowerUpExpire(type);
    };

    // Synchronize mode configuration with FruitManager and pass GameState
    this.fruitManager.setGameState(this.gameState);
    this.modeUnsubscribe = this.gameState.subscribeMode((_mode, config) => {
      this.fruitManager.setModeConfig(config);
    });

    // Life recovery events (milestone or bonus recovery fruit)
    this.lifeRecoveredUnsubscribe = this.gameState.subscribeLifeRecovered((event) => {
      this.audioManager.init();
      this.audioManager.playLifeRecovered();
      const posX = Number.isFinite(event.x) ? event.x : (this.logicalWidth > 0 ? this.logicalWidth * 0.5 : 400);
      const posY = Number.isFinite(event.y) ? event.y : (this.logicalHeight > 0 ? this.logicalHeight * 0.28 : 150);
      const text = event.source === 'milestone' ? '+1 LIFE (MILESTONE)!' : '+1 LIFE RECOVERED!';
      this.particleManager.spawnLifeRecoveredEffects(posX, posY, text);
    });

    // Audio feedback for fruit throws, bomb launches, and power-up launches
    this.fruitManager.onFruitLaunch = () => {
      this.audioManager.init();
      this.audioManager.playFruitThrow();
    };
    this.fruitManager.onBombLaunch = () => {
      this.audioManager.init();
      this.audioManager.playBombThrow();
    };
    this.fruitManager.onPowerUpLaunch = () => {
      this.audioManager.init();
      this.audioManager.playSoundBuffer('throwFruit', { volume: 0.75, playbackRate: 1.25 });
    };

    // Countdown audio warnings for timed modes (Zen / Arcade)
    this.timeUnsubscribe = this.gameState.subscribeTime((timeRemaining) => {
      if (!this.gameState.is(STATES.PLAYING)) return;
      const sec = Math.ceil(timeRemaining);
      if (sec <= 5 && sec > 0) {
        this.audioManager.playTimeWarning();
      } else if (sec === 0) {
        this.audioManager.playTimeUp();
      }
    });

    // Fever mode visual state & event subscription
    this.feverVignetteAlpha = 0;
    this.feverPulseTime = 0;
    this.feverUnsubscribe = this.gameState.subscribeFever((isFeverActive, details) => {
      if (isFeverActive) {
        if (!details?.isProgress) {
          this.audioManager.init();
          this.audioManager.playFeverActivate();
          this.audioManager.startFeverMusic();
          const cx = this.logicalWidth > 0 ? this.logicalWidth * 0.5 : 400;
          const cy = this.logicalHeight > 0 ? this.logicalHeight * 0.35 : 200;
          this.particleManager.spawnScorePopup(cx, cy, 'FEVER MODE! 2X MULTIPLIER', '#FBBF24', 3);
        }
      } else {
        if (!details?.isProgress && this.audioManager.isFeverPlaying) {
          this.audioManager.stopFeverMusic();
        }
      }
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

  resize() {
    if (!this.canvas) return;

    const container = this.canvas.parentElement;
    let width = container ? container.clientWidth : 0;
    let height = container ? container.clientHeight : 0;

    if (width <= 0 || height <= 0) {
      const rect = this.canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }

    if (width <= 0 || height <= 0) {
      width = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 800;
      height = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 600;
    }

    this.logicalWidth = width;
    this.logicalHeight = height;
    this.dpr = getDevicePixelRatio();

    // Scale canvas buffer for high-DPI crisp rendering
    this.canvas.width = Math.max(1, Math.round(width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(height * this.dpr));

    // Normalize context coordinate system to match CSS pixels
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Bake and resize dynamic 7-layer arcade environment
    this.environment.resize(width, height, this.dpr);
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
    this.isPaused = false;
    this.audioManager.stopBombFuse();
    this.audioManager.stopFeverMusic();
    this.fruitManager.setModeConfig(this.gameState.getModeConfig());
    this.fruitManager.reset();
    this.powerUpManager.reset();
    this.particleManager.reset();
    this.collisionManager.reset();
    this.bladeTrail.reset();
    this.bladeTrail.setBladeBoost(false);
    this.bladeTrail.setFever(false);
    this.feverVignetteAlpha = 0;
    this.feverPulseTime = 0;
    this.screenShake = 0;
    this.missVignetteAlpha = 0;
    this.isGameOverTransition = false;
    this.gameOverTimer = 0;
    this.gameState.resetSession();
    this.lastTime = performance.now();
  }

  tick(timestamp) {
    if (!this.isRunning) return;

    // Schedule next frame upfront so an unexpected exception never halts the animation loop
    this.animationFrameId = requestAnimationFrame(this.loop);

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    try {
      if (!this.isPaused) {
        this.update(dt);
      } else {
        // Calm ambient drift when paused
        this.environment.update(dt * 0.25, this.gameState);
      }
      this.render();
    } catch (err) {
      console.error('Error during game tick execution:', err);
    }
  }

  update(dt) {
    // Advance dynamic 7-layer arcade environment
    this.environment.update(dt, this.gameState);

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
      // Loop bomb fuse hissing when any bomb is in flight
      if (this.fruitManager.bombPool.getActiveCount() > 0) {
        this.audioManager.startBombFuse();
      } else {
        this.audioManager.stopBombFuse();
      }

      this.gameState.update(dt);
      this.powerUpManager.update(dt);

      const isBladeBoost = this.powerUpManager.isBladeBoostActive();
      const isFever = this.gameState.isFeverActive;
      this.bladeTrail.setBladeBoost(isBladeBoost);
      this.bladeTrail.setFever(isFever);

      // Smooth Fever mode visual intensity interpolation
      const targetFeverAlpha = isFever ? 1.0 : 0.0;
      this.feverVignetteAlpha = lerp(this.feverVignetteAlpha, targetFeverAlpha, Math.min(1.0, dt * 4.0));
      this.feverPulseTime += dt;

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
          (fruit, cutSegment, hitPoint, _totalHits, hitMetadata = {}) => {
            const hitX = hitPoint ? hitPoint.x : fruit.x;
            const hitY = hitPoint ? hitPoint.y : fruit.y;

            // Check if it's a special recovery fruit
            if (fruit.isRecoveryFruit) {
              if (this.gameState.lives !== null && this.gameState.lives < this.gameState.maxLives) {
                this.gameState.recoverLife(1, 'recovery_fruit', { x: hitX, y: hitY });
              } else {
                // Slicing at maximum health awards a +50 bonus
                this.gameState.addScore(50);
                this.particleManager.spawnScorePopup(hitX, hitY - 18, '+50 BONUS!', '#10B981');
              }
            }

            // 1. Scoring update with full arcade metadata (perfect slice & multi-slice chain)
            const result = this.gameState.registerSlice(fruit.type, {
              ...hitMetadata,
              isRecoveryFruit: Boolean(fruit.isRecoveryFruit),
            });

            // 2. Play layered authentic slice audio with fruit-specific timbre
            this.audioManager.playFruitSlice(fruit.type, result.combo);

            // Special Perfect Slice audio and visual feedback
            if (result.isPerfectSlice) {
              this.audioManager.playPerfectSlice();
              this.particleManager.spawnPerfectSliceEffects(hitX, hitY);
            }

            // Multi-slice audio and visual feedback (when 2+ fruits cut in continuous swipe)
            if (result.multiSliceCount >= 2) {
              this.audioManager.playMultiSlice(result.multiSliceCount);
              this.particleManager.spawnMultiSliceEffects(hitX, hitY, result.multiSliceCount);
            } else if (result.isCombo && !result.isPerfectSlice) {
              this.audioManager.playCombo(result.combo);
            }

            if (isBladeBoost) {
              this.audioManager.playCriticalSlice();
            }

            // 3. Directional juice particles, pulp, fragments, sparkles, and splash flash
            this.particleManager.spawnSliceEffects(
              fruit.x,
              fruit.y,
              cutSegment,
              fruit.type,
              fruit.radius,
              hitPoint,
              { vx: fruit.vx, vy: fruit.vy },
              result.combo,
              isBladeBoost,
              result.isFever
            );

            // 4. Floating canvas score popup centered on slice contact
            const multTag = result.isDoubleScore ? ' [2X]' : '';
            const feverTag = result.isFever ? ' [FEVER]' : '';
            const popupText = result.multiplier > 1
              ? `+${result.pointsEarned} (${result.multiplier}x)${multTag}${feverTag}`
              : `+${result.pointsEarned}${multTag}${feverTag}`;
            const popupColor = result.isFever
              ? '#FBBF24'
              : (result.isDoubleScore
                  ? '#FBBF24'
                  : (result.multiplier >= 3 ? '#FBBF24' : (result.multiplier === 2 ? '#38BDF8' : '#F8FAFC')));
            this.particleManager.spawnScorePopup(hitX, hitY - 14, popupText, popupColor, result.combo);

            // 5. Crisp physical screen micro-jolt with subtle combo scaling
            const comboShakeBonus = Math.min(2.2, ((result.combo || 1) - 1) * 0.45 + (result.isPerfectSlice ? 0.9 : 0) + (result.multiSliceCount >= 2 ? 1.0 : 0));
            this.screenShake = Math.min(this.screenShake + 3.0 + comboShakeBonus, 6.5);
          },
          (bomb, _cutSegment, hitPoint) => {
            // 1. Stop fuse and play visceral sub-bass explosion
            this.audioManager.init();
            this.audioManager.stopBombFuse();
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
          },
          (powerUp, _cutSegment, hitPoint) => {
            // Power-up sliced!
            this.audioManager.init();
            this.audioManager.playPowerUpPickup(powerUp.type);

            const hitX = hitPoint ? hitPoint.x : powerUp.x;
            const hitY = hitPoint ? hitPoint.y : powerUp.y;

            // 1. Spawn vibrant particle burst, shockwave, and floating banner
            this.particleManager.spawnPowerUpBurst(hitX, hitY, powerUp.type);

            // 2. Activate power-up
            this.powerUpManager.activate(powerUp.type);

            // Record power-up slice for progression missions
            if (this.gameState && typeof this.gameState.getProgressionManager === 'function') {
              this.gameState.getProgressionManager().recordSlice(powerUp.type, { isPowerUp: true });
            }

            // 3. If Life Restore: instant life recovery or bonus score
            if (powerUp.type === POWER_UP_TYPES.LIFE_RESTORE) {
              if (this.gameState.hasLives && this.gameState.hasLives() && this.gameState.lives < this.gameState.maxLives) {
                this.gameState.recoverLife(1, 'powerup_life', { x: hitX, y: hitY });
              } else {
                this.gameState.addScore(100);
                this.particleManager.spawnScorePopup(hitX, hitY - 22, '+100 BONUS!', '#10B981', 2);
              }
            }

            // 4. Crisp screen micro-jolt
            this.screenShake = Math.max(this.screenShake, 5.5);
          },
          isBladeBoost
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
      this.audioManager.stopBombFuse();
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

    // 2. Spawn red missed 'X' marker particle and floating penalty popup at the bottom where fruit dropped
    const markerX = Math.max(30, Math.min(this.logicalWidth - 30, fruit.x));
    const markerY = this.logicalHeight - 25;
    this.particleManager.spawnMissedMarker(markerX, markerY);
    this.particleManager.spawnScorePopup(markerX, markerY - 20, '-1 LIFE', '#EF4444');

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
    this.audioManager.stopBombFuse();
    this.isGameOverTransition = true;
    this.gameOverTimer = 0.75;
    this.audioManager.playGameOver();
  }

  render() {
    if (this.logicalWidth <= 0 || this.logicalHeight <= 0) {
      this.resize();
    }
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

    // 1. Render dynamic 7-layer modern arcade environment
    this.environment.render(this.ctx, w, h);

    // 2. Render game entities
    this.fruitManager.render(this.ctx);
    this.particleManager.render(this.ctx);

    // 3. Render active blade trail over game objects
    this.bladeTrail.render(this.ctx);

    // 4. Subtle active power-up screen edge vignettes
    this.renderPowerUpScreenEffects(w, h);

    // 5. Subtle Fever mode background aura and dojo lantern surge
    this.renderFeverScreenEffects(w, h);

    // 6. Render subtle crimson miss impact vignette along bottom
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

  /**
   * Subtle ambient screen edge vignettes representing active power-up enchantments.
   * Rendered via high-performance GPU canvas radial gradients.
   */
  renderPowerUpScreenEffects(w, h) {
    if (!this.powerUpManager) return;

    const now = performance.now();

    // 1. Slow Motion Frost Vignette
    if (this.powerUpManager.isSlowMotionActive().active) {
      const freezeGrad = this.ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.40,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.76
      );
      freezeGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      freezeGrad.addColorStop(0.80, 'rgba(0, 240, 255, 0.08)');
      freezeGrad.addColorStop(1, 'rgba(2, 132, 199, 0.28)');

      this.ctx.fillStyle = freezeGrad;
      this.ctx.fillRect(0, 0, w, h);
    }

    // 2. Frenzy Neon Pulse Border
    if (this.powerUpManager.isFrenzyActive()) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.009);
      const frenzyGrad = this.ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.42,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.76
      );
      frenzyGrad.addColorStop(0, 'rgba(236, 72, 153, 0)');
      frenzyGrad.addColorStop(0.82, `rgba(236, 72, 153, ${0.06 + pulse * 0.08})`);
      frenzyGrad.addColorStop(1, `rgba(168, 85, 247, ${0.20 + pulse * 0.12})`);

      this.ctx.fillStyle = frenzyGrad;
      this.ctx.fillRect(0, 0, w, h);
    }

    // 3. Double Score Golden Shimmer
    if (this.powerUpManager.isDoubleScoreActive()) {
      const shimmer = 0.5 + 0.5 * Math.sin(now * 0.006);
      const doubleGrad = this.ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.45,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.78
      );
      doubleGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
      doubleGrad.addColorStop(0.85, `rgba(245, 158, 11, ${0.08 + shimmer * 0.06})`);
      doubleGrad.addColorStop(1, `rgba(251, 191, 36, ${0.22 + shimmer * 0.08})`);

      this.ctx.fillStyle = doubleGrad;
      this.ctx.fillRect(0, 0, w, h);
    }

    // 4. Blade Boost Flaming Perimeter
    if (this.powerUpManager.isBladeBoostActive()) {
      const flame = 0.5 + 0.5 * Math.sin(now * 0.014);
      const bladeGrad = this.ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.42,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.76
      );
      bladeGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      bladeGrad.addColorStop(0.82, `rgba(249, 115, 22, ${0.08 + flame * 0.08})`);
      bladeGrad.addColorStop(1, `rgba(239, 68, 68, ${0.22 + flame * 0.12})`);

      this.ctx.fillStyle = bladeGrad;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  /**
   * Subtle modern arcade perimeter aura during Fever mode.
   * Smoothly fades in and out with high-performance radial gradients.
   */
  renderFeverScreenEffects(w, h) {
    if (this.feverVignetteAlpha <= 0.01) return;

    const pulse = 0.5 + 0.5 * Math.sin(this.feverPulseTime * 4.5);
    const alpha = this.feverVignetteAlpha * (0.12 + 0.06 * pulse);

    // Subtle electric arcade fever edge aura
    const feverGrad = this.ctx.createRadialGradient(
      w * 0.5,
      h * 0.5,
      Math.min(w, h) * 0.42,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.78
    );
    feverGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    feverGrad.addColorStop(0.72, `rgba(56, 189, 248, ${alpha * 0.35})`);
    feverGrad.addColorStop(1, `rgba(245, 158, 11, ${alpha * 0.65})`);

    this.ctx.fillStyle = feverGrad;
    this.ctx.fillRect(0, 0, w, h);
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
    if (this.powerUpManager) {
      this.powerUpManager.destroy();
    }
    if (this.environment) {
      this.environment.destroy();
      this.environment = null;
    }
    if (this.bgUnsubscribe) {
      this.bgUnsubscribe();
      this.bgUnsubscribe = null;
    }
    if (this.modeUnsubscribe) {
      this.modeUnsubscribe();
      this.modeUnsubscribe = null;
    }
    if (this.lifeRecoveredUnsubscribe) {
      this.lifeRecoveredUnsubscribe();
      this.lifeRecoveredUnsubscribe = null;
    }
    if (this.feverUnsubscribe) {
      this.feverUnsubscribe();
      this.feverUnsubscribe = null;
    }
    if (this.timeUnsubscribe) {
      this.timeUnsubscribe();
      this.timeUnsubscribe = null;
    }
    this.inputManager.destroy();
    this.bgCanvas = null;
    this.canvas = null;
    this.ctx = null;
  }
}
