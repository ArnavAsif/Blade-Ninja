/**
 * Device detection and display pixel ratio utilities.
 */

export function getDevicePixelRatio() {
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  // Cap at 2.0 to maintain crisp Retina rendering without massive fill-rate overhead on 3x-4x displays
  return Math.min(Math.max(dpr, 1), 2.0);
}

export function isTouchDevice() {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

export function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

export function getViewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}
