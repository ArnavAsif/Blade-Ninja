import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ProgressionManager,
  SCHEMA_VERSION,
  STORAGE_KEY_PROGRESSION_V2,
  LEGACY_STORAGE_KEY,
} from '../src/game/ProgressionManager.js';
import { GameState, STATES } from '../src/game/GameState.js';

function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
  };
}

describe('Progression & Mission System Tests', () => {
  let mockStorage;
  let originalWindow;

  beforeEach(() => {
    mockStorage = createMockStorage();
    originalWindow = globalThis.window;
    globalThis.window = {
      localStorage: mockStorage,
    };
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  describe('Initialization & Schema Defaults', () => {
    it('initializes with schema version 2 and zero initial currency', () => {
      const pm = new ProgressionManager();
      assert.equal(pm.data.version, SCHEMA_VERSION);
      assert.equal(pm.getCurrency(), 0);
      assert.equal(pm.getUnclaimedCount(), 0);
    });

    it('contains all 8 required missions in default state', () => {
      const pm = new ProgressionManager();
      const missions = pm.getMissions();
      assert.equal(missions.length, 8);

      const expectedIds = [
        'slice_50_fruits',
        'slice_10_watermelons',
        'combo_20',
        'score_5000',
        'multi_slice_swipe',
        'survive_duration',
        'enter_fever_mode',
        'slice_special_fruits',
      ];

      for (const id of expectedIds) {
        const found = missions.find((m) => m.id === id);
        assert.ok(found, `Mission ${id} must exist`);
        assert.equal(found.progress, 0);
        assert.equal(found.completed, false);
        assert.equal(found.claimed, false);
      }
    });

    it('immediately calls subscriber with current progression payload', () => {
      const pm = new ProgressionManager();
      let callCount = 0;
      let lastPayload = null;

      const unsub = pm.subscribe((data) => {
        callCount += 1;
        lastPayload = data;
      });

      assert.equal(callCount, 1);
      assert.ok(lastPayload);
      assert.equal(lastPayload.currency, 0);
      assert.equal(lastPayload.missions.length, 8);
      assert.equal(typeof lastPayload.profile, 'object');
      assert.equal(Array.isArray(lastPayload.achievements), true);

      unsub();
    });
  });

  describe('Daily & Ongoing Mission Mechanics', () => {
    it('tracks slice_50_fruits across game sessions', () => {
      const pm = new ProgressionManager();
      for (let i = 0; i < 30; i++) {
        pm.recordSlice('apple');
      }

      let mission = pm.getMissions().find((m) => m.id === 'slice_50_fruits');
      assert.equal(mission.progress, 30);
      assert.equal(mission.completed, false);

      for (let i = 0; i < 25; i++) {
        pm.recordSlice('orange');
      }

      mission = pm.getMissions().find((m) => m.id === 'slice_50_fruits');
      assert.equal(mission.progress, 50);
      assert.equal(mission.completed, true);
    });

    it('tracks slice_10_watermelons specifically for watermelons', () => {
      const pm = new ProgressionManager();

      // Slicing other fruits should not advance watermelon mission
      pm.recordSlice('apple');
      pm.recordSlice('banana');
      pm.recordSlice('strawberry');

      let mission = pm.getMissions().find((m) => m.id === 'slice_10_watermelons');
      assert.equal(mission.progress, 0);

      // Slicing watermelons advances mission
      for (let i = 0; i < 10; i++) {
        pm.recordSlice('watermelon');
      }

      mission = pm.getMissions().find((m) => m.id === 'slice_10_watermelons');
      assert.equal(mission.progress, 10);
      assert.equal(mission.completed, true);
    });

    it('tracks combo_20 when achieving a 20x combo streak', () => {
      const pm = new ProgressionManager();

      pm.recordCombo(15);
      let mission = pm.getMissions().find((m) => m.id === 'combo_20');
      assert.equal(mission.completed, false);

      pm.recordCombo(22);
      mission = pm.getMissions().find((m) => m.id === 'combo_20');
      assert.equal(mission.progress, 20);
      assert.equal(mission.completed, true);
    });

    it('tracks score_5000 when reaching 5,000 points', () => {
      const pm = new ProgressionManager();

      pm.recordScore(3200);
      let mission = pm.getMissions().find((m) => m.id === 'score_5000');
      assert.equal(mission.completed, false);

      pm.recordScore(5400);
      mission = pm.getMissions().find((m) => m.id === 'score_5000');
      assert.equal(mission.progress, 5000);
      assert.equal(mission.completed, true);
    });

    it('tracks multi_slice_swipe when 3 or more fruits are sliced in one swipe', () => {
      const pm = new ProgressionManager();

      // Swipe with only 2 fruits
      pm.recordSlice('apple', { multiSliceCount: 2 });
      let mission = pm.getMissions().find((m) => m.id === 'multi_slice_swipe');
      assert.equal(mission.completed, false);

      // Swipe with 3 fruits
      pm.recordSlice('watermelon', { multiSliceCount: 3 });
      mission = pm.getMissions().find((m) => m.id === 'multi_slice_swipe');
      assert.equal(mission.progress, 3);
      assert.equal(mission.completed, true);
    });

    it('tracks survive_duration for 60 seconds of session play time', () => {
      const pm = new ProgressionManager();
      pm.startSession();

      pm.updateSessionTime(35.0);
      let mission = pm.getMissions().find((m) => m.id === 'survive_duration');
      assert.equal(mission.completed, false);

      pm.updateSessionTime(30.0);
      mission = pm.getMissions().find((m) => m.id === 'survive_duration');
      assert.equal(mission.progress, 60);
      assert.equal(mission.completed, true);
    });

    it('tracks enter_fever_mode 3 times', () => {
      const pm = new ProgressionManager();

      pm.recordFever();
      pm.recordFever();
      let mission = pm.getMissions().find((m) => m.id === 'enter_fever_mode');
      assert.equal(mission.progress, 2);
      assert.equal(mission.completed, false);

      pm.recordFever();
      mission = pm.getMissions().find((m) => m.id === 'enter_fever_mode');
      assert.equal(mission.progress, 3);
      assert.equal(mission.completed, true);
    });

    it('tracks slice_special_fruits for dragonfruit, recovery fruit, and power-ups', () => {
      const pm = new ProgressionManager();

      pm.recordSlice('dragon_fruit');
      pm.recordSlice('kiwi', { isRecoveryFruit: true });
      pm.recordSlice('frenzy', { isPowerUp: true });
      pm.recordSlice('slow_motion', { isPowerUp: true });
      pm.recordSlice('double_score', { isPowerUp: true });

      const mission = pm.getMissions().find((m) => m.id === 'slice_special_fruits');
      assert.equal(mission.progress, 5);
      assert.equal(mission.completed, true);
    });
  });

  describe('Currency & Rewards Claiming', () => {
    it('prevents claiming uncompleted missions', () => {
      const pm = new ProgressionManager();
      const res = pm.claimReward('slice_50_fruits');
      assert.equal(res.success, false);
      assert.equal(res.reward, 0);
      assert.equal(pm.getCurrency(), 0);
    });

    it('claims completed mission, awards Blade Crests, and prevents double claiming', () => {
      const pm = new ProgressionManager();

      // Complete mission
      for (let i = 0; i < 10; i++) {
        pm.recordSlice('watermelon');
      }

      assert.equal(pm.getUnclaimedCount(), 1);

      const res = pm.claimReward('slice_10_watermelons');
      assert.equal(res.success, true);
      assert.equal(res.reward, 40);
      assert.ok(pm.getCurrency() >= 40);
      assert.equal(pm.getUnclaimedCount(), 0);

      // Attempt double claim
      const res2 = pm.claimReward('slice_10_watermelons');
      assert.equal(res2.success, false);
      assert.equal(res2.reward, 0);
    });

    it('claimAllRewards claims all completed missions in a single batch', () => {
      const pm = new ProgressionManager();

      // Complete 2 missions
      for (let i = 0; i < 10; i++) {
        pm.recordSlice('watermelon');
      }
      pm.recordCombo(25);

      assert.ok(pm.getUnclaimedCount() >= 2);
      const prevCurrency = pm.getCurrency();

      const batch = pm.claimAllRewards();
      assert.ok(batch.totalClaimed >= 100);
      assert.equal(pm.getCurrency(), prevCurrency + batch.totalClaimed);
      assert.equal(pm.getUnclaimedCount(), 0);
    });
  });

  describe('Career Profile & Special Achievements', () => {
    it('tracks career stats accurately across gameplay events', () => {
      const pm = new ProgressionManager();

      pm.recordSlice('apple');
      pm.recordSlice('orange');
      pm.recordCombo(15);
      pm.recordScore(2500);
      pm.updateSessionTime(45.5);
      pm.recordGameEnd(2500);

      const profile = pm.getProfile();
      assert.equal(profile.totalFruitsSliced, 2);
      assert.equal(profile.highestCombo, 15);
      assert.equal(profile.highestScore, 2500);
      assert.equal(profile.totalGames, 1);
      assert.ok(profile.totalPlayTime >= 45.0);
    });

    it('unlocks achievements and awards bonus crests', () => {
      const pm = new ProgressionManager();
      const initialCurrency = pm.getCurrency();

      // Slice first fruit -> unlocks first_blood (+20 crests)
      pm.recordSlice('apple');
      let profile = pm.getProfile();
      assert.ok(profile.specialAchievements.includes('first_blood'));
      assert.equal(pm.getCurrency(), initialCurrency + 20);

      // Enter fever -> unlocks fever_initiate (+35 crests)
      pm.recordFever();
      profile = pm.getProfile();
      assert.ok(profile.specialAchievements.includes('fever_initiate'));
      assert.equal(pm.getCurrency(), initialCurrency + 20 + 35);
    });

    it('unlocks perfect_slasher after 10 perfect center cuts', () => {
      const pm = new ProgressionManager();

      for (let i = 0; i < 9; i++) {
        pm.recordSlice('apple', { isPerfectSlice: true });
      }
      assert.equal(pm.getProfile().specialAchievements.includes('perfect_slasher'), false);

      pm.recordSlice('banana', { isPerfectSlice: true });
      assert.equal(pm.getProfile().specialAchievements.includes('perfect_slasher'), true);
    });
  });

  describe('Crash-Safe Persistence & Migration', () => {
    it('persists data to localStorage and restores faithfully', () => {
      const pm1 = new ProgressionManager();
      for (let i = 0; i < 5; i++) {
        pm1.recordSlice('watermelon');
      }
      pm1.save();

      // New instance loading from storage
      const pm2 = new ProgressionManager();
      const mission = pm2.getMissions().find((m) => m.id === 'slice_10_watermelons');
      assert.equal(mission.progress, 5);
      assert.equal(pm2.getProfile().totalFruitsSliced, 5);
    });

    it('gracefully recovers defaults from corrupted JSON in localStorage', () => {
      mockStorage.setItem(STORAGE_KEY_PROGRESSION_V2, 'INVALID_JSON_CORRUPT_DATA{{{');

      const pm = new ProgressionManager();
      assert.equal(pm.data.version, SCHEMA_VERSION);
      assert.equal(pm.getCurrency(), 0);
      assert.equal(pm.getMissions().length, 8);
    });

    it('gracefully sanitizes negative or invalid values in localStorage', () => {
      mockStorage.setItem(
        STORAGE_KEY_PROGRESSION_V2,
        JSON.stringify({
          currency: -999,
          profile: {
            totalFruitsSliced: 'not-a-number',
            highestScore: -50,
          },
        })
      );

      const pm = new ProgressionManager();
      assert.equal(pm.getCurrency(), 0);
      assert.equal(pm.getProfile().totalFruitsSliced, 0);
      assert.equal(pm.getProfile().highestScore, 0);
    });

    it('migrates legacy fn_progression v1 data into v2 schema', () => {
      mockStorage.setItem(
        LEGACY_STORAGE_KEY,
        JSON.stringify({
          totalFruitsSliced: 142,
          highestCombo: 18,
          gamesPlayed: 12,
        })
      );

      const pm = new ProgressionManager();
      assert.equal(pm.data.version, SCHEMA_VERSION);
      assert.equal(pm.getProfile().totalFruitsSliced, 142);
      assert.equal(pm.getProfile().highestCombo, 18);
      assert.equal(pm.getProfile().totalGames, 12);
    });
  });

  describe('Daily Reset Schedule', () => {
    it('preserves daily mission progress when within 24 hours', () => {
      const pm = new ProgressionManager();
      for (let i = 0; i < 6; i++) {
        pm.recordSlice('watermelon');
      }

      // Check daily reset after 1 hour
      pm.checkDailyReset();
      const mission = pm.getMissions().find((m) => m.id === 'slice_10_watermelons');
      assert.equal(mission.progress, 6);
    });

    it('resets daily missions while preserving ongoing missions after 24 hours', () => {
      const pm = new ProgressionManager();

      // Progress daily mission
      for (let i = 0; i < 10; i++) {
        pm.recordSlice('watermelon');
      }
      // Claim daily mission
      pm.claimReward('slice_10_watermelons');

      // Check ongoing mission
      const ongoing = pm.getMissions().find((m) => m.id === 'slice_50_fruits');
      assert.equal(ongoing.progress, 10);

      // Fast forward lastDailyReset by 25 hours
      const TWENTY_FIVE_HOURS = 25 * 60 * 60 * 1000;
      pm.data.lastDailyReset = Date.now() - TWENTY_FIVE_HOURS;

      // Trigger reset check
      pm.checkDailyReset();

      // Daily mission should be reset
      const daily = pm.getMissions().find((m) => m.id === 'slice_10_watermelons');
      assert.equal(daily.progress, 0);
      assert.equal(daily.completed, false);
      assert.equal(daily.claimed, false);

      // Ongoing mission should remain untouched
      const ongoingAfter = pm.getMissions().find((m) => m.id === 'slice_50_fruits');
      assert.equal(ongoingAfter.progress, 10);
    });
  });

  describe('GameState Integration', () => {
    it('automatically records slices, combos, and fever in GameState progressionManager', () => {
      const gameState = new GameState();
      gameState.resetSession();

      const pm = gameState.getProgressionManager();
      assert.ok(pm instanceof ProgressionManager);

      // Slicing watermelon
      gameState.registerSlice('watermelon');
      assert.equal(pm.getProfile().totalFruitsSliced, 1);
      const melonMission = pm.getMissions().find((m) => m.id === 'slice_10_watermelons');
      assert.equal(melonMission.progress, 1);

      // Trigger fever
      gameState.enterFeverMode();
      const feverMission = pm.getMissions().find((m) => m.id === 'enter_fever_mode');
      assert.equal(feverMission.progress, 1);

      // Update session time while playing
      gameState.setState(STATES.PLAYING);
      gameState.update(65.0);
      const surviveMission = pm.getMissions().find((m) => m.id === 'survive_duration');
      assert.equal(surviveMission.completed, true);

      // Game over updates total games
      gameState.setState(STATES.GAME_OVER);
      assert.equal(pm.getProfile().totalGames, 1);
    });
  });
});
