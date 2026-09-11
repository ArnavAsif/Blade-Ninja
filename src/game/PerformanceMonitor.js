/**
 * PerformanceMonitor
 *
 * Adaptive real-time frame rate monitor and quality coordinator.
 * Automatically detects weak devices and drops secondary visual load
 * to ensure a locked, silky-smooth 60 FPS without impacting gameplay.
 *
 * Guaranteed invariants:
 * - Never reduces gameplay responsiveness
 * - Never reduces fruit visibility or physics
 * - Never degrades collision accuracy
 * - Never degrades blade responsiveness
 *
 * Zero allocations per frame. Zero emojis.
 */

export const QUALITY_TIERS = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

const BUFFER_SIZE = 60;

export class PerformanceMonitor {
  constructor() {
    this.frameTimes = new Float32Array(BUFFER_SIZE);
    this.bufferIndex = 0;
    this.sampleCount = 0;
    this.runningTotal = 0;

    this.currentFps = 60.0;
    this.qualityTier = QUALITY_TIERS.HIGH;

    // Hysteresis timers to prevent rapid oscillation between tiers
    this.lowFpsDuration = 0;
    this.highFpsDuration = 0;

    this.listeners = new Set();
  }

  /**
   * Records delta time of completed frame and updates smoothed FPS.
   */
  recordFrame(dt) {
    if (dt <= 0 || !this.frameTimes || this.frameTimes.length === 0) return;
    const clampedDt = Math.min(dt, 0.25);

    // Maintain running ring-buffer sum in O(1)
    if (this.sampleCount >= BUFFER_SIZE) {
      this.runningTotal -= this.frameTimes[this.bufferIndex];
    } else {
      this.sampleCount++;
    }

    this.frameTimes[this.bufferIndex] = clampedDt;
    this.runningTotal += clampedDt;
    this.bufferIndex = (this.bufferIndex + 1) % BUFFER_SIZE;

    const avgFrameTime = this.runningTotal / this.sampleCount;
    this.currentFps = avgFrameTime > 0 ? 1 / avgFrameTime : 60;

    // Evaluate quality tier adjustment
    this.evaluateQuality(clampedDt);
  }

  evaluateQuality(dt) {
    if (this.sampleCount < 20) return;

    if (this.currentFps < 42) {
      this.lowFpsDuration += dt;
      this.highFpsDuration = 0;
      if (this.lowFpsDuration >= 1.8 && this.qualityTier !== QUALITY_TIERS.LOW) {
        this.setTier(QUALITY_TIERS.LOW);
      }
    } else if (this.currentFps < 52) {
      this.lowFpsDuration += dt;
      this.highFpsDuration = 0;
      if (this.lowFpsDuration >= 1.4 && this.qualityTier === QUALITY_TIERS.HIGH) {
        this.setTier(QUALITY_TIERS.MEDIUM);
      }
    } else if (this.currentFps >= 57) {
      this.highFpsDuration += dt;
      this.lowFpsDuration = 0;

      // Hysteresis: require 8 continuous seconds of rock-solid 60 FPS before upgrading
      if (this.highFpsDuration >= 8.0) {
        if (this.qualityTier === QUALITY_TIERS.LOW) {
          this.setTier(QUALITY_TIERS.MEDIUM);
        } else if (this.qualityTier === QUALITY_TIERS.MEDIUM) {
          this.setTier(QUALITY_TIERS.HIGH);
        }
        this.highFpsDuration = 0;
      }
    } else {
      // Nominal zone (52 - 57 FPS)
      this.lowFpsDuration = 0;
      this.highFpsDuration = 0;
    }
  }

  setTier(newTier) {
    if (this.qualityTier === newTier) return;
    const prev = this.qualityTier;
    this.qualityTier = newTier;
    this.lowFpsDuration = 0;
    this.notifyListeners(newTier, prev);
  }

  getQualityTier() {
    return this.qualityTier;
  }

  getFps() {
    return Math.round(this.currentFps);
  }

  /**
   * Maximum active particle pool capacity based on current tier.
   */
  getMaxActiveParticles() {
    switch (this.qualityTier) {
      case QUALITY_TIERS.LOW:
        return 70;
      case QUALITY_TIERS.MEDIUM:
        return 130;
      case QUALITY_TIERS.HIGH:
      default:
        return 220;
    }
  }

  /**
   * Per-frame particle spawn limit to eliminate micro-stutter spikes.
   */
  getFrameSpawnBudget() {
    switch (this.qualityTier) {
      case QUALITY_TIERS.LOW:
        return 16;
      case QUALITY_TIERS.MEDIUM:
        return 32;
      case QUALITY_TIERS.HIGH:
      default:
        return 60;
    }
  }

  /**
   * Background ambient particle count (Layer 5).
   */
  getBackgroundParticleCount() {
    switch (this.qualityTier) {
      case QUALITY_TIERS.LOW:
        return 8;
      case QUALITY_TIERS.MEDIUM:
        return 16;
      case QUALITY_TIERS.HIGH:
      default:
        return 28;
    }
  }

  /**
   * Whether high-velocity blade friction sparks should spawn.
   */
  canSpawnSparks() {
    return this.qualityTier !== QUALITY_TIERS.LOW;
  }

  /**
   * Safe device pixel ratio cap for device.
   */
  getDprCap() {
    return this.qualityTier === QUALITY_TIERS.LOW ? 1.5 : 2.0;
  }

  subscribeQuality(listener) {
    this.listeners.add(listener);
    try {
      listener(this.qualityTier);
    } catch (err) {
      console.error('Error in PerformanceMonitor listener:', err);
    }
    return () => this.listeners.delete(listener);
  }

  notifyListeners(tier, prev) {
    for (const listener of this.listeners) {
      try {
        listener(tier, prev);
      } catch (err) {
        console.error('Error in PerformanceMonitor listener:', err);
      }
    }
  }

  reset() {
    this.sampleCount = 0;
    this.bufferIndex = 0;
    this.runningTotal = 0;
    this.lowFpsDuration = 0;
    this.highFpsDuration = 0;
    this.frameTimes.fill(0);
    this.currentFps = 60.0;
  }

  destroy() {
    this.listeners.clear();
    this.frameTimes = new Float32Array(0);
  }
}
