import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ProgressionManager,
  ACHIEVEMENTS,
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

describe('Achievement System Tests', () => {
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

  describe('Achievement Catalog', () => {
    it('contains all 13 meaningful user-requested achievements', () => {
      const expectedIds = [
        'first_slice',
        'first_combo',
        'combo_10',
        'combo_25',
        'combo_50',
        'fruits_100',
        'fruits_1000',
        'first_fever',
        'perfect_slice',
        'multi_slice',
        'high_score',
        'long_survival',
        'bomb_avoider',
      ];

      for (const expectedId of expectedIds) {
        const found = ACHIEVEMENTS.find((a) => a.id === expectedId);
        assert.ok(found, `Achievement with id '${expectedId}' must exist`);
        assert.ok(found.title.length > 0, `Achievement '${expectedId}' must have a title`);
        assert.ok(found.description.length > 0, `Achievement '${expectedId}' must have a description`);
        assert.ok(found.reward > 0, `Achievement '${expectedId}' must award currency crests`);
        assert.ok(found.iconType, `Achievement '${expectedId}' must specify an iconType`);
      }
    });
  });

  describe('Automatic Unlocking Triggers', () => {
    it('automatically unlocks First Slice on the very first fruit slice', () => {
      const pm = new ProgressionManager();
      assert.equal(pm.getAchievements().find((a) => a.id === 'first_slice').isUnlocked, false);

      pm.recordSlice('watermelon');

      const ach = pm.getAchievements().find((a) => a.id === 'first_slice');
      assert.equal(ach.isUnlocked, true);
      assert.ok(pm.getCurrency() >= 20);
    });

    it('automatically unlocks First Combo on a 2x combo', () => {
      const pm = new ProgressionManager();
      assert.equal(pm.getAchievements().find((a) => a.id === 'first_combo').isUnlocked, false);

      pm.recordCombo(2);

      const ach = pm.getAchievements().find((a) => a.id === 'first_combo');
      assert.equal(ach.isUnlocked, true);
      assert.ok(pm.getCurrency() >= 25);
    });

    it('automatically unlocks 10 Combo, 25 Combo, and 50 Combo at their thresholds', () => {
      const pm = new ProgressionManager();

      pm.recordCombo(9);
      assert.equal(pm.getAchievements().find((a) => a.id === 'combo_10').isUnlocked, false);

      pm.recordCombo(10);
      assert.equal(pm.getAchievements().find((a) => a.id === 'combo_10').isUnlocked, true);
      assert.equal(pm.getAchievements().find((a) => a.id === 'combo_25').isUnlocked, false);

      pm.recordCombo(25);
      assert.equal(pm.getAchievements().find((a) => a.id === 'combo_25').isUnlocked, true);
      assert.equal(pm.getAchievements().find((a) => a.id === 'combo_50').isUnlocked, false);

      pm.recordCombo(52);
      assert.equal(pm.getAchievements().find((a) => a.id === 'combo_50').isUnlocked, true);
    });

    it('automatically unlocks 100 Fruits and 1,000 Fruits career milestones', () => {
      const pm = new ProgressionManager();

      // Pre-seed 99 fruits
      pm.data.profile.totalFruitsSliced = 99;
      pm.recordSlice('apple');

      assert.equal(pm.getAchievements().find((a) => a.id === 'fruits_100').isUnlocked, true);
      assert.equal(pm.getAchievements().find((a) => a.id === 'fruits_1000').isUnlocked, false);

      // Pre-seed 999 fruits
      pm.data.profile.totalFruitsSliced = 999;
      pm.recordSlice('orange');

      assert.equal(pm.getAchievements().find((a) => a.id === 'fruits_1000').isUnlocked, true);
    });

    it('automatically unlocks First Fever on fever mode ignition', () => {
      const pm = new ProgressionManager();
      assert.equal(pm.getAchievements().find((a) => a.id === 'first_fever').isUnlocked, false);

      pm.recordFever();

      assert.equal(pm.getAchievements().find((a) => a.id === 'first_fever').isUnlocked, true);
    });

    it('automatically unlocks Perfect Slice on a clean center cut', () => {
      const pm = new ProgressionManager();
      assert.equal(pm.getAchievements().find((a) => a.id === 'perfect_slice').isUnlocked, false);

      pm.recordSlice('banana', { isPerfectSlice: true });

      assert.equal(pm.getAchievements().find((a) => a.id === 'perfect_slice').isUnlocked, true);
    });

    it('automatically unlocks Multi Slice when slicing 3+ fruits in one swipe', () => {
      const pm = new ProgressionManager();
      assert.equal(pm.getAchievements().find((a) => a.id === 'multi_slice').isUnlocked, false);

      // Slicing 2 fruits does not unlock multi_slice
      pm.recordSlice('apple', { multiSliceCount: 2 });
      assert.equal(pm.getAchievements().find((a) => a.id === 'multi_slice').isUnlocked, false);

      // Slicing 3 fruits unlocks multi_slice
      pm.recordSlice('apple', { multiSliceCount: 3 });
      assert.equal(pm.getAchievements().find((a) => a.id === 'multi_slice').isUnlocked, true);
    });

    it('automatically unlocks High Score when scoring 1,000 points or more', () => {
      const pm = new ProgressionManager();
      assert.equal(pm.getAchievements().find((a) => a.id === 'high_score').isUnlocked, false);

      pm.recordScore(850);
      assert.equal(pm.getAchievements().find((a) => a.id === 'high_score').isUnlocked, false);

      pm.recordScore(1250);
      assert.equal(pm.getAchievements().find((a) => a.id === 'high_score').isUnlocked, true);
    });

    it('automatically unlocks Long Survival when session survival reaches 90 seconds', () => {
      const pm = new ProgressionManager();
      pm.startSession();

      pm.updateSessionTime(75);
      assert.equal(pm.getAchievements().find((a) => a.id === 'long_survival').isUnlocked, false);

      pm.updateSessionTime(20); // total 95s
      assert.equal(pm.getAchievements().find((a) => a.id === 'long_survival').isUnlocked, true);
    });

    it('automatically unlocks Bomb Avoider after 10 bombs safely pass', () => {
      const pm = new ProgressionManager();
      assert.equal(pm.getAchievements().find((a) => a.id === 'bomb_avoider').isUnlocked, false);

      for (let i = 0; i < 9; i++) {
        pm.recordBombAvoided();
      }
      assert.equal(pm.getAchievements().find((a) => a.id === 'bomb_avoider').isUnlocked, false);

      pm.recordBombAvoided();
      assert.equal(pm.getAchievements().find((a) => a.id === 'bomb_avoider').isUnlocked, true);
    });
  });

  describe('Unlock Notifications & Listeners', () => {
    it('notifies subscribers via subscribeAchievementUnlock with achievement payload', () => {
      const pm = new ProgressionManager();
      const unlockedList = [];

      const unsub = pm.subscribeAchievementUnlock((ach) => {
        unlockedList.push(ach);
      });

      pm.recordSlice('watermelon');
      assert.equal(unlockedList.length, 1);
      assert.equal(unlockedList[0].id, 'first_slice');
      assert.equal(unlockedList[0].title, 'First Slice');

      // Subsequent slices do not re-notify First Slice
      pm.recordSlice('apple');
      assert.equal(unlockedList.length, 1);

      // Triggering new achievement notifies subscriber
      pm.recordCombo(2);
      assert.equal(unlockedList.length, 2);
      assert.equal(unlockedList[1].id, 'first_combo');

      unsub();
    });

    it('unsubscribing stops receiving achievement notifications', () => {
      const pm = new ProgressionManager();
      let callCount = 0;

      const unsub = pm.subscribeAchievementUnlock(() => {
        callCount += 1;
      });

      pm.recordFever();
      assert.equal(callCount, 1);

      unsub();
      pm.recordCombo(10);
      assert.equal(callCount, 1);
    });
  });

  describe('Persistence & Profile Integration', () => {
    it('persists unlocked achievements in profile.specialAchievements', () => {
      const pm1 = new ProgressionManager();
      pm1.recordFever();
      pm1.recordCombo(25);
      pm1.save();

      const pm2 = new ProgressionManager();
      const feverAch = pm2.getAchievements().find((a) => a.id === 'first_fever');
      const comboAch = pm2.getAchievements().find((a) => a.id === 'combo_25');

      assert.equal(feverAch.isUnlocked, true);
      assert.equal(comboAch.isUnlocked, true);
      assert.ok(pm2.getProfile().specialAchievements.includes('first_fever'));
      assert.ok(pm2.getProfile().specialAchievements.includes('combo_25'));
    });
  });

  describe('GameState Real-Time Integration', () => {
    it('evaluates and unlocks achievements during live GameState actions', () => {
      const gameState = new GameState();
      gameState.resetSession();

      const pm = gameState.getProgressionManager();
      const unlocked = [];

      pm.subscribeAchievementUnlock((ach) => {
        unlocked.push(ach.id);
      });

      // 1. Slice fruit -> First Slice
      gameState.registerSlice('watermelon');
      assert.ok(unlocked.includes('first_slice'));

      // 2. Combo 2 -> First Combo
      gameState.registerSlice('apple');
      assert.ok(unlocked.includes('first_combo'));

      // 3. Perfect center cut -> Perfect Slice
      gameState.registerSlice('orange', { isPerfectSlice: true });
      assert.ok(unlocked.includes('perfect_slice'));

      // 4. Multi-slice swipe -> Multi Slice
      gameState.registerSlice('banana', { multiSliceCount: 3 });
      assert.ok(unlocked.includes('multi_slice'));

      // 5. Fever mode
      gameState.enterFeverMode();
      assert.ok(unlocked.includes('first_fever'));

      // 6. 90s survival while playing
      gameState.setState(STATES.PLAYING);
      gameState.update(92);
      assert.ok(unlocked.includes('long_survival'));
    });
  });
});
