/**
 * High-performance Bomb hazard entity with authentic arcade ballistics,
 * metallic radial shading, hazard bands, and animated burning fuse sparks.
 */

let cachedBombCanvas = null;
const BOMB_SCALE = 2.0;
const BOMB_LOGICAL_SIZE = 128;
const BOMB_CANVAS_SIZE = BOMB_LOGICAL_SIZE * BOMB_SCALE; // 256
const BOMB_ORIGIN_X = 64;
const BOMB_ORIGIN_Y = 74;

function getCachedBombSprite(radius) {
  if (cachedBombCanvas) return cachedBombCanvas;
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = BOMB_CANVAS_SIZE;
  canvas.height = BOMB_CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(BOMB_ORIGIN_X * BOMB_SCALE, BOMB_ORIGIN_Y * BOMB_SCALE);
  ctx.scale(BOMB_SCALE, BOMB_SCALE);
  const r = radius;

  // 1. Charcoal iron sphere with metallic radial gradient
  const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 4, 0, 0, r);
  bodyGrad.addColorStop(0, '#64748B');
  bodyGrad.addColorStop(0.3, '#334155');
  bodyGrad.addColorStop(0.7, '#1E293B');
  bodyGrad.addColorStop(1, '#090D16');

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // 2. Crimson hazard ring
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.94, r * 0.32, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Hazard rivets
  ctx.fillStyle = '#F8FAFC';
  const rivetAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  for (let i = 0; i < rivetAngles.length; i++) {
    const a = rivetAngles[i];
    const rx = Math.cos(a) * r * 0.88;
    const ry = Math.sin(a) * r * 0.30;
    ctx.beginPath();
    ctx.arc(rx, ry, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Specular upper-left gleam
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.38, r * 0.32, r * 0.16, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fill();

  // 4. Brass neck collar
  ctx.beginPath();
  ctx.rect(-r * 0.22, -r - 4, r * 0.44, 6);
  ctx.fillStyle = '#D97706';
  ctx.fill();
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 5. Arched wick/fuse cord
  ctx.beginPath();
  ctx.moveTo(0, -r - 4);
  ctx.quadraticCurveTo(8, -r - 14, 16, -r - 18);
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  cachedBombCanvas = canvas;
  return cachedBombCanvas;
}

export class Bomb {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 980;
    this.radius = 34;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.fuseTimer = 0;
    this.active = false;
    this.exploded = false;
    this.spawnTime = 0;
    this.hasReachedApex = false;
  }

  reset(x, y, vx, vy, gravity, rotationSpeed, spawnTime = performance.now()) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.radius = 34;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = rotationSpeed;
    this.fuseTimer = 0;
    this.active = true;
    this.exploded = false;
    this.spawnTime = spawnTime;
    this.hasReachedApex = false;
  }

  update(dt, screenWidth, screenHeight) {
    if (!this.active) return;

    // Apply gravity acceleration
    this.vy += this.gravity * dt;

    // Position integration
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Rotation and fuse progression
    this.rotation += this.rotationSpeed * dt;
    this.fuseTimer += dt;

    // Apex detection
    if (!this.hasReachedApex && this.vy >= 0) {
      this.hasReachedApex = true;
    }

    // Deactivate when fallen below viewport
    const bottomThreshold = screenHeight + this.radius * 2 + 50;
    if (this.hasReachedApex && this.y > bottomThreshold) {
      this.active = false;
      return;
    }

    // Horizontal bounds cleanup
    if (this.x < -120 || this.x > screenWidth + 120) {
      if (this.y > screenHeight * 0.5) {
        this.active = false;
      }
    }
  }

  render(ctx) {
    if (!this.active || this.exploded) return;

    const r = this.radius;

    // Transformed bomb entity
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Blit pre-rasterized static bomb sprite at logical dimensions with natural drop shadow
    const sprite = getCachedBombSprite(r);
    if (sprite) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 6;

      ctx.drawImage(
        sprite,
        -BOMB_ORIGIN_X,
        -BOMB_ORIGIN_Y,
        BOMB_LOGICAL_SIZE,
        BOMB_LOGICAL_SIZE
      );

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else {
      // Fallback
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#1E293B';
      ctx.fill();
    }

    // 3. Active animated burning spark at fuse tip
    const sparkX = 16;
    const sparkY = -r - 18;
    const flicker = Math.sin(this.fuseTimer * 28);
    const sparkRadius = 4.5 + flicker * 1.5;

    // Outer flame glow
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, sparkRadius * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.fill();

    // Yellow-orange flame core
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, sparkRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#F59E0B';
    ctx.fill();

    // White hot spark center
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, sparkRadius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.restore();
  }
}
