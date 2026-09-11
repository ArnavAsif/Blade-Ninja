/**
 * SlicedFruit entity representing physical cleaved fruit halves.
 * Renders HD pre-rendered cross-section artwork (rind, pulp, seeds, core)
 * with independent physical impulses and spin.
 */

import {
  FRUIT_TYPES,
  FRUIT_CONFIGS,
  getFruitSprite,
} from '../assets/FruitSprites.js';

export { FRUIT_TYPES, FRUIT_CONFIGS };

export class SlicedFruit {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 1050;
    this.radius = 40;
    this.angle = 0;
    this.angularVelocity = 0;
    this.sliceAngle = 0;
    this.side = 'top'; // 'top' (left) or 'bottom' (right)
    this.type = FRUIT_TYPES.WATERMELON;
    this.config = FRUIT_CONFIGS[FRUIT_TYPES.WATERMELON];
    this.active = false;
  }

  reset(x, y, vx, vy, gravity, radius, sliceAngle, side, type) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.radius = radius;
    this.sliceAngle = sliceAngle;
    this.angle = sliceAngle;
    this.side = side;
    this.type = type;
    this.config = FRUIT_CONFIGS[type] || FRUIT_CONFIGS[FRUIT_TYPES.WATERMELON];

    // Angular momentum spinning away from the cut line
    const spinMagnitude = 4.2 + Math.random() * 3.6;
    this.angularVelocity = side === 'top' ? -spinMagnitude : spinMagnitude;

    this.active = true;
  }

  update(dt, screenHeight) {
    if (!this.active) return;

    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.angularVelocity * dt;

    // Deactivate when fallen below viewport
    if (this.y > screenHeight + this.radius * 2 + 60) {
      this.active = false;
    }
  }

  render(ctx) {
    if (!this.active) return;

    // 1. Two-tier directional depth shadow behind half piece
    ctx.save();
    ctx.translate(this.x + 7, this.y + 11);

    // Soft ambient shadow
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 0.95, this.radius * 0.55, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.fill();

    // Core contact shadow
    ctx.beginPath();
    ctx.ellipse(-2, -2, this.radius * 0.68, this.radius * 0.38, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const state = this.side === 'top' ? 'left' : 'right';
    const sprite = getFruitSprite(this.type, state);

    if (sprite) {
      const renderDiameter = this.radius * 2.25;
      ctx.drawImage(
        sprite,
        -renderDiameter * 0.5,
        -renderDiameter * 0.5,
        renderDiameter,
        renderDiameter
      );

      // Fresh glistening cut-edge moisture sheen along the cleaved flat surface
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.85, 0);
      ctx.lineTo(this.radius * 0.85, 0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.lineWidth = Math.max(1.5, this.radius * 0.05);
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      // Fallback
      ctx.beginPath();
      const start = this.side === 'top' ? Math.PI : 0;
      const end = this.side === 'top' ? Math.PI * 2 : Math.PI;
      ctx.arc(0, 0, this.radius, start, end);
      ctx.closePath();
      ctx.fillStyle = this.config.pulpColor || '#F43F5E';
      ctx.fill();
    }

    ctx.restore();
  }
}
