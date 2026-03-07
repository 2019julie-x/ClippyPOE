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
    /** @type {boolean} */
    this.collapsed = false;
    /** @type {number|null} Height to restore when expanding */
    this._expandedHeight = null;
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
   * In clickthrough mode the overlay dims to 35% of base so it doesn't
   * obscure the game UI (stash tabs, inventory, etc.).
   * @returns {number}
   */
  getEffectiveOpacity() {
    return this.interactive ? this.baseOpacity : this.baseOpacity * 0.35;
  }

  /** Toggle between collapsed (header-only) and expanded. */
  toggleCollapse() {
    if (this.collapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /** Collapse the overlay to header-only height. */
  collapse() {
    if (!this.win || this.win.isDestroyed() || this.collapsed) return;

    const [, height] = this.win.getSize();
    this._expandedHeight = height;
    this.collapsed = true;

    // Resize window to collapsed height — header(~30px) + border(2px)
    const [width] = this.win.getSize();
    this.win.setSize(width, 36);

    // Explicitly set the interactable shape to fix click-through bugs on some platforms
    if (this.platform.isWindows || this.platform.isLinux) {
      this.win.setShape([{ x: 0, y: 0, width: width, height: 36 }]);
    }

    this.win.webContents.send('overlay-collapsed', true);
  }

  /** Expand the overlay back to its previous height. */
  expand() {
    if (!this.win || this.win.isDestroyed() || !this.collapsed) return;

    this.collapsed = false;

    const [width] = this.win.getSize();
    const restoreHeight = this._expandedHeight || 600;
    this.win.setSize(width, restoreHeight);

    // Clear the custom shape so the whole window is interactable again
    if (this.platform.isWindows || this.platform.isLinux) {
      this.win.setShape([]);
    }

    this.win.webContents.send('overlay-collapsed', false);
  }

  /** Push the current opacity to the renderer. */
  _sendOpacity() {
    if (!this.win || this.win.isDestroyed()) return;
    this.win.webContents.send('overlay-opacity', this.getEffectiveOpacity());
  }
}

module.exports = OverlayController;
