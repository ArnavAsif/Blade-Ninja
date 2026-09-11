import { GAME_MODES, GAME_MODE_CONFIGS, getGameModeConfig } from './GameModeConfig.js';
import { ProgressionManager } from './ProgressionManager.js';
import { lerp } from '../utils/math.js';

export { GAME_MODES, GAME_MODE_CONFIGS, getGameModeConfig };
export const MODE_CONFIG = GAME_MODE_CONFIGS;

export const STATES = Object.freeze({
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
});

export const FRUIT_POINTS = Object.freeze({
  watermelon: 1,
  apple: 1,
  orange: 1,
  banana: 2,
  strawberry: 2,
  kiwi: 2,
  peach: 3,
  pineapple: 3,
  coconut: 3,
  dragonfruit: 4,
});

export const SCORE_CONFIG = Object.freeze({
  defaultFruitScore: 1,
  comboTimeout: 0.45,
  comboBonusPerFruit: 1,
  maxComboMultiplier: 5,
  bombScorePenalty: 10,
  bombStrikePenalty: 1,
  instantGameOverOnBomb: false,
});

const STORAGE_KEY_BEST_SCORE_PREFIX = 'blade_ninja_best_score';
const STORAGE_KEY_PROGRESSION = 'blade_ninja_progression';

export class GameState {
  constructor() {
    this.currentState = STATES.MENU;
    this.mode = GAME_MODES.CLASSIC;
    this.modeConfig = getGameModeConfig(this.mode);
    this.timeRemaining = this.modeConfig.timer ?? null;
    this.sessionTime = 0;
    this.score = 0;
    this.bestScore = this.loadBestScore(this.mode);
    this.consecutiveSlices = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboMultiplier = 1;
    this.maxCombo = 0;
    this.highestCombo = 0;
    this.feverThreshold = this.modeConfig.comboRules?.feverThreshold ?? 8;
    this.isFeverActive = false;
    this.feverTimer = 0;
    this.feverDuration = 7.0;
    this.feverMultiplierBonus = 2;
    this.maxLives = typeof this.modeConfig.lives === 'number' ? (this.modeConfig.maxLives ?? this.modeConfig.lives) : null;
    this.lives = typeof this.modeConfig.lives === 'number' ? this.modeConfig.lives : null;
    this.strikes = 0;
    this.maxStrikes = 3;
    this.fruitsSliced = 0;
    this.nextLifeMilestone = this.modeConfig.lifeMilestoneInterval || 100;
    this.progression = this.loadProgression();
    this.progressionManager = new ProgressionManager();
    this.powerUpManager = null;

    this.stateListeners = new Set();
    this.scoreListeners = new Set();
    this.comboListeners = new Set();
    this.feverListeners = new Set();
    this.strikeListeners = new Set();
    this.livesListeners = new Set();
    this.lifeRecoveredListeners = new Set();
    this.timeListeners = new Set();
    this.modeListeners = new Set();
  }

  getProgressionManager() {
    return this.progressionManager;
  }

  setPowerUpManager(powerUpManager) {
    this.powerUpManager = powerUpManager;
  }

  getModeConfig() {
    return this.modeConfig;
  }

  hasLives() {
    return typeof this.modeConfig.lives === 'number' && this.lives !== null;
  }

  hasTimer() {
    return typeof this.modeConfig.timer === 'number';
  }

  missCostsLife() {
    return Boolean(this.modeConfig.missCostsLife);
  }

  setMode(newMode) {
    if (!GAME_MODE_CONFIGS[newMode] || this.mode === newMode) return;
    this.mode = newMode;
    this.modeConfig = getGameModeConfig(newMode);
    this.feverThreshold = this.modeConfig.comboRules?.feverThreshold ?? 8;
    this.bestScore = this.loadBestScore(newMode);
    this.resetSession();
    this.notifyModeListeners(this.mode, this.modeConfig);
    this.notifyScoreListeners(this.score, this.bestScore);
  }

  loadBestScore(mode = this.mode) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return 0;
      const key = `${STORAGE_KEY_BEST_SCORE_PREFIX}_${mode}`;
      const stored = localStorage.getItem(key) || (mode === GAME_MODES.CLASSIC ? localStorage.getItem(STORAGE_KEY_BEST_SCORE_PREFIX) : null);
      if (!stored) return 0;
      const parsed = parseInt(stored, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  saveBestScore(score, mode = this.mode) {
    if (!Number.isFinite(score) || score <= 0) return;
    if (score > this.bestScore) {
      this.bestScore = score;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const key = `${STORAGE_KEY_BEST_SCORE_PREFIX}_${mode}`;
          localStorage.setItem(key, score.toString());
          if (mode === GAME_MODES.CLASSIC) {
            localStorage.setItem(STORAGE_KEY_BEST_SCORE_PREFIX, score.toString());
          }
        }
      } catch {
        // Ignore localStorage quota or access limitations
      }
    }
  }

  loadProgression() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.getDefaultProgression();
      }
      const raw = localStorage.getItem(STORAGE_KEY_PROGRESSION);
      if (!raw) return this.getDefaultProgression();
      const parsed = JSON.parse(raw);
      return {
        totalFruitsSliced: Number.isFinite(parsed.totalFruitsSliced) ? Math.max(0, parsed.totalFruitsSliced) : 0,
        totalBombsAvoided: Number.isFinite(parsed.totalBombsAvoided) ? Math.max(0, parsed.totalBombsAvoided) : 0,
        totalBombsStruck: Number.isFinite(parsed.totalBombsStruck) ? Math.max(0, parsed.totalBombsStruck) : 0,
        totalMissedFruits: Number.isFinite(parsed.totalMissedFruits) ? Math.max(0, parsed.totalMissedFruits) : 0,
        totalLivesLost: Number.isFinite(parsed.totalLivesLost) ? Math.max(0, parsed.totalLivesLost) : 0,
        totalLivesRecovered: Number.isFinite(parsed.totalLivesRecovered) ? Math.max(0, parsed.totalLivesRecovered) : 0,
        totalMilestonesAchieved: Number.isFinite(parsed.totalMilestonesAchieved) ? Math.max(0, parsed.totalMilestonesAchieved) : 0,
        gamesPlayed: Number.isFinite(parsed.gamesPlayed) ? Math.max(0, parsed.gamesPlayed) : 0,
        highestCombo: Number.isFinite(parsed.highestCombo) ? Math.max(0, parsed.highestCombo) : 0,
      };
    } catch {
      return this.getDefaultProgression();
    }
  }

  getDefaultProgression() {
    return {
      totalFruitsSliced: 0,
      totalBombsAvoided: 0,
      totalBombsStruck: 0,
      totalMissedFruits: 0,
      totalLivesLost: 0,
      totalLivesRecovered: 0,
      totalMilestonesAchieved: 0,
      gamesPlayed: 0,
      highestCombo: 0,
    };
  }

  saveProgression() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY_PROGRESSION, JSON.stringify(this.progression));
      }
    } catch {
      // Ignore quota/security errors
    }
  }

  getProgression() {
    return { ...this.progression };
  }

  setMaxLives(newMax) {
    if (!Number.isFinite(newMax) || newMax <= 0) return;
    this.maxLives = Math.round(newMax);
    if (this.lives !== null) {
      this.lives = Math.min(this.lives, this.maxLives);
      this.strikes = Math.max(0, this.maxLives - this.lives);
      this.notifyLivesListeners(this.lives, this.maxLives);
    }
  }

  getState() {
    return this.currentState;
  }

  is(state) {
    return this.currentState === state;
  }

  setState(newState) {
    if (this.currentState === newState) return;
    const oldState = this.currentState;
    this.currentState = newState;

    if (newState === STATES.GAME_OVER && this.progressionManager) {
      this.progressionManager.recordGameEnd(this.score);
    }

    // Notify React or external subscribers only on state transition
    this.notifyStateListeners(newState, oldState);
  }

  update(dt) {
    if (this.currentState === STATES.PLAYING) {
      this.sessionTime += dt;
      if (this.progressionManager) {
        this.progressionManager.updateSessionTime(dt);
      }
    }

    // 1. Combo window countdown & expiration
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.consecutiveSlices = 0;
        this.comboTimer = 0;
        this.recalculateComboMultiplier();
        this.notifyComboListeners(0, {
          consecutiveSlices: 0,
          multiplier: this.comboMultiplier,
          timer: 0,
          isFever: this.isFeverActive,
        });
      }
    }

    // 2. Fever mode countdown & smooth expiration
    if (this.isFeverActive) {
      this.feverTimer -= dt;
      if (this.feverTimer <= 0) {
        this.endFeverMode();
      } else {
        this.notifyFeverProgress(this.feverTimer, this.feverDuration);
      }
    }

    // 3. Round timer countdown in timed modes
    if (this.currentState === STATES.PLAYING && this.hasTimer() && this.timeRemaining !== null) {
      const prevSec = Math.ceil(this.timeRemaining);
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      const newSec = Math.ceil(this.timeRemaining);
      if (newSec !== prevSec || this.timeRemaining <= 0) {
        this.notifyTimeListeners(this.timeRemaining);
      }
    }
  }

  setScore(newScore) {
    this.score = newScore;
    if (this.score > this.bestScore) {
      this.saveBestScore(this.score, this.mode);
    }
    if (this.progressionManager) {
      this.progressionManager.recordScore(this.score);
    }
    this.notifyScoreListeners(this.score, this.bestScore);

    // Controlled milestone recovery: e.g. every 100 points in modes with lives
    if (this.hasLives() && this.modeConfig?.lifeMilestoneInterval) {
      const interval = this.modeConfig.lifeMilestoneInterval;
      while (this.score >= this.nextLifeMilestone) {
        if (this.lives < this.maxLives && this.lives > 0) {
          this.recoverLife(1, 'milestone');
        }
        this.nextLifeMilestone += interval;
      }
    }
  }

  addScore(amount) {
    this.setScore(this.score + amount);
  }

  calculateComboMultiplier(consecutive) {
    const maxMult = this.modeConfig?.comboRules?.maxMultiplier ?? 5;
    // Escalating tier multiplier based on consecutive slices:
    // 1-2 slices: 1x, 3-5 slices: 2x, 6-8 slices: 3x, 9-11 slices: 4x, 12+ slices: 5x
    let baseMultiplier = 1;
    if (consecutive >= 12) {
      baseMultiplier = 5;
    } else if (consecutive >= 9) {
      baseMultiplier = 4;
    } else if (consecutive >= 6) {
      baseMultiplier = 3;
    } else if (consecutive >= 3) {
      baseMultiplier = 2;
    } else {
      baseMultiplier = 1;
    }
    baseMultiplier = Math.min(baseMultiplier, maxMult);

    // FEVER mode boosts multiplier by +2x
    if (this.isFeverActive) {
      baseMultiplier += this.feverMultiplierBonus;
    }

    return baseMultiplier;
  }

  recalculateComboMultiplier() {
    this.comboMultiplier = this.calculateComboMultiplier(this.consecutiveSlices);
    return this.comboMultiplier;
  }

  enterFeverMode() {
    if (this.isFeverActive) return;
    this.isFeverActive = true;
    this.feverTimer = this.feverDuration;
    this.recalculateComboMultiplier();
    if (this.progressionManager) {
      this.progressionManager.recordFever();
    }
    this.notifyFeverListeners(true, {
      timer: this.feverTimer,
      duration: this.feverDuration,
      multiplierBonus: this.feverMultiplierBonus,
    });
  }

  endFeverMode() {
    if (!this.isFeverActive) return;
    this.isFeverActive = false;
    this.feverTimer = 0;
    this.recalculateComboMultiplier();
    this.notifyFeverListeners(false, {
      timer: 0,
      duration: this.feverDuration,
      multiplierBonus: 0,
    });
  }

  setCombo(combo) {
    this.consecutiveSlices = combo;
    this.combo = combo;
    if (combo > this.maxCombo) {
      this.maxCombo = combo;
      this.highestCombo = combo;
    }
    this.comboTimer = this.getEffectiveComboTimeout();
    this.recalculateComboMultiplier();
    if (this.progressionManager) {
      this.progressionManager.recordCombo(combo);
    }
    this.notifyComboListeners(this.combo, {
      consecutiveSlices: this.consecutiveSlices,
      multiplier: this.comboMultiplier,
      timer: this.comboTimer,
      maxTimeout: this.getEffectiveComboTimeout(),
      isFever: this.isFeverActive,
    });
  }

  getEffectiveComboTimeout() {
    let timeout = this.modeConfig?.comboRules?.timeout ?? 1.85;
    if (this.modeConfig?.dynamicComboPressure) {
      const difficulty = Math.min(
        1.0,
        (this.sessionTime / this.modeConfig.difficultyRampDuration) * this.modeConfig.difficultyMultiplier
      );
      timeout = lerp(
        this.modeConfig.comboRules.timeout,
        this.modeConfig.comboRules.minTimeout,
        difficulty
      );
    }

    // Extend combo opportunity window during Frenzy
    if (this.powerUpManager && this.powerUpManager.isFrenzyActive()) {
      timeout = Math.max(timeout + 0.8, 2.5);
    }

    return timeout;
  }

  registerSlice(fruitType, metadata = {}) {
    let base = FRUIT_POINTS[fruitType] ?? SCORE_CONFIG.defaultFruitScore;

    // Frenzy bonus point per fruit
    if (this.powerUpManager && this.powerUpManager.isFrenzyActive()) {
      base += 1;
    }

    this.fruitsSliced += 1;
    this.progression.totalFruitsSliced += 1;

    // 1. Track consecutive slices and refresh combo timer window
    if (this.comboTimer > 0) {
      this.consecutiveSlices += 1;
    } else {
      this.consecutiveSlices = 1;
    }
    this.combo = this.consecutiveSlices;
    this.comboTimer = this.getEffectiveComboTimeout();

    // 2. Trigger Fever mode once configurable threshold is reached
    if (!this.isFeverActive && this.consecutiveSlices >= this.feverThreshold) {
      this.enterFeverMode();
    }

    // 3. Multiplier calculation (escalating consecutive slices + Fever boost)
    this.recalculateComboMultiplier();
    const multiplier = this.comboMultiplier;

    // 4. Consecutive slice bonus points
    const bonusPerFruit = this.modeConfig?.comboRules?.bonusPerFruit ?? 1;
    const consecutiveBonus = this.consecutiveSlices > 1 ? (this.consecutiveSlices - 1) * bonusPerFruit : 0;

    // 5. Perfect Slice bonus points (+10 bonus points)
    const isPerfectSlice = Boolean(metadata.isPerfectSlice);
    const perfectBonus = isPerfectSlice ? 10 : 0;

    // 6. Multi-Slice (chain) bonus points
    const multiSliceCount = metadata.multiSliceCount || 1;
    let chainBonus = 0;
    if (multiSliceCount >= 2) {
      if (multiSliceCount === 2) chainBonus = 2;
      else if (multiSliceCount === 3) chainBonus = 5;
      else if (multiSliceCount === 4) chainBonus = 10;
      else chainBonus = 20;
    }

    let pointsEarned = (base * multiplier) + consecutiveBonus + perfectBonus + chainBonus;

    // Apply Double Score power-up multiplier
    const powerUpMultiplier = this.powerUpManager ? this.powerUpManager.getScoreMultiplier() : 1;
    pointsEarned *= powerUpMultiplier;

    this.addScore(pointsEarned);

    if (this.consecutiveSlices > this.maxCombo) {
      this.maxCombo = this.consecutiveSlices;
      this.highestCombo = this.consecutiveSlices;
    }
    if (this.consecutiveSlices > this.progression.highestCombo) {
      this.progression.highestCombo = this.consecutiveSlices;
    }
    this.saveProgression();

    if (this.progressionManager) {
      this.progressionManager.recordSlice(fruitType, {
        ...metadata,
        isPerfectSlice,
        multiSliceCount,
      });
      this.progressionManager.recordCombo(this.consecutiveSlices);
    }

    this.notifyComboListeners(this.combo, {
      consecutiveSlices: this.consecutiveSlices,
      multiplier,
      timer: this.comboTimer,
      maxTimeout: this.getEffectiveComboTimeout(),
      isFever: this.isFeverActive,
      isPerfectSlice,
      multiSliceCount,
    });

    return {
      basePoints: base,
      pointsEarned,
      combo: this.combo,
      consecutiveSlices: this.consecutiveSlices,
      multiplier,
      isCombo: this.combo > 1,
      isDoubleScore: powerUpMultiplier > 1,
      isPerfectSlice,
      perfectBonus,
      multiSliceCount,
      chainBonus,
      isFever: this.isFeverActive,
    };
  }

  loseLife() {
    if (!this.missCostsLife() || !this.hasLives()) {
      return false;
    }

    if (this.lives > 0) {
      const lostIndex = this.lives - 1;
      this.lives -= 1;
      this.strikes = Math.max(0, (this.maxLives ?? 3) - this.lives);
      this.progression.totalLivesLost += 1;
      this.progression.totalMissedFruits += 1;
      this.saveProgression();

      this.notifyLivesListeners(this.lives, this.maxLives, {
        type: 'lost',
        lostIndex,
        livesRemaining: this.lives,
      });
      this.notifyStrikeListeners(this.strikes, this.maxStrikes);
      return this.lives <= 0;
    }
    return true;
  }

  recoverLife(amount = 1, source = 'milestone', metadata = {}) {
    if (!this.hasLives() || this.lives >= this.maxLives || this.lives <= 0) {
      return {
        recovered: false,
        lives: this.lives,
        maxLives: this.maxLives,
      };
    }

    const prevLives = this.lives;
    this.lives = Math.min(this.maxLives, this.lives + amount);
    this.strikes = Math.max(0, this.maxLives - this.lives);
    const recoveredCount = this.lives - prevLives;

    if (recoveredCount > 0) {
      this.progression.totalLivesRecovered += recoveredCount;
      if (source === 'milestone') {
        this.progression.totalMilestonesAchieved += 1;
      }
      this.saveProgression();

      const event = {
        type: 'recovered',
        recoveredIndex: prevLives,
        count: recoveredCount,
        livesRemaining: this.lives,
        source,
        ...metadata,
      };
      this.notifyLivesListeners(this.lives, this.maxLives, event);
      this.notifyStrikeListeners(this.strikes, this.maxStrikes);
      this.notifyLifeRecovered(event);

      return {
        recovered: true,
        prevLives,
        lives: this.lives,
        maxLives: this.maxLives,
        recoveredCount,
        source,
      };
    }

    return {
      recovered: false,
      lives: this.lives,
      maxLives: this.maxLives,
    };
  }

  registerBombHit() {
    this.combo = 0;
    this.consecutiveSlices = 0;
    this.comboTimer = 0;
    if (this.isFeverActive) {
      this.endFeverMode();
    }
    this.recalculateComboMultiplier();
    this.notifyComboListeners(0, {
      consecutiveSlices: 0,
      multiplier: this.comboMultiplier,
      timer: 0,
      isFever: false,
    });

    const prevScore = this.score;
    const penaltyAmount = this.modeConfig.bombScorePenalty;
    const newScore = Math.max(0, this.score - penaltyAmount);
    const scoreLost = prevScore - newScore;
    this.setScore(newScore);

    this.progression.totalBombsStruck += 1;
    this.saveProgression();

    // In Classic mode, bomb hit is fatal immediately, keeping bomb behavior strictly separate from normal fruit misses
    if (this.modeConfig?.bombInstantGameOver) {
      this.lives = 0;
      this.strikes = this.maxStrikes;
      this.notifyLivesListeners(0, this.maxLives, { type: 'bomb_fatal' });
      this.notifyStrikeListeners(this.maxStrikes, this.maxStrikes);
      return {
        scoreLost,
        currentScore: this.score,
        lives: 0,
        isGameOver: true,
      };
    }

    // If mode has no bomb strike penalty (e.g. Arcade mode) or no lives (e.g. Zen), bomb does not cost lives or end the game
    if (this.modeConfig.bombStrikePenalty <= 0 || !this.hasLives()) {
      return {
        scoreLost,
        currentScore: this.score,
        lives: this.lives,
        isGameOver: false,
      };
    }

    const isFatal = this.loseLife();

    return {
      scoreLost,
      currentScore: this.score,
      lives: this.lives,
      isGameOver: isFatal,
    };
  }

  addStrike() {
    if (!this.missCostsLife() || !this.hasLives()) return;
    this.strikes += 1;
    this.notifyStrikeListeners(this.strikes, this.maxStrikes);
    if (this.strikes >= this.maxStrikes) {
      this.setState(STATES.GAME_OVER);
    }
  }

  resetSession() {
    this.score = 0;
    this.combo = 0;
    this.consecutiveSlices = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.highestCombo = 0;
    if (this.isFeverActive) {
      this.endFeverMode();
    }
    this.feverTimer = 0;
    this.recalculateComboMultiplier();
    this.sessionTime = 0;
    this.maxLives = typeof this.modeConfig.lives === 'number' ? (this.modeConfig.maxLives ?? this.modeConfig.lives) : null;
    this.lives = typeof this.modeConfig.lives === 'number' ? this.modeConfig.lives : null;
    this.strikes = 0;
    this.fruitsSliced = 0;
    this.nextLifeMilestone = this.modeConfig.lifeMilestoneInterval || 100;
    this.timeRemaining = typeof this.modeConfig.timer === 'number' ? this.modeConfig.timer : null;
    this.progression.gamesPlayed += 1;
    this.saveProgression();

    if (this.progressionManager) {
      this.progressionManager.startSession();
    }

    this.notifyScoreListeners(this.score, this.bestScore);
    this.notifyComboListeners(0, {
      consecutiveSlices: 0,
      multiplier: 1,
      timer: 0,
      isFever: false,
    });
    this.notifyLivesListeners(this.lives, this.maxLives);
    this.notifyStrikeListeners(this.strikes, this.maxStrikes);
    if (this.hasTimer()) {
      this.notifyTimeListeners(this.timeRemaining);
    }
  }

  subscribe(listener) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  subscribeScore(listener) {
    this.scoreListeners.add(listener);
    return () => this.scoreListeners.delete(listener);
  }

  subscribeCombo(listener) {
    this.comboListeners.add(listener);
    return () => this.comboListeners.delete(listener);
  }

  subscribeFever(listener) {
    this.feverListeners.add(listener);
    try {
      listener(this.isFeverActive, {
        timer: this.feverTimer,
        duration: this.feverDuration,
        multiplierBonus: this.feverMultiplierBonus,
      });
    } catch (err) {
      console.error('Error in initial GameState fever listener call:', err);
    }
    return () => this.feverListeners.delete(listener);
  }

  notifyFeverListeners(active, metadata = {}) {
    for (const listener of this.feverListeners) {
      try {
        listener(active, metadata);
      } catch (err) {
        console.error('Error in GameState fever listener:', err);
      }
    }
  }

  notifyFeverProgress(timer, duration) {
    for (const listener of this.feverListeners) {
      try {
        listener(this.isFeverActive, {
          timer,
          duration,
          multiplierBonus: this.feverMultiplierBonus,
          isProgress: true,
        });
      } catch (err) {
        console.error('Error in GameState fever progress listener:', err);
      }
    }
  }

  subscribeStrikes(listener) {
    this.strikeListeners.add(listener);
    return () => this.strikeListeners.delete(listener);
  }

  subscribeLives(listener) {
    this.livesListeners.add(listener);
    try {
      listener(this.lives, this.maxLives);
    } catch (err) {
      console.error('Error in initial GameState lives listener call:', err);
    }
    return () => this.livesListeners.delete(listener);
  }

  subscribeTime(listener) {
    this.timeListeners.add(listener);
    if (this.timeRemaining !== null) {
      try {
        listener(this.timeRemaining);
      } catch (err) {
        console.error('Error in initial GameState time listener call:', err);
      }
    }
    return () => this.timeListeners.delete(listener);
  }

  subscribeMode(listener) {
    this.modeListeners.add(listener);
    try {
      listener(this.mode, this.getModeConfig());
    } catch (err) {
      console.error('Error in initial GameState mode listener call:', err);
    }
    return () => this.modeListeners.delete(listener);
  }

  notifyStateListeners(newState, oldState) {
    for (const listener of this.stateListeners) {
      try {
        listener(newState, oldState);
      } catch (err) {
        console.error('Error in GameState listener:', err);
      }
    }
  }

  notifyScoreListeners(score, bestScore) {
    for (const listener of this.scoreListeners) {
      try {
        listener(score, bestScore);
      } catch (err) {
        console.error('Error in GameState score listener:', err);
      }
    }
  }

  notifyComboListeners(combo, details = null) {
    for (const listener of this.comboListeners) {
      try {
        listener(combo, details);
      } catch (err) {
        console.error('Error in GameState combo listener:', err);
      }
    }
  }

  notifyStrikeListeners(strikes, maxStrikes) {
    for (const listener of this.strikeListeners) {
      try {
        listener(strikes, maxStrikes);
      } catch (err) {
        console.error('Error in GameState strike listener:', err);
      }
    }
  }

  notifyLivesListeners(lives, maxLives, event = null) {
    for (const listener of this.livesListeners) {
      try {
        listener(lives, maxLives, event);
      } catch (err) {
        console.error('Error in GameState lives listener:', err);
      }
    }
  }

  subscribeLifeRecovered(listener) {
    this.lifeRecoveredListeners.add(listener);
    return () => this.lifeRecoveredListeners.delete(listener);
  }

  notifyLifeRecovered(event) {
    for (const listener of this.lifeRecoveredListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in GameState life recovered listener:', err);
      }
    }
  }

  notifyTimeListeners(timeRemaining) {
    for (const listener of this.timeListeners) {
      try {
        listener(timeRemaining);
      } catch (err) {
        console.error('Error in GameState time listener:', err);
      }
    }
  }

  notifyModeListeners(mode, config) {
    for (const listener of this.modeListeners) {
      try {
        listener(mode, config);
      } catch (err) {
        console.error('Error in GameState mode listener:', err);
      }
    }
  }

  destroy() {
    if (this.progressionManager && typeof this.progressionManager.destroy === 'function') {
      this.progressionManager.destroy();
    }
    this.stateListeners.clear();
    this.scoreListeners.clear();
    this.comboListeners.clear();
    this.feverListeners.clear();
    this.strikeListeners.clear();
    this.livesListeners.clear();
    this.lifeRecoveredListeners.clear();
    this.timeListeners.clear();
    this.modeListeners.clear();
  }
}
