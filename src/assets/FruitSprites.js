/**
 * High-definition procedural fruit sprite generator.
 * Pre-renders all 8 fruit varieties in Whole, Left-sliced, and Right-sliced states
 * onto high-resolution offscreen canvases at startup for peak 60 FPS GPU blitting.
 */

export const FRUIT_TYPES = Object.freeze({
  WATERMELON: 'watermelon',
  APPLE: 'apple',
  ORANGE: 'orange',
  BANANA: 'banana',
  PINEAPPLE: 'pineapple',
  STRAWBERRY: 'strawberry',
  DRAGON_FRUIT: 'dragonfruit',
  COCONUT: 'coconut',
  KIWI: 'kiwi',
  PEACH: 'peach',
});

export const FRUIT_CONFIGS = Object.freeze({
  [FRUIT_TYPES.WATERMELON]: {
    name: 'Watermelon',
    radius: 46,
    weight: 1.22,
    rotationSpeedRange: [1.2, 2.4],
    score: 1,
    sliceBehavior: { separationSpeed: 210, angularKick: 3.8 },
    juiceColor: '#F43F5E',
    pulpColor: '#E11D48',
    rindColor: '#15803D',
    particleProfile: { droplets: 12, pulpCount: 6, splashScale: 1.25 },
  },
  [FRUIT_TYPES.APPLE]: {
    name: 'Apple',
    radius: 38,
    weight: 1.02,
    rotationSpeedRange: [2.2, 3.8],
    score: 1,
    sliceBehavior: { separationSpeed: 250, angularKick: 5.2 },
    juiceColor: '#FEF08A',
    pulpColor: '#FEF9C3',
    rindColor: '#DC2626',
    particleProfile: { droplets: 8, pulpCount: 5, splashScale: 1.0 },
  },
  [FRUIT_TYPES.ORANGE]: {
    name: 'Orange',
    radius: 38,
    weight: 1.00,
    rotationSpeedRange: [2.0, 3.6],
    score: 1,
    sliceBehavior: { separationSpeed: 235, angularKick: 4.8 },
    juiceColor: '#F97316',
    pulpColor: '#FB923C',
    rindColor: '#EA580C',
    particleProfile: { droplets: 10, pulpCount: 8, splashScale: 1.05 },
  },
  [FRUIT_TYPES.BANANA]: {
    name: 'Banana',
    radius: 40,
    weight: 0.90,
    rotationSpeedRange: [3.2, 5.6],
    score: 2,
    sliceBehavior: { separationSpeed: 200, angularKick: 6.2 },
    juiceColor: '#FEF08A',
    pulpColor: '#FEF9C3',
    rindColor: '#FACC15',
    particleProfile: { droplets: 7, pulpCount: 4, splashScale: 0.95 },
  },
  [FRUIT_TYPES.PINEAPPLE]: {
    name: 'Pineapple',
    radius: 46,
    weight: 1.18,
    rotationSpeedRange: [1.6, 2.8],
    score: 3,
    sliceBehavior: { separationSpeed: 225, angularKick: 4.2 },
    juiceColor: '#F59E0B',
    pulpColor: '#FBBF24',
    rindColor: '#78350F',
    particleProfile: { droplets: 9, pulpCount: 6, splashScale: 1.15 },
  },
  [FRUIT_TYPES.STRAWBERRY]: {
    name: 'Strawberry',
    radius: 34,
    weight: 0.82,
    rotationSpeedRange: [3.5, 6.2],
    score: 2,
    sliceBehavior: { separationSpeed: 270, angularKick: 6.8 },
    juiceColor: '#E11D48',
    pulpColor: '#FB7185',
    rindColor: '#9F1239',
    particleProfile: { droplets: 7, pulpCount: 5, splashScale: 0.9 },
  },
  [FRUIT_TYPES.DRAGON_FRUIT]: {
    name: 'Dragon Fruit',
    radius: 44,
    weight: 1.08,
    rotationSpeedRange: [1.8, 3.4],
    score: 4,
    sliceBehavior: { separationSpeed: 240, angularKick: 4.6 },
    juiceColor: '#EC4899',
    pulpColor: '#F8FAFC',
    rindColor: '#BE185D',
    particleProfile: { droplets: 11, pulpCount: 9, splashScale: 1.2 },
  },
  [FRUIT_TYPES.COCONUT]: {
    name: 'Coconut',
    radius: 42,
    weight: 1.25,
    rotationSpeedRange: [1.4, 2.6],
    score: 3,
    sliceBehavior: { separationSpeed: 230, angularKick: 4.0 },
    juiceColor: '#F8FAFC',
    pulpColor: '#FFFFFF',
    rindColor: '#78350F',
    particleProfile: { droplets: 8, pulpCount: 7, splashScale: 1.1 },
  },
  [FRUIT_TYPES.KIWI]: {
    name: 'Kiwi',
    radius: 36,
    weight: 0.88,
    rotationSpeedRange: [3.0, 5.4],
    score: 2,
    sliceBehavior: { separationSpeed: 260, angularKick: 5.8 },
    juiceColor: '#22C55E',
    pulpColor: '#84CC16',
    rindColor: '#78350F',
    particleProfile: { droplets: 9, pulpCount: 8, splashScale: 0.95 },
  },
  [FRUIT_TYPES.PEACH]: {
    name: 'Peach',
    radius: 40,
    weight: 1.05,
    rotationSpeedRange: [2.0, 3.6],
    score: 3,
    sliceBehavior: { separationSpeed: 215, angularKick: 4.8 },
    juiceColor: '#FB7185',
    pulpColor: '#FDBA74',
    rindColor: '#E11D48',
    particleProfile: { droplets: 10, pulpCount: 7, splashScale: 1.1 },
  },
});

// Pre-render at 2x resolution (320x320) so vector fruit artwork is super-sampled
// and rendered with razor-sharp anti-aliasing on high-DPI/Retina screens
const SPRITE_SCALE = 2.0;
const SPRITE_SIZE = 320;
const HALF_SIZE = SPRITE_SIZE / 2;

// Cache map of [fruitType][state] -> HTMLCanvasElement
const spriteCache = new Map();

function createOffscreenCanvas() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  return c;
}

// -------------------------------------------------------------
// 1. WATERMELON
// -------------------------------------------------------------
function drawWatermelonWhole(ctx) {
  const r = 54;
  // Deep gradient
  const grad = ctx.createRadialGradient(-16, -18, 6, 0, 0, r);
  grad.addColorStop(0, '#22C55E');
  grad.addColorStop(0.35, '#15803D');
  grad.addColorStop(0.75, '#166534');
  grad.addColorStop(1, '#052E16');

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Dark undulating tiger stripes
  ctx.strokeStyle = '#052E16';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const stripes = [-0.65, -0.32, 0.05, 0.42, 0.72];
  for (let i = 0; i < stripes.length; i++) {
    const ox = stripes[i] * r;
    ctx.beginPath();
    ctx.ellipse(ox, 0, r * 0.22, r * 0.94, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Specular sheen
  ctx.beginPath();
  ctx.arc(0, 0, r - 3, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.strokeStyle = 'rgba(134, 239, 172, 0.45)';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Stem
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(6, -r - 10, 12, -r - 12);
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawWatermelonHalf(ctx, isTop) {
  const r = 54;
  const start = isTop ? Math.PI : 0;
  const end = isTop ? Math.PI * 2 : Math.PI;

  // Dark green rind
  ctx.beginPath();
  ctx.arc(0, 0, r, start, end);
  ctx.closePath();
  ctx.fillStyle = '#15803D';
  ctx.fill();

  // Light green pith
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.90, start, end);
  ctx.closePath();
  ctx.fillStyle = '#86EFAC';
  ctx.fill();

  // Juicy crimson pulp
  const pulpGrad = ctx.createRadialGradient(0, isTop ? -10 : 10, 5, 0, isTop ? -20 : 20, r * 0.82);
  pulpGrad.addColorStop(0, '#FB7185');
  pulpGrad.addColorStop(0.5, '#F43F5E');
  pulpGrad.addColorStop(1, '#BE123C');

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, start, end);
  ctx.closePath();
  ctx.fillStyle = pulpGrad;
  ctx.fill();

  // Black teardrop seeds
  ctx.fillStyle = '#0F172A';
  const ySign = isTop ? -1 : 1;
  const seeds = [
    [-r * 0.46, ySign * r * 0.35],
    [-r * 0.18, ySign * r * 0.54],
    [r * 0.16, ySign * r * 0.54],
    [r * 0.44, ySign * r * 0.35],
    [0, ySign * r * 0.28],
  ];
  for (let i = 0; i < seeds.length; i++) {
    ctx.beginPath();
    ctx.ellipse(seeds[i][0], seeds[i][1], 2.2, 3.8, ySign * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// -------------------------------------------------------------
// 2. APPLE
// -------------------------------------------------------------
function drawAppleWhole(ctx) {
  const r = 48;
  const grad = ctx.createRadialGradient(-14, -16, 5, 0, 0, r);
  grad.addColorStop(0, '#F87171');
  grad.addColorStop(0.35, '#EF4444');
  grad.addColorStop(0.75, '#DC2626');
  grad.addColorStop(1, '#7F1D1D');

  ctx.beginPath();
  ctx.moveTo(0, -r * 0.75);
  ctx.bezierCurveTo(r * 0.55, -r * 1.08, r * 1.15, -r * 0.35, r, r * 0.45);
  ctx.bezierCurveTo(r * 0.85, r * 1.06, r * 0.2, r * 1.02, 0, r * 0.85);
  ctx.bezierCurveTo(-r * 0.2, r * 1.02, -r * 0.85, r * 1.06, -r, r * 0.45);
  ctx.bezierCurveTo(-r * 1.15, -r * 0.35, -r * 0.55, -r * 1.08, 0, -r * 0.75);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Upper left specular shine
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.42, r * 0.32, r * 0.16, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fill();

  // Stem
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.75);
  ctx.quadraticCurveTo(6, -r * 1.15, 9, -r * 1.30);
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Green Leaf
  ctx.beginPath();
  ctx.ellipse(10, -r * 1.12, 10, 4.5, Math.PI / 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#16A34A';
  ctx.fill();
}

function drawAppleHalf(ctx, isTop) {
  const r = 48;
  const start = isTop ? Math.PI : 0;
  const end = isTop ? Math.PI * 2 : Math.PI;

  // Red skin
  ctx.beginPath();
  ctx.arc(0, 0, r, start, end);
  ctx.closePath();
  ctx.fillStyle = '#DC2626';
  ctx.fill();

  // Pale cream flesh
  const fleshGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 0.88);
  fleshGrad.addColorStop(0, '#FFFBEB');
  fleshGrad.addColorStop(0.7, '#FEF9C3');
  fleshGrad.addColorStop(1, '#FDE68A');

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, start, end);
  ctx.closePath();
  ctx.fillStyle = fleshGrad;
  ctx.fill();

  // Core cavity and seed
  const ySign = isTop ? -1 : 1;
  ctx.fillStyle = '#451A03';
  ctx.beginPath();
  ctx.ellipse(-4, ySign * r * 0.22, 2.4, 4.5, -ySign * 0.2, 0, Math.PI * 2);
  ctx.ellipse(4, ySign * r * 0.22, 2.4, 4.5, ySign * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Core outline
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.38, start, end);
  ctx.stroke();
}

// -------------------------------------------------------------
// 3. ORANGE
// -------------------------------------------------------------
function drawOrangeWhole(ctx) {
  const r = 48;
  const grad = ctx.createRadialGradient(-15, -16, 5, 0, 0, r);
  grad.addColorStop(0, '#FDBA74');
  grad.addColorStop(0.35, '#FB923C');
  grad.addColorStop(0.75, '#EA580C');
  grad.addColorStop(1, '#9A3412');

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Micro pore dots
  ctx.fillStyle = 'rgba(154, 52, 18, 0.45)';
  const pores = [
    [-r * 0.32, -r * 0.2],
    [-r * 0.12, r * 0.32],
    [r * 0.35, -r * 0.12],
    [r * 0.22, r * 0.38],
    [-r * 0.42, r * 0.12],
    [r * 0.12, -r * 0.42],
  ];
  for (let i = 0; i < pores.length; i++) {
    ctx.beginPath();
    ctx.arc(pores[i][0], pores[i][1], 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Specular sheen
  ctx.beginPath();
  ctx.arc(0, 0, r - 3, -Math.PI * 0.75, -Math.PI * 0.25);
  ctx.strokeStyle = 'rgba(254, 215, 170, 0.6)';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Calyx leaf
  ctx.beginPath();
  ctx.ellipse(0, -r + 3, 7, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#16A34A';
  ctx.fill();
}

function drawOrangeHalf(ctx, isTop) {
  const r = 48;
  const start = isTop ? Math.PI : 0;
  const end = isTop ? Math.PI * 2 : Math.PI;

  // Peel
  ctx.beginPath();
  ctx.arc(0, 0, r, start, end);
  ctx.closePath();
  ctx.fillStyle = '#EA580C';
  ctx.fill();

  // White pith
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.90, start, end);
  ctx.closePath();
  ctx.fillStyle = '#FED7AA';
  ctx.fill();

  // Mandarin pulp
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.84, start, end);
  ctx.closePath();
  ctx.fillStyle = '#F97316';
  ctx.fill();

  // Radial pith rays
  ctx.strokeStyle = '#FFF7ED';
  ctx.lineWidth = 1.8;
  const segs = [0.36, 0.76, 1.16, 1.57, 1.98, 2.38, 2.78];
  for (let i = 0; i < segs.length; i++) {
    const a = isTop ? Math.PI + segs[i] : segs[i];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
    ctx.stroke();
  }

  // Center core star
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, start, end);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
}

// -------------------------------------------------------------
// 4. BANANA
// -------------------------------------------------------------
function drawBananaWhole(ctx) {
  const r = 50;

  // Outer curved yellow body
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, r * 0.4);
  ctx.quadraticCurveTo(0, -r * 0.78, r * 0.98, -r * 0.12);
  ctx.quadraticCurveTo(r * 0.76, r * 0.52, -r * 0.9, r * 0.4);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, -r * 0.5, 0, r * 0.5);
  grad.addColorStop(0, '#FEF08A');
  grad.addColorStop(0.5, '#FACC15');
  grad.addColorStop(1, '#CA8A04');
  ctx.fillStyle = grad;
  ctx.fill();

  // Facet ridge line
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, r * 0.35);
  ctx.quadraticCurveTo(0, -r * 0.48, r * 0.88, -0.02);
  ctx.strokeStyle = '#A16207';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Green stem end
  ctx.beginPath();
  ctx.arc(-r * 0.9, r * 0.4, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#65A30D';
  ctx.fill();

  // Brown base tip
  ctx.beginPath();
  ctx.arc(r * 0.98, -r * 0.12, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#451A03';
  ctx.fill();
}

function drawBananaHalf(ctx, isTop) {
  const r = 48;
  const start = isTop ? Math.PI : 0;
  const end = isTop ? Math.PI * 2 : Math.PI;

  ctx.beginPath();
  ctx.arc(0, 0, r, start, end);
  ctx.closePath();
  ctx.fillStyle = '#FACC15';
  ctx.fill();

  // Vanilla meat
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, start, end);
  ctx.closePath();
  ctx.fillStyle = '#FEF9C3';
  ctx.fill();

  // Center core dots
  const ySign = isTop ? -1 : 1;
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.arc(-5, ySign * r * 0.28, 1.6, 0, Math.PI * 2);
  ctx.arc(5, ySign * r * 0.28, 1.6, 0, Math.PI * 2);
  ctx.arc(0, ySign * r * 0.42, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

// -------------------------------------------------------------
// 5. PINEAPPLE
// -------------------------------------------------------------
function drawPineappleWhole(ctx) {
  const r = 50;

  // Body oval
  const bodyGrad = ctx.createRadialGradient(-15, -10, 8, 0, 10, r * 0.95);
  bodyGrad.addColorStop(0, '#FDE047');
  bodyGrad.addColorStop(0.35, '#F59E0B');
  bodyGrad.addColorStop(0.75, '#D97706');
  bodyGrad.addColorStop(1, '#78350F');

  ctx.beginPath();
  ctx.ellipse(0, 8, r * 0.72, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Diamond scale lattice grid
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)';
  ctx.lineWidth = 2.2;
  const rows = [-0.6, -0.3, 0.0, 0.3, 0.6];
  for (let row of rows) {
    const y = 8 + row * r * 0.85;
    ctx.beginPath();
    ctx.moveTo(-r * 0.65, y);
    ctx.lineTo(r * 0.65, y);
    ctx.stroke();
  }

  // Diamond prickly eyes
  ctx.fillStyle = '#78350F';
  const eyes = [
    [-15, -12], [15, -12], [0, 0],
    [-18, 15], [18, 15], [0, 28]
  ];
  for (let eye of eyes) {
    ctx.beginPath();
    ctx.arc(eye[0], eye[1] + 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spiky crown leaves on top
  ctx.fillStyle = '#15803D';
  const leaves = [
    [0, -r * 0.8, -r * 1.45, 0],
    [-16, -r * 0.7, -r * 1.35, -14],
    [16, -r * 0.7, -r * 1.35, 14],
    [-28, -r * 0.6, -r * 1.15, -24],
    [28, -r * 0.6, -r * 1.15, 24],
  ];
  for (let leaf of leaves) {
    ctx.beginPath();
    ctx.moveTo(leaf[0], leaf[1]);
    ctx.quadraticCurveTo(leaf[3] * 0.5, leaf[2] * 0.9, leaf[3], leaf[2]);
    ctx.quadraticCurveTo(leaf[3] * 0.8, leaf[1] * 0.9, leaf[0] + 6, leaf[1]);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPineappleHalf(ctx, isTop) {
  const r = 52;
  const start = isTop ? Math.PI : 0;
  const end = isTop ? Math.PI * 2 : Math.PI;

  // Prickly brown peel
  ctx.beginPath();
  ctx.arc(0, 0, r, start, end);
  ctx.closePath();
  ctx.fillStyle = '#78350F';
  ctx.fill();

  // Vibrant golden meat
  const meatGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 0.88);
  meatGrad.addColorStop(0, '#FEF08A');
  meatGrad.addColorStop(0.45, '#FBBF24');
  meatGrad.addColorStop(1, '#F59E0B');

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, start, end);
  ctx.closePath();
  ctx.fillStyle = meatGrad;
  ctx.fill();

  // Radiating fiber rays
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
  ctx.lineWidth = 1.6;
  for (let i = 1; i <= 8; i++) {
    const a = start + (i / 9) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84);
    ctx.stroke();
  }

  // Circular core
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, start, end);
  ctx.fillStyle = '#FDE047';
  ctx.fill();
}

// -------------------------------------------------------------
// 6. STRAWBERRY
// -------------------------------------------------------------
function drawStrawberryWhole(ctx) {
  const r = 44;
  const grad = ctx.createRadialGradient(-12, -14, 5, 0, 0, r);
  grad.addColorStop(0, '#FB7185');
  grad.addColorStop(0.4, '#E11D48');
  grad.addColorStop(0.85, '#BE123C');
  grad.addColorStop(1, '#881337');

  ctx.beginPath();
  ctx.moveTo(0, r * 1.05);
  ctx.bezierCurveTo(-r * 0.65, r * 0.72, -r * 1.02, 0, -r * 0.75, -r * 0.55);
  ctx.bezierCurveTo(-r * 0.42, -r * 0.9, 0, -r * 0.7, 0, -r * 0.55);
  ctx.bezierCurveTo(0, -r * 0.7, r * 0.42, -r * 0.9, r * 0.75, -r * 0.55);
  ctx.bezierCurveTo(r * 1.02, 0, r * 0.65, r * 0.72, 0, r * 1.05);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Golden seeds
  ctx.fillStyle = '#FEF08A';
  const seeds = [
    [0, r * 0.55], [-r * 0.32, r * 0.3], [r * 0.32, r * 0.3],
    [-r * 0.48, -r * 0.12], [0, 0], [r * 0.48, -r * 0.12],
    [-r * 0.26, -r * 0.34], [r * 0.26, -r * 0.34]
  ];
  for (let s of seeds) {
    ctx.beginPath();
    ctx.ellipse(s[0], s[1], 1.4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Calyx green leafy cap
  ctx.fillStyle = '#16A34A';
  ctx.beginPath();
  ctx.moveTo(-r * 0.65, -r * 0.6);
  ctx.lineTo(-r * 0.25, -r * 0.85);
  ctx.lineTo(0, -r * 0.55);
  ctx.lineTo(r * 0.25, -r * 0.85);
  ctx.lineTo(r * 0.65, -r * 0.6);
  ctx.lineTo(0, -r * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawStrawberryHalf(ctx, isTop) {
  const r = 44;
  const start = isTop ? Math.PI : 0;
  const end = isTop ? Math.PI * 2 : Math.PI;

  ctx.beginPath();
  ctx.arc(0, 0, r, start, end);
  ctx.closePath();
  ctx.fillStyle = '#E11D48';
  ctx.fill();

  // Pinkish flesh
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, start, end);
  ctx.closePath();
  ctx.fillStyle = '#FB7185';
  ctx.fill();

  // Capillary rays
  const ySign = isTop ? -1 : 1;
  ctx.strokeStyle = '#FDF2F8';
  ctx.lineWidth = 1.6;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(i * 7, ySign * r * 0.65);
    ctx.stroke();
  }
}

// -------------------------------------------------------------
// 7. DRAGON FRUIT (Pitaya)
// -------------------------------------------------------------
function drawDragonFruitWhole(ctx) {
  const r = 50;

  // Magenta body
  const grad = ctx.createRadialGradient(-12, -14, 6, 0, 0, r);
  grad.addColorStop(0, '#F43F5E');
  grad.addColorStop(0.35, '#E11D48');
  grad.addColorStop(0.75, '#BE185D');
  grad.addColorStop(1, '#701A75');

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Curling green-tipped scale bracts
  const bracts = [
    [-r * 0.82, -r * 0.45, -Math.PI * 0.75],
    [r * 0.82, -r * 0.45, -Math.PI * 0.25],
    [-r * 0.92, r * 0.15, -Math.PI * 0.95],
    [r * 0.92, r * 0.15, -Math.PI * 0.05],
    [-r * 0.65, r * 0.65, Math.PI * 0.75],
    [r * 0.65, r * 0.65, Math.PI * 0.25],
    [0, -r * 0.98, -Math.PI * 0.5],
  ];

  for (let b of bracts) {
    ctx.save();
    ctx.translate(b[0], b[1]);
    ctx.rotate(b[2]);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-6, -14, 0, -22);
    ctx.quadraticCurveTo(6, -14, 0, 0);
    ctx.closePath();
    ctx.fillStyle = '#84CC16'; // Lime green scale tip
    ctx.fill();

    ctx.restore();
  }
}

function drawDragonFruitHalf(ctx, isTop) {
  const r = 50;
  const start = isTop ? Math.PI : 0;
  const end = isTop ? Math.PI * 2 : Math.PI;

  // Magenta rind
  ctx.beginPath();
  ctx.arc(0, 0, r, start, end);
  ctx.closePath();
  ctx.fillStyle = '#DB2777';
  ctx.fill();

  // White pulp layer
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, start, end);
  ctx.closePath();
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();

  // Crunchy black seed specks
  ctx.fillStyle = '#0F172A';
  const ySign = isTop ? -1 : 1;
  const seeds = [
    [-r * 0.5, ySign * r * 0.25], [-r * 0.25, ySign * r * 0.45],
    [0, ySign * r * 0.2], [r * 0.25, ySign * r * 0.45], [r * 0.5, ySign * r * 0.25],
    [-r * 0.35, ySign * r * 0.6], [r * 0.35, ySign * r * 0.6],
    [-r * 0.15, ySign * r * 0.7], [r * 0.15, ySign * r * 0.7]
  ];
  for (let s of seeds) {
    ctx.beginPath();
    ctx.arc(s[0], s[1], 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// -------------------------------------------------------------
// 8. COCONUT
// -------------------------------------------------------------
function drawCoconutWhole(ctx) {
  const r = 48;
  const grad = ctx.createRadialGradient(-14, -16, 6, 0, 0, r);
  grad.addColorStop(0, '#A16207');
  grad.addColorStop(0.4, '#78350F');
  grad.addColorStop(0.85, '#451A03');
  grad.addColorStop(1, '#291809');

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Fiber striations
  ctx.strokeStyle = 'rgba(69, 26, 3, 0.45)';
  ctx.lineWidth = 1.8;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(i * 8, r * 0.2, 4, r * 0.45, 0, 0, Math.PI);
    ctx.stroke();
  }

  // 3 germination eyes
  ctx.fillStyle = '#291809';
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.25, 4.8, 0, Math.PI * 2);
  ctx.arc(r * 0.28, -r * 0.25, 4.8, 0, Math.PI * 2);
  ctx.arc(0, -r * 0.05, 4.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoconutHalf(ctx, isTop) {
  const r = 48;
  const start = isTop ? Math.PI : 0;
  const end = isTop ? Math.PI * 2 : Math.PI;

  // Brown shell
  ctx.beginPath();
  ctx.arc(0, 0, r, start, end);
  ctx.closePath();
  ctx.fillStyle = '#78350F';
  ctx.fill();

  // White coconut meat
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, start, end);
  ctx.closePath();
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();

  // Dark hollow cavity
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, start, end);
  ctx.closePath();
  ctx.fillStyle = '#1C1917';
  ctx.fill();
}

// -------------------------------------------------------------
// 9. KIWI
// -------------------------------------------------------------
function drawKiwiWhole(ctx) {
  const r = 44;
  // Brown fuzzy oval body
  const grad = ctx.createRadialGradient(-10, -12, 5, 0, 0, r);
  grad.addColorStop(0, '#B45309');
  grad.addColorStop(0.35, '#92400E');
  grad.addColorStop(0.75, '#78350F');
  grad.addColorStop(1, '#451A03');

  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.88, r * 1.02, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Fine bristle fuzz texture around outer rind
  ctx.strokeStyle = 'rgba(69, 26, 3, 0.45)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const ex = Math.cos(a) * r * 0.88;
    const ey = Math.sin(a) * r * 1.02;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + Math.cos(a) * 3.5, ey + Math.sin(a) * 3.5);
    ctx.stroke();
  }

  // Woody stem button at top pole
  ctx.beginPath();
  ctx.arc(0, -r * 0.98, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#291809';
  ctx.fill();
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawKiwiHalf(ctx, isTop) {
  const r = 44;
  const start = isTop ? Math.PI : 0;
  const end = isTop ? Math.PI * 2 : Math.PI;

  // Fuzzy brown outer skin
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.88, r * 1.02, 0, start, end);
  ctx.closePath();
  ctx.fillStyle = '#78350F';
  ctx.fill();

  // Lime green rind edge ring
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.84, r * 0.97, 0, start, end);
  ctx.closePath();
  ctx.fillStyle = '#A3E635';
  ctx.fill();

  // Translucent emerald pulp gradient
  const pulpGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, r * 0.92);
  pulpGrad.addColorStop(0, '#84CC16');
  pulpGrad.addColorStop(0.4, '#4ADE80');
  pulpGrad.addColorStop(0.8, '#22C55E');
  pulpGrad.addColorStop(1, '#15803D');

  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.80, r * 0.93, 0, start, end);
  ctx.closePath();
  ctx.fillStyle = pulpGrad;
  ctx.fill();

  // Radiating delicate creamy starburst rays
  ctx.strokeStyle = 'rgba(254, 249, 195, 0.45)';
  ctx.lineWidth = 1.4;
  const rayCount = 14;
  for (let i = 1; i < rayCount; i++) {
    const a = start + (i / rayCount) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.25);
    ctx.lineTo(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.78);
    ctx.stroke();
  }

  // Ring of tiny black kiwi seeds
  ctx.fillStyle = '#0F172A';
  const seedCount = 12;
  for (let i = 1; i < seedCount; i++) {
    const a = start + (i / seedCount) * Math.PI;
    const sx = Math.cos(a) * r * 0.44 + (Math.sin(i * 3.7) * 2.5);
    const sy = Math.sin(a) * r * 0.50 + (Math.cos(i * 3.7) * 2.5);
    ctx.beginPath();
    ctx.ellipse(sx, sy, 1.2, 2.0, a, 0, Math.PI * 2);
    ctx.fill();
  }

  // Creamy pale-yellow oval core
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.22, r * 0.26, 0, start, end);
  ctx.closePath();
  ctx.fillStyle = '#FEF9C3';
  ctx.fill();
}

// -------------------------------------------------------------
// 10. PEACH
// -------------------------------------------------------------
function drawPeachWhole(ctx) {
  const r = 46;

  // Velvety blush radial gradient
  const grad = ctx.createRadialGradient(-r * 0.28, -r * 0.32, 6, 0, 0, r);
  grad.addColorStop(0, '#FEF08A');
  grad.addColorStop(0.30, '#FDBA74');
  grad.addColorStop(0.65, '#FB7185');
  grad.addColorStop(0.88, '#F43F5E');
  grad.addColorStop(1, '#BE123C');

  // Heart-like iconic peach silhouette with top cleft indent
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.72);
  // Left cheek
  ctx.bezierCurveTo(-r * 0.55, -r * 1.02, -r * 1.15, -r * 0.28, -r * 0.92, r * 0.45);
  ctx.bezierCurveTo(-r * 0.72, r * 0.98, -r * 0.25, r * 1.05, 0, r * 0.98);
  // Right cheek
  ctx.bezierCurveTo(r * 0.25, r * 1.05, r * 0.72, r * 0.98, r * 0.92, r * 0.45);
  ctx.bezierCurveTo(r * 1.15, -r * 0.28, r * 0.55, -r * 1.02, 0, -r * 0.72);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle curved peach suture cleft crease line
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.72);
  ctx.quadraticCurveTo(-r * 0.15, 0, 0, r * 0.98);
  ctx.strokeStyle = 'rgba(190, 18, 60, 0.35)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Velvety soft peach sheen
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.28, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fill();

  // Small woody stem at cleft
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.72);
  ctx.quadraticCurveTo(3, -r * 0.88, 5, -r * 0.95);
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 2.8;
  ctx.stroke();

  // Fresh green peach leaf sprouting from stem
  ctx.fillStyle = '#16A34A';
  ctx.beginPath();
  ctx.moveTo(3, -r * 0.85);
  ctx.quadraticCurveTo(16, -r * 1.08, 22, -r * 0.88);
  ctx.quadraticCurveTo(14, -r * 0.74, 3, -r * 0.85);
  ctx.closePath();
  ctx.fill();
}

function drawPeachHalf(ctx, isTop) {
  const r = 46;
  const start = isTop ? Math.PI : 0;
  const end = isTop ? Math.PI * 2 : Math.PI;

  // Velvety blush outer skin rind
  ctx.beginPath();
  ctx.arc(0, 0, r, start, end);
  ctx.closePath();
  ctx.fillStyle = '#E11D48';
  ctx.fill();

  // Juicy golden amber/peach pulp gradient
  const meatGrad = ctx.createRadialGradient(0, isTop ? -10 : 10, 5, 0, 0, r * 0.92);
  meatGrad.addColorStop(0, '#FEF08A');
  meatGrad.addColorStop(0.35, '#FED7AA');
  meatGrad.addColorStop(0.70, '#FDBA74');
  meatGrad.addColorStop(1, '#FB923C');

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.91, start, end);
  ctx.closePath();
  ctx.fillStyle = meatGrad;
  ctx.fill();

  // Crimson/ruby radial starburst fibers radiating around pit
  ctx.strokeStyle = '#BE123C';
  ctx.lineWidth = 1.6;
  for (let i = 1; i <= 7; i++) {
    const a = start + (i / 8) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28);
    ctx.lineTo(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58);
    ctx.stroke();
  }

  // Craggy textured mahogany pit (on top half) or indented cavity (on bottom half)
  if (isTop) {
    const pitGrad = ctx.createRadialGradient(0, -r * 0.15, 2, 0, -r * 0.15, r * 0.28);
    pitGrad.addColorStop(0, '#92400E');
    pitGrad.addColorStop(0.5, '#78350F');
    pitGrad.addColorStop(1, '#451A03');

    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.26, r * 0.32, 0, start, end);
    ctx.closePath();
    ctx.fillStyle = pitGrad;
    ctx.fill();

    // Pit craggy ridges
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, -r * 0.14, r * 0.16, start, end);
    ctx.stroke();
  } else {
    // Indented pit cavity with deep ruby glow
    const cavityGrad = ctx.createRadialGradient(0, 5, 2, 0, 10, r * 0.30);
    cavityGrad.addColorStop(0, '#9F1239');
    cavityGrad.addColorStop(0.7, '#881337');
    cavityGrad.addColorStop(1, '#4C0519');

    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.26, r * 0.32, 0, start, end);
    ctx.closePath();
    ctx.fillStyle = cavityGrad;
    ctx.fill();
  }
}

// -------------------------------------------------------------
// SPRITE GENERATOR & REGISTRY
// -------------------------------------------------------------
export function initializeFruitSprites() {
  if (spriteCache.size > 0) return spriteCache;

  const renderers = {
    [FRUIT_TYPES.WATERMELON]: {
      whole: drawWatermelonWhole,
      left: (ctx) => drawWatermelonHalf(ctx, true),
      right: (ctx) => drawWatermelonHalf(ctx, false),
    },
    [FRUIT_TYPES.APPLE]: {
      whole: drawAppleWhole,
      left: (ctx) => drawAppleHalf(ctx, true),
      right: (ctx) => drawAppleHalf(ctx, false),
    },
    [FRUIT_TYPES.ORANGE]: {
      whole: drawOrangeWhole,
      left: (ctx) => drawOrangeHalf(ctx, true),
      right: (ctx) => drawOrangeHalf(ctx, false),
    },
    [FRUIT_TYPES.BANANA]: {
      whole: drawBananaWhole,
      left: (ctx) => drawBananaHalf(ctx, true),
      right: (ctx) => drawBananaHalf(ctx, false),
    },
    [FRUIT_TYPES.PINEAPPLE]: {
      whole: drawPineappleWhole,
      left: (ctx) => drawPineappleHalf(ctx, true),
      right: (ctx) => drawPineappleHalf(ctx, false),
    },
    [FRUIT_TYPES.STRAWBERRY]: {
      whole: drawStrawberryWhole,
      left: (ctx) => drawStrawberryHalf(ctx, true),
      right: (ctx) => drawStrawberryHalf(ctx, false),
    },
    [FRUIT_TYPES.DRAGON_FRUIT]: {
      whole: drawDragonFruitWhole,
      left: (ctx) => drawDragonFruitHalf(ctx, true),
      right: (ctx) => drawDragonFruitHalf(ctx, false),
    },
    [FRUIT_TYPES.COCONUT]: {
      whole: drawCoconutWhole,
      left: (ctx) => drawCoconutHalf(ctx, true),
      right: (ctx) => drawCoconutHalf(ctx, false),
    },
    [FRUIT_TYPES.KIWI]: {
      whole: drawKiwiWhole,
      left: (ctx) => drawKiwiHalf(ctx, true),
      right: (ctx) => drawKiwiHalf(ctx, false),
    },
    [FRUIT_TYPES.PEACH]: {
      whole: drawPeachWhole,
      left: (ctx) => drawPeachHalf(ctx, true),
      right: (ctx) => drawPeachHalf(ctx, false),
    },
  };

  for (const [type, drawFns] of Object.entries(renderers)) {
    const states = {};

    for (const [state, drawFn] of Object.entries(drawFns)) {
      const canvas = createOffscreenCanvas();
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.save();
        ctx.translate(HALF_SIZE, HALF_SIZE);
        ctx.scale(SPRITE_SCALE, SPRITE_SCALE);
        drawFn(ctx);
        ctx.restore();
        states[state] = canvas;
      }
    }

    spriteCache.set(type, states);
  }

  return spriteCache;
}

export function getFruitSprite(type, state = 'whole') {
  if (spriteCache.size === 0) {
    initializeFruitSprites();
  }
  const fruitStates = spriteCache.get(type);
  return fruitStates ? fruitStates[state] : null;
}
