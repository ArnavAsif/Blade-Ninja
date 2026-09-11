/**
 * Professional Arcade Audio System.
 *
 * Features:
 * - High-definition authentic Fruit Ninja audio assets loaded via Web Audio API
 * - Layered, visceral, juicy fruit slicing: razor clean cut + fruit-specific flesh impact + visceral splatters
 * - Organic pitch variation and cyclical asset selection for zero repetition
 * - Multi-tier escalating combo fanfare (2x to 9x+)
 * - Heavy bomb fuse hissing, bomb throw, and sub-bass explosive punch
 * - Full audio mixing bus: Master Gain, SFX Gain, Ambient Music Gain, and DynamicsCompressor
 * - Concurrency limiter & voice pooling (16 concurrent voices max to prevent audio clipping)
 * - Complete UI sound suite: button click, button hover, menu whoosh, game start, game over, high score
 * - Robust mobile autoplay unlocking and safe offline oscillator fallback
 */

const STORAGE_KEY_AUDIO = 'blade_ninja_audio_settings';

// Audio asset manifest mapped to public/sounds/
const SOUND_ASSETS = Object.freeze({
  // Clean Razor Slices
  cleanSlice1: '/sounds/Clean-Slice-1.wav',
  cleanSlice2: '/sounds/Clean-Slice-2.wav',
  cleanSlice3: '/sounds/Clean-Slice-3.wav',

  // Fruit-Specific Juicy Impacts
  impactWatermelon: '/sounds/Impact-Watermelon.wav',
  impactApple: '/sounds/Impact-Apple.wav',
  impactOrange: '/sounds/Impact-Orange.wav',
  impactBanana: '/sounds/Impact-Banana.wav',
  impactPineapple: '/sounds/Impact-Pineapple.wav',
  impactStrawberry: '/sounds/Impact-Strawberry.wav',
  impactCoconut1: '/sounds/Impact-Coconut.wav',
  impactCoconut2: '/sounds/Impact-Coconut-More-Attack.wav',
  impactKiwi: '/sounds/Impact-kiwifruit.wav',
  impactPeach: '/sounds/Impact-Plum.wav',
  impactDragonfruit: '/sounds/dragonfruit.wav',

  // Visceral Impacts & Wet Splatters
  visceral1: '/sounds/Visceral-impact-1.wav',
  visceral2: '/sounds/Visceral-impact-2.wav',
  visceral3: '/sounds/Visceral-impact-3.wav',
  splatterMed1: '/sounds/Splatter-Medium-1.wav',
  splatterMed2: '/sounds/Splatter-Medium-2.wav',
  splatterSmall1: '/sounds/Splatter-Small-1.wav',
  splatterSmall2: '/sounds/Splatter-Small-2.wav',

  // Blade Whooshes / Swipes
  swordSwipe1: '/sounds/Sword-swipe-1.wav',
  swordSwipe2: '/sounds/Sword-swipe-2.wav',
  swordSwipe3: '/sounds/Sword-swipe-3.wav',
  swordSwipe4: '/sounds/Sword-swipe-4.wav',
  swordSwipe5: '/sounds/Sword-swipe-5.wav',
  swordSwipe6: '/sounds/Sword-swipe-6.wav',

  // Escalating Combos
  combo1: '/sounds/combo-1.wav',
  combo2: '/sounds/combo-2.wav',
  combo3: '/sounds/combo-3.wav',
  combo4: '/sounds/combo-4.wav',
  combo5: '/sounds/combo-5.wav',
  combo6: '/sounds/Combo-6.wav',
  combo7: '/sounds/Combo-7.wav',
  combo8: '/sounds/Combo-8.wav',
  comboGeneric: '/sounds/Combo.wav',
  critical: '/sounds/Critical.wav',

  // Multi-Slice & Blitz Fanfare
  blitz1: '/sounds/combo-blitz-1.wav',
  blitz2: '/sounds/combo-blitz-2.wav',
  blitz3: '/sounds/combo-blitz-3.wav',
  blitz4: '/sounds/combo-blitz-4.wav',
  blitz5: '/sounds/combo-blitz-5.wav',
  blitz6: '/sounds/combo-blitz-6.wav',

  // Fever Mode Audio & Atmosphere
  feverBacking: '/sounds/Combo-Blitz-Backing.wav',
  feverBackingLight: '/sounds/Combo-Blitz-Backing-Light.wav',
  feverEnd: '/sounds/Combo-Blitz-Backing-End.wav',

  // Bombs & Hazards
  bombExplode: '/sounds/Bomb-explode.wav',
  bombFuse: '/sounds/Bomb-Fuse.wav',
  throwBomb: '/sounds/Throw-bomb.wav',

  // Fruit Launch
  throwFruit: '/sounds/Throw-fruit.wav',

  // Life & Health
  extraLife: '/sounds/extra-life.wav',
  strikeMiss: '/sounds/gank.wav',

  // UI & Feedback
  uiButtonClick: '/sounds/ui-button-push.wav',
  uiButtonNext: '/sounds/Next-screen-button.wav',
  uiButtonHover: '/sounds/gutsus-shop-scroll.wav',
  uiScreenWhoosh: '/sounds/ui-screen-whoosh.wav',
  gameStart: '/sounds/Game-start.wav',
  gameOver: '/sounds/Game-over.wav',
  newBestScore: '/sounds/New-best-score.wav',
  pause: '/sounds/Pause.wav',
  unpause: '/sounds/Unpause.wav',

  // Timer
  timeTick: '/sounds/Time-tick.wav',
  timeTock: '/sounds/Time-tock.wav',
  timeBeep: '/sounds/time-beep.wav',
  timeUp: '/sounds/time-up.wav',

  // Power-Ups
  powerUpFreeze: '/sounds/Bonus-Banana-Freeze.wav',
  powerUpFrenzy: '/sounds/Bonus-Banana-Frenzy.wav',
  powerUpDouble: '/sounds/Bonus-Banana-X2.wav',
  powerUpLife: '/sounds/extra-life.wav',
  powerUpBlade: '/sounds/firecracker-blade-burn.wav',
  powerUpBladeLightning: '/sounds/blade-lightning-1.wav',
  powerUpPickup: '/sounds/powerup-starfruit.wav',
  powerUpExpire: '/sounds/pome-rampdown.wav',
});

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGainNode = null;
    this.sfxGainNode = null;
    this.musicGainNode = null;
    this.compressorNode = null;

    // Persisted settings
    const settings = this.loadSettings();
    this.soundEnabled = settings.soundEnabled;
    this.musicEnabled = settings.musicEnabled;
    this.masterVolume = settings.masterVolume;
    this.sfxVolume = settings.sfxVolume ?? 1.0;
    this.musicVolume = settings.musicVolume ?? 0.35;

    this.initialized = false;
    this.unlocked = false;

    // Decoded AudioBuffer cache
    this.buffers = new Map();
    this.loadingPromises = new Map();
    this.activeVoices = new Set();
    this.maxConcurrentVoices = 16;

    // Sound variation tracking
    this.cleanSliceIndex = 0;
    this.swordSwipeIndex = 0;
    this.lastSliceTime = 0;
    this.lastThrowTime = 0;

    // Bomb fuse looping audio state
    this.bombFuseSource = null;
    this.bombFuseGain = null;
    this.isBombFusePlaying = false;

    // Fever mode looping backing music state
    this.feverSource = null;
    this.feverGain = null;
    this.isFeverPlaying = false;

    // Ambient music synthesizer state
    this.musicIntervalId = null;
    this.isMusicActive = false;
    this.ambientNotes = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63];
    this.ambientStep = 0;

    // Settings listeners
    this.settingsListeners = new Set();

    // Register mobile / autoplay user gesture unlocker
    this.handleFirstUserGesture = this.unlockAudio.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.handleFirstUserGesture, { passive: true, once: true });
      window.addEventListener('keydown', this.handleFirstUserGesture, { passive: true, once: true });
      window.addEventListener('touchstart', this.handleFirstUserGesture, { passive: true, once: true });
    }
  }

  // Safe localStorage loading
  loadSettings() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return { soundEnabled: true, musicEnabled: true, masterVolume: 0.8, sfxVolume: 1.0, musicVolume: 0.35 };
      }
      const raw = localStorage.getItem(STORAGE_KEY_AUDIO);
      if (!raw) return { soundEnabled: true, musicEnabled: true, masterVolume: 0.8, sfxVolume: 1.0, musicVolume: 0.35 };
      const parsed = JSON.parse(raw);
      return {
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : true,
        masterVolume: Number.isFinite(parsed.masterVolume)
          ? Math.max(0, Math.min(1, parsed.masterVolume))
          : 0.8,
        sfxVolume: Number.isFinite(parsed.sfxVolume)
          ? Math.max(0, Math.min(1, parsed.sfxVolume))
          : 1.0,
        musicVolume: Number.isFinite(parsed.musicVolume)
          ? Math.max(0, Math.min(1, parsed.musicVolume))
          : 0.35,
      };
    } catch {
      return { soundEnabled: true, musicEnabled: true, masterVolume: 0.8, sfxVolume: 1.0, musicVolume: 0.35 };
    }
  }

  saveSettings() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const payload = JSON.stringify({
          soundEnabled: this.soundEnabled,
          musicEnabled: this.musicEnabled,
          masterVolume: this.masterVolume,
          sfxVolume: this.sfxVolume,
          musicVolume: this.musicVolume,
        });
        localStorage.setItem(STORAGE_KEY_AUDIO, payload);
      }
    } catch {
      // Ignore quota/security errors
    }
  }

  init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // 1. Studio-grade Master Dynamics Compressor to eliminate audio clipping
        if (typeof this.ctx.createDynamicsCompressor === 'function') {
          this.compressorNode = this.ctx.createDynamicsCompressor();
          this.compressorNode.threshold.setValueAtTime(-6, this.ctx.currentTime);
          this.compressorNode.knee.setValueAtTime(10, this.ctx.currentTime);
          this.compressorNode.ratio.setValueAtTime(5, this.ctx.currentTime);
          this.compressorNode.attack.setValueAtTime(0.003, this.ctx.currentTime);
          this.compressorNode.release.setValueAtTime(0.12, this.ctx.currentTime);
        }

        // 2. Master Gain
        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

        if (this.compressorNode) {
          this.compressorNode.connect(this.masterGainNode);
        }
        this.masterGainNode.connect(this.ctx.destination);

        const targetNode = this.compressorNode || this.masterGainNode;

        // 3. SFX Channel
        this.sfxGainNode = this.ctx.createGain();
        const effectiveSfx = this.soundEnabled ? this.sfxVolume : 0.0;
        this.sfxGainNode.gain.setValueAtTime(effectiveSfx, this.ctx.currentTime);
        this.sfxGainNode.connect(targetNode);

        // 4. Ambient Music Channel
        this.musicGainNode = this.ctx.createGain();
        const effectiveMusic = this.musicEnabled ? this.musicVolume : 0.0;
        this.musicGainNode.gain.setValueAtTime(effectiveMusic, this.ctx.currentTime);
        this.musicGainNode.connect(targetNode);

        this.initialized = true;

        // Preload core sound assets asynchronously
        this.preloadAudioAssets();

        if (this.ctx.state === 'running' && this.musicEnabled) {
          this.startAmbientMusic();
        }
      }
    } catch {
      // AudioContext unavailable
    }
  }

  /**
   * Preloads high-priority sound assets into decoded AudioBuffers in background.
   */
  async preloadAudioAssets() {
    if (!this.ctx || typeof window === 'undefined' || !window.fetch) return;

    const coreKeys = [
      'cleanSlice1', 'cleanSlice2', 'cleanSlice3',
      'impactWatermelon', 'impactApple', 'impactOrange', 'impactBanana',
      'impactPineapple', 'impactStrawberry', 'impactCoconut1', 'impactCoconut2',
      'impactKiwi', 'impactPeach', 'impactDragonfruit',
      'visceral1', 'visceral2', 'visceral3',
      'splatterMed1', 'splatterSmall1',
      'swordSwipe1', 'swordSwipe2', 'swordSwipe3', 'swordSwipe4',
      'combo1', 'combo2', 'combo3', 'combo4', 'combo5', 'combo6', 'combo7', 'combo8',
      'bombExplode', 'bombFuse', 'throwBomb', 'throwFruit',
      'extraLife', 'strikeMiss',
      'powerUpFreeze', 'powerUpFrenzy', 'powerUpDouble', 'powerUpLife', 'powerUpBlade', 'powerUpBladeLightning', 'powerUpPickup', 'powerUpExpire',
      'uiButtonClick', 'uiButtonHover', 'uiScreenWhoosh', 'gameStart', 'gameOver', 'newBestScore',
      'pause', 'unpause'
    ];

    for (const key of coreKeys) {
      const url = SOUND_ASSETS[key];
      if (url && !this.buffers.has(key) && !this.loadingPromises.has(key)) {
        this.loadAudioBuffer(key, url).catch(() => {});
      }
    }
  }

  async loadAudioBuffer(key, url) {
    if (this.buffers.has(key)) return this.buffers.get(key);
    if (this.loadingPromises.has(key)) return this.loadingPromises.get(key);

    const promise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        if (!this.ctx) return null;
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(key, audioBuffer);
        return audioBuffer;
      } catch {
        return null;
      } finally {
        this.loadingPromises.delete(key);
      }
    })();

    this.loadingPromises.set(key, promise);
    return promise;
  }

  unlockAudio() {
    this.init();
    this.unlocked = true;
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume().then(() => {
        if (this.musicEnabled && !this.isMusicActive) {
          this.startAmbientMusic();
        }
      }).catch(() => {});
    } else if (this.ctx && this.ctx.state === 'running') {
      if (this.musicEnabled && !this.isMusicActive) {
        this.startAmbientMusic();
      }
    }
    return Promise.resolve();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // --- AUDIO MIXING CONTROLS ---

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
    this.saveSettings();
    this.notifySettings();
  }

  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxGainNode && this.ctx) {
      const effective = this.soundEnabled ? this.sfxVolume : 0.0;
      this.sfxGainNode.gain.setValueAtTime(effective, this.ctx.currentTime);
    }
    this.saveSettings();
    this.notifySettings();
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGainNode && this.ctx) {
      const effective = this.musicEnabled ? this.musicVolume : 0.0;
      this.musicGainNode.gain.setValueAtTime(effective, this.ctx.currentTime);
    }
    this.saveSettings();
    this.notifySettings();
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = Boolean(enabled);
    if (this.sfxGainNode && this.ctx) {
      const effective = this.soundEnabled ? this.sfxVolume : 0.0;
      this.sfxGainNode.gain.setValueAtTime(effective, this.ctx.currentTime);
    }
    if (!this.soundEnabled) {
      this.stopBombFuse();
    }
    this.saveSettings();
    this.notifySettings();
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);
    if (this.musicGainNode && this.ctx) {
      const effective = this.musicEnabled ? this.musicVolume : 0.0;
      this.musicGainNode.gain.setValueAtTime(effective, this.ctx.currentTime);
    }
    if (this.musicEnabled) {
      this.startAmbientMusic();
    } else {
      this.stopAmbientMusic();
    }
    this.saveSettings();
    this.notifySettings();
  }

  toggleSound() {
    this.setSoundEnabled(!this.soundEnabled);
    return this.soundEnabled;
  }

  toggleMusic() {
    this.setMusicEnabled(!this.musicEnabled);
    return this.musicEnabled;
  }

  toggleMute() {
    const newState = this.toggleSound();
    return !newState;
  }

  get muted() {
    return !this.soundEnabled;
  }

  set muted(val) {
    this.setSoundEnabled(!val);
  }

  subscribeSettings(listener) {
    this.settingsListeners.add(listener);
    try {
      listener({
        soundEnabled: this.soundEnabled,
        musicEnabled: this.musicEnabled,
        masterVolume: this.masterVolume,
        sfxVolume: this.sfxVolume,
        musicVolume: this.musicVolume,
      });
    } catch (err) {
      console.error('Error in initial audio settings subscriber:', err);
    }
    return () => this.settingsListeners.delete(listener);
  }

  notifySettings() {
    const payload = {
      soundEnabled: this.soundEnabled,
      musicEnabled: this.musicEnabled,
      masterVolume: this.masterVolume,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
    };
    for (const listener of this.settingsListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('Error in audio settings listener:', err);
      }
    }
  }

  // --- AUDIO PLAYBACK CORE ---

  /**
   * High-performance AudioBuffer player with voice pooling, dynamic gain,
   * pitch jitter, and automatic cleanup.
   */
  playSoundBuffer(key, options = {}) {
    if (!this.soundEnabled || !this.ctx) return null;
    this.resume();

    const buffer = this.buffers.get(key);
    if (!buffer) {
      // If buffer is still loading asynchronously, attempt load for next time
      if (!this.loadingPromises.has(key) && SOUND_ASSETS[key]) {
        this.loadAudioBuffer(key, SOUND_ASSETS[key]).catch(() => {});
      }
      return null;
    }

    // Concurrency limit enforcement
    if (this.activeVoices.size >= this.maxConcurrentVoices) {
      const oldest = this.activeVoices.values().next().value;
      if (oldest) {
        try { oldest.stop(); } catch {}
        this.activeVoices.delete(oldest);
      }
    }

    try {
      const now = this.ctx.currentTime;
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();

      source.buffer = buffer;

      // Pitch variation: options.playbackRate or random jitter
      const pitchJitter = options.pitchJitter ?? 0.08;
      const baseRate = options.playbackRate ?? 1.0;
      source.playbackRate.value = Math.max(0.2, baseRate + (Math.random() - 0.5) * pitchJitter * 2);

      // Volume scaling
      const volume = (options.volume ?? 1.0) * (0.94 + Math.random() * 0.12);
      gain.gain.setValueAtTime(Math.min(1.5, volume), now);

      source.connect(gain);
      gain.connect(this.sfxGainNode);

      const delay = options.delay ?? 0;
      source.start(now + delay);

      this.activeVoices.add(source);
      source.onended = () => {
        this.activeVoices.delete(source);
        try {
          source.disconnect();
          gain.disconnect();
        } catch {}
      };

      return source;
    } catch {
      return null;
    }
  }

  // --- FRUIT SLICE AUDIO (AUTHENTIC LAYERED ARCADE SOUND) ---

  /**
   * Plays satisfying physical fruit slicing sound.
   * Eliminates generic "tuk tuk" by layering:
   * 1. Razor-sharp clean blade slice (Clean-Slice-1..3 rotating)
   * 2. Authentic wet, juicy fruit flesh impact tailored to fruit type
   * 3. Extra visceral punch / splatter on combos
   */
  playFruitSlice(fruitType = 'watermelon', combo = 1) {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    // Throttling protection for multi-cuts in identical frame
    const nowMs = performance.now();
    const timeSinceLast = nowMs - this.lastSliceTime;
    this.lastSliceTime = nowMs;

    const microVolumeMod = timeSinceLast < 25 ? 0.85 : 1.0;

    // 1. Layer 1: Razor Clean Blade Slice (rotates through 3 clean slices with pitch variation)
    const cleanSlices = ['cleanSlice1', 'cleanSlice2', 'cleanSlice3'];
    const chosenClean = cleanSlices[this.cleanSliceIndex % cleanSlices.length];
    this.cleanSliceIndex++;

    const playedClean = this.playSoundBuffer(chosenClean, {
      volume: 0.95 * microVolumeMod,
      pitchJitter: 0.09,
    });

    // 2. Layer 2: Fruit-Specific Wet Impact
    let impactKey = 'impactWatermelon';
    switch (fruitType) {
      case 'apple':
        impactKey = 'impactApple';
        break;
      case 'orange':
        impactKey = 'impactOrange';
        break;
      case 'banana':
        impactKey = 'impactBanana';
        break;
      case 'pineapple':
        impactKey = 'impactPineapple';
        break;
      case 'strawberry':
        impactKey = 'impactStrawberry';
        break;
      case 'coconut':
        impactKey = Math.random() < 0.5 ? 'impactCoconut1' : 'impactCoconut2';
        break;
      case 'kiwi':
        impactKey = 'impactKiwi';
        break;
      case 'peach':
        impactKey = 'impactPeach';
        break;
      case 'dragonfruit':
        impactKey = 'impactDragonfruit';
        break;
      default:
        impactKey = 'impactWatermelon';
        break;
    }

    this.playSoundBuffer(impactKey, {
      volume: 0.88 * microVolumeMod,
      pitchJitter: 0.12,
      delay: 0.005, // 5ms micro-offset creates organic depth
    });

    // 3. Layer 3: Visceral Impact / Wet Splatter for high satisfaction
    if (combo >= 3 || Math.random() < 0.25) {
      const viscerals = ['visceral1', 'visceral2', 'visceral3', 'splatterMed1', 'splatterMed2'];
      const chosenVisceral = viscerals[Math.floor(Math.random() * viscerals.length)];
      this.playSoundBuffer(chosenVisceral, {
        volume: Math.min(1.0, 0.65 + combo * 0.08) * microVolumeMod,
        pitchJitter: 0.10,
        delay: 0.012,
      });
    }

    // Fallback synthesis if assets are still fetching or offline
    if (!playedClean) {
      this.playFallbackSlice(fruitType);
    }
  }

  /**
   * Synthesized fallback slice sound (used only when assets are still fetching or offline).
   */
  playFallbackSlice(fruitType) {
    try {
      const now = this.ctx.currentTime;
      const pitchJitter = 0.92 + Math.random() * 0.16;

      let baseCutFreq = 1250;
      if (fruitType === 'apple' || fruitType === 'strawberry' || fruitType === 'kiwi') {
        baseCutFreq = 1450;
      } else if (fruitType === 'coconut') {
        baseCutFreq = 920;
      }

      const cutOsc = this.ctx.createOscillator();
      const cutGain = this.ctx.createGain();

      cutOsc.type = 'sine';
      cutOsc.frequency.setValueAtTime(baseCutFreq * pitchJitter, now);
      cutOsc.frequency.exponentialRampToValueAtTime(120 * pitchJitter, now + 0.065);

      cutGain.gain.setValueAtTime(0.15, now);
      cutGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      cutOsc.connect(cutGain);
      cutGain.connect(this.sfxGainNode);

      cutOsc.start(now);
      cutOsc.stop(now + 0.07);
    } catch {}
  }

  // --- COMBO AUDIO ---

  /**
   * Escalating combo sound escalating with combo count (2x to 8x+).
   */
  playCombo(comboCount = 2) {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    const clampedCombo = Math.min(8, Math.max(1, comboCount));
    const comboKey = `combo${clampedCombo}`;

    const played = this.playSoundBuffer(comboKey, {
      volume: Math.min(1.15, 0.85 + clampedCombo * 0.04),
      playbackRate: 1.0,
      pitchJitter: 0.02,
    });

    if (!played) {
      // Fallback generic combo
      this.playSoundBuffer('comboGeneric', { volume: 0.9 });
    }
  }

  /**
   * Powerful multi-slice fanfare for slicing multiple fruits in a single swipe stroke.
   * Plays escalating blitz audio (combo-blitz-1 to combo-blitz-6).
   */
  playMultiSlice(sliceCount = 2) {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    const tier = Math.min(6, Math.max(1, sliceCount - 1));
    const blitzKey = `blitz${tier}`;

    const played = this.playSoundBuffer(blitzKey, {
      volume: Math.min(1.25, 0.92 + tier * 0.05),
      pitchJitter: 0.02,
    });

    // Layer with higher-tier combo chord for mega multi-slices (4+ fruits)
    if (sliceCount >= 4) {
      const extraKey = sliceCount >= 5 ? 'combo8' : 'combo7';
      this.playSoundBuffer(extraKey, { volume: 0.88, delay: 0.03 });
    }

    if (!played) {
      this.playCombo(Math.min(8, sliceCount + 1));
    }
  }

  /**
   * Crisp, rewarding audio cue when a fruit is sliced cleanly through its center.
   */
  playPerfectSlice() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    // 1. Play authentic critical impact sample
    const played = this.playSoundBuffer('critical', {
      volume: 1.15,
      pitchJitter: 0.03,
    });

    // 2. Synthesize high-frequency crystalline resonance chime
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1480, now);
      osc.frequency.exponentialRampToValueAtTime(2960, now + 0.16);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.21);
    } catch {}

    if (!played) {
      this.playSoundBuffer('cleanSlice1', { volume: 1.0 });
    }
  }

  // --- FEVER MODE AUDIO ---

  /**
   * High-energy fanfare announcing entry into Fever Mode.
   */
  playFeverActivate() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    this.playSoundBuffer('blitz5', { volume: 1.2 });
    this.playSoundBuffer('combo8', { volume: 1.05, delay: 0.04 });
  }

  /**
   * Starts looping energetic Fever Mode backing music track with smooth fade-in.
   */
  startFeverMusic() {
    if (!this.soundEnabled || !this.ctx || this.isFeverPlaying) return;
    this.resume();

    const buffer = this.buffers.get('feverBacking');
    if (!buffer) return;

    try {
      this.feverSource = this.ctx.createBufferSource();
      this.feverGain = this.ctx.createGain();

      this.feverSource.buffer = buffer;
      this.feverSource.loop = true;

      const now = this.ctx.currentTime;
      this.feverGain.gain.setValueAtTime(0.001, now);
      this.feverGain.gain.linearRampToValueAtTime(0.80, now + 0.28);

      this.feverSource.connect(this.feverGain);
      this.feverGain.connect(this.musicGainNode || this.masterGainNode);

      this.feverSource.start();
      this.isFeverPlaying = true;
    } catch {}
  }

  /**
   * Smoothly fades out Fever backing track and plays resolving end fanfare.
   */
  stopFeverMusic() {
    if (!this.isFeverPlaying) return;
    this.isFeverPlaying = false;

    if (this.feverGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.feverGain.gain.setValueAtTime(this.feverGain.gain.value, now);
        this.feverGain.gain.linearRampToValueAtTime(0.001, now + 0.35);
      } catch {}
    }

    if (this.feverSource) {
      const src = this.feverSource;
      setTimeout(() => {
        try {
          src.stop();
          src.disconnect();
        } catch {}
      }, 380);
      this.feverSource = null;
    }

    // Play smooth resolving wind-down audio
    this.playSoundBuffer('feverEnd', { volume: 0.95 });
  }

  // --- BOMB AUDIO ---

  /**
   * Starts looping hissing fuse warning sound when a bomb is active on screen.
   */
  startBombFuse() {
    if (!this.soundEnabled || !this.ctx || this.isBombFusePlaying) return;
    this.resume();

    const buffer = this.buffers.get('bombFuse');
    if (!buffer) return;

    try {
      this.bombFuseSource = this.ctx.createBufferSource();
      this.bombFuseGain = this.ctx.createGain();

      this.bombFuseSource.buffer = buffer;
      this.bombFuseSource.loop = true;

      this.bombFuseGain.gain.setValueAtTime(0.65, this.ctx.currentTime);

      this.bombFuseSource.connect(this.bombFuseGain);
      this.bombFuseGain.connect(this.sfxGainNode);

      this.bombFuseSource.start();
      this.isBombFusePlaying = true;
    } catch {}
  }

  /**
   * Smoothly stops the hissing fuse sound when all bombs leave the screen.
   */
  stopBombFuse() {
    if (!this.isBombFusePlaying) return;
    this.isBombFusePlaying = false;

    if (this.bombFuseGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.bombFuseGain.gain.setValueAtTime(this.bombFuseGain.gain.value, now);
        this.bombFuseGain.gain.linearRampToValueAtTime(0.001, now + 0.08);
      } catch {}
    }

    if (this.bombFuseSource) {
      const src = this.bombFuseSource;
      setTimeout(() => {
        try {
          src.stop();
          src.disconnect();
        } catch {}
      }, 100);
      this.bombFuseSource = null;
    }
  }

  /**
   * Powerful bomb explosion with punchy impact and deep sub-bass drop.
   */
  playBombExplosion() {
    this.stopBombFuse();
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    // 1. Play real explosion sample
    const played = this.playSoundBuffer('bombExplode', {
      volume: 1.25,
      pitchJitter: 0.04,
    });

    // 2. Layer deep sub-bass 35Hz drop for physical room-shaking low-end punch
    try {
      const now = this.ctx.currentTime;
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();

      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + 0.45);

      subGain.gain.setValueAtTime(0.40, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      sub.connect(subGain);
      subGain.connect(this.sfxGainNode);

      sub.start(now);
      sub.stop(now + 0.46);
    } catch {}

    if (!played) {
      // Fallback synthesis if asset is not loaded
      this.playFallbackBomb();
    }
  }

  playFallbackBomb() {
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.35);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGainNode);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {}
  }

  playBombThrow() {
    this.playSoundBuffer('throwBomb', { volume: 0.8, pitchJitter: 0.05 });
  }

  // --- FRUIT THROW AUDIO ---

  playFruitThrow() {
    const now = performance.now();
    if (now - this.lastThrowTime < 70) return; // Prevent excessive overlap on multi-launches
    this.lastThrowTime = now;

    this.playSoundBuffer('throwFruit', { volume: 0.65, pitchJitter: 0.12 });
  }

  // --- BLADE SWOOSH AUDIO ---

  playSwoosh(speed = 600) {
    if (!this.soundEnabled || !this.ctx) return;

    const swipes = ['swordSwipe1', 'swordSwipe2', 'swordSwipe3', 'swordSwipe4', 'swordSwipe5', 'swordSwipe6'];
    const chosen = swipes[this.swordSwipeIndex % swipes.length];
    this.swordSwipeIndex++;

    const speedNorm = Math.min(1.0, Math.max(0.0, (speed - 500) / 1200));
    const rate = 0.92 + speedNorm * 0.28;
    const volume = 0.60 + speedNorm * 0.35;

    const played = this.playSoundBuffer(chosen, {
      playbackRate: rate,
      volume,
      pitchJitter: 0.05,
    });

    if (!played) {
      // Fallback swoosh
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start(now);
        osc.stop(now + 0.095);
      } catch {}
    }
  }

  // --- LIFE LOST & RECOVERY AUDIO ---

  playLifeLost() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    // Layer sharp buzzer strike transient with visceral flesh impact
    const played = this.playSoundBuffer('strikeMiss', { volume: 0.95, pitchJitter: 0.04 });
    this.playSoundBuffer('visceral1', { volume: 0.85, playbackRate: 0.82, delay: 0.005 });

    if (!played) {
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.14);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start(now);
        osc.stop(now + 0.15);
      } catch {}
    }
  }

  playFruitMissed() {
    this.playLifeLost();
  }

  playLifeRecovered() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    // Play authentic uplifting extra-life fanfare
    const played = this.playSoundBuffer('extraLife', { volume: 1.05, pitchJitter: 0.02 });

    if (!played) {
      try {
        const now = this.ctx.currentTime;
        const chord = [523.25, 659.25, 783.99, 1046.50];
        chord.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.04);
          gain.gain.setValueAtTime(0.12, now + i * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.35);
          osc.connect(gain);
          gain.connect(this.sfxGainNode);
          osc.start(now + i * 0.04);
          osc.stop(now + i * 0.04 + 0.36);
        });
      } catch {}
    }
  }

  // --- POWER-UP AUDIO SUITE ---

  /**
   * High-impact pickup slice sound when a power-up orb is sliced open.
   */
  playPowerUpPickup(_type) {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    // 1. Layer clean razor slice transient
    this.playSoundBuffer('cleanSlice1', { volume: 0.95, pitchJitter: 0.05 });
    // 2. Play sparkling starfruit pickup chime
    const played = this.playSoundBuffer('powerUpPickup', { volume: 1.05, pitchJitter: 0.04 });

    if (!played) {
      try {
        const now = this.ctx.currentTime;
        const chime = [659.25, 880.0, 1174.66, 1760.0];
        chime.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.035);
          gain.gain.setValueAtTime(0.12, now + idx * 0.035);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.28);
          osc.connect(gain);
          gain.connect(this.sfxGainNode);
          osc.start(now + idx * 0.035);
          osc.stop(now + idx * 0.035 + 0.29);
        });
      } catch {}
    }
  }

  /**
   * Distinct activation fanfare tailored to the activated power-up type.
   */
  playPowerUpActivate(type) {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    let key = 'powerUpFreeze';
    switch (type) {
      case 'slow_motion':
        key = 'powerUpFreeze';
        break;
      case 'frenzy':
        key = 'powerUpFrenzy';
        break;
      case 'double_score':
        key = 'powerUpDouble';
        break;
      case 'life_restore':
        key = 'powerUpLife';
        break;
      case 'blade_boost':
        key = 'powerUpBlade';
        this.playSoundBuffer('powerUpBladeLightning', { volume: 0.85, delay: 0.04 });
        break;
      default:
        key = 'powerUpFreeze';
        break;
    }

    const played = this.playSoundBuffer(key, { volume: 1.15, pitchJitter: 0.02 });

    if (!played) {
      // Synthesized fallbacks
      try {
        const now = this.ctx.currentTime;
        if (type === 'slow_motion') {
          // Low resonant freeze drone + high crystalline sweep
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(220, now + 0.45);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.connect(gain);
          gain.connect(this.sfxGainNode);
          osc.start(now);
          osc.stop(now + 0.46);
        } else if (type === 'frenzy') {
          // Rapid upbeat fanfare arpeggio
          const notes = [440, 554.37, 659.25, 880, 1108.73];
          notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.04);
            gain.gain.setValueAtTime(0.12, now + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.22);
            osc.connect(gain);
            gain.connect(this.sfxGainNode);
            osc.start(now + idx * 0.04);
            osc.stop(now + idx * 0.04 + 0.23);
          });
        } else if (type === 'double_score') {
          // Bell chime duo
          const chime = [523.25, 1046.50];
          chime.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.05);
            gain.gain.setValueAtTime(0.16, now + idx * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.35);
            osc.connect(gain);
            gain.connect(this.sfxGainNode);
            osc.start(now + idx * 0.05);
            osc.stop(now + idx * 0.05 + 0.36);
          });
        } else if (type === 'blade_boost') {
          // Roaring fire surge sweep
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(720, now + 0.32);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(this.sfxGainNode);
          osc.start(now);
          osc.stop(now + 0.36);
        }
      } catch {}
    }
  }

  /**
   * Smooth wind-down audio cue when a power-up timer elapses.
   */
  playPowerUpExpire(_type) {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    const played = this.playSoundBuffer('powerUpExpire', { volume: 0.85, pitchJitter: 0.02 });

    if (!played) {
      try {
        const now = this.ctx.currentTime;
        const desc = [783.99, 659.25, 523.25];
        desc.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.09, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);
          osc.connect(gain);
          gain.connect(this.sfxGainNode);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.21);
        });
      } catch {}
    }
  }

  /**
   * Crisply plays critical slice sound when slicing with Blade Boost active.
   */
  playCriticalSlice() {
    this.playSoundBuffer('critical', { volume: 0.95, pitchJitter: 0.05 });
  }

  // --- UI SOUNDS ---

  playButtonClick() {
    const played = this.playSoundBuffer('uiButtonClick', { volume: 0.85, pitchJitter: 0.04 });
    if (!played) {
      this.playSoundBuffer('uiButtonNext', { volume: 0.75 });
    }
  }

  playButtonHover() {
    this.playSoundBuffer('uiButtonHover', { volume: 0.45, pitchJitter: 0.08 });
  }

  playMenuTransition() {
    this.playSoundBuffer('uiScreenWhoosh', { volume: 0.75 });
  }

  playGameStart() {
    this.playSoundBuffer('gameStart', { volume: 1.0 });
  }

  playGameOver() {
    this.stopBombFuse();
    this.playSoundBuffer('gameOver', { volume: 1.0 });
  }

  playHighScore() {
    this.playSoundBuffer('newBestScore', { volume: 1.0 });
  }

  /**
   * Sparkling ascending crystalline chime for achievement unlocks.
   * Plays a crisp, short, rewarding fanfare without interrupting game audio flow.
   */
  playAchievementUnlock() {
    if (!this.soundEnabled) return;
    this.resume();

    const played = this.playSoundBuffer('newBestScore', { volume: 0.9, pitchJitter: 0.02 });
    if (!played) {
      try {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Ascending crystalline chord: C6 -> E6 -> G6 -> C7
        const notes = [1046.5, 1318.5, 1567.98, 2093.0];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.14, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.35);
          osc.connect(gain);
          gain.connect(this.sfxGainNode);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.36);
        });
      } catch {}
    }
  }

  playPause() {
    this.stopBombFuse();
    this.playSoundBuffer('pause', { volume: 0.85 });
  }

  playResume() {
    this.playSoundBuffer('unpause', { volume: 0.85 });
  }

  playTimeTick() {
    this.playSoundBuffer('timeTick', { volume: 0.7 });
  }

  playTimeWarning() {
    this.playSoundBuffer('timeBeep', { volume: 0.85 });
  }

  playTimeUp() {
    this.playSoundBuffer('timeUp', { volume: 1.0 });
  }

  // --- AMBIENT DOJO MUSIC GENERATOR ---

  startAmbientMusic() {
    if (!this.musicEnabled || this.isMusicActive || !this.ctx) return;
    this.isMusicActive = true;

    const playAmbientPulse = () => {
      if (!this.musicEnabled || !this.isMusicActive || !this.ctx || this.ctx.state !== 'running') return;

      try {
        const now = this.ctx.currentTime;
        const noteFreq = this.ambientNotes[this.ambientStep % this.ambientNotes.length];
        this.ambientStep = (this.ambientStep + 1 + Math.floor(Math.random() * 2)) % this.ambientNotes.length;

        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.042, now + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGainNode);

        osc.start(now);
        osc.stop(now + 1.25);
      } catch {
        // Silent recovery
      }
    };

    playAmbientPulse();
    this.musicIntervalId = setInterval(playAmbientPulse, 1400);
  }

  stopAmbientMusic() {
    this.isMusicActive = false;
    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
  }

  destroy() {
    this.stopAmbientMusic();
    this.stopBombFuse();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.handleFirstUserGesture);
      window.removeEventListener('keydown', this.handleFirstUserGesture);
      window.removeEventListener('touchstart', this.handleFirstUserGesture);
    }
    this.settingsListeners.clear();
    for (const source of this.activeVoices) {
      try { source.stop(); } catch {}
    }
    this.activeVoices.clear();
    this.buffers.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

