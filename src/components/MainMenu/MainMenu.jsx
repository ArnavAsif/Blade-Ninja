import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { GAME_MODES, MODE_CONFIG } from '../../game/GameState.js';
import { SettingsModal } from '../Settings/SettingsModal.jsx';
import styles from './MainMenu.module.css';

export function MainMenu({
  onStart,
  gameState,
  bestScore = 0,
  audioSettings = { soundEnabled: true, musicEnabled: true, masterVolume: 0.8 },
  audioManager = null,
  onToggleSound,
  onToggleMusic,
  onVolumeChange,
}) {
  const containerRef = useRef(null);
  const titleGroupRef = useRef(null);
  const modesRef = useRef(null);
  const recordRef = useRef(null);
  const actionGroupRef = useRef(null);
  const footerRef = useRef(null);

  const [selectedMode, setSelectedMode] = useState(
    gameState ? gameState.mode : GAME_MODES.CLASSIC
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Derive mode high score directly without cascading re-renders
  const modeBestScore = gameState ? gameState.loadBestScore(selectedMode) : bestScore;

  // Entrance GSAP animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        titleGroupRef.current,
        { opacity: 0, y: -28, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5 }
      )
        .fromTo(
          modesRef.current,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.4 },
          '-=0.25'
        )
        .fromTo(
          recordRef.current,
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.5)' },
          '-=0.2'
        )
        .fromTo(
          actionGroupRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.4 },
          '-=0.2'
        )
        .fromTo(
          footerRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.3 },
          '-=0.1'
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Synchronize selected mode with GameState
  useEffect(() => {
    if (!gameState) return;
    const unsubscribe = gameState.subscribeMode((mode) => {
      setSelectedMode(mode);
    });
    return unsubscribe;
  }, [gameState]);

  const handlePlayClick = useCallback(() => {
    if (isStarting) return;
    if (audioManager) audioManager.playButtonClick();
    setIsStarting(true);

    // Playful exit transition before starting the gameplay canvas
    gsap.to(
      [
        titleGroupRef.current,
        modesRef.current,
        recordRef.current,
        actionGroupRef.current,
        footerRef.current,
      ],
      {
        opacity: 0,
        y: -15,
        scale: 0.97,
        stagger: 0.04,
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => {
          onStart();
        },
      }
    );
  }, [isStarting, onStart, audioManager]);

  const handleSelectMode = useCallback((modeId) => {
    if (isStarting) return;
    if (audioManager) audioManager.playButtonClick();
    if (selectedMode === modeId) {
      handlePlayClick();
      return;
    }
    setSelectedMode(modeId);
    if (gameState) {
      gameState.setMode(modeId);
    }
  }, [isStarting, selectedMode, handlePlayClick, gameState, audioManager]);

  // Keyboard navigation for Game Mode selection and Game Start
  useEffect(() => {
    const modeKeys = Object.keys(MODE_CONFIG);
    const handleKeyDown = (e) => {
      if (isSettingsOpen || isStarting) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const curIdx = modeKeys.indexOf(selectedMode);
        const nextIdx = (curIdx + 1) % modeKeys.length;
        handleSelectMode(modeKeys[nextIdx]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const curIdx = modeKeys.indexOf(selectedMode);
        const prevIdx = (curIdx - 1 + modeKeys.length) % modeKeys.length;
        handleSelectMode(modeKeys[prevIdx]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (document.activeElement?.tagName !== 'BUTTON') {
          e.preventDefault();
          handlePlayClick();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMode, isSettingsOpen, isStarting, handleSelectMode, handlePlayClick]);

  const currentConfig = MODE_CONFIG[selectedMode] || MODE_CONFIG[GAME_MODES.CLASSIC];

  return (
    <div ref={containerRef} className={styles.overlay}>
      <div className={styles.ambientGlow} />

      <div className={styles.content}>
        {/* Title Group */}
        <div ref={titleGroupRef} className={styles.titleGroup}>
          <div className={styles.badgeRow}>
            <span className={styles.arcadeBadge}>Arcade Edition</span>
            <span className={styles.versionBadge}>v2.0</span>
          </div>

          <h1 className={styles.title}>
            <span className={styles.titleBlade}>Blade</span>{' '}
            <span className={styles.titleNinja}>Ninja</span>
          </h1>

          <div className={styles.bladeSlashLine} />
        </div>

        {/* Game Mode Selector */}
        <div ref={modesRef} className={styles.modeSection}>
          <div className={styles.modeTabs} role="tablist" aria-label="Game Mode Selection">
            {Object.values(MODE_CONFIG).map((mode) => {
              const isActive = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.modeTab} ${isActive ? styles.modeTabActive : ''}`}
                  onClick={() => handleSelectMode(mode.id)}
                  onMouseEnter={() => audioManager?.playButtonHover()}
                >
                  <span className={styles.modeTabName}>{mode.name}</span>
                  <span className={styles.modeTabTagline}>{mode.tagline}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.modeDescriptionCard}>
            <p className={styles.modeDescriptionText}>{currentConfig.description}</p>
          </div>
        </div>

        {/* High Score Plaque */}
        <div ref={recordRef} className={styles.recordPlaque}>
          <div className={styles.recordIconBox}>
            <svg viewBox="0 0 24 24" className={styles.trophyIcon} fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
              <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
              <path d="M4 3h16v7a8 8 0 0 1-16 0V3z" />
              <path d="M12 17v4" />
              <path d="M8 21h8" />
            </svg>
          </div>
          <div className={styles.recordTextGroup}>
            <span className={styles.recordLabel}>{currentConfig.name} Record</span>
            <span className={styles.recordValue}>{modeBestScore}</span>
          </div>
        </div>

        {/* Main Action Group */}
        <div ref={actionGroupRef} className={styles.actionGroup}>
          <button
            type="button"
            className={styles.playButton}
            onClick={handlePlayClick}
            onMouseEnter={() => audioManager?.playButtonHover()}
            disabled={isStarting}
            aria-label={`Play ${currentConfig.name} Mode`}
          >
            <span className={styles.playButtonText}>Start {currentConfig.name}</span>
            <svg viewBox="0 0 24 24" className={styles.playArrowIcon} fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>

          <button
            type="button"
            className={styles.settingsTriggerButton}
            onClick={() => {
              if (audioManager) audioManager.playMenuTransition();
              setIsSettingsOpen(true);
            }}
            onMouseEnter={() => audioManager?.playButtonHover()}
            aria-label="Open Settings"
          >
            <svg viewBox="0 0 24 24" className={styles.gearIcon} fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className={styles.settingsTriggerText}>Settings</span>
          </button>
        </div>

        {/* Minimal Supporting Text */}
        <footer ref={footerRef} className={styles.footerInfo}>
          <p className={styles.instruction}>Swipe blade across screen to slice targets</p>
        </footer>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        audioSettings={audioSettings}
        audioManager={audioManager}
        onToggleSound={onToggleSound}
        onToggleMusic={onToggleMusic}
        onVolumeChange={onVolumeChange}
      />
    </div>
  );
}
