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
    this.type = 'droplet'; // 'droplet', 'pulp', 'fragment', 'sparkle', 'combo_ring', 'splash_line', 'impact_spark', 'shockwave_ring', 'smoke_puff', 'fire_spark', 'text'
    this.length = 0;
    this.text = '';
    this.secondaryColor = '';
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
    text = '',
    secondaryColor = ''
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
    this.secondaryColor = secondaryColor;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;

    this.life += dt;
    if (this.life >= this.maxLife) {
      this.active = false;
      return;
    }

    // Natural fluid air drag and gravity for physical airborne particles
    if (
      this.type !== 'text' &&
      this.type !== 'splash_line' &&
      this.type !== 'impact_spark' &&
      this.type !== 'shockwave_ring' &&
      this.type !== 'combo_ring'
    ) {
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
      const rx = Math.max(0.1, this.size * 1.5);
      const ry = Math.max(0.1, this.size * 0.85);
      ctx.ellipse(this.x, this.y, rx, ry, angle, 0, Math.PI * 2);
      ctx.fill();

      // Specular micro-glint on droplet surface for 3D liquid refraction
      if (this.size > 2.0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha * 0.72})`;
        ctx.beginPath();
        const specR = Math.max(0.1, this.size * 0.32);
        ctx.arc(this.x - this.size * 0.35, this.y - this.size * 0.35, specR, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'fragment') {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      const s = this.size;

      // Outer rind body
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.5);
      ctx.lineTo(s * 0.8, -s * 0.3);
      ctx.lineTo(s * 0.4, s * 0.8);
      ctx.lineTo(-s * 0.6, s * 0.5);
      ctx.closePath();
      ctx.fill();

      // Inner pulp accent on cleaved fragment
      if (this.secondaryColor) {
        ctx.fillStyle = this.secondaryColor;
        ctx.beginPath();
        ctx.moveTo(-s * 0.35, -s * 0.2);
        ctx.lineTo(s * 0.5, -s * 0.1);
        ctx.lineTo(s * 0.2, s * 0.4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (this.type === 'sparkle') {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // Twinkling scale pulse
      const progress = this.life / this.maxLife;
      const pulse = Math.sin(progress * Math.PI);
      const s = Math.max(0, this.size * pulse);
      if (s <= 0.001) {
        ctx.restore();
        return;
      }

      ctx.fillStyle = this.color || '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.5);
      ctx.quadraticCurveTo(0, 0, s * 0.3, 0);
      ctx.quadraticCurveTo(0, 0, 0, s * 1.5);
      ctx.quadraticCurveTo(0, 0, -s * 0.3, 0);
      ctx.quadraticCurveTo(0, 0, 0, -s * 1.5);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-s * 1.5, 0);
      ctx.quadraticCurveTo(0, 0, 0, s * 0.3);
      ctx.quadraticCurveTo(0, 0, s * 1.5, 0);
      ctx.quadraticCurveTo(0, 0, 0, -s * 0.3);
      ctx.quadraticCurveTo(0, 0, -s * 1.5, 0);
      ctx.fill();

      // Central bright core bead
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.1, s * 0.35), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else if (this.type === 'combo_ring') {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      const progress = this.life / this.maxLife;
      const r = Math.max(0.1, this.size + (this.length - this.size) * Math.sqrt(progress));
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, 3.5 * this.alpha);
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (this.type === 'fire_spark') {
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.1, this.size), 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'shockwave_ring') {
      ctx.globalAlpha = this.alpha;
      const progress = this.life / this.maxLife;
      const curRadius = Math.max(0.1, this.size + (this.length - this.size) * progress);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, 4 * this.alpha);
      ctx.beginPath();
      ctx.arc(this.x, this.y, curRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'smoke_puff') {
      ctx.globalAlpha = this.alpha;
      const progress = this.life / this.maxLife;
      const curSize = Math.max(0.1, this.size * (1 + progress * 1.6));
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
    } else if (this.type === 'impact_spark') {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      const starSize = Math.max(0.1, this.size * this.alpha);

      // 1. High-energy radiant diamond flash
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, -starSize);
      ctx.quadraticCurveTo(0, 0, starSize * 0.35, 0);
      ctx.quadraticCurveTo(0, 0, 0, starSize);
      ctx.quadraticCurveTo(0, 0, -starSize * 0.35, 0);
      ctx.quadraticCurveTo(0, 0, 0, -starSize);
      ctx.fill();

      // 2. Pure white hot impact core
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.1, starSize * 0.32), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else if (this.type === 'text') {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);

      const isCombo = this.text.includes('x') || this.text.includes('COMBO');
      const fontSize = isCombo ? 26 : 21;
      ctx.font = `800 ${fontSize}px "Rajdhani", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      if (isCombo) {
        ctx.shadowColor = 'rgba(251, 191, 36, 0.55)';
        ctx.shadowBlur = 8;
      }

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.lineWidth = isCombo ? 5 : 4;
      ctx.strokeText(this.text, 0, 0);
      ctx.fillStyle = this.color;
      ctx.fillText(this.text, 0, 0);
      ctx.restore();
    }
  }
}
