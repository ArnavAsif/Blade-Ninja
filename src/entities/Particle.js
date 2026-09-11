/**
 * High-performance visual Particle entity for fruit juice droplets,
 * organic pulp flecks, explosion shockwaves, smoke puffs, fire embers,
 * and floating score popup labels.
 */

export class Particle {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 650;
    this.size = 3.5;
    this.color = '#F43F5E';
    this.alpha = 1.0;
    this.life = 0;
    this.maxLife = 0.45;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.type = 'droplet'; // 'droplet', 'pulp', 'splash_line', 'shockwave_ring', 'smoke_puff', 'fire_spark', 'text'
    this.length = 0;
    this.text = '';
    this.active = false;
  }

  reset(
    x,
    y,
    vx,
    vy,
    gravity,
    size,
    color,
    maxLife,
    type = 'droplet',
    rotation = 0,
    rotationSpeed = 0,
    length = 0,
    text = ''
  ) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.size = size;
    this.color = color;
    this.alpha = 1.0;
    this.life = 0;
    this.maxLife = maxLife;
    this.type = type;
    this.rotation = rotation;
    this.rotationSpeed = rotationSpeed;
    this.length = length;
    this.text = text;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;

    this.life += dt;
    if (this.life >= this.maxLife) {
      this.active = false;
      return;
    }

    // Natural fluid air drag and gravity
    if (this.type !== 'text') {
      this.vx *= 0.982;
      this.vy = (this.vy + this.gravity * dt) * 0.985;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotationSpeed * dt;

    // Smooth alpha falloff
    const t = this.life / this.maxLife;
    this.alpha = Math.max(0, 1 - t * t);
  }

  render(ctx) {
    if (!this.active || this.alpha <= 0.01) return;

    if (this.type === 'droplet') {
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      const angle = Math.atan2(this.vy, this.vx);
      ctx.ellipse(this.x, this.y, this.size * 1.5, this.size * 0.85, angle, 0, Math.PI * 2);
      ctx.fill();

      // Specular micro-glint on droplet surface for 3D liquid refraction
      if (this.size > 2.0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha * 0.72})`;
        ctx.beginPath();
        ctx.arc(this.x - this.size * 0.35, this.y - this.size * 0.35, this.size * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'fire_spark') {
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'shockwave_ring') {
      ctx.globalAlpha = this.alpha;
      const progress = this.life / this.maxLife;
      const curRadius = this.size + (this.length - this.size) * progress;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, 4 * this.alpha);
      ctx.beginPath();
      ctx.arc(this.x, this.y, curRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'smoke_puff') {
      ctx.globalAlpha = this.alpha;
      const progress = this.life / this.maxLife;
      const curSize = this.size * (1 + progress * 1.6);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, curSize, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'pulp') {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.rect(-this.size * 0.5, -this.size * 0.6, this.size, this.size * 1.2);
      ctx.fill();
      ctx.restore();
    } else if (this.type === 'splash_line') {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.lineCap = 'round';

      // 1. Radiant outer juice flash
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1.5, this.size * this.alpha);
      ctx.beginPath();
      ctx.moveTo(-this.length * 0.5, 0);
      ctx.lineTo(this.length * 0.5, 0);
      ctx.stroke();

      // 2. High-energy pure white hot cut center
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(0.8, this.size * 0.38 * this.alpha);
      ctx.beginPath();
      ctx.moveTo(-this.length * 0.42, 0);
      ctx.lineTo(this.length * 0.42, 0);
      ctx.stroke();

      ctx.restore();
    } else if (this.type === 'text') {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.font = '800 22px "Rajdhani", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(this.text, 0, 0);
      ctx.fillStyle = this.color;
      ctx.fillText(this.text, 0, 0);
      ctx.restore();
    }
  }
}
