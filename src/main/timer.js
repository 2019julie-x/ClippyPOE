// @ts-check
'use strict';

/**
 * TimerManager - Manages speedrun timer state with start/pause/reset/split support.
 * Lives in the main process so timer state persists across renderer reloads.
 */
class TimerManager {
  constructor() {
    /** @type {{ running: boolean, elapsed: number, startTime: number | null, splits: Array<{ label: string, time: number }> }} */
    this.state = { running: false, elapsed: 0, startTime: null, splits: [] };
    /** @type {NodeJS.Timeout | null} */
    this.interval = null;
    /** @type {((elapsed: number) => void) | null} */
    this.onTick = null;
  }

  /**
   * Toggle between running and paused.
   * @returns {{ running: boolean, elapsed: number, startTime: number | null, splits: Array<{ label: string, time: number }> }}
   */
  toggle() {
    if (this.state.running) {
      this.state.elapsed += Date.now() - this.state.startTime;
      this.state.startTime = null;
      this.state.running = false;
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
    } else {
      this.state.startTime = Date.now();
      this.state.running = true;
      this.interval = setInterval(() => {
        if (this.onTick) {
          this.onTick(this.getElapsed());
        }
      }, 1000);
    }
    return this.getState();
  }

  /** @returns {number} Current elapsed time in ms */
  getElapsed() {
    if (this.state.running && this.state.startTime) {
      return this.state.elapsed + (Date.now() - this.state.startTime);
    }
    return this.state.elapsed;
  }

  /**
   * Reset timer to initial state.
   * @returns {{ running: boolean, elapsed: number, startTime: number | null, splits: Array<{ label: string, time: number }> }}
   */
  reset() {
    this.state = { running: false, elapsed: 0, startTime: null, splits: [] };
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    return this.getState();
  }

  /**
   * Add a split at the current elapsed time.
   * @param {string} label - Split label (usually zone name)
   * @returns {{ running: boolean, elapsed: number, startTime: number | null, splits: Array<{ label: string, time: number }> }}
   */
  addSplit(label) {
    this.state.splits.push({ label, time: this.getElapsed() });
    return this.getState();
  }

  /**
   * Get current state snapshot with computed elapsed time.
   * @returns {{ running: boolean, elapsed: number, startTime: number | null, splits: Array<{ label: string, time: number }> }}
   */
  getState() {
    return { ...this.state, elapsed: this.getElapsed() };
  }

  /** Clean up interval on shutdown. */
  destroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

module.exports = TimerManager;