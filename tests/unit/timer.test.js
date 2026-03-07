const TimerManager = require('../../src/main/timer');

describe('TimerManager', () => {
  let timer;

  beforeEach(() => {
    jest.useFakeTimers();
    timer = new TimerManager();
  });

  afterEach(() => {
    timer.destroy();
    jest.useRealTimers();
  });

  // Construction
  describe('initial state', () => {
    test('starts not running with 0 elapsed', () => {
      const state = timer.getState();
      expect(state.running).toBe(false);
      expect(state.elapsed).toBe(0);
      expect(state.splits).toEqual([]);
    });
  });

  // toggle()
  describe('toggle()', () => {
    test('starts the timer on first toggle', () => {
      const state = timer.toggle();
      expect(state.running).toBe(true);
    });

    test('pauses the timer on second toggle', () => {
      timer.toggle(); // start
      jest.advanceTimersByTime(2000);
      const state = timer.toggle(); // pause
      expect(state.running).toBe(false);
      expect(state.elapsed).toBeGreaterThanOrEqual(2000);
    });

    test('resumes accumulating after pause + re-toggle', () => {
      timer.toggle(); // start
      jest.advanceTimersByTime(1000);
      timer.toggle(); // pause
      const elapsed1 = timer.getElapsed();
      timer.toggle(); // resume
      jest.advanceTimersByTime(500);
      const elapsed2 = timer.getElapsed();
      expect(elapsed2).toBeGreaterThanOrEqual(elapsed1 + 500);
    });
  });

  // getElapsed()
  describe('getElapsed()', () => {
    test('returns 0 when never started', () => {
      expect(timer.getElapsed()).toBe(0);
    });

    test('returns accumulated time while running', () => {
      timer.toggle();
      jest.advanceTimersByTime(3000);
      expect(timer.getElapsed()).toBeGreaterThanOrEqual(3000);
    });

    test('returns frozen time when paused', () => {
      timer.toggle();
      jest.advanceTimersByTime(1000);
      timer.toggle(); // pause
      const t1 = timer.getElapsed();
      jest.advanceTimersByTime(5000);
      const t2 = timer.getElapsed();
      expect(t2).toBe(t1);
    });
  });

  // reset()
  describe('reset()', () => {
    test('clears elapsed time', () => {
      timer.toggle();
      jest.advanceTimersByTime(5000);
      timer.reset();
      expect(timer.getElapsed()).toBe(0);
    });

    test('stops a running timer', () => {
      timer.toggle();
      const state = timer.reset();
      expect(state.running).toBe(false);
    });

    test('clears splits', () => {
      timer.toggle();
      timer.addSplit('Zone A');
      timer.reset();
      expect(timer.getState().splits).toEqual([]);
    });
  });

  // addSplit()
  describe('addSplit()', () => {
    test('records a split with label and current time', () => {
      timer.toggle();
      jest.advanceTimersByTime(2000);
      const state = timer.addSplit('The Coast');
      expect(state.splits).toHaveLength(1);
      expect(state.splits[0].label).toBe('The Coast');
      expect(state.splits[0].time).toBeGreaterThanOrEqual(2000);
    });

    test('accumulates multiple splits', () => {
      timer.toggle();
      jest.advanceTimersByTime(1000);
      timer.addSplit('A');
      jest.advanceTimersByTime(1000);
      const state = timer.addSplit('B');
      expect(state.splits).toHaveLength(2);
      expect(state.splits[1].time).toBeGreaterThan(state.splits[0].time);
    });
  });

  // onTick callback
  describe('onTick', () => {
    test('calls onTick every second while running', () => {
      const tickFn = jest.fn();
      timer.onTick = tickFn;
      timer.toggle();
      jest.advanceTimersByTime(3000);
      expect(tickFn).toHaveBeenCalledTimes(3);
    });

    test('does not call onTick when paused', () => {
      const tickFn = jest.fn();
      timer.onTick = tickFn;
      timer.toggle();
      jest.advanceTimersByTime(1000);
      timer.toggle(); // pause
      tickFn.mockClear();
      jest.advanceTimersByTime(3000);
      expect(tickFn).not.toHaveBeenCalled();
    });
  });

  // destroy()
  describe('destroy()', () => {
    test('clears interval', () => {
      timer.toggle();
      timer.destroy();
      expect(timer.interval).toBeNull();
    });
  });

  // getState()
  describe('getState()', () => {
    test('returns a snapshot with computed elapsed', () => {
      timer.toggle();
      jest.advanceTimersByTime(1500);
      const state = timer.getState();
      expect(state.elapsed).toBeGreaterThanOrEqual(1500);
      expect(state.running).toBe(true);
    });
  });
});
