// Business-card layout: orientation + scale to fit the screen, QR code,
// and the rapid-click easter egg (swaps the card's orientation).
(function () {
    const scene = document.getElementById('scene');
    const card = document.getElementById('card');

    // Physical card size in mm (keep in sync with --card-w/--card-h in CSS).
    const CARD_W = 90;
    const CARD_H = 55;
    const MAX_SCALE = 2;      // largest scale (2 = double real size)
    const GUTTER = 16;        // px kept clear around the card (matches .stage padding)

    // Easter egg: this many clicks/taps within WINDOW ms.
    const CLICKS_NEEDED = 3;
    const WINDOW = 2000;

    let swapped = false;   // easter egg: manual orientation override

    // Measure how many CSS px a real millimetre is on this device.
    function pxPerMm() {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;width:100mm;height:0';
        document.body.appendChild(probe);
        const px = probe.getBoundingClientRect().width / 100;
        probe.remove();
        return px || 96 / 25.4;
    }

    // Viewport size used for fitting. On mobile the address bar slides in and
    // out, which changes innerHeight mid-load and mid-use and would flip the
    // orientation/scale back and forth. 100svh is the "toolbar shown" height
    // and never changes with it, so the layout stays put.
    const vpProbe = document.createElement('div');
    vpProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(vpProbe);
    function viewport() {
        const svh = vpProbe.getBoundingClientRect().height;
        return {
            w: document.documentElement.clientWidth || window.innerWidth,
            h: svh > 0 ? svh : window.innerHeight
        };
    }

    // Orientation policy: landscape at max size if it fits, else portrait at
    // max size, else whichever needs the smaller scale-down.
    function compute(isSwapped) {
        const mm = pxPerMm();
        const vp = viewport();
        const availW = vp.w - GUTTER * 2;
        const availH = vp.h - GUTTER * 2;

        const fit = (w, h) => Math.min(availW / (w * mm), availH / (h * mm), MAX_SCALE);
        const land = fit(CARD_W, CARD_H);
        const port = fit(CARD_H, CARD_W);

        let orient = land >= port * 0.98 ? 'landscape' : 'portrait'; // ties favour landscape
        if (land >= MAX_SCALE) orient = 'landscape';
        else if (port >= MAX_SCALE) orient = 'portrait';

        // Easter egg: show the same card in the other orientation.
        if (isSwapped) orient = orient === 'landscape' ? 'portrait' : 'landscape';

        const scale = Math.max(0.05, orient === 'landscape' ? land : port);
        const heightPx = (orient === 'landscape' ? CARD_H : CARD_W) * mm * scale;
        return { orient, scale, heightPx };
    }

    function layout() {
        const { orient, scale } = compute(swapped);
        if (scene.dataset.orient !== orient) scene.dataset.orient = orient;
        const v = scale.toFixed(4);
        if (scene.style.getPropertyValue('--scale') !== v) scene.style.setProperty('--scale', v);
    }

    // Coalesce bursts of resize events (mobile fires many) into one layout,
    // and skip the turn animation's own layout swap being interleaved.
    let rafId = 0;
    function scheduleLayout() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => { rafId = 0; if (!turning) layout(); });
    }

    // Vector QR (SVG): crisp at any scale or 3D angle. A raster canvas scaled
    // down by CSS was the cause of the occasional blur. Built on window load:
    // the QR library comes from a CDN and must not delay the first layout.
    function qrSvg(text) {
        const tmp = document.createElement('div');
        const q = new QRCode(tmp, {
            text, width: 64, height: 64, correctLevel: QRCode.CorrectLevel.M
        });
        const m = q._oQRCode;
        const n = m.getModuleCount();
        let d = '';
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (m.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
            }
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" ` +
            `shape-rendering="geometricPrecision" role="img" aria-label="QR code">` +
            `<path d="${d}" fill="#2C2825"/></svg>`;
    }
    function buildQR() {
        const qrHost = document.getElementById('qr');
        if (!window.QRCode || !qrHost || qrHost.childElementCount) return;
        qrHost.innerHTML = qrSvg('https://haodong.page');
    }
    buildQR();
    window.addEventListener('load', buildQR);

    // Rapid-click detector. Listens on the (never-tilted) scene and counts
    // on pointerdown, so a card that dips out from under the pointer can
    // never swallow a click. Ignores presses on links/buttons.
    // A press in a different area (3x3 grid: left/centre/right x top/middle/
    // bottom) than the previous one restarts the count, so left-right-top
    // presses can't add up to a flip.
    let clicks = [];
    let lastZone = '';
    function countPress(e, nx, ny) {
        if (e.target.closest('a, button')) { clicks = []; lastZone = ''; return false; }
        const q = (v) => (v < -0.4 ? -1 : v > 0.4 ? 1 : 0);
        const zone = q(nx) + ',' + q(ny);
        const now = Date.now();
        if (zone !== lastZone) clicks = [];
        lastZone = zone;
        clicks = clicks.filter((t) => now - t <= WINDOW);
        clicks.push(now);
        if (clicks.length >= CLICKS_NEEDED) {
            clicks = [];
            return true;
        }
        return false;
    }

    // Turn the card over like a real one: rotate to edge-on, swap the
    // layout while it is invisible (a hairline), then rotate the rest of the
    // way. Nothing on the face is ever stretched while it is visible.
    // Add ?slow to the URL to play the turn 8x slower (for debugging).
    const SLOW = /[?&]slow\b/.test(window.location.search) ? 8 : 1;
    const TURN_MS = 760 * SLOW;
    let turning = false;
    function turnCard() {
        if (turning) return;
        const [ax, ay] = pressAxis; // spin the way the card was pushed
        const axis = `${ax.toFixed(3)}, ${ay.toFixed(3)}, 0`;
        if (!card.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            swapped = !swapped;
            layout();
            return;
        }
        turning = true;
        // Nothing may animate underneath the turn: drop the press tilt right
        // now (transitions are off while .is-turning), so no spring-back can
        // finish after the turn and look like it playing again.
        clearTimeout(releaseTimer);
        scene.classList.add('is-turning');
        card.classList.remove('is-pressed');
        card.style.removeProperty('--rx');
        card.style.removeProperty('--ry');
        card.style.removeProperty('--ps');
        // ONE animation for the whole turn (no cancel / hand-off between two
        // animations: on mobile that hand-off left a few frames where neither
        // controlled the card, so the finished flat card flashed and then the
        // turn seemed to play again). The rotation never pauses: 0 -> edge-on,
        // a jump to the mirrored edge-on angle, then -> flat. The two easing
        // curves have the SAME slope where they meet (0.8 of the average
        // speed), so the card keeps moving through edge-on with no dwell.
        // 89.5, not 90: an exactly edge-on matrix is singular, which some
        // mobile engines cull or flicker on.
        const anim = card.animate([
            { transform: `rotate3d(${axis}, 0deg)`, easing: 'cubic-bezier(.4, 0, .7, .76)' },
            { transform: `rotate3d(${axis}, 89.5deg)`, offset: 0.5 },
            { transform: `rotate3d(${axis}, -89.5deg)`, offset: 0.5, easing: 'cubic-bezier(.25, .2, .3, 1)' },
            { transform: `rotate3d(${axis}, 0deg)` }
        ], { duration: TURN_MS });

        // Morph instead of pause: the old design fades out as the card thins
        // toward edge-on and the new design fades in as it opens again. The
        // card is fully transparent for a short window around the midpoint,
        // which is when the layout is swapped, so the swap is never seen.
        // (A second animation started in the same call: no hand-off gap.)
        card.animate([
            { opacity: 1, offset: 0 },
            { opacity: 1, offset: 0.40 },
            { opacity: 0, offset: 0.485 },
            { opacity: 0, offset: 0.515 },
            { opacity: 1, offset: 0.60 },
            { opacity: 1, offset: 1 }
        ], { duration: TURN_MS, easing: 'linear' });

        // Swap the layout inside the transparent window. Driven by the
        // animation's own clock (not a timer); a timeout is only a safety net
        // for throttled/background tabs.
        const SWAP_AT = TURN_MS * 0.49; // window is 0.485 - 0.515
        let swappedYet = false; // must run exactly once, whatever the engine does
        const doSwap = () => {
            if (swappedYet) return;
            swappedYet = true;
            swapped = !swapped;
            layout();
        };
        const watch = () => {
            if (swappedYet) return;
            const t = anim.currentTime;
            if (t !== null && Number(t) >= SWAP_AT) doSwap();
            else requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
        setTimeout(doSwap, TURN_MS * 0.53 + 120 * SLOW);

        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            doSwap(); // in case the turn was interrupted before the swap
            // Let the rest pose settle for a frame before transitions return.
            requestAnimationFrame(() => {
                scene.classList.remove('is-turning');
                turning = false;
            });
        };
        anim.onfinish = finish;
        anim.oncancel = finish;
    }

    // Press tilt: the card dips toward wherever it is pressed, then springs
    // back. Held for a minimum time so even a quick tap is clearly visible.
    const TILT = 6;        // degrees at the very edge (subtle)
    const MIN_HOLD = 150;  // ms
    let pressedAt = 0;
    let pressAxis = [0, 1];  // rotation axis of the last press (sets flip direction)
    let releaseTimer = null;
    let lastDownAt = 0;
    scene.addEventListener('pointerdown', (e) => {
        // One press = one count: ignore secondary pointers and duplicate events
        if (e.isPrimary === false) return;
        if (e.timeStamp - lastDownAt < 40) return;
        lastDownAt = e.timeStamp;
        const r = scene.getBoundingClientRect(); // stable: the card itself is tilting
        const cl = (v) => Math.max(-1, Math.min(1, v));
        const nx = cl(((e.clientX - r.left) / r.width - 0.5) * 2);
        const ny = cl(((e.clientY - r.top) / r.height - 0.5) * 2);
        const flip = countPress(e, nx, ny);
        if (turning) return;
        clearTimeout(releaseTimer);
        // Axis the pressed point pushes around: right/left -> Y, top/bottom -> X,
        // corners -> diagonal. Snap near-axis presses; centre defaults to Y.
        let vx = -ny, vy = nx;
        const len = Math.hypot(vx, vy);
        if (len < 0.2) { vx = 0; vy = 1; }
        else {
            if (Math.abs(vx) < 0.45 * Math.abs(vy)) vx = 0;
            else if (Math.abs(vy) < 0.45 * Math.abs(vx)) vy = 0;
            const n = Math.hypot(vx, vy);
            vx /= n; vy /= n;
        }
        pressAxis = [vx, vy];
        card.style.setProperty('--ry', (nx * TILT).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-ny * TILT).toFixed(2) + 'deg');
        card.style.setProperty('--ps', '0.985');
        card.classList.add('is-pressed');
        pressedAt = Date.now();
        if (flip) turnCard();
    });
    const release = () => {
        clearTimeout(releaseTimer);
        const wait = Math.max(0, MIN_HOLD - (Date.now() - pressedAt));
        releaseTimer = setTimeout(() => {
            card.classList.remove('is-pressed');
            card.style.removeProperty('--rx');
            card.style.removeProperty('--ry');
            card.style.removeProperty('--ps');
        }, wait);
    };
    ['pointerup', 'pointercancel'].forEach((t) => scene.addEventListener(t, release));
    document.addEventListener('pointerup', release);

    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('orientationchange', scheduleLayout);
    layout();
    scene.classList.add('is-ready');
})();
