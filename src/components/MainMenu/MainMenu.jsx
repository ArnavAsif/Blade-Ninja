import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { GAME_MODES, MODE_CONFIG } from '../../game/GameState.js';
import { SettingsModal } from '../Settings/SettingsModal.jsx';
import { ProgressionModal } from '../Progression/ProgressionModal.jsx';
import { CrestIcon } from '../Progression/ProgressionIcons.jsx';
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
  isPortrait = false,
}) {
  const containerRef = useRef(null);
  const titleGroupRef = useRef(null);
  const modesRef = useRef(null);
  const recordRef = useRef(null);
  const actionGroupRef = useRef(null);
  const navGridRef = useRef(null);
  const footerRef = useRef(null);

  const [selectedMode, setSelectedMode] = useState(
    gameState ? gameState.mode : GAME_MODES.CLASSIC
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProgressionOpen, setIsProgressionOpen] = useState(false);
  const [progressionTab, setProgressionTab] = useState('missions');
  const [isStarting, setIsStarting] = useState(false);

  const progressionManager = gameState && typeof gameState.getProgressionManager === 'function'
    ? gameState.getProgressionManager()
    : null;

  const [progressionData, setProgressionData] = useState(() => ({
    currency: progressionManager ? progressionManager.getCurrency() : 0,
    unclaimedCount: progressionManager ? progressionManager.getUnclaimedCount() : 0,
  }));

  useEffect(() => {
    if (!progressionManager) return;
    const unsubscribe = progressionManager.subscribe((latest) => {
      setProgressionData({
        currency: latest.currency,
        unclaimedCount: latest.unclaimedCount,
      });
    });
    return unsubscribe;
  }, [progressionManager]);

  // Derive mode high score directly without cascading re-renders
  const modeBestScore = gameState ? gameState.loadBestScore(selectedMode) : bestScore;

  // Entrance GSAP animation (fast, subtle, no excessive motion)
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      tl.fromTo(
        titleGroupRef.current,
        { opacity: 0, y: -18 },
        { opacity: 1, y: 0, duration: 0.3 }
      )
        .fromTo(
          modesRef.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.28 },
          '-=0.15'
        )
        .fromTo(
          recordRef.current,
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 0.25 },
          '-=0.15'
        )
        .fromTo(
          actionGroupRef.current,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.25 },
          '-=0.12'
        )
        .fromTo(
          navGridRef.current?.children || [],
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.22, stagger: 0.04 },
          '-=0.1'
        )
        .fromTo(
          footerRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.2 },
          '-=0.08'
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
    if (isStarting || isPortrait) return;
    if (audioManager) audioManager.playButtonClick();
    setIsStarting(true);

    // Fast exit transition before starting gameplay
    const targets = [
      titleGroupRef.current,
      modesRef.current,
      recordRef.current,
      actionGroupRef.current,
      navGridRef.current,
      footerRef.current,
    ].filter(Boolean);

    if (targets.length === 0) {
      try {
        onStart();
      } catch (err) {
        console.error('Error starting game:', err);
        setIsStarting(false);
      }
      return;
    }

    gsap.to(targets, {
      opacity: 0,
      y: -10,
      stagger: 0.025,
      duration: 0.18,
      ease: 'power2.in',
      onComplete: () => {
        try {
          onStart();
        } catch (err) {
          console.error('Error starting game:', err);
          setIsStarting(false);
        }
      },
    });
  }, [isStarting, isPortrait, onStart, audioManager]);

  const handleSelectMode = useCallback((modeId) => {
    if (isStarting) return;
    if (audioManager) audioManager.playButtonClick();
    setSelectedMode(modeId);
    if (gameState) {
      gameState.setMode(modeId);
    }
  }, [isStarting, gameState, audioManager]);

  const openProgressionTab = useCallback((tab) => {
    if (audioManager) audioManager.playMenuTransition();
    setProgressionTab(tab);
    setIsProgressionOpen(true);
  }, [audioManager]);

  const openSettings = useCallback(() => {
    if (audioManager) audioManager.playMenuTransition();
    setIsSettingsOpen(true);
  }, [audioManager]);

  // Keyboard navigation for Game Mode selection and Game Start
  useEffect(() => {
    const modeKeys = Object.keys(MODE_CONFIG);
    const handleKeyDown = (e) => {
      if (isSettingsOpen || isProgressionOpen || isStarting || isPortrait) return;

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
  }, [selectedMode, isSettingsOpen, isProgressionOpen, isStarting, isPortrait, handleSelectMode, handlePlayClick]);

  const currentConfig = MODE_CONFIG[selectedMode] || MODE_CONFIG[GAME_MODES.CLASSIC];

  return (
    <div ref={containerRef} className={styles.overlay}>
      <div className={styles.ambientGlow} />

      <div className={styles.content}>
        {/* Left / Top Section */}
        <div className={styles.leftColumn}>
          {/* Title Group */}
          <div ref={titleGroupRef} className={styles.titleGroup}>
            <div className={styles.badgeRow}>
              <span className={styles.arcadeBadge}>Arcade Edition</span>
              <span className={styles.versionBadge}>v2.0</span>
              <button
                type="button"
                className={styles.currencyPill}
                onClick={() => openProgressionTab('missions')}
                onMouseEnter={() => audioManager?.playButtonHover()}
                title="Blade Crests - View Missions and Career"
                aria-label={`Blade Crests: ${progressionData.currency}. Open missions and career`}
              >
                <CrestIcon size={14} />
                <span className={styles.currencyValue}>{progressionData.currency}</span>
                <span className={styles.currencyLabel}>Crests</span>
              </button>
            </div>

            <h1 className={styles.title}>
              <span className={styles.titleBlade}>Blade</span>{' '}
              <span className={styles.titleNinja}>Ninja</span>
            </h1>

            <div className={styles.bladeSlashLine} />
          </div>

          {/* High Score Plaque */}
          <div ref={recordRef} className={styles.recordPlaque}>
            <div className={styles.recordIconBox}>
              <svg viewBox="0 0 24 24" className={styles.trophyIcon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
                <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
                <path d="M4 3h16v7a8 8 0 0 1-16 0V3z" />
                <path d="M12 17v4" />
                <path d="M8 21h8" />
              </svg>
            </div>
            <div className={styles.recordTextGroup}>
              <span className={styles.recordLabel}>{currentConfig.name} High Score</span>
              <span className={styles.recordValue}>{modeBestScore}</span>
            </div>
          </div>

          {/* Primary Play Button */}
          <div ref={actionGroupRef} className={styles.actionGroup}>
            <button
              type="button"
              className={styles.playButton}
              onClick={handlePlayClick}
              onMouseEnter={() => audioManager?.playButtonHover()}
              disabled={isStarting || isPortrait}
              aria-label={`Play ${currentConfig.name} Mode`}
            >
              <span className={styles.playButtonText}>Play {currentConfig.name}</span>
              <svg viewBox="0 0 24 24" className={styles.playArrowIcon} fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right Section */}
        <div className={styles.rightColumn}>
          {/* Game Modes Selection */}
          <div ref={modesRef} className={styles.modeSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Select Game Mode</span>
            </div>

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

          {/* Quick Navigation Menu Grid: Missions, Achievements, Profile/Stats, Settings */}
          <div ref={navGridRef} className={styles.navGrid}>
            <button
              type="button"
              className={styles.navButton}
              onClick={() => openProgressionTab('missions')}
              onMouseEnter={() => audioManager?.playButtonHover()}
              aria-label="Open Missions"
            >
              <div className={styles.navIconBox}>
                <svg viewBox="0 0 24 24" className={styles.navIcon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                {progressionData.unclaimedCount > 0 && (
                  <span className={styles.navBadge}>{progressionData.unclaimedCount}</span>
                )}
              </div>
              <span className={styles.navLabel}>Missions</span>
            </button>

            <button
              type="button"
              className={styles.navButton}
              onClick={() => openProgressionTab('achievements')}
              onMouseEnter={() => audioManager?.playButtonHover()}
              aria-label="Open Achievements"
            >
              <div className={styles.navIconBox}>
                <svg viewBox="0 0 24 24" className={styles.navIcon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <span className={styles.navLabel}>Achievements</span>
            </button>

            <button
              type="button"
              className={styles.navButton}
              onClick={() => openProgressionTab('profile')}
              onMouseEnter={() => audioManager?.playButtonHover()}
              aria-label="Open Career Profile and Stats"
            >
              <div className={styles.navIconBox}>
                <svg viewBox="0 0 24 24" className={styles.navIcon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <span className={styles.navLabel}>Profile / Stats</span>
            </button>

            <button
              type="button"
              className={styles.navButton}
              onClick={openSettings}
              onMouseEnter={() => audioManager?.playButtonHover()}
              aria-label="Open Settings"
            >
              <div className={styles.navIconBox}>
                <svg viewBox="0 0 24 24" className={styles.navIcon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <span className={styles.navLabel}>Settings</span>
            </button>
          </div>
        </div>

        {/* Minimal Supporting Footer Text */}
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

      {/* Progression & Career Modal */}
      <ProgressionModal
        isOpen={isProgressionOpen}
        onClose={() => setIsProgressionOpen(false)}
        progressionManager={progressionManager}
        audioManager={audioManager}
        initialTab={progressionTab}
      />
    </div>
  );
}
