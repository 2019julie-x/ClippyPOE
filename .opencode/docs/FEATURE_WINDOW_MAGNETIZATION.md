# Window Magnetization Feature Design

## Overview

Implement edge detection and window magnetization (snap-to-edge) functionality to improve UX by automatically aligning the overlay window to screen edges when dragged nearby.

## Feature Scope

### 1. Edge Detection
- Detect proximity to screen edges (top, bottom, left, right)
- Detect proximity to screen corners
- Support multi-monitor setups
- Configurable snap threshold distance

### 2. Window Magnetization
- Automatically snap window to edges when within threshold
- Smooth snapping behavior (not jarring)
- Visual feedback during snap operation
- Preserve manual positioning when far from edges

### 3. Configuration Options
- Enable/disable magnetization
- Adjustable snap distance (default: 20px)
- Per-edge enable/disable (future enhancement)

## Technical Design

### Architecture

```
┌─────────────────────────────────────────┐
│           Main Process                  │
│  ┌───────────────────────────────────┐  │
│  │    WindowMagnetizer Class         │  │
│  │  - Edge detection logic           │  │
│  │  - Snap calculations              │  │
│  │  - Multi-monitor support          │  │
│  └───────────────────────────────────┘  │
│                  ↓                       │
│  ┌───────────────────────────────────┐  │
│  │    SettingsManager                │  │
│  │  - magnetization.enabled          │  │
│  │  - magnetization.snapDistance     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Implementation Components

**1. WindowMagnetizer Class** (`src/main/windowMagnetizer.js`)
- `checkEdgeProximity(windowBounds, display)` - Detect if near edges
- `calculateSnapPosition(windowBounds, display, config)` - Calculate snap target
- `shouldSnap(distance, threshold)` - Determine if snapping should occur
- `getDisplayForWindow(window)` - Handle multi-monitor

**2. Settings Extensions**
- Add `magnetization` object to default settings
- Properties:
  - `enabled` (boolean, default: true)
  - `snapDistance` (number, default: 20)

**3. Integration Points**
- Hook into existing `mainWindow.on('move')` handler
- Apply snap logic before saving position
- Respect user's drag intent (don't fight manual positioning)

## User Experience

### Behavior
1. User drags window near screen edge
2. When within snap distance (20px default):
   - Window smoothly aligns to edge
   - Position is "magnetic" until dragged away
3. User can override by dragging away from edge
4. Corners snap to both axes simultaneously

### Visual Feedback
- Existing window opacity/styling (no additional UI needed)
- Snapping feels natural and helpful, not intrusive

## Configuration UI

Add to Settings window:

```
┌──────────────────────────────────┐
│ Window Behavior                  │
├──────────────────────────────────┤
│ ☑ Enable window edge snapping    │
│                                  │
│ Snap Distance: [20] px          │
│ (How close to trigger snapping)  │
└──────────────────────────────────┘
```

## Edge Cases & Considerations

### Multi-Monitor
- Each display has its own edges
- Window can snap to display edges, not just primary monitor
- Handle display boundaries correctly

### Window Size Changes
- Snap logic respects current window size
- Resizing doesn't trigger re-snapping
- Snapping only occurs during move operations

### Platform Differences
- Electron's screen API is cross-platform
- No platform-specific code needed
- Works on Windows, Linux (X11/Wayland), macOS

### Performance
- Snap calculations are lightweight (<1ms)
- Only calculated during window move events
- Debounced save prevents excessive I/O

## Testing Strategy

### Unit Tests
1. Edge detection logic
   - Near top edge (0-20px)
   - Near bottom edge
   - Near left/right edges
   - Corner detection
   - Outside snap threshold

2. Snap position calculation
   - Snap to top
   - Snap to bottom
   - Snap to left/right
   - Corner snapping (dual-axis)

3. Multi-monitor scenarios
   - Primary display
   - Secondary display
   - Display with offset coordinates

### Integration Tests
1. Settings persistence
2. Enable/disable toggle
3. Snap distance configuration
4. Window position saving after snap

### Manual Testing
1. Drag window to each edge
2. Drag to each corner
3. Drag away from snap zone
4. Test with different snap distances
5. Test on multiple monitors
6. Test disable functionality

## Implementation Phases

### Phase 1: Core Implementation ✓
- Create WindowMagnetizer class
- Implement edge detection
- Implement snap calculations
- Add settings schema

### Phase 2: Integration ✓
- Hook into window move handler
- Add settings UI controls
- Integrate with SettingsManager

### Phase 3: Testing ✓
- Write unit tests
- Write integration tests
- Manual testing across platforms

### Phase 4: Documentation & Polish ✓
- Update user documentation
- Update architecture docs
- Code review and refinement

## Success Criteria

- ✅ Window snaps smoothly to screen edges within configured distance
- ✅ Snapping can be disabled via settings
- ✅ Snap distance is configurable (10-50px range)
- ✅ Works correctly on multi-monitor setups
- ✅ No performance degradation during window moves
- ✅ User can override snap by dragging away
- ✅ 90%+ test coverage for magnetization logic
- ✅ Cross-platform compatibility verified

## Future Enhancements

1. **Advanced Snapping**
   - Snap to other windows
   - Snap to custom grid positions
   - Magnetic alignment between multiple app windows

2. **Smart Positioning**
   - Remember preferred edge per monitor
   - Auto-position based on game window location
   - Keep-in-bounds enforcement

3. **Per-Edge Configuration**
   - Enable/disable snapping per edge
   - Different snap distances per edge
   - Corner-only snapping mode

4. **Visual Feedback**
   - Subtle glow effect when near snap zone
   - Alignment guides
   - Snap preview overlay

## References

- Electron BrowserWindow API: https://www.electronjs.org/docs/latest/api/browser-window
- Electron Screen API: https://www.electronjs.org/docs/latest/api/screen
- Similar implementations:
  - Windows Snap Assist
  - macOS window snapping (in window management apps)
  - GNOME Shell magnetic edges

---

**Status**: Design Complete - Ready for Implementation
**Estimated Effort**: 4-6 hours
**Priority**: High (UX improvement)
**Risk**: Low (well-isolated feature)
