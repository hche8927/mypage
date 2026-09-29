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
 *
 * Add ?gyro to the URL to show a small panel with the raw sensor values, the
 * permission state and the numbers this file derives from them.
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
    const IDLE_FRAME_MS = 33;    // the idle drift updates ~30 times a second (saves battery)

    // Device tilt. A phone held to read is tilted back about 50 degrees from
    // upright; tilting 22 degrees either way from there is the full -1..1 range.
    const GYRO_READING_DEG = 50;
    const GYRO_RANGE_DEG = 22;
    const DEG = Math.PI / 180;
    const GYRO_REFERENCE = Math.sin(GYRO_READING_DEG * DEG);
    const GYRO_RANGE = Math.sin(GYRO_RANGE_DEG * DEG) * Math.cos(GYRO_READING_DEG * DEG);

    const clamp = (v, min = -1, max = 1) => Math.max(min, Math.min(max, v));

    // ------------------------------------------------------------ device tilt maths

    /** The screen's rotation from its natural orientation: 0, 90, 180 or 270. */
    function screenAngle() {
        const orientation = window.screen && window.screen.orientation;
        const raw = orientation && typeof orientation.angle === 'number'
            ? orientation.angle
            : (typeof window.orientation === 'number' ? window.orientation : 0);
        return ((Math.round(raw / 90) * 90) % 360 + 360) % 360;
    }

    /**
     * Turns the device's beta / gamma angles into the light position on screen
     * (x: -1 left .. 1 right, y: -1 top .. 1 bottom), for any screen rotation.
     *
     * beta / gamma are Euler angles, which swap roles when the phone is turned
     * sideways (and gamma degenerates near vertical in landscape). So instead of
     * using them directly this works with the direction of gravity in the
     * device's own frame, (-cos(beta) sin(gamma), sin(beta)), and reads it along
     * the screen's own right and up axes. Those axes, in device coordinates,
     * depend on how far the screen is rotated:
     *   0   right = (1, 0)   up = (0, 1)     natural portrait
     *   90  right = (0,-1)   up = (1, 0)     device turned counter-clockwise
     *   180 right = (-1,0)   up = (0,-1)
     *   270 right = (0, 1)   up = (-1,0)     device turned clockwise
     * Sign convention (matches the press dip): the side of the screen that
     * tilts away from you is the side the light moves toward.
     *
     * @param {number} beta   degrees, front-back tilt
     * @param {number} gamma  degrees, left-right tilt
     * @param {number} angle  screen rotation: 0 | 90 | 180 | 270
     */
    function leanFromDevice(beta, gamma, angle) {
        const b = beta * DEG;
        const g = gamma * DEG;
        const gravityX = -Math.cos(b) * Math.sin(g);
        const gravityY = Math.sin(b);
        let right;
        let up;
        switch (angle) {
            case 90:  right = [0, -1]; up = [1, 0]; break;
            case 180: right = [-1, 0]; up = [0, -1]; break;
            case 270: right = [0, 1]; up = [-1, 0]; break;
            default:  right = [1, 0]; up = [0, 1];
        }
        const along = (axis) => gravityX * axis[0] + gravityY * axis[1];
        return {
            x: clamp(-along(right) / GYRO_RANGE),
            y: clamp((along(up) - GYRO_REFERENCE) / GYRO_RANGE)
        };
    }

    // -------------------------------------------------------------- debug panel

    const DEBUG = /[?&]gyro\b/.test(window.location.search);
    const stats = { motion: 'not started', events: 0, valid: 0, alpha: null, beta: null, gamma: null, lean: null };
    let debugPanel = null;
    let requestMotionFromButton = null; // set later; the panel's button calls it

    function createDebugPanel() {
        const panel = document.createElement('div');
        panel.setAttribute('aria-hidden', 'true');
        panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;max-width:92vw;padding:8px 10px;' +
            'border-radius:8px;background:rgba(0,0,0,.78);color:#8f8;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;' +
            'white-space:pre;pointer-events:none;';
        const text = document.createElement('div');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Enable motion sensors';
        button.style.cssText = 'display:none;margin-top:6px;padding:6px 10px;pointer-events:auto;font:inherit;';
        button.addEventListener('click', () => { if (requestMotionFromButton) requestMotionFromButton(); });
        panel.append(text, button);
        document.body.appendChild(panel);
        return { text, button };
    }

    function renderDebug(now) {
        if (!debugPanel) return;
        const f = (v, d = 1) => (v === null || v === undefined ? '-' : Number(v).toFixed(d));
        const rate = renderDebug.last
            ? ((stats.valid - renderDebug.last.valid) / ((now - renderDebug.last.now) / 1000)) : 0;
        renderDebug.last = { now, valid: stats.valid };
        const quiet = stats.motion === 'listening' && stats.valid === 0 && now > 2500;
        debugPanel.text.textContent = [
            'gyro debug (?gyro)',
            `motion: ${quiet ? 'listening, but NO events (sensor unavailable or blocked)' : stats.motion}`,
            `events: ${stats.events} (${stats.valid} with data)  ~${rate.toFixed(0)}/s`,
            `alpha ${f(stats.alpha)}  beta ${f(stats.beta)}  gamma ${f(stats.gamma)}`,
            `screen angle: ${screenAngle()}`,
            `lean x,y: ${stats.lean ? f(stats.lean.x, 2) + ', ' + f(stats.lean.y, 2) : '-'}`,
            `foil px,py,holo: ${f(current.x, 2)}, ${f(current.y, 2)}, ${f(current.holo, 2)}`,
            `reduced motion: ${reducedMotion && reducedMotion.matches ? 'ON (effects disabled)' : 'off'}`
        ].join('\n');
        debugPanel.button.style.display = stats.motion === 'needs tap' || stats.motion === 'denied' ? 'inline-block' : 'none';
    }

    // ------------------------------------------------------------------- state

    const root = document.documentElement;
    const tilt = document.getElementById('tilt');
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

    const target = { x: 0, y: 0, holo: HOLO_IDLE };
    const current = { x: 0, y: 0, holo: HOLO_IDLE };
    let lastInputAt = 0;   // when a real input (pointer / gyro) last moved the target
    let lastWriteAt = 0;
    let frame = 0;

    if (DEBUG) {
        debugPanel = createDebugPanel();
        setInterval(() => renderDebug(performance.now()), 250);
    }

    // Reduced motion: leave the foil at its static resting look, no movement at all.
    if (!tilt || (reducedMotion && reducedMotion.matches)) {
        stats.motion = 'disabled (reduced motion)';
        return;
    }

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
        stats.events += 1;
        stats.alpha = event.alpha;
        stats.beta = event.beta;
        stats.gamma = event.gamma;
        if (event.gamma === null || event.beta === null) return; // desktop browsers fire one empty event
        stats.valid += 1;

        const lean = leanFromDevice(event.beta, event.gamma, screenAngle());
        stats.lean = lean;
        lastInputAt = performance.now();
        target.x = lean.x;
        target.y = lean.y;
        target.holo = HOLO_IDLE + (HOLO_ACTIVE - HOLO_IDLE) * Math.min(1, Math.hypot(lean.x, lean.y) * 1.5 + 0.35);
    }

    let listening = false;
    function listenToDevice() {
        if (listening || !('DeviceOrientationEvent' in window)) return;
        listening = true;
        stats.motion = 'listening';
        window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    }

    const needsPermission = typeof window.DeviceOrientationEvent === 'function' &&
        typeof window.DeviceOrientationEvent.requestPermission === 'function';

    /** Asks for motion access where the browser requires it (iOS); must run inside a user gesture. */
    function requestMotion() {
        if (!needsPermission) { listenToDevice(); return Promise.resolve(); }
        return window.DeviceOrientationEvent.requestPermission()
            .then((state) => {
                stats.motion = state === 'granted' ? 'granted' : 'denied';
                if (state === 'granted') listenToDevice();
            })
            .catch(() => { stats.motion = 'denied'; /* refused or unavailable: pointer and idle drift still work */ });
    }
    requestMotionFromButton = requestMotion;

    if (!('DeviceOrientationEvent' in window)) {
        stats.motion = 'unsupported';
    } else if (needsPermission) {
        // iOS asks for permission, and only inside a user gesture: on the first tap.
        stats.motion = 'needs tap';
        window.addEventListener('click', function askOnce() {
            window.removeEventListener('click', askOnce);
            requestMotion();
        });
    } else {
        listenToDevice(); // Android and desktop: no permission needed
    }

    // ------------------------------------------------------------------- start

    lastInputAt = -IDLE_AFTER_MS; // begin in the idle drift
    write();
    start();
})();
