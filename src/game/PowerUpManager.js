/**
 * PowerUpManager manages power-up activations, durations, physics modulation,
 * balanced spawn pacing, and event broadcasts to audio, VFX, and UI subscribers.
 */

import { POWER_UP_TYPES, POWER_UP_CONFIGS } from '../assets/PowerUpSprites.js';
import { randomRange, randomChoice } from '../utils/math.js';

export { POWER_UP_TYPES, POWER_UP_CONFIGS };

export class PowerUpManager {
  constructor() {
    this.activePowerUps = new Map(); // type -> { type, duration, remainingTime, config }
    this.subscribers = new Set();
    this.timeSinceLastNotify = 0;
    this.notifyInterval = 0.08; // 12Hz throttle for smooth countdown without 60fps React thrashing

    // Spawning pacing & balance configuration
    this.spawnCooldown = 20.0; // Initial delay before first power-up can appear
    this.minCooldown = 20.0;
    this.maxCooldown = 30.0;

    // Callbacks
    this.onActivate = null;
    this.onExpire = null;

    this.gameState = null;
  }

  setGameState(gameState) {
    this.gameState = gameState;
  }

  /**
   * Evaluates if a power-up can spawn on the current wave.
   * Power-ups appear rarely to maintain arcade balance.
   */
  canSpawnPowerUp(hasActiveOnScreen = false) {
    if (hasActiveOnScreen) return false;
    if (this.spawnCooldown > 0) return false;
    if (this.isFrenzyActive()) return false; // Prevent compounding chaos during Frenzy
    return true;
  }

  /**
   * Resets spawn cooldown after a power-up launches.
   */
  consumeSpawnOpportunity() {
    this.spawnCooldown = randomRange(this.minCooldown, this.maxCooldown);
  }

  /**
   * Selects a balanced power-up variety tailored to player state.
   */
  selectPowerUpType() {
    const hasLostLives =
      this.gameState &&
      this.gameState.hasLives &&
      this.gameState.hasLives() &&
      this.gameState.lives < this.gameState.maxLives;

    const hasNoLives =
      this.gameState &&
      this.gameState.hasLives &&
      !this.gameState.hasLives();

    const pool = [];

    // Base chances
    pool.push(POWER_UP_TYPES.SLOW_MOTION, POWER_UP_TYPES.SLOW_MOTION);
    pool.push(POWER_UP_TYPES.FRENZY, POWER_UP_TYPES.FRENZY);
    pool.push(POWER_UP_TYPES.DOUBLE_SCORE, POWER_UP_TYPES.DOUBLE_SCORE);
    pool.push(POWER_UP_TYPES.BLADE_BOOST, POWER_UP_TYPES.BLADE_BOOST);

    if (hasLostLives) {
      // Prioritize life restore if player is missing lives
      pool.push(POWER_UP_TYPES.LIFE_RESTORE, POWER_UP_TYPES.LIFE_RESTORE, POWER_UP_TYPES.LIFE_RESTORE);
    } else if (!hasNoLives) {
      // If healthy, rare chance for bonus life
      pool.push(POWER_UP_TYPES.LIFE_RESTORE);
    }

    return randomChoice(pool) || POWER_UP_TYPES.SLOW_MOTION;
  }

  /**
   * Activates a power-up by type.
   */
  activate(type) {
    const config = POWER_UP_CONFIGS[type];
    if (!config) return;

    if (config.duration <= 0) {
      // Instant power-up (e.g. Life Restore)
      if (this.onActivate) {
        this.onActivate(type, config, true);
      }
      this.notifySubscribers();
      return;
    }

    const existing = this.activePowerUps.get(type);
    if (existing) {
      // Extend or reset duration up to max cap (e.g. duration * 1.8)
      const maxCap = config.duration * 1.8;
      existing.remainingTime = Math.min(maxCap, existing.remainingTime + config.duration * 0.75);
      existing.duration = Math.max(existing.duration, existing.remainingTime);
    } else {
      this.activePowerUps.set(type, {
        type,
        duration: config.duration,
        remainingTime: config.duration,
        config,
      });
    }

    if (this.onActivate) {
      this.onActivate(type, config, false);
    }

    this.notifySubscribers();
  }

  update(dt) {
    // 1. Progress spawn cooldown timer
    if (this.spawnCooldown > 0) {
      this.spawnCooldown = Math.max(0, this.spawnCooldown - dt);
    }

    // 2. Count down active power-ups
    if (this.activePowerUps.size === 0) return;

    let membershipChanged = false;
    for (const [type, entry] of this.activePowerUps.entries()) {
      entry.remainingTime -= dt;
      if (entry.remainingTime <= 0) {
        this.activePowerUps.delete(type);
        membershipChanged = true;
        if (this.onExpire) {
          this.onExpire(type, entry.config);
        }
      }
    }

    this.timeSinceLastNotify += dt;
    // Notify immediately on membership change (power-up added/expired) or throttled at ~12Hz for smooth countdown without 60fps React thrashing
    if (membershipChanged || this.timeSinceLastNotify >= this.notifyInterval) {
      this.timeSinceLastNotify = 0;
      this.notifySubscribers();
    }
  }

  // --- QUERY HELPERS ---

  isSlowMotionActive() {
    const active = this.activePowerUps.has(POWER_UP_TYPES.SLOW_MOTION);
    return {
      active,
      factor: active ? 0.40 : 1.0,
    };
  }

  isFrenzyActive() {
    return this.activePowerUps.has(POWER_UP_TYPES.FRENZY);
  }

  isDoubleScoreActive() {
    return this.activePowerUps.has(POWER_UP_TYPES.DOUBLE_SCORE);
  }

  getScoreMultiplier() {
    return this.isDoubleScoreActive() ? 2 : 1;
  }

  isBladeBoostActive() {
    return this.activePowerUps.has(POWER_UP_TYPES.BLADE_BOOST);
  }

  /**
   * Returns list of currently active timed power-ups with normalized progress (0.0 to 1.0).
   */
  getActivePowerUps() {
    const list = [];
    for (const entry of this.activePowerUps.values()) {
      const progress = Math.max(0, Math.min(1.0, entry.remainingTime / entry.duration));
      list.push({
        type: entry.type,
        name: entry.config.name,
        badgeText: entry.config.badgeText,
        primaryColor: entry.config.primaryColor,
        secondaryColor: entry.config.secondaryColor,
        glowColor: entry.config.glowColor,
        darkColor: entry.config.darkColor,
        accentColor: entry.config.accentColor,
        duration: entry.duration,
        remainingTime: entry.remainingTime,
        progress,
        isExpiring: entry.remainingTime < 1.8,
      });
    }
    return list;
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    try {
      listener(this.getActivePowerUps());
    } catch {
      // Ignore
    }
    return () => this.subscribers.delete(listener);
  }

  notifySubscribers() {
    const activeList = this.getActivePowerUps();
    for (const sub of this.subscribers) {
      try {
        sub(activeList);
      } catch (err) {
        console.error('Error in PowerUpManager subscriber:', err);
      }
    }
  }

  reset() {
    this.activePowerUps.clear();
    this.spawnCooldown = 20.0;
    this.notifySubscribers();
  }

  destroy() {
    this.activePowerUps.clear();
    this.subscribers.clear();
  }
}
