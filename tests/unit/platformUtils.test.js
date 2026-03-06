const os = require('os');
// We need to re-require the module after manipulating process.platform,
// so we'll use jest.resetModules() where necessary.
// Helpers – temporarily override process.platform
function withPlatform(platform, envOverrides, fn) {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  const originalEnv = { ...process.env };
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  Object.assign(process.env, envOverrides);
  try {
    jest.resetModules();
    const platformUtils = require('../../src/main/platformUtils');
    fn(platformUtils);
  } finally {
    Object.defineProperty(process, 'platform', originalPlatform);
    // Restore environment
    Object.keys(envOverrides).forEach((k) => {
      if (originalEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = originalEnv[k];
      }
    });
    jest.resetModules();
  }
}
// getPlatformInfo()
describe('getPlatformInfo()', () => {
  test('Windows: isWindows=true, isLinux=false, isMac=false', () => {
    withPlatform('win32', {}, ({ getPlatformInfo }) => {
      const info = getPlatformInfo();
      expect(info.isWindows).toBe(true);
      expect(info.isLinux).toBe(false);
      expect(info.isMac).toBe(false);
      expect(info.isWayland).toBe(false);
      expect(info.isX11).toBe(false);
      expect(info.compositor).toBeNull();
    });
  });
  test('macOS: isMac=true, isWindows=false, isLinux=false', () => {
    withPlatform('darwin', {}, ({ getPlatformInfo }) => {
      const info = getPlatformInfo();
      expect(info.isMac).toBe(true);
      expect(info.isWindows).toBe(false);
      expect(info.isLinux).toBe(false);
    });
  });
  test('Linux X11: isLinux=true, isX11=true, isWayland=false', () => {
    withPlatform('linux', {
      WAYLAND_DISPLAY: '',
      XDG_SESSION_TYPE: 'x11',
      XDG_CURRENT_DESKTOP: 'GNOME',
    }, ({ getPlatformInfo }) => {
      const info = getPlatformInfo();
      expect(info.isLinux).toBe(true);
      expect(info.isX11).toBe(true);
      expect(info.isWayland).toBe(false);
      expect(info.compositor).toBe('GNOME');
    });
  });
  test('Linux Wayland (via WAYLAND_DISPLAY): isWayland=true, isX11=false', () => {
    withPlatform('linux', {
      WAYLAND_DISPLAY: 'wayland-0',
      XDG_SESSION_TYPE: '',
      XDG_CURRENT_DESKTOP: 'Hyprland',
    }, ({ getPlatformInfo }) => {
      const info = getPlatformInfo();
      expect(info.isWayland).toBe(true);
      expect(info.isX11).toBe(false);
      expect(info.compositor).toBe('Hyprland');
    });
  });
  test('Linux Wayland (via XDG_SESSION_TYPE): isWayland=true when WAYLAND_DISPLAY missing', () => {
    withPlatform('linux', {
      WAYLAND_DISPLAY: '',
      XDG_SESSION_TYPE: 'wayland',
      XDG_CURRENT_DESKTOP: 'sway',
    }, ({ getPlatformInfo }) => {
      const info = getPlatformInfo();
      expect(info.isWayland).toBe(true);
      expect(info.isX11).toBe(false);
    });
  });
  test('Linux with no session type env vars: defaults to X11', () => {
    withPlatform('linux', {
      WAYLAND_DISPLAY: '',
      XDG_SESSION_TYPE: '',
      XDG_CURRENT_DESKTOP: '',
    }, ({ getPlatformInfo }) => {
      const info = getPlatformInfo();
      expect(info.isWayland).toBe(false);
      expect(info.isX11).toBe(true);
    });
  });
  test('platform string matches process.platform', () => {
    withPlatform('win32', {}, ({ getPlatformInfo }) => {
      expect(getPlatformInfo().platform).toBe('win32');
    });
  });
});
// getDefaultClientTxtPaths()
describe('getDefaultClientTxtPaths()', () => {
  test('Windows: returns paths starting with C:\\\\', () => {
    withPlatform('win32', {}, ({ getDefaultClientTxtPaths, getPlatformInfo }) => {
      const paths = getDefaultClientTxtPaths(getPlatformInfo());
      expect(paths.length).toBeGreaterThan(0);
      paths.forEach((p) => {
        expect(p.toLowerCase()).toContain('path of exile');
        expect(p.toLowerCase()).toContain('client.txt');
      });
    });
  });
  test('Linux: returns paths under home directory', () => {
    withPlatform('linux', {
      WAYLAND_DISPLAY: '',
      XDG_SESSION_TYPE: 'x11',
      XDG_CURRENT_DESKTOP: '',
    }, ({ getDefaultClientTxtPaths, getPlatformInfo }) => {
      const home = os.homedir();
      const paths = getDefaultClientTxtPaths(getPlatformInfo());
      expect(paths.length).toBeGreaterThan(0);
      paths.forEach((p) => {
        expect(p).toContain(home);
        expect(p.toLowerCase()).toContain('client.txt');
      });
    });
  });
  test('macOS: returns paths under home/Library', () => {
    withPlatform('darwin', {}, ({ getDefaultClientTxtPaths, getPlatformInfo }) => {
      const paths = getDefaultClientTxtPaths(getPlatformInfo());
      expect(paths.length).toBeGreaterThan(0);
      paths.forEach((p) => {
        expect(p.toLowerCase()).toContain('client.txt');
      });
    });
  });
  test('all returned paths end with Client.txt', () => {
    ['win32', 'linux', 'darwin'].forEach((plat) => {
      withPlatform(plat, {
        WAYLAND_DISPLAY: '',
        XDG_SESSION_TYPE: plat === 'linux' ? 'x11' : '',
        XDG_CURRENT_DESKTOP: '',
      }, ({ getDefaultClientTxtPaths, getPlatformInfo }) => {
        const paths = getDefaultClientTxtPaths(getPlatformInfo());
        paths.forEach((p) => {
          expect(p).toMatch(/Client\.txt$/);
        });
      });
    });
  });
});
// getOverlayWindowOptions()
describe('getOverlayWindowOptions()', () => {
  test('always includes frame: false', () => {
    withPlatform('win32', {}, ({ getOverlayWindowOptions, getPlatformInfo }) => {
      const opts = getOverlayWindowOptions(getPlatformInfo());
      expect(opts.frame).toBe(false);
    });
  });
  test('always includes transparent: true', () => {
    withPlatform('win32', {}, ({ getOverlayWindowOptions, getPlatformInfo }) => {
      const opts = getOverlayWindowOptions(getPlatformInfo());
      expect(opts.transparent).toBe(true);
    });
  });
  test('always includes skipTaskbar: true', () => {
    withPlatform('darwin', {}, ({ getOverlayWindowOptions, getPlatformInfo }) => {
      const opts = getOverlayWindowOptions(getPlatformInfo());
      expect(opts.skipTaskbar).toBe(true);
    });
  });
  test('show is false to prevent transparent flash on startup', () => {
    withPlatform('win32', {}, ({ getOverlayWindowOptions, getPlatformInfo }) => {
      const opts = getOverlayWindowOptions(getPlatformInfo());
      expect(opts.show).toBe(false);
    });
  });
  test('Linux adds type: toolbar for compositor hints', () => {
    withPlatform('linux', {
      WAYLAND_DISPLAY: '',
      XDG_SESSION_TYPE: 'x11',
      XDG_CURRENT_DESKTOP: '',
    }, ({ getOverlayWindowOptions, getPlatformInfo }) => {
      const opts = getOverlayWindowOptions(getPlatformInfo());
      expect(opts.type).toBe('toolbar');
    });
  });
  test('Windows does NOT set type property', () => {
    withPlatform('win32', {}, ({ getOverlayWindowOptions, getPlatformInfo }) => {
      const opts = getOverlayWindowOptions(getPlatformInfo());
      expect(opts.type).toBeUndefined();
    });
  });
  test('backgroundColor is fully transparent', () => {
    withPlatform('win32', {}, ({ getOverlayWindowOptions, getPlatformInfo }) => {
      const opts = getOverlayWindowOptions(getPlatformInfo());
      expect(opts.backgroundColor).toBe('#00000000');
    });
  });
});
// applyOverlayBehavior()
describe('applyOverlayBehavior()', () => {
  function makeMockWin() {
    return {
      setAlwaysOnTop: jest.fn(),
      setVisibleOnAllWorkspaces: jest.fn(),
      setIgnoreMouseEvents: jest.fn(),
    };
  }
  test('Windows: setAlwaysOnTop with z-order boost', () => {
    withPlatform('win32', {}, ({ applyOverlayBehavior, getPlatformInfo }) => {
      const win = makeMockWin();
      applyOverlayBehavior(win, getPlatformInfo());
      expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver', 1);
    });
  });
  test('macOS: setAlwaysOnTop without z-order boost', () => {
    withPlatform('darwin', {}, ({ applyOverlayBehavior, getPlatformInfo }) => {
      const win = makeMockWin();
      applyOverlayBehavior(win, getPlatformInfo());
      expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    });
  });
  test('Linux: setVisibleOnAllWorkspaces called', () => {
    withPlatform('linux', {
      WAYLAND_DISPLAY: '',
      XDG_SESSION_TYPE: 'x11',
      XDG_CURRENT_DESKTOP: '',
    }, ({ applyOverlayBehavior, getPlatformInfo }) => {
      const win = makeMockWin();
      applyOverlayBehavior(win, getPlatformInfo());
      expect(win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, { visibleOnFullScreen: true });
    });
  });
  test('macOS: setVisibleOnAllWorkspaces called', () => {
    withPlatform('darwin', {}, ({ applyOverlayBehavior, getPlatformInfo }) => {
      const win = makeMockWin();
      applyOverlayBehavior(win, getPlatformInfo());
      expect(win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, { visibleOnFullScreen: true });
    });
  });
  test('Windows: initial click-through with forward:true', () => {
    withPlatform('win32', {}, ({ applyOverlayBehavior, getPlatformInfo }) => {
      const win = makeMockWin();
      applyOverlayBehavior(win, getPlatformInfo());
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
    });
  });
  test('Linux: setIgnoreMouseEvents NOT called (no forward support)', () => {
    withPlatform('linux', {
      WAYLAND_DISPLAY: '',
      XDG_SESSION_TYPE: 'x11',
      XDG_CURRENT_DESKTOP: '',
    }, ({ applyOverlayBehavior, getPlatformInfo }) => {
      const win = makeMockWin();
      applyOverlayBehavior(win, getPlatformInfo());
      expect(win.setIgnoreMouseEvents).not.toHaveBeenCalled();
    });
  });
});