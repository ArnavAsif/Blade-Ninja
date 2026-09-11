import { GameState } from '../src/game/GameState.js';
import { GAME_MODES, GAME_MODE_CONFIGS } from '../src/game/GameModeConfig.js';
import assert from 'assert';

console.log('--- RUNNING COMPLETE LIVES & RECOVERY SYSTEM VERIFICATION ---');

// Mock localStorage for Node.js environment
const storageMock = {};
globalThis.window = {
  localStorage: {
    getItem: (key) => storageMock[key] ?? null,
    setItem: (key, val) => { storageMock[key] = String(val); },
    removeItem: (key) => { delete storageMock[key]; },
    clear: () => { for (const k in storageMock) delete storageMock[k]; }
  }
};
globalThis.localStorage = globalThis.window.localStorage;

// Test 1: Mode configurations
console.log('1. Verifying Game Mode Configurations...');
assert.strictEqual(GAME_MODE_CONFIGS[GAME_MODES.CLASSIC].lives, 3, 'Classic mode must have 3 lives');
assert.strictEqual(GAME_MODE_CONFIGS[GAME_MODES.CLASSIC].maxLives, 3, 'Classic mode must have 3 maxLives');
assert.strictEqual(GAME_MODE_CONFIGS[GAME_MODES.CLASSIC].missCostsLife, true, 'Classic mode miss must cost life');
assert.strictEqual(GAME_MODE_CONFIGS[GAME_MODES.CLASSIC].bombInstantGameOver, true, 'Classic mode bomb must trigger instant game over');
assert.strictEqual(GAME_MODE_CONFIGS[GAME_MODES.CLASSIC].lifeMilestoneInterval, 100, 'Classic mode milestone must be 100 points');
assert.strictEqual(GAME_MODE_CONFIGS[GAME_MODES.CLASSIC].recoveryFruitEnabled, true, 'Classic mode must allow recovery fruits');

assert.strictEqual(GAME_MODE_CONFIGS[GAME_MODES.ZEN].lives, null, 'Zen mode must not have lives');
assert.strictEqual(GAME_MODE_CONFIGS[GAME_MODES.ARCADE].lives, null, 'Arcade mode must not have lives');
console.log('   PASSED!');

// Test 2: GameState Initialization & Reset in Classic Mode
console.log('2. Verifying Classic Mode Initialization...');
const gameState = new GameState();
gameState.setMode(GAME_MODES.CLASSIC);
gameState.resetSession();

assert.strictEqual(gameState.lives, 3, 'Initial lives must be 3');
assert.strictEqual(gameState.maxLives, 3, 'Initial maxLives must be 3');
assert.strictEqual(gameState.strikes, 0, 'Initial strikes must be 0');
assert.strictEqual(gameState.hasLives(), true, 'hasLives() must return true');
assert.strictEqual(gameState.missCostsLife(), true, 'missCostsLife() must return true');
console.log('   PASSED!');

// Test 3: Life Loss Mechanics
console.log('3. Verifying Life Loss & Strike Notifications...');
let lastLifeEvent = null;
let notifiedLives = null;
let notifiedMaxLives = null;
gameState.subscribeLives((lives, maxLives, event) => {
  notifiedLives = lives;
  notifiedMaxLives = maxLives;
  lastLifeEvent = event;
});

// First miss
const fatal1 = gameState.loseLife();
assert.strictEqual(fatal1, false, 'First miss must not be fatal');
assert.strictEqual(gameState.lives, 2, 'Lives must be 2 after 1 miss');
assert.strictEqual(gameState.strikes, 1, 'Strikes must be 1');
assert.strictEqual(notifiedLives, 2);
assert.strictEqual(notifiedMaxLives, 3);
assert.strictEqual(lastLifeEvent?.type, 'lost');
assert.strictEqual(lastLifeEvent?.lostIndex, 2);
assert.strictEqual(lastLifeEvent?.livesRemaining, 2);

// Second miss
const fatal2 = gameState.loseLife();
assert.strictEqual(fatal2, false, 'Second miss must not be fatal');
assert.strictEqual(gameState.lives, 1, 'Lives must be 1 after 2 misses');
assert.strictEqual(gameState.strikes, 2, 'Strikes must be 2');
assert.strictEqual(lastLifeEvent?.lostIndex, 1);

// Test 4: Life Recovery Mechanics (Bonus Fruit)
console.log('4. Verifying Life Recovery via Bonus Fruit...');
let recoveryEventReceived = null;
gameState.subscribeLifeRecovered((event) => {
  recoveryEventReceived = event;
});

const recoveryResult = gameState.recoverLife(1, 'recovery_fruit', { x: 250, y: 300 });
assert.strictEqual(recoveryResult.recovered, true, 'Recovery must succeed when lives < maxLives');
assert.strictEqual(gameState.lives, 2, 'Lives must now be restored to 2');
assert.strictEqual(gameState.strikes, 1, 'Strikes must now be decreased to 1');
assert.strictEqual(recoveryEventReceived?.source, 'recovery_fruit');
assert.strictEqual(recoveryEventReceived?.x, 250);
assert.strictEqual(recoveryEventReceived?.y, 300);
assert.strictEqual(recoveryEventReceived?.recoveredIndex, 1);
assert.strictEqual(lastLifeEvent?.type, 'recovered');
console.log('   PASSED!');

// Test 5: Milestone Life Recovery (Score Milestones)
console.log('5. Verifying Score Milestone Recovery...');
// Currently lives = 2 / 3. Score = 0. Milestone interval is 100.
// Setting score to 120 should trigger milestone recovery
gameState.setScore(120);
assert.strictEqual(gameState.lives, 3, 'Milestone at 100 score should recover 1 life to 3');
assert.strictEqual(gameState.strikes, 0, 'Strikes should now be 0');
assert.strictEqual(recoveryEventReceived?.source, 'milestone');

// When at full health (3/3), milestone recovery should not exceed maxLives
gameState.loseLife(); // lives: 2
gameState.recoverLife(1, 'milestone'); // lives: 3
const overRecovery = gameState.recoverLife(1, 'milestone');
assert.strictEqual(overRecovery.recovered, false, 'Cannot recover beyond maxLives');
assert.strictEqual(gameState.lives, 3, 'Lives must stay capped at maxLives');
console.log('   PASSED!');

// Test 6: Fatal Life Loss (Striking out)
console.log('6. Verifying Fatal Life Loss (0 lives)...');
gameState.loseLife(); // 2
gameState.loseLife(); // 1
const fatalFinal = gameState.loseLife(); // 0
assert.strictEqual(fatalFinal, true, 'Losing 3rd life must be fatal');
assert.strictEqual(gameState.lives, 0, 'Lives must be 0');
assert.strictEqual(gameState.strikes, 3, 'Strikes must be 3');

// Cannot recover once dead (lives = 0)
const deadRecovery = gameState.recoverLife(1, 'milestone');
assert.strictEqual(deadRecovery.recovered, false, 'Dead player cannot recover lives');
assert.strictEqual(gameState.lives, 0);
console.log('   PASSED!');

// Test 7: Bomb Separation in Classic Mode
console.log('7. Verifying Bomb Separation...');
gameState.resetSession();
assert.strictEqual(gameState.lives, 3);
const bombResult = gameState.registerBombHit();
assert.strictEqual(bombResult.isGameOver, true, 'Classic mode bomb hit must be instant game over');
assert.strictEqual(gameState.lives, 0, 'Lives must be set to 0 on fatal bomb hit');
assert.strictEqual(lastLifeEvent?.type, 'bomb_fatal', 'Life event must be bomb_fatal');
console.log('   PASSED!');

// Test 8: Dynamic Configurable Max Lives
console.log('8. Verifying Dynamic Max Lives Configuration...');
gameState.resetSession();
gameState.setMaxLives(5);
assert.strictEqual(gameState.maxLives, 5, 'maxLives should be updated to 5');
gameState.recoverLife(2, 'admin');
assert.strictEqual(gameState.lives, 5, 'Can now recover up to 5 lives');

gameState.setMaxLives(2);
assert.strictEqual(gameState.maxLives, 2, 'maxLives should clamp to 2');
assert.strictEqual(gameState.lives, 2, 'Current lives must clamp to new maxLives');
console.log('   PASSED!');

// Test 9: Progression & Persistence Resilience
console.log('9. Verifying Safe Persistence and Progression Tracking...');
const progression = gameState.getProgression();
assert(progression.totalLivesLost > 0, 'totalLivesLost must be tracked');
assert(progression.totalLivesRecovered > 0, 'totalLivesRecovered must be tracked');
assert(progression.totalMilestonesAchieved > 0, 'totalMilestonesAchieved must be tracked');
assert(progression.totalBombsStruck > 0, 'totalBombsStruck must be tracked');

// Test corrupted localStorage recovery
storageMock['blade_ninja_progression'] = 'INVALID_JSON_CORRUPTED';
const freshGameState = new GameState();
const freshProg = freshGameState.getProgression();
assert.strictEqual(freshProg.totalLivesLost, 0, 'Must safely fallback on corrupt JSON');
console.log('   PASSED!');

console.log('\nALL 9 LIVES & RECOVERY SUITES PASSED FLAWLESSLY!');
