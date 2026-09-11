import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { GameState } from './game/GameState.js';
import { GameCanvas } from './components/GameCanvas/GameCanvas.jsx';
import { GameUI } from './components/GameUI/GameUI.jsx';
import { OrientationGuard } from './components/OrientationGuard/OrientationGuard.jsx';
import { getAvailableViewport, isPortrait as checkIsPortrait } from './utils/device.js';
import styles from './App.module.css';

export default function App() {
  const containerRef = useRef(null);
  const gameState = useMemo(() => new GameState(), []);
  const [engine, setEngine] = useState(null);
  const [isPortrait, setIsPortrait] = useState(() => checkIsPortrait());

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

  // Synchronize app container with visualViewport (accounts for Chrome top bar, Dynamic Island, and cutouts)
  useEffect(() => {
    let resizeFrame = null;

    const syncViewport = () => {
      if (!containerRef.current || typeof window === 'undefined') return;

      const vp = getAvailableViewport();
      containerRef.current.style.width = `${vp.width}px`;
      containerRef.current.style.height = `${vp.height}px`;
      containerRef.current.style.top = `${vp.offsetTop}px`;
      containerRef.current.style.left = `${vp.offsetLeft}px`;
    };

    const handleViewportChange = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(syncViewport);
    };

    syncViewport();

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, []);

  return (
    <main ref={containerRef} className={styles.appContainer}>
      <GameCanvas gameState={gameState} onEngineReady={handleEngineReady} />
      <GameUI gameState={gameState} engine={engine} isPortrait={isPortrait} />
      <OrientationGuard onPortraitChange={handlePortraitChange} />
    </main>
  );
}
