const { screen } = require('electron');

/**
 * WindowMagnetizer - Provides edge detection and window snapping functionality
 * 
 * Automatically snaps windows to screen edges when dragged within a threshold distance,
 * improving UX by making it easier to align windows precisely.
 */
class WindowMagnetizer {
  constructor(config = {}) {
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    this.snapDistance = config.snapDistance || 20;
  }

  /**
   * Update configuration
   * @param {Object} config - Configuration object
   * @param {boolean} config.enabled - Enable/disable magnetization
   * @param {number} config.snapDistance - Distance threshold for snapping (px)
   */
  updateConfig(config) {
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
    if (config.snapDistance !== undefined) {
      this.snapDistance = Math.max(5, Math.min(100, config.snapDistance));
    }
  }

  /**
   * Calculate snapped position for a window
   * @param {Electron.BrowserWindow} window - The window to snap
   * @returns {Object|null} - { x, y } if snapping should occur, null otherwise
   */
  calculateSnapPosition(window) {
    if (!this.enabled || !window || window.isDestroyed()) {
      return null;
    }

    try {
      const windowBounds = window.getBounds();
      const display = screen.getDisplayMatching(windowBounds);
      
      if (!display) {
        return null;
      }

      const workArea = display.workArea;
      const snapResult = this._checkEdgeProximity(windowBounds, workArea);

      if (!snapResult.shouldSnap) {
        return null;
      }

      return {
        x: snapResult.snapX !== null ? snapResult.snapX : windowBounds.x,
        y: snapResult.snapY !== null ? snapResult.snapY : windowBounds.y,
      };
    } catch (err) {
      console.error('WindowMagnetizer: Error calculating snap position:', err);
      return null;
    }
  }

  /**
   * Check if window is near screen edges and calculate snap positions
   * @private
   * @param {Object} bounds - Window bounds { x, y, width, height }
   * @param {Object} workArea - Display work area { x, y, width, height }
   * @returns {Object} - Snap result with coordinates and snap flag
   */
  _checkEdgeProximity(bounds, workArea) {
    const result = {
      shouldSnap: false,
      snapX: null,
      snapY: null,
    };

    // Calculate distances to each edge
    const distanceToLeft = bounds.x - workArea.x;
    const distanceToRight = (workArea.x + workArea.width) - (bounds.x + bounds.width);
    const distanceToTop = bounds.y - workArea.y;
    const distanceToBottom = (workArea.y + workArea.height) - (bounds.y + bounds.height);

    // Check left edge
    if (distanceToLeft >= 0 && distanceToLeft <= this.snapDistance) {
      result.snapX = workArea.x;
      result.shouldSnap = true;
    }
    // Check right edge
    else if (distanceToRight >= 0 && distanceToRight <= this.snapDistance) {
      result.snapX = workArea.x + workArea.width - bounds.width;
      result.shouldSnap = true;
    }

    // Check top edge
    if (distanceToTop >= 0 && distanceToTop <= this.snapDistance) {
      result.snapY = workArea.y;
      result.shouldSnap = true;
    }
    // Check bottom edge
    else if (distanceToBottom >= 0 && distanceToBottom <= this.snapDistance) {
      result.snapY = workArea.y + workArea.height - bounds.height;
      result.shouldSnap = true;
    }

    return result;
  }

  /**
   * Get edge information for debugging/testing
   * @param {Electron.BrowserWindow} window - The window to analyze
   * @returns {Object|null} - Edge distances and snap state
   */
  getEdgeInfo(window) {
    if (!window || window.isDestroyed()) {
      return null;
    }

    try {
      const bounds = window.getBounds();
      const display = screen.getDisplayMatching(bounds);
      
      if (!display) {
        return null;
      }

      const workArea = display.workArea;

      return {
        bounds,
        workArea,
        distances: {
          left: bounds.x - workArea.x,
          right: (workArea.x + workArea.width) - (bounds.x + bounds.width),
          top: bounds.y - workArea.y,
          bottom: (workArea.y + workArea.height) - (bounds.y + bounds.height),
        },
        snapDistance: this.snapDistance,
        enabled: this.enabled,
      };
    } catch (err) {
      console.error('WindowMagnetizer: Error getting edge info:', err);
      return null;
    }
  }

  /**
   * Check if a position would trigger snapping (useful for UI feedback)
   * @param {Object} bounds - Window bounds { x, y, width, height }
   * @param {Object} display - Display object
   * @returns {boolean} - True if position would snap
   */
  wouldSnap(bounds, display) {
    if (!this.enabled || !display) {
      return false;
    }

    const workArea = display.workArea;
    const snapResult = this._checkEdgeProximity(bounds, workArea);
    return snapResult.shouldSnap;
  }
}

module.exports = WindowMagnetizer;
