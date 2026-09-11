import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { ProgressionModal } from '../Progression/ProgressionModal.jsx';
import { CrestIcon } from '../Progression/ProgressionIcons.jsx';
import styles from './GameOverModal.module.css';

export function GameOverModal({
  score = 0,
  bestScore = 0,
  maxCombo = 0,
  fruitsSliced = 0,
  livesRecovered = 0,
  modeName = 'Classic',
  audioManager = null,
  progressionManager = null,
  onRestart,
  onMenu,
}) {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);
  const statsRef = useRef(null);
  const actionsRef = useRef(null);

  const [isProgressionOpen, setIsProgressionOpen] = useState(false);

  const isNewHighScore = score > 0 && score >= bestScore;

  const handleRestartClick = useCallback(() => {
    if (audioManager) audioManager.playButtonClick();
    if (!modalRef.current) {
      onRestart();
      return;
    }
    gsap.to(modalRef.current, {
      opacity: 0,
      scale: 0.94,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: onRestart,
    });
  }, [onRestart, audioManager]);

  const handleMenuClick = useCallback(() => {
    if (audioManager) audioManager.playButtonClick();
    if (!modalRef.current) {
      onMenu();
      return;
    }
    gsap.to(modalRef.current, {
      opacity: 0,
      scale: 0.94,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: onMenu,
    });
  }, [onMenu, audioManager]);

  useEffect(() => {
    if (!modalRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.88, y: 30 },
        { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.3)' }
      )
        .fromTo(
          statsRef.current?.children || [],
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.3, stagger: 0.06 },
          '-=0.2'
        )
        .fromTo(
          actionsRef.current?.children || [],
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.3, stagger: 0.06 },
          '-=0.15'
        );
    }, overlayRef);

    if (isNewHighScore && audioManager) {
      audioManager.playHighScore();
    }

    return () => ctx.revert();
  }, [isNewHighScore, audioManager]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleRestartClick();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleMenuClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRestartClick, handleMenuClick]);

  return (
    <div ref={overlayRef} className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div ref={modalRef} className={styles.modal}>
        <div className={styles.badgeRow}>
          <span className={styles.subtitle}>{modeName} Session</span>
          {isNewHighScore && <span className={styles.highScoreBadge}>New Record!</span>}
        </div>

        <h2 id="game-over-title" className={styles.title}>Game Over</h2>

        <div ref={statsRef} className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Final Score</span>
            <span className={`${styles.statValue} ${styles.statValuePrimary}`}>{score}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{modeName} Record</span>
            <span className={styles.statValue}>{bestScore}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Highest Combo</span>
            <span className={styles.statValue}>{maxCombo > 1 ? `${maxCombo}x` : '1x'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Fruits Sliced</span>
            <span className={styles.statValue}>{fruitsSliced}</span>
          </div>
          {modeName !== 'Zen' && livesRecovered > 0 && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Lives Recovered</span>
              <span className={styles.statValue}>{livesRecovered}</span>
            </div>
          )}
          {progressionManager && (
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Blade Crests</span>
              <span className={`${styles.statValue} ${styles.statValueCrest}`}>
                <CrestIcon size={18} />
                <span>{progressionManager.getCurrency()}</span>
              </span>
            </div>
          )}
        </div>

        <div ref={actionsRef} className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleRestartClick}
            onMouseEnter={() => audioManager?.playButtonHover()}
            aria-label="Play Again"
          >
            Play Again
          </button>
          {progressionManager && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                if (audioManager) audioManager.playMenuTransition();
                setIsProgressionOpen(true);
              }}
              onMouseEnter={() => audioManager?.playButtonHover()}
              aria-label="View Missions and Progression"
            >
              Missions & Career
            </button>
          )}
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleMenuClick}
            onMouseEnter={() => audioManager?.playButtonHover()}
            aria-label="Return to Main Menu"
          >
            Main Menu
          </button>
        </div>
      </div>

      {/* Progression & Missions Modal */}
      <ProgressionModal
        isOpen={isProgressionOpen}
        onClose={() => setIsProgressionOpen(false)}
        progressionManager={progressionManager}
        audioManager={audioManager}
      />
    </div>
  );
}
