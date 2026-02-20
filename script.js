// DOM Elements
const deltaX = document.getElementById('delta-x');
const deltaY = document.getElementById('delta-y');
const totalX = document.getElementById('total-x');
const totalY = document.getElementById('total-y');
const resetScrollBtn = document.getElementById('reset-scroll');

// Views where browser zoom should be disabled
const noZoomViews = ['debug-view', 'graph-view', 'shapes-view'];

function isInNoZoomView() {
    // Check if any no-zoom view is currently visible/active
    for (const viewId of noZoomViews) {
        const view = document.getElementById(viewId);
        if (view && view.classList.contains('active')) {
            return true;
        }
    }
    return false;
}

// Prevent browser zoom only on specific views
document.addEventListener('wheel', (e) => {
    if (e.ctrlKey && isInNoZoomView()) {
        e.preventDefault();
    }
}, { passive: false });

// Prevent double-tap zoom on touch devices only on specific views
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    if (!isInNoZoomView()) return;
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

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

// Scroll position tracking for alternative scroll detection (VR headsets, etc.)
let lastScrollTop = 0;
let lastScrollLeft = 0;
let scrollPollInterval = null;
let lastScrollTime = 0;

// Alternative scroll detection using scroll event (catches VR headset scrolling)
function initAlternativeScrollDetection() {
    // Track scroll position changes on the document
    window.addEventListener('scroll', handleNativeScroll, { passive: true });

    // Also listen on scrollable containers
    document.querySelectorAll('.wiki-content, .wiki-article, [style*="overflow"]').forEach(el => {
        el.addEventListener('scroll', (e) => handleElementScroll(e, el), { passive: true });
    });

    // Store initial scroll positions
    lastScrollTop = window.scrollY || document.documentElement.scrollTop;
    lastScrollLeft = window.scrollX || document.documentElement.scrollLeft;
}

function handleNativeScroll(e) {
    const currentScrollTop = window.scrollY || document.documentElement.scrollTop;
    const currentScrollLeft = window.scrollX || document.documentElement.scrollLeft;

    const deltaY = currentScrollTop - lastScrollTop;
    const deltaX = currentScrollLeft - lastScrollLeft;

    // Only process if there's actual movement
    if (deltaX !== 0 || deltaY !== 0) {
        processAlternativeScroll(deltaX, deltaY, 'native-scroll');
    }

    lastScrollTop = currentScrollTop;
    lastScrollLeft = currentScrollLeft;
}

function handleElementScroll(e, element) {
    const scrollTop = element.scrollTop;
    const scrollLeft = element.scrollLeft;

    // Use data attributes to track last known position per element
    const lastTop = parseFloat(element.dataset.lastScrollTop) || 0;
    const lastLeft = parseFloat(element.dataset.lastScrollLeft) || 0;

    const deltaY = scrollTop - lastTop;
    const deltaX = scrollLeft - lastLeft;

    if (deltaX !== 0 || deltaY !== 0) {
        processAlternativeScroll(deltaX, deltaY, 'element-scroll');
    }

    element.dataset.lastScrollTop = scrollTop;
    element.dataset.lastScrollLeft = scrollLeft;
}


// Scroll motion tracking for status bar
let scrollMotionStartTime = 0;
let scrollMotionLastEventTime = 0; // Track time of last scroll event
let scrollMotionDeltaX = 0;
let scrollMotionDeltaY = 0;
let lastScrollMotionDeltaX = 0;
let lastScrollMotionDeltaY = 0;
let lastScrollMotionDuration = 0;
let scrollMotionTimeout = null;
let lastJumpTime = 0; // Timestamp of last detected jump - used to invalidate ongoing motions
let scrollTrackingDisabled = false; // Global flag to disable ALL scroll tracking
const SCROLL_MOTION_END_DELAY = 500; // 500ms threshold

// Centralized function to terminate all scroll motion tracking
function terminateAllScrollMotion() {
    const now = Date.now();
    lastJumpTime = now;

    // DISABLE all scroll tracking globally
    scrollTrackingDisabled = true;

    // Reset scroll state
    isScrolling = false;
    lastScrollDirX = 0;
    lastScrollDirY = 0;

    // Clear all timeouts
    if (scrollMotionTimeout) {
        clearTimeout(scrollMotionTimeout);
        scrollMotionTimeout = null;
    }
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        scrollTimeout = null;
    }

    // Reset motion tracking
    scrollMotionStartTime = 0;
    scrollMotionLastEventTime = 0;
    scrollMotionDeltaX = 0;
    scrollMotionDeltaY = 0;

    // Update display to show motion ended
    updateScrollMotionDisplay(lastScrollMotionDuration, true);

    console.log('[Scroll] All scroll motion terminated, tracking disabled');

    // Re-enable tracking after cooldown
    setTimeout(() => {
        scrollTrackingDisabled = false;
        // Reset all baseline positions
        lastScrollPositions.clear();
        lastBrowseScrollTop = document.getElementById('browse-view')?.scrollTop || 0;
        lastBrowseScrollLeft = document.getElementById('browse-view')?.scrollLeft || 0;
        console.log('[Scroll] Tracking re-enabled, baselines reset');
    }, 300);
}

// Check if scroll tracking is currently disabled
function isScrollTrackingDisabled() {
    return scrollTrackingDisabled;
}

// Threshold to detect programmatic jumps vs actual scrolling
const SCROLL_JUMP_THRESHOLD = 500; // pixels - jumps larger than this are ignored

function processAlternativeScroll(deltaX, deltaY, source) {
    // Check global disable flag FIRST
    if (isScrollTrackingDisabled()) {
        return false;
    }

    // Ignore tiny deltas (likely rendering noise, not real scrolls)
    if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) {
        return false;
    }

    const now = Date.now();

    // Debounce to avoid duplicate detection with wheel events
    // Only process if no wheel event happened recently
    if (now - lastScrollTime < 50) {
        return false; // Return false to indicate we didn't process this
    }

    // Ignore large jumps (e.g., from clicking anchor links or scrollTo calls)
    // These are programmatic position changes, not actual scroll gestures
    if (Math.abs(deltaX) > SCROLL_JUMP_THRESHOLD || Math.abs(deltaY) > SCROLL_JUMP_THRESHOLD) {
        terminateAllScrollMotion();
        return false; // Return false to indicate jump was detected
    }

    // Ignore events that started before the last jump
    if (scrollMotionStartTime > 0 && scrollMotionStartTime < lastJumpTime) {
        return false;
    }

    const currentDirX = deltaX > 0 ? 1 : (deltaX < 0 ? -1 : 0);
    const currentDirY = deltaY > 0 ? 1 : (deltaY < 0 ? -1 : 0);

    // Detect scroll start (for logging purposes)
    if (!isScrolling) {
        isScrolling = true;
        lastScrollDirX = currentDirX;
        lastScrollDirY = currentDirY;

        if (isBrowseModeActive()) {
            setCurrentState('scrolling');
            addLogEntry(`scroll start (${source}) dir: ${getDirDescription(currentDirX, currentDirY)}`, 'scroll');
        }
    } else {
        // Check for axis change (switching between X and Y scrolling)
        const wasScrollingX = lastScrollDirX !== 0;
        const wasScrollingY = lastScrollDirY !== 0;
        const nowScrollingX = currentDirX !== 0;
        const nowScrollingY = currentDirY !== 0;

        // Log axis change: e.g., was scrolling horizontally, now scrolling vertically (or vice versa)
        if (isBrowseModeActive()) {
            if (nowScrollingX && !wasScrollingX && wasScrollingY) {
                addLogEntry(`scroll axis change (${source}) to: horizontal`, 'scroll');
            } else if (nowScrollingY && !wasScrollingY && wasScrollingX) {
                addLogEntry(`scroll axis change (${source}) to: vertical`, 'scroll');
            }
        }

        // Update direction tracking
        if (currentDirX !== 0) lastScrollDirX = currentDirX;
        if (currentDirY !== 0) lastScrollDirY = currentDirY;
    }

    // Start new scroll motion tracking only if no motion is in progress
    if (scrollMotionStartTime === 0 || scrollMotionTimeout === null) {
        scrollMotionStartTime = now;
        scrollMotionDeltaX = 0;
        scrollMotionDeltaY = 0;
    }

    // Accumulate scroll motion delta
    scrollMotionDeltaX += deltaX;
    scrollMotionDeltaY += deltaY;

    // Track the time of the last scroll event
    scrollMotionLastEventTime = now;

    // Update scroll totals
    scrollTotalX += Math.abs(deltaX);
    scrollTotalY += Math.abs(deltaY);

    // Update state to scrolling
    setCurrentState('scroll');

    // Update display
    deltaXEl = document.getElementById('delta-x');
    deltaYEl = document.getElementById('delta-y');
    if (deltaXEl) deltaXEl.textContent = deltaX.toFixed(1);
    if (deltaYEl) deltaYEl.textContent = deltaY.toFixed(1);

    totalXEl = document.getElementById('total-x');
    totalYEl = document.getElementById('total-y');
    if (totalXEl) totalXEl.textContent = scrollTotalX.toFixed(0);
    if (totalYEl) totalYEl.textContent = scrollTotalY.toFixed(0);

    // Update status bar with current motion accumulation
    updateScrollMotionDisplay(now - scrollMotionStartTime);

    // Reset scroll motion end detection
    clearTimeout(scrollMotionTimeout);
    scrollMotionTimeout = setTimeout(() => {
        // Motion ended - save the final values using last event time, not timeout time
        lastScrollMotionDeltaX = scrollMotionDeltaX;
        lastScrollMotionDeltaY = scrollMotionDeltaY;
        lastScrollMotionDuration = scrollMotionLastEventTime - scrollMotionStartTime;

        // Update display with final values
        updateScrollMotionDisplay(lastScrollMotionDuration, true);

        if (isBrowseModeActive()) {
            addLogEntry(`scroll motion: Δ(${scrollMotionDeltaX.toFixed(0)}, ${scrollMotionDeltaY.toFixed(0)}) in ${lastScrollMotionDuration}ms`, 'scroll');
        }

        // Reset motion tracking for next motion
        scrollMotionTimeout = null;
        scrollMotionStartTime = 0;
    }, SCROLL_MOTION_END_DELAY);

    // Reset scroll end detection
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        if (isScrolling) {
            isScrolling = false;
            if (isBrowseModeActive()) {
                setCurrentState('idle');
                addLogEntry(`scroll end (${source})`, 'scroll');
            }
        }
    }, EVENT_END_DELAY);
}

// Update scroll motion display in status bar
function updateScrollMotionDisplay(duration, isFinal = false) {
    const barScroll = document.getElementById('bar-scroll');
    if (barScroll) {
        const dx = isFinal ? lastScrollMotionDeltaX : scrollMotionDeltaX;
        const dy = isFinal ? lastScrollMotionDeltaY : scrollMotionDeltaY;
        const dur = Math.round(duration);
        barScroll.textContent = `Δ(${dx.toFixed(0)}, ${dy.toFixed(0)}) ${dur}ms`;
    }
}

// Touch-based scroll detection (for VR controllers that emulate touch)
let touchStartY = 0;
let touchStartX = 0;
let isTouchScrolling = false;

function initTouchScrollDetection() {
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isTouchScrolling = false;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            const deltaX = touchStartX - e.touches[0].clientX;
            const deltaY = touchStartY - e.touches[0].clientY;

            // Only consider it scrolling if moved more than a small threshold
            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                if (!isTouchScrolling) {
                    isTouchScrolling = true;
                }
                processAlternativeScroll(deltaX, deltaY, 'touch');
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (isTouchScrolling) {
            isTouchScrolling = false;
        }
    }, { passive: true });
}

// Pointer-based scroll detection (for VR controllers using pointer events)
let pointerScrollStartY = 0;
let pointerScrollStartX = 0;
let isPointerScrolling = false;
let scrollPointerIds = new Set();

function initPointerScrollDetection() {
    document.addEventListener('pointerdown', (e) => {
        // Track pointer for potential scroll gesture
        if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.pointerType === 'xr-standard') {
            scrollPointerIds.add(e.pointerId);
            pointerScrollStartX = e.clientX;
            pointerScrollStartY = e.clientY;
        }
    }, { passive: true });

    document.addEventListener('pointermove', (e) => {
        if (scrollPointerIds.has(e.pointerId) && (e.pointerType === 'touch' || e.pointerType === 'pen' || e.pointerType === 'xr-standard')) {
            const deltaX = pointerScrollStartX - e.clientX;
            const deltaY = pointerScrollStartY - e.clientY;

            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                if (!isPointerScrolling) {
                    isPointerScrolling = true;
                }
                processAlternativeScroll(deltaX, deltaY, `pointer-${e.pointerType}`);
                pointerScrollStartX = e.clientX;
                pointerScrollStartY = e.clientY;
            }
        }
    }, { passive: true });

    document.addEventListener('pointerup', (e) => {
        scrollPointerIds.delete(e.pointerId);
        if (scrollPointerIds.size === 0) {
            isPointerScrolling = false;
        }
    }, { passive: true });

    document.addEventListener('pointercancel', (e) => {
        scrollPointerIds.delete(e.pointerId);
        if (scrollPointerIds.size === 0) {
            isPointerScrolling = false;
        }
    }, { passive: true });
}

// Initialize all alternative scroll detection methods
document.addEventListener('DOMContentLoaded', () => {
    initAlternativeScrollDetection();
    initTouchScrollDetection();
    initPointerScrollDetection();
    initScrollPositionMonitoring();

    // Terminate scroll motion when any link is clicked (to handle anchor jumps)
    // Use mousedown for faster response - fires before the scroll happens
    document.addEventListener('mousedown', (e) => {
        const link = e.target.closest('a');
        if (link && link.getAttribute('href')) {
            // Link clicked - terminate any ongoing scroll motion
            terminateAllScrollMotion();
        }
    }, true); // Use capture phase to catch it early
});

// Scroll position monitoring for VR headsets
// This detects scrolling by monitoring changes in scroll position
// even when no scroll events are fired
let lastScrollPositions = new Map();
let scrollPositionMonitoringActive = false;
let scrollPositionRAF = null;

function initScrollPositionMonitoring() {
    // Start monitoring when browse mode is active
    scrollPositionMonitoringActive = true;
    monitorScrollPositions();
}

function monitorScrollPositions() {
    if (!scrollPositionMonitoringActive) return;

    // Only monitor in browse mode
    if (isBrowseModeActive()) {
        // Get all scrollable elements in browse view
        const browseViewEl = document.getElementById('browse-view');
        const scrollableElements = [
            browseViewEl,
            document.querySelector('.wiki-article'),
            document.querySelector('.wiki-content'),
            document.querySelector('.mock-docs-sidebar'),
            document.querySelector('.mock-docs-content'),
            document.querySelector('.mock-browser-content'),
            document.documentElement,
            document.body
        ].filter(el => el !== null);

        scrollableElements.forEach(el => {
            const key = el.id || el.className || 'body';
            const currentTop = el.scrollTop;
            const currentLeft = el.scrollLeft;

            // During cooldown, just update baselines without processing
            if (isScrollTrackingDisabled()) {
                lastScrollPositions.set(key, { top: currentTop, left: currentLeft });
                return;
            }

            const lastPos = lastScrollPositions.get(key) || { top: currentTop, left: currentLeft };

            const deltaY = currentTop - lastPos.top;
            const deltaX = currentLeft - lastPos.left;

            // If position changed significantly (ignore tiny oscillations), we detected a scroll
            if (Math.abs(deltaY) >= 2 || Math.abs(deltaX) >= 2) {
                // Log the detected scroll
                // Debug logging disabled
                // console.log(`[VR Scroll] Position change detected on ${key}: deltaX=${deltaX.toFixed(1)}, deltaY=${deltaY.toFixed(1)}`);

                // Process as a scroll event - returns false if it was a jump
                const wasProcessed = processAlternativeScroll(deltaX, deltaY, 'position-monitor');

                // If it was a jump, we still need to update position tracking
                // so subsequent monitoring uses the new position as baseline
            }

            // Always update last known position (important after jumps)
            lastScrollPositions.set(key, { top: currentTop, left: currentLeft });
        });
    }

    // Continue monitoring
    scrollPositionRAF = requestAnimationFrame(monitorScrollPositions);
}

// Also monitor window scroll position
let lastWindowScrollX = window.scrollX;
let lastWindowScrollY = window.scrollY;

function checkWindowScroll() {
    if (!isBrowseModeActive()) return;

    const currentX = window.scrollX;
    const currentY = window.scrollY;

    const deltaX = currentX - lastWindowScrollX;
    const deltaY = currentY - lastWindowScrollY;

    if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
        // Debug logging disabled
        // console.log(`[VR Scroll] Window position change: deltaX=${deltaX.toFixed(1)}, deltaY=${deltaY.toFixed(1)}`);
        processAlternativeScroll(deltaX, deltaY, 'window-position');
    }

    lastWindowScrollX = currentX;
    lastWindowScrollY = currentY;
}

// Check window scroll position periodically
setInterval(checkWindowScroll, 50);

// Add direct scroll event listeners to scrollable elements
document.addEventListener('DOMContentLoaded', () => {
    const scrollableSelectors = [
        '#browse-view',
        '.wiki-article',
        '.wiki-content',
        '.mock-docs-sidebar',
        '.mock-docs-content'
    ];

    scrollableSelectors.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) {
            el.addEventListener('scroll', (e) => {
                if (!isBrowseModeActive()) return;
                if (isScrollTrackingDisabled()) {
                    // Reset baselines during disabled period
                    e.target._lastScrollTop = e.target.scrollTop;
                    e.target._lastScrollLeft = e.target.scrollLeft;
                    return;
                }

                const target = e.target;
                const deltaY = e.target.scrollTop - (target._lastScrollTop || 0);
                const deltaX = e.target.scrollLeft - (target._lastScrollLeft || 0);

                if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
                    // Debug logging disabled
                    // console.log(`[Scroll Event] ${selector}: deltaX=${deltaX.toFixed(1)}, deltaY=${deltaY.toFixed(1)}`);
                    processAlternativeScroll(deltaX, deltaY, 'scroll-event');
                }

                target._lastScrollTop = target.scrollTop;
                target._lastScrollLeft = target.scrollLeft;
            }, { passive: true });

            console.log(`[Scroll Detection] Added scroll listener to ${selector}`);
        }
    });

    // Also listen to the native scroll event on the browse-view
    const browseView = document.getElementById('browse-view');
    if (browseView) {
        // Use capturing phase to catch all scroll events
        browseView.addEventListener('scroll', (e) => {
            if (!isBrowseModeActive()) return;
            const scrollTop = browseView.scrollTop;
            const scrollLeft = browseView.scrollLeft;

            if (browseView._prevScrollTop === undefined) {
                browseView._prevScrollTop = scrollTop;
                browseView._prevScrollLeft = scrollLeft;
            }

            const deltaY = scrollTop - browseView._prevScrollTop;
            const deltaX = scrollLeft - browseView._prevScrollLeft;

            if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
                console.log(`[Browse View Scroll] scrollTop=${scrollTop}, deltaY=${deltaY.toFixed(1)}`);
                processAlternativeScroll(deltaX, deltaY, 'browse-scroll');
            }

            browseView._prevScrollTop = scrollTop;
            browseView._prevScrollLeft = scrollLeft;
        }, { capture: true, passive: true });
    }
});

// Aggressive scroll position polling - checks every frame
let lastBrowseScrollTop = 0;
let lastBrowseScrollLeft = 0;

function aggressiveScrollCheck() {
    // Check global disable flag
    if (isScrollTrackingDisabled()) {
        requestAnimationFrame(aggressiveScrollCheck);
        return;
    }

    if (isBrowseModeActive()) {
        const browseView = document.getElementById('browse-view');
        if (browseView) {
            const currentTop = browseView.scrollTop;
            const currentLeft = browseView.scrollLeft;

            const deltaY = currentTop - lastBrowseScrollTop;
            const deltaX = currentLeft - lastBrowseScrollLeft;

            if (Math.abs(deltaY) > 0.5 || Math.abs(deltaX) > 0.5) {
                // Debug logging disabled
                // console.log(`[Aggressive Check] Browse view scroll detected: top=${currentTop}, deltaY=${deltaY.toFixed(1)}`);
                processAlternativeScroll(deltaX, deltaY, 'aggressive-poll');
            }

            lastBrowseScrollTop = currentTop;
            lastBrowseScrollLeft = currentLeft;
        }
    }
    requestAnimationFrame(aggressiveScrollCheck);
}

// Start aggressive polling
requestAnimationFrame(aggressiveScrollCheck);

// Helper to get direction description
function getDirDescription(dirX, dirY) {
    const parts = [];
    if (dirY < 0) parts.push('up');
    if (dirY > 0) parts.push('down');
    if (dirX < 0) parts.push('left');
    if (dirX > 0) parts.push('right');
    return parts.length > 0 ? parts.join('-') : 'none';
}

// Scroll handling (wheel event - primary method for touchpads/mice)
document.addEventListener('wheel', (e) => {
    // Check global disable flag FIRST
    if (isScrollTrackingDisabled()) {
        return;
    }

    lastScrollTime = Date.now(); // Mark that wheel event occurred
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

    const now = Date.now();
    const currentDirX = e.deltaX > 0 ? 1 : (e.deltaX < 0 ? -1 : 0);
    const currentDirY = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);

    // Detect scroll start (for logging purposes)
    if (!isScrolling) {
        isScrolling = true;
        lastScrollDirX = currentDirX;
        lastScrollDirY = currentDirY;
        addLogEntry(`scroll start (X: ${Math.round(scrollTotalX)}, Y: ${Math.round(scrollTotalY)})`, 'scroll');
    }

    // Start new scroll motion tracking only if no motion is in progress
    // (i.e., the motion timeout has fired or this is the first scroll)
    if (scrollMotionStartTime === 0 || scrollMotionTimeout === null) {
        scrollMotionStartTime = now;
        scrollMotionDeltaX = 0;
        scrollMotionDeltaY = 0;
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

    // Accumulate scroll motion delta
    scrollMotionDeltaX += e.deltaX;
    scrollMotionDeltaY += e.deltaY;

    // Track the time of the last scroll event
    scrollMotionLastEventTime = now;

    deltaX.textContent = Math.round(e.deltaX);
    deltaY.textContent = Math.round(e.deltaY);

    scrollTotalX += e.deltaX;
    scrollTotalY += e.deltaY;

    totalX.textContent = Math.round(scrollTotalX);
    totalY.textContent = Math.round(scrollTotalY);

    // Update status bar with current motion accumulation
    updateScrollMotionDisplay(now - scrollMotionStartTime);

    // Store the motion start time to check against jumps
    const currentMotionStartTime = scrollMotionStartTime;

    // Reset scroll motion end detection
    clearTimeout(scrollMotionTimeout);
    scrollMotionTimeout = setTimeout(() => {
        // Check if this motion was invalidated by a jump
        if (currentMotionStartTime < lastJumpTime) {
            scrollMotionTimeout = null;
            return;
        }

        // Motion ended - save the final values using last event time, not timeout time
        lastScrollMotionDeltaX = scrollMotionDeltaX;
        lastScrollMotionDeltaY = scrollMotionDeltaY;
        lastScrollMotionDuration = scrollMotionLastEventTime - scrollMotionStartTime;

        // Update display with final values
        updateScrollMotionDisplay(lastScrollMotionDuration, true);

        addLogEntry(`scroll motion: Δ(${scrollMotionDeltaX.toFixed(0)}, ${scrollMotionDeltaY.toFixed(0)}) in ${lastScrollMotionDuration}ms`, 'scroll');

        // Reset motion tracking for next motion
        scrollMotionTimeout = null;
        scrollMotionStartTime = 0;
    }, SCROLL_MOTION_END_DELAY);

    // Clear existing timeout and set new one for scroll end detection
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
    }
    scrollTimeout = setTimeout(() => {
        isScrolling = false;
        lastScrollDirX = 0;
        lastScrollDirY = 0;
    }, EVENT_END_DELAY);
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

// NOTE: Global contextmenu prevention removed to allow native browser right-click menu in Browse Mode

// Zoom handling
function handleZoom(e) {
    const currentZoomDir = e.deltaY < 0 ? 1 : (e.deltaY > 0 ? -1 : 0); // negative deltaY = zoom in

    // Detect zoom start - reset pinch scale for new gesture
    if (!isZooming) {
        isZooming = true;
        lastZoomDir = currentZoomDir;
        lastPinchScale = 1;
        addLogEntry(`zoom start (${lastPinchScale.toFixed(2)}x)`, 'zoom');
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
        addLogEntry(`zoom end (${lastPinchScale.toFixed(2)}x)`, 'zoom');
        isZooming = false;
        lastZoomDir = 0;
    }, EVENT_END_DELAY);

    // Update pinch scale
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    lastPinchScale = Math.max(0.1, Math.min(10, lastPinchScale + delta));
    updateZoomVisualization();
}

function updateZoomVisualization() {
    // Display pinch multiplier (resets with each new gesture)
    zoomLevel.textContent = lastPinchScale.toFixed(2) + 'x';

    const baseDistance = 50;
    const distance = baseDistance * lastPinchScale;

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
    lastPinchScale = 1;
    updateZoomVisualization();
});

// Touch handlers for Debug Dashboard pinch detection (similar to Graph View)
const debugView = document.getElementById('debug-view');
let debugTouchStartDist = 0;
let debugPinchActive = false;

if (debugView) {
    debugView.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // Prevent default zoom behavior
            e.preventDefault();
            // Pinch start - reset scale
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            debugTouchStartDist = Math.sqrt(dx * dx + dy * dy);
            debugPinchActive = true;
            lastPinchScale = 1;
            updateZoomVisualization();
            console.log('[Debug Pinch] Pinch start detected');
        }
    }, { passive: false });

    debugView.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && debugPinchActive) {
            // Prevent default zoom behavior
            e.preventDefault();
            // Pinch zoom
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const scaleDelta = (dist - debugTouchStartDist) * 0.01;
            lastPinchScale = Math.max(0.1, Math.min(10, lastPinchScale + scaleDelta));

            setCurrentState('pinch');
            currentGesture = scaleDelta > 0 ? 'pinch out' : 'pinch in';
            updateGestureDisplay(currentGesture, '2', lastPinchScale.toFixed(2) + 'x', lastSwipeDirection);
            updateZoomVisualization();

            debugTouchStartDist = dist;
        }
    }, { passive: false });

    debugView.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            debugPinchActive = false;
        }
    }, { passive: true });

    // Prevent gesture events (Safari/iOS)
    debugView.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    }, { passive: false });

    debugView.addEventListener('gesturechange', (e) => {
        e.preventDefault();
    }, { passive: false });

    debugView.addEventListener('gestureend', (e) => {
        e.preventDefault();
    }, { passive: false });
}

// Debug scroll overlay for VR scroll detection
const debugScrollOverlay = document.getElementById('debug-scroll-overlay');
let lastDebugOverlayScrollTop = 5000;
let lastDebugOverlayScrollLeft = 5000;

function isDebugModeActive() {
    const debugView = document.getElementById('debug-view');
    return debugView && debugView.classList.contains('active');
}

if (debugScrollOverlay) {
    // Center the scroll position initially
    debugScrollOverlay.scrollTop = 5000;
    debugScrollOverlay.scrollLeft = 5000;

    debugScrollOverlay.addEventListener('scroll', () => {
        if (!isDebugModeActive()) return;

        const currentTop = debugScrollOverlay.scrollTop;
        const currentLeft = debugScrollOverlay.scrollLeft;
        const scrollDeltaY = currentTop - lastDebugOverlayScrollTop;
        const scrollDeltaX = currentLeft - lastDebugOverlayScrollLeft;

        // Only process significant scroll deltas
        if (Math.abs(scrollDeltaY) >= 2 || Math.abs(scrollDeltaX) >= 2) {
            // Update scroll display directly (same as wheel handler)
            deltaX.textContent = Math.round(scrollDeltaX);
            deltaY.textContent = Math.round(scrollDeltaY);
            
            scrollTotalX += scrollDeltaX;
            scrollTotalY += scrollDeltaY;
            
            totalX.textContent = Math.round(scrollTotalX);
            totalY.textContent = Math.round(scrollTotalY);
            
            setCurrentState('scroll');
        }

        lastDebugOverlayScrollTop = currentTop;
        lastDebugOverlayScrollLeft = currentLeft;

        // Re-center when getting close to edges to enable infinite scrolling
        if (currentTop < 1000 || currentTop > 9000) {
            debugScrollOverlay.scrollTop = 5000;
            lastDebugOverlayScrollTop = 5000;
        }
        if (currentLeft < 1000 || currentLeft > 9000) {
            debugScrollOverlay.scrollLeft = 5000;
            lastDebugOverlayScrollLeft = 5000;
        }
    }, { passive: true });
}

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

// Browse Mode Context Menu - DISABLED to show native browser menu
const browseContextMenu = document.getElementById('browse-context-menu');

// Hide the mock context menu element
if (browseContextMenu) {
    browseContextMenu.style.display = 'none';
}

// Log right-click but allow native browser context menu to appear
browseView.addEventListener('contextmenu', (e) => {
    if (!isBrowseModeActive()) return;

    // Do NOT call e.preventDefault() - allow native browser menu
    setCurrentState('click');
    addLogEntry('right-click (native menu)', 'mouse');
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
let lastPinchWheelTime = 0;
const SWIPE_THRESHOLD = 30;
const PINCH_THRESHOLD = 10;
const PINCH_GESTURE_TIMEOUT = 500;

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
        const now = Date.now();
        // Reset pinch scale if this is a new pinch gesture (after timeout)
        if (now - lastPinchWheelTime > PINCH_GESTURE_TIMEOUT) {
            lastPinchScale = 1;
            console.log('[Pinch] New gesture detected, resetting scale to 1.0x');
        }
        lastPinchWheelTime = now;

        currentGesture = e.deltaY < 0 ? 'pinch out' : 'pinch in';
        const scaleDelta = -e.deltaY * 0.01;
        lastPinchScale = Math.max(0.1, Math.min(10, lastPinchScale + scaleDelta));
        setCurrentState('pinch');
        updateGestureDisplay(currentGesture, '2', lastPinchScale.toFixed(2) + 'x', lastSwipeDirection);

        // Update Debug Dashboard zoom visualization
        updateZoomVisualization();
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

// ==================== //
// Maps Mode            //
// ==================== //

// Maps DOM elements
const mapsView = document.getElementById('maps-view');
const mapsStateEl = document.getElementById('maps-state');
const mapsPanEl = document.getElementById('maps-pan');
const mapsZoomEl = document.getElementById('maps-zoom');
const mapsPinEl = document.getElementById('maps-pin');
const mapsGestureEl = document.getElementById('maps-gesture');
const mapsDraggingEl = document.getElementById('maps-dragging');
const resetMapZoomBtn = document.getElementById('reset-map-zoom');
const clearPinBtn = document.getElementById('clear-pin');
const toggleMapsLogBtn = document.getElementById('toggle-maps-log');
const mapsEventLog = document.querySelector('.maps-event-log');
const mapsEventLogContent = document.getElementById('maps-event-log-content');
const clearMapsLogBtn = document.getElementById('clear-maps-log');
const mapViewport = document.getElementById('map-viewport');
const mapContent = document.getElementById('map-content');
const mapPin = document.getElementById('map-pin');

// Maps state
let mapZoom = 1.0;
let mapPanX = 0;
let mapPanY = 0;
let mapIsDragging = false;
let mapDragStartX = 0;
let mapDragStartY = 0;
let mapPanStartX = 0;
let mapPanStartY = 0;
let mapPinX = null;
let mapPinY = null;
let mapsLogVisible = true;
const MAP_MIN_ZOOM = 0.25;
const MAP_MAX_ZOOM = 5.0;
const MAP_ZOOM_SENSITIVITY = 0.01;

// Check if maps mode is active
function isMapsModeActive() {
    return mapsView && mapsView.classList.contains('active');
}

// Update map transform
function updateMapTransform() {
    mapContent.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
    mapsPanEl.textContent = `${Math.round(mapPanX)}, ${Math.round(mapPanY)}`;
    mapsZoomEl.textContent = `${Math.round(mapZoom * 100)}%`;
}

// Set maps state
function setMapsState(state) {
    mapsStateEl.textContent = state;
    mapsStateEl.className = 'state-value ' + state;
}

// Add entry to maps event log
function addMapsLogEntry(eventName, category) {
    if (!mapsEventLogContent) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${category}`;
    entry.innerHTML = `<span class="timestamp">${formatTimestamp()}</span><span class="event-name">${eventName}</span>`;
    mapsEventLogContent.insertBefore(entry, mapsEventLogContent.firstChild);

    while (mapsEventLogContent.children.length > 50) {
        mapsEventLogContent.removeChild(mapsEventLogContent.lastChild);
    }
}

// Map pan/drag handling
mapViewport.addEventListener('mousedown', (e) => {
    if (!isMapsModeActive()) return;
    if (e.button !== 0) return; // Only left click for dragging

    mapIsDragging = true;
    mapDragStartX = e.clientX;
    mapDragStartY = e.clientY;
    mapPanStartX = mapPanX;
    mapPanStartY = mapPanY;

    mapsDraggingEl.textContent = 'Yes';
    setMapsState('move');
    addMapsLogEntry('drag start', 'pointer');

    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!mapIsDragging) return;

    const deltaX = e.clientX - mapDragStartX;
    const deltaY = e.clientY - mapDragStartY;

    mapPanX = mapPanStartX + deltaX;
    mapPanY = mapPanStartY + deltaY;

    updateMapTransform();
    mapsGestureEl.textContent = 'panning';
});

document.addEventListener('mouseup', (e) => {
    if (!mapIsDragging) return;

    mapIsDragging = false;
    mapsDraggingEl.textContent = 'No';
    setMapsState('idle');
    mapsGestureEl.textContent = '-';
    addMapsLogEntry(`drag end (${Math.round(mapPanX)}, ${Math.round(mapPanY)})`, 'pointer');
});

// Map zoom handling
mapViewport.addEventListener('wheel', (e) => {
    if (!isMapsModeActive()) return;

    e.preventDefault();

    if (e.ctrlKey) {
        // Pinch-to-zoom
        const rect = mapViewport.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        // Calculate point under cursor in map coordinates
        const pointX = (cursorX - mapPanX) / mapZoom;
        const pointY = (cursorY - mapPanY) / mapZoom;

        // Update zoom
        const oldZoom = mapZoom;
        const delta = -e.deltaY * MAP_ZOOM_SENSITIVITY;
        mapZoom = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, mapZoom + delta));

        // Adjust pan to keep point under cursor stationary
        mapPanX = cursorX - pointX * mapZoom;
        mapPanY = cursorY - pointY * mapZoom;

        updateMapTransform();
        setMapsState('zoom');
        mapsGestureEl.textContent = e.deltaY < 0 ? 'pinch out' : 'pinch in';

        if (Math.abs(mapZoom - oldZoom) > 0.01) {
            addMapsLogEntry(`zoom ${e.deltaY < 0 ? 'in' : 'out'} (${Math.round(mapZoom * 100)}%)`, 'zoom');
        }
    } else {
        // Regular scroll to pan
        mapPanX -= e.deltaX;
        mapPanY -= e.deltaY;

        updateMapTransform();
        setMapsState('scroll');

        let scrollDir = '';
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            scrollDir = e.deltaY > 0 ? '↓' : '↑';
        } else {
            scrollDir = e.deltaX > 0 ? '→' : '←';
        }
        mapsGestureEl.textContent = `scroll ${scrollDir}`;
    }

    // Reset state after delay
    setTimeout(() => {
        if (!mapIsDragging) {
            setMapsState('idle');
            mapsGestureEl.textContent = '-';
        }
    }, 200);
}, { passive: false });

// Map pin placement (click without drag)
let mapClickStartX = 0;
let mapClickStartY = 0;

mapViewport.addEventListener('mousedown', (e) => {
    mapClickStartX = e.clientX;
    mapClickStartY = e.clientY;
});

mapViewport.addEventListener('click', (e) => {
    if (!isMapsModeActive()) return;

    // Check if this was a drag (moved more than 5px)
    const moveDistance = Math.sqrt(
        Math.pow(e.clientX - mapClickStartX, 2) +
        Math.pow(e.clientY - mapClickStartY, 2)
    );

    if (moveDistance > 5) return; // Was a drag, not a click

    // Calculate click position in map coordinates
    const rect = mapViewport.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert to map content coordinates
    mapPinX = (clickX - mapPanX) / mapZoom;
    mapPinY = (clickY - mapPanY) / mapZoom;

    // Position and show the pin
    mapPin.style.left = mapPinX + 'px';
    mapPin.style.top = mapPinY + 'px';
    mapPin.classList.remove('hidden');

    // Update display
    mapsPinEl.textContent = `${Math.round(mapPinX)}, ${Math.round(mapPinY)}`;
    setMapsState('click');
    addMapsLogEntry(`pin placed (${Math.round(mapPinX)}, ${Math.round(mapPinY)})`, 'mouse');

    setTimeout(() => setMapsState('idle'), 200);
});

// Reset map zoom button
resetMapZoomBtn.addEventListener('click', () => {
    mapZoom = 1.0;
    mapPanX = 0;
    mapPanY = 0;
    updateMapTransform();
    addMapsLogEntry('zoom reset', 'zoom');
});

// Clear pin button
clearPinBtn.addEventListener('click', () => {
    mapPin.classList.add('hidden');
    mapPinX = null;
    mapPinY = null;
    mapsPinEl.textContent = 'None';
    addMapsLogEntry('pin cleared', 'mouse');
});

// Toggle maps event log
toggleMapsLogBtn.addEventListener('click', () => {
    mapsLogVisible = !mapsLogVisible;
    if (mapsLogVisible) {
        mapsEventLog.style.display = 'flex';
        toggleMapsLogBtn.textContent = 'Hide Log';
    } else {
        mapsEventLog.style.display = 'none';
        toggleMapsLogBtn.textContent = 'Show Log';
    }
});

// Clear maps log button
clearMapsLogBtn.addEventListener('click', () => {
    mapsEventLogContent.innerHTML = '';
});

// Context Menu
const contextMenu = document.getElementById('map-context-menu');
const coordsText = contextMenu.querySelector('.coords-text');
let contextMenuX = 0;
let contextMenuY = 0;

// Show context menu on right-click
mapViewport.addEventListener('contextmenu', (e) => {
    if (!isMapsModeActive()) return;

    e.preventDefault();

    // Calculate click position in map coordinates
    const rect = mapViewport.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert to map content coordinates
    contextMenuX = (clickX - mapPanX) / mapZoom;
    contextMenuY = (clickY - mapPanY) / mapZoom;

    // Update coordinates display
    coordsText.textContent = `Coords: ${Math.round(contextMenuX)}, ${Math.round(contextMenuY)}`;

    // Position context menu
    contextMenu.style.left = e.clientX - rect.left + 'px';
    contextMenu.style.top = e.clientY - rect.top + 'px';

    // Make sure menu doesn't go off screen
    const menuRect = contextMenu.getBoundingClientRect();
    if (e.clientX + menuRect.width > window.innerWidth) {
        contextMenu.style.left = (e.clientX - rect.left - menuRect.width) + 'px';
    }
    if (e.clientY + menuRect.height > window.innerHeight) {
        contextMenu.style.top = (e.clientY - rect.top - menuRect.height) + 'px';
    }

    // Show the menu
    contextMenu.classList.remove('hidden');

    setMapsState('click');
    addMapsLogEntry('right-click menu opened', 'mouse');
});

// Hide context menu when clicking elsewhere
document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
        contextMenu.classList.add('hidden');
    }
});

// Hide context menu when scrolling/panning map
mapViewport.addEventListener('mousedown', () => {
    contextMenu.classList.add('hidden');
});

// Handle context menu item clicks
contextMenu.addEventListener('click', (e) => {
    const menuItem = e.target.closest('.context-menu-item');
    if (!menuItem) return;

    const action = menuItem.dataset.action;

    switch (action) {
        case 'search':
            addMapsLogEntry(`search at (${Math.round(contextMenuX)}, ${Math.round(contextMenuY)})`, 'mouse');
            break;
        case 'directions':
            addMapsLogEntry(`directions from (${Math.round(contextMenuX)}, ${Math.round(contextMenuY)})`, 'mouse');
            break;
        case 'add-pin':
            // Place pin at context menu location
            mapPinX = contextMenuX;
            mapPinY = contextMenuY;
            mapPin.style.left = mapPinX + 'px';
            mapPin.style.top = mapPinY + 'px';
            mapPin.classList.remove('hidden');
            mapsPinEl.textContent = `${Math.round(mapPinX)}, ${Math.round(mapPinY)}`;
            addMapsLogEntry(`pin placed via menu (${Math.round(mapPinX)}, ${Math.round(mapPinY)})`, 'mouse');
            break;
        case 'coordinates':
            // Copy coordinates to clipboard (mock)
            addMapsLogEntry(`coordinates copied: ${Math.round(contextMenuX)}, ${Math.round(contextMenuY)}`, 'mouse');
            break;
        case 'favorite':
            addMapsLogEntry(`added to favorites (${Math.round(contextMenuX)}, ${Math.round(contextMenuY)})`, 'mouse');
            break;
        case 'share':
            addMapsLogEntry(`share location (${Math.round(contextMenuX)}, ${Math.round(contextMenuY)})`, 'mouse');
            break;
        case 'print':
            addMapsLogEntry('print map requested', 'mouse');
            break;
    }

    // Hide menu after action
    contextMenu.classList.add('hidden');
});

// Initialize map on load
window.addEventListener('load', () => {
    updateMapTransform();
});

// ==================== //
// Graph View           //
// ==================== //

const graphView = document.getElementById('graph-view');
const scrollYGraphCanvas = document.getElementById('scroll-y-graph-canvas');
const scrollXGraphCanvas = document.getElementById('scroll-x-graph-canvas');
const zoomGraphCanvas = document.getElementById('zoom-graph-canvas');
const scrollYGraphCtx = scrollYGraphCanvas ? scrollYGraphCanvas.getContext('2d') : null;
const scrollXGraphCtx = scrollXGraphCanvas ? scrollXGraphCanvas.getContext('2d') : null;
const zoomGraphCtx = zoomGraphCanvas ? zoomGraphCanvas.getContext('2d') : null;

// Graph View DOM elements
const graphMotionType = document.getElementById('graph-motion-type');
const graphMoveX = document.getElementById('graph-move-x');
const graphMoveY = document.getElementById('graph-move-y');
const graphScrollX = document.getElementById('graph-scroll-x');
const graphScrollY = document.getElementById('graph-scroll-y');
const graphZoomValue = document.getElementById('graph-zoom-value');
const graphDuration = document.getElementById('graph-duration');
const graphMotionStatus = document.getElementById('graph-motion-status');
const motionHistoryList = document.getElementById('motion-history-list');
const clearGraphsBtn = document.getElementById('clear-graphs');
const exportDataBtn = document.getElementById('export-data');

// Graph View State
let graphModeActive = false;
let currentMotion = {
    type: 'none',
    startTime: 0,
    moveX: 0,
    moveY: 0,
    scrollX: 0,
    scrollY: 0,
    zoomDelta: 0,
    zoomLevel: 1.0
};

let isMotionActive = false;
let motionEndTimeout = null;
const MOTION_END_DELAY = 200; // ms to wait before considering motion ended

// Graph data storage
let scrollGraphData = [];
let zoomGraphData = [];
const MAX_GRAPH_POINTS = 500; // Max data points to store
let graphStartTime = 0;

// Motion history
let motionHistory = [];
const MAX_HISTORY_ITEMS = 20;

// Graph scroll overlay for VR scroll detection
const graphScrollOverlay = document.getElementById('graph-scroll-overlay');
let lastGraphOverlayScrollTop = 5000; // Start centered
let lastGraphOverlayScrollLeft = 5000; // Start centered

if (graphScrollOverlay) {
    // Center the scroll position initially
    graphScrollOverlay.scrollTop = 5000;
    graphScrollOverlay.scrollLeft = 5000;

    graphScrollOverlay.addEventListener('scroll', () => {
        if (!isGraphModeActive()) return;

        const currentTop = graphScrollOverlay.scrollTop;
        const currentLeft = graphScrollOverlay.scrollLeft;
        const deltaY = currentTop - lastGraphOverlayScrollTop;
        const deltaX = currentLeft - lastGraphOverlayScrollLeft;

        // Only process significant scroll deltas
        if (Math.abs(deltaY) >= 2 || Math.abs(deltaX) >= 2) {
            // Start motion if not active
            if (!isMotionActive) {
                startMotion('scroll');
            }

            // Update motion with scroll data
            updateMotion('scroll', {
                deltaX: deltaX,
                deltaY: deltaY
            });
        }

        lastGraphOverlayScrollTop = currentTop;
        lastGraphOverlayScrollLeft = currentLeft;

        // Re-center when getting close to edges to enable infinite scrolling
        if (currentTop < 1000 || currentTop > 9000) {
            graphScrollOverlay.scrollTop = 5000;
            lastGraphOverlayScrollTop = 5000;
        }
        if (currentLeft < 1000 || currentLeft > 9000) {
            graphScrollOverlay.scrollLeft = 5000;
            lastGraphOverlayScrollLeft = 5000;
        }
    }, { passive: true });
}

function isGraphModeActive() {
    return graphView && graphView.classList.contains('active');
}

// Initialize graph canvas sizes
function initGraphCanvases() {
    if (scrollYGraphCanvas) {
        const container = scrollYGraphCanvas.parentElement;
        scrollYGraphCanvas.width = container.clientWidth;
        scrollYGraphCanvas.height = container.clientHeight;
    }
    if (scrollXGraphCanvas) {
        const container = scrollXGraphCanvas.parentElement;
        scrollXGraphCanvas.width = container.clientWidth;
        scrollXGraphCanvas.height = container.clientHeight;
    }
    if (zoomGraphCanvas) {
        const container = zoomGraphCanvas.parentElement;
        zoomGraphCanvas.width = container.clientWidth;
        zoomGraphCanvas.height = container.clientHeight;
    }
}

// Resize observer for canvases
const graphResizeObserver = new ResizeObserver(() => {
    if (isGraphModeActive()) {
        initGraphCanvases();
        drawScrollYGraph();
        drawScrollXGraph();
        drawZoomGraph();
    }
});

if (scrollYGraphCanvas && scrollYGraphCanvas.parentElement) {
    graphResizeObserver.observe(scrollYGraphCanvas.parentElement);
}
if (scrollXGraphCanvas && scrollXGraphCanvas.parentElement) {
    graphResizeObserver.observe(scrollXGraphCanvas.parentElement);
}
if (zoomGraphCanvas && zoomGraphCanvas.parentElement) {
    graphResizeObserver.observe(zoomGraphCanvas.parentElement);
}

// Start a new motion
function startMotion(type) {
    // If starting a new motion of a different type, end the current one first
    if (isMotionActive && currentMotion.type !== type) {
        endMotion();
    }

    // If not already active, start fresh
    if (!isMotionActive) {
        isMotionActive = true;
        currentMotion = {
            type: type,
            startTime: Date.now(),
            moveX: 0,
            moveY: 0,
            scrollX: 0,
            scrollY: 0,
            zoomDelta: 0,
            zoomLevel: 1.0  // Always reset zoom to 1.0 for new motion
        };

        // Clear graphs for new motion
        scrollGraphData = [];
        zoomGraphData = [];
        graphStartTime = Date.now();

        // Clear the canvases completely for new motion
        clearGraphCanvases();

        updateMotionStatus('active');
        updateMotionTypeDisplay(type);
    }

    // Reset end timeout
    clearTimeout(motionEndTimeout);
}

// Clear graph canvases completely (no ghost effect)
function clearGraphCanvases() {
    if (scrollYGraphCtx && scrollYGraphCanvas) {
        scrollYGraphCtx.clearRect(0, 0, scrollYGraphCanvas.width, scrollYGraphCanvas.height);
    }
    if (scrollXGraphCtx && scrollXGraphCanvas) {
        scrollXGraphCtx.clearRect(0, 0, scrollXGraphCanvas.width, scrollXGraphCanvas.height);
    }
    if (zoomGraphCtx && zoomGraphCanvas) {
        zoomGraphCtx.clearRect(0, 0, zoomGraphCanvas.width, zoomGraphCanvas.height);
    }
    drawScrollYGraph();
    drawScrollXGraph();
    drawZoomGraph();
}

// End the current motion
function endMotion() {
    if (!isMotionActive) return;

    isMotionActive = false;
    const duration = Date.now() - currentMotion.startTime;

    // Add to history
    addMotionToHistory(currentMotion, duration);

    updateMotionStatus('idle');
}

// Update motion with new data
function updateMotion(type, data) {
    if (!isGraphModeActive()) return;

    startMotion(type);

    const now = Date.now();
    const timeSinceStart = now - graphStartTime;

    if (type === 'move') {
        currentMotion.moveX += data.deltaX || 0;
        currentMotion.moveY += data.deltaY || 0;
    } else if (type === 'scroll') {
        currentMotion.scrollX += data.deltaX || 0;
        currentMotion.scrollY += data.deltaY || 0;

        // Add to scroll graph data
        scrollGraphData.push({
            time: timeSinceStart,
            deltaX: data.deltaX || 0,
            deltaY: data.deltaY || 0,
            totalX: currentMotion.scrollX,
            totalY: currentMotion.scrollY
        });

        if (scrollGraphData.length > MAX_GRAPH_POINTS) {
            scrollGraphData.shift();
        }

        drawScrollYGraph();
        drawScrollXGraph();
    } else if (type === 'zoom') {
        currentMotion.zoomDelta += data.delta || 0;
        currentMotion.zoomLevel = data.level || 1.0;

        // Add to zoom graph data
        zoomGraphData.push({
            time: timeSinceStart,
            delta: data.delta || 0,
            level: currentMotion.zoomLevel
        });

        if (zoomGraphData.length > MAX_GRAPH_POINTS) {
            zoomGraphData.shift();
        }

        drawZoomGraph();
    }

    updateMotionStatsDisplay();

    // Set timeout for motion end
    clearTimeout(motionEndTimeout);
    motionEndTimeout = setTimeout(() => {
        // Check if we're in inertia (small continuing movements)
        updateMotionStatus('inertia');

        // Another timeout for actual end
        motionEndTimeout = setTimeout(() => {
            endMotion();
        }, MOTION_END_DELAY);
    }, MOTION_END_DELAY);
}

// Update motion type display
function updateMotionTypeDisplay(type) {
    if (!graphMotionType) return;

    graphMotionType.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    graphMotionType.className = 'motion-value ' + type;
}

// Update motion status display
function updateMotionStatus(status) {
    if (!graphMotionStatus) return;

    graphMotionStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    graphMotionStatus.className = 'status-value ' + status;
}

// Update motion stats display
function updateMotionStatsDisplay() {
    if (graphMoveX) graphMoveX.textContent = Math.round(currentMotion.moveX);
    if (graphMoveY) graphMoveY.textContent = Math.round(currentMotion.moveY);
    if (graphScrollX) graphScrollX.textContent = Math.round(currentMotion.scrollX);
    if (graphScrollY) graphScrollY.textContent = Math.round(currentMotion.scrollY);
    if (graphZoomValue) graphZoomValue.textContent = currentMotion.zoomLevel.toFixed(2);
    if (graphDuration) {
        const duration = isMotionActive ? Date.now() - currentMotion.startTime : 0;
        graphDuration.textContent = duration + 'ms';
    }
}

// Draw scroll Y graph (vertical scroll)
function drawScrollYGraph() {
    if (!scrollYGraphCtx || !scrollYGraphCanvas) return;

    const width = scrollYGraphCanvas.width;
    const height = scrollYGraphCanvas.height;
    const ctx = scrollYGraphCtx;
    const leftMargin = 45; // Space for Y-axis labels

    // Clear canvas completely (prevents ghost effect)
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, width, height);

    if (scrollGraphData.length < 2) {
        // Draw placeholder text
        ctx.fillStyle = '#666';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Scroll to see data', width / 2, height / 2);
        return;
    }

    // Find data range
    const maxTime = scrollGraphData[scrollGraphData.length - 1].time;
    const minTime = scrollGraphData[0].time;
    const timeRange = maxTime - minTime || 1;

    let maxDelta = 1;
    scrollGraphData.forEach(d => {
        maxDelta = Math.max(maxDelta, Math.abs(d.deltaY));
    });

    // Scale factor
    const graphWidth = width - leftMargin;
    const xScale = graphWidth / timeRange;
    const yScale = (height / 2 - 20) / maxDelta;

    // Draw Y-axis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftMargin, 10);
    ctx.lineTo(leftMargin, height - 20);
    ctx.stroke();

    // Draw Y-axis labels and grid lines
    ctx.fillStyle = '#888';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'right';

    // Center line (0)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(leftMargin, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.fillText('0', leftMargin - 5, height / 2 + 3);

    // Positive max
    const topY = height / 2 - (height / 2 - 20);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(leftMargin, 20);
    ctx.lineTo(width, 20);
    ctx.stroke();
    ctx.fillText('+' + Math.round(maxDelta), leftMargin - 5, 23);

    // Negative max
    ctx.beginPath();
    ctx.moveTo(leftMargin, height - 20);
    ctx.lineTo(width, height - 20);
    ctx.stroke();
    ctx.fillText('-' + Math.round(maxDelta), leftMargin - 5, height - 17);

    // Mid-positive
    ctx.beginPath();
    ctx.moveTo(leftMargin, height / 4 + 5);
    ctx.lineTo(width, height / 4 + 5);
    ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.fillText('+' + Math.round(maxDelta / 2), leftMargin - 5, height / 4 + 8);

    // Mid-negative
    ctx.beginPath();
    ctx.moveTo(leftMargin, height * 3 / 4 - 5);
    ctx.lineTo(width, height * 3 / 4 - 5);
    ctx.stroke();
    ctx.fillText('-' + Math.round(maxDelta / 2), leftMargin - 5, height * 3 / 4 - 2);

    // Draw Y scroll line (vertical scroll)
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    ctx.beginPath();

    scrollGraphData.forEach((d, i) => {
        const x = leftMargin + (d.time - minTime) * xScale;
        const y = height / 2 - d.deltaY * yScale;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Draw time labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0ms', leftMargin + 5, height - 5);
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(timeRange) + 'ms', width - 5, height - 5);
}

// Draw scroll X graph (horizontal scroll)
function drawScrollXGraph() {
    if (!scrollXGraphCtx || !scrollXGraphCanvas) return;

    const width = scrollXGraphCanvas.width;
    const height = scrollXGraphCanvas.height;
    const ctx = scrollXGraphCtx;
    const leftMargin = 45; // Space for Y-axis labels

    // Clear canvas completely (prevents ghost effect)
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, width, height);

    if (scrollGraphData.length < 2) {
        // Draw placeholder text
        ctx.fillStyle = '#666';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Scroll to see data', width / 2, height / 2);
        return;
    }

    // Find data range
    const maxTime = scrollGraphData[scrollGraphData.length - 1].time;
    const minTime = scrollGraphData[0].time;
    const timeRange = maxTime - minTime || 1;

    let maxDelta = 1;
    scrollGraphData.forEach(d => {
        maxDelta = Math.max(maxDelta, Math.abs(d.deltaX));
    });

    // Scale factor
    const graphWidth = width - leftMargin;
    const xScale = graphWidth / timeRange;
    const yScale = (height / 2 - 20) / maxDelta;

    // Draw Y-axis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftMargin, 10);
    ctx.lineTo(leftMargin, height - 20);
    ctx.stroke();

    // Draw Y-axis labels and grid lines
    ctx.fillStyle = '#888';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'right';

    // Center line (0)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(leftMargin, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.fillText('0', leftMargin - 5, height / 2 + 3);

    // Positive max
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(leftMargin, 20);
    ctx.lineTo(width, 20);
    ctx.stroke();
    ctx.fillText('+' + Math.round(maxDelta), leftMargin - 5, 23);

    // Negative max
    ctx.beginPath();
    ctx.moveTo(leftMargin, height - 20);
    ctx.lineTo(width, height - 20);
    ctx.stroke();
    ctx.fillText('-' + Math.round(maxDelta), leftMargin - 5, height - 17);

    // Mid-positive
    ctx.beginPath();
    ctx.moveTo(leftMargin, height / 4 + 5);
    ctx.lineTo(width, height / 4 + 5);
    ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.fillText('+' + Math.round(maxDelta / 2), leftMargin - 5, height / 4 + 8);

    // Mid-negative
    ctx.beginPath();
    ctx.moveTo(leftMargin, height * 3 / 4 - 5);
    ctx.lineTo(width, height * 3 / 4 - 5);
    ctx.stroke();
    ctx.fillText('-' + Math.round(maxDelta / 2), leftMargin - 5, height * 3 / 4 - 2);

    // Draw X scroll line (horizontal scroll)
    ctx.strokeStyle = '#26c6da';
    ctx.lineWidth = 2;
    ctx.beginPath();

    scrollGraphData.forEach((d, i) => {
        const x = leftMargin + (d.time - minTime) * xScale;
        const y = height / 2 - d.deltaX * yScale;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Draw time labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0ms', leftMargin + 5, height - 5);
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(timeRange) + 'ms', width - 5, height - 5);
}

// Draw zoom graph
function drawZoomGraph() {
    if (!zoomGraphCtx || !zoomGraphCanvas) return;

    const width = zoomGraphCanvas.width;
    const height = zoomGraphCanvas.height;
    const ctx = zoomGraphCtx;

    // Clear canvas completely (prevents ghost effect)
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, width, height);

    if (zoomGraphData.length < 2) {
        // Draw placeholder text
        ctx.fillStyle = '#666';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Pinch to zoom to see data', width / 2, height / 2);
        return;
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // 1.0 baseline
    const baselineY = height * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(width, baselineY);
    ctx.stroke();

    // Find data range
    const maxTime = zoomGraphData[zoomGraphData.length - 1].time;
    const minTime = zoomGraphData[0].time;
    const timeRange = maxTime - minTime || 1;

    let minLevel = 1, maxLevel = 1;
    zoomGraphData.forEach(d => {
        minLevel = Math.min(minLevel, d.level);
        maxLevel = Math.max(maxLevel, d.level);
    });

    const levelRange = Math.max(maxLevel - minLevel, 0.5);

    // Draw y-axis labels with better visibility
    const leftMargin = 45;
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 12px Consolas, monospace';
    ctx.textAlign = 'right';

    // Draw "1.0x" baseline label
    ctx.fillText('1.0x', leftMargin - 5, baselineY + 4);

    // Draw max zoom label
    const maxZoomY = 20;
    ctx.fillText(maxLevel.toFixed(1) + 'x', leftMargin - 5, maxZoomY + 4);

    // Draw min zoom label
    const minZoomY = height - 25;
    ctx.fillText(minLevel.toFixed(1) + 'x', leftMargin - 5, minZoomY + 4);

    // Draw intermediate labels if range is large enough
    if (levelRange > 0.5) {
        const midHighLevel = 1 + (maxLevel - 1) / 2;
        const midLowLevel = 1 - (1 - minLevel) / 2;

        if (maxLevel > 1.2) {
            const midHighY = baselineY - (baselineY - maxZoomY) / 2;
            ctx.fillStyle = '#888';
            ctx.fillText(midHighLevel.toFixed(1) + 'x', leftMargin - 5, midHighY + 4);
        }

        if (minLevel < 0.8) {
            const midLowY = baselineY + (minZoomY - baselineY) / 2;
            ctx.fillStyle = '#888';
            ctx.fillText(midLowLevel.toFixed(1) + 'x', leftMargin - 5, midLowY + 4);
        }
    }

    // Draw vertical axis line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftMargin, 10);
    ctx.lineTo(leftMargin, height - 20);
    ctx.stroke();

    // Scale factor
    const xScale = (width - leftMargin) / timeRange;
    const yScale = (height - 40) / levelRange;

    // Draw zoom level line
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2;
    ctx.beginPath();

    zoomGraphData.forEach((d, i) => {
        const x = leftMargin + (d.time - minTime) * xScale;
        const y = height - 20 - (d.level - minLevel) * yScale;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Draw time labels
    ctx.fillStyle = '#888';
    ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0ms', leftMargin + 5, height - 5);
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(timeRange) + 'ms', width - 5, height - 5);
}

// Add motion to history
function addMotionToHistory(motion, duration) {
    if (!motionHistoryList) return;

    const historyItem = {
        type: motion.type,
        moveX: motion.moveX,
        moveY: motion.moveY,
        scrollX: motion.scrollX,
        scrollY: motion.scrollY,
        zoomLevel: motion.zoomLevel,
        duration: duration,
        time: new Date()
    };

    motionHistory.unshift(historyItem);
    if (motionHistory.length > MAX_HISTORY_ITEMS) {
        motionHistory.pop();
    }

    renderMotionHistory();
}

// Render motion history
function renderMotionHistory() {
    if (!motionHistoryList) return;

    if (motionHistory.length === 0) {
        motionHistoryList.innerHTML = '<div class="history-placeholder">No motions recorded yet</div>';
        return;
    }

    motionHistoryList.innerHTML = motionHistory.map(item => {
        let valuesStr = '';
        if (item.type === 'move') {
            valuesStr = `X: ${Math.round(item.moveX)}, Y: ${Math.round(item.moveY)}`;
        } else if (item.type === 'scroll') {
            valuesStr = `X: ${Math.round(item.scrollX)}, Y: ${Math.round(item.scrollY)}`;
        } else if (item.type === 'zoom') {
            valuesStr = `Level: ${item.zoomLevel.toFixed(2)}`;
        }

        const timeStr = item.time.toLocaleTimeString();

        return `
            <div class="history-item">
                <span class="history-type ${item.type}">${item.type}</span>
                <span class="history-values">${valuesStr}</span>
                <span class="history-duration">${item.duration}ms</span>
                <span class="history-time">${timeStr}</span>
            </div>
        `;
    }).join('');
}

// Clear graphs
function clearGraphs() {
    scrollGraphData = [];
    zoomGraphData = [];
    graphStartTime = Date.now();

    currentMotion = {
        type: 'none',
        startTime: 0,
        moveX: 0,
        moveY: 0,
        scrollX: 0,
        scrollY: 0,
        zoomDelta: 0,
        zoomLevel: 1.0
    };

    updateMotionStatsDisplay();
    updateMotionTypeDisplay('none');
    updateMotionStatus('idle');

    drawScrollYGraph();
    drawScrollXGraph();
    drawZoomGraph();
}

// Export data as JSON
function exportGraphData() {
    const data = {
        exportTime: new Date().toISOString(),
        scrollData: scrollGraphData,
        zoomData: zoomGraphData,
        history: motionHistory.map(h => ({
            ...h,
            time: h.time.toISOString()
        }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `motion-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Event listeners for Graph View buttons
if (clearGraphsBtn) {
    clearGraphsBtn.addEventListener('click', clearGraphs);
}

if (exportDataBtn) {
    exportDataBtn.addEventListener('click', exportGraphData);
}

// Graph View wheel event handler (prevents actual scroll, captures data)
if (graphView) {
    graphView.addEventListener('wheel', (e) => {
        if (!isGraphModeActive()) return;

        e.preventDefault(); // Prevent page scroll

        if (e.ctrlKey) {
            // Zoom gesture
            const delta = -e.deltaY * ZOOM_SENSITIVITY;

            // Check if this is a new zoom motion (not active or different type)
            // If so, start from 1.0, otherwise continue from current level
            const baseLevel = (!isMotionActive || currentMotion.type !== 'zoom') ? 1.0 : currentMotion.zoomLevel;
            const newLevel = Math.max(0.1, Math.min(5.0, baseLevel + delta));

            updateMotion('zoom', {
                delta: delta,
                level: newLevel
            });
        } else {
            // Scroll gesture
            updateMotion('scroll', {
                deltaX: e.deltaX,
                deltaY: e.deltaY
            });
        }
    }, { passive: false });

    // Mouse move handler - tracks ALL cursor movement (not just when button is down)
    let lastGraphMouseX = null;
    let lastGraphMouseY = null;
    let isGraphMouseTracking = false;

    graphView.addEventListener('mouseenter', (e) => {
        if (!isGraphModeActive()) return;
        // Initialize position when mouse enters
        lastGraphMouseX = e.clientX;
        lastGraphMouseY = e.clientY;
        isGraphMouseTracking = true;
    });

    graphView.addEventListener('mousemove', (e) => {
        if (!isGraphModeActive()) return;

        // Track all cursor movement regardless of button state
        if (isGraphMouseTracking && lastGraphMouseX !== null && lastGraphMouseY !== null) {
            const deltaX = e.clientX - lastGraphMouseX;
            const deltaY = e.clientY - lastGraphMouseY;

            // Only report if there's actual movement
            if (deltaX !== 0 || deltaY !== 0) {
                updateMotion('move', {
                    deltaX: deltaX,
                    deltaY: deltaY
                });
            }
        }

        lastGraphMouseX = e.clientX;
        lastGraphMouseY = e.clientY;
    });

    graphView.addEventListener('mouseleave', () => {
        isGraphMouseTracking = false;
        lastGraphMouseX = null;
        lastGraphMouseY = null;
    });

    // Touch handlers for mobile/touch devices
    let lastGraphTouchX = 0;
    let lastGraphTouchY = 0;
    let graphTouchStartDist = 0;

    graphView.addEventListener('touchstart', (e) => {
        if (!isGraphModeActive()) return;

        if (e.touches.length === 1) {
            lastGraphTouchX = e.touches[0].clientX;
            lastGraphTouchY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            // Pinch start
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            graphTouchStartDist = Math.sqrt(dx * dx + dy * dy);
        }
    }, { passive: true });

    graphView.addEventListener('touchmove', (e) => {
        if (!isGraphModeActive()) return;

        e.preventDefault(); // Prevent actual scrolling

        if (e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - lastGraphTouchX;
            const deltaY = e.touches[0].clientY - lastGraphTouchY;

            // Treat single finger swipe as scroll
            updateMotion('scroll', {
                deltaX: -deltaX,
                deltaY: -deltaY
            });

            lastGraphTouchX = e.touches[0].clientX;
            lastGraphTouchY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            // Pinch zoom
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const scaleDelta = (dist - graphTouchStartDist) * 0.01;

            // Check if this is a new zoom motion - if so, start from 1.0
            const baseLevel = (!isMotionActive || currentMotion.type !== 'zoom') ? 1.0 : currentMotion.zoomLevel;
            const newLevel = Math.max(0.1, Math.min(5.0, baseLevel + scaleDelta));

            updateMotion('zoom', {
                delta: scaleDelta,
                level: newLevel
            });

            graphTouchStartDist = dist;
        }
    }, { passive: false });
}

// Initialize graph view when tab is activated
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === 'graph') {
            setTimeout(() => {
                initGraphCanvases();
                drawScrollYGraph();
                drawScrollXGraph();
                drawZoomGraph();
            }, 50);
        }
        if (tab === 'shapes') {
            setTimeout(() => {
                initShapesCanvas();
                drawShapesCanvas();
            }, 50);
        }
    });
});

// ==================== //
// Shape Tests          //
// ==================== //

const shapesView = document.getElementById('shapes-view');
const shapesCanvas = document.getElementById('shapes-canvas');
const shapesCtx = shapesCanvas ? shapesCanvas.getContext('2d') : null;

// Shape Test DOM elements
const shapeOffsetX = document.getElementById('shape-offset-x');
const shapeOffsetY = document.getElementById('shape-offset-y');
const shapeOffsetDist = document.getElementById('shape-offset-dist');
const shapeTestState = document.getElementById('shape-test-state');
const shapeProgress = document.getElementById('shape-progress');
const shapeInstruction = document.getElementById('shape-instruction');
const shapeResults = document.getElementById('shape-results');
const resultAvgOffset = document.getElementById('result-avg-offset');
const resultMaxOffset = document.getElementById('result-max-offset');
const resultAccuracy = document.getElementById('result-accuracy');
const resetShapeTestBtn = document.getElementById('reset-shape-test');
const shapeBtns = document.querySelectorAll('.shape-btn');

// Shape Test State
const SHAPE_SIZE = 200; // Fixed size for shapes
let currentShape = 'circle';
let shapeTestActive = false;
let shapeTestCompleted = false;
let shapeStartPoint = { x: 0, y: 0 };
let shapeCenter = { x: 0, y: 0 };

// History State
const MAX_SHAPE_HISTORY_ITEMS = 10;
let shapeHistory = []; // Array of { shape, userPath, expectedPath, avgOffset, maxOffset, accuracy, timestamp }
let selectedHistoryIndex = -1; // -1 means showing current test, >= 0 means showing history item
let userPath = [];
let expectedPath = [];
let offsetHistory = []; // Array of { x, y, distance } objects
let currentPathIndex = 0;
let maxPathIndexReached = 0; // Track the furthest point reached (to prevent jumping back to start)
let hasPassedHalfway = false; // Track if user has gone past halfway point

function isShapesModeActive() {
    return shapesView && shapesView.classList.contains('active');
}

// Initialize shapes canvas
function initShapesCanvas() {
    if (!shapesCanvas) return;
    const container = shapesCanvas.parentElement;
    shapesCanvas.width = container.clientWidth;
    shapesCanvas.height = container.clientHeight;
    drawShapesCanvas();
}

// Resize observer for shapes canvas
const shapesResizeObserver = new ResizeObserver(() => {
    if (isShapesModeActive()) {
        initShapesCanvas();
    }
});

if (shapesCanvas && shapesCanvas.parentElement) {
    shapesResizeObserver.observe(shapesCanvas.parentElement);
}

// Shape button selection
shapeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (shapeTestActive) return; // Don't change shape during test

        shapeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentShape = btn.dataset.shape;
        resetShapeTest();
    });
});

// Generate expected path points for each shape
function generateExpectedPath(startX, startY) {
    const path = [];
    const numPoints = 100;

    switch (currentShape) {
        case 'circle':
            // Generate a 330° arc (not full circle) so start and end are physically separated
            // This prevents accidental completion when moving in the wrong direction
            // Start at angle 0 (rightmost point), end at 330° (30° before completing)
            const arcAngle = (330 / 360) * Math.PI * 2; // 330 degrees in radians
            shapeCenter = { x: startX - (SHAPE_SIZE / 2), y: startY };
            for (let i = 0; i <= numPoints; i++) {
                const angle = (i / numPoints) * arcAngle;
                path.push({
                    x: shapeCenter.x + Math.cos(angle) * (SHAPE_SIZE / 2),
                    y: shapeCenter.y + Math.sin(angle) * (SHAPE_SIZE / 2)
                });
            }
            break;

        case 'horizontal':
            for (let i = 0; i <= numPoints; i++) {
                path.push({
                    x: startX + (i / numPoints) * SHAPE_SIZE,
                    y: startY
                });
            }
            break;

        case 'vertical':
            for (let i = 0; i <= numPoints; i++) {
                path.push({
                    x: startX,
                    y: startY + (i / numPoints) * SHAPE_SIZE
                });
            }
            break;

        case 'diagonal-up':
            for (let i = 0; i <= numPoints; i++) {
                path.push({
                    x: startX + (i / numPoints) * SHAPE_SIZE,
                    y: startY - (i / numPoints) * SHAPE_SIZE
                });
            }
            break;

        case 'diagonal-down':
            for (let i = 0; i <= numPoints; i++) {
                path.push({
                    x: startX + (i / numPoints) * SHAPE_SIZE,
                    y: startY + (i / numPoints) * SHAPE_SIZE
                });
            }
            break;
    }

    return path;
}

// Find closest point on expected path and calculate offset
function calculateOffset(userX, userY) {
    if (expectedPath.length === 0) return { offsetX: 0, offsetY: 0, distance: 0, pathIndex: 0 };

    let minDist = Infinity;
    let closestIndex = 0;
    let closestPoint = expectedPath[0];

    // Search from current index forward (with some look-back)
    const searchStart = Math.max(0, currentPathIndex - 5);
    const searchEnd = Math.min(expectedPath.length - 1, currentPathIndex + 30);

    for (let i = searchStart; i <= searchEnd; i++) {
        const point = expectedPath[i];
        const dist = Math.sqrt(Math.pow(userX - point.x, 2) + Math.pow(userY - point.y, 2));
        if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
            closestPoint = point;
        }
    }

    // Also check the entire path for better accuracy
    for (let i = 0; i < expectedPath.length; i++) {
        const point = expectedPath[i];
        const dist = Math.sqrt(Math.pow(userX - point.x, 2) + Math.pow(userY - point.y, 2));
        if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
            closestPoint = point;
        }
    }

    return {
        offsetX: userX - closestPoint.x,
        offsetY: userY - closestPoint.y,
        distance: minDist,
        pathIndex: closestIndex
    };
}

// Draw valid start region indicator
function drawValidStartRegion(ctx) {
    const bounds = getValidStartBounds();
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    // Draw the invalid (grayed out) regions
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';

    // Top region
    ctx.fillRect(0, 0, shapesCanvas.width, bounds.minY);
    // Bottom region
    ctx.fillRect(0, bounds.maxY, shapesCanvas.width, shapesCanvas.height - bounds.maxY);
    // Left region
    ctx.fillRect(0, bounds.minY, bounds.minX, height);
    // Right region
    ctx.fillRect(bounds.maxX, bounds.minY, shapesCanvas.width - bounds.maxX, height);

    // Draw valid region border
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(bounds.minX, bounds.minY, width, height);
    ctx.setLineDash([]);
}

// Draw a preview of the current shape
function drawShapePreview(ctx, centerX, centerY) {
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.2)';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.setLineDash([]);

    const halfSize = SHAPE_SIZE / 2;

    switch (currentShape) {
        case 'circle':
            ctx.beginPath();
            ctx.arc(centerX - halfSize, centerY, halfSize, 0, Math.PI * 2);
            ctx.stroke();
            // Draw start indicator
            ctx.fillStyle = 'rgba(76, 175, 80, 0.5)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'horizontal':
            ctx.beginPath();
            ctx.moveTo(centerX - halfSize, centerY);
            ctx.lineTo(centerX + halfSize, centerY);
            ctx.stroke();
            // Start dot
            ctx.fillStyle = 'rgba(76, 175, 80, 0.5)';
            ctx.beginPath();
            ctx.arc(centerX - halfSize, centerY, 8, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'vertical':
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - halfSize);
            ctx.lineTo(centerX, centerY + halfSize);
            ctx.stroke();
            // Start dot
            ctx.fillStyle = 'rgba(76, 175, 80, 0.5)';
            ctx.beginPath();
            ctx.arc(centerX, centerY - halfSize, 8, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'diagonal-up':
            // Diagonal up (↗): start bottom-left, end top-right
            ctx.beginPath();
            ctx.moveTo(centerX - halfSize, centerY + halfSize);
            ctx.lineTo(centerX + halfSize, centerY - halfSize);
            ctx.stroke();
            // Start dot
            ctx.fillStyle = 'rgba(76, 175, 80, 0.5)';
            ctx.beginPath();
            ctx.arc(centerX - halfSize, centerY + halfSize, 8, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'diagonal-down':
            // Diagonal down (↘): start top-left, end bottom-right
            ctx.beginPath();
            ctx.moveTo(centerX - halfSize, centerY - halfSize);
            ctx.lineTo(centerX + halfSize, centerY + halfSize);
            ctx.stroke();
            // Start dot
            ctx.fillStyle = 'rgba(76, 175, 80, 0.5)';
            ctx.beginPath();
            ctx.arc(centerX - halfSize, centerY - halfSize, 8, 0, Math.PI * 2);
            ctx.fill();
            break;
    }
}

// Draw the shapes canvas
function drawShapesCanvas() {
    if (!shapesCtx || !shapesCanvas) return;

    const ctx = shapesCtx;
    const width = shapesCanvas.width;
    const height = shapesCanvas.height;

    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw valid start region when no test is active
    if (!shapeTestActive && !shapeTestCompleted) {
        drawValidStartRegion(ctx);
    }

    // Draw guide path (semi-transparent) - show during tracing AND after completion
    if ((shapeTestActive || shapeTestCompleted) && expectedPath.length > 0) {
        ctx.strokeStyle = 'rgba(100, 100, 255, 0.3)';
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        expectedPath.forEach((point, i) => {
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });

        ctx.stroke();

        // For circle shape, draw the full circle guide on top (so it looks complete)
        if (currentShape === 'circle' && shapeCenter) {
            ctx.strokeStyle = 'rgba(100, 100, 255, 0.3)';
            ctx.lineWidth = 20;
            ctx.beginPath();
            ctx.arc(shapeCenter.x, shapeCenter.y, SHAPE_SIZE / 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw start point marker
        ctx.fillStyle = 'rgba(76, 175, 80, 0.8)';
        ctx.beginPath();
        ctx.arc(expectedPath[0].x, expectedPath[0].y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', expectedPath[0].x, expectedPath[0].y);

        // Draw end point marker (always show, including for circle)
        const endPoint = expectedPath[expectedPath.length - 1];
        ctx.fillStyle = 'rgba(244, 67, 54, 0.8)';
        ctx.beginPath();
        ctx.arc(endPoint.x, endPoint.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText('E', endPoint.x, endPoint.y);
    }

    // Draw user path in black (during tracing AND after completion)
    if ((shapeTestActive || shapeTestCompleted) && userPath.length > 1) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        userPath.forEach((point, i) => {
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.stroke();
    }

    // Draw instruction text in center when not active
    if (!shapeTestActive && !shapeTestCompleted) {
        ctx.fillStyle = '#999';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Click anywhere to start the test', width / 2, height / 2);
    }
}

// Update offset display (both sidebar and header)
function updateOffsetDisplay(offsetX, offsetY, distance) {
    // Determine which components are relevant based on shape
    const showX = currentShape !== 'horizontal';
    const showY = currentShape !== 'vertical';
    const showDist = currentShape !== 'horizontal' && currentShape !== 'vertical';

    // Update sidebar elements
    if (shapeOffsetX) {
        shapeOffsetX.textContent = Math.round(offsetX);
        shapeOffsetX.className = 'offset-value' + (Math.abs(offsetX) > 20 ? ' warning' : '') + (Math.abs(offsetX) > 50 ? ' error' : '');
    }
    if (shapeOffsetY) {
        shapeOffsetY.textContent = Math.round(offsetY);
        shapeOffsetY.className = 'offset-value' + (Math.abs(offsetY) > 20 ? ' warning' : '') + (Math.abs(offsetY) > 50 ? ' error' : '');
    }
    if (shapeOffsetDist) {
        shapeOffsetDist.textContent = Math.round(distance);
        shapeOffsetDist.className = 'offset-value' + (distance > 20 ? ' warning' : '') + (distance > 50 ? ' error' : '');
    }

    // Update header current offset elements
    const headerOffsetX = document.getElementById('header-offset-x');
    const headerOffsetY = document.getElementById('header-offset-y');
    const headerOffsetDist = document.getElementById('header-offset-dist');

    if (headerOffsetX) {
        headerOffsetX.textContent = showX ? Math.round(offsetX) : '-';
        headerOffsetX.className = 'header-stat-value' + (showX && Math.abs(offsetX) > 20 ? ' warning' : '') + (showX && Math.abs(offsetX) > 50 ? ' error' : '');
        headerOffsetX.style.opacity = showX ? '1' : '0.3';
    }
    if (headerOffsetY) {
        headerOffsetY.textContent = showY ? Math.round(offsetY) : '-';
        headerOffsetY.className = 'header-stat-value' + (showY && Math.abs(offsetY) > 20 ? ' warning' : '') + (showY && Math.abs(offsetY) > 50 ? ' error' : '');
        headerOffsetY.style.opacity = showY ? '1' : '0.3';
    }
    if (headerOffsetDist) {
        headerOffsetDist.textContent = showDist ? Math.round(distance) : '-';
        headerOffsetDist.className = 'header-stat-value' + (showDist && distance > 20 ? ' warning' : '') + (showDist && distance > 50 ? ' error' : '');
        headerOffsetDist.style.opacity = showDist ? '1' : '0.3';
    }

    // Update header running average
    updateRunningAverage();
}

// Update running average display
function updateRunningAverage() {
    const len = offsetHistory.length;
    if (len === 0) {
        return;
    }

    // Calculate running averages
    const avgX = offsetHistory.reduce((sum, o) => sum + Math.abs(o.x), 0) / len;
    const avgY = offsetHistory.reduce((sum, o) => sum + Math.abs(o.y), 0) / len;
    const avgDist = offsetHistory.reduce((sum, o) => sum + o.distance, 0) / len;

    // Determine which components are relevant based on shape
    const showX = currentShape !== 'horizontal';
    const showY = currentShape !== 'vertical';
    const showDist = currentShape !== 'horizontal' && currentShape !== 'vertical';

    // Update header average elements
    const headerAvgX = document.getElementById('header-avg-x');
    const headerAvgY = document.getElementById('header-avg-y');
    const headerAvgDist = document.getElementById('header-avg-dist');

    if (headerAvgX) {
        headerAvgX.textContent = showX ? avgX.toFixed(1) : '-';
        headerAvgX.className = 'header-stat-value' + (showX && avgX > 20 ? ' warning' : '') + (showX && avgX > 50 ? ' error' : '');
        headerAvgX.style.opacity = showX ? '1' : '0.3';
    }
    if (headerAvgY) {
        headerAvgY.textContent = showY ? avgY.toFixed(1) : '-';
        headerAvgY.className = 'header-stat-value' + (showY && avgY > 20 ? ' warning' : '') + (showY && avgY > 50 ? ' error' : '');
        headerAvgY.style.opacity = showY ? '1' : '0.3';
    }
    if (headerAvgDist) {
        headerAvgDist.textContent = showDist ? avgDist.toFixed(1) : '-';
        headerAvgDist.className = 'header-stat-value' + (showDist && avgDist > 20 ? ' warning' : '') + (showDist && avgDist > 50 ? ' error' : '');
        headerAvgDist.style.opacity = showDist ? '1' : '0.3';
    }
}

// Update progress display (both sidebar and header)
function updateProgress() {
    const progress = Math.min(100, Math.round((currentPathIndex / (expectedPath.length - 1)) * 100));

    // Update sidebar
    if (shapeProgress) {
        shapeProgress.textContent = progress + '%';
    }

    // Update header
    const headerProgress = document.getElementById('header-progress');
    if (headerProgress) {
        headerProgress.textContent = progress + '%';
    }
}

// Update test state (both sidebar and header)
function updateTestState(state, label) {
    // Update sidebar
    if (shapeTestState) {
        shapeTestState.textContent = label;
        shapeTestState.className = 'status-badge ' + state;
    }

    // Update header
    const headerState = document.getElementById('header-test-state');
    if (headerState) {
        headerState.textContent = label;
        headerState.className = 'header-status-badge ' + state;
    }
}

// Update results (both sidebar and header)
function updateResults(results) {
    const shape = results.shape || currentShape;

    // Determine which components to show based on shape
    // Horizontal: only Y matters
    // Vertical: only X matters
    // Others: show all
    const showX = shape !== 'horizontal';
    const showY = shape !== 'vertical';
    const showCombined = shape !== 'horizontal' && shape !== 'vertical';

    // Update sidebar with detailed X, Y breakdown
    const avgXEl = document.getElementById('result-avg-x');
    const avgYEl = document.getElementById('result-avg-y');
    const avgCombEl = document.getElementById('result-avg-combined');
    const maxXEl = document.getElementById('result-max-x');
    const maxYEl = document.getElementById('result-max-y');
    const maxCombEl = document.getElementById('result-max-combined');

    if (avgXEl) {
        avgXEl.textContent = showX ? results.avgX.toFixed(1) + 'px' : '-';
        avgXEl.style.opacity = showX ? '1' : '0.3';
    }
    if (avgYEl) {
        avgYEl.textContent = showY ? results.avgY.toFixed(1) + 'px' : '-';
        avgYEl.style.opacity = showY ? '1' : '0.3';
    }
    if (avgCombEl) {
        avgCombEl.textContent = showCombined ? results.avgCombined.toFixed(1) + 'px' : '-';
        avgCombEl.style.opacity = showCombined ? '1' : '0.3';
    }
    if (maxXEl) {
        maxXEl.textContent = showX ? results.maxX.toFixed(1) + 'px' : '-';
        maxXEl.style.opacity = showX ? '1' : '0.3';
    }
    if (maxYEl) {
        maxYEl.textContent = showY ? results.maxY.toFixed(1) + 'px' : '-';
        maxYEl.style.opacity = showY ? '1' : '0.3';
    }
    if (maxCombEl) {
        maxCombEl.textContent = showCombined ? results.maxCombined.toFixed(1) + 'px' : '-';
        maxCombEl.style.opacity = showCombined ? '1' : '0.3';
    }
    if (resultAccuracy) resultAccuracy.textContent = results.accuracy.toFixed(0) + '%';
    if (shapeResults) shapeResults.classList.remove('hidden');

    // Update header - show relevant average
    const headerResults = document.getElementById('header-results');
    const headerAvg = document.getElementById('header-result-avg');
    const headerMax = document.getElementById('header-result-max');
    const headerAcc = document.getElementById('header-result-acc');

    // Use relevant values for header display
    const relevantAvg = results.relevantAvg !== undefined ? results.relevantAvg : results.avgCombined;
    const relevantMax = results.relevantMax !== undefined ? results.relevantMax : results.maxCombined;

    if (headerAvg) headerAvg.textContent = relevantAvg.toFixed(1) + 'px';
    if (headerMax) headerMax.textContent = relevantMax.toFixed(1) + 'px';
    if (headerAcc) headerAcc.textContent = results.accuracy.toFixed(0) + '%';
    if (headerResults) headerResults.classList.remove('hidden');
}

// Save attempt to history
function saveToHistory(results) {
    const attempt = {
        shape: currentShape,
        userPath: [...userPath],
        expectedPath: [...expectedPath],
        shapeCenter: shapeCenter ? { ...shapeCenter } : null,
        results: results,
        timestamp: Date.now()
    };

    // Add to beginning of history
    shapeHistory.unshift(attempt);

    // Keep only last MAX_SHAPE_HISTORY_ITEMS
    if (shapeHistory.length > MAX_SHAPE_HISTORY_ITEMS) {
        shapeHistory.pop();
    }

    // Render history list
    renderHistoryList();
}

// Get shape icon
function getShapeIcon(shape) {
    const icons = {
        'circle': '⭕',
        'horizontal': '↔️',
        'vertical': '↕️',
        'diagonal-up': '↗️',
        'diagonal-down': '↘️'
    };
    return icons[shape] || '📐';
}

// Get shape display name
function getShapeDisplayName(shape) {
    const names = {
        'circle': 'Circle',
        'horizontal': 'Horizontal',
        'vertical': 'Vertical',
        'diagonal-up': 'Diagonal ↗',
        'diagonal-down': 'Diagonal ↘'
    };
    return names[shape] || shape;
}

// Get accuracy class
function getAccuracyClass(accuracy) {
    if (accuracy >= 90) return 'excellent';
    if (accuracy >= 70) return 'good';
    if (accuracy >= 50) return 'fair';
    return 'poor';
}

// Format time ago
function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}

// Render history list
function renderHistoryList() {
    const historyList = document.getElementById('shape-history-list');
    if (!historyList) return;

    if (shapeHistory.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No attempts yet</div>';
        return;
    }

    historyList.innerHTML = shapeHistory.map((item, index) => `
        <div class="history-item ${selectedHistoryIndex === index ? 'selected' : ''}" data-index="${index}">
            <span class="history-shape-icon">${getShapeIcon(item.shape)}</span>
            <div class="history-info">
                <span class="history-shape-name">${getShapeDisplayName(item.shape)}</span>
                <span class="history-accuracy ${getAccuracyClass(item.results.accuracy)}">${item.results.accuracy.toFixed(0)}% accuracy</span>
            </div>
            <span class="history-time">${formatTimeAgo(item.timestamp)}</span>
        </div>
    `).join('');

    // Add click listeners
    historyList.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            selectHistoryItem(index);
        });
    });
}

// Select history item to display
function selectHistoryItem(index) {
    selectedHistoryIndex = index;
    renderHistoryList();

    const item = shapeHistory[index];
    if (!item) return;

    // Update results using the new format
    updateResults(item.results);
    updateTestState('completed', 'Viewing');

    // Draw the historical paths
    drawHistoricalPaths(item);
}

// Draw historical paths on canvas
function drawHistoricalPaths(historyItem) {
    if (!shapesCanvas || !shapesCtx) return;

    const ctx = shapesCtx;
    ctx.clearRect(0, 0, shapesCanvas.width, shapesCanvas.height);

    const expPath = historyItem.expectedPath;
    const usrPath = historyItem.userPath;

    if (expPath.length < 2) return;

    // Draw expected path (guide)
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.4)';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(expPath[0].x, expPath[0].y);
    for (let i = 1; i < expPath.length; i++) {
        ctx.lineTo(expPath[i].x, expPath[i].y);
    }
    ctx.stroke();

    // For circle, draw full circle guide
    if (historyItem.shape === 'circle' && historyItem.shapeCenter) {
        ctx.strokeStyle = 'rgba(100, 100, 255, 0.3)';
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.arc(historyItem.shapeCenter.x, historyItem.shapeCenter.y, SHAPE_SIZE / 2, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw start point
    ctx.fillStyle = 'rgba(76, 175, 80, 0.8)';
    ctx.beginPath();
    ctx.arc(expPath[0].x, expPath[0].y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', expPath[0].x, expPath[0].y);

    // Draw end point
    const endPoint = expPath[expPath.length - 1];
    ctx.fillStyle = 'rgba(244, 67, 54, 0.8)';
    ctx.beginPath();
    ctx.arc(endPoint.x, endPoint.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('E', endPoint.x, endPoint.y);

    // Draw user path
    if (usrPath.length >= 2) {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(usrPath[0].x, usrPath[0].y);
        for (let i = 1; i < usrPath.length; i++) {
            ctx.lineTo(usrPath[i].x, usrPath[i].y);
        }
        ctx.stroke();
    }
}

// Calculate valid start position bounds for each shape
function getValidStartBounds() {
    if (!shapesCanvas) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    const canvasWidth = shapesCanvas.width;
    const canvasHeight = shapesCanvas.height;
    const padding = 20; // Extra padding from edges
    const halfSize = SHAPE_SIZE / 2;
    const lineWidth = 10; // Account for stroke width

    let minX, minY, maxX, maxY;

    switch (currentShape) {
        case 'circle':
            // Circle: center is to the LEFT of start point by halfSize
            // So the circle extends from (startX - SHAPE_SIZE) to startX horizontally
            // and from (startY - halfSize) to (startY + halfSize) vertically
            minX = SHAPE_SIZE + padding + lineWidth; // Full diameter to the left of start
            maxX = canvasWidth - padding - lineWidth;
            minY = halfSize + padding + lineWidth;
            maxY = canvasHeight - halfSize - padding - lineWidth;
            break;
        case 'horizontal':
            // Horizontal: line extends to the RIGHT from start by SHAPE_SIZE
            minX = padding + lineWidth;
            maxX = canvasWidth - SHAPE_SIZE - padding - lineWidth;
            minY = padding + lineWidth;
            maxY = canvasHeight - padding - lineWidth;
            break;
        case 'vertical':
            // Vertical: line extends DOWN from start by SHAPE_SIZE
            minX = padding + lineWidth;
            maxX = canvasWidth - padding - lineWidth;
            minY = padding + lineWidth;
            maxY = canvasHeight - SHAPE_SIZE - padding - lineWidth;
            break;
        case 'diagonal-up':
            // Diagonal up (↗): line goes RIGHT by SHAPE_SIZE and UP by SHAPE_SIZE
            // Start is bottom-left, end is top-right
            minX = padding + lineWidth;
            maxX = canvasWidth - SHAPE_SIZE - padding - lineWidth;
            minY = SHAPE_SIZE + padding + lineWidth; // Need room above for the line going up
            maxY = canvasHeight - padding - lineWidth;
            break;
        case 'diagonal-down':
            // Diagonal down (↘): line goes RIGHT by SHAPE_SIZE and DOWN by SHAPE_SIZE
            // Start is top-left, end is bottom-right
            minX = padding + lineWidth;
            maxX = canvasWidth - SHAPE_SIZE - padding - lineWidth;
            minY = padding + lineWidth;
            maxY = canvasHeight - SHAPE_SIZE - padding - lineWidth; // Need room below
            break;
        default:
            minX = padding;
            maxX = canvasWidth - padding;
            minY = padding;
            maxY = canvasHeight - padding;
    }

    return { minX, minY, maxX, maxY };
}

// Clamp start position to valid bounds
function clampStartPosition(x, y) {
    const bounds = getValidStartBounds();
    return {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, y))
    };
}

// Start shape test
function startShapeTest(startX, startY) {
    // Clamp start position to ensure shape stays within canvas
    const clamped = clampStartPosition(startX, startY);
    startX = clamped.x;
    startY = clamped.y;

    shapeTestActive = true;
    shapeTestCompleted = false;
    shapeStartPoint = { x: startX, y: startY };
    userPath = [{ x: startX, y: startY }];
    offsetHistory = [];
    currentPathIndex = 0;
    maxPathIndexReached = 0;
    hasPassedHalfway = false;

    // Generate expected path
    expectedPath = generateExpectedPath(startX, startY);

    // Update UI - use helper functions for header updates
    updateTestState('tracing', 'Tracing');
    if (shapeInstruction) {
        shapeInstruction.textContent = 'Trace the highlighted path';
    }
    if (shapeResults) {
        shapeResults.classList.add('hidden');
    }
    // Hide header results too
    const headerResults = document.getElementById('header-results');
    if (headerResults) headerResults.classList.add('hidden');

    updateOffsetDisplay(0, 0, 0);
    updateProgress();
    drawShapesCanvas();
}

// Update shape test with new cursor position
function updateShapeTest(x, y) {
    if (!shapeTestActive) return;

    userPath.push({ x, y });

    // Calculate offset from expected path
    const offset = calculateOffset(x, y);
    offsetHistory.push({ x: offset.offsetX, y: offset.offsetY, distance: offset.distance });

    // Update current path index - only move forward, don't jump backwards
    // This prevents the circle from completing immediately by finding the end point
    if (offset.pathIndex > maxPathIndexReached) {
        maxPathIndexReached = offset.pathIndex;
        currentPathIndex = offset.pathIndex;
    }

    // Track if we've passed the halfway point
    if (maxPathIndexReached >= expectedPath.length / 2) {
        hasPassedHalfway = true;
    }

    updateOffsetDisplay(offset.offsetX, offset.offsetY, offset.distance);
    updateProgress();

    // Check for completion
    const progress = maxPathIndexReached / (expectedPath.length - 1);

    if (currentShape === 'circle') {
        // For circle: must have passed halfway AND be near the end point (330° arc end)
        if (hasPassedHalfway && progress >= 0.90) {
            const endPoint = expectedPath[expectedPath.length - 1];
            const distToEnd = Math.sqrt(
                Math.pow(x - endPoint.x, 2) +
                Math.pow(y - endPoint.y, 2)
            );
            if (distToEnd < 15) {
                completeShapeTest();
                return;
            }
        }
    } else {
        // For lines, complete when we reach near the end
        if (progress >= 0.95) {
            const endPoint = expectedPath[expectedPath.length - 1];
            const distToEnd = Math.sqrt(
                Math.pow(x - endPoint.x, 2) +
                Math.pow(y - endPoint.y, 2)
            );
            if (distToEnd < 15) {
                completeShapeTest();
                return;
            }
        }
    }

    drawShapesCanvas();
}

// Update progress display
function updateProgress() {
    if (!shapeProgress) return;

    const progress = Math.min(100, Math.round((maxPathIndexReached / (expectedPath.length - 1)) * 100));
    shapeProgress.textContent = progress + '%';

    // Update header progress
    const headerProgress = document.getElementById('header-progress');
    if (headerProgress) {
        headerProgress.textContent = progress + '%';
    }
}

// Complete shape test
function completeShapeTest() {
    shapeTestActive = false;
    shapeTestCompleted = true;

    // Calculate results - separate X, Y, and combined
    const len = offsetHistory.length;

    // X offset statistics
    const avgOffsetX = len > 0
        ? offsetHistory.reduce((sum, o) => sum + Math.abs(o.x), 0) / len
        : 0;
    const maxOffsetX = len > 0
        ? Math.max(...offsetHistory.map(o => Math.abs(o.x)))
        : 0;

    // Y offset statistics
    const avgOffsetY = len > 0
        ? offsetHistory.reduce((sum, o) => sum + Math.abs(o.y), 0) / len
        : 0;
    const maxOffsetY = len > 0
        ? Math.max(...offsetHistory.map(o => Math.abs(o.y)))
        : 0;

    // Combined (distance) statistics
    const avgOffset = len > 0
        ? offsetHistory.reduce((sum, o) => sum + o.distance, 0) / len
        : 0;
    const maxOffset = len > 0
        ? Math.max(...offsetHistory.map(o => o.distance))
        : 0;

    // Determine which offset to use for accuracy based on shape type
    // Horizontal line: only Y matters (deviation from straight horizontal)
    // Vertical line: only X matters (deviation from straight vertical)
    // Others: use combined distance
    let relevantAvg, relevantMax;
    if (currentShape === 'horizontal') {
        relevantAvg = avgOffsetY;
        relevantMax = maxOffsetY;
    } else if (currentShape === 'vertical') {
        relevantAvg = avgOffsetX;
        relevantMax = maxOffsetX;
    } else {
        relevantAvg = avgOffset;
        relevantMax = maxOffset;
    }

    // Calculate accuracy (100% = perfect, decreases with offset)
    const accuracy = Math.max(0, 100 - (relevantAvg * 2));

    // Create results object with shape-specific relevance flags
    const results = {
        shape: currentShape,
        avgX: avgOffsetX,
        maxX: maxOffsetX,
        avgY: avgOffsetY,
        maxY: maxOffsetY,
        avgCombined: avgOffset,
        maxCombined: maxOffset,
        relevantAvg: relevantAvg,
        relevantMax: relevantMax,
        accuracy: accuracy
    };

    // Save to history
    saveToHistory(results);

    // Update UI - use helper function for header
    updateTestState('completed', 'Complete');

    if (shapeInstruction) {
        shapeInstruction.textContent = 'Test complete! Click to start new test or press Reset';
    }
    if (shapeProgress) {
        shapeProgress.textContent = '100%';
    }

    // Update header progress
    const headerProgress = document.getElementById('header-progress');
    if (headerProgress) {
        headerProgress.textContent = '100%';
    }

    // Show results - use helper function
    updateResults(results);

    // Keep user path visible (don't clear it)
    drawShapesCanvas();
}

// Reset shape test
function resetShapeTest() {
    shapeTestActive = false;
    shapeTestCompleted = false;
    userPath = [];
    expectedPath = [];
    offsetHistory = [];
    currentPathIndex = 0;
    maxPathIndexReached = 0;
    hasPassedHalfway = false;

    // Clear history selection
    selectedHistoryIndex = -1;
    renderHistoryList();

    // Reset sidebar UI elements
    const instructionEl = document.getElementById('shape-instruction');
    const resultsEl = document.getElementById('shape-results');

    if (instructionEl) {
        instructionEl.textContent = 'Click anywhere to start the test';
    }
    if (resultsEl) {
        resultsEl.classList.add('hidden');
    }

    // Reset header UI elements
    updateTestState('idle', 'Ready');

    const headerProgress = document.getElementById('header-progress');
    if (headerProgress) {
        headerProgress.textContent = '0%';
    }

    const headerResults = document.getElementById('header-results');
    if (headerResults) {
        headerResults.classList.add('hidden');
    }

    // Reset header offset display
    const headerOffsetX = document.getElementById('header-offset-x');
    const headerOffsetY = document.getElementById('header-offset-y');
    const headerOffsetDist = document.getElementById('header-offset-dist');
    if (headerOffsetX) headerOffsetX.textContent = '0';
    if (headerOffsetY) headerOffsetY.textContent = '0';
    if (headerOffsetDist) headerOffsetDist.textContent = '0';

    // Reset header running average display
    const headerAvgX = document.getElementById('header-avg-x');
    const headerAvgY = document.getElementById('header-avg-y');
    const headerAvgDist = document.getElementById('header-avg-dist');
    if (headerAvgX) headerAvgX.textContent = '0';
    if (headerAvgY) headerAvgY.textContent = '0';
    if (headerAvgDist) headerAvgDist.textContent = '0';

    // Redraw canvas with valid start region
    drawShapesCanvas();
}

// Expose resetShapeTest globally for inline onclick
window.resetShapeTest = resetShapeTest;

// Event listeners for shapes canvas
if (shapesCanvas) {
    shapesCanvas.addEventListener('mousedown', (e) => {
        if (!isShapesModeActive()) return;

        const rect = shapesCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (shapesCanvas.width / rect.width);
        const y = (e.clientY - rect.top) * (shapesCanvas.height / rect.height);

        // If test is completed, reset and start a new one
        if (shapeTestCompleted) {
            resetShapeTest();
            startShapeTest(x, y);
            return;
        }

        if (!shapeTestActive) {
            startShapeTest(x, y);
        }
    });

    shapesCanvas.addEventListener('mousemove', (e) => {
        if (!isShapesModeActive()) return;
        if (!shapeTestActive) return;

        const rect = shapesCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (shapesCanvas.width / rect.width);
        const y = (e.clientY - rect.top) * (shapesCanvas.height / rect.height);

        updateShapeTest(x, y);
    });

    // Touch support
    shapesCanvas.addEventListener('touchstart', (e) => {
        if (!isShapesModeActive()) return;
        e.preventDefault();

        const rect = shapesCanvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = (touch.clientX - rect.left) * (shapesCanvas.width / rect.width);
        const y = (touch.clientY - rect.top) * (shapesCanvas.height / rect.height);

        // If test is completed, reset and start a new one
        if (shapeTestCompleted) {
            resetShapeTest();
            startShapeTest(x, y);
            return;
        }

        if (!shapeTestActive) {
            startShapeTest(x, y);
        }
    }, { passive: false });

    shapesCanvas.addEventListener('touchmove', (e) => {
        if (!isShapesModeActive()) return;
        if (!shapeTestActive) return;
        e.preventDefault();

        const rect = shapesCanvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = (touch.clientX - rect.left) * (shapesCanvas.width / rect.width);
        const y = (touch.clientY - rect.top) * (shapesCanvas.height / rect.height);

        updateShapeTest(x, y);
    }, { passive: false });
}

// Reset button - attach with debugging
if (resetShapeTestBtn) {
    console.log('Reset button element found, attaching listener');
    resetShapeTestBtn.addEventListener('click', (e) => {
        console.log('Reset button clicked - handler triggered');
        e.preventDefault();
        e.stopPropagation();
        console.log('Calling resetShapeTest()');
        resetShapeTest();
        console.log('resetShapeTest() completed');
    });
} else {
    console.error('Reset button element NOT found!');
}
