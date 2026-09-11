import { GameState, STATES } from '../src/game/GameState.js';
import { FruitManager } from '../src/game/FruitManager.js';
import { GAME_MODES, getGameModeConfig } from '../src/game/GameModeConfig.js';

let testsPassed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`PASSED: ${message}`);
  testsPassed++;
}

console.log('=== TESTING GAME MODE CONFIGURATIONS ===');

// 1. Config definitions
for (const modeId of [GAME_MODES.CLASSIC, GAME_MODES.ZEN, GAME_MODES.ARCADE, GAME_MODES.CHALLENGE]) {
  const config = getGameModeConfig(modeId);
  assert(Boolean(config), `Config exists for mode: ${modeId}`);
  assert(config.id === modeId, `Config ID matches ${modeId}`);
  assert(typeof config.name === 'string', `Config name is valid for ${modeId}`);
  assert(typeof config.difficultyMultiplier === 'number', `Difficulty multiplier is numeric for ${modeId}`);
}

console.log('\n=== TESTING CLASSIC MODE RULES ===');
const stateClassic = new GameState();
stateClassic.setMode(GAME_MODES.CLASSIC);
assert(stateClassic.hasLives() === true, 'Classic has lives');
assert(stateClassic.lives === 3, 'Classic starts with 3 lives');
assert(stateClassic.hasTimer() === false, 'Classic has no timer');
assert(stateClassic.missCostsLife() === true, 'Classic misses cost lives');

stateClassic.setState(STATES.PLAYING);
const died1 = stateClassic.loseLife();
assert(stateClassic.lives === 2, 'Life reduced to 2');
assert(died1 === false, 'Not dead yet');
const _died2 = stateClassic.loseLife();
assert(stateClassic.lives === 1, 'Life reduced to 1');
const died3 = stateClassic.loseLife();
assert(stateClassic.lives === 0, 'Lives 0');
assert(died3 === true, 'Fatal life loss detected');

console.log('\n=== TESTING ZEN MODE RULES ===');
const stateZen = new GameState();
stateZen.setMode(GAME_MODES.ZEN);
assert(stateZen.hasLives() === false, 'Zen has no lives');
assert(stateZen.hasTimer() === true, 'Zen has session timer');
assert(stateZen.timeRemaining === 90, 'Zen timer starts at 90s');
assert(stateZen.missCostsLife() === false, 'Zen misses do not cost lives');
const zenLost = stateZen.loseLife();
assert(zenLost === false, 'Zen loseLife returns false without effect');

const fruitMgrZen = new FruitManager();
fruitMgrZen.setModeConfig(stateZen.getModeConfig());
assert(fruitMgrZen.allowBombs === false, 'Zen FruitManager completely disallows bombs');

// Test timer decrement in Zen
stateZen.setState(STATES.PLAYING);
stateZen.update(5.0);
assert(Math.abs(stateZen.timeRemaining - 85.0) < 0.001, 'Zen timer decrements by dt');

console.log('\n=== TESTING ARCADE MODE RULES ===');
const stateArcade = new GameState();
stateArcade.setMode(GAME_MODES.ARCADE);
assert(stateArcade.hasLives() === false, 'Arcade has no lives');
assert(stateArcade.hasTimer() === true, 'Arcade has timer');
assert(stateArcade.timeRemaining === 60, 'Arcade starts with 60s timer');
assert(stateArcade.missCostsLife() === false, 'Arcade misses do not cost lives');

// Test bomb hit in Arcade mode
stateArcade.setState(STATES.PLAYING);
stateArcade.setScore(50);
stateArcade.setCombo(4);
const bombResult = stateArcade.registerBombHit();
assert(bombResult.scoreLost === 10, 'Arcade bomb hit lost 10 points');
assert(stateArcade.score === 40, 'Arcade score deducted to 40');
assert(stateArcade.combo === 0, 'Arcade combo reset on bomb');
assert(bombResult.isGameOver === false, 'Arcade bomb hit is NOT fatal');

console.log('\n=== TESTING CHALLENGE MODE RULES ===');
const stateChallenge = new GameState();
stateChallenge.setMode(GAME_MODES.CHALLENGE);
assert(stateChallenge.hasLives() === true, 'Challenge mode has 3 lives');
assert(stateChallenge.lives === 3, 'Challenge mode starts with 3 lives');
assert(stateChallenge.missCostsLife() === true, 'Challenge misses cost lives');
assert(stateChallenge.modeConfig.dynamicGravity === true, 'Challenge mode uses dynamic gravity');
assert(stateChallenge.modeConfig.dynamicSpeed === true, 'Challenge mode uses dynamic speed');
assert(stateChallenge.modeConfig.dynamicComboPressure === true, 'Challenge mode uses dynamic combo pressure');

stateChallenge.setState(STATES.PLAYING);
const initialTimeout = stateChallenge.getEffectiveComboTimeout();
assert(Math.abs(initialTimeout - 0.42) < 0.01, `Initial challenge combo timeout is 0.42 (got ${initialTimeout})`);

// Advance session time in challenge mode to trigger difficulty ramp
stateChallenge.update(40.0);
const midTimeout = stateChallenge.getEffectiveComboTimeout();
assert(midTimeout < initialTimeout, `Challenge combo timeout decreased under difficulty pressure (${midTimeout} < ${initialTimeout})`);

const fruitMgrChallenge = new FruitManager();
fruitMgrChallenge.setModeConfig(stateChallenge.getModeConfig());
assert(fruitMgrChallenge.allowBombs === true, 'Challenge mode allows bombs');
fruitMgrChallenge.update(35.0, 1000, 700);
assert(fruitMgrChallenge.difficulty > 0, `Challenge difficulty ramped to ${fruitMgrChallenge.difficulty}`);

const launchParams = fruitMgrChallenge.computeLaunchParams(200, 500, 200, 1000, 700);
assert(Number.isFinite(launchParams.vy) && launchParams.vy < 0, 'Dynamic vertical launch velocity computed');
assert(Number.isFinite(launchParams.vx), 'Dynamic horizontal launch velocity computed');
assert(launchParams.x >= 48 && launchParams.x <= 952, 'Launch x is within safe visible bounds');

console.log(`\nALL ${testsPassed} GAME MODE VERIFICATION TESTS PASSED SUCCESSFULLY!`);
