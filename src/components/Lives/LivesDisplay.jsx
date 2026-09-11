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
  const [animatingSlot, setAnimatingSlot] = useState(null);

  useEffect(() => {
    if (!gameState) return;

    const unsubscribeMode = gameState.subscribeMode((_mode, config) => {
      const isTimerMode = typeof config?.timer === 'number';
      setHasTimer(isTimerMode);
      if (isTimerMode) {
        setTimeRemaining(gameState.timeRemaining ?? config.timer);
      }
      if (typeof config?.lives === 'number') {
        const configuredMax = config.maxLives ?? config.lives;
        setMaxLives(configuredMax);
        setLives(config.lives);
      }
    });

    const unsubscribeLives = gameState.subscribeLives((currentLives, currentMax, event) => {
      if (currentLives !== null && currentMax !== null) {
        if (event) {
          if (event.type === 'lost') {
            setAnimatingSlot({ index: event.lostIndex, type: 'lost' });
            setTimeout(() => setAnimatingSlot(null), 650);
          } else if (event.type === 'recovered') {
            setAnimatingSlot({ index: event.recoveredIndex, type: 'recovered' });
            setTimeout(() => setAnimatingSlot(null), 800);
          } else if (event.type === 'bomb_fatal') {
            setAnimatingSlot({ index: -1, type: 'bomb_fatal' });
            setTimeout(() => setAnimatingSlot(null), 700);
          }
        }
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
  const isBombFatal = animatingSlot?.type === 'bomb_fatal';

  for (let i = 0; i < maxLives; i++) {
    const isActive = i < lives;
    const isJustLost = (animatingSlot?.type === 'lost' && animatingSlot?.index === i) || isBombFatal;
    const isJustRecovered = animatingSlot?.type === 'recovered' && animatingSlot?.index === i;

    let slotStateClass = isActive ? styles.activeSlot : styles.lostSlot;
    if (isJustLost) {
      slotStateClass = `${slotStateClass} ${styles.justLost}`;
    } else if (isJustRecovered) {
      slotStateClass = `${slotStateClass} ${styles.justRecovered}`;
    }

    slots.push(
      <div
        key={i}
        className={`${styles.lifeSlot} ${slotStateClass}`}
        aria-label={isActive ? `Life ${i + 1}: Active` : `Life ${i + 1}: Lost`}
      >
        <svg
          viewBox="0 0 32 32"
          className={styles.lifeIcon}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {isActive ? (
            // High-Definition Faceted Ruby Ninja Crest
            <g className={styles.crestGroup}>
              {/* Facet 1: Top Left highlight */}
              <path d="M16 3 L5 9 L16 15 Z" fill="#FDA4AF" />
              {/* Facet 2: Top Right light */}
              <path d="M16 3 L27 9 L16 15 Z" fill="#FB7185" />
              {/* Facet 3: Left flank body */}
              <path d="M5 9 L9 22 L16 15 Z" fill="#F43F5E" />
              {/* Facet 4: Right flank body */}
              <path d="M27 9 L23 22 L16 15 Z" fill="#E11D48" />
              {/* Facet 5: Bottom Left deep ruby */}
              <path d="M9 22 L16 29 L16 15 Z" fill="#BE123C" />
              {/* Facet 6: Bottom Right darkest ruby shadow */}
              <path d="M23 22 L16 29 L16 15 Z" fill="#9F1239" />

              {/* Inner facet seams */}
              <path
                d="M16 3 L16 29 M5 9 L27 9 M5 9 L16 15 L27 9 M9 22 L16 15 L23 22"
                stroke="rgba(255, 255, 255, 0.35)"
                strokeWidth="0.6"
              />

              {/* Outer forged platinum/ruby perimeter bevel */}
              <path
                d="M16 3 L27 9 L23 22 L16 29 L9 22 L5 9 Z"
                stroke="rgba(255, 241, 242, 0.9)"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />

              {/* Specular apex glint star */}
              <polygon points="14,6 14.8,7.5 16.5,7.8 15.2,9 15.5,10.6 14,9.8 12.5,10.6 12.8,9 11.5,7.8 13.2,7.5" fill="#FFFFFF" opacity="0.9" />
            </g>
          ) : (
            // Struck Out Titanium Slot with Katana Slash Cross
            <g className={styles.struckGroup}>
              {/* Dark titanium faceted backplate */}
              <path
                d="M16 3 L27 9 L23 22 L16 29 L9 22 L5 9 Z"
                fill="#0F172A"
                stroke="#334155"
                strokeWidth="1.2"
                strokeDasharray="2.5 2"
                strokeLinejoin="round"
              />
              <path
                d="M16 4 L26 9.5 L22.5 21.5 L16 28 L9.5 21.5 L6 9.5 Z"
                fill="#1E293B"
                opacity="0.6"
              />

              {/* Glowing etched strike slash center */}
              <circle cx="16" cy="16" r="7" fill="rgba(239, 68, 68, 0.1)" />

              {/* Visceral Red Katana Strike Cross */}
              <line x1="10" y1="10" x2="22" y2="22" stroke="#EF4444" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="22" y1="10" x2="10" y2="22" stroke="#EF4444" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          )}
        </svg>
      </div>
    );
  }

  return (
    <div className={styles.container} role="status" aria-label={`Lives: ${lives} of ${maxLives}`}>
      <div className={styles.labelGroup}>
        <span className={styles.label}>Lives</span>
        <span className={styles.countBadge}>{lives}/{maxLives}</span>
      </div>
      <div className={styles.slotsContainer}>{slots}</div>
    </div>
  );
}
