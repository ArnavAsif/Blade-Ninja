/**
 * High-performance pointer input manager decoupled from React.
 * Handles mouse, touch, and stylus events using Pointer Events API,
 * coalesced event interpolation, zero-allocation point pooling,
 * and gestures/touch-scroll prevention.
 */

class TrailPoint {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.time = 0;
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
  }

  set(x, y, time, speed = 0, vx = 0, vy = 0) {
    this.x = x;
    this.y = y;
    this.time = time;
    this.speed = speed;
    this.vx = vx;
    this.vy = vy;
  }
}

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.isDown = false;
    this.pointerId = null;

    this.currentPos = { x: 0, y: 0 };
    this.previousPos = { x: 0, y: 0 };
    this.smoothedSpeed = 0;

    // Point memory pool to eliminate garbage collection during rapid swiping
    this.maxTrailPoints = 48;
    this.trailDurationMs = 190; // Lifetime of trail points in ms
    this.minDistanceThresholdSq = 2.5 * 2.5; // Fine sub-pixel movement threshold
    this.minSliceSpeed = 120; // Minimum px/s to register an active slice cut
    this.currentSwipeId = 1;

    this.pointPool = [];
    for (let i = 0; i < this.maxTrailPoints + 15; i++) {
      this.pointPool.push(new TrailPoint());
    }

    this.activePoints = [];

    // Pre-allocated segment objects to eliminate GC in cutting detection
    this.reusableCutSegment = { p1: null, p2: null, speed: 0, swipeId: 1 };
    this.segmentPool = Array.from({ length: 12 }, () => ({ p1: null, p2: null, speed: 0, swipeId: 1 }));
    this.activeSegments = [];

    // Bound event listeners
    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onPointerCancel = this.handlePointerCancel.bind(this);
    this.onContextMenu = (e) => e.preventDefault();
    this.onLostPointerCapture = this.handleLostPointerCapture.bind(this);

    // Explicit mobile touch navigation and zoom lock
    this.onTouchStart = (e) => {
      if (e.cancelable) e.preventDefault();
    };
    this.onTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
    };
    this.onGestureStart = (e) => {
      if (e.cancelable) e.preventDefault();
    };

    this.attach();
  }

  attach() {
    if (!this.canvas) return;

    this.canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    this.canvas.addEventListener('lostpointercapture', this.onLostPointerCapture);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', this.onPointerMove, { passive: false });
      window.addEventListener('pointerup', this.onPointerUp, { passive: false });
      window.addEventListener('pointercancel', this.onPointerCancel, { passive: false });
      window.addEventListener('gesturestart', this.onGestureStart, { passive: false });
    }
  }

  detach() {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('lostpointercapture', this.onLostPointerCapture);
      this.canvas.removeEventListener('contextmenu', this.onContextMenu);
      this.canvas.removeEventListener('touchstart', this.onTouchStart);
      this.canvas.removeEventListener('touchmove', this.onTouchMove);
      try {
        if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId)) {
          this.canvas.releasePointerCapture(this.pointerId);
        }
      } catch {
        // Ignore capture release exceptions on detached elements
      }
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerCancel);
      window.removeEventListener('gesturestart', this.onGestureStart);
    }
  }

  getCanvasCoordinates(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  obtainPoint(x, y, time, speed = 0, vx = 0, vy = 0) {
    let pt;
    if (this.pointPool.length > 0) {
      pt = this.pointPool.pop();
    } else if (this.activePoints.length >= this.maxTrailPoints) {
      pt = this.activePoints.shift();
    } else {
      pt = new TrailPoint();
    }

    pt.set(x, y, time, speed, vx, vy);
    return pt;
  }

  releasePoint(pt) {
    if (this.pointPool.length < this.maxTrailPoints + 20) {
      this.pointPool.push(pt);
    }
  }

  handlePointerDown(e) {
    // Only track single primary pointer at a time
    if (this.isDown && this.pointerId !== null) {
      return;
    }

    if (e.cancelable) {
      e.preventDefault();
    }

    this.isDown = true;
    this.pointerId = e.pointerId;
    this.smoothedSpeed = 0;
    this.currentSwipeId++;

    try {
      if (this.canvas && typeof this.canvas.setPointerCapture === 'function') {
        this.canvas.setPointerCapture(e.pointerId);
      }
    } catch {
      // Ignore if setPointerCapture is unsupported
    }

    const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
    const now = performance.now();

    this.currentPos.x = coords.x;
    this.currentPos.y = coords.y;
    this.previousPos.x = coords.x;
    this.previousPos.y = coords.y;

    // Clear active points back to pool
    while (this.activePoints.length > 0) {
      this.releasePoint(this.activePoints.pop());
    }

    this.activePoints.push(this.obtainPoint(coords.x, coords.y, now, 0, 0, 0));
  }

  handlePointerMove(e) {
    if (!this.isDown || (this.pointerId !== null && this.pointerId !== e.pointerId)) {
      return;
    }

    if (e.cancelable) {
      e.preventDefault();
    }

    // Process coalesced events for high-precision sensor capture if supported
    const rawEvents = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const len = rawEvents.length;

    for (let i = 0; i < len; i++) {
      const evt = rawEvents[i];
      const coords = this.getCanvasCoordinates(evt.clientX, evt.clientY);
      const now = performance.now();

      // Check distance from most recent point to avoid point bunching and stationary jitter
      if (this.activePoints.length > 0) {
        const last = this.activePoints[this.activePoints.length - 1];
        const dx = coords.x - last.x;
        const dy = coords.y - last.y;
        const distSq = dx * dx + dy * dy;

        // Skip micro-movements under threshold
        if (distSq < this.minDistanceThresholdSq) {
          continue;
        }
      }

      this.previousPos.x = this.currentPos.x;
      this.previousPos.y = this.currentPos.y;
      this.currentPos.x = coords.x;
      this.currentPos.y = coords.y;

      let instantSpeed = 0;
      let vx = 0;
      let vy = 0;
      if (this.activePoints.length > 0) {
        const last = this.activePoints[this.activePoints.length - 1];
        const dt = (now - last.time) / 1000;
        if (dt > 0.001) {
          const dx = coords.x - last.x;
          const dy = coords.y - last.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          instantSpeed = dist / dt;
          vx = dx / dt;
          vy = dy / dt;
        } else {
          instantSpeed = last.speed;
          vx = last.vx;
          vy = last.vy;
        }
      }

      this.smoothedSpeed = this.smoothedSpeed > 0
        ? this.smoothedSpeed * 0.35 + instantSpeed * 0.65
        : instantSpeed;

      if (this.activePoints.length >= this.maxTrailPoints) {
        const oldest = this.activePoints.shift();
        this.releasePoint(oldest);
      }

      this.activePoints.push(this.obtainPoint(coords.x, coords.y, now, this.smoothedSpeed, vx, vy));
    }
  }

  handlePointerUp(e) {
    if (this.pointerId !== null && this.pointerId !== e.pointerId) return;

    try {
      if (this.canvas && typeof this.canvas.hasPointerCapture === 'function' && this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    this.isDown = false;
    this.pointerId = null;
  }

  handlePointerCancel(e) {
    if (this.pointerId !== null && this.pointerId !== e.pointerId) return;

    try {
      if (this.canvas && this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    this.isDown = false;
    this.pointerId = null;
  }

  handleLostPointerCapture(e) {
    if (this.pointerId === e.pointerId) {
      this.isDown = false;
      this.pointerId = null;
    }
  }

  update(currentTime = performance.now()) {
    // Prune points that have exceeded trail duration
    const cutoff = currentTime - this.trailDurationMs;

    while (this.activePoints.length > 0 && this.activePoints[0].time < cutoff) {
      const expired = this.activePoints.shift();
      this.releasePoint(expired);
    }

    // Reset position state if no active points remain
    if (!this.isDown && this.activePoints.length === 0) {
      this.previousPos.x = this.currentPos.x;
      this.previousPos.y = this.currentPos.y;
      this.smoothedSpeed = 0;
    }
  }

  getTrailPoints() {
    return this.activePoints;
  }

  /**
   * Returns current active swipe speed (pixels/second) across recent points.
   */
  getSwipeSpeed() {
    if (this.smoothedSpeed > 0) {
      return this.smoothedSpeed;
    }

    const pts = this.activePoints;
    if (pts.length < 2) return 0;

    const pNew = pts[pts.length - 1];
    const pOld = pts[Math.max(0, pts.length - 3)];
    const dt = (pNew.time - pOld.time) / 1000;

    if (dt <= 0) return 0;

    const dx = pNew.x - pOld.x;
    const dy = pNew.y - pOld.y;
    return Math.sqrt(dx * dx + dy * dy) / dt;
  }

  /**
   * Returns active slice segment [p1, p2] and speed if pointer is actively swiping fast enough.
   */
  getActiveCutSegment() {
    if (!this.isDown || this.activePoints.length < 2) return null;

    const pts = this.activePoints;
    const p2 = pts[pts.length - 1];
    const p1 = pts[pts.length - 2];
    const dt = (p2.time - p1.time) / 1000;

    if (dt <= 0) return null;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = dist / dt;

    if (speed >= this.minSliceSpeed) {
      this.reusableCutSegment.p1 = p1;
      this.reusableCutSegment.p2 = p2;
      this.reusableCutSegment.speed = speed;
      this.reusableCutSegment.swipeId = this.currentSwipeId;
      return this.reusableCutSegment;
    }

    return null;
  }

  /**
   * Returns all recent cutting segments across current swipe gesture.
   * Uses pre-allocated pool to eliminate GC frame drops during high-speed multi-fruit slicing.
   */
  getActiveCutSegments() {
    this.activeSegments.length = 0;
    if (!this.isDown || this.activePoints.length < 2) return this.activeSegments;

    const pts = this.activePoints;
    const count = pts.length;
    const startIdx = Math.max(1, count - 5);
    let segIdx = 0;

    for (let i = startIdx; i < count; i++) {
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const dt = (p2.time - p1.time) / 1000;
      if (dt <= 0) continue;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = dist / dt;

      if (speed >= this.minSliceSpeed) {
        if (segIdx >= this.segmentPool.length) {
          this.segmentPool.push({ p1: null, p2: null, speed: 0, swipeId: this.currentSwipeId });
        }
        const seg = this.segmentPool[segIdx++];
        seg.p1 = p1;
        seg.p2 = p2;
        seg.speed = speed;
        seg.swipeId = this.currentSwipeId;
        this.activeSegments.push(seg);
      }
    }

    return this.activeSegments;
  }

  getCurrentSwipeId() {
    return this.currentSwipeId;
  }

  reset() {
    this.isDown = false;
    this.pointerId = null;
    this.smoothedSpeed = 0;
    while (this.activePoints.length > 0) {
      this.releasePoint(this.activePoints.pop());
    }
  }

  destroy() {
    this.detach();
    while (this.activePoints.length > 0) {
      this.releasePoint(this.activePoints.pop());
    }
    this.pointPool = [];
  }
}
