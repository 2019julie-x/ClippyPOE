// @ts-check
'use strict';

/**
 * OverlayController - Toggles the overlay between interactive clicking and
 * click-through mode so input can pass to the game underneath.
 */
class OverlayController {
  /**
   * @param {{ platform: string, isWindows: boolean, isLinux: boolean, isMac: boolean, isWayland: boolean, isX11: boolean, compositor: string | null }} platformInfo
   * @param {number} [baseOpacity=0.95] - Initial base opacity (0–1)
   */
  constructor(platformInfo, baseOpacity = 0.95) {
    /** @type {Readonly<{ platform: string, isWindows: boolean, isLinux: boolean, isMac: boolean, isWayland: boolean, isX11: boolean, compositor: string | null }>} */
    this.platform = Object.freeze({ ...platformInfo });
    /** @type {number} */
    this.baseOpacity = baseOpacity;
    /** @type {Electron.BrowserWindow | null} */
    this.win = null;
    /** @type {boolean} */
    this.interactive = false; // start in clickthrough until the window activates
  }

  /**
   * Bind the BrowserWindow after creation.
   * @param {Electron.BrowserWindow} win
   */
  setWindow(win) {
    this.win = win;
  }

  /** Toggle between interactive and clickthrough. */
  toggle() {
    if (this.interactive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /** Interactive mode – overlay captures mouse/keyboard. */
  activate() {
    if (!this.win || this.win.isDestroyed()) return;

    this.interactive = true;
    this.win.setIgnoreMouseEvents(false);
    this.win.setAlwaysOnTop(true, 'screen-saver');

    // Avoid stealing focus on Linux – setAlwaysOnTop is enough there
    if (!this.platform.isLinux) {
      this.win.focus();
    }

    this._sendOpacity();
  }

  /** Clickthrough mode – input falls through to the game. */
  deactivate() {
    if (!this.win || this.win.isDestroyed()) return;

    this.interactive = false;

    // Forwarding hover events on Windows and Mac so hover still works
    if (this.platform.isLinux) {
      this.win.setIgnoreMouseEvents(true);
    } else {
      this.win.setIgnoreMouseEvents(true, { forward: true });
    }

    this.win.setAlwaysOnTop(true, 'screen-saver'); // stay above the game without stealing focus
    this._sendOpacity();
  }

  /**
   * Update base opacity at runtime (called when the user changes the opacity slider).
   * @param {number} value - New opacity (0–1)
   */
  setBaseOpacity(value) {
    this.baseOpacity = value;
    this._sendOpacity();
  }

  /**
   * In clickthrough mode the overlay dims to 70% of base so it's visually obvious.
   * @returns {number}
   */
  getEffectiveOpacity() {
    return this.interactive ? this.baseOpacity : this.baseOpacity * 0.7;
  }

  /** Push the current opacity to the renderer. */
  _sendOpacity() {
    if (!this.win || this.win.isDestroyed()) return;
    this.win.webContents.send('overlay-opacity', this.getEffectiveOpacity());
  }
}

module.exports = OverlayController;
