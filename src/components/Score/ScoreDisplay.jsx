import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import styles from './ScoreDisplay.module.css';

export function ScoreDisplay({ gameState }) {
  const [score, setScore] = useState(gameState ? gameState.score : 0);
  const [bestScore, setBestScore] = useState(gameState ? gameState.bestScore : 0);
  const scoreRef = useRef(null);
  const prevScoreRef = useRef(score);

  useEffect(() => {
    if (!gameState) return;

    const unsubscribe = gameState.subscribeScore((newScore, newBest) => {
      if (newScore > prevScoreRef.current && scoreRef.current) {
        gsap.killTweensOf(scoreRef.current);
        gsap.fromTo(
          scoreRef.current,
          { scale: 1.25, filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.9))' },
          {
            scale: 1.0,
            filter: 'drop-shadow(0 0 0px rgba(56, 189, 248, 0))',
            duration: 0.22,
            ease: 'back.out(2)',
          }
        );
      }
      prevScoreRef.current = newScore;
      setScore(newScore);
      setBestScore(newBest);
    });

    return unsubscribe;
  }, [gameState]);

  return (
    <div className={styles.container}>
      <div className={styles.statBox}>
        <span className={styles.label}>Score</span>
        <span ref={scoreRef} className={`${styles.value} ${styles.valuePrimary}`}>
          {score}
        </span>
      </div>
      <div className={styles.statBox}>
        <span className={styles.label}>Record</span>
        <span className={styles.value}>{bestScore}</span>
      </div>
    </div>
  );
}
