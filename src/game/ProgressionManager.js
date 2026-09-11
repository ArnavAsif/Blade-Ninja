/**
 * Lightweight, robust progression and mission management system.
 * Handles career statistics, daily/ongoing missions, reward currency,
 * achievement milestones, schema versioning, and crash-safe localStorage persistence.
 */

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY_PROGRESSION_V2 = 'fn_progression_v2';
export const LEGACY_STORAGE_KEY = 'fn_progression';

export const MISSION_CATEGORIES = {
  DAILY: 'daily',
  ONGOING: 'ongoing',
};

export const DEFAULT_MISSIONS = [
  {
    id: 'slice_50_fruits',
    title: 'Fruit Novice',
    description: 'Slice 50 fruits across game sessions',
    target: 50,
    progress: 0,
    reward: 50,
    category: MISSION_CATEGORIES.ONGOING,
    iconType: 'fruit',
    completed: false,
    claimed: false,
  },
  {
    id: 'slice_10_watermelons',
    title: 'Melon Cleaver',
    description: 'Cleave 10 fresh watermelons',
    target: 10,
    progress: 0,
    reward: 40,
    category: MISSION_CATEGORIES.DAILY,
    iconType: 'watermelon',
    completed: false,
    claimed: false,
  },
  {
    id: 'combo_20',
    title: 'Combo Maestro',
    description: 'Achieve a 20x combo streak',
    target: 20,
    progress: 0,
    reward: 60,
    category: MISSION_CATEGORIES.ONGOING,
    iconType: 'combo',
    completed: false,
    claimed: false,
  },
  {
    id: 'score_5000',
    title: 'Score Paragon',
    description: 'Reach 5,000 points in a single session',
    target: 5000,
    progress: 0,
    reward: 75,
    category: MISSION_CATEGORIES.ONGOING,
    iconType: 'score',
    completed: false,
    claimed: false,
  },
  {
    id: 'multi_slice_swipe',
    title: 'Chain Slasher',
    description: 'Slice 3 or more fruits in a single swipe',
    target: 3,
    progress: 0,
    reward: 45,
    category: MISSION_CATEGORIES.DAILY,
    iconType: 'multislice',
    completed: false,
    claimed: false,
  },
  {
    id: 'survive_duration',
    title: 'Endurance Blade',
    description: 'Survive for at least 60 seconds in a session',
    target: 60,
    progress: 0,
    reward: 50,
    category: MISSION_CATEGORIES.DAILY,
    iconType: 'survival',
    completed: false,
    claimed: false,
  },
  {
    id: 'enter_fever_mode',
    title: 'Fever Surge',
    description: 'Enter Fever mode 3 times',
    target: 3,
    progress: 0,
    reward: 60,
    category: MISSION_CATEGORIES.ONGOING,
    iconType: 'fever',
    completed: false,
    claimed: false,
  },
  {
    id: 'slice_special_fruits',
    title: 'Rare Cleaver',
    description: 'Slice 5 special fruits or power-ups',
    target: 5,
    progress: 0,
    reward: 70,
    category: MISSION_CATEGORIES.ONGOING,
    iconType: 'special',
    completed: false,
    claimed: false,
  },
];

export const ACHIEVEMENTS = [
  {
    id: 'first_slice',
    title: 'First Slice',
    description: 'Slice your first fruit in the dojo',
    reward: 20,
    iconType: 'first_slice',
    aliases: ['first_blood'],
  },
  {
    id: 'first_combo',
    title: 'First Combo',
    description: 'Perform your first consecutive combo streak',
    reward: 25,
    iconType: 'first_combo',
  },
  {
    id: 'combo_10',
    title: '10 Combo',
    description: 'Achieve a 10x combo streak',
    reward: 40,
    iconType: 'combo_10',
  },
  {
    id: 'combo_25',
    title: '25 Combo',
    description: 'Achieve a blazing 25x combo streak',
    reward: 75,
    iconType: 'combo_25',
  },
  {
    id: 'combo_50',
    title: '50 Combo',
    description: 'Unleash an unstoppable 50x combo rampage',
    reward: 150,
    iconType: 'combo_50',
  },
  {
    id: 'fruits_100',
    title: '100 Fruits',
    description: 'Slice 100 total fruits across your career',
    reward: 50,
    iconType: 'fruits_100',
    aliases: ['century_club'],
  },
  {
    id: 'fruits_1000',
    title: '1,000 Fruits',
    description: 'Slice 1,000 total fruits across your career',
    reward: 200,
    iconType: 'fruits_1000',
  },
  {
    id: 'first_fever',
    title: 'First Fever',
    description: 'Ignite Fever mode for the first time',
    reward: 35,
    iconType: 'first_fever',
    aliases: ['fever_initiate'],
  },
  {
    id: 'perfect_slice',
    title: 'Perfect Slice',
    description: 'Perform a clean center-cut Perfect Slice',
    reward: 30,
    iconType: 'perfect_slice',
  },
  {
    id: 'perfect_slasher',
    title: 'Zen Precision',
    description: 'Perform 10 Perfect Center cuts',
    reward: 60,
    iconType: 'perfect_slice',
  },
  {
    id: 'multi_slice',
    title: 'Multi Slice',
    description: 'Slice 3 or more fruits in a single swipe',
    reward: 35,
    iconType: 'multi_slice',
  },
  {
    id: 'high_score',
    title: 'High Score',
    description: 'Score 1,000 points or more in a session',
    reward: 60,
    iconType: 'high_score',
    aliases: ['grandmaster'],
  },
  {
    id: 'long_survival',
    title: 'Long Survival',
    description: 'Survive for at least 90 seconds in a single session',
    reward: 50,
    iconType: 'long_survival',
  },
  {
    id: 'bomb_avoider',
    title: 'Bomb Avoider',
    description: 'Let 10 active bombs safely pass without striking any',
    reward: 45,
    iconType: 'bomb_avoider',
  },
];

export class ProgressionManager {
  constructor() {
    this.subscribers = new Set();
    this.achievementListeners = new Set();
    this.sessionSurviveTime = 0;
    this.sessionHighestScore = 0;

    this.data = this.loadProgression();
    this.checkDailyReset();
  }

  getDefaultData() {
    return {
      version: SCHEMA_VERSION,
      currency: 0,
      profile: {
        totalFruitsSliced: 0,
        highestScore: 0,
        highestCombo: 0,
        totalGames: 0,
        totalPlayTime: 0,
        missionsCompleted: 0,
        perfectSlicesCount: 0,
        bombsAvoidedCount: 0,
        specialAchievements: [],
      },
      missions: DEFAULT_MISSIONS.map((m) => ({ ...m })),
      lastDailyReset: Date.now(),
    };
  }

  loadProgression() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.getDefaultData();
      }

      const raw = window.localStorage.getItem(STORAGE_KEY_PROGRESSION_V2);
      if (raw) {
        const parsed = JSON.parse(raw);
        return this.validateAndSanitize(parsed);
      }

      // Check legacy v1 key for migration
      const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        try {
          const legacy = JSON.parse(legacyRaw);
          const migrated = this.getDefaultData();
          if (Number.isFinite(legacy.totalFruitsSliced)) {
            migrated.profile.totalFruitsSliced = Math.max(0, legacy.totalFruitsSliced);
          }
          if (Number.isFinite(legacy.highestCombo)) {
            migrated.profile.highestCombo = Math.max(0, legacy.highestCombo);
          }
          if (Number.isFinite(legacy.gamesPlayed)) {
            migrated.profile.totalGames = Math.max(0, legacy.gamesPlayed);
          }
          this.save(migrated);
          return migrated;
        } catch {
          // Fall through on corrupt legacy
        }
      }

      return this.getDefaultData();
    } catch {
      return this.getDefaultData();
    }
  }

  validateAndSanitize(data) {
    if (!data || typeof data !== 'object') {
      return this.getDefaultData();
    }

    const currency = Number.isFinite(data.currency) && data.currency >= 0 ? Math.floor(data.currency) : 0;

    const rawProfile = data.profile || {};
    const profile = {
      totalFruitsSliced: Number.isFinite(rawProfile.totalFruitsSliced) ? Math.max(0, Math.floor(rawProfile.totalFruitsSliced)) : 0,
      highestScore: Number.isFinite(rawProfile.highestScore) ? Math.max(0, Math.floor(rawProfile.highestScore)) : 0,
      highestCombo: Number.isFinite(rawProfile.highestCombo) ? Math.max(0, Math.floor(rawProfile.highestCombo)) : 0,
      totalGames: Number.isFinite(rawProfile.totalGames) ? Math.max(0, Math.floor(rawProfile.totalGames)) : 0,
      totalPlayTime: Number.isFinite(rawProfile.totalPlayTime) ? Math.max(0, rawProfile.totalPlayTime) : 0,
      missionsCompleted: Number.isFinite(rawProfile.missionsCompleted) ? Math.max(0, Math.floor(rawProfile.missionsCompleted)) : 0,
      perfectSlicesCount: Number.isFinite(rawProfile.perfectSlicesCount) ? Math.max(0, Math.floor(rawProfile.perfectSlicesCount)) : 0,
      bombsAvoidedCount: Number.isFinite(rawProfile.bombsAvoidedCount) ? Math.max(0, Math.floor(rawProfile.bombsAvoidedCount)) : 0,
      specialAchievements: Array.isArray(rawProfile.specialAchievements)
        ? rawProfile.specialAchievements.filter((id) => typeof id === 'string')
        : [],
    };

    const missionMap = new Map();
    if (Array.isArray(data.missions)) {
      for (const m of data.missions) {
        if (m && typeof m.id === 'string') {
          missionMap.set(m.id, m);
        }
      }
    }

    const missions = DEFAULT_MISSIONS.map((def) => {
      const saved = missionMap.get(def.id);
      if (!saved) return { ...def };
      const progress = Number.isFinite(saved.progress) ? Math.max(0, Math.min(def.target, saved.progress)) : 0;
      const completed = Boolean(saved.completed || progress >= def.target);
      const claimed = Boolean(saved.claimed);
      return {
        ...def,
        progress,
        completed,
        claimed,
      };
    });

    const lastDailyReset = Number.isFinite(data.lastDailyReset) ? data.lastDailyReset : Date.now();

    return {
      version: SCHEMA_VERSION,
      currency,
      profile,
      missions,
      lastDailyReset,
    };
  }

  save(dataToSave = this.data) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_PROGRESSION_V2, JSON.stringify(dataToSave));
      }
    } catch {
      // Ignore quota/security errors
    }
  }

  checkDailyReset() {
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (now - this.data.lastDailyReset > ONE_DAY_MS) {
      for (const m of this.data.missions) {
        if (m.category === MISSION_CATEGORIES.DAILY) {
          m.progress = 0;
          m.completed = false;
          m.claimed = false;
        }
      }
      this.data.lastDailyReset = now;
      this.save();
      this.notifySubscribers();
    }
  }

  startSession() {
    this.sessionSurviveTime = 0;
    this.sessionHighestScore = 0;
  }

  updateSessionTime(dt) {
    this.sessionSurviveTime += dt;
    this.data.profile.totalPlayTime += dt;

    // Check 60s survival mission
    if (this.sessionSurviveTime >= 60) {
      this.updateMissionProgress('survive_duration', 60, true);
    }

    // Check 90s Long Survival achievement
    if (this.sessionSurviveTime >= 90) {
      this.unlockAchievement('long_survival');
    }
  }

  recordSlice(fruitType, metadata = {}) {
    this.data.profile.totalFruitsSliced += 1;

    // 1. Slice 50 fruits mission
    this.updateMissionProgress('slice_50_fruits', 1);

    // 2. Slice 10 watermelons mission
    if (fruitType === 'watermelon') {
      this.updateMissionProgress('slice_10_watermelons', 1);
    }

    // 3. Multi-slice swipe (3+ fruits in one swipe)
    if (metadata.multiSliceCount && metadata.multiSliceCount >= 3) {
      this.updateMissionProgress('multi_slice_swipe', metadata.multiSliceCount, true);
      this.unlockAchievement('multi_slice');
    }

    // 4. Special fruits & power-ups
    const isSpecial =
      fruitType === 'dragon_fruit' ||
      Boolean(metadata.isRecoveryFruit) ||
      Boolean(metadata.isPowerUp);
    if (isSpecial) {
      this.updateMissionProgress('slice_special_fruits', 1);
    }

    // 5. Perfect slice tracking for achievements
    if (metadata.isPerfectSlice) {
      this.data.profile.perfectSlicesCount += 1;
      this.unlockAchievement('perfect_slice');
      if (this.data.profile.perfectSlicesCount >= 10) {
        this.unlockAchievement('perfect_slasher');
      }
    }

    // Check fruit count achievements
    this.unlockAchievement('first_slice');
    if (this.data.profile.totalFruitsSliced >= 100) {
      this.unlockAchievement('fruits_100');
    }
    if (this.data.profile.totalFruitsSliced >= 1000) {
      this.unlockAchievement('fruits_1000');
    }

    this.save();
    this.notifySubscribers();
  }

  recordCombo(combo) {
    if (combo > this.data.profile.highestCombo) {
      this.data.profile.highestCombo = combo;
    }

    if (combo >= 2) {
      this.unlockAchievement('first_combo');
    }
    if (combo >= 10) {
      this.unlockAchievement('combo_10');
    }
    if (combo >= 20) {
      this.updateMissionProgress('combo_20', combo, true);
    }
    if (combo >= 25) {
      this.unlockAchievement('combo_25');
    }
    if (combo >= 50) {
      this.unlockAchievement('combo_50');
    }

    this.save();
    this.notifySubscribers();
  }

  recordScore(score) {
    if (score > this.data.profile.highestScore) {
      this.data.profile.highestScore = score;
    }

    if (score >= 5000) {
      this.updateMissionProgress('score_5000', score, true);
    }

    if (score >= 1000) {
      this.unlockAchievement('high_score');
    }

    this.save();
    this.notifySubscribers();
  }

  recordFever() {
    this.updateMissionProgress('enter_fever_mode', 1);
    this.unlockAchievement('first_fever');
    this.save();
    this.notifySubscribers();
  }

  recordBombAvoided() {
    this.data.profile.bombsAvoidedCount = (this.data.profile.bombsAvoidedCount || 0) + 1;
    if (this.data.profile.bombsAvoidedCount >= 10) {
      this.unlockAchievement('bomb_avoider');
    }
    this.save();
    this.notifySubscribers();
  }

  recordGameEnd(finalScore) {
    this.data.profile.totalGames += 1;
    this.recordScore(finalScore);
    this.save();
    this.notifySubscribers();
  }

  updateMissionProgress(missionId, amount, isAbsolute = false) {
    const mission = this.data.missions.find((m) => m.id === missionId);
    if (!mission) return;

    if (isAbsolute) {
      if (amount > mission.progress) {
        mission.progress = Math.min(mission.target, amount);
      }
    } else {
      mission.progress = Math.min(mission.target, mission.progress + amount);
    }

    if (mission.progress >= mission.target && !mission.completed) {
      mission.completed = true;
    }
  }

  unlockAchievement(rawId) {
    const ach = ACHIEVEMENTS.find((a) => a.id === rawId || (a.aliases && a.aliases.includes(rawId)));
    if (!ach) return null;

    const canonicalId = ach.id;
    const alreadyUnlocked = this.data.profile.specialAchievements.some(
      (savedId) => savedId === canonicalId || (ach.aliases && ach.aliases.includes(savedId))
    );

    if (!alreadyUnlocked) {
      this.data.profile.specialAchievements.push(canonicalId);
      if (ach.aliases) {
        for (const alias of ach.aliases) {
          if (!this.data.profile.specialAchievements.includes(alias)) {
            this.data.profile.specialAchievements.push(alias);
          }
        }
      }
      this.data.currency += ach.reward;
      this.save();
      this.notifySubscribers();
      this.notifyAchievementUnlocked(ach);
      return ach;
    }
    return null;
  }

  subscribeAchievementUnlock(listener) {
    this.achievementListeners.add(listener);
    return () => this.achievementListeners.delete(listener);
  }

  notifyAchievementUnlocked(achievement) {
    for (const listener of this.achievementListeners) {
      try {
        listener(achievement);
      } catch (err) {
        console.error('Error in achievement unlock listener:', err);
      }
    }
  }

  claimReward(missionId) {
    const mission = this.data.missions.find((m) => m.id === missionId);
    if (!mission || !mission.completed || mission.claimed) {
      return { success: false, reward: 0, currency: this.data.currency };
    }

    mission.claimed = true;
    this.data.currency += mission.reward;
    this.data.profile.missionsCompleted += 1;
    this.save();
    this.notifySubscribers();

    return {
      success: true,
      reward: mission.reward,
      currency: this.data.currency,
      missionTitle: mission.title,
    };
  }

  claimAllRewards() {
    let totalClaimed = 0;
    for (const mission of this.data.missions) {
      if (mission.completed && !mission.claimed) {
        mission.claimed = true;
        totalClaimed += mission.reward;
        this.data.profile.missionsCompleted += 1;
      }
    }

    if (totalClaimed > 0) {
      this.data.currency += totalClaimed;
      this.save();
      this.notifySubscribers();
    }

    return {
      totalClaimed,
      currency: this.data.currency,
    };
  }

  getUnclaimedCount() {
    return this.data.missions.filter((m) => m.completed && !m.claimed).length;
  }

  getCurrency() {
    return this.data.currency;
  }

  getProfile() {
    return { ...this.data.profile };
  }

  getMissions() {
    return this.data.missions.map((m) => ({ ...m }));
  }

  getAchievements() {
    const unlockedSet = new Set(this.data.profile.specialAchievements);
    return ACHIEVEMENTS.map((a) => {
      const isUnlocked =
        unlockedSet.has(a.id) ||
        Boolean(a.aliases && a.aliases.some((alias) => unlockedSet.has(alias)));
      return {
        ...a,
        isUnlocked,
      };
    });
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    try {
      listener({
        currency: this.data.currency,
        profile: this.getProfile(),
        missions: this.getMissions(),
        achievements: this.getAchievements(),
        unclaimedCount: this.getUnclaimedCount(),
      });
    } catch {
      // Ignore
    }
    return () => this.subscribers.delete(listener);
  }

  notifySubscribers() {
    const payload = {
      currency: this.data.currency,
      profile: this.getProfile(),
      missions: this.getMissions(),
      achievements: this.getAchievements(),
      unclaimedCount: this.getUnclaimedCount(),
    };
    for (const listener of this.subscribers) {
      try {
        listener(payload);
      } catch (err) {
        console.error('Error in ProgressionManager subscriber:', err);
      }
    }
  }

  destroy() {
    this.subscribers.clear();
    this.achievementListeners.clear();
  }
}
