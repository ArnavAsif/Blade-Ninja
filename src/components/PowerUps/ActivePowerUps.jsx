import { useState, useEffect } from 'react';
import styles from './ActivePowerUps.module.css';

function PowerUpIcon({ type, color }) {
  switch (type) {
    case 'slow_motion':
      return (
        <svg viewBox="0 0 24 24" className={styles.iconSvg} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="2" x2="12" y2="22" />
          <line x1="12" y1="2" x2="9" y2="5" />
          <line x1="12" y1="2" x2="15" y2="5" />
          <line x1="12" y1="22" x2="9" y2="19" />
          <line x1="12" y1="22" x2="15" y2="19" />
          <line x1="3.5" y1="7" x2="20.5" y2="17" />
          <line x1="3.5" y1="17" x2="20.5" y2="7" />
          <circle cx="12" cy="12" r="2" fill={color} />
        </svg>
      );
    case 'frenzy':
      return (
        <svg viewBox="0 0 24 24" className={styles.iconSvg} fill={color}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'double_score':
      return (
        <svg viewBox="0 0 24 24" className={styles.iconSvg} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          <path d="M7 9a2 2 0 0 1 3 0c.5.5.5 1.5-1 2.5l-2 1.5h3" />
          <path d="M14 9.5l3 5" />
          <path d="M17 9.5l-3 5" />
        </svg>
      );
    case 'blade_boost':
      return (
        <svg viewBox="0 0 24 24" className={styles.iconSvg} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill={color} fillOpacity="0.25" />
          <line x1="4" y1="20" x2="20" y2="4" strokeWidth="2.5" stroke="#FFFFFF" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={styles.iconSvg} fill={color}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

export function ActivePowerUps({ engine }) {
  const [activePowerUps, setActivePowerUps] = useState([]);

  useEffect(() => {
    if (!engine || !engine.powerUpManager) return;

    const unsubscribe = engine.powerUpManager.subscribe((powerUps) => {
      setActivePowerUps([...powerUps]);
    });

    return unsubscribe;
  }, [engine]);

  if (activePowerUps.length === 0) return null;

  return (
    <aside className={styles.powerUpsContainer} aria-label="Active Power-Ups">
      {activePowerUps.map((item) => {
        const radius = 14;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference * (1 - item.progress);
        const secondsLeft = Math.max(0, item.remainingTime).toFixed(1);

        return (
          <div
            key={item.type}
            className={`${styles.powerUpBadge} ${item.isExpiring ? styles.expiring : ''}`}
            style={{
              '--pu-primary': item.primaryColor,
              '--pu-glow': item.glowColor,
              '--pu-dark': item.darkColor,
            }}
          >
            {/* Circular Progress Timer Ring */}
            <div className={styles.timerRingWrapper}>
              <svg className={styles.progressRing} width="36" height="36" viewBox="0 0 36 36">
                <circle
                  className={styles.progressTrack}
                  cx="18"
                  cy="18"
                  r={radius}
                />
                <circle
                  className={styles.progressFill}
                  cx="18"
                  cy="18"
                  r={radius}
                  stroke={item.primaryColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className={styles.iconWrapper}>
                <PowerUpIcon type={item.type} color={item.primaryColor} />
              </div>
            </div>

            {/* Label & Remaining Time */}
            <div className={styles.infoWrapper}>
              <span className={styles.badgeTitle}>{item.badgeText}</span>
              <span className={styles.badgeTimer}>{secondsLeft}s</span>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
