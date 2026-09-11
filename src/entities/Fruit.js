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
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.radius = 40;
    this.type = FRUIT_TYPES.WATERMELON;
    this.config = FRUIT_CONFIGS[FRUIT_TYPES.WATERMELON];
    this.active = false;
    this.sliced = false;
    this.spawnTime = 0;
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
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = rotationSpeed;
    this.active = true;
    this.sliced = false;
    this.spawnTime = spawnTime;
    this.hasReachedApex = false;
    this.missedHandled = false;
  }

  update(dt, screenWidth, screenHeight) {
    if (!this.active) return;

    // Apply gravity acceleration
    this.vy += this.gravity * dt;

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

    // 1. Two-tier ambient + contact depth shadow behind fruit
    ctx.save();
    ctx.translate(this.x + 8, this.y + 13);

    // Tier 1: Soft diffuse ambient elevation shadow
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 1.05, this.radius * 0.62, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fill();

    // Tier 2: Crisp grounding contact shadow
    ctx.beginPath();
    ctx.ellipse(-2, -2, this.radius * 0.75, this.radius * 0.44, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.fill();
    ctx.restore();

    // 2. Transformed fruit body
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const sprite = getFruitSprite(this.type, 'whole');
    if (sprite) {
      const renderDiameter = this.radius * 2.25;
      ctx.drawImage(
        sprite,
        -renderDiameter * 0.5,
        -renderDiameter * 0.5,
        renderDiameter,
        renderDiameter
      );

      // Primary specular curved glint along upper rim
      ctx.beginPath();
      ctx.arc(-this.radius * 0.15, -this.radius * 0.2, this.radius * 0.68, -Math.PI * 0.82, -Math.PI * 0.18);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = Math.max(2, this.radius * 0.08);
      ctx.lineCap = 'round';
      ctx.stroke();

      // Subtle secondary bounce light on opposite lower rim for volumetric depth
      ctx.beginPath();
      ctx.arc(this.radius * 0.12, this.radius * 0.16, this.radius * 0.70, Math.PI * 0.2, Math.PI * 0.62);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = Math.max(1.5, this.radius * 0.05);
      ctx.lineCap = 'round';
      ctx.stroke();
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
