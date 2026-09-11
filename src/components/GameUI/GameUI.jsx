import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { STATES } from '../../game/GameState.js';
import { MainMenu } from '../MainMenu/MainMenu.jsx';
import { ScoreDisplay } from '../Score/ScoreDisplay.jsx';
import { ComboDisplay } from '../Combo/ComboDisplay.jsx';
import { LivesDisplay } from '../Lives/LivesDisplay.jsx';
import { GameOverModal } from '../GameOver/GameOverModal.jsx';
import { SettingsModal } from '../Settings/SettingsModal.jsx';
import { ActivePowerUps } from '../PowerUps/ActivePowerUps.jsx';
import { AchievementToast } from '../Achievement/AchievementToast.jsx';
import styles from './GameUI.module.css';

export function GameUI({ gameState, engine, isPortrait = false }) {
  const [currentState, setCurrentState] = useState(gameState ? gameState.getState() : STATES.MENU);
  const [audioSettings, setAudioSettings] = useState(() => {
    if (engine && engine.audioManager) {
      return {
        soundEnabled: engine.audioManager.soundEnabled,
        musicEnabled: engine.audioManager.musicEnabled,
        masterVolume: engine.audioManager.masterVolume,
      };
    }
    return { soundEnabled: true, musicEnabled: true, masterVolume: 0.8 };
  });
  const [isPauseSettingsOpen, setIsPauseSettingsOpen] = useState(false);

  const hudRef = useRef(null);
  const pauseModalRef = useRef(null);
  const pauseOverlayRef = useRef(null);

  useEffect(() => {
    if (!gameState) return;

    // Reactively update component ONLY on state transitions
    const unsubscribe = gameState.subscribe((newState) => {
      setCurrentState(newState);
    });

    return unsubscribe;
  }, [gameState]);

  useEffect(() => {
    if (!engine || !engine.audioManager || typeof engine.audioManager.subscribeSettings !== 'function') return;
    const unsubscribe = engine.audioManager.subscribeSettings((settings) => {
      setAudioSettings(settings);
    });
    return unsubscribe;
  }, [engine]);

  // Handle Pause Modal entrance animation
  useEffect(() => {
    if (currentState === STATES.PAUSED && pauseModalRef.current) {
      gsap.fromTo(
        pauseOverlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: 'power2.out' }
      );
      gsap.fromTo(
        pauseModalRef.current,
        { opacity: 0, scale: 0.92, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: 'back.out(1.3)' }
      );
    }
  }, [currentState]);

  const handleStart = () => {
    if (isPortrait) return;
    if (engine) {
      if (engine.audioManager) {
        try {
          engine.audioManager.unlockAudio();
          engine.audioManager.playGameStart();
        } catch {
          // Ignore audio initialization errors
        }
      }
      try {
        engine.reset();
        engine.start();
        engine.resume();
      } catch (err) {
        console.error('Error starting game engine:', err);
      }
    }
    if (gameState) {
      gameState.resetSession();
      gameState.setState(STATES.PLAYING);
    }
  };

  const handlePause = useCallback(() => {
    if (engine) {
      engine.pause();
    }
  }, [engine]);

  const handleResume = useCallback(() => {
    if (!pauseModalRef.current) {
      if (engine) engine.resume();
      return;
    }
    gsap.to(pauseModalRef.current, {
      opacity: 0,
      scale: 0.94,
      duration: 0.18,
      ease: 'power2.in',
      onComplete: () => {
        if (engine) engine.resume();
      },
    });
  }, [engine]);

  const handleRestart = () => {
    if (engine) {
      if (engine.audioManager) {
        try {
          engine.audioManager.unlockAudio();
          engine.audioManager.playGameStart();
        } catch {
          // Ignore audio initialization errors
        }
      }
      try {
        engine.reset();
        engine.start();
        engine.resume();
      } catch (err) {
        console.error('Error restarting game engine:', err);
      }
    }
    if (gameState) {
      gameState.resetSession();
      gameState.setState(STATES.PLAYING);
    }
  };

  const handleMainMenu = () => {
    setIsPauseSettingsOpen(false);
    if (engine) {
      if (engine.audioManager) engine.audioManager.playButtonClick();
      try {
        engine.reset();
      } catch (err) {
        console.error('Error resetting engine:', err);
      }
    }
    if (gameState) {
      gameState.setState(STATES.MENU);
    }
  };

  const handleEndSession = () => {
    setIsPauseSettingsOpen(false);
    if (engine) {
      if (engine.audioManager) engine.audioManager.playButtonClick();
      try {
        engine.stop();
      } catch {
        // Ignore stop error
      }
    }
    if (gameState) {
      gameState.setState(STATES.GAME_OVER);
    }
  };

  // Keyboard shortcut support: Esc or 'P' to pause/resume
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (currentState === STATES.PLAYING) {
          handlePause();
        } else if (currentState === STATES.PAUSED && !isPauseSettingsOpen) {
          handleResume();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentState, handlePause, handleResume, isPauseSettingsOpen]);

  const handleToggleSound = () => {
    if (engine && engine.audioManager) {
      engine.audioManager.playButtonClick();
      engine.audioManager.toggleSound();
    }
  };

  const handleToggleMusic = () => {
    if (engine && engine.audioManager) {
      engine.audioManager.playButtonClick();
      engine.audioManager.toggleMusic();
    }
  };

  const handleVolumeChange = (newVolume) => {
    if (engine && engine.audioManager) {
      engine.audioManager.setMasterVolume(newVolume);
    }
  };

  return (
    <div className={styles.uiLayer}>
      {currentState === STATES.MENU && (
        <MainMenu
          onStart={handleStart}
          gameState={gameState}
          bestScore={gameState ? gameState.bestScore : 0}
          audioSettings={audioSettings}
          audioManager={engine ? engine.audioManager : null}
          onToggleSound={handleToggleSound}
          onToggleMusic={handleToggleMusic}
          onVolumeChange={handleVolumeChange}
          isPortrait={isPortrait}
        />
      )}

      {(currentState === STATES.PLAYING || currentState === STATES.PAUSED) && (
        <>
          <header ref={hudRef} className={styles.hud}>
            <div className={styles.hudLeft}>
              <ScoreDisplay gameState={gameState} />
            </div>

            <div className={styles.hudCenter}>
              <ComboDisplay gameState={gameState} />
            </div>

            <div className={styles.hudRight}>
              <LivesDisplay gameState={gameState} />
              <button
                type="button"
                className={styles.pauseIconButton}
                onClick={handlePause}
                onMouseEnter={() => engine?.audioManager?.playButtonHover()}
                aria-label="Pause game and open menu"
                title="Pause / Menu (Esc or P)"
              >
                <svg viewBox="0 0 24 24" className={styles.pauseSvg} fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1.5" />
                  <rect x="14" y="5" width="4" height="14" rx="1.5" />
                </svg>
                <span className={styles.pauseButtonText}>Menu</span>
              </button>
            </div>
          </header>

          <ActivePowerUps engine={engine} />
        </>
      )}

      {currentState === STATES.PAUSED && (
        <div ref={pauseOverlayRef} className={styles.pauseOverlay} role="dialog" aria-modal="true" aria-labelledby="pause-heading">
          <div ref={pauseModalRef} className={styles.pauseModal}>
            <div className={styles.pauseHeader}>
              <span className={styles.pauseCategory}>Tactical Standby</span>
              <h2 id="pause-heading" className={styles.pauseTitle}>Game Paused</h2>
            </div>

            <div className={styles.pauseAudioControls}>
              <div className={styles.pauseAudioRow}>
                <button
                  type="button"
                  className={`${styles.pauseAudioBtn} ${!audioSettings.soundEnabled ? styles.disabledBtn : ''}`}
                  onClick={handleToggleSound}
                  onMouseEnter={() => engine?.audioManager?.playButtonHover()}
                  aria-label="Toggle Sound Effects"
                >
                  <svg viewBox="0 0 24 24" className={styles.btnIcon} fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  <span>SFX: {audioSettings.soundEnabled ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.pauseAudioBtn} ${!audioSettings.musicEnabled ? styles.disabledBtn : ''}`}
                  onClick={handleToggleMusic}
                  onMouseEnter={() => engine?.audioManager?.playButtonHover()}
                  aria-label="Toggle Ambient Music"
                >
                  <svg viewBox="0 0 24 24" className={styles.btnIcon} fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span>Music: {audioSettings.musicEnabled ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <div className={styles.pauseVolumeRow}>
                <div className={styles.pauseVolumeHeader}>
                  <span className={styles.pauseVolumeLabel}>Master Volume</span>
                  <span className={styles.pauseVolumeVal}>{Math.round(audioSettings.masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioSettings.masterVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className={styles.volumeSlider}
                  aria-label="Pause Volume Slider"
                />
              </div>
            </div>

            <div className={styles.pauseActions}>
              <button
                type="button"
                className={styles.resumeButton}
                onClick={handleResume}
                onMouseEnter={() => engine?.audioManager?.playButtonHover()}
                aria-label="Resume Game"
              >
                Resume
              </button>
              <button
                type="button"
                className={styles.menuButton}
                onClick={handleRestart}
                onMouseEnter={() => engine?.audioManager?.playButtonHover()}
                aria-label="Restart Game"
              >
                Restart
              </button>
              <button
                type="button"
                className={styles.menuButton}
                onClick={handleEndSession}
                onMouseEnter={() => engine?.audioManager?.playButtonHover()}
                aria-label="End Session and View Summary"
              >
                End Session
              </button>
              <button
                type="button"
                className={styles.menuButton}
                onClick={() => {
                  if (engine?.audioManager) engine.audioManager.playMenuTransition();
                  setIsPauseSettingsOpen(true);
                }}
                onMouseEnter={() => engine?.audioManager?.playButtonHover()}
                aria-label="Open Full Settings"
              >
                More Settings
              </button>
              <button
                type="button"
                className={styles.menuButton}
                onClick={handleMainMenu}
                onMouseEnter={() => engine?.audioManager?.playButtonHover()}
                aria-label="Exit to Main Menu"
              >
                Main Menu
              </button>
            </div>
          </div>

          <SettingsModal
            isOpen={isPauseSettingsOpen}
            onClose={() => setIsPauseSettingsOpen(false)}
            audioSettings={audioSettings}
            audioManager={engine ? engine.audioManager : null}
            onToggleSound={handleToggleSound}
            onToggleMusic={handleToggleMusic}
            onVolumeChange={handleVolumeChange}
            gameState={gameState}
          />
        </div>
      )}

      {currentState === STATES.GAME_OVER && (
        <GameOverModal
          score={gameState ? gameState.score : 0}
          bestScore={gameState ? gameState.bestScore : 0}
          maxCombo={gameState ? gameState.maxCombo : 0}
          fruitsSliced={gameState ? gameState.fruitsSliced : 0}
          livesRecovered={gameState ? (gameState.getProgression()?.totalLivesRecovered || 0) : 0}
          modeName={gameState ? gameState.getModeConfig().name : 'Classic'}
          audioManager={engine ? engine.audioManager : null}
          progressionManager={gameState ? gameState.getProgressionManager() : null}
          onRestart={handleRestart}
          onMenu={handleMainMenu}
        />
      )}

      {/* Achievement Unlocks Toast Notification */}
      <AchievementToast
        progressionManager={gameState ? gameState.getProgressionManager() : null}
        audioManager={engine ? engine.audioManager : null}
      />
    </div>
  );
}
