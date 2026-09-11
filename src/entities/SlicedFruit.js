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

const SPRITE_RADII = Object.freeze({
  [FRUIT_TYPES.WATERMELON]: 54,
  [FRUIT_TYPES.APPLE]: 48,
  [FRUIT_TYPES.ORANGE]: 48,
  [FRUIT_TYPES.BANANA]: 48,
  [FRUIT_TYPES.PINEAPPLE]: 52,
  [FRUIT_TYPES.STRAWBERRY]: 44,
  [FRUIT_TYPES.DRAGON_FRUIT]: 50,
  [FRUIT_TYPES.COCONUT]: 48,
  [FRUIT_TYPES.KIWI]: 44,
  [FRUIT_TYPES.PEACH]: 46,
});

export class SlicedFruit {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 1050;
    this.weight = 1.0;
    this.radius = 40;
    this.angle = 0;
    this.angularVelocity = 0;
    this.sliceAngle = 0;
    this.side = 'top'; // 'top' (left) or 'bottom' (right)
    this.type = FRUIT_TYPES.WATERMELON;
    this.config = FRUIT_CONFIGS[FRUIT_TYPES.WATERMELON];
    this.age = 0;
    this.scale = 1.14;
    this.alpha = 1.0;
    this.active = false;
  }

  reset(x, y, vx, vy, gravity, radius, sliceAngle, side, type, angularVelocity = null) {
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
    this.weight = this.config.weight || 1.0;
    this.age = 0;
    this.scale = 1.14;
    this.alpha = 1.0;

    // Angular momentum spinning away from the cut line based on fruit slice characteristics
    if (typeof angularVelocity === 'number') {
      this.angularVelocity = angularVelocity;
    } else {
      const baseKick = this.config.sliceBehavior?.angularKick ?? 4.5;
      const spinMagnitude = baseKick + (Math.random() - 0.5) * 1.5;
      this.angularVelocity = side === 'top' ? -spinMagnitude : spinMagnitude;
    }

    this.active = true;
  }

  update(dt, screenHeight) {
    if (!this.active) return;

    this.age += dt;
    this.vy += this.gravity * this.weight * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.angularVelocity * dt;

    // Organic cleave pop: expands slightly on initial cleave and settles smoothly
    this.scale = 1.0 + 0.14 * Math.exp(-this.age * 9.5);

    // Natural smooth alpha fade as pieces fall toward bottom
    const h = Math.max(100, screenHeight || 800);
    const fadeStartY = h * 0.72;
    if (this.y > fadeStartY) {
      const fadeDistance = Math.max(10, h * 0.32);
      this.alpha = Math.max(0, 1 - (this.y - fadeStartY) / fadeDistance);
      if (this.alpha <= 0.01 || this.y > h + this.radius * 2 + 50) {
        this.active = false;
      }
    } else {
      this.alpha = 1.0;
    }
  }

  render(ctx) {
    if (!this.active || this.alpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.scale(this.scale, this.scale);

    const state = this.side === 'top' ? 'left' : 'right';
    const sprite = getFruitSprite(this.type, state);

    const baseR = SPRITE_RADII[this.type] || 48;
    const renderDiameter = this.radius * 2.25;
    const visualRadius = baseR * (renderDiameter / 160);

    if (sprite) {
      // Natural directional drop shadow following the exact half-fruit silhouette
      ctx.shadowColor = 'rgba(0, 0, 0, 0.26)';
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

      // Cut-edge highlight masked to the exact sliced fruit geometry
      ctx.save();
      ctx.beginPath();
      const start = this.side === 'top' ? Math.PI : 0;
      const end = this.side === 'top' ? Math.PI * 2 : Math.PI;
      ctx.arc(0, 0, visualRadius, start, end);
      ctx.closePath();
      ctx.clip();

      // 1. Fresh glistening cut-edge moisture sheen along the cleaved flat surface
      ctx.beginPath();
      ctx.moveTo(-visualRadius, 0);
      ctx.lineTo(visualRadius, 0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = Math.max(1.8, visualRadius * 0.055);
      ctx.lineCap = 'butt';
      ctx.stroke();

      // 2. Inner glistening moisture sheen band slightly inset from cut boundary
      const sheenOffset = this.side === 'top' ? -1.0 : 1.0;
      ctx.beginPath();
      ctx.moveTo(-visualRadius * 0.85, sheenOffset);
      ctx.lineTo(visualRadius * 0.85, sheenOffset);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = Math.max(1.0, visualRadius * 0.035);
      ctx.lineCap = 'round';
      ctx.stroke();

      // 3. Glistening micro moisture beads along the flat cut line
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(-visualRadius * 0.42, 0, 1.6, 0, Math.PI * 2);
      ctx.arc(visualRadius * 0.12, 0, 1.3, 0, Math.PI * 2);
      ctx.arc(visualRadius * 0.52, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 4. Crisp bevel highlight glints at outer entrance/exit corners
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.beginPath();
      ctx.arc(-visualRadius * 0.86, 0, 1.8, 0, Math.PI * 2);
      ctx.arc(visualRadius * 0.86, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore(); // Restores clip
    } else {
      // Fallback
      ctx.beginPath();
      const start = this.side === 'top' ? Math.PI : 0;
      const end = this.side === 'top' ? Math.PI * 2 : Math.PI;
      ctx.arc(0, 0, this.radius, start, end);
      ctx.closePath();
      ctx.fillStyle = this.config.pulpColor || '#F43F5E';
      ctx.fill();

      // Masked cut-edge highlight on fallback
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, start, end);
      ctx.closePath();
      ctx.clip();

      ctx.beginPath();
      ctx.moveTo(-this.radius, 0);
      ctx.lineTo(this.radius, 0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = Math.max(1.8, this.radius * 0.06);
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}
