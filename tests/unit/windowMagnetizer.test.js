/**
 * Unit tests for WindowMagnetizer
 * Tests edge detection, snap calculations, and configuration handling
 */

// Mock electron before requiring WindowMagnetizer
jest.mock('electron', () => ({
  screen: {
    getDisplayMatching: jest.fn(),
  },
}));

const WindowMagnetizer = require('../../src/main/windowMagnetizer');

describe('WindowMagnetizer', () => {
  let magnetizer;

  beforeEach(() => {
    magnetizer = new WindowMagnetizer({ enabled: true, snapDistance: 20 });
  });

  describe('Configuration', () => {
    test('should initialize with default config', () => {
      const mag = new WindowMagnetizer();
      expect(mag.enabled).toBe(true);
      expect(mag.snapDistance).toBe(20);
    });

    test('should initialize with custom config', () => {
      const mag = new WindowMagnetizer({ enabled: false, snapDistance: 30 });
      expect(mag.enabled).toBe(false);
      expect(mag.snapDistance).toBe(30);
    });

    test('should update config via updateConfig', () => {
      magnetizer.updateConfig({ enabled: false });
      expect(magnetizer.enabled).toBe(false);
      expect(magnetizer.snapDistance).toBe(20);

      magnetizer.updateConfig({ snapDistance: 40 });
      expect(magnetizer.enabled).toBe(false);
      expect(magnetizer.snapDistance).toBe(40);
    });

    test('should clamp snap distance between 5 and 100', () => {
      magnetizer.updateConfig({ snapDistance: 3 });
      expect(magnetizer.snapDistance).toBe(5);

      magnetizer.updateConfig({ snapDistance: 150 });
      expect(magnetizer.snapDistance).toBe(100);

      magnetizer.updateConfig({ snapDistance: 50 });
      expect(magnetizer.snapDistance).toBe(50);
    });
  });

  describe('Edge Proximity Detection', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1080 };

    test('should detect left edge proximity', () => {
      const bounds = { x: 10, y: 500, width: 400, height: 600 };
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(0);
      expect(result.snapY).toBe(null);
    });

    test('should detect right edge proximity', () => {
      const bounds = { x: 1515, y: 500, width: 400, height: 600 };
      // Right edge distance: (0 + 1920) - (1515 + 400) = 5px
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(1520); // 1920 - 400
      expect(result.snapY).toBe(null);
    });

    test('should detect top edge proximity', () => {
      const bounds = { x: 500, y: 15, width: 400, height: 600 };
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(null);
      expect(result.snapY).toBe(0);
    });

    test('should detect bottom edge proximity', () => {
      const bounds = { x: 500, y: 470, width: 400, height: 600 };
      // Bottom edge distance: (0 + 1080) - (470 + 600) = 10px
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(null);
      expect(result.snapY).toBe(480); // 1080 - 600
    });

    test('should detect top-left corner proximity', () => {
      const bounds = { x: 10, y: 10, width: 400, height: 600 };
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(0);
      expect(result.snapY).toBe(0);
    });

    test('should detect bottom-right corner proximity', () => {
      const bounds = { x: 1515, y: 475, width: 400, height: 600 };
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(1520);
      expect(result.snapY).toBe(480);
    });

    test('should not snap when outside threshold', () => {
      const bounds = { x: 100, y: 100, width: 400, height: 600 };
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(false);
      expect(result.snapX).toBe(null);
      expect(result.snapY).toBe(null);
    });

    test('should not snap when exactly at threshold + 1', () => {
      const bounds = { x: 21, y: 21, width: 400, height: 600 };
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(false);
    });

    test('should snap when exactly at threshold', () => {
      const bounds = { x: 20, y: 20, width: 400, height: 600 };
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(0);
      expect(result.snapY).toBe(0);
    });
  });

  describe('Multi-Monitor Support', () => {
    test('should handle offset display coordinates', () => {
      // Second monitor at x: 1920
      const workArea = { x: 1920, y: 0, width: 1920, height: 1080 };
      const bounds = { x: 1930, y: 500, width: 400, height: 600 };
      
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(1920); // Left edge of second monitor
      expect(result.snapY).toBe(null);
    });

    test('should handle display with vertical offset', () => {
      // Display positioned below primary
      const workArea = { x: 0, y: 1080, width: 1920, height: 1080 };
      const bounds = { x: 500, y: 1090, width: 400, height: 600 };
      
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(null);
      expect(result.snapY).toBe(1080); // Top edge of lower display
    });
  });

  describe('Snap Position Calculation', () => {
    const { screen } = require('electron');
    
    beforeEach(() => {
      screen.getDisplayMatching.mockClear();
    });

    test('should return null when disabled', () => {
      magnetizer.updateConfig({ enabled: false });
      
      const mockWindow = {
        getBounds: () => ({ x: 10, y: 10, width: 400, height: 600 }),
        isDestroyed: () => false,
      };

      screen.getDisplayMatching.mockReturnValue({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      });

      const result = magnetizer.calculateSnapPosition(mockWindow);
      expect(result).toBe(null);
    });

    test('should return null for destroyed window', () => {
      const mockWindow = {
        isDestroyed: () => true,
      };

      const result = magnetizer.calculateSnapPosition(mockWindow);
      expect(result).toBe(null);
    });

    test('should return null when outside snap threshold', () => {
      const mockWindow = {
        getBounds: () => ({ x: 100, y: 100, width: 400, height: 600 }),
        isDestroyed: () => false,
      };

      screen.getDisplayMatching.mockReturnValue({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      });

      const result = magnetizer.calculateSnapPosition(mockWindow);
      expect(result).toBe(null);
    });

    test('should return snap position when near edge', () => {
      const mockWindow = {
        getBounds: () => ({ x: 10, y: 15, width: 400, height: 600 }),
        isDestroyed: () => false,
      };

      screen.getDisplayMatching.mockReturnValue({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      });

      const result = magnetizer.calculateSnapPosition(mockWindow);
      expect(result).not.toBe(null);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle window larger than screen', () => {
      const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
      const bounds = { x: -100, y: -100, width: 2200, height: 1400 };
      
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      // Should not snap when window extends beyond screen boundaries
      expect(result.shouldSnap).toBe(false);
    });

    test('should handle window at exact edge', () => {
      const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
      const bounds = { x: 0, y: 0, width: 400, height: 600 };
      
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(0);
      expect(result.snapY).toBe(0);
    });

    test('should handle minimum snap distance', () => {
      magnetizer.updateConfig({ snapDistance: 5 }); // Minimum is 5
      expect(magnetizer.snapDistance).toBe(5);
      
      const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
      // Window at distance 5 (exactly at threshold) should snap
      const boundsAtThreshold = { x: 5, y: 0, width: 400, height: 600 };
      
      const resultAtThreshold = magnetizer._checkEdgeProximity(boundsAtThreshold, workArea);
      expect(resultAtThreshold.shouldSnap).toBe(true);
      expect(resultAtThreshold.snapX).toBe(0);
      
      // Window at distance 4 should also snap (within threshold)
      const boundsWithin = { x: 4, y: 0, width: 400, height: 600 };
      const resultWithin = magnetizer._checkEdgeProximity(boundsWithin, workArea);
      expect(resultWithin.shouldSnap).toBe(true);
    });

    test('should handle large snap distance', () => {
      magnetizer.updateConfig({ snapDistance: 100 });
      
      const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
      const bounds = { x: 50, y: 50, width: 400, height: 600 };
      
      const result = magnetizer._checkEdgeProximity(bounds, workArea);
      expect(result.shouldSnap).toBe(true);
      expect(result.snapX).toBe(0);
      expect(result.snapY).toBe(0);
    });
  });

  describe('wouldSnap Helper', () => {
    test('should return true when position would snap', () => {
      const bounds = { x: 10, y: 10, width: 400, height: 600 };
      const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
      
      const result = magnetizer.wouldSnap(bounds, display);
      expect(result).toBe(true);
    });

    test('should return false when position would not snap', () => {
      const bounds = { x: 100, y: 100, width: 400, height: 600 };
      const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
      
      const result = magnetizer.wouldSnap(bounds, display);
      expect(result).toBe(false);
    });

    test('should return false when disabled', () => {
      magnetizer.updateConfig({ enabled: false });
      
      const bounds = { x: 10, y: 10, width: 400, height: 600 };
      const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
      
      const result = magnetizer.wouldSnap(bounds, display);
      expect(result).toBe(false);
    });
  });
});
