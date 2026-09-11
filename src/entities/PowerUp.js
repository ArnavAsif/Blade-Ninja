/**
 * PowerUp Entity with parabolic arcade ballistics, natural rotation,
 * ambient energy halo, and orbiting magical motes.
 */

import {
  POWER_UP_TYPES,
  POWER_UP_CONFIGS,
  getPowerUpSprite,
} from '../assets/PowerUpSprites.js';

export { POWER_UP_TYPES, POWER_UP_CONFIGS };

export class PowerUp {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 980;
    this.weight = 0.84; // Slightly floaty for magnificent airtime
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.radius = 38;
    this.type = POWER_UP_TYPES.SLOW_MOTION;
    this.config = POWER_UP_CONFIGS[POWER_UP_TYPES.SLOW_MOTION];
    this.active = false;
    this.sliced = false;
    this.spawnTime = 0;
    this.flightTime = 0;
    this.hasReachedApex = false;

    // Orbiting particle motes
    this.moteAngle = 0;
  }

  reset(x, y, vx, vy, gravity, type, rotationSpeed, spawnTime = performance.now()) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.type = type;
    this.config = POWER_UP_CONFIGS[type] || POWER_UP_CONFIGS[POWER_UP_TYPES.SLOW_MOTION];
    this.radius = this.config.radius || 38;
    this.weight = 0.84;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = rotationSpeed;
    this.active = true;
    this.sliced = false;
    this.spawnTime = spawnTime;
    this.flightTime = 0;
    this.hasReachedApex = false;
    this.moteAngle = Math.random() * Math.PI * 2;
  }

  update(dt, screenWidth, screenHeight) {
    if (!this.active) return;

    this.flightTime += dt;

    // Apply gravity
    this.vy += this.gravity * this.weight * dt;

    // Position integration
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Rotation integration
    this.rotation += this.rotationSpeed * dt;
    this.moteAngle += dt * 4.2;

    // Apex tracking
    if (!this.hasReachedApex && this.vy >= 0) {
      this.hasReachedApex = true;
    }

    // Deactivate when fallen below viewport
    const bottomThreshold = screenHeight + this.radius * 2 + 60;
    if (this.hasReachedApex && this.y > bottomThreshold) {
      this.active = false;
      return;
    }

    // Horizontal bounds cleanup
    if (this.x < -150 || this.x > screenWidth + 150) {
      if (this.y > screenHeight * 0.5) {
        this.active = false;
      }
    }
  }

  render(ctx) {
    if (!this.active || this.sliced) return;

    const r = this.radius;
    const now = performance.now();
    const pulse = 0.85 + 0.15 * Math.sin(now * 0.008);

    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. Dynamic pulsating radiant energy aura in background
    const auraRadius = r * 1.55 * pulse;
    const auraGrad = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, auraRadius);
    auraGrad.addColorStop(0, this.config.glowColor);
    auraGrad.addColorStop(0.65, `${this.config.primaryColor}22`);
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Orbiting luminous motes
    const moteCount = 3;
    for (let i = 0; i < moteCount; i++) {
      const a = this.moteAngle + (i * Math.PI * 2) / moteCount;
      const mx = Math.cos(a) * (r * 1.25);
      const my = Math.sin(a) * (r * 0.95);
      const mSize = 2.4 + Math.sin(now * 0.01 + i) * 0.8;

      ctx.beginPath();
      ctx.arc(mx, my, mSize, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = this.config.primaryColor;
      ctx.shadowBlur = 6;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 3. Rotate and render pre-cached HD power-up sprite
    ctx.rotate(this.rotation);

    const sprite = getPowerUpSprite(this.type, 'whole');
    if (sprite) {
      const renderDiameter = r * 2.5;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
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
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = this.config.primaryColor;
      ctx.fill();
    }

    ctx.restore();
  }
}
