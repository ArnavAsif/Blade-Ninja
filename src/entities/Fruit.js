/**
 * High-performance Fruit entity with realistic parabolic ballistics,
 * natural rotation, and GPU-accelerated HD offscreen sprite blitting.
 */

import {
  FRUIT_TYPES,
  FRUIT_CONFIGS,
  getFruitSprite,
} from '../assets/FruitSprites.js';

export { FRUIT_TYPES, FRUIT_CONFIGS };
export const FRUIT_PRESETS = FRUIT_CONFIGS;

export class Fruit {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 980;
    this.weight = 1.0;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.radius = 40;
    this.type = FRUIT_TYPES.WATERMELON;
    this.config = FRUIT_CONFIGS[FRUIT_TYPES.WATERMELON];
    this.active = false;
    this.sliced = false;
    this.spawnTime = 0;
    this.flightTime = 0;
    this.hasReachedApex = false;
    this.missedHandled = false;
  }

  /**
   * Resets and initializes the pooled fruit with launch trajectory parameters.
   */
  reset(x, y, vx, vy, gravity, type, rotationSpeed, spawnTime = performance.now()) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.type = type;
    this.config = FRUIT_CONFIGS[type] || FRUIT_CONFIGS[FRUIT_TYPES.WATERMELON];
    this.radius = this.config.radius;
    this.weight = this.config.weight || 1.0;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = rotationSpeed;
    this.active = true;
    this.sliced = false;
    this.spawnTime = spawnTime;
    this.flightTime = 0;
    this.hasReachedApex = false;
    this.missedHandled = false;
  }

  update(dt, screenWidth, screenHeight) {
    if (!this.active) return;

    this.flightTime += dt;

    // Apply gravity acceleration modulated by fruit-specific weight
    this.vy += this.gravity * this.weight * dt;

    // Integrate position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Integrate rotation
    this.rotation += this.rotationSpeed * dt;

    // Track vertical apex transition
    if (!this.hasReachedApex && this.vy >= 0) {
      this.hasReachedApex = true;
    }

    // Deactivate when fallen well below screen bottom
    const bottomThreshold = screenHeight + this.radius * 2 + 50;
    if (this.hasReachedApex && this.y > bottomThreshold) {
      this.active = false;
      return;
    }

    // Out of bounds horizontal safety cleanup
    if (this.x < -150 || this.x > screenWidth + 150) {
      if (this.y > screenHeight * 0.5) {
        this.active = false;
      }
    }
  }

  render(ctx) {
    if (!this.active) return;

    // 1. Launch squash & stretch deformation
    let scaleX = 1.0;
    let scaleY = 1.0;
    let stretchAngle = 0;

    if (this.flightTime < 0.30) {
      const t = this.flightTime / 0.30;
      // Damped spring impulse along trajectory velocity vector
      const stretchAmount = 0.14 * Math.sin((1 - t) * Math.PI) * Math.exp(-t * 3.6);
      if (stretchAmount > 0.005) {
        stretchAngle = Math.atan2(this.vy, this.vx);
        scaleX = 1.0 + stretchAmount;
        scaleY = 1.0 / Math.sqrt(scaleX); // Strictly preserve fruit volume
      }
    }

    // 2. Transformed fruit body
    ctx.save();
    ctx.translate(this.x, this.y);

    if (scaleX !== 1.0) {
      ctx.rotate(stretchAngle);
      ctx.scale(scaleX, scaleY);
      ctx.rotate(-stretchAngle);
    }

    ctx.rotate(this.rotation);

    const sprite = getFruitSprite(this.type, 'whole');
    if (sprite) {
      const renderDiameter = this.radius * 2.25;

      // Natural directional drop shadow following the exact silhouette of the fruit
      // without creating any artificial circular rings, halos, or outlines
      ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 6;

      ctx.drawImage(
        sprite,
        -renderDiameter * 0.5,
        -renderDiameter * 0.5,
        renderDiameter,
        renderDiameter
      );

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else {
      // Fallback
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.config.rindColor || '#15803D';
      ctx.fill();
    }

    ctx.restore();
  }
}
