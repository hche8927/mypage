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
    // layout while it is invisible (a sliver), then rotate the rest of the
    // way. The sliver's height is animated to the new height so it never
    // jumps, and nothing on the face is ever stretched while visible.
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
        const before = compute(swapped);
        const after = compute(!swapped);
        const dims = (o) => o.orient === 'landscape' ? [CARD_W, CARD_H] : [CARD_H, CARD_W];
        const [w0, h0] = dims(before).map((v) => v * before.scale);
        const [w1, h1] = dims(after).map((v) => v * after.scale);
        const out = card.animate([
            { transform: `rotate3d(${axis}, 0deg) scale(1, 1)` },
            { transform: `rotate3d(${axis}, 80deg) scale(1, 1)`, offset: 0.85 },
            // Edge-on: match the sliver's size to the new layout's
            // (89.5, not 90: an exactly edge-on matrix is singular, which some
            // mobile engines cull or flicker on)
            { transform: `rotate3d(${axis}, 89.5deg) scale(${w1 / w0}, ${h1 / h0})` }
        ], { duration: 380, easing: 'cubic-bezier(.5, 0, 1, .8)', fill: 'forwards' });
        let swappedYet = false; // the swap must run exactly once, whatever the engine does
        out.onfinish = () => {
            if (swappedYet) return;
            swappedYet = true;
            swapped = !swapped;
            layout();
            const back = card.animate([
                { transform: `rotate3d(${axis}, -89.5deg) scale(1, 1)` },
                { transform: `rotate3d(${axis}, 0deg) scale(1, 1)` }
            ], { duration: 380, easing: 'cubic-bezier(0, .2, .3, 1)' });
            out.cancel();
            let done = false;
            back.onfinish = () => {
                if (done) return;
                done = true;
                // Let the rest pose settle for a frame before transitions return.
                requestAnimationFrame(() => {
                    scene.classList.remove('is-turning');
                    turning = false;
                });
            };
        };
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
