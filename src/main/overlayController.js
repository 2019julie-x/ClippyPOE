'use strict';

/**
 * OverlayController manages the interaction state of an Electron overlay window.
 *
 * Two modes:
 *   - **interactive**: the overlay captures mouse/keyboard input.
 *   - **clickthrough**: input passes through to the game underneath.
 *
 * Clickthrough is achieved via `BrowserWindow.setIgnoreMouseEvents`.
 * On Windows/macOS the `{ forward: true }` option is used so the renderer
 * can still detect hover events (useful for re-activating on mouse-enter).
 * Linux does not support the forward option.
 *
 * Inspired by the overlay toggling approach used by Awakened PoE Trade.
 */
class OverlayController {
  /**
   * @param {Object}  platformInfo            Platform detection flags.
   * @param {boolean} platformInfo.isLinux
   * @param {boolean} platformInfo.isWindows
   * @param {boolean} platformInfo.isMac
   * @param {number}  [baseOpacity=0.95]      Opacity when the overlay is interactive.
   */
  constructor(platformInfo, baseOpacity = 0.95) {
    /** @type {{ isLinux: boolean, isWindows: boolean, isMac: boolean }} */
    this.platform = Object.freeze({ ...platformInfo });

    /** @type {number} Full opacity used in interactive mode (0-1). */
    this.baseOpacity = baseOpacity;

    /** @type {Electron.BrowserWindow | null} */
    this.win = null;

    /**
     * `true`  = interactive (overlay captures input)
     * `false` = clickthrough (input falls through to the game)
     * @type {boolean}
     */
    this.interactive = false;
  }

  // ---------------------------------------------------------------------------
  // Window binding
  // ---------------------------------------------------------------------------

  /**
   * Bind a BrowserWindow to this controller.
   * Call this once the window has been created.
   *
   * @param {Electron.BrowserWindow} win
   */
  setWindow(win) {
    this.win = win;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Toggle between interactive and clickthrough modes.
   */
  toggle() {
    if (this.interactive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * Make the overlay interactive (captures mouse/keyboard).
   */
  activate() {
    if (!this.win || this.win.isDestroyed()) return;

    this.interactive = true;
    this.win.setIgnoreMouseEvents(false);
    this.win.setAlwaysOnTop(true, 'screen-saver');

    if (!this.platform.isLinux) {
      this.win.focus();
    }

    this._sendOpacity();
  }

  /**
   * Make the overlay clickthrough (input passes to the game).
   */
  deactivate() {
    if (!this.win || this.win.isDestroyed()) return;

    this.interactive = false;

    if (this.platform.isLinux) {
      this.win.setIgnoreMouseEvents(true);
    } else {
      this.win.setIgnoreMouseEvents(true, { forward: true });
    }

    // Keep the overlay above the game but don't steal focus.
    this.win.setAlwaysOnTop(true, 'screen-saver');

    this._sendOpacity();
  }

  // ---------------------------------------------------------------------------
  // Opacity helpers
  // ---------------------------------------------------------------------------

  /**
   * Update the base opacity at runtime (e.g. from user settings).
   *
   * @param {number} value  New base opacity (0-1).
   */
  setBaseOpacity(value) {
    this.baseOpacity = value;
    this._sendOpacity();
  }

  /**
   * Calculate the effective opacity for the current state.
   *
   * In clickthrough mode the opacity is reduced to 70 % of base so the user
   * gets a visual cue that the overlay is in passthrough mode.
   *
   * @returns {number}
   */
  getEffectiveOpacity() {
    return this.interactive ? this.baseOpacity : this.baseOpacity * 0.7;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Send the current effective opacity to the renderer via IPC.
   * @private
   */
  _sendOpacity() {
    if (!this.win || this.win.isDestroyed()) return;
    this.win.webContents.send('overlay-opacity', this.getEffectiveOpacity());
  }
}

module.exports = OverlayController;
