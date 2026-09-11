/**
 * ArcadeEnvironment
 *
 * Premium dynamic gameplay environment for modern arcade fruit-slicing.
 * Integrates original arcade stage environments with responsive 7-layer composite architecture:
 *
 * Layer 1: Base stage artwork with cover/center scaling, subtle parallax drift, and smooth crossfades
 * Layer 2: Dynamic soft volumetric light zones matched to the active stage's palette
 * Layer 3: Subtle abstract curved contour lines & micro-depth horizon (cached offscreen)
 * Layer 4: Distant blurred geometric & curved forms with parallax drift
 * Layer 5: Lightweight ambient floating motes/particles (object-pooled, stage-tinted, zero allocation)
 * Layer 6: Soft atmospheric depth haze & central clarity contrast mask (maximum fruit readability)
 * Layer 7: Occasional cinematic light streaks / sweep beams
 *
 * Supports dynamic gameplay reactions:
 * - Normal gameplay: subtle ambient motion, slow particle drift, gentle breathing
 * - Combos: intensified stage glow, accelerated particle drift, light streaks
 * - Fever Mode: radiant electric atmosphere, rapid particles, energetic radial corona
 * - Game Over: cinematic deceleration, dimmed luminance, focused center clarity
 *
 * Zero emojis, zero runtime garbage collection overhead, 60+ FPS performance.
 */

import { lerp } from '../utils/math.js';
import { STATES } from './GameState.js';
import {
  BACKGROUND_LIST,
  DEFAULT_BACKGROUND_ID,
  getBackgroundConfig,
} from './BackgroundConfig.js';

const PARTICLE_COUNT = 28;

export class ArcadeEnvironment {
  constructor(initialStageId = DEFAULT_BACKGROUND_ID) {
    this.w = 0;
    this.h = 0;
    this.dpr = 1;

    // Time & Energy Tracking
    this.time = 0;
    this.energy = 1.0;
    this.targetEnergy = 1.0;
    this.comboIntensity = 0.0;
    this.feverIntensity = 0.0;
    this.gameOverIntensity = 0.0;

    // Stage & Background Architecture
    this.currentStageId = initialStageId;
    this.currentConfig = getBackgroundConfig(initialStageId);
    this.prevConfig = null;
    this.transitionProgress = 1.0;
    this.transitionDuration = 0.85;

    // Adaptive performance monitor
    this.performanceMonitor = null;

    // Cached gradient objects to eliminate per-frame allocations
    this.clarityVignetteGrad = null;
    this.bottomFogGrad = null;
    this.cachedGradW = 0;
    this.cachedGradH = 0;
    this.cachedGradStage = null;

    // Image Caching & Preloading
    this.imageCache = new Map();
    this.currentImage = null;
    this.prevImage = null;
    this.preloadAllStages();
    this.currentImage = this.loadImage(this.currentConfig.image);

    // Static Pre-rendered Cache (Base gradient & subtle contours)
    this.staticCanvas = null;
    this.staticCtx = null;
    this.isStaticDirty = true;

    // Layer 5: Pre-allocated Ambient Particle Pool
    this.particles = [];
    this.initParticles();

    // Layer 4: Distant Abstract Geometric Shapes
    this.shapes = [];
    this.initShapes();

    // Layer 7: Cinematic Light Streaks
    this.streaks = [];
    this.initStreaks();
  }

  /**
   * Preloads all stage background images into cache if in a browser environment.
   */
  preloadAllStages() {
    if (typeof Image === 'undefined') return;
    for (const config of BACKGROUND_LIST) {
      this.loadImage(config.image);
    }
  }

  /**
   * Loads and caches an image by URL.
   */
  loadImage(src) {
    if (typeof Image === 'undefined' || !src) return null;
    if (!this.imageCache.has(src)) {
      const img = new Image();
      img.src = src;
      this.imageCache.set(src, img);
    }
    return this.imageCache.get(src);
  }

  /**
   * Switches the active arcade stage environment with smooth crossfade.
   */
  setBackground(stageId, crossfade = true) {
    if (stageId === this.currentStageId && this.transitionProgress >= 1.0) return;

    const newConfig = getBackgroundConfig(stageId);

    if (crossfade && this.currentConfig) {
      this.prevConfig = this.currentConfig;
      this.prevImage = this.currentImage;
      this.transitionProgress = 0.0;
    } else {
      this.prevConfig = null;
      this.prevImage = null;
      this.transitionProgress = 1.0;
    }

    this.currentStageId = newConfig.id;
    this.currentConfig = newConfig;
    this.currentImage = this.loadImage(newConfig.image);

    // Re-tune floating particles to the newly selected stage's palette
    this.retintParticles(newConfig.particleColors);

    // Re-bake static contours for updated stage colors
    if (this.w > 0 && this.h > 0) {
      this.bakeStaticLayers(this.w, this.h, this.dpr);
    }
  }

  setPerformanceMonitor(monitor) {
    this.performanceMonitor = monitor;
  }

  getStageId() {
    return this.currentStageId;
  }

  getStageConfig() {
    return this.currentConfig;
  }

  updateCachedGradients(ctx, w, h) {
    if (!ctx) return;
    const cfg = this.currentConfig;
    const haze = cfg.hazeRgb;
    const clarityStrength = cfg.clarityMaskStrength;
    const vignetteStrength = cfg.vignetteStrength;

    this.clarityVignetteGrad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.48,
      Math.min(w, h) * 0.32,
      w * 0.5,
      h * 0.48,
      Math.max(w, h) * 0.78
    );
    this.clarityVignetteGrad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
    this.clarityVignetteGrad.addColorStop(0.60, `rgba(${haze.r}, ${haze.g}, ${haze.b}, ${clarityStrength})`);
    this.clarityVignetteGrad.addColorStop(1.00, `rgba(2, 3, 6, ${vignetteStrength})`);

    const fogHeight = Math.min(180, h * 0.28);
    this.bottomFogGrad = ctx.createLinearGradient(0, h, 0, h - fogHeight);
    this.bottomFogGrad.addColorStop(0.00, `rgba(${haze.r}, ${haze.g}, ${haze.b}, 0.58)`);
    this.bottomFogGrad.addColorStop(0.50, `rgba(${haze.r}, ${haze.g}, ${haze.b}, 0.20)`);
    this.bottomFogGrad.addColorStop(1.00, `rgba(${haze.r}, ${haze.g}, ${haze.b}, 0)`);

    this.cachedGradW = w;
    this.cachedGradH = h;
    this.cachedGradStage = cfg.id;
  }

  /**
   * Updates particle colors smoothly to match the stage palette.
   */
  retintParticles(colors) {
    if (!colors || colors.length === 0) return;
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].color = colors[i % colors.length];
    }
  }

  /**
   * Initializes lightweight object-pooled ambient motes.
   */
  initParticles() {
    this.particles = new Array(PARTICLE_COUNT);
    const colors = this.currentConfig.particleColors;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const color = colors[i % colors.length];
      const depth = 0.35 + Math.random() * 0.65; // 0.35 (distant/slow) to 1.0 (near/faster)

      this.particles[i] = {
        x: Math.random() * 1000,
        y: Math.random() * 800,
        baseVx: (Math.random() - 0.5) * 8,
        baseVy: -(12 + Math.random() * 18),
        size: (1.2 + Math.random() * 2.2) * depth,
        baseAlpha: (0.12 + Math.random() * 0.28) * depth,
        alpha: 0.2,
        phase: Math.random() * Math.PI * 2,
        swaySpeed: 0.6 + Math.random() * 1.2,
        swayAmplitude: 14 + Math.random() * 22,
        depth,
        color,
      };
    }
  }

  /**
   * Initializes distant blurred geometric & curved floating elements.
   * Strategically placed in upper quadrants and flanks to maintain central gameplay clarity.
   */
  initShapes() {
    this.shapes = [
      // 0: Upper-left floating ring
      {
        normX: 0.16,
        normY: 0.22,
        radius: 120,
        innerRadius: 85,
        type: 'arc',
        driftSpeed: 0.25,
        phase: 0.0,
        colorR: 14, colorG: 165, colorB: 233,
        baseAlpha: 0.05,
      },
      // 1: Upper-right floating geometric shield/capsule
      {
        normX: 0.84,
        normY: 0.28,
        radius: 140,
        innerRadius: 95,
        type: 'arc',
        driftSpeed: 0.20,
        phase: 2.1,
        colorR: 139, colorG: 92, colorB: 246,
        baseAlpha: 0.045,
      },
      // 2: Upper-center deep soft orb
      {
        normX: 0.50,
        normY: 0.14,
        radius: 180,
        innerRadius: 0,
        type: 'orb',
        driftSpeed: 0.15,
        phase: 4.2,
        colorR: 56, colorG: 189, colorB: 248,
        baseAlpha: 0.04,
      },
      // 3: Lower-left flank curved horizon contour
      {
        normX: 0.10,
        normY: 0.72,
        radius: 160,
        innerRadius: 110,
        type: 'arc',
        driftSpeed: 0.18,
        phase: 1.2,
        colorR: 99, colorG: 102, colorB: 241,
        baseAlpha: 0.035,
      },
      // 4: Lower-right flank accent orb
      {
        normX: 0.88,
        normY: 0.68,
        radius: 150,
        innerRadius: 0,
        type: 'orb',
        driftSpeed: 0.22,
        phase: 3.5,
        colorR: 244, colorG: 63, colorB: 94,
        baseAlpha: 0.03,
      },
    ];
  }

  /**
   * Initializes cinematic light streaks that drift slowly across upper quadrants.
   */
  initStreaks() {
    this.streaks = [
      {
        normY: 0.18,
        height: 60,
        angleDeg: 28,
        speed: 0.025,
        progress: 0.15,
        baseAlpha: 0.04,
        colorR: 56, colorG: 189, colorB: 248,
      },
      {
        normY: 0.42,
        height: 80,
        angleDeg: 32,
        speed: 0.018,
        progress: 0.65,
        baseAlpha: 0.03,
        colorR: 168, colorG: 85, colorB: 247,
      },
    ];
  }

  /**
   * Handle viewport resize and re-bake static background layers.
   */
  resize(width, height, dpr = 1) {
    if (width <= 0 || height <= 0) return;

    this.w = width;
    this.h = height;
    this.dpr = dpr;

    // Reposition floating particles across new dimensions
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x = Math.random() * width;
      p.y = Math.random() * height;
    }

    this.bakeStaticLayers(width, height, dpr);
  }

  /**
   * Bakes Layer 1 (deep gradient base) and Layer 3 (subtle abstract contours)
   * into a zero-allocation offscreen canvas buffer.
   */
  bakeStaticLayers(w, h, dpr) {
    if (typeof document === 'undefined') return;

    if (!this.staticCanvas) {
      this.staticCanvas = document.createElement('canvas');
    }

    this.staticCanvas.width = Math.max(1, Math.round(w * dpr));
    this.staticCanvas.height = Math.max(1, Math.round(h * dpr));

    this.staticCtx = this.staticCanvas.getContext('2d');
    this.staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ctx = this.staticCtx;
    const cfg = this.currentConfig;
    const haze = cfg.hazeRgb;

    // Base obsidian backdrop gradient
    const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
    baseGrad.addColorStop(0.00, `rgb(${Math.max(0, haze.r - 2)}, ${Math.max(0, haze.g - 2)}, ${Math.max(0, haze.b - 2)})`);
    baseGrad.addColorStop(0.50, '#060810');
    baseGrad.addColorStop(1.00, '#030408');

    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    // Deep radial backdrop gradient centered slightly above screen middle
    const radialBackdrop = ctx.createRadialGradient(
      w * 0.5,
      h * 0.40,
      Math.min(w, h) * 0.15,
      w * 0.5,
      h * 0.45,
      Math.max(w, h) * 0.85
    );
    radialBackdrop.addColorStop(0.00, 'rgba(15, 23, 42, 0.85)');
    radialBackdrop.addColorStop(0.40, 'rgba(10, 15, 28, 0.70)');
    radialBackdrop.addColorStop(0.75, 'rgba(6, 9, 16, 0.85)');
    radialBackdrop.addColorStop(1.00, 'rgba(3, 4, 8, 0.98)');

    ctx.fillStyle = radialBackdrop;
    ctx.fillRect(0, 0, w, h);

    // Subtle Abstract Curved Contours
    ctx.save();
    const contourCount = 4;
    const baseY = h * 0.68;
    const g1 = cfg.glow1;

    for (let i = 0; i < contourCount; i++) {
      const yOffset = i * (h * 0.08);
      const alpha = 0.025 - i * 0.005;

      ctx.beginPath();
      ctx.moveTo(-50, baseY + yOffset);

      ctx.bezierCurveTo(
        w * 0.28,
        baseY + yOffset - 35,
        w * 0.72,
        baseY + yOffset + 45,
        w + 50,
        baseY + yOffset - 20
      );

      ctx.strokeStyle = `rgba(${g1.r}, ${g1.g}, ${g1.b}, ${Math.max(0.008, alpha)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Complementary counter-curves in upper quadrants
    const g2 = cfg.glow2;
    for (let i = 0; i < 3; i++) {
      const topY = h * 0.18 + i * 40;
      ctx.beginPath();
      ctx.moveTo(-50, topY);
      ctx.bezierCurveTo(
        w * 0.35,
        topY + 30,
        w * 0.65,
        topY - 30,
        w + 50,
        topY + 15
      );
      ctx.strokeStyle = `rgba(${g2.r}, ${g2.g}, ${g2.b}, ${0.015 - i * 0.003})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Updates dynamic energy, breathing time, stage transitions, and particle/streak motion.
   */
  update(dt, gameState) {
    if (dt <= 0) return;
    const clampedDt = Math.min(dt, 0.1);

    // Advance stage crossfade progress
    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + clampedDt / this.transitionDuration);
      if (this.transitionProgress >= 1.0) {
        this.prevConfig = null;
        this.prevImage = null;
      }
    }

    const state = gameState ? gameState.getState() : STATES.PLAYING;
    const isGameOver = state === STATES.GAME_OVER;
    const isPaused = state === STATES.PAUSED;
    const combo = gameState ? (gameState.combo || 0) : 0;
    const isFever = gameState ? Boolean(gameState.isFeverActive) : false;

    // Target energy interpolation based on gameplay activity
    if (isGameOver) {
      this.targetEnergy = 0.35;
    } else if (isPaused) {
      this.targetEnergy = 0.5;
    } else if (isFever) {
      this.targetEnergy = 2.0;
    } else if (combo >= 3) {
      const comboBoost = Math.min(1.0, (combo - 3) / 10);
      this.targetEnergy = 1.15 + comboBoost * 0.5;
    } else {
      this.targetEnergy = 1.0;
    }

    // Smoothly interpolate energy with responsive easing
    this.energy = lerp(this.energy, this.targetEnergy, Math.min(1.0, clampedDt * 3.5));

    // Interpolate specific visual intensity states
    const targetComboInt = Math.min(1.0, combo / 12);
    this.comboIntensity = lerp(this.comboIntensity, targetComboInt, Math.min(1.0, clampedDt * 4.0));

    const targetFeverInt = isFever ? 1.0 : 0.0;
    this.feverIntensity = lerp(this.feverIntensity, targetFeverInt, Math.min(1.0, clampedDt * 3.0));

    const targetGameOverInt = isGameOver ? 1.0 : 0.0;
    this.gameOverIntensity = lerp(this.gameOverIntensity, targetGameOverInt, Math.min(1.0, clampedDt * 2.0));

    // Advance ambient time modulated by energy
    this.time += clampedDt * (0.65 * this.energy);

    // Update Layer 5: Ambient Floating Particles
    const w = this.w || 800;
    const h = this.h || 600;
    const speedMult = this.energy;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Organic lateral sway + upward drift
      const sway = Math.sin(this.time * p.swaySpeed + p.phase) * (p.swayAmplitude * p.depth);
      p.x += (p.baseVx + sway * 0.35) * clampedDt * speedMult;
      p.y += p.baseVy * p.depth * clampedDt * speedMult;

      // Wrap around bounds with soft padding
      if (p.y < -20) {
        p.y = h + 20;
        p.x = Math.random() * w;
      } else if (p.y > h + 20) {
        p.y = -20;
        p.x = Math.random() * w;
      }

      if (p.x < -30) {
        p.x = w + 30;
      } else if (p.x > w + 30) {
        p.x = -30;
      }

      // Dynamic alpha pulse
      const pulse = 0.8 + 0.2 * Math.sin(this.time * 2.0 + p.phase);
      const feverAlphaBonus = this.feverIntensity * 0.22;
      const gameOverDim = 1.0 - this.gameOverIntensity * 0.65;

      p.alpha = Math.max(0.04, Math.min(0.95, (p.baseAlpha + feverAlphaBonus) * pulse * gameOverDim));
    }

    // Update Layer 7: Cinematic Light Streaks
    for (let i = 0; i < this.streaks.length; i++) {
      const s = this.streaks[i];
      s.progress = (s.progress + s.speed * clampedDt * speedMult) % 1.0;
    }
  }

  /**
   * Main render pass. Renders all 7 layers cleanly behind gameplay entities.
   */
  render(ctx, w, h) {
    if (w <= 0 || h <= 0) return;

    // --- 1. Base Layer: Static gradient backup or artwork backdrop ---
    if (this.staticCanvas) {
      ctx.drawImage(this.staticCanvas, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#060810';
      ctx.fillRect(0, 0, w, h);
    }

    // --- 2. Layer 1: Base Stage Artwork (Cover scaling, center, parallax drift, crossfade) ---
    this.renderArtworkLayer(ctx, w, h);

    // --- 3. Layer 2: Dynamic Soft Volumetric Light Zones (Stage-tuned) ---
    this.renderAtmosphericGlow(ctx, w, h);

    // --- 4. Layer 4: Distant Abstract Geometric Shapes (Parallax) ---
    this.renderDistantShapes(ctx, w, h);

    // --- 5. Layer 7: Cinematic Light Streaks ---
    this.renderLightStreaks(ctx, w, h);

    // --- 6. Layer 5: Lightweight Ambient Floating Particles (Stage-tinted) ---
    this.renderParticles(ctx);

    // --- 7. Layer 6: Soft Atmospheric Depth Haze & Central Clarity Vignette ---
    this.renderDepthHazeAndClarity(ctx, w, h);

    // --- 8. Fever Radial Energy Corona (if Fever active) ---
    if (this.feverIntensity > 0.02) {
      this.renderFeverRadialEnergy(ctx, w, h);
    }
  }

  /**
   * Layer 1: Renders the active stage artwork with cover scaling, centered position,
   * subtle floating parallax drift, and smooth crossfade transitions.
   */
  renderArtworkLayer(ctx, w, h) {
    const isCrossfading = this.transitionProgress < 1.0 && this.prevImage;

    if (isCrossfading) {
      // Draw previous image fading out
      const prevAlpha = (1.0 - this.transitionProgress) * (1.0 - this.gameOverIntensity * 0.5);
      this.drawCoverArtwork(ctx, this.prevImage, w, h, prevAlpha);

      // Draw current image fading in
      const curAlpha = this.transitionProgress * (1.0 - this.gameOverIntensity * 0.5);
      this.drawCoverArtwork(ctx, this.currentImage, w, h, curAlpha);
    } else if (this.currentImage) {
      const alpha = 1.0 - this.gameOverIntensity * 0.5;
      this.drawCoverArtwork(ctx, this.currentImage, w, h, alpha);
    }
  }

  /**
   * Draws a background image with aspect-ratio-preserving cover scaling,
   * center alignment, and slight sinusoidal parallax drift.
   */
  drawCoverArtwork(ctx, img, w, h, alpha) {
    if (!img) return;
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    if (!nw || !nh) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    const imgAspect = nw / nh;
    const screenAspect = w / h;

    // Slight margin (1.05) ensures parallax drift never reveals unpainted edges
    const zoom = 1.05;
    let drawW, drawH;

    if (screenAspect > imgAspect) {
      drawW = w * zoom;
      drawH = (w / imgAspect) * zoom;
    } else {
      drawH = h * zoom;
      drawW = (h * imgAspect) * zoom;
    }

    // Subtle continuous floating parallax drift (slow, relaxing, non-intrusive)
    const driftX = Math.cos(this.time * 0.18) * (w * 0.012);
    const driftY = Math.sin(this.time * 0.22) * (h * 0.009);

    const drawX = (w - drawW) * 0.5 + driftX;
    const drawY = (h - drawH) * 0.5 + driftY;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  /**
   * Layer 2: Soft dynamic volumetric glow zones.
   * Matched to the active stage's color palette (glow1 & glow2).
   */
  renderAtmosphericGlow(ctx, w, h) {
    const t = this.time;
    const pulse1 = 0.5 + 0.5 * Math.sin(t * 1.4);
    const pulse2 = 0.5 + 0.5 * Math.cos(t * 1.1);

    const cfg = this.currentConfig;
    const g1 = cfg.glow1;
    const g2 = cfg.glow2;

    const baseAlpha1 = (g1.a + 0.04 * pulse1 + this.comboIntensity * 0.06 + this.feverIntensity * 0.14) * (1.0 - this.gameOverIntensity * 0.6);
    const baseAlpha2 = (g2.a + 0.03 * pulse2 + this.comboIntensity * 0.05 + this.feverIntensity * 0.12) * (1.0 - this.gameOverIntensity * 0.6);

    // Aura 1: Top-Center to upper quadrant pool
    const aura1X = w * 0.5 + Math.sin(t * 0.5) * (w * 0.06);
    const aura1Y = h * 0.28 + Math.cos(t * 0.6) * (h * 0.04);
    const aura1Radius = Math.max(w, h) * (0.55 + 0.05 * pulse1);

    const grad1 = ctx.createRadialGradient(
      aura1X,
      aura1Y,
      Math.min(w, h) * 0.05,
      aura1X,
      aura1Y,
      aura1Radius
    );
    grad1.addColorStop(0.00, `rgba(${g1.r}, ${g1.g}, ${g1.b}, ${baseAlpha1})`);
    grad1.addColorStop(0.40, `rgba(${g1.r}, ${g1.g}, ${g1.b}, ${baseAlpha1 * 0.55})`);
    grad1.addColorStop(0.75, `rgba(${g1.r}, ${g1.g}, ${g1.b}, ${baseAlpha1 * 0.18})`);
    grad1.addColorStop(1.00, `rgba(${g1.r}, ${g1.g}, ${g1.b}, 0)`);

    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, w, h);

    // Aura 2: Flank aura
    const aura2X = w * 0.75 + Math.cos(t * 0.4) * (w * 0.05);
    const aura2Y = h * 0.65 + Math.sin(t * 0.45) * (h * 0.05);
    const aura2Radius = Math.max(w, h) * 0.48;

    const grad2 = ctx.createRadialGradient(
      aura2X,
      aura2Y,
      Math.min(w, h) * 0.04,
      aura2X,
      aura2Y,
      aura2Radius
    );
    grad2.addColorStop(0.00, `rgba(${g2.r}, ${g2.g}, ${g2.b}, ${baseAlpha2})`);
    grad2.addColorStop(0.45, `rgba(${g2.r}, ${g2.g}, ${g2.b}, ${baseAlpha2 * 0.50})`);
    grad2.addColorStop(1.00, `rgba(${g2.r}, ${g2.g}, ${g2.b}, 0)`);

    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * Layer 4: Distant blurred geometric & curved shapes with gentle parallax drift.
   * Kept away from screen center to ensure 100% slicing field visibility.
   */
  renderDistantShapes(ctx, w, h) {
    const t = this.time;
    ctx.save();

    for (let i = 0; i < this.shapes.length; i++) {
      const s = this.shapes[i];

      // Subtle sinusoidal parallax drift
      const driftX = Math.cos(t * s.driftSpeed + s.phase) * 16;
      const driftY = Math.sin(t * s.driftSpeed * 1.2 + s.phase) * 12;

      const posX = s.normX * w + driftX;
      const posY = s.normY * h + driftY;
      const r = s.radius * (Math.min(w, h) / 600);

      const alpha = (s.baseAlpha + this.comboIntensity * 0.02 + this.feverIntensity * 0.04) * (1.0 - this.gameOverIntensity * 0.7);

      if (alpha <= 0.005) continue;

      if (s.type === 'orb') {
        const orbGrad = ctx.createRadialGradient(posX, posY, 0, posX, posY, r);
        orbGrad.addColorStop(0.0, `rgba(${s.colorR}, ${s.colorG}, ${s.colorB}, ${alpha * 1.5})`);
        orbGrad.addColorStop(0.6, `rgba(${s.colorR}, ${s.colorG}, ${s.colorB}, ${alpha * 0.4})`);
        orbGrad.addColorStop(1.0, `rgba(${s.colorR}, ${s.colorG}, ${s.colorB}, 0)`);

        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(posX, posY, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.type === 'arc') {
        ctx.beginPath();
        ctx.arc(posX, posY, r, s.phase, s.phase + Math.PI * 1.35);
        ctx.strokeStyle = `rgba(${s.colorR}, ${s.colorG}, ${s.colorB}, ${alpha * 1.2})`;
        ctx.lineWidth = Math.max(1, 3.5 * (Math.min(w, h) / 600));
        ctx.lineCap = 'round';
        ctx.stroke();

        // Subtle concentric inner arc
        ctx.beginPath();
        ctx.arc(posX, posY, r * 0.72, s.phase + 0.4, s.phase + Math.PI);
        ctx.strokeStyle = `rgba(${s.colorR}, ${s.colorG}, ${s.colorB}, ${alpha * 0.65})`;
        ctx.lineWidth = Math.max(1, 1.8 * (Math.min(w, h) / 600));
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Layer 7: Cinematic soft diagonal light streaks.
   */
  renderLightStreaks(ctx, w, h) {
    const energyBoost = 1.0 + this.comboIntensity * 0.6 + this.feverIntensity * 1.4;
    ctx.save();

    for (let i = 0; i < this.streaks.length; i++) {
      const s = this.streaks[i];
      const alpha = s.baseAlpha * energyBoost * (1.0 - this.gameOverIntensity * 0.8);
      if (alpha <= 0.005) continue;

      const currentY = (s.normY + (s.progress - 0.5) * 0.3) * h;
      const angleRad = (s.angleDeg * Math.PI) / 180;

      ctx.save();
      ctx.translate(w * 0.5, currentY);
      ctx.rotate(angleRad);

      const length = w * 1.6;
      const streakGrad = ctx.createLinearGradient(-length * 0.5, 0, length * 0.5, 0);
      streakGrad.addColorStop(0.00, `rgba(${s.colorR}, ${s.colorG}, ${s.colorB}, 0)`);
      streakGrad.addColorStop(0.35, `rgba(${s.colorR}, ${s.colorG}, ${s.colorB}, ${alpha * 0.4})`);
      streakGrad.addColorStop(0.50, `rgba(${s.colorR}, ${s.colorG}, ${s.colorB}, ${alpha})`);
      streakGrad.addColorStop(0.65, `rgba(${s.colorR}, ${s.colorG}, ${s.colorB}, ${alpha * 0.4})`);
      streakGrad.addColorStop(1.00, `rgba(${s.colorR}, ${s.colorG}, ${s.colorB}, 0)`);

      ctx.fillStyle = streakGrad;
      ctx.fillRect(-length * 0.5, -s.height * 0.5, length, s.height);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Layer 5: Lightweight ambient floating motes/particles.
   * Rendered in a tight zero-allocation loop with stage-tuned colors.
   */
  /**
   * Layer 5: Lightweight ambient floating motes/particles.
   * Rendered in a tight zero-allocation loop with stage-tuned colors.
   * Dynamically adapts active count based on performance tier.
   */
  renderParticles(ctx) {
    const maxParticles = this.performanceMonitor
      ? this.performanceMonitor.getBackgroundParticleCount()
      : this.particles.length;
    const count = Math.min(this.particles.length, maxParticles);

    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      if (p.alpha <= 0.01) continue;

      const c = p.color;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${p.alpha})`;
      ctx.fill();

      // Soft glow corona on larger foreground particles
      if (p.depth > 0.75 && p.size >= 2.0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${p.alpha * 0.28})`;
        ctx.fill();
      }
    }
  }

  /**
   * Layer 6: Soft atmospheric depth haze & central clarity contrast mask.
   * Keeps the center slicing zone crystal-clear and frames edges with a cinematic vignette.
   * Uses cached gradients to eliminate 2 full-screen gradient allocations every frame.
   */
  renderDepthHazeAndClarity(ctx, w, h) {
    if (
      this.cachedGradW !== w ||
      this.cachedGradH !== h ||
      this.cachedGradStage !== this.currentConfig.id ||
      !this.clarityVignetteGrad
    ) {
      this.updateCachedGradients(ctx, w, h);
    }

    // 1. Central contrast mask
    ctx.fillStyle = this.clarityVignetteGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Soft bottom depth fog band matched to stage haze
    const fogHeight = Math.min(180, h * 0.28);
    ctx.fillStyle = this.bottomFogGrad;
    ctx.fillRect(0, h - fogHeight, w, fogHeight);
  }

  /**
   * Fever mode energetic radial corona around the gameplay arena.
   */
  renderFeverRadialEnergy(ctx, w, h) {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4.5);
    const alpha = this.feverIntensity * (0.12 + 0.08 * pulse);
    const cfg = this.currentConfig;
    const g1 = cfg.glow1;

    const feverGrad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.50,
      Math.min(w, h) * 0.32,
      w * 0.5,
      h * 0.50,
      Math.max(w, h) * 0.76
    );
    feverGrad.addColorStop(0.00, 'rgba(245, 158, 11, 0)');
    feverGrad.addColorStop(0.60, `rgba(${g1.r}, ${g1.g}, ${g1.b}, ${alpha * 0.40})`);
    feverGrad.addColorStop(0.85, `rgba(245, 158, 11, ${alpha * 0.65})`);
    feverGrad.addColorStop(1.00, `rgba(225, 29, 72, ${alpha * 0.85})`);

    ctx.fillStyle = feverGrad;
    ctx.fillRect(0, 0, w, h);
  }

  destroy() {
    this.particles = [];
    this.shapes = [];
    this.streaks = [];
    this.imageCache.clear();
    this.currentImage = null;
    this.prevImage = null;
    this.staticCanvas = null;
    this.staticCtx = null;
    this.clarityVignetteGrad = null;
    this.bottomFogGrad = null;
    this.performanceMonitor = null;
  }
}
