import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import styles from './ComboDisplay.module.css';

export function ComboDisplay({ gameState, combo: propCombo = 0 }) {
  const [combo, setCombo] = useState(gameState ? gameState.combo : propCombo);
  const badgeRef = useRef(null);

  useEffect(() => {
    if (!gameState) return;

    let timer = null;
    const unsubscribe = gameState.subscribeCombo((newCombo) => {
      setCombo(newCombo);
      if (timer) clearTimeout(timer);

      if (newCombo > 1) {
        timer = setTimeout(() => {
          setCombo(0);
        }, 1200);
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [gameState]);

  const activeCombo = gameState ? combo : propCombo;

  // GSAP Combo pop transition on combo change
  useEffect(() => {
    if (activeCombo > 1 && badgeRef.current) {
      gsap.killTweensOf(badgeRef.current);
      const randomRot = (Math.random() - 0.5) * 12;
      gsap.fromTo(
        badgeRef.current,
        { scale: 0.7, rotation: randomRot, opacity: 0.7 },
        { scale: 1, rotation: 0, opacity: 1, duration: 0.28, ease: 'back.out(2)' }
      );
    }
  }, [activeCombo]);

  if (activeCombo <= 1) return <div className={styles.container} />;

  const isMegaCombo = activeCombo >= 4 && activeCombo < 5;
  const isMaxCombo = activeCombo >= 5;

  let comboClass = styles.comboBadge;
  let comboText = 'Combo';

  if (isMaxCombo) {
    comboClass = `${styles.comboBadge} ${styles.maxCombo}`;
    comboText = 'Max Combo!';
  } else if (isMegaCombo) {
    comboClass = `${styles.comboBadge} ${styles.megaCombo}`;
    comboText = 'Mega Combo';
  }

  return (
    <div className={styles.container}>
      <div ref={badgeRef} className={comboClass}>
        <span className={styles.multiplier}>{activeCombo}x</span>
        <span className={styles.text}>{comboText}</span>
      </div>
    </div>
  );
}
