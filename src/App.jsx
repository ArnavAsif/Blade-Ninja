import { useState, useMemo, useCallback } from 'react';
import { GameState } from './game/GameState.js';
import { GameCanvas } from './components/GameCanvas/GameCanvas.jsx';
import { GameUI } from './components/GameUI/GameUI.jsx';
import { OrientationGuard } from './components/OrientationGuard/OrientationGuard.jsx';
import styles from './App.module.css';

export default function App() {
  const gameState = useMemo(() => new GameState(), []);
  const [engine, setEngine] = useState(null);
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth;
  });

  const handleEngineReady = useCallback((engineInstance) => {
    setEngine(engineInstance);
  }, []);

  const handlePortraitChange = useCallback((portrait) => {
    setIsPortrait(portrait);
    if (portrait && engine && gameState && gameState.getState() === 'PLAYING') {
      try {
        engine.pause();
      } catch {
        // Ignore pause errors
      }
    }
  }, [engine, gameState]);

  return (
    <main className={styles.appContainer}>
      <GameCanvas gameState={gameState} onEngineReady={handleEngineReady} />
      <GameUI gameState={gameState} engine={engine} isPortrait={isPortrait} />
      <OrientationGuard onPortraitChange={handlePortraitChange} />
    </main>
  );
}
