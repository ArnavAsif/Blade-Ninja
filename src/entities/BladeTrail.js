/**
 * Premium arcade-quality BladeTrail rendering engine.
 *
 * Implements:
 * - Centripetal Catmull-Rom spline interpolation for silky-smooth curves
 * - Continuous variable thickness with aerodynamic teardrop contour
 * - Razor-fine tapered needle tail (0-width falloff)
 * - Layered high-DPI rendering: soft cyan aura, luminous energy ribbon, pure white core
 * - Dynamic velocity-driven modulation (width, alpha, star glint, and spark emissions)
 * - Micro blade gleam spark particles with zero heap allocation pooling
 */

const MAX_SAMPLES = 96;

export class BladeTrail {
  constructor(inputManager) {
    this.inputManager = inputManager;
    this.lastTime = 0;

    // Pre-allocated typed arrays for zero-allocation spline evaluation
    this.samplesX = new Float32Array(MAX_SAMPLES);
    this.samplesY = new Float32Array(MAX_SAMPLES);
    this.samplesTime = new Float32Array(MAX_SAMPLES);
    this.samplesSpeed = new Float32Array(MAX_SAMPLES);
    this.samplesNx = new Float32Array(MAX_SAMPLES);
    this.samplesNy = new Float32Array(MAX_SAMPLES);
    this.samplesWidth = new Float32Array(MAX_SAMPLES);
    this.samplesAlpha = new Float32Array(MAX_SAMPLES);
    this.leftX = new Float32Array(MAX_SAMPLES);
    this.leftY = new Float32Array(MAX_SAMPLES);
    this.rightX = new Float32Array(MAX_SAMPLES);
    this.rightY = new Float32Array(MAX_SAMPLES);
    this.sampleCount = 0;

    // Micro spark particle pool for high-velocity slashes
    this.maxSparks = 40;
    this.sparks = Array.from({ length: this.maxSparks }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.12,
      size: 1.5,
      active: false,
      color: '#FFFFFF',
    }));

    // Power-up & Fever state
    this.isBladeBoostActive = false;
    this.isFeverActive = false;
    this.performanceMonitor = null;
  }

  setPerformanceMonitor(monitor) {
    this.performanceMonitor = monitor;
  }

  setBladeBoost(active) {
    this.isBladeBoostActive = Boolean(active);
  }

  setFever(active) {
    this.isFeverActive = Boolean(active);
  }

  update(now = performance.now()) {
    const dt = this.lastTime ? Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000)) : 0.016;
    this.lastTime = now;

    this.inputManager.update(now);

    // 1. Update micro gleam sparks
    for (let i = 0; i < this.maxSparks; i++) {
      const spark = this.sparks[i];
      if (!spark.active) continue;

      spark.life += dt;
      if (spark.life >= spark.maxLife) {
        spark.active = false;
        continue;
      }
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
    }

    // 2. Emit blade gleam sparks during swipes (increased intensity with Blade Boost or Fever)
    if (this.inputManager.isDown) {
      const speed = this.inputManager.getSwipeSpeed();
      const isEnhanced = this.isBladeBoostActive || this.isFeverActive;
      const threshold = isEnhanced ? 300 : 550;
      if (speed > threshold) {
        const pts = this.inputManager.getTrailPoints();
        if (pts.length >= 2) {
          const tip = pts[pts.length - 1];
          const prev = pts[pts.length - 2];
          const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
          const count = (this.isBladeBoostActive && this.isFeverActive) ? 4 : (isEnhanced ? 3 : 1);
          for (let c = 0; c < count; c++) {
            this.spawnSpark(tip.x, tip.y, angle);
          }
        }
      }
    }
  }

  spawnSpark(x, y, swipeAngle) {
    if (this.performanceMonitor && !this.performanceMonitor.canSpawnSparks()) {
      return;
    }

    for (let i = 0; i < this.maxSparks; i++) {
      const spark = this.sparks[i];
      if (spark.active) continue;

      const isEnhanced = this.isBladeBoostActive || this.isFeverActive;
      const angle = swipeAngle + Math.PI + (Math.random() - 0.5) * (isEnhanced ? 1.8 : 1.1);
      const sparkSpeed = (Math.random() * 95 + 40) * (isEnhanced ? 1.45 : 1.0);

      spark.x = x + (Math.random() - 0.5) * 6;
      spark.y = y + (Math.random() - 0.5) * 6;
      spark.vx = Math.cos(angle) * sparkSpeed;
      spark.vy = Math.sin(angle) * sparkSpeed;
      spark.life = 0;
      spark.maxLife = 0.08 + Math.random() * 0.08;
      spark.size = (1.4 + Math.random() * 1.8) * (isEnhanced ? 1.5 : 1.0);
      spark.color = this.isFeverActive
        ? (Math.random() < 0.6 ? '#FDE047' : '#EF4444')
        : (this.isBladeBoostActive
            ? (Math.random() < 0.5 ? '#FBBF24' : '#EF4444')
            : '#FFFFFF');
      spark.active = true;
      break;
    }
  }

  reset() {
    this.inputManager.reset();
    for (let i = 0; i < this.maxSparks; i++) {
      this.sparks[i].active = false;
    }
    this.sampleCount = 0;
  }

  render(ctx) {
    const points = this.inputManager.getTrailPoints();
    const count = points.length;
    if (count < 2) {
      this.renderSparks(ctx);
      return;
    }

    const now = performance.now();
    const duration = this.inputManager.trailDurationMs;
    const swipeSpeed = this.inputManager.getSwipeSpeed();
    const speedFactor = Math.min(1.0, Math.max(0.0, (swipeSpeed - 120) / 850));

    // 1. Evaluate Catmull-Rom spline interpolation
    this.sampleCatmullRom(points, count);
    if (this.sampleCount < 2) {
      this.renderSparks(ctx);
      return;
    }

    // 2. Compute smooth normal vectors and variable thickness boundaries
    this.computeGeometry(now, duration, speedFactor);

    ctx.save();

    // 3. Render Pass 1: Soft Luminous Cyan Aura
    this.renderAura(ctx, speedFactor);

    // 4. Render Pass 2: Continuous Energy Blade Ribbon (Polygon Fill)
    this.renderRibbon(ctx, speedFactor);

    // 5. Render Pass 3: Razor-Sharp Diamond White Core Spine
    this.renderCoreSpine(ctx, speedFactor);

    // 6. Render Pass 4: Micro Blade Gleam Sparks
    this.renderSparks(ctx);

    // 7. Render Pass 5: Leading Blade Cutting Tip Glint & Star Flare
    if (this.inputManager.isDown) {
      const tipIdx = this.sampleCount - 1;
      const prevIdx = Math.max(0, tipIdx - 1);
      const dx = this.samplesX[tipIdx] - this.samplesX[prevIdx];
      const dy = this.samplesY[tipIdx] - this.samplesY[prevIdx];
      const angle = Math.atan2(dy, dx);
      this.renderBladeTip(ctx, this.samplesX[tipIdx], this.samplesY[tipIdx], speedFactor, angle);
    }

    ctx.restore();
  }

  /**
   * Subdivides raw pointer events into a silky-smooth continuous Catmull-Rom curve.
   */
  sampleCatmullRom(points, count) {
    let outIdx = 0;

    for (let i = 0; i < count - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const p0 = i > 0 ? points[i - 1] : {
        x: 2 * p1.x - p2.x,
        y: 2 * p1.y - p2.y,
        time: 2 * p1.time - p2.time,
        speed: p1.speed || 0,
      };

      const p3 = i < count - 2 ? points[i + 2] : {
        x: 2 * p2.x - p1.x,
        y: 2 * p2.y - p1.y,
        time: 2 * p2.time - p1.time,
        speed: p2.speed || 0,
      };

      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      let steps = 1;
      if (dist > 50) steps = 4;
      else if (dist > 22) steps = 3;
      else if (dist > 8) steps = 2;

      for (let step = 0; step < steps; step++) {
        if (outIdx >= MAX_SAMPLES - 1) break;

        const t = step / steps;
        const t2 = t * t;
        const t3 = t2 * t;

        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );

        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        const time = p1.time + t * (p2.time - p1.time);
        const speed = (p1.speed || 0) + t * ((p2.speed || 0) - (p1.speed || 0));

        this.samplesX[outIdx] = x;
        this.samplesY[outIdx] = y;
        this.samplesTime[outIdx] = time;
        this.samplesSpeed[outIdx] = speed;
        outIdx++;
      }
    }

    // Anchor exact final tip point to newest input position
    if (outIdx < MAX_SAMPLES) {
      const tip = points[count - 1];
      this.samplesX[outIdx] = tip.x;
      this.samplesY[outIdx] = tip.y;
      this.samplesTime[outIdx] = tip.time;
      this.samplesSpeed[outIdx] = tip.speed || 0;
      outIdx++;
    }

    this.sampleCount = outIdx;
  }

  /**
   * Calculates continuous tangent normals and variable thickness bounds.
   */
  computeGeometry(now, duration, speedFactor) {
    const total = this.sampleCount;
    if (total < 2) return;

    // Peak ribbon half-width: sleek 2.4px on slow swipes up to 5.2px on fast swipes (expanded during Blade Boost)
    const widthMult = this.isBladeBoostActive ? 1.75 : 1.0;
    const maxHalfWidth = (2.4 + 2.8 * speedFactor) * widthMult;

    for (let k = 0; k < total; k++) {
      let dx;
      let dy;

      if (k === 0) {
        dx = this.samplesX[1] - this.samplesX[0];
        dy = this.samplesY[1] - this.samplesY[0];
      } else if (k === total - 1) {
        dx = this.samplesX[total - 1] - this.samplesX[total - 2];
        dy = this.samplesY[total - 1] - this.samplesY[total - 2];
      } else {
        dx = this.samplesX[k + 1] - this.samplesX[k - 1];
        dy = this.samplesY[k + 1] - this.samplesY[k - 1];
      }

      const len = Math.hypot(dx, dy);
      const nx = len > 0.0001 ? -dy / len : 0;
      const ny = len > 0.0001 ? dx / len : 1;

      this.samplesNx[k] = nx;
      this.samplesNy[k] = ny;

      // Normalized progress from tail (0.0) to tip (1.0)
      const s = k / (total - 1);
      const ageRatio = Math.max(0, 1.0 - (now - this.samplesTime[k]) / duration);

      // Taper profile: needle-fine at tail (0.0), swells smoothly to peak around s=0.86,
      // then tapers gracefully into a razor blade edge at the cutting tip
      let taper = 0;
      if (s <= 0.86) {
        taper = Math.sin((s / 0.86) * (Math.PI * 0.5));
        taper = Math.pow(taper, 1.35);
      } else {
        const tipProg = (s - 0.86) / 0.14;
        taper = 1.0 - 0.62 * (tipProg * tipProg);
      }

      const ageFalloff = Math.pow(ageRatio, 1.15);
      const combined = Math.max(0, Math.min(1.0, taper * ageFalloff));

      const halfWidth = maxHalfWidth * combined;
      this.samplesWidth[k] = halfWidth;
      this.samplesAlpha[k] = combined;

      this.leftX[k] = this.samplesX[k] + nx * halfWidth;
      this.leftY[k] = this.samplesY[k] + ny * halfWidth;
      this.rightX[k] = this.samplesX[k] - nx * halfWidth;
      this.rightY[k] = this.samplesY[k] - ny * halfWidth;
    }
  }

  /**
   * Layer 1: Soft Outer Cyan Aura (or Blazing Crimson with Blade Boost).
   */
  renderAura(ctx, speedFactor) {
    const total = this.sampleCount;
    if (total < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const isEnhanced = this.isBladeBoostActive || this.isFeverActive;
    const widthMult = this.isBladeBoostActive ? 1.75 : (this.isFeverActive ? 1.55 : 1.0);
    const auraWidth = (7.0 + 8.0 * speedFactor) * widthMult;
    const auraAlpha = Math.min(1.0, (0.18 + 0.22 * speedFactor) * (isEnhanced ? 1.45 : 1.0));

    if (this.isFeverActive) {
      ctx.shadowColor = 'rgba(251, 191, 36, 0.9)';
      ctx.shadowBlur = 14 * speedFactor;
      ctx.strokeStyle = `rgba(245, 158, 11, ${auraAlpha})`;
    } else if (this.isBladeBoostActive) {
      ctx.shadowColor = 'rgba(239, 68, 68, 0.85)';
      ctx.shadowBlur = 12 * speedFactor;
      ctx.strokeStyle = `rgba(249, 115, 22, ${auraAlpha})`;
    } else {
      if (speedFactor > 0.35) {
        ctx.shadowColor = 'rgba(56, 189, 248, 0.65)';
        ctx.shadowBlur = 8 * speedFactor;
      }
      ctx.strokeStyle = `rgba(14, 165, 233, ${auraAlpha})`;
    }

    ctx.lineWidth = auraWidth;

    ctx.beginPath();
    ctx.moveTo(this.samplesX[0], this.samplesY[0]);

    for (let k = 1; k < total - 1; k++) {
      const midX = (this.samplesX[k] + this.samplesX[k + 1]) * 0.5;
      const midY = (this.samplesY[k] + this.samplesY[k + 1]) * 0.5;
      ctx.quadraticCurveTo(this.samplesX[k], this.samplesY[k], midX, midY);
    }
    ctx.lineTo(this.samplesX[total - 1], this.samplesY[total - 1]);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Layer 2: Continuous Luminous Energy Blade Ribbon.
   */
  renderRibbon(ctx, speedFactor) {
    const total = this.sampleCount;
    if (total < 2) return;

    ctx.save();
    ctx.beginPath();

    // Start at needle tail point
    ctx.moveTo(this.samplesX[0], this.samplesY[0]);

    // Trace left outer boundary forward to blade tip
    for (let k = 1; k < total; k++) {
      const prevX = this.leftX[k - 1];
      const prevY = this.leftY[k - 1];
      const currX = this.leftX[k];
      const currY = this.leftY[k];
      const midX = (prevX + currX) * 0.5;
      const midY = (prevY + currY) * 0.5;
      ctx.quadraticCurveTo(prevX, prevY, midX, midY);
    }
    ctx.lineTo(this.leftX[total - 1], this.leftY[total - 1]);
    ctx.lineTo(this.samplesX[total - 1], this.samplesY[total - 1]);

    // Trace right outer boundary backward to needle tail
    ctx.lineTo(this.rightX[total - 1], this.rightY[total - 1]);
    for (let k = total - 2; k >= 0; k--) {
      const prevX = this.rightX[k + 1];
      const prevY = this.rightY[k + 1];
      const currX = this.rightX[k];
      const currY = this.rightY[k];
      const midX = (prevX + currX) * 0.5;
      const midY = (prevY + currY) * 0.5;
      ctx.quadraticCurveTo(prevX, prevY, midX, midY);
    }
    ctx.lineTo(this.samplesX[0], this.samplesY[0]);
    ctx.closePath();

    if (this.isFeverActive) {
      const fillAlpha = Math.min(1.0, 0.72 + 0.28 * speedFactor);
      ctx.fillStyle = `rgba(245, 158, 11, ${fillAlpha})`;
    } else if (this.isBladeBoostActive) {
      const fillAlpha = Math.min(1.0, 0.65 + 0.35 * speedFactor);
      ctx.fillStyle = `rgba(249, 115, 22, ${fillAlpha})`;
    } else {
      const fillAlpha = 0.55 + 0.38 * speedFactor;
      ctx.fillStyle = `rgba(56, 189, 248, ${fillAlpha})`;
    }
    ctx.fill();

    ctx.restore();
  }

  /**
   * Layer 3: Razor-Sharp Diamond White Cutting Spine.
   */
  renderCoreSpine(ctx, speedFactor) {
    const total = this.sampleCount;
    if (total < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const isEnhanced = this.isBladeBoostActive || this.isFeverActive;
    const coreWidth = (1.2 + 1.4 * speedFactor) * (isEnhanced ? 1.5 : 1.0);
    const coreAlpha = 0.88 + 0.12 * speedFactor;

    ctx.lineWidth = coreWidth;
    ctx.strokeStyle = this.isFeverActive
      ? `rgba(254, 249, 195, ${coreAlpha})`
      : (this.isBladeBoostActive
          ? `rgba(254, 240, 138, ${coreAlpha})`
          : `rgba(255, 255, 255, ${coreAlpha})`);

    ctx.beginPath();
    ctx.moveTo(this.samplesX[0], this.samplesY[0]);

    for (let k = 1; k < total - 1; k++) {
      const midX = (this.samplesX[k] + this.samplesX[k + 1]) * 0.5;
      const midY = (this.samplesY[k] + this.samplesY[k + 1]) * 0.5;
      ctx.quadraticCurveTo(this.samplesX[k], this.samplesY[k], midX, midY);
    }
    ctx.lineTo(this.samplesX[total - 1], this.samplesY[total - 1]);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Layer 4: Leading Blade Cutting Tip Glint & Star Flare.
   */
  renderBladeTip(ctx, x, y, speedFactor, angle) {
    ctx.save();
    ctx.translate(x, y);

    const isEnhanced = this.isBladeBoostActive || this.isFeverActive;
    const baseRadius = (3.5 + 2.5 * speedFactor) * (isEnhanced ? 1.25 : 1.0);

    // 1. Soft glowing outer flare
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 1.8, 0, Math.PI * 2);
    const tipColor = this.isFeverActive
      ? `rgba(251, 191, 36, ${0.45 + 0.35 * speedFactor})`
      : (this.isBladeBoostActive
          ? `rgba(249, 115, 22, ${0.40 + 0.35 * speedFactor})`
          : `rgba(56, 189, 248, ${0.35 + 0.35 * speedFactor})`);
    ctx.fillStyle = tipColor;
    ctx.fill();

    // 2. Razor white hot cutting core bead
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 3. Four-point diamond star flare aligned with cut direction
    if (speedFactor > 0.25) {
      ctx.rotate(angle);
      const glintLength = 6.0 + 8.5 * speedFactor;
      const glintWidth = 1.2 + 0.8 * speedFactor;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';

      // Longitudinal blade flare beam
      ctx.beginPath();
      ctx.moveTo(-glintLength, 0);
      ctx.quadraticCurveTo(0, 0, 0, glintWidth);
      ctx.quadraticCurveTo(0, 0, glintLength, 0);
      ctx.quadraticCurveTo(0, 0, 0, -glintWidth);
      ctx.closePath();
      ctx.fill();

      // Transverse blade flare beam
      const crossLength = glintLength * 0.55;
      ctx.beginPath();
      ctx.moveTo(0, -crossLength);
      ctx.quadraticCurveTo(0, 0, glintWidth * 0.8, 0);
      ctx.quadraticCurveTo(0, 0, 0, crossLength);
      ctx.quadraticCurveTo(0, 0, -glintWidth * 0.8, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Layer 5: Micro Blade Gleam Sparks.
   */
  renderSparks(ctx) {
    for (let i = 0; i < this.maxSparks; i++) {
      const spark = this.sparks[i];
      if (!spark.active) continue;

      const progress = spark.life / spark.maxLife;
      const alpha = Math.max(0, 1.0 - progress);

      ctx.fillStyle = spark.color || '#FFFFFF';
      ctx.globalAlpha = alpha * 0.88;
      ctx.beginPath();
      const sparkR = Math.max(0.1, spark.size * alpha);
      ctx.arc(spark.x, spark.y, sparkR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }
}
