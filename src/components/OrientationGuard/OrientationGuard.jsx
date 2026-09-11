import { useState, useEffect } from 'react';
import { isPortrait as checkIsPortrait } from '../../utils/device.js';
import styles from './OrientationGuard.module.css';

/**
 * OrientationGuard detects portrait mode on mobile/tablet/desktop viewports.
 * When portrait is active, it presents a minimal, elegant rotate-device screen
 * and blocks gameplay interactions.
 * Absolutely no emojis are used.
 */
export function OrientationGuard({ onPortraitChange = null }) {
  const [isPortrait, setIsPortrait] = useState(() => checkIsPortrait());

  useEffect(() => {
    const evaluateOrientation = () => {
      const portrait = checkIsPortrait();
      setIsPortrait(portrait);
      if (onPortraitChange) {
        onPortraitChange(portrait);
      }
    };

    evaluateOrientation();

    window.addEventListener('resize', evaluateOrientation);
    window.addEventListener('orientationchange', evaluateOrientation);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', evaluateOrientation);
    }

    let mql = null;
    if (typeof window.matchMedia === 'function') {
      mql = window.matchMedia('(orientation: portrait)');
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', evaluateOrientation);
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(evaluateOrientation);
      }
    }

    return () => {
      window.removeEventListener('resize', evaluateOrientation);
      window.removeEventListener('orientationchange', evaluateOrientation);
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', evaluateOrientation);
      }
      if (mql) {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', evaluateOrientation);
        } else if (typeof mql.removeListener === 'function') {
          mql.removeListener(evaluateOrientation);
        }
      }
    };
  }, [onPortraitChange]);

  if (!isPortrait) return null;

  return (
    <aside
      className={styles.overlay}
      role="alert"
      aria-live="assertive"
      aria-label="Device rotation required: Please rotate device to landscape"
    >
      <div className={styles.ambientGlow} />

      <div className={styles.card}>
        {/* Animated Rotating Phone Vector Graphic */}
        <div className={styles.deviceIconWrapper}>
          <svg
            viewBox="0 0 80 80"
            className={styles.deviceSvg}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Circular Rotation Track */}
            <path
              d="M 40 10 A 30 30 0 1 1 14 55"
              stroke="rgba(56, 189, 248, 0.25)"
              strokeWidth="2.5"
              strokeDasharray="4 4"
            />
            {/* Arrow Head */}
            <polygon
              points="14,48 10,58 20,56"
              fill="var(--accent-cyan, #38BDF8)"
            />

            {/* Rotating Smartphone Frame */}
            <g className={styles.phoneGroup}>
              {/* Outer phone casing */}
              <rect
                x="28"
                y="16"
                width="24"
                height="48"
                rx="5"
                fill="#0F172A"
                stroke="var(--accent-cyan, #38BDF8)"
                strokeWidth="2"
              />
              {/* Screen area */}
              <rect
                x="31"
                y="22"
                width="18"
                height="36"
                rx="2"
                fill="rgba(56, 189, 248, 0.15)"
              />
              {/* Speaker notch */}
              <line
                x1="36"
                y1="19"
                x2="44"
                y2="19"
                stroke="#64748B"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Home indicator bar */}
              <line
                x1="37"
                y1="60"
                x2="43"
                y2="60"
                stroke="#64748B"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
          </svg>
        </div>

        {/* Orientation Guidance Text */}
        <div className={styles.badgeRow}>
          <span className={styles.landscapePill}>Landscape Required</span>
        </div>

        <h2 className={styles.title}>Rotate Your Device</h2>

        <p className={styles.message}>
          Blade Ninja is designed for landscape gameplay. Rotate your device to horizontal orientation to slice targets.
        </p>

        <div className={styles.divider} />

        <div className={styles.tipBox}>
          <svg
            viewBox="0 0 24 24"
            className={styles.tipIcon}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span className={styles.tipText}>Gameplay will resume automatically once rotated</span>
        </div>
      </div>
    </aside>
  );
}
