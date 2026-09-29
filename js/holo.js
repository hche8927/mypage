/**
 * Holographic foil, parallax and hover tilt (in the spirit of the foil cards in
 * Pokemon TCG Pocket). See docs/ARCHITECTURE.md.
 *
 * This file only produces one small set of numbers, from three sources:
 *   - the pointer (mouse anywhere on the page; a finger while it is down),
 *   - the device's tilt (phones with a gyroscope), and
 *   - a slow idle drift, so the foil shimmers even when nothing is moving.
 * They are smoothed and written as CSS custom properties on <html>; the
 * CSS turns them into foil and sparkle position, parallax and tilt:
 *
 *   --px, --py   -1..1   where the "light" is (0 = centre)
 *   --mx, --my    0..1   the same, as fractions
 *   --holo        0..1   how strongly the foil shows (idle .. interacting)
 *
 * The hover tilt goes to the .card-tilt wrapper (--tilt-x / --tilt-y), which is
 * separate from .card so it never fights the press dip or the turn animation.
 */
(function () {
    'use strict';

    // ------------------------------------------------------------------ config

    const TILT_DEG = 7;          // hover tilt at the edge of the screen
    const SMOOTHING = 0.10;      // 0..1 per frame: lower = floatier
    const HOLO_IDLE = 0.35;      // foil strength at rest
    const HOLO_ACTIVE = 1;       // foil strength while the pointer / device moves it
    const IDLE_AFTER_MS = 2500;  // start the idle drift after this long without input
    const DRIFT_RADIUS = 0.35;   // how far the idle drift swings (fraction of full range)
    const DRIFT_PERIOD_MS = 9000;
    const GYRO_RANGE_DEG = 22;   // device tilt that maps to the full -1..1 range
    const GYRO_NEUTRAL_BETA = 50; // a phone held to read is tilted back about this much
    const IDLE_FRAME_MS = 33;    // the idle drift updates ~30 times a second (saves battery)

    // ------------------------------------------------------------------- setup

    const root = document.documentElement;
    const tilt = document.getElementById('tilt');
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

    // Reduced motion: leave the foil at its static resting look, no movement at all.
    if (!tilt || (reducedMotion && reducedMotion.matches)) return;

    const clamp = (v, min = -1, max = 1) => Math.max(min, Math.min(max, v));

    const target = { x: 0, y: 0, holo: HOLO_IDLE };
    const current = { x: 0, y: 0, holo: HOLO_IDLE };
    let lastInputAt = 0;   // when a real input (pointer / gyro) last moved the target
    let lastWriteAt = 0;
    let frame = 0;

    // ----------------------------------------------------------------- output

    function write() {
        root.style.setProperty('--px', current.x.toFixed(4));
        root.style.setProperty('--py', current.y.toFixed(4));
        root.style.setProperty('--mx', ((current.x + 1) / 2).toFixed(4));
        root.style.setProperty('--my', ((current.y + 1) / 2).toFixed(4));
        root.style.setProperty('--holo', current.holo.toFixed(4));
        // Tilt like the press dip: the side nearest the light goes away.
        tilt.style.setProperty('--tilt-x', `${(-current.y * TILT_DEG).toFixed(3)}deg`);
        tilt.style.setProperty('--tilt-y', `${(current.x * TILT_DEG).toFixed(3)}deg`);
    }

    // ------------------------------------------------------------------- loop

    function tick(now) {
        frame = 0;
        // Always keep running (the idle drift needs it), but never while hidden.
        if (!document.hidden) frame = requestAnimationFrame(tick);

        const idle = now - lastInputAt > IDLE_AFTER_MS;
        if (idle) {
            if (now - lastWriteAt < IDLE_FRAME_MS) return;
            // A slow figure-of-eight when nothing has moved the light lately.
            const phase = (now / DRIFT_PERIOD_MS) * Math.PI * 2;
            target.x = Math.sin(phase) * DRIFT_RADIUS;
            target.y = Math.sin(phase * 2) * DRIFT_RADIUS * 0.6;
            target.holo = HOLO_IDLE;
        }
        lastWriteAt = now;

        current.x += (target.x - current.x) * SMOOTHING;
        current.y += (target.y - current.y) * SMOOTHING;
        current.holo += (target.holo - current.holo) * SMOOTHING;
        write();
    }

    function start() {
        if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
    }

    document.addEventListener('visibilitychange', start);

    // ----------------------------------------------------------------- pointer

    function aim(x, y) {
        lastInputAt = performance.now();
        target.x = x;
        target.y = y;
        target.holo = HOLO_ACTIVE;
    }

    // Mouse: anywhere on the page, relative to the window. Touch: while the
    // finger is down (a browser that takes over the touch sends pointercancel).
    window.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch' && event.buttons === 0) return;
        aim(
            clamp((event.clientX / window.innerWidth - 0.5) * 2),
            clamp((event.clientY / window.innerHeight - 0.5) * 2)
        );
    }, { passive: true });

    window.addEventListener('pointerdown', (event) => {
        aim(
            clamp((event.clientX / window.innerWidth - 0.5) * 2),
            clamp((event.clientY / window.innerHeight - 0.5) * 2)
        );
    }, { passive: true });

    // Let go / leave the window: hand the light back to the idle drift after a moment.
    const letGo = () => { lastInputAt = performance.now() - IDLE_AFTER_MS + 900; };
    window.addEventListener('pointerup', letGo, { passive: true });
    window.addEventListener('pointercancel', letGo, { passive: true });
    document.documentElement.addEventListener('mouseleave', letGo, { passive: true });

    // ------------------------------------------------------------- device tilt

    function onDeviceOrientation(event) {
        if (event.gamma === null || event.beta === null) return; // desktop browsers fire one empty event
        lastInputAt = performance.now();
        target.x = clamp(event.gamma / GYRO_RANGE_DEG);
        target.y = clamp((event.beta - GYRO_NEUTRAL_BETA) / GYRO_RANGE_DEG);
        target.holo = HOLO_IDLE + (HOLO_ACTIVE - HOLO_IDLE) * Math.min(1, Math.hypot(target.x, target.y) * 1.5 + 0.35);
    }

    let gyroListening = false;
    function listenToDevice() {
        if (gyroListening || !('DeviceOrientationEvent' in window)) return;
        gyroListening = true;
        window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    }

    if (typeof window.DeviceOrientationEvent === 'function' &&
        typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        // iOS asks for permission, and only inside a user gesture: on the first tap.
        window.addEventListener('click', function askOnce() {
            window.removeEventListener('click', askOnce);
            window.DeviceOrientationEvent.requestPermission()
                .then((state) => { if (state === 'granted') listenToDevice(); })
                .catch(() => { /* refused or unavailable: pointer and idle drift still work */ });
        });
    } else {
        listenToDevice(); // Android and desktop: no permission needed
    }

    // ------------------------------------------------------------------- start

    lastInputAt = -IDLE_AFTER_MS; // begin in the idle drift
    write();
    start();
})();
