/**
 * High-performance ParticleManager with object pooling for directional juice sprays,
 * pulp droplets, and slice splash flashes.
 */

import { Particle } from '../entities/Particle.js';
import { ObjectPool } from '../utils/pool.js';
import { randomRange } from '../utils/math.js';
import { FRUIT_CONFIGS, FRUIT_TYPES } from '../assets/FruitSprites.js';

export class ParticleManager {
  constructor() {
    this.pool = new ObjectPool(
      () => new Particle(),
      (particle, ...args) => particle.reset(...args),
      180
    );
  }

  /**
   * Spawns physical directional juice spray, pulp particles, and splash flash
   * when a fruit is cleaved by the blade.
   */
  spawnSliceEffects(x, y, cutSegment, fruitType, radius = 40) {
    const config = FRUIT_CONFIGS[fruitType] || FRUIT_CONFIGS[FRUIT_TYPES.WATERMELON];
    const { juiceColor, pulpColor, particleProfile } = config;
    const profile = particleProfile || { droplets: 8, pulpCount: 5, splashScale: 1.0 };

    const { p1, p2 } = cutSegment;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const cutAngle = Math.atan2(dy, dx);

    // Normal unit vectors
    const nx = len > 0 ? -dy / len : 0;
    const ny = len > 0 ? dx / len : 1;
    // Tangent unit vectors
    const tx = len > 0 ? dx / len : 1;
    const ty = len > 0 ? dy / len : 0;

    // 1. Slice Splash Flash (short-lived radiant line along cut, scaled by profile)
    const splashLength = radius * 2.2 * (profile.splashScale || 1.0);
    this.pool.obtain(
      x,
      y,
      0,
      0,
      0,
      5.0,
      juiceColor,
      0.12,
      'splash_line',
      cutAngle,
      0,
      splashLength
    );

    // 2. Directional Juice Droplets tailored to fruit variety
    const dropletCount = profile.droplets || 8;
    for (let i = 0; i < dropletCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const normalSpeed = side * randomRange(120, 320);
      const tangentSpeed = randomRange(-80, 180);

      const vx = nx * normalSpeed + tx * tangentSpeed;
      const vy = ny * normalSpeed + ty * tangentSpeed - randomRange(30, 90);

      const size = randomRange(2.2, 4.2);
      const life = randomRange(0.28, 0.48);
      const color = Math.random() < 0.7 ? juiceColor : pulpColor;

      this.pool.obtain(
        x + (Math.random() - 0.5) * 12,
        y + (Math.random() - 0.5) * 12,
        vx,
        vy,
        650,
        size,
        color,
        life,
        'droplet'
      );
    }

    // 3. Fleshy Pulp Particles tailored to fruit variety
    const pulpCount = profile.pulpCount || 5;
    for (let i = 0; i < pulpCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(40, 150);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 20;

      const size = randomRange(1.8, 2.8);
      const life = randomRange(0.32, 0.52);
      const rotSpeed = (Math.random() - 0.5) * 6;

      this.pool.obtain(
        x + (Math.random() - 0.5) * 16,
        y + (Math.random() - 0.5) * 16,
        vx,
        vy,
        480,
        size,
        pulpColor,
        life,
        'pulp',
        Math.random() * Math.PI,
        rotSpeed
      );
    }

    // 4. Subtle Micro-Mist Juice Flecks (fast, fine, high-energy impact)
    for (let i = 0; i < 4; i++) {
      const angle = cutAngle + (i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * 0.5;
      const speed = randomRange(180, 360);
      this.pool.obtain(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        500,
        randomRange(1.2, 2.2),
        juiceColor,
        randomRange(0.16, 0.26),
        'droplet'
      );
    }
  }

  /**
   * Spawns explosive shockwave rings, fiery embers, and billowing smoke puffs
   * when a hazardous bomb is cleaved.
   */
  spawnBombExplosion(x, y) {
    // 1. Expanding primary shockwave ring
    this.pool.obtain(
      x,
      y,
      0,
      0,
      0,
      12,
      '#EF4444',
      0.36,
      'shockwave_ring',
      0,
      0,
      115
    );

    // 2. Secondary high-energy core shockwave
    this.pool.obtain(
      x,
      y,
      0,
      0,
      0,
      6,
      '#F59E0B',
      0.24,
      'shockwave_ring',
      0,
      0,
      75
    );

    // 3. Fiery embers / sparks (14 particles radiating outward)
    const emberColors = ['#F59E0B', '#EF4444', '#FBBF24', '#FFFFFF'];
    const sparkCount = 14;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = randomRange(180, 420);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 60;
      const size = randomRange(2.8, 4.8);
      const color = emberColors[Math.floor(Math.random() * emberColors.length)];
      const life = randomRange(0.35, 0.65);

      this.pool.obtain(
        x + (Math.random() - 0.5) * 8,
        y + (Math.random() - 0.5) * 8,
        vx,
        vy,
        420,
        size,
        color,
        life,
        'fire_spark'
      );
    }

    // 4. Dark smoke puffs (8 billowing clouds drifting upward)
    const smokeColors = ['#334155', '#475569', '#1E293B'];
    const smokeCount = 8;
    for (let i = 0; i < smokeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(30, 95);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - randomRange(50, 110);
      const size = randomRange(9, 16);
      const color = smokeColors[Math.floor(Math.random() * smokeColors.length)];
      const life = randomRange(0.48, 0.78);

      this.pool.obtain(
        x + (Math.random() - 0.5) * 14,
        y + (Math.random() - 0.5) * 14,
        vx,
        vy,
        -40,
        size,
        color,
        life,
        'smoke_puff'
      );
    }
  }

  /**
   * Spawns floating score or combo popups on Canvas.
   */
  spawnScorePopup(x, y, text, color = '#F8FAFC') {
    this.pool.obtain(
      x,
      y,
      (Math.random() - 0.5) * 16,
      -95,
      0,
      18,
      color,
      0.65,
      'text',
      0,
      0,
      0,
      text
    );
  }

  /**
   * Spawns a sleek red 'X' missed marker when a fruit drops unsliced.
   */
  spawnMissedMarker(x, y) {
    this.pool.obtain(
      x,
      y,
      0,
      -90,
      0,
      24,
      '#EF4444',
      0.65,
      'text',
      0,
      0,
      0,
      'X'
    );
  }

  update(dt) {
    const active = this.pool.getActiveItems();
    for (let i = active.length - 1; i >= 0; i--) {
      const particle = active[i];
      particle.update(dt);
      if (!particle.active) {
        this.pool.release(particle);
      }
    }
  }

  render(ctx) {
    const active = this.pool.getActiveItems();
    for (let i = 0; i < active.length; i++) {
      active[i].render(ctx);
    }
    ctx.globalAlpha = 1.0;
  }

  reset() {
    this.pool.releaseAll();
  }
}
