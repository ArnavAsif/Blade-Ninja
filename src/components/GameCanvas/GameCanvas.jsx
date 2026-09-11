import { useEffect, useRef } from 'react';
import { GameEngine } from '../../game/GameEngine.js';
import styles from './GameCanvas.module.css';

export function GameCanvas({ gameState, onEngineReady }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Instantiate engine outside React state loop
    const engine = new GameEngine(canvas, gameState);
    engineRef.current = engine;

    if (onEngineReady) {
      onEngineReady(engine);
    }

    engine.start();

    // Use ResizeObserver for accurate pixel tracking across layouts
    const resizeObserver = new ResizeObserver(() => {
      engine.resize();
    });

    resizeObserver.observe(container);

    // Also listen to visualViewport for dynamic browser UI changes
    // (Chrome address bar show/hide, iOS toolbar changes)
    let vpResizeFrame = null;
    const handleVpResize = () => {
      if (vpResizeFrame) cancelAnimationFrame(vpResizeFrame);
      vpResizeFrame = requestAnimationFrame(() => {
        vpResizeFrame = null;
        engine.resize();
      });
    };
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener('resize', handleVpResize);
    }

    return () => {
      if (vpResizeFrame) cancelAnimationFrame(vpResizeFrame);
      if (vv) {
        vv.removeEventListener('resize', handleVpResize);
      }
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, [gameState, onEngineReady]);

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
