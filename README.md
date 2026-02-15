# Touchpad Testing Dashboard

A web-based dashboard for testing and debugging touchpad/trackpad implementations. Useful for visualizing scroll, zoom, click, and gesture events in real-time.

## Features

### Debug Dashboard
- **Scroll Values**: Real-time display of X/Y scroll deltas and cumulative totals
- **Zoom Visualization**: Two dots that move apart/together based on zoom level
- **Touchpad Visualization**: Visual representation of left/right button presses
- **Event Data Panel**: Displays pointer type, position, pressure, tilt, and touch count
- **Event Log**: Color-coded log of all touchpad events with timestamps

### Browse Mode
A mock Wikipedia article page for testing trackpad interactions in a realistic browsing scenario.

- **Sticky Debug Bar**: Shows current state (idle, move, click, scroll, zoom), scroll values, zoom level, and gesture info
- **Article Zoom**: Pinch-to-zoom (Ctrl+Scroll) zooms the article content centered on cursor position
- **Floating Event Log**: Toggle-able event log overlay
- **Multi-finger Gesture Detection**: Tracks pinch, swipe, and multi-finger scroll gestures

### Maps Mode
A mock maps application for testing pan, zoom, and click interactions.

- **Pan/Drag**: Click and drag to move around the map
- **Zoom**: Pinch-to-zoom centered on cursor position (25% - 500%)
- **Pin Placement**: Click to place a pin, or use right-click menu
- **Right-Click Context Menu**: Search, directions, share, add to favorites, coordinates display
- **Floating Event Log**: Track all map interactions

## Usage

1. Open `index.html` in a web browser
2. Use the tabs at the top to switch between views:
   - **Debug Dashboard**: Full technical debugging view
   - **Browse Mode**: Realistic article browsing with debug overlay
   - **Maps Mode**: Map interaction testing

## Controls

| Action | Gesture |
|--------|---------|
| Scroll | Two-finger swipe / Mouse wheel |
| Zoom | Ctrl + Scroll / Pinch gesture |
| Left Click | Single tap / Left mouse button |
| Right Click | Two-finger tap / Right mouse button |
| Pan (Maps) | Click and drag |

## Files

- `index.html` - Main HTML structure
- `styles.css` - All styling
- `script.js` - Event handling and interactivity

## Browser Compatibility

Works best in modern browsers (Chrome, Firefox, Edge, Safari) with trackpad or touchscreen support.
