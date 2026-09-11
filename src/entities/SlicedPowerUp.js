/**
 * SlicedPowerUp entity representing separating halves of a cleaved power-up orb.
 */

import { POWER_UP_CONFIGS, getPowerUpSprite } from '../assets/PowerUpSprites.js';

export class SlicedPowerUp {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 980;
    this.radius = 38;
    this.sliceAngle = 0;
    this.halfType = 'top'; // 'top' | 'bottom'
    this.type = 'slow_motion';
    this.angularVelocity = 0;
    this.rotation = 0;
    this.active = false;
    this.life = 0;
    this.maxLife = 1.2;
    this.alpha = 1.0;
  }

  reset(x, y, vx, vy, gravity, radius, sliceAngle, halfType, type, angularVelocity) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.radius = radius;
    this.sliceAngle = sliceAngle;
    this.halfType = halfType;
    this.type = type;
    this.angularVelocity = angularVelocity;
    this.rotation = sliceAngle;
    this.active = true;
    this.life = 0;
    this.maxLife = 1.0;
    this.alpha = 1.0;
  }

  update(dt, screenHeight) {
    if (!this.active) return;

    this.life += dt;
    if (this.life >= this.maxLife) {
      this.active = false;
      return;
    }

    // Alpha fadeout towards end of life
    if (this.life > 0.6) {
      this.alpha = Math.max(0, 1.0 - (this.life - 0.6) / 0.4);
    } else {
      this.alpha = 1.0;
    }

    // Apply gravity
    this.vy += this.gravity * dt;

    // Position integration
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Angular integration
    this.rotation += this.angularVelocity * dt;

    // Deactivate when below screen
    if (this.y > screenHeight + 100) {
      this.active = false;
    }
  }

  render(ctx) {
    if (!this.active) return;

    const r = this.radius;
    const config = POWER_UP_CONFIGS[this.type];
    const sprite = getPowerUpSprite(this.type, this.halfType);

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (sprite) {
      const renderDiameter = r * 2.5;

      ctx.shadowColor = config?.glowColor || 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 8;

      ctx.drawImage(
        sprite,
        -renderDiameter * 0.5,
        -renderDiameter * 0.5,
        renderDiameter,
        renderDiameter
      );
    }

    ctx.restore();
  }
}
