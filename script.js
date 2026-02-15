// DOM Elements
const deltaX = document.getElementById('delta-x');
const deltaY = document.getElementById('delta-y');
const totalX = document.getElementById('total-x');
const totalY = document.getElementById('total-y');
const resetScrollBtn = document.getElementById('reset-scroll');

const leftButton = document.getElementById('left-button');
const rightButton = document.getElementById('right-button');

const eventType = document.getElementById('event-type');
const eventButton = document.getElementById('event-button');
const eventButtons = document.getElementById('event-buttons');
const pointerType = document.getElementById('pointer-type');
const eventPosition = document.getElementById('event-position');
const eventMovement = document.getElementById('event-movement');
const eventPressure = document.getElementById('event-pressure');
const eventTilt = document.getElementById('event-tilt');
const touchCount = document.getElementById('touch-count');
const isPrimary = document.getElementById('is-primary');
const eventLogContent = document.getElementById('event-log-content');
const browseEventLogContent = document.getElementById('browse-event-log-content');
const clearLogBtn = document.getElementById('clear-log');
const clearBrowseLogBtn = document.getElementById('clear-browse-log');

const zoomLevel = document.getElementById('zoom-level');
const dotLeft = document.getElementById('dot-left');
const dotRight = document.getElementById('dot-right');
const resetZoomBtn = document.getElementById('reset-zoom');

// Browse mode elements
const currentStateEl = document.getElementById('current-state');
const barScrollEl = document.getElementById('bar-scroll');
const barZoomEl = document.getElementById('bar-zoom');
const barClickEl = document.getElementById('bar-click');
const barGestureEl = document.getElementById('bar-gesture');
const barFingersEl = document.getElementById('bar-fingers');
const barPinchEl = document.getElementById('bar-pinch');
const barSwipeEl = document.getElementById('bar-swipe');
const wikiArticle = document.querySelector('.wiki-article');
const browseView = document.getElementById('browse-view');
const resetArticleZoomBtn = document.getElementById('reset-article-zoom');
const toggleEventLogBtn = document.getElementById('toggle-event-log');
const floatingEventLog = document.querySelector('.floating-event-log');

// Tab elements
const tabBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view');

// State
let scrollTotalX = 0;
let scrollTotalY = 0;
let currentZoom = 1.0;
let articleZoom = 1.0; // Separate zoom for the article content
let articleTranslateX = 0; // Translation to keep zoom centered on cursor
let articleTranslateY = 0;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const ZOOM_SENSITIVITY = 0.01;
const ARTICLE_MIN_ZOOM = 0.25;
const ARTICLE_MAX_ZOOM = 5.0;

// Scroll/Zoom event detection state
let isScrolling = false;
let isZooming = false;
let scrollTimeout = null;
let zoomTimeout = null;
const EVENT_END_DELAY = 150; // ms to wait before considering event ended

// Direction tracking
let lastScrollDirX = 0; // -1 = left, 0 = none, 1 = right
let lastScrollDirY = 0; // -1 = up, 0 = none, 1 = down
let lastZoomDir = 0;    // -1 = out, 0 = none, 1 = in

// Scroll handling
document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();

        // Apply zoom to article content when in browse mode
        if (isBrowseModeActive()) {
            const oldZoom = articleZoom;
            const delta = -e.deltaY * ZOOM_SENSITIVITY;
            const newZoom = Math.max(ARTICLE_MIN_ZOOM, Math.min(ARTICLE_MAX_ZOOM, articleZoom + delta));
            articleZoom = newZoom;
            updateArticleZoom(e, oldZoom, newZoom);
        }

        handleZoom(e);
        return;
    }

    const currentDirX = e.deltaX > 0 ? 1 : (e.deltaX < 0 ? -1 : 0);
    const currentDirY = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);

    // Detect scroll start
    if (!isScrolling) {
        isScrolling = true;
        lastScrollDirX = currentDirX;
        lastScrollDirY = currentDirY;
        addLogEntry(`scroll start (X: ${Math.round(scrollTotalX)}, Y: ${Math.round(scrollTotalY)})`, 'scroll');
    }

    // Detect direction change
    if (currentDirX !== 0 && lastScrollDirX !== 0 && currentDirX !== lastScrollDirX) {
        const dirName = currentDirX > 0 ? 'right' : 'left';
        addLogEntry(`scroll X → ${dirName}`, 'scroll-x');
    }
    if (currentDirY !== 0 && lastScrollDirY !== 0 && currentDirY !== lastScrollDirY) {
        const dirName = currentDirY > 0 ? 'down' : 'up';
        addLogEntry(`scroll Y → ${dirName}`, 'scroll-y');
    }

    // Update last direction (only if non-zero)
    if (currentDirX !== 0) lastScrollDirX = currentDirX;
    if (currentDirY !== 0) lastScrollDirY = currentDirY;

    // Clear existing timeout and set new one for scroll end detection
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
    }
    scrollTimeout = setTimeout(() => {
        isScrolling = false;
        lastScrollDirX = 0;
        lastScrollDirY = 0;
    }, EVENT_END_DELAY);

    deltaX.textContent = Math.round(e.deltaX);
    deltaY.textContent = Math.round(e.deltaY);

    scrollTotalX += e.deltaX;
    scrollTotalY += e.deltaY;

    totalX.textContent = Math.round(scrollTotalX);
    totalY.textContent = Math.round(scrollTotalY);
}, { passive: false });

resetScrollBtn.addEventListener('click', () => {
    scrollTotalX = 0;
    scrollTotalY = 0;
    deltaX.textContent = '0';
    deltaY.textContent = '0';
    totalX.textContent = '0';
    totalY.textContent = '0';
});

// Mouse button handling
document.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        leftButton.classList.add('active');
    } else if (e.button === 2) {
        rightButton.classList.add('active');
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        leftButton.classList.remove('active');
    } else if (e.button === 2) {
        rightButton.classList.remove('active');
    }
});

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Zoom handling
function handleZoom(e) {
    const currentZoomDir = e.deltaY < 0 ? 1 : (e.deltaY > 0 ? -1 : 0); // negative deltaY = zoom in

    // Detect zoom start
    if (!isZooming) {
        isZooming = true;
        lastZoomDir = currentZoomDir;
        addLogEntry(`zoom start (${Math.round(currentZoom * 100)}%)`, 'zoom');
    }

    // Detect direction change
    if (currentZoomDir !== 0 && lastZoomDir !== 0 && currentZoomDir !== lastZoomDir) {
        const dirName = currentZoomDir > 0 ? 'in' : 'out';
        addLogEntry(`zoom direction → ${dirName}`, 'zoom');
    }

    // Update last direction (only if non-zero)
    if (currentZoomDir !== 0) lastZoomDir = currentZoomDir;

    // Clear existing timeout and set new one for zoom end detection
    if (zoomTimeout) {
        clearTimeout(zoomTimeout);
    }
    zoomTimeout = setTimeout(() => {
        isZooming = false;
        lastZoomDir = 0;
    }, EVENT_END_DELAY);

    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));
    updateZoomVisualization();
}

function updateZoomVisualization() {
    zoomLevel.textContent = Math.round(currentZoom * 100) + '%';

    const baseDistance = 50;
    const distance = baseDistance * currentZoom;

    const containerWidth = document.querySelector('.zoom-visualization').offsetWidth;
    const center = containerWidth / 2;
    const dotWidth = 24;

    dotLeft.style.left = (center - distance - dotWidth / 2) + 'px';
    dotRight.style.left = (center + distance - dotWidth / 2) + 'px';
}

// Update article zoom in browse mode
function updateArticleZoom(e, oldZoom, newZoom) {
    if (wikiArticle && e) {
        const rect = wikiArticle.getBoundingClientRect();

        // Get cursor position relative to the article's current visual position
        const cursorX = e.clientX;
        const cursorY = e.clientY;

        // Calculate the point in the article's untransformed coordinate system
        // that is currently under the cursor
        const pointX = (cursorX - rect.left) / oldZoom;
        const pointY = (cursorY - rect.top) / oldZoom;

        // When we change the zoom, the point under the cursor would move.
        // Calculate how much it would move and compensate with translation.
        // The point's screen position after zoom = pointX * newZoom + translateX
        // We want this to equal cursorX - rect.left (before accounting for translation change)
        // So: translateX_new = cursorX - rect.left - pointX * newZoom
        // But we need to account for the current translation in rect.left

        // Simpler approach: calculate the shift caused by zoom change and compensate
        const zoomRatio = newZoom / oldZoom;

        // The point under cursor moves by (zoomRatio - 1) * its position relative to origin
        // We need to translate to counteract this
        articleTranslateX = articleTranslateX * zoomRatio - pointX * (newZoom - oldZoom);
        articleTranslateY = articleTranslateY * zoomRatio - pointY * (newZoom - oldZoom);

        // Apply the transform
        wikiArticle.style.transformOrigin = '0 0';
        wikiArticle.style.transform = `translate(${articleTranslateX}px, ${articleTranslateY}px) scale(${newZoom})`;
        barZoomEl.textContent = `${Math.round(newZoom * 100)}%`;
    }
}

// Check if browse mode is active
function isBrowseModeActive() {
    return browseView && browseView.classList.contains('active');
}

resetZoomBtn.addEventListener('click', () => {
    currentZoom = 1.0;
    updateZoomVisualization();
});

// Initialize zoom visualization on load
window.addEventListener('load', () => {
    updateZoomVisualization();
});

// Handle window resize for zoom visualization
window.addEventListener('resize', () => {
    updateZoomVisualization();
});

// Event data display helpers
function getButtonName(button) {
    const names = {
        0: 'Left (0)',
        1: 'Middle (1)',
        2: 'Right (2)',
        3: 'Back (3)',
        4: 'Forward (4)'
    };
    return names[button] !== undefined ? names[button] : `Unknown (${button})`;
}

function getButtonsMask(buttons) {
    const active = [];
    if (buttons & 1) active.push('Left');
    if (buttons & 2) active.push('Right');
    if (buttons & 4) active.push('Middle');
    if (buttons & 8) active.push('Back');
    if (buttons & 16) active.push('Forward');
    return active.length > 0 ? `${buttons} (${active.join(', ')})` : `${buttons} (None)`;
}

function formatTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });
}

function addLogEntry(eventName, category) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${category}`;
    entry.innerHTML = `<span class="timestamp">${formatTimestamp()}</span><span class="event-name">${eventName}</span>`;
    eventLogContent.insertBefore(entry, eventLogContent.firstChild);

    // Also add to browse mode log
    if (browseEventLogContent) {
        const browseEntry = entry.cloneNode(true);
        browseEventLogContent.insertBefore(browseEntry, browseEventLogContent.firstChild);

        while (browseEventLogContent.children.length > 50) {
            browseEventLogContent.removeChild(browseEventLogContent.lastChild);
        }
    }

    while (eventLogContent.children.length > 50) {
        eventLogContent.removeChild(eventLogContent.lastChild);
    }
}

function updateEventDisplay(e, type) {
    eventType.textContent = e.type;

    if ('button' in e) {
        eventButton.textContent = getButtonName(e.button);
    }

    if ('buttons' in e) {
        eventButtons.textContent = getButtonsMask(e.buttons);
    }

    if ('pointerType' in e) {
        pointerType.textContent = e.pointerType || 'N/A';
    } else {
        pointerType.textContent = type === 'touch' ? 'touch' : 'mouse';
    }

    if ('clientX' in e && 'clientY' in e) {
        eventPosition.textContent = `${Math.round(e.clientX)}, ${Math.round(e.clientY)}`;
    }

    if ('movementX' in e && 'movementY' in e) {
        eventMovement.textContent = `${Math.round(e.movementX)}, ${Math.round(e.movementY)}`;
    }

    if ('pressure' in e) {
        eventPressure.textContent = e.pressure.toFixed(3);
    } else {
        eventPressure.textContent = 'N/A';
    }

    if ('tiltX' in e && 'tiltY' in e) {
        eventTilt.textContent = `${e.tiltX}, ${e.tiltY}`;
    } else {
        eventTilt.textContent = 'N/A';
    }

    if ('isPrimary' in e) {
        isPrimary.textContent = e.isPrimary ? 'Yes' : 'No';
    } else {
        isPrimary.textContent = 'N/A';
    }
}

// Pointer events (captures mouse, touch, and pen)
document.addEventListener('pointerdown', (e) => {
    updateEventDisplay(e, 'pointer');
    addLogEntry(`pointerdown (${e.pointerType})`, 'pointer');
});

document.addEventListener('pointerup', (e) => {
    updateEventDisplay(e, 'pointer');
    addLogEntry(`pointerup (${e.pointerType})`, 'pointer');
});

document.addEventListener('pointermove', (e) => {
    updateEventDisplay(e, 'pointer');
});

document.addEventListener('pointercancel', (e) => {
    updateEventDisplay(e, 'pointer');
    addLogEntry(`pointercancel (${e.pointerType})`, 'pointer');
});

// Touch events
let currentTouchCount = 0;

document.addEventListener('touchstart', (e) => {
    currentTouchCount = e.touches.length;
    touchCount.textContent = currentTouchCount;

    if (e.touches.length > 0) {
        const touch = e.touches[0];
        eventPosition.textContent = `${Math.round(touch.clientX)}, ${Math.round(touch.clientY)}`;
    }

    eventType.textContent = 'touchstart';
    pointerType.textContent = 'touch';
    addLogEntry(`touchstart (${e.touches.length} touches)`, 'touch');
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    currentTouchCount = e.touches.length;
    touchCount.textContent = currentTouchCount;

    if (e.touches.length > 0) {
        const touch = e.touches[0];
        eventPosition.textContent = `${Math.round(touch.clientX)}, ${Math.round(touch.clientY)}`;
    }

    eventType.textContent = 'touchmove';
}, { passive: true });

document.addEventListener('touchend', (e) => {
    currentTouchCount = e.touches.length;
    touchCount.textContent = currentTouchCount;
    eventType.textContent = 'touchend';
    addLogEntry(`touchend (${e.touches.length} remaining)`, 'touch');
}, { passive: true });

document.addEventListener('touchcancel', (e) => {
    currentTouchCount = e.touches.length;
    touchCount.textContent = currentTouchCount;
    eventType.textContent = 'touchcancel';
    addLogEntry('touchcancel', 'touch');
}, { passive: true });

// Mouse events (for logging)
document.addEventListener('mousedown', (e) => {
    addLogEntry(`mousedown (button ${e.button})`, 'mouse');
});

document.addEventListener('mouseup', (e) => {
    addLogEntry(`mouseup (button ${e.button})`, 'mouse');
});

// Clear log button
clearLogBtn.addEventListener('click', () => {
    eventLogContent.innerHTML = '';
});

// Clear browse log button
clearBrowseLogBtn.addEventListener('click', () => {
    browseEventLogContent.innerHTML = '';
});

// ==================== //
// Tab Navigation       //
// ==================== //

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active view
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === `${targetTab}-view`) {
                view.classList.add('active');
            }
        });
    });
});

// ==================== //
// Browse Mode State    //
// ==================== //

let currentState = 'idle';
let stateTimeout = null;
let lastClickInfo = '-';
const STATE_IDLE_DELAY = 200;

function setCurrentState(state) {
    currentState = state;
    currentStateEl.textContent = state;
    currentStateEl.className = 'state-value ' + state;

    // Clear previous timeout
    if (stateTimeout) {
        clearTimeout(stateTimeout);
    }

    // Set timeout to return to idle (except for idle state)
    if (state !== 'idle') {
        stateTimeout = setTimeout(() => {
            setCurrentState('idle');
        }, STATE_IDLE_DELAY);
    }
}

function updateBarStats() {
    barScrollEl.textContent = `${Math.round(scrollTotalX)}, ${Math.round(scrollTotalY)}`;
    // Show articleZoom when in browse mode, otherwise show currentZoom
    if (isBrowseModeActive()) {
        barZoomEl.textContent = `${Math.round(articleZoom * 100)}%`;
    } else {
        barZoomEl.textContent = `${Math.round(currentZoom * 100)}%`;
    }
    barClickEl.textContent = lastClickInfo;
}

// Hook into existing scroll handler to update browse mode state
document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        setCurrentState('zoom');
    } else {
        setCurrentState('scroll');
    }
    updateBarStats();
}, { passive: true });

// Hook into pointer move for move state
document.addEventListener('pointermove', (e) => {
    // Only set move state if not scrolling or zooming
    if (!isScrolling && !isZooming) {
        setCurrentState('move');
    }
});

// Hook into click events for click state
document.addEventListener('mousedown', (e) => {
    setCurrentState('click');
    const buttonNames = ['Left', 'Middle', 'Right', 'Back', 'Forward'];
    lastClickInfo = buttonNames[e.button] || `Button ${e.button}`;
    updateBarStats();
});

// Initialize bar stats
window.addEventListener('load', () => {
    updateBarStats();
});

// Reset article zoom button
resetArticleZoomBtn.addEventListener('click', () => {
    articleZoom = 1.0;
    articleTranslateX = 0;
    articleTranslateY = 0;
    if (wikiArticle) {
        wikiArticle.style.transformOrigin = '0 0';
        wikiArticle.style.transform = 'translate(0px, 0px) scale(1)';
    }
    barZoomEl.textContent = '100%';
});

// Toggle floating event log visibility
let eventLogVisible = true;
toggleEventLogBtn.addEventListener('click', () => {
    eventLogVisible = !eventLogVisible;
    if (eventLogVisible) {
        floatingEventLog.style.display = 'flex';
        toggleEventLogBtn.textContent = 'Hide Log';
    } else {
        floatingEventLog.style.display = 'none';
        toggleEventLogBtn.textContent = 'Show Log';
    }
});

// ==================== //
// Multi-finger Gesture //
// Detection            //
// ==================== //

// Gesture state
let touchStartPoints = [];
let lastTouchPoints = [];
let initialPinchDistance = 0;
let currentGesture = '-';
let lastPinchScale = 1;
let lastSwipeDirection = '-';
let gestureTimeout = null;
const SWIPE_THRESHOLD = 30;
const PINCH_THRESHOLD = 10;

function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getCenter(touches) {
    let x = 0, y = 0;
    for (let i = 0; i < touches.length; i++) {
        x += touches[i].clientX;
        y += touches[i].clientY;
    }
    return { x: x / touches.length, y: y / touches.length };
}

function updateGestureDisplay(gesture, fingers, pinch, swipe) {
    if (barGestureEl) barGestureEl.textContent = gesture;
    if (barFingersEl) barFingersEl.textContent = fingers;
    if (barPinchEl) barPinchEl.textContent = pinch;
    if (barSwipeEl) barSwipeEl.textContent = swipe;
}

function resetGestureAfterDelay() {
    if (gestureTimeout) clearTimeout(gestureTimeout);
    gestureTimeout = setTimeout(() => {
        currentGesture = '-';
        updateGestureDisplay('-', '0', lastPinchScale.toFixed(2) + 'x', lastSwipeDirection);
    }, 300);
}

// Touch gesture detection
document.addEventListener('touchstart', (e) => {
    touchStartPoints = Array.from(e.touches).map(t => ({
        id: t.identifier,
        x: t.clientX,
        y: t.clientY
    }));
    lastTouchPoints = [...touchStartPoints];

    const fingerCount = e.touches.length;
    barFingersEl.textContent = fingerCount;

    if (fingerCount === 2) {
        initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
        currentGesture = 'pinch/scroll';
    } else if (fingerCount >= 3) {
        currentGesture = `${fingerCount}-finger`;
    } else {
        currentGesture = 'touch';
    }

    updateGestureDisplay(currentGesture, fingerCount, lastPinchScale.toFixed(2) + 'x', lastSwipeDirection);
    setCurrentState(fingerCount >= 2 ? 'pinch' : 'move');
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    const fingerCount = e.touches.length;
    barFingersEl.textContent = fingerCount;

    if (fingerCount === 2) {
        // Detect pinch
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialPinchDistance;

        if (Math.abs(currentDistance - initialPinchDistance) > PINCH_THRESHOLD) {
            if (scale > 1.05) {
                currentGesture = 'pinch out';
                setCurrentState('pinch');
            } else if (scale < 0.95) {
                currentGesture = 'pinch in';
                setCurrentState('pinch');
            }
            lastPinchScale = scale;
        }

        // Also check for 2-finger scroll
        if (lastTouchPoints.length === 2) {
            const currentCenter = getCenter(e.touches);
            const lastCenter = getCenter(lastTouchPoints.map(p => ({ clientX: p.x, clientY: p.y })));
            const deltaY = currentCenter.y - lastCenter.y;
            const deltaX = currentCenter.x - lastCenter.x;

            if (Math.abs(scale - 1) < 0.1) { // Not pinching much, likely scrolling
                if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) {
                    currentGesture = deltaY > 0 ? '2-finger scroll ↓' : '2-finger scroll ↑';
                    setCurrentState('scroll');
                } else if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
                    currentGesture = deltaX > 0 ? '2-finger scroll →' : '2-finger scroll ←';
                    setCurrentState('scroll');
                }
            }
        }

        updateGestureDisplay(currentGesture, fingerCount, lastPinchScale.toFixed(2) + 'x', lastSwipeDirection);
    } else if (fingerCount >= 3) {
        // Detect multi-finger swipe
        const startCenter = getCenter(touchStartPoints.map(p => ({ clientX: p.x, clientY: p.y })));
        const currentCenter = getCenter(e.touches);

        const deltaX = currentCenter.x - startCenter.x;
        const deltaY = currentCenter.y - startCenter.y;

        if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
            let direction;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                direction = deltaX > 0 ? 'right' : 'left';
            } else {
                direction = deltaY > 0 ? 'down' : 'up';
            }
            currentGesture = `${fingerCount}-finger swipe`;
            lastSwipeDirection = `${fingerCount}f ${direction}`;
            setCurrentState('swipe');
        }

        updateGestureDisplay(currentGesture, fingerCount, lastPinchScale.toFixed(2) + 'x', lastSwipeDirection);
    }

    // Update last touch points
    lastTouchPoints = Array.from(e.touches).map(t => ({
        id: t.identifier,
        x: t.clientX,
        y: t.clientY
    }));
}, { passive: true });

document.addEventListener('touchend', (e) => {
    const remainingFingers = e.touches.length;
    barFingersEl.textContent = remainingFingers;

    if (remainingFingers === 0) {
        resetGestureAfterDelay();
    } else {
        // Update touch points for remaining fingers
        lastTouchPoints = Array.from(e.touches).map(t => ({
            id: t.identifier,
            x: t.clientX,
            y: t.clientY
        }));
        if (remainingFingers === 2) {
            initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
        }
    }
}, { passive: true });

// Wheel event gesture detection (trackpad gestures on desktop)
document.addEventListener('wheel', (e) => {
    // Detect if this might be a trackpad gesture
    // Trackpads often send wheel events with ctrlKey for pinch
    if (e.ctrlKey) {
        currentGesture = e.deltaY < 0 ? 'pinch out' : 'pinch in';
        const scaleDelta = -e.deltaY * 0.01;
        lastPinchScale = Math.max(0.1, Math.min(10, lastPinchScale + scaleDelta));
        setCurrentState('pinch');
        updateGestureDisplay(currentGesture, '2', lastPinchScale.toFixed(2) + 'x', lastSwipeDirection);
    } else {
        // Regular scroll - could be 2-finger scroll on trackpad
        if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
            let scrollDir = '';
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                scrollDir = e.deltaY > 0 ? '↓' : '↑';
            } else {
                scrollDir = e.deltaX > 0 ? '→' : '←';
            }
            currentGesture = `2-finger scroll ${scrollDir}`;
            updateGestureDisplay(currentGesture, '2', lastPinchScale.toFixed(2) + 'x', lastSwipeDirection);
        }
    }

    resetGestureAfterDelay();
}, { passive: true });
