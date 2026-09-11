import { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import styles from './SettingsModal.module.css';

export function SettingsModal({
  isOpen,
  onClose,
  audioSettings = { soundEnabled: true, musicEnabled: true, masterVolume: 0.8 },
  audioManager = null,
  onToggleSound,
  onToggleMusic,
  onVolumeChange,
}) {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);

  const handleClose = useCallback(() => {
    if (audioManager) audioManager.playButtonClick();
    onClose();
  }, [audioManager, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    if (audioManager) {
      audioManager.playMenuTransition();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: 'power2.out' }
      );
      gsap.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.92, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.2)' }
      );
    }, overlayRef);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      ctx.revert();
    };
  }, [isOpen, audioManager, handleClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === overlayRef.current) {
      handleClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-heading"
    >
      <div ref={modalRef} className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.category}>Configuration</span>
            <h2 id="settings-heading" className={styles.title}>Game Settings</h2>
          </div>
          <button
            type="button"
            className={styles.closeIconButton}
            onClick={handleClose}
            onMouseEnter={() => audioManager?.playButtonHover()}
            aria-label="Close settings"
          >
            <svg viewBox="0 0 24 24" className={styles.iconSvg} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className={styles.content}>
          {/* Volume Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleRow}>
                <svg viewBox="0 0 24 24" className={styles.sectionIcon} fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
                <span className={styles.sectionLabel}>Master Volume</span>
              </div>
              <span className={styles.volumePercentage}>
                {Math.round(audioSettings.masterVolume * 100)}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioSettings.masterVolume}
              onChange={(e) => onVolumeChange && onVolumeChange(parseFloat(e.target.value))}
              className={styles.volumeSlider}
              aria-label="Master volume control"
            />
          </section>

          {/* Audio Toggles */}
          <section className={styles.togglesSection}>
            {onToggleSound && (
              <button
                type="button"
                className={`${styles.toggleCard} ${!audioSettings.soundEnabled ? styles.toggleDisabled : ''}`}
                onClick={onToggleSound}
                onMouseEnter={() => audioManager?.playButtonHover()}
                aria-pressed={audioSettings.soundEnabled}
              >
                <div className={styles.toggleInfo}>
                  <svg viewBox="0 0 24 24" className={styles.toggleIcon} fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  <div className={styles.toggleText}>
                    <span className={styles.toggleName}>Sound Effects</span>
                    <span className={styles.toggleDesc}>Slice sounds, impacts, explosions</span>
                  </div>
                </div>
                <span className={styles.toggleStateBadge}>
                  {audioSettings.soundEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            )}

            {onToggleMusic && (
              <button
                type="button"
                className={`${styles.toggleCard} ${!audioSettings.musicEnabled ? styles.toggleDisabled : ''}`}
                onClick={onToggleMusic}
                onMouseEnter={() => audioManager?.playButtonHover()}
                aria-pressed={audioSettings.musicEnabled}
              >
                <div className={styles.toggleInfo}>
                  <svg viewBox="0 0 24 24" className={styles.toggleIcon} fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <div className={styles.toggleText}>
                    <span className={styles.toggleName}>Zen Ambient Music</span>
                    <span className={styles.toggleDesc}>Atmospheric synth pad soundtrack</span>
                  </div>
                </div>
                <span className={styles.toggleStateBadge}>
                  {audioSettings.musicEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            )}
          </section>

          {/* Quick Guide */}
          <section className={styles.guideSection}>
            <span className={styles.guideHeading}>Blade Rules</span>
            <div className={styles.guideGrid}>
              <div className={styles.guideItem}>
                <span className={styles.guideBadge}>Slice</span>
                <p className={styles.guideDesc}>Swipe with mouse or finger to slice targets in mid-air.</p>
              </div>
              <div className={styles.guideItem}>
                <span className={styles.guideBadge}>Combos</span>
                <p className={styles.guideDesc}>Slice multiple fruits rapidly to activate combo multipliers.</p>
              </div>
              <div className={styles.guideItem}>
                <span className={styles.guideBadgeHazard}>Hazard</span>
                <p className={styles.guideDesc}>Never slice bombs! Bombs deduct score and lives.</p>
              </div>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.doneButton}
            onClick={handleClose}
            onMouseEnter={() => audioManager?.playButtonHover()}
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
