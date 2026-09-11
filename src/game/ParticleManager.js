/**
 * High-performance ParticleManager with object pooling for directional juice sprays,
 * pulp droplets, and slice splash flashes.
 */

import { Particle } from '../entities/Particle.js';
import { ObjectPool } from '../utils/pool.js';
import { randomRange } from '../utils/math.js';
import { FRUIT_CONFIGS, FRUIT_TYPES } from '../assets/FruitSprites.js';
import { POWER_UP_CONFIGS, POWER_UP_TYPES } from '../assets/PowerUpSprites.js';

export class ParticleManager {
  constructor() {
    this.pool = new ObjectPool(
      () => new Particle(),
      (particle, ...args) => particle.reset(...args),
      300
    );

    // Hard performance limits to guarantee constant 60 FPS
    this.maxActiveLimit = 220;
    this.frameSpawnBudget = 60;
    this.spawnsThisFrame = 0;
    this.performanceMonitor = null;
  }

  setPerformanceMonitor(monitor) {
    this.performanceMonitor = monitor;
  }

  obtainParticle(...args) {
    const maxActive = this.performanceMonitor ? this.performanceMonitor.getMaxActiveParticles() : this.maxActiveLimit;
    const frameBudget = this.performanceMonitor ? this.performanceMonitor.getFrameSpawnBudget() : this.frameSpawnBudget;

    if (
      this.pool.getActiveCount() >= maxActive ||
      this.spawnsThisFrame >= frameBudget
    ) {
      return null;
    }
    this.spawnsThisFrame++;
    return this.pool.obtain(...args);
  }

  /**
   * Spawns physical directional juice spray, pulp particles, rind fragments,
   * sparkle glints, micro-impact star spark, and slice splash flash when a fruit is cleaved.
   * Direction cleanly incorporates fruit movement velocity, blade swipe vector, and cut normal.
   */
  spawnSliceEffects(
    x,
    y,
    cutSegment,
    fruitType,
    radius = 40,
    hitPoint = null,
    fruitVelocity = null,
    combo = 1,
    isBladeBoost = false,
    isFever = false
  ) {
    const config = FRUIT_CONFIGS[fruitType] || FRUIT_CONFIGS[FRUIT_TYPES.WATERMELON];
    const { juiceColor, pulpColor, rindColor, particleProfile } = config;
    const profile = particleProfile || { droplets: 8, pulpCount: 5, splashScale: 1.0 };

    // Precise contact origin
    const contactX = hitPoint ? hitPoint.x : x;
    const contactY = hitPoint ? hitPoint.y : y;

    const { p1, p2 } = cutSegment;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const cutAngle = Math.atan2(dy, dx);

    // Normal unit vectors (perpendicular cut blowout)
    const nx = len > 0 ? -dy / len : 0;
    const ny = len > 0 ? dx / len : 1;
    // Tangent unit vectors (blade swipe direction)
    const tx = len > 0 ? dx / len : 1;
    const ty = len > 0 ? dy / len : 0;

    // Fruit inertia influence
    const fvx = (fruitVelocity?.vx || 0) * 0.35;
    const fvy = (fruitVelocity?.vy || 0) * 0.35;

    // Tangential forward momentum from blade swipe
    const swipeSpeed = cutSegment?.speed || 320;
    const forwardBias = Math.min(220, Math.max(60, swipeSpeed * 0.18));
    const bladeVx = tx * forwardBias;
    const bladeVy = ty * forwardBias;

    // Controlled combo scaling (never excessive)
    const comboScale = Math.min(1.4, 1.0 + (combo - 1) * 0.10);

    // 1. High-energy micro-impact flash star spark at exact contact point
    this.obtainParticle(
      contactX,
      contactY,
      0,
      0,
      0,
      radius * 0.75,
      juiceColor,
      0.08,
      'impact_spark',
      cutAngle
    );

    // 2. Slice Splash Flash (short-lived radiant line along cut, scaled by profile)
    const splashLength = radius * 2.2 * (profile.splashScale || 1.0);
    this.obtainParticle(
      contactX,
      contactY,
      0,
      0,
      0,
      5.0,
      juiceColor,
      0.11,
      'splash_line',
      cutAngle,
      0,
      splashLength
    );

    // 3. Directional Juice Droplets biased by fruit velocity and blade swipe momentum
    const dropletCount = Math.round((profile.droplets || 8) * comboScale);
    for (let i = 0; i < dropletCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const normalSpeed = side * randomRange(110, 290);
      const tangentSpeed = forwardBias + randomRange(-45, 95);

      const vx = fvx + nx * normalSpeed + tx * tangentSpeed;
      const vy = fvy + ny * normalSpeed + ty * tangentSpeed - randomRange(25, 85);

      const size = randomRange(2.0, 4.2);
      const life = randomRange(0.24, 0.42);
      const color = Math.random() < 0.7 ? juiceColor : pulpColor;

      this.obtainParticle(
        contactX + (Math.random() - 0.5) * 12,
        contactY + (Math.random() - 0.5) * 12,
        vx,
        vy,
        650,
        size,
        color,
        life,
        'droplet'
      );
    }

    // 4. Focused High-Speed Micro-Mist Juice Spray (short burst along blade cut)
    const mistCount = 4;
    for (let i = 0; i < mistCount; i++) {
      const angle = cutAngle + (i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * 0.45;
      const speed = randomRange(160, 320);
      this.obtainParticle(
        contactX,
        contactY,
        fvx + Math.cos(angle) * speed + bladeVx * 0.4,
        fvy + Math.sin(angle) * speed + bladeVy * 0.4,
        520,
        randomRange(1.2, 2.0),
        juiceColor,
        randomRange(0.14, 0.24),
        'droplet'
      );
    }

    // 5. Fleshy Pulp Particles tailored to fruit variety
    const pulpCount = Math.round((profile.pulpCount || 5) * comboScale);
    for (let i = 0; i < pulpCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(40, 140);
      const vx = fvx * 0.6 + Math.cos(angle) * speed + bladeVx * 0.35;
      const vy = fvy * 0.6 + Math.sin(angle) * speed + bladeVy * 0.35 - 20;

      const size = randomRange(1.8, 2.8);
      const life = randomRange(0.28, 0.46);
      const rotSpeed = (Math.random() - 0.5) * 6;

      this.obtainParticle(
        contactX + (Math.random() - 0.5) * 16,
        contactY + (Math.random() - 0.5) * 16,
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

    // 6. Small Fruit Rind Fragments tumbling under gravity
    const fragmentCount = 2;
    for (let i = 0; i < fragmentCount; i++) {
      const angle = cutAngle + (i === 0 ? Math.PI * 0.5 : -Math.PI * 0.5) + (Math.random() - 0.5) * 0.6;
      const speed = randomRange(70, 180);
      const vx = fvx * 0.5 + Math.cos(angle) * speed + bladeVx * 0.3;
      const vy = fvy * 0.5 + Math.sin(angle) * speed + bladeVy * 0.3 - randomRange(30, 80);

      this.obtainParticle(
        contactX + (Math.random() - 0.5) * 10,
        contactY + (Math.random() - 0.5) * 10,
        vx,
        vy,
        750,
        randomRange(2.6, 4.2),
        rindColor || '#15803D',
        randomRange(0.30, 0.46),
        'fragment',
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 8.5,
        0,
        '',
        pulpColor
      );
    }

    // 7. Sparkling Diamond Glints along cut line
    const sparkleCount = combo >= 2 ? 3 : 2;
    for (let i = 0; i < sparkleCount; i++) {
      const offset = (Math.random() - 0.5) * radius * 1.2;
      this.obtainParticle(
        contactX + tx * offset,
        contactY + ty * offset,
        (Math.random() - 0.5) * 35,
        (Math.random() - 0.5) * 35 - 20,
        150,
        randomRange(2.0, 3.4),
        '#FFFFFF',
        randomRange(0.18, 0.28),
        'sparkle',
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 4
      );
    }

    // 8. High-Combo Shockwave Ring (combos >= 3)
    if (combo >= 3) {
      this.obtainParticle(
        contactX,
        contactY,
        0,
        0,
        0,
        radius * 0.4,
        '#FBBF24',
        0.20,
        'combo_ring',
        0,
        0,
        radius * 1.9
      );
    }

    // 9. Blade Boost Critical Impact Feedback
    if (isBladeBoost) {
      // Golden impact starburst
      this.obtainParticle(
        contactX,
        contactY,
        0,
        0,
        0,
        radius * 1.3,
        '#FDE047',
        0.14,
        'impact_spark',
        cutAngle
      );

      // Fiery amber shockwave ring
      this.obtainParticle(
        contactX,
        contactY,
        0,
        0,
        0,
        radius * 0.5,
        '#F59E0B',
        0.22,
        'shockwave_ring',
        0,
        0,
        radius * 2.2
      );

      // Additional blazing critical sparks
      for (let i = 0; i < 4; i++) {
        this.obtainParticle(
          contactX + (Math.random() - 0.5) * 14,
          contactY + (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 120,
          (Math.random() - 0.5) * 120 - 40,
          250,
          randomRange(2.5, 4.2),
          i % 2 === 0 ? '#FBBF24' : '#EF4444',
          randomRange(0.25, 0.40),
          'sparkle',
          Math.random() * Math.PI,
          (Math.random() - 0.5) * 6
        );
      }
    }

    // 10. Fever Mode Energetic Ember Surge
    if (isFever) {
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randomRange(100, 220);
        this.obtainParticle(
          contactX,
          contactY,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 20,
          200,
          randomRange(2.5, 4.5),
          i % 2 === 0 ? '#FDE047' : '#F97316',
          randomRange(0.28, 0.48),
          'sparkle',
          Math.random() * Math.PI,
          (Math.random() - 0.5) * 5
        );
      }
    }
  }

  /**
   * Spawns explosive shockwave rings, fiery embers, and billowing smoke puffs
   * when a hazardous bomb is cleaved.
   */
  spawnBombExplosion(x, y) {
    // 1. Expanding primary shockwave ring
    this.obtainParticle(
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
    this.obtainParticle(
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

      this.obtainParticle(
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

      this.obtainParticle(
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
  spawnScorePopup(x, y, text, color = '#F8FAFC', combo = 1) {
    const isCombo = combo >= 2 || text.includes('x');
    const popupLife = isCombo ? 0.70 : 0.60;
    const riseSpeed = isCombo ? -105 : -90;
    const size = isCombo ? 24 : 18;

    this.obtainParticle(
      x,
      y,
      (Math.random() - 0.5) * 16,
      riseSpeed,
      0,
      size,
      color,
      popupLife,
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
    this.obtainParticle(
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

  /**
   * Spawns radiant restorative sparkles, emerald ring, and floating text popup when a life is recovered.
   */
  spawnLifeRecoveredEffects(x, y, text = '+1 LIFE RECOVERED') {
    // 1. Floating restorative text popup
    this.obtainParticle(
      x,
      y,
      0,
      -95,
      0,
      22,
      '#10B981',
      0.85,
      'text',
      0,
      0,
      0,
      text
    );

    // 2. Radiant restorative sparkles
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = randomRange(60, 160);
      this.obtainParticle(
        x + (Math.random() - 0.5) * 16,
        y + (Math.random() - 0.5) * 16,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 30,
        160,
        randomRange(2.5, 4.5),
        i % 2 === 0 ? '#10B981' : '#FBBF24',
        randomRange(0.40, 0.70),
        'sparkle',
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 5
      );
    }

    // 3. Expanding emerald halo ring
    this.obtainParticle(
      x,
      y,
      0,
      0,
      0,
      12,
      '#10B981',
      0.35,
      'shockwave_ring',
      0,
      0,
      95
    );
  }

  /**
   * Spawns radiant golden starburst, expanding golden ring, sparkling glints,
   * and subtle score animation for a clean Perfect Slice.
   */
  spawnPerfectSliceEffects(x, y) {
    // 1. High-energy radiant golden diamond flash at impact center
    this.obtainParticle(
      x,
      y,
      0,
      0,
      0,
      48,
      '#FBBF24',
      0.14,
      'impact_spark',
      0
    );

    // 2. Expanding golden combo ring
    this.obtainParticle(
      x,
      y,
      0,
      0,
      0,
      18,
      '#F59E0B',
      0.38,
      'combo_ring',
      0,
      0,
      82
    );

    // 3. Floating "PERFECT! +10" popup text
    this.obtainParticle(
      x,
      y - 24,
      (Math.random() - 0.5) * 12,
      -105,
      0,
      25,
      '#FDE047',
      0.75,
      'text',
      0,
      0,
      0,
      'PERFECT! +10'
    );

    // 4. Radiant golden star glints
    const glintCount = 8;
    for (let i = 0; i < glintCount; i++) {
      const angle = (i / glintCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = randomRange(90, 220);
      this.obtainParticle(
        x + (Math.random() - 0.5) * 8,
        y + (Math.random() - 0.5) * 8,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        220,
        randomRange(3.0, 5.0),
        i % 2 === 0 ? '#FEF08A' : '#FBBF24',
        randomRange(0.35, 0.55),
        'sparkle',
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 6
      );
    }
  }

  /**
   * Spawns clean multi-slice badge and chain feedback for slicing multiple fruits in one swipe.
   * NO EMOJIS used.
   */
  spawnMultiSliceEffects(x, y, count = 2) {
    let text = 'DOUBLE SLICE! +2';
    let color = '#38BDF8';
    let ringRadius = 80;

    if (count === 3) {
      text = 'TRIPLE SLICE! +5';
      color = '#FBBF24';
      ringRadius = 95;
    } else if (count === 4) {
      text = 'QUAD SLICE! +10';
      color = '#F97316';
      ringRadius = 110;
    } else if (count >= 5) {
      text = 'ULTRA SLICE! +20';
      color = '#EC4899';
      ringRadius = 130;
    }

    // 1. Clean multi-slice indicator popup
    this.obtainParticle(
      x,
      y - 36,
      (Math.random() - 0.5) * 14,
      -110,
      0,
      28,
      color,
      0.82,
      'text',
      0,
      0,
      0,
      text
    );

    // 2. Expanding shockwave ring
    this.obtainParticle(
      x,
      y,
      0,
      0,
      0,
      24,
      color,
      0.40,
      'shockwave_ring',
      0,
      0,
      ringRadius
    );

    // 3. Dynamic burst sparkles around the multi-slice center
    const burstCount = Math.min(16, 6 + count * 2);
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const speed = randomRange(80, 200);
      this.obtainParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        180,
        randomRange(2.5, 4.5),
        color,
        randomRange(0.30, 0.55),
        'sparkle',
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 4
      );
    }
  }

  /**
   * Spawns an energetic radial explosion of sparkling motes, dual shockwave rings,
   * and floating banner text when a power-up orb is cleaved open.
   */
  spawnPowerUpBurst(x, y, type) {
    const config = POWER_UP_CONFIGS[type] || POWER_UP_CONFIGS[POWER_UP_TYPES.SLOW_MOTION];
    const primary = config.primaryColor;
    const secondary = config.secondaryColor;

    // 1. Primary expanding shockwave ring
    this.obtainParticle(
      x,
      y,
      0,
      0,
      0,
      14,
      primary,
      0.40,
      'shockwave_ring',
      0,
      0,
      135
    );

    // 2. Secondary core shockwave
    this.obtainParticle(
      x,
      y,
      0,
      0,
      0,
      8,
      '#FFFFFF',
      0.24,
      'shockwave_ring',
      0,
      0,
      80
    );

    // 3. Radiant 360-degree sparkling power motes
    const moteCount = 20;
    for (let i = 0; i < moteCount; i++) {
      const angle = (i / moteCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const speed = randomRange(140, 360);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 40;
      const size = randomRange(3.2, 5.5);
      const color = i % 3 === 0 ? '#FFFFFF' : (i % 2 === 0 ? primary : secondary);
      const life = randomRange(0.40, 0.70);

      this.obtainParticle(
        x + (Math.random() - 0.5) * 12,
        y + (Math.random() - 0.5) * 12,
        vx,
        vy,
        280,
        size,
        color,
        life,
        'sparkle',
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 6
      );
    }

    // 4. Floating power-up badge banner popup
    this.obtainParticle(
      x,
      y - 20,
      0,
      -105,
      0,
      24,
      primary,
      0.90,
      'text',
      0,
      0,
      0,
      config.badgeText || 'POWER UP!'
    );
  }

  update(dt) {
    this.spawnsThisFrame = 0;

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
    this.spawnsThisFrame = 0;
  }
}
