import { GAME_MODES, GAME_MODE_CONFIGS, getGameModeConfig } from './GameModeConfig.js';
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

export class GameState {
  constructor() {
    this.currentState = STATES.MENU;
    this.mode = GAME_MODES.CLASSIC;
    this.modeConfig = getGameModeConfig(this.mode);
    this.timeRemaining = this.modeConfig.timer ?? null;
    this.sessionTime = 0;
    this.score = 0;
    this.bestScore = this.loadBestScore(this.mode);
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.maxLives = typeof this.modeConfig.lives === 'number' ? this.modeConfig.lives : null;
    this.lives = this.maxLives;
    this.strikes = 0;
    this.maxStrikes = 3;
    this.fruitsSliced = 0;

    this.stateListeners = new Set();
    this.scoreListeners = new Set();
    this.comboListeners = new Set();
    this.strikeListeners = new Set();
    this.livesListeners = new Set();
    this.timeListeners = new Set();
    this.modeListeners = new Set();
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

    // Notify React or external subscribers only on state transition
    this.notifyStateListeners(newState, oldState);
  }

  update(dt) {
    if (this.currentState === STATES.PLAYING) {
      this.sessionTime += dt;
    }

    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
        this.notifyComboListeners(0);
      }
    }

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
    this.notifyScoreListeners(this.score, this.bestScore);
  }

  addScore(amount) {
    this.setScore(this.score + amount);
  }

  setCombo(combo) {
    this.combo = combo;
    if (combo > this.maxCombo) {
      this.maxCombo = combo;
    }
    this.comboTimer = this.getEffectiveComboTimeout();
    this.notifyComboListeners(this.combo);
  }

  getEffectiveComboTimeout() {
    if (!this.modeConfig.dynamicComboPressure) {
      return this.modeConfig.comboRules.timeout;
    }
    const difficulty = Math.min(
      1.0,
      (this.sessionTime / this.modeConfig.difficultyRampDuration) * this.modeConfig.difficultyMultiplier
    );
    return lerp(
      this.modeConfig.comboRules.timeout,
      this.modeConfig.comboRules.minTimeout,
      difficulty
    );
  }

  registerSlice(fruitType) {
    const base = FRUIT_POINTS[fruitType] ?? SCORE_CONFIG.defaultFruitScore;

    this.fruitsSliced += 1;

    if (this.comboTimer > 0) {
      this.combo += 1;
    } else {
      this.combo = 1;
    }
    this.comboTimer = this.getEffectiveComboTimeout();

    const maxMult = this.modeConfig.comboRules.maxMultiplier;
    const multiplier = Math.min(this.combo, maxMult);
    const bonus = this.combo > 1 ? (this.combo - 1) * this.modeConfig.comboRules.bonusPerFruit : 0;
    const pointsEarned = (base * multiplier) + bonus;

    this.addScore(pointsEarned);

    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    this.notifyComboListeners(this.combo);

    return {
      basePoints: base,
      pointsEarned,
      combo: this.combo,
      multiplier,
      isCombo: this.combo > 1,
    };
  }

  loseLife() {
    if (!this.missCostsLife() || !this.hasLives()) {
      return false;
    }

    if (this.lives > 0) {
      this.lives -= 1;
      this.strikes = (this.maxLives ?? 3) - this.lives;
      this.notifyLivesListeners(this.lives, this.maxLives);
      this.notifyStrikeListeners(this.strikes, this.maxStrikes);
      return this.lives <= 0;
    }
    return true;
  }

  registerBombHit() {
    this.combo = 0;
    this.comboTimer = 0;
    this.notifyComboListeners(0);

    const prevScore = this.score;
    const penaltyAmount = this.modeConfig.bombScorePenalty;
    const newScore = Math.max(0, this.score - penaltyAmount);
    const scoreLost = prevScore - newScore;
    this.setScore(newScore);

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
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.sessionTime = 0;
    this.maxLives = typeof this.modeConfig.lives === 'number' ? this.modeConfig.lives : null;
    this.lives = this.maxLives;
    this.strikes = 0;
    this.fruitsSliced = 0;
    this.timeRemaining = typeof this.modeConfig.timer === 'number' ? this.modeConfig.timer : null;
    this.notifyScoreListeners(this.score, this.bestScore);
    this.notifyComboListeners(0);
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

  notifyComboListeners(combo) {
    for (const listener of this.comboListeners) {
      try {
        listener(combo);
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

  notifyLivesListeners(lives, maxLives) {
    for (const listener of this.livesListeners) {
      try {
        listener(lives, maxLives);
      } catch (err) {
        console.error('Error in GameState lives listener:', err);
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
    this.stateListeners.clear();
    this.scoreListeners.clear();
    this.comboListeners.clear();
    this.strikeListeners.clear();
    this.livesListeners.clear();
    this.timeListeners.clear();
    this.modeListeners.clear();
  }
}
