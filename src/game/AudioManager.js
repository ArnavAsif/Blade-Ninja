/**
 * Lightweight, high-performance professional Audio Manager.
 * Features Web Audio API synthesis, zero-allocation noise buffer pooling,
 * dynamic fruit slice timbre variation, melodic combo scaling,
 * mobile autoplay unlocking, and localStorage settings persistence.
 */

const STORAGE_KEY_AUDIO = 'blade_ninja_audio_settings';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGainNode = null;
    this.sfxGainNode = null;
    this.musicGainNode = null;
    this.noiseBuffer = null;

    // Load persisted settings safely
    const settings = this.loadSettings();
    this.soundEnabled = settings.soundEnabled;
    this.musicEnabled = settings.musicEnabled;
    this.masterVolume = settings.masterVolume;

    this.initialized = false;
    this.unlocked = false;

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
        return { soundEnabled: true, musicEnabled: true, masterVolume: 0.8 };
      }
      const raw = localStorage.getItem(STORAGE_KEY_AUDIO);
      if (!raw) return { soundEnabled: true, musicEnabled: true, masterVolume: 0.8 };
      const parsed = JSON.parse(raw);
      return {
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : true,
        masterVolume: Number.isFinite(parsed.masterVolume)
          ? Math.max(0, Math.min(1, parsed.masterVolume))
          : 0.8,
      };
    } catch {
      return { soundEnabled: true, musicEnabled: true, masterVolume: 0.8 };
    }
  }

  saveSettings() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const payload = JSON.stringify({
          soundEnabled: this.soundEnabled,
          musicEnabled: this.musicEnabled,
          masterVolume: this.masterVolume,
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

        // 1. Master gain
        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
        this.masterGainNode.connect(this.ctx.destination);

        // 2. SFX channel
        this.sfxGainNode = this.ctx.createGain();
        this.sfxGainNode.gain.setValueAtTime(this.soundEnabled ? 1.0 : 0.0, this.ctx.currentTime);
        this.sfxGainNode.connect(this.masterGainNode);

        // 3. Ambient music channel
        this.musicGainNode = this.ctx.createGain();
        this.musicGainNode.gain.setValueAtTime(this.musicEnabled ? 0.35 : 0.0, this.ctx.currentTime);
        this.musicGainNode.connect(this.masterGainNode);

        // 4. Pre-generate reusable noise buffer
        this.noiseBuffer = this.createNoiseBuffer();

        this.initialized = true;

        if (this.ctx.state === 'running' && this.musicEnabled) {
          this.startAmbientMusic();
        }
      }
    } catch {
      // AudioContext unavailable
    }
  }

  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.45);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
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

  // --- AUDIO CONTROLS ---

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
    this.saveSettings();
    this.notifySettings();
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = Boolean(enabled);
    if (this.sfxGainNode && this.ctx) {
      this.sfxGainNode.gain.setValueAtTime(this.soundEnabled ? 1.0 : 0.0, this.ctx.currentTime);
    }
    this.saveSettings();
    this.notifySettings();
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);
    if (this.musicGainNode && this.ctx) {
      this.musicGainNode.gain.setValueAtTime(this.musicEnabled ? 0.35 : 0.0, this.ctx.currentTime);
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

  // Backward compatibility alias for UI
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
    };
    for (const listener of this.settingsListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('Error in audio settings listener:', err);
      }
    }
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

  // --- SOUND EFFECTS ---

  /**
   * Fruit slice sound with subtle pitch jitter and fruit-specific timbre.
   */
  playFruitSlice(fruitType = 'watermelon') {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const pitchJitter = 0.90 + Math.random() * 0.20;

      // Base parameters varied by fruit characteristics
      let baseCutFreq = 1120;
      let squelchFreq = 340;
      let squelchDecay = 0.10;

      if (fruitType === 'apple' || fruitType === 'strawberry') {
        baseCutFreq = 1350;
        squelchFreq = 420;
        squelchDecay = 0.07;
      } else if (fruitType === 'coconut') {
        baseCutFreq = 880;
        squelchFreq = 260;
        squelchDecay = 0.12;
      } else if (fruitType === 'banana') {
        baseCutFreq = 980;
        squelchFreq = 290;
        squelchDecay = 0.09;
      } else if (fruitType === 'dragonfruit' || fruitType === 'pineapple') {
        baseCutFreq = 1220;
        squelchFreq = 380;
        squelchDecay = 0.08;
      }

      // 1. Blade cutting transient
      const cutOsc = this.ctx.createOscillator();
      const cutGain = this.ctx.createGain();

      cutOsc.type = 'sine';
      cutOsc.frequency.setValueAtTime(baseCutFreq * pitchJitter, now);
      cutOsc.frequency.exponentialRampToValueAtTime(170 * pitchJitter, now + 0.075);

      cutGain.gain.setValueAtTime(0.14, now);
      cutGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      cutOsc.connect(cutGain);
      cutGain.connect(this.sfxGainNode);

      cutOsc.start(now);
      cutOsc.stop(now + 0.08);

      // 2. Organic pulp squelch
      const pulpOsc = this.ctx.createOscillator();
      const pulpGain = this.ctx.createGain();

      pulpOsc.type = 'triangle';
      pulpOsc.frequency.setValueAtTime(squelchFreq * pitchJitter, now);
      pulpOsc.frequency.exponentialRampToValueAtTime(75 * pitchJitter, now + squelchDecay);

      pulpGain.gain.setValueAtTime(0.11, now);
      pulpGain.gain.exponentialRampToValueAtTime(0.001, now + squelchDecay);

      pulpOsc.connect(pulpGain);
      pulpGain.connect(this.sfxGainNode);

      pulpOsc.start(now);
      pulpOsc.stop(now + squelchDecay + 0.01);

      // 3. Noise burst texture from reusable pool buffer
      if (this.noiseBuffer) {
        const noiseNode = this.ctx.createBufferSource();
        const noiseFilter = this.ctx.createBiquadFilter();
        const noiseGain = this.ctx.createGain();

        noiseNode.buffer = this.noiseBuffer;
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1800 * pitchJitter, now);
        noiseFilter.Q.setValueAtTime(1.8, now);

        noiseGain.gain.setValueAtTime(0.045, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        noiseNode.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGainNode);

        noiseNode.start(now);
        noiseNode.stop(now + 0.055);
      }
    } catch {
      // Audio fallback
    }
  }

  /**
   * Harmonious combo sound escalating with combo count.
   */
  playCombo(comboCount = 2) {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      // Pentatonic intervals for multi-slice combos
      const chordMap = {
        2: [523.25, 783.99],          // C5, G5
        3: [523.25, 659.25, 783.99],   // C5, E5, G5
        4: [523.25, 659.25, 783.99, 1046.50], // C5, E5, G5, C6
        5: [659.25, 783.99, 1046.50, 1318.51], // E5, G5, C6, E6
      };

      const notes = chordMap[Math.min(5, Math.max(2, comboCount))] || chordMap[2];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const noteTime = now + idx * 0.035;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.08, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.26);

        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        osc.start(noteTime);
        osc.stop(noteTime + 0.27);
      });
    } catch {
      // Audio fallback
    }
  }

  /**
   * Powerful metallic bomb explosion sound.
   */
  playBombExplosion() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;

      // 1. Deep sub-bass boom
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();

      sub.type = 'sine';
      sub.frequency.setValueAtTime(165, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + 0.38);

      subGain.gain.setValueAtTime(0.34, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      sub.connect(subGain);
      subGain.connect(this.sfxGainNode);

      sub.start(now);
      sub.stop(now + 0.39);

      // 2. Distorted blast crunch
      const blast = this.ctx.createOscillator();
      const blastGain = this.ctx.createGain();

      blast.type = 'sawtooth';
      blast.frequency.setValueAtTime(88, now);
      blast.frequency.exponentialRampToValueAtTime(18, now + 0.26);

      blastGain.gain.setValueAtTime(0.18, now);
      blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      blast.connect(blastGain);
      blastGain.connect(this.sfxGainNode);

      blast.start(now);
      blast.stop(now + 0.27);

      // 3. Filtered noise blast layer
      if (this.noiseBuffer) {
        const noiseNode = this.ctx.createBufferSource();
        const noiseFilter = this.ctx.createBiquadFilter();
        const noiseGain = this.ctx.createGain();

        noiseNode.buffer = this.noiseBuffer;
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(650, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 0.32);

        noiseGain.gain.setValueAtTime(0.24, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        noiseNode.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGainNode);

        noiseNode.start(now);
        noiseNode.stop(now + 0.33);
      }
    } catch {
      // Audio fallback
    }
  }

  /**
   * Life lost / missed fruit warning sound.
   */
  playLifeLost() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(115, now + 0.17);

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(252, now); // Dissonant beating
      subOsc.frequency.exponentialRampToValueAtTime(110, now + 0.17);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

      osc.connect(gain);
      subOsc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      subOsc.start(now);
      osc.stop(now + 0.18);
      subOsc.stop(now + 0.18);
    } catch {
      // Audio fallback
    }
  }

  // Backward compatibility alias for missed fruit
  playFruitMissed() {
    this.playLifeLost();
  }

  /**
   * Somber game over descending triad.
   */
  playGameOver() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const notes = [293.66, 233.08, 196.00]; // D4, Bb3, G3
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const startTime = now + idx * 0.13;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.90, startTime + 0.28);

        gain.gain.setValueAtTime(0.14, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        osc.start(startTime);
        osc.stop(startTime + 0.29);
      });
    } catch {
      // Audio fallback
    }
  }

  /**
   * Crisp UI button click.
   */
  playButtonClick() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.04);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Invigorating game start power-up sound.
   */
  playGameStart() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const notes = [349.23, 440.00, 523.25, 659.25]; // F4, A4, C5, E5
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const noteTime = now + idx * 0.06;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.10, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.24);

        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        osc.start(noteTime);
        osc.stop(noteTime + 0.25);
      });
    } catch {
      // Audio fallback
    }
  }

  /**
   * Celebratory victory high score fanfare.
   */
  playHighScore() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const noteTime = now + idx * 0.065;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.11, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        osc.start(noteTime);
        osc.stop(noteTime + 0.36);
      });
    } catch {
      // Audio fallback
    }
  }

  /**
   * Soft descending pause blip.
   */
  playPause() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.075);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Soft ascending resume blip.
   */
  playResume() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.07);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.075);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Blade swoosh sound.
   */
  playSwoosh() {
    if (!this.soundEnabled || !this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.11);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Audio fallback
    }
  }

  destroy() {
    this.stopAmbientMusic();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.handleFirstUserGesture);
      window.removeEventListener('keydown', this.handleFirstUserGesture);
      window.removeEventListener('touchstart', this.handleFirstUserGesture);
    }
    this.settingsListeners.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
