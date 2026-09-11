import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { CrestIcon, AchievementCategoryIcon } from '../Progression/ProgressionIcons.jsx';
import styles from './AchievementToast.module.css';

export function AchievementToast({ progressionManager, audioManager }) {
  const [current, setCurrent] = useState(null);
  const queueRef = useRef([]);
  const cardRef = useRef(null);

  const processNext = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      setCurrent(next);
    } else {
      setCurrent(null);
    }
  }, []);

  // Subscribe to real-time achievement unlocks
  useEffect(() => {
    if (!progressionManager || typeof progressionManager.subscribeAchievementUnlock !== 'function') {
      return;
    }

    const unsubscribe = progressionManager.subscribeAchievementUnlock((ach) => {
      setCurrent((active) => {
        if (!active) {
          return ach;
        }
        queueRef.current.push(ach);
        return active;
      });
    });

    return unsubscribe;
  }, [progressionManager]);

  // Handle entrance and exit animations
  useEffect(() => {
    if (!current || !cardRef.current) return;

    // Play sparkling unlock chime
    if (audioManager && typeof audioManager.playAchievementUnlock === 'function') {
      try {
        audioManager.playAchievementUnlock();
      } catch (err) {
        console.warn('Audio playback error for achievement unlock:', err);
      }
    }

    const element = cardRef.current;
    const tl = gsap.timeline();

    // 1. Subtle entrance animation: gentle drop with soft bounce
    tl.fromTo(
      element,
      { opacity: 0, y: -26, scale: 0.92 },
      { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.4)' }
    )
      // 2. Display duration (~3.2 seconds)
      .to(element, {
        opacity: 0,
        y: -18,
        scale: 0.95,
        duration: 0.25,
        ease: 'power2.in',
        delay: 3.2,
        onComplete: () => {
          processNext();
        },
      });

    return () => {
      tl.kill();
    };
  }, [current, audioManager, processNext]);

  if (!current) return null;

  return (
    <div className={styles.toastContainer} aria-live="polite" role="status">
      <div ref={cardRef} className={styles.toastCard}>
        <div className={styles.iconWrapper}>
          <AchievementCategoryIcon type={current.iconType || current.id} size={20} />
        </div>

        <div className={styles.textGroup}>
          <span className={styles.categorySubtitle}>Achievement Unlocked</span>
          <span className={styles.title}>{current.title}</span>
        </div>

        {current.reward > 0 && (
          <div className={styles.rewardPill} title="Blade Crests Earned">
            <CrestIcon size={13} />
            <span className={styles.rewardAmount}>+{current.reward}</span>
          </div>
        )}
      </div>
    </div>
  );
}
