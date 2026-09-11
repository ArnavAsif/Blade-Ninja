import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import styles from './ComboDisplay.module.css';

export function ComboDisplay({ gameState, combo: propCombo = 0 }) {
  const [comboState, setComboState] = useState({
    combo: gameState ? gameState.combo : propCombo,
    multiplier: 1,
    timer: 0,
    maxTimeout: 1.85,
  });

  const [feverState, setFeverState] = useState({
    active: gameState ? gameState.isFeverActive : false,
    timer: gameState ? gameState.feverTimer : 0,
    duration: gameState ? gameState.feverDuration : 7.0,
  });

  const badgeRef = useRef(null);

  // Subscribe to real-time combo and fever updates from GameState
  useEffect(() => {
    if (!gameState) return;

    const unsubscribeCombo = gameState.subscribeCombo((newCombo, details) => {
      setComboState({
        combo: newCombo,
        multiplier: details?.multiplier ?? (newCombo > 1 ? Math.min(5, newCombo) : 1),
        timer: details?.timer ?? (newCombo > 0 ? (details?.maxTimeout ?? 1.85) : 0),
        maxTimeout: details?.maxTimeout ?? 1.85,
      });
    });

    const unsubscribeFever = gameState.subscribeFever((isActive, details) => {
      setFeverState({
        active: isActive,
        timer: details?.timer ?? 0,
        duration: details?.duration ?? 7.0,
      });
    });

    return () => {
      unsubscribeCombo();
      unsubscribeFever();
    };
  }, [gameState]);

  const activeCombo = gameState ? comboState.combo : propCombo;
  const isFever = feverState.active;

  // GSAP Combo pop transition on combo change or Fever trigger
  useEffect(() => {
    if ((activeCombo > 1 || isFever) && badgeRef.current) {
      gsap.killTweensOf(badgeRef.current);
      const randomRot = (Math.random() - 0.5) * 8;
      const targetScale = isFever ? 1.06 : 1.0;
      gsap.fromTo(
        badgeRef.current,
        { scale: 0.72, rotation: randomRot, opacity: 0.7 },
        { scale: targetScale, rotation: 0, opacity: 1, duration: 0.28, ease: 'back.out(2.2)' }
      );
    }
  }, [activeCombo, isFever]);

  if (activeCombo <= 1 && !isFever) {
    return <div className={styles.container} />;
  }

  // Calculate timer progress bar ratio
  const timerRatio = isFever
    ? Math.max(0, Math.min(1, feverState.duration > 0 ? feverState.timer / feverState.duration : 0))
    : Math.max(0, Math.min(1, comboState.maxTimeout > 0 ? comboState.timer / comboState.maxTimeout : 0));

  let badgeClass = styles.comboBadge;
  let labelText = 'Combo';

  if (isFever) {
    badgeClass = `${styles.comboBadge} ${styles.feverBadge}`;
    labelText = 'Fever Mode';
  } else if (activeCombo >= 8) {
    badgeClass = `${styles.comboBadge} ${styles.maxCombo}`;
    labelText = 'Max Combo!';
  } else if (activeCombo >= 4) {
    badgeClass = `${styles.comboBadge} ${styles.megaCombo}`;
    labelText = 'Mega Combo';
  }

  const displayMultiplier = isFever
    ? `${comboState.multiplier}x`
    : `${comboState.multiplier > 1 ? comboState.multiplier : activeCombo}x`;

  return (
    <div className={styles.container}>
      <div ref={badgeRef} className={badgeClass}>
        <div className={styles.badgeContent}>
          <span className={styles.multiplier}>{displayMultiplier}</span>
          <div className={styles.labelCol}>
            <span className={styles.text}>{labelText}</span>
            {activeCombo > 1 && !isFever && (
              <span className={styles.subtext}>{activeCombo} Slices</span>
            )}
            {isFever && (
              <span className={styles.feverSubtext}>+2x Boost Active</span>
            )}
          </div>
        </div>

        {/* Dynamic Countdown Window Bar */}
        <div className={styles.timerTrack}>
          <div
            className={styles.timerBar}
            style={{ width: `${Math.round(timerRatio * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
