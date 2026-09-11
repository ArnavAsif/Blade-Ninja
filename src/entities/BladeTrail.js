/**
 * High-performance BladeTrail rendering engine.
 * Features midpoint quadratic Bézier curve interpolation, natural age-based
 * opacity falloff, continuous multi-pass width tapering, and blade tip gleam.
 */

export class BladeTrail {
  constructor(inputManager) {
    this.inputManager = inputManager;

    // Palette: Crisp diamond white core with electric cyan aura
    this.coreColor = 'rgba(255, 255, 255, ';
    this.midGlowColor = 'rgba(56, 189, 248, ';
    this.outerAuraColor = 'rgba(14, 165, 233, ';

    this.maxCoreWidth = 3.6;
    this.maxMidWidth = 8.5;
    this.maxAuraWidth = 16.0;
  }

  update(now = performance.now()) {
    this.inputManager.update(now);
  }

  reset() {
    this.inputManager.reset();
  }

  render(ctx) {
    const points = this.inputManager.getTrailPoints();
    const count = points.length;
    if (count < 2) return;

    const now = performance.now();
    const duration = this.inputManager.trailDurationMs;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Pass: Outer soft cyan aura
    this.renderStrokePass(ctx, points, count, now, duration, (alpha, progress) => ({
      width: Math.max(1, this.maxAuraWidth * progress * alpha),
      style: `${this.outerAuraColor}${alpha * 0.28})`,
    }));

    // 2. Pass: Vibrant electric cyan mid body
    this.renderStrokePass(ctx, points, count, now, duration, (alpha, progress) => ({
      width: Math.max(1, this.maxMidWidth * progress * alpha),
      style: `${this.midGlowColor}${alpha * 0.65})`,
    }));

    // 3. Pass: Razor-sharp pure white cutting blade core
    this.renderStrokePass(ctx, points, count, now, duration, (alpha, progress) => ({
      width: Math.max(0.8, this.maxCoreWidth * progress * Math.min(1, alpha * 1.2)),
      style: `${this.coreColor}${alpha * 0.95})`,
    }));

    // 4. Leading blade tip accent
    if (this.inputManager.isDown && count >= 2) {
      this.renderBladeTip(ctx, points[count - 1]);
    }

    ctx.restore();
  }

  /**
   * Smooth curve stroke pass with dynamic width and opacity tapering.
   */
  renderStrokePass(ctx, points, count, now, duration, styleResolver) {
    if (count === 2) {
      const p0 = points[0];
      const p1 = points[1];
      const age1 = Math.max(0, 1 - (now - p1.time) / duration);
      if (age1 <= 0) return;

      const { width, style } = styleResolver(age1, 1.0);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineWidth = width;
      ctx.strokeStyle = style;
      ctx.stroke();
      return;
    }

    // Connect segments using midpoint quadratic Bézier curve interpolation
    for (let i = 1; i < count; i++) {
      const pPrev = points[i - 1];
      const pCurr = points[i];

      // Normalized progress along the blade trail (0.0 at tail, 1.0 at tip)
      const progress = i / (count - 1);
      const ageRatio = Math.max(0, 1 - (now - pCurr.time) / duration);
      if (ageRatio <= 0) continue;

      // Cubic taper profile for elegant organic teardrop tapering
      const taper = Math.pow(progress, 0.75);
      const alpha = ageRatio * taper;
      if (alpha <= 0.01) continue;

      const { width, style } = styleResolver(alpha, taper);

      ctx.beginPath();
      if (i === 1) {
        ctx.moveTo(pPrev.x, pPrev.y);
        const midX = (pPrev.x + pCurr.x) * 0.5;
        const midY = (pPrev.y + pCurr.y) * 0.5;
        ctx.lineTo(midX, midY);
      } else {
        const pPrevPrev = points[i - 2];
        const midPrevX = (pPrevPrev.x + pPrev.x) * 0.5;
        const midPrevY = (pPrevPrev.y + pPrev.y) * 0.5;
        const midCurrX = (pPrev.x + pCurr.x) * 0.5;
        const midCurrY = (pPrev.y + pCurr.y) * 0.5;

        ctx.moveTo(midPrevX, midPrevY);
        ctx.quadraticCurveTo(pPrev.x, pPrev.y, midCurrX, midCurrY);
      }

      ctx.lineWidth = width;
      ctx.strokeStyle = style;
      ctx.stroke();
    }

    // Connect final segment cleanly to the exact tip point
    const last = points[count - 1];
    const secondLast = points[count - 2];
    const midLastX = (secondLast.x + last.x) * 0.5;
    const midLastY = (secondLast.y + last.y) * 0.5;
    const tipAge = Math.max(0, 1 - (now - last.time) / duration);

    if (tipAge > 0.05) {
      const { width, style } = styleResolver(tipAge, 1.0);
      ctx.beginPath();
      ctx.moveTo(midLastX, midLastY);
      ctx.lineTo(last.x, last.y);
      ctx.lineWidth = width;
      ctx.strokeStyle = style;
      ctx.stroke();
    }
  }

  /**
   * Renders a luminous blade cutting tip under the pointer cursor.
   */
  renderBladeTip(ctx, tip) {
    const speed = this.inputManager.getSwipeSpeed();
    const speedFactor = Math.min(1.5, Math.max(0.6, speed / 400));

    // Outer cyan flare
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 6.5 * speedFactor, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.fill();

    // Sharp white core tip
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 2.8 * speedFactor, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    // Diamond 4-point star flare glint on high-velocity cuts
    if (speed > 450) {
      const glintSize = 7.0 * speedFactor;
      ctx.beginPath();
      ctx.moveTo(tip.x - glintSize, tip.y);
      ctx.lineTo(tip.x + glintSize, tip.y);
      ctx.moveTo(tip.x, tip.y - glintSize);
      ctx.lineTo(tip.x, tip.y + glintSize);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
}
