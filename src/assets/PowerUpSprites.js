/**
 * High-definition procedural Power-Up sprite generator.
 * Pre-renders all 5 power-up varieties in Whole, Top-sliced, and Bottom-sliced states
 * onto high-resolution offscreen canvases at startup for peak 60 FPS GPU blitting.
 *
 * Strictly vector/procedural canvas art: NO EMOJIS.
 */

export const POWER_UP_TYPES = Object.freeze({
  SLOW_MOTION: 'slow_motion',
  FRENZY: 'frenzy',
  DOUBLE_SCORE: 'double_score',
  LIFE_RESTORE: 'life_restore',
  BLADE_BOOST: 'blade_boost',
});

export const POWER_UP_CONFIGS = Object.freeze({
  [POWER_UP_TYPES.SLOW_MOTION]: {
    id: POWER_UP_TYPES.SLOW_MOTION,
    name: 'Slow Motion',
    badgeText: 'SLOW MOTION',
    duration: 6.0,
    radius: 38,
    primaryColor: '#00F0FF',
    secondaryColor: '#38BDF8',
    glowColor: 'rgba(0, 240, 255, 0.65)',
    darkColor: '#0369A1',
    accentColor: '#E0F2FE',
    description: 'Slows fruit & bomb physics while blade stays razor-fast',
  },
  [POWER_UP_TYPES.FRENZY]: {
    id: POWER_UP_TYPES.FRENZY,
    name: 'Fruit Frenzy',
    badgeText: 'FRUIT FRENZY',
    duration: 6.0,
    radius: 38,
    primaryColor: '#EC4899',
    secondaryColor: '#A855F7',
    glowColor: 'rgba(236, 72, 153, 0.65)',
    darkColor: '#7E22CE',
    accentColor: '#FDF2F8',
    description: 'Rapid fruit wave barrages, bonus score & boosted combos',
  },
  [POWER_UP_TYPES.DOUBLE_SCORE]: {
    id: POWER_UP_TYPES.DOUBLE_SCORE,
    name: 'Double Score',
    badgeText: '2X SCORE',
    duration: 6.0,
    radius: 38,
    primaryColor: '#F59E0B',
    secondaryColor: '#FBBF24',
    glowColor: 'rgba(245, 158, 11, 0.65)',
    darkColor: '#B45309',
    accentColor: '#FEF3C7',
    description: '2x multiplier on all fruit slices and combos',
  },
  [POWER_UP_TYPES.LIFE_RESTORE]: {
    id: POWER_UP_TYPES.LIFE_RESTORE,
    name: 'Life Restore',
    badgeText: '+1 LIFE',
    duration: 0, // Instant
    radius: 38,
    primaryColor: '#10B981',
    secondaryColor: '#34D399',
    glowColor: 'rgba(16, 185, 129, 0.65)',
    darkColor: '#047857',
    accentColor: '#D1FAE5',
    description: 'Restores 1 lost life (or grants +100 bonus score if full)',
  },
  [POWER_UP_TYPES.BLADE_BOOST]: {
    id: POWER_UP_TYPES.BLADE_BOOST,
    name: 'Blade Boost',
    badgeText: 'BLADE BOOST',
    duration: 6.5,
    radius: 38,
    primaryColor: '#EF4444',
    secondaryColor: '#F97316',
    glowColor: 'rgba(239, 68, 68, 0.65)',
    darkColor: '#991B1B',
    accentColor: '#FEE2E2',
    description: 'Massive blazing blade trail, wider slice reach & critical cuts',
  },
});

const SPRITE_CACHE = new Map();
const RASTER_SCALE = 2.0;
const BASE_CANVAS_SIZE = 120;
const RASTER_SIZE = BASE_CANVAS_SIZE * RASTER_SCALE; // 240px

/**
 * Draws the vector insignia emblem in the center of the power-up orb.
 */
function drawPowerUpInsignia(ctx, type, r) {
  ctx.save();

  switch (type) {
    case POWER_UP_TYPES.SLOW_MOTION: {
      // Intricate 6-pointed crystalline snowflake rune
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';

      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        ctx.save();
        ctx.rotate(angle);

        // Main branch
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r * 0.58);
        ctx.stroke();

        // Chevron v-spikes
        ctx.beginPath();
        ctx.moveTo(-r * 0.16, -r * 0.36);
        ctx.lineTo(0, -r * 0.44);
        ctx.lineTo(r * 0.16, -r * 0.36);
        ctx.stroke();

        // Outer diamond crystal tips
        ctx.fillStyle = '#E0F2FE';
        ctx.beginPath();
        ctx.arc(0, -r * 0.58, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Center diamond core
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.14);
      ctx.lineTo(r * 0.14, 0);
      ctx.lineTo(0, r * 0.14);
      ctx.lineTo(-r * 0.14, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case POWER_UP_TYPES.FRENZY: {
      // Dynamic twin lightning velocity slash bolts
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#EC4899';
      ctx.shadowBlur = 6;

      // Primary lightning blade
      ctx.beginPath();
      ctx.moveTo(-r * 0.08, -r * 0.60);
      ctx.lineTo(r * 0.26, -r * 0.10);
      ctx.lineTo(r * 0.04, -r * 0.06);
      ctx.lineTo(r * 0.36, r * 0.54);
      ctx.lineTo(-r * 0.12, r * 0.08);
      ctx.lineTo(r * 0.06, 0.04);
      ctx.closePath();
      ctx.fill();

      // Secondary swift slash arc
      ctx.strokeStyle = '#FDF2F8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.50, -Math.PI * 0.75, -Math.PI * 0.1);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.50, Math.PI * 0.25, Math.PI * 0.9);
      ctx.stroke();
      break;
    }

    case POWER_UP_TYPES.DOUBLE_SCORE: {
      // Bold, clean embossed "2X" typography with drop shadow
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Drop shadow for embossed depth
      ctx.fillStyle = '#78350F';
      ctx.font = `900 ${Math.round(r * 0.68)}px sans-serif`;
      ctx.fillText('2X', 2, 2);

      // Gold-to-white metallic gradient text
      const textGrad = ctx.createLinearGradient(0, -r * 0.35, 0, r * 0.35);
      textGrad.addColorStop(0, '#FFFFFF');
      textGrad.addColorStop(0.45, '#FEF08A');
      textGrad.addColorStop(1, '#F59E0B');
      ctx.fillStyle = textGrad;
      ctx.fillText('2X', 0, 0);

      // Specular edge highlights
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.4;
      ctx.strokeText('2X', 0, 0);
      break;
    }

    case POWER_UP_TYPES.LIFE_RESTORE: {
      // Sacred Vitality Heart with center luminous cross
      ctx.save();
      const hr = r * 0.52;

      // Heart path
      ctx.beginPath();
      ctx.moveTo(0, hr * 0.72);
      ctx.bezierCurveTo(-hr * 1.1, hr * 0.25, -hr * 1.25, -hr * 0.65, 0, -hr * 0.75);
      ctx.bezierCurveTo(hr * 1.25, -hr * 0.65, hr * 1.1, hr * 0.25, 0, hr * 0.72);
      ctx.closePath();

      const heartGrad = ctx.createLinearGradient(0, -hr, 0, hr);
      heartGrad.addColorStop(0, '#FFFFFF');
      heartGrad.addColorStop(0.4, '#34D399');
      heartGrad.addColorStop(1, '#059669');
      ctx.fillStyle = heartGrad;
      ctx.fill();

      // White vitality cross in center
      ctx.fillStyle = '#FFFFFF';
      const cw = hr * 0.22;
      const cl = hr * 0.58;
      // Vertical bar
      ctx.fillRect(-cw * 0.5, -cl * 0.5 - hr * 0.08, cw, cl);
      // Horizontal bar
      ctx.fillRect(-cl * 0.5, -cw * 0.5 - hr * 0.08, cl, cw);

      ctx.restore();
      break;
    }

    case POWER_UP_TYPES.BLADE_BOOST: {
      // Japanese Katana Crest with Ascending Flame
      // Flame background
      ctx.save();
      const fr = r * 0.54;
      ctx.beginPath();
      ctx.moveTo(0, fr * 0.65);
      ctx.quadraticCurveTo(fr * 0.85, 0, fr * 0.35, -fr * 0.75);
      ctx.quadraticCurveTo(0, -fr * 0.3, -fr * 0.35, -fr * 0.85);
      ctx.quadraticCurveTo(-fr * 0.85, 0, 0, fr * 0.65);
      ctx.closePath();

      const flameGrad = ctx.createLinearGradient(0, fr * 0.65, 0, -fr * 0.85);
      flameGrad.addColorStop(0, '#EF4444');
      flameGrad.addColorStop(0.5, '#F97316');
      flameGrad.addColorStop(1, '#FBBF24');
      ctx.fillStyle = flameGrad;
      ctx.fill();

      // Curved Katana Blade passing diagonally through flame
      ctx.beginPath();
      ctx.moveTo(-fr * 0.75, fr * 0.65);
      ctx.quadraticCurveTo(0, 0, fr * 0.82, -fr * 0.70);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Gold hilt tsuba
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(-fr * 0.45, fr * 0.38, 3.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      break;
    }

    default:
      break;
  }

  ctx.restore();
}

/**
 * Pre-renders an offscreen canvas for the given power-up type and slice state.
 */
function createPowerUpCanvas(type, state = 'whole') {
  const canvas = document.createElement('canvas');
  canvas.width = RASTER_SIZE;
  canvas.height = RASTER_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Logical coordinate system centered at (60, 60)
  ctx.translate(RASTER_SIZE * 0.5, RASTER_SIZE * 0.5);
  ctx.scale(RASTER_SCALE, RASTER_SCALE);

  const config = POWER_UP_CONFIGS[type] || POWER_UP_CONFIGS[POWER_UP_TYPES.SLOW_MOTION];
  const r = config.radius;

  // Clip state for half-sliced rendering
  if (state === 'top') {
    ctx.beginPath();
    ctx.rect(-BASE_CANVAS_SIZE * 0.5, -BASE_CANVAS_SIZE * 0.5, BASE_CANVAS_SIZE, BASE_CANVAS_SIZE * 0.5);
    ctx.clip();
  } else if (state === 'bottom') {
    ctx.beginPath();
    ctx.rect(-BASE_CANVAS_SIZE * 0.5, 0, BASE_CANVAS_SIZE, BASE_CANVAS_SIZE * 0.5);
    ctx.clip();
  }

  // 1. Outer Translucent Energy Halo / Aura
  const auraGrad = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.35);
  auraGrad.addColorStop(0, config.glowColor);
  auraGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.05)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
  ctx.fill();

  // 2. Beveled Metallic / Gemstone Outer Ring
  const rimGrad = ctx.createLinearGradient(-r, -r, r, r);
  rimGrad.addColorStop(0, '#FFFFFF');
  rimGrad.addColorStop(0.25, config.accentColor);
  rimGrad.addColorStop(0.5, config.primaryColor);
  rimGrad.addColorStop(0.85, config.darkColor);
  rimGrad.addColorStop(1, '#0F172A');

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = rimGrad;
  ctx.fill();

  // 3. Inner Orb Core with Rich Radial Glow
  const coreR = r * 0.88;
  const coreGrad = ctx.createRadialGradient(-coreR * 0.35, -coreR * 0.35, 4, 0, 0, coreR);
  coreGrad.addColorStop(0, '#FFFFFF');
  coreGrad.addColorStop(0.2, config.secondaryColor);
  coreGrad.addColorStop(0.65, config.primaryColor);
  coreGrad.addColorStop(1, config.darkColor);

  ctx.beginPath();
  ctx.arc(0, 0, coreR, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();

  // Inner ring border
  ctx.strokeStyle = config.accentColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, coreR, 0, Math.PI * 2);
  ctx.stroke();

  // 4. Vector Insignia Crest
  drawPowerUpInsignia(ctx, type, coreR);

  // 5. Specular Upper-Left Glass Gleam
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-coreR * 0.35, -coreR * 0.40, coreR * 0.42, coreR * 0.18, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fill();
  ctx.restore();

  // 6. Sliced Edge Core Visuals (when rendered in halves)
  if (state === 'top' || state === 'bottom') {
    ctx.restore(); // reset clip
    ctx.save();
    ctx.translate(RASTER_SIZE * 0.5, RASTER_SIZE * 0.5);
    ctx.scale(RASTER_SCALE, RASTER_SCALE);

    // Glowing crystalline cut face
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.96, 5.0, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = config.primaryColor;
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.strokeStyle = config.secondaryColor;
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.restore();
  }

  return canvas;
}

/**
 * Pre-warms and caches all power-up sprites.
 */
export function initPowerUpSprites() {
  if (typeof document === 'undefined') return;
  if (SPRITE_CACHE.size > 0) return;

  const states = ['whole', 'top', 'bottom'];
  for (const type of Object.values(POWER_UP_TYPES)) {
    for (const state of states) {
      const key = `${type}_${state}`;
      const canvas = createPowerUpCanvas(type, state);
      SPRITE_CACHE.set(key, canvas);
    }
  }
}

/**
 * Retrieves the cached high-resolution offscreen sprite for a power-up.
 */
export function getPowerUpSprite(type, state = 'whole') {
  if (typeof document === 'undefined') return null;
  const key = `${type}_${state}`;
  if (!SPRITE_CACHE.has(key)) {
    const canvas = createPowerUpCanvas(type, state);
    SPRITE_CACHE.set(key, canvas);
  }
  return SPRITE_CACHE.get(key);
}
