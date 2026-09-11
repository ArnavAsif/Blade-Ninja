import { useState, useEffect } from 'react';
import styles from './LivesDisplay.module.css';

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function LivesDisplay({ gameState }) {
  const [hasTimer, setHasTimer] = useState(gameState ? gameState.hasTimer() : false);
  const [timeRemaining, setTimeRemaining] = useState(
    gameState && gameState.timeRemaining !== null ? gameState.timeRemaining : 90
  );
  const [lives, setLives] = useState(gameState ? gameState.lives : 3);
  const [maxLives, setMaxLives] = useState(gameState ? gameState.maxLives : 3);
  const [lostIndex, setLostIndex] = useState(-1);

  useEffect(() => {
    if (!gameState) return;

    const unsubscribeMode = gameState.subscribeMode((_mode, config) => {
      const isTimerMode = typeof config?.timer === 'number';
      setHasTimer(isTimerMode);
      if (isTimerMode) {
        setTimeRemaining(gameState.timeRemaining ?? config.timer);
      }
      if (typeof config?.lives === 'number') {
        setMaxLives(config.lives);
        setLives(config.lives);
      }
    });

    let prevLives = gameState.lives;
    const unsubscribeLives = gameState.subscribeLives((currentLives, currentMax) => {
      if (currentLives !== null && currentMax !== null) {
        if (currentLives < prevLives) {
          setLostIndex(currentLives);
        } else if (currentLives === currentMax) {
          setLostIndex(-1);
        }
        prevLives = currentLives;
        setLives(currentLives);
        setMaxLives(currentMax);
      }
    });

    const unsubscribeTime = gameState.subscribeTime((time) => {
      setTimeRemaining(time);
    });

    return () => {
      unsubscribeMode();
      unsubscribeLives();
      unsubscribeTime();
    };
  }, [gameState]);

  if (hasTimer) {
    const isLowTime = timeRemaining <= 10;
    return (
      <div
        className={`${styles.container} ${styles.timerContainer} ${isLowTime ? styles.lowTime : ''}`}
        role="status"
        aria-label={`Time remaining: ${formatTime(timeRemaining)}`}
      >
        <div className={styles.timerIconBox}>
          <svg viewBox="0 0 24 24" className={styles.clockIcon} fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className={styles.timerContent}>
          <span className={styles.label}>Time</span>
          <span className={styles.timerValue}>{formatTime(timeRemaining)}</span>
        </div>
      </div>
    );
  }

  const slots = [];
  for (let i = 0; i < maxLives; i++) {
    const isActive = i < lives;
    const isJustLost = i === lostIndex;

    slots.push(
      <div
        key={i}
        className={`${styles.lifeSlot} ${isActive ? styles.activeSlot : styles.lostSlot} ${
          isJustLost ? styles.justLost : ''
        }`}
        aria-label={isActive ? 'Active life' : 'Lost life'}
      >
        <svg
          viewBox="0 0 24 24"
          className={styles.lifeIcon}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {isActive ? (
            // Active Crimson Blade Gem Emblem
            <path
              d="M12 2L15 8L21 9L16.5 14L18 20L12 17L6 20L7.5 14L3 9L9 8L12 2Z"
              fill="url(#activeLifeGrad)"
              stroke="#F43F5E"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          ) : (
            // Lost Life Cross Strike Emblem
            <g>
              <circle cx="12" cy="12" r="9" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1="8" y1="8" x2="16" y2="16" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="8" x2="8" y2="16" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
          <defs>
            <linearGradient id="activeLifeGrad" x1="12" y1="2" x2="12" y2="20" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FB7185" />
              <stop offset="0.6" stopColor="#E11D48" />
              <stop offset="1" stopColor="#9F1239" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  return (
    <div className={styles.container} role="status" aria-label={`Lives: ${lives} of ${maxLives}`}>
      <span className={styles.label}>Lives</span>
      <div className={styles.slotsContainer}>{slots}</div>
    </div>
  );
}
