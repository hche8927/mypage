/**
 * Business card behaviour. See docs/ARCHITECTURE.md for the design notes.
 *
 *   1. Fitting     pick landscape or portrait and a scale that fit the screen
 *   2. Press tilt  the card dips toward wherever it is pressed
 *   3. Turn        three quick presses in one spot turn the card to the other
 *                  orientation (easter egg)
 *
 * Plain script (no modules), so the page also works when opened from disk.
 */
(function () {
    'use strict';

    // ------------------------------------------------------------------ config

    // Physical card size in mm. Keep in sync with --card-w / --card-h in the CSS.
    const CARD_W = 90;
    const CARD_H = 55;

    const MAX_SCALE = 2;   // largest scale the card is drawn at (2 = double real size)
    const MIN_SCALE = 0.05;
    const GUTTER = 16;     // px kept clear around the card; matches .stage padding

    // Press tilt
    const TILT_DEG = 6;         // tilt at the very edge of the card
    const PRESS_SCALE = 0.985;  // the card sinks slightly while pressed
    const MIN_HOLD_MS = 150;    // a quick tap still shows a clear dip
    const DEDUPE_MS = 40;       // ignore duplicate pointerdown events closer than this

    // Turn easter egg
    const PRESSES_TO_TURN = 3;
    const PRESS_WINDOW_MS = 2000;
    const ZONE_EDGE = 0.4;      // the card is a 3x3 grid; presses must stay in one cell

    // Turn animation. Add ?slow to the URL to play it 8x slower (for debugging).
    const SLOW = /[?&]slow\b/.test(window.location.search) ? 8 : 1;
    const TURN_MS = 760 * SLOW;
    const EDGE_ON_DEG = 89.5;   // 90 exactly is a singular matrix; some mobile engines cull it
    const SWAP_AT = 0.49;       // layout swap time, as a fraction of the turn ...
    const FADE_OUT_FROM = 0.40; // ... which lies inside the fully transparent window
    const FADE_OUT_TO = 0.485;  //     [FADE_OUT_TO, FADE_IN_FROM]
    const FADE_IN_FROM = 0.515;
    const FADE_IN_TO = 0.60;
    // The two easing curves meet with the same slope (0.8), so the card keeps
    // moving through edge-on instead of dwelling there.
    const EASE_IN_HALF = 'cubic-bezier(.4, 0, .7, .76)';
    const EASE_OUT_HALF = 'cubic-bezier(.25, .2, .3, 1)';

    // ------------------------------------------------------------------- state

    const scene = document.getElementById('scene');
    const card = document.getElementById('card');

    let swapped = false;          // easter egg: show the pose the screen would NOT choose
    let turning = false;          // a turn animation is running
    let pressAxis = [0, 1];       // rotation axis of the latest press: sets the turn direction
    let pressedAt = 0;
    let releaseTimer = 0;
    let lastPointerDownAt = 0;
    let recentPresses = [];       // timestamps of presses in the current zone
    let lastZone = '';

    const prefersReducedMotion = () =>
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ----------------------------------------------------------------- fitting

    /*
     * Two hidden probes measure the environment once:
     *  - a 100mm-wide box gives the device's real px-per-mm;
     *  - a box 100svh tall gives the viewport height with the mobile address bar
     *    shown. It never changes when the bar slides away, unlike innerHeight,
     *    which would flip the pose/scale back and forth during use.
     */
    const mmProbe = createProbe('width:100mm;height:0');
    const svhProbe = createProbe('width:0;height:100svh');

    function createProbe(css) {
        const el = document.createElement('div');
        el.style.cssText = `position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;${css}`;
        document.body.appendChild(el);
        return el;
    }

    function pxPerMm() {
        return mmProbe.getBoundingClientRect().width / 100 || 96 / 25.4;
    }

    function viewport() {
        const svh = svhProbe.getBoundingClientRect().height;
        return {
            width: document.documentElement.clientWidth || window.innerWidth,
            height: svh > 0 ? svh : window.innerHeight
        };
    }

    /**
     * Pose policy: landscape at the largest scale if it fits, else portrait at the
     * largest scale, else whichever needs the smaller shrink (ties favour landscape).
     * @param {boolean} flipped  true = the opposite pose (easter egg)
     * @returns {{orient: 'landscape'|'portrait', scale: number}}
     */
    function computePose(flipped) {
        const mm = pxPerMm();
        const vp = viewport();
        const availW = vp.width - GUTTER * 2;
        const availH = vp.height - GUTTER * 2;
        const fit = (w, h) => Math.min(availW / (w * mm), availH / (h * mm), MAX_SCALE);

        const landscape = fit(CARD_W, CARD_H);
        const portrait = fit(CARD_H, CARD_W);

        let orient;
        if (landscape >= MAX_SCALE) orient = 'landscape';
        else if (portrait >= MAX_SCALE) orient = 'portrait';
        else orient = landscape >= portrait * 0.98 ? 'landscape' : 'portrait';

        if (flipped) orient = orient === 'landscape' ? 'portrait' : 'landscape';

        const scale = orient === 'landscape' ? landscape : portrait;
        return { orient, scale: Math.max(MIN_SCALE, scale) };
    }

    /** Applies the current pose to the DOM (writes only what changed). */
    function layout() {
        const { orient, scale } = computePose(swapped);
        if (scene.dataset.orient !== orient) scene.dataset.orient = orient;
        const value = scale.toFixed(4);
        if (scene.style.getPropertyValue('--scale') !== value) scene.style.setProperty('--scale', value);
    }

    // Mobile fires bursts of resize events: coalesce them into one layout per frame.
    let layoutFrame = 0;
    function scheduleLayout() {
        if (layoutFrame) return;
        layoutFrame = requestAnimationFrame(() => {
            layoutFrame = 0;
            if (!turning) layout();
        });
    }

    // -------------------------------------------------------------- press tilt

    /** Normalised pointer position over the scene: -1 (left/top) .. 1 (right/bottom). */
    function pointerPosition(event) {
        const rect = scene.getBoundingClientRect(); // stable: the card itself is tilting
        const clamp = (v) => Math.max(-1, Math.min(1, v));
        return {
            nx: clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2),
            ny: clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2)
        };
    }

    /**
     * The axis a press at (nx, ny) pushes the card around: left/right presses
     * -> Y axis, top/bottom -> X axis, corners -> diagonal. Near-axis presses
     * snap to the pure axis; a press in the centre defaults to the Y axis.
     */
    function axisFromPress(nx, ny) {
        let ax = -ny;
        let ay = nx;
        if (Math.hypot(ax, ay) < 0.2) return [0, 1];
        if (Math.abs(ax) < 0.45 * Math.abs(ay)) ax = 0;
        else if (Math.abs(ay) < 0.45 * Math.abs(ax)) ay = 0;
        const length = Math.hypot(ax, ay);
        return [ax / length, ay / length];
    }

    function tiltCard(nx, ny) {
        card.style.setProperty('--ry', `${(nx * TILT_DEG).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${(-ny * TILT_DEG).toFixed(2)}deg`);
        card.style.setProperty('--ps', String(PRESS_SCALE));
        card.classList.add('is-pressed');
    }

    function untiltCard() {
        card.classList.remove('is-pressed');
        card.style.removeProperty('--rx');
        card.style.removeProperty('--ry');
        card.style.removeProperty('--ps');
    }

    /** Springs back after the press, but never sooner than MIN_HOLD_MS. */
    function releasePress() {
        clearTimeout(releaseTimer);
        const wait = Math.max(0, MIN_HOLD_MS - (Date.now() - pressedAt));
        releaseTimer = setTimeout(untiltCard, wait);
    }

    // ---------------------------------------------------------- press counting

    /**
     * Counts rapid presses. Presses on links/buttons never count, and a press in a
     * different area (3x3 grid) than the previous one restarts the count, so
     * left-right-top cannot add up to a turn.
     * @returns {boolean} true when this press completes the sequence
     */
    function countPress(event, nx, ny) {
        if (event.target.closest && event.target.closest('a, button')) {
            recentPresses = [];
            lastZone = '';
            return false;
        }
        const cell = (v) => (v < -ZONE_EDGE ? -1 : v > ZONE_EDGE ? 1 : 0);
        const zone = `${cell(nx)},${cell(ny)}`;
        const now = Date.now();
        if (zone !== lastZone) recentPresses = [];
        lastZone = zone;
        recentPresses = recentPresses.filter((t) => now - t <= PRESS_WINDOW_MS);
        recentPresses.push(now);
        if (recentPresses.length < PRESSES_TO_TURN) return false;
        recentPresses = [];
        return true;
    }

    // -------------------------------------------------------------------- turn

    /**
     * Turns the card over to the other orientation.
     *
     * One continuous animation: rotate to (almost) edge-on, jump to the mirrored
     * edge-on angle, rotate on to flat. There is no hand-off between animations
     * (on mobile that left frames where nothing controlled the card). A second
     * animation started in the same call fades the card out as it thins toward
     * edge-on and back in as it opens; it is fully transparent around the
     * midpoint, which is when the layout is swapped, so the swap is never seen.
     */
    function turnCard() {
        if (turning) return;

        if (!card.animate || prefersReducedMotion()) {
            swapped = !swapped;
            layout();
            return;
        }

        turning = true;
        // Nothing may animate underneath the turn: drop the press tilt now
        // (transitions are off while .is-turning).
        clearTimeout(releaseTimer);
        scene.classList.add('is-turning');
        untiltCard();

        const [ax, ay] = pressAxis; // spin the way the card was pushed
        const rotation = (deg) => `rotate3d(${ax.toFixed(3)}, ${ay.toFixed(3)}, 0, ${deg}deg)`;

        const spin = card.animate([
            { transform: rotation(0), easing: EASE_IN_HALF },
            { transform: rotation(EDGE_ON_DEG), offset: 0.5 },
            { transform: rotation(-EDGE_ON_DEG), offset: 0.5, easing: EASE_OUT_HALF },
            { transform: rotation(0) }
        ], { duration: TURN_MS });

        card.animate([
            { opacity: 1, offset: 0 },
            { opacity: 1, offset: FADE_OUT_FROM },
            { opacity: 0, offset: FADE_OUT_TO },
            { opacity: 0, offset: FADE_IN_FROM },
            { opacity: 1, offset: FADE_IN_TO },
            { opacity: 1, offset: 1 }
        ], { duration: TURN_MS, easing: 'linear' });

        // Swap the layout exactly once, driven by the animation's own clock.
        // The timeout is only a safety net for throttled / background tabs.
        let swapDone = false;
        const swapLayout = () => {
            if (swapDone) return;
            swapDone = true;
            swapped = !swapped;
            layout();
        };
        const watchClock = () => {
            if (swapDone) return;
            const t = spin.currentTime;
            if (t !== null && Number(t) >= TURN_MS * SWAP_AT) swapLayout();
            else requestAnimationFrame(watchClock);
        };
        requestAnimationFrame(watchClock);
        setTimeout(swapLayout, TURN_MS * 0.53 + 120 * SLOW);

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            swapLayout(); // in case the turn was interrupted before the swap
            // Let the rest pose settle for a frame before transitions return.
            requestAnimationFrame(() => {
                scene.classList.remove('is-turning');
                turning = false;
            });
        };
        spin.onfinish = finish;
        spin.oncancel = finish;
    }

    // ------------------------------------------------------------ pointer input

    // The scene never moves, so presses on it are reliable even while the card
    // tilts away from under the pointer. Counting happens on pointerdown.
    scene.addEventListener('pointerdown', (event) => {
        // One press = one count: ignore secondary pointers and duplicate events.
        if (event.isPrimary === false) return;
        if (event.timeStamp - lastPointerDownAt < DEDUPE_MS) return;
        lastPointerDownAt = event.timeStamp;

        const { nx, ny } = pointerPosition(event);
        const completesTurn = countPress(event, nx, ny);
        if (turning) return;

        clearTimeout(releaseTimer);
        pressAxis = axisFromPress(nx, ny);
        tiltCard(nx, ny);
        pressedAt = Date.now();
        if (completesTurn) turnCard();
    });

    scene.addEventListener('pointerup', releasePress);
    scene.addEventListener('pointercancel', releasePress);
    document.addEventListener('pointerup', releasePress); // released outside the scene

    // -------------------------------------------------------------------- start

    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('orientationchange', scheduleLayout);

    layout();
    scene.classList.add('is-ready');
})();
