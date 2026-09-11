import { useState, useMemo, useCallback } from 'react';
import { GameState } from './game/GameState.js';
import { GameCanvas } from './components/GameCanvas/GameCanvas.jsx';
import { GameUI } from './components/GameUI/GameUI.jsx';
import styles from './App.module.css';

export default function App() {
  const gameState = useMemo(() => new GameState(), []);
  const [engine, setEngine] = useState(null);

  const handleEngineReady = useCallback((engineInstance) => {
    setEngine(engineInstance);
  }, []);

  return (
    <main className={styles.appContainer}>
      <GameCanvas gameState={gameState} onEngineReady={handleEngineReady} />
      <GameUI gameState={gameState} engine={engine} />
    </main>
  );
}
