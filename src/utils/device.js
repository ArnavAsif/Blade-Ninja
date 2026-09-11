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
    typeof window !== 'undefined' &&
    ('ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches))
  );
}

export function getAvailableViewport() {
  if (typeof window === 'undefined') {
    return { width: 800, height: 600, offsetLeft: 0, offsetTop: 0 };
  }

  const vv = window.visualViewport;
  if (vv && typeof vv.width === 'number' && typeof vv.height === 'number') {
    return {
      width: Math.max(1, Math.round(vv.width)),
      height: Math.max(1, Math.round(vv.height)),
      offsetLeft: Math.round(vv.offsetLeft || 0),
      offsetTop: Math.round(vv.offsetTop || 0),
    };
  }

  const de = typeof document !== 'undefined' ? document.documentElement : null;
  const width = window.innerWidth || (de ? de.clientWidth : 800);
  const height = window.innerHeight || (de ? de.clientHeight : 600);

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    offsetLeft: 0,
    offsetTop: 0,
  };
}

export function isPortrait() {
  if (typeof window === 'undefined') return false;
  const vp = getAvailableViewport();
  return vp.height > vp.width;
}

export function getViewportSize() {
  const vp = getAvailableViewport();
  return {
    width: vp.width,
    height: vp.height,
  };
}

/**
 * Safely requests browser fullscreen and landscape orientation lock.
 * Must be triggered directly from a genuine user interaction event.
 * Gracefully ignores rejections on unsupported platforms (such as iOS Safari).
 */
export function requestAppFullscreen() {
  if (typeof document === 'undefined') return;

  try {
    const isFullscreen = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (!isFullscreen) {
      const docEl = document.documentElement;
      const requestFn =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      if (typeof requestFn === 'function') {
        const promise = requestFn.call(docEl);
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {
            // Silently fall back if blocked by browser policy
          });
        }
      }
    }

    if (
      typeof window !== 'undefined' &&
      window.screen &&
      window.screen.orientation &&
      typeof window.screen.orientation.lock === 'function'
    ) {
      const lockPromise = window.screen.orientation.lock('landscape');
      if (lockPromise && typeof lockPromise.catch === 'function') {
        lockPromise.catch(() => {
          // Gracefully ignore if orientation lock is not permitted
        });
      }
    }
  } catch {
    // Safe fallback for browsers with strict security or unsupported APIs
  }
}
