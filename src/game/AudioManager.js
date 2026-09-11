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

  // Bombs & Hazards
  bombExplode: '/sounds/Bomb-explode.wav',
  bombFuse: '/sounds/Bomb-Fuse.wav',
  throwBomb: '/sounds/Throw-bomb.wav',

  // Fruit Launch
  throwFruit: '/sounds/Throw-fruit.wav',

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

  // --- LIFE LOST / MISSED FRUIT AUDIO ---

  playLifeLost() {
    this.playSoundBuffer('visceral1', { volume: 0.8, playbackRate: 0.8 });
  }

  playFruitMissed() {
    this.playLifeLost();
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

