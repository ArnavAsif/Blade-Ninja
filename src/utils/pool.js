/**
 * Generic high-performance object pool to prevent garbage collection spikes.
 */

export class ObjectPool {
  constructor(factoryFn, resetFn, initialCapacity = 20) {
    this.factoryFn = factoryFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.active = [];

    for (let i = 0; i < initialCapacity; i++) {
      this.pool.push(this.factoryFn());
    }
  }

  obtain(...args) {
    let item;
    if (this.pool.length > 0) {
      item = this.pool.pop();
    } else {
      item = this.factoryFn();
    }

    if (this.resetFn) {
      this.resetFn(item, ...args);
    }

    this.active.push(item);
    return item;
  }

  release(item) {
    const index = this.active.indexOf(item);
    if (index !== -1) {
      // O(1) swap-with-last to prevent shifting elements in active array
      const last = this.active.pop();
      if (index < this.active.length) {
        this.active[index] = last;
      }
      this.pool.push(item);
    }
  }

  releaseAll() {
    while (this.active.length > 0) {
      const item = this.active.pop();
      this.pool.push(item);
    }
  }

  getActiveItems() {
    return this.active;
  }

  getActiveCount() {
    return this.active.length;
  }

  getFreeCount() {
    return this.pool.length;
  }

  clear() {
    this.pool = [];
    this.active = [];
  }
}
