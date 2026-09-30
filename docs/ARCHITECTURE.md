# Architecture

How the card works and why it is built this way. Read this before changing the card, its animation or its fitting logic: several details look arbitrary but each one fixes a real cross-browser problem, recorded below.

## Overview

A static site: `index.html`, one stylesheet, two small scripts. No framework, no bundler, no runtime dependencies. It works when opened from disk (so the scripts are plain scripts, not ES modules, which browsers refuse to load from `file://`).

| Piece | Responsibility |
| --- | --- |
| `index.html` | All content and the stamp artwork; the generated QR code between `qr:start` / `qr:end` |
| `css/styles.css` | Tokens, the card and its layouts, the stamp, links, toggle |
| `js/card.js` | Fitting, press tilt, press counting, the turn |
| `js/holo.js` | The pointer / device-tilt / idle input behind the holographic foil, parallax and hover tilt |
| `js/theme.js` | Light/dark toggle (the saved theme is applied earlier by an inline script in `<head>`) |

## The card is a physical object

The card is **90 x 55 mm**. Inside `.card-scene`, `font-size = 1mm x --scale`, so `1em = 1mm x --scale` and every card dimension is written in `em`. Changing `--scale` resizes the whole card, text and all, as one piece; there are no media queries.

- `--scale` is at most **2** (double real size) and never grows past that. On small screens it shrinks.
- `js/card.js` measures the real pixels per millimetre with a hidden `100mm`-wide probe, so "90 mm" is right on any device.
- The size constants exist in two places (`--card-w`/`--card-h` in CSS, `CARD_W`/`CARD_H` in JS). `npm run check` fails if they disagree.

### Choosing landscape or portrait

`computePose()` in `js/card.js`:

1. If the landscape card fits at the largest scale, use landscape.
2. Else if portrait fits at the largest scale, use portrait.
3. Else use whichever needs the smaller shrink (ties favour landscape).

The result is written to `data-orient` (`landscape` | `portrait`) and `--scale` on the scene. The two layouts are plain CSS keyed on `data-orient`; they are two arrangements of the same content.

**Viewport height uses `100svh`, not `innerHeight`.** On mobile the address bar slides in and out, changing `innerHeight` mid-load and mid-use. That flipped the pose and scale back and forth. `100svh` (the "small viewport", toolbar shown) never changes with the bar.

## Scene versus card

There are nested boxes and the split matters:

- `.card-scene` **never moves**. It centres the card, holds the `perspective`, and receives the pointer events.
- `.card-tilt` leans toward the pointer or device tilt (driven every frame by `js/holo.js`).
- `.card` is what dips when pressed and turns over (driven by `js/card.js`).

The two movers are separate elements so they never fight: the hover tilt updates every frame and must have no CSS transition, while the press dip needs one. Each has its own `perspective`, because a 3D transform on a child is only drawn with perspective by its nearest ancestor that has one.

Presses are counted on the scene, on `pointerdown`. When they were counted on the card, the card tilted away from under the pointer and the press was lost, so a turn sometimes needed more than three taps. The tilt direction is also computed from the scene's box for the same reason.

## Press tilt

`pointerdown` sets `--rx`, `--ry` and `--ps` on the card (rotation about X and Y, and a slight shrink), so the card dips toward the pressed point. Release removes them and a springy CSS transition returns the card to rest. The dip is held for at least 150 ms so a very quick tap is still visible.

## The turn

Three presses within two seconds, all in the same cell of a 3 x 3 grid over the card, turn the card to the other orientation (a press on a link or the toggle resets the count). It spins about the axis implied by where it was pressed: left/right presses give a vertical axis, top/bottom a horizontal one, corners a diagonal one.

The two orientations are different layouts with different proportions, so the layout has to swap mid-turn. Getting that swap to be invisible on mobile took several iterations; the final design and the reasons for each part:

- **One animation, not two.** An earlier version ran "to edge-on", then in the `finish` handler started "back to flat" and cancelled the first. On mobile the finish event arrives late and a newly started animation takes a frame or two to reach the compositor, leaving frames where nothing controlled the card. The finished flat card flashed and the turn seemed to replay. Now one `card.animate` covers the whole turn with a jump at the midpoint from `+89.5deg` to `-89.5deg`.
- **89.5 degrees, not 90.** An exactly edge-on transform is a singular matrix, which some mobile engines cull or flicker on.
- **Matching easing slopes.** The two halves use easing curves with the same slope where they meet, so the card keeps moving through edge-on instead of dwelling there. (A "hold" at edge-on gave time to swap the layout but was visibly a pause.)
- **Fade-through instead of a hard swap.** A second animation, started in the same call, fades the card out as it thins toward edge-on and back in as it opens. It is fully transparent for about 23 ms around the midpoint. The layout swap is triggered there, from the animation's own clock (`currentTime`), with a timeout only as a safety net for background tabs. The card is about 4% wide and invisible at that moment.
- **The swap runs exactly once** even if the engine fires `finish` twice or the turn is interrupted.
- **No CSS transition may run underneath the animation.** While `.is-turning` is set the card's CSS transition is off and the press tilt is cleared, so a spring-back cannot finish after the turn and look like it replaying.
- **`will-change: transform` on the card** puts it on its own layer from the start, so the turn is transformed rather than re-rasterised (a soft or jagged first frames problem on mobile). A 1px transparent outline on the face while turning makes browsers anti-alias its edges.
- **Reduced motion:** with `prefers-reduced-motion`, the turn just swaps the layout.

Use `?slow` in the URL to play the turn eight times slower when working on it.

## The QR stamp

The QR code sits on a postage-stamp shaped tile. It is deliberately **not a link**: it exists to be scanned from another screen, and a tap on it counts as a press on the card like any other spot.

- **Body:** an inline SVG in `index.html`: a white square with 40 circular holes centred on its edges (10 per side, in a 100-unit `viewBox`), masked, plus two offset copies at low opacity as the shadow. It is vector, so it is identical on every browser and scale. The earlier CSS version tiled a radial gradient; iOS Safari rounded the tile sizes differently and left a stray strip of paper along one edge. There is no CSS `filter: drop-shadow` on the stamp because that renders the stamp as its own surface, which appeared to slide against the card while it tilted.
- **QR code:** generated ahead of time (`npm run qr`, using the vendored `qrcodejs` against a stub DOM) and pasted into the HTML as one SVG path. Visitors download no QR library. `shape-rendering` is the default (anti-aliased) on purpose: `crispEdges` snapped every module to whole pixels and made the code shimmer whenever the card tilted or turned. A raster canvas scaled by CSS, which the first version used, looked blurry.
- **Size:** `--qr` (em) is the QR size; the stamp adds 1em of paper per side. It is 14 in landscape and 20.8 in portrait.

## Holographic foil, parallax and hover tilt

A holographic look in the spirit of the foil cards in Pokemon TCG Pocket, (the foil is silver in dark mode and rainbow in light mode; an earlier all-rainbow version was too loud). The design splits into *one small set of numbers* and *what the CSS does with them*.

**The numbers (`js/holo.js`).** Three sources feed one target position of "the light", smoothed frame by frame and written as custom properties on `<html>`:

- the pointer (the mouse anywhere on the page; a finger while it is down),
- the device's tilt (`deviceorientation`; moves the foil and parallax but does not lean the card; used where the browser reports it freely, i.e. Android. **It is switched off on iOS and iPadOS**, which only report tilt after a system permission prompt; the effect is not worth interrupting anyone for, so there the pointer, touch and the idle drift drive it),
- an idle drift (a slow figure-of-eight after 2.5 s without input, updated about 30 times a second and paused while the page is hidden), so the foil shimmers on a screen nobody is moving.

The properties are `--px` / `--py` (-1..1), `--mx` / `--my` (0..1) and `--holo` (0..1, how strongly the foil shows). The hover tilt goes to `.card-tilt` as `--tilt-x` / `--tilt-y`.

**Device tilt maths.** `deviceorientation` reports Euler angles (`beta` front-back, `gamma` left-right). Used directly they are wrong as soon as the phone is turned sideways: the two swap roles, and `gamma` degenerates near vertical in landscape. So `leanFromDevice()` works with the direction of *gravity in the device's own frame*, `(-cos(beta) sin(gamma), sin(beta))`, and reads it along the screen's own right and up axes, which depend on the screen rotation (`screen.orientation.angle`, falling back to `window.orientation`):

| Screen angle | Screen right (device x, y) | Screen up (device x, y) |
| --- | --- | --- |
| 0 (natural portrait) | (1, 0) | (0, 1) |
| 90 (device turned counter-clockwise) | (0, -1) | (1, 0) |
| 180 | (-1, 0) | (0, -1) |
| 270 (device turned clockwise) | (0, 1) | (-1, 0) |

A phone held to read (about 50 degrees back from upright) is the neutral pose; 22 degrees either way is the full range. The sign matches the press dip: the side of the screen that tilts away from you is the side the light moves toward. The maths was checked in a script that builds poses in screen space for all four angles and confirms the result; what could not be checked without devices is whether every device follows the angle convention in the table, which is what the debug panel is for.

**Debugging on a device.** Add `?gyro` to the URL for a small panel showing whether the tilt is being read (or why not, for example "off (iOS asks for permission)"), how many events arrive per second, the raw `alpha` / `beta` / `gamma`, the screen angle, the derived light position and the values driving the foil.

**What the CSS does (section 6 of `css/styles.css`).**

- Two decorative layers sit on top of the card content inside `.holo`: *foil* (broad colour bands: silver in dark mode, rainbow in light mode, both kept subtle) and *sparkle* (glitter dots of varied sizes). Each is blended into the card with `mix-blend-mode`; the face is an isolated stacking context, so nothing leaks out. There is no "glare" spot: a round white highlight following the pointer was tried and removed.
- Each layer is **exactly card-sized and only its background moves** (`background-position`; the foil travels about 28% of the card, the sparkle only about 9 mm: it drifts gently. It was 47 mm at first, far too strong). A first version used oversized layers moved with `transform`, which is cheaper to animate but, once blended, left thin seams at the edges of the moved layers. Repeating backgrounds have no edges, so nothing can show. The foil is not repeating (it is a single image at 200% of the face) so its position is expressed in percentages, which cover the face completely from 0% to 100% in either orientation; a first version used em offsets tuned for the landscape card and left an uncovered strip on the right of the portrait card at full tilt.
- **The glitter is one generated tile, not CSS gradients.** Tiled CSS gradients repeat every few em, so however many layers you stack the dots fall into a visible lattice (this happened with seven of them). `tools/generate-sparkle.js` writes `assets/sparkle.svg`: 200 x 120 em (far larger than the card plus the drift), about 160 dots placed with Poisson-disc sampling (no two closer than 10 em) from a fixed seed, sizes skewed toward fine specks with a few larger dots, measured on a torus and drawn on both sides of the edges so it wraps without a seam. One SVG unit is one em, so it scales with the card.
- **Parallax:** the text, links, QR stamp and toggle are translated by different amounts (0.2, 0.35, 0.5 and 0.25 mm at full tilt; the first version used 0.5 to 1.2 mm, which was far too strong inside the card), as if they floated at different heights above the paper, and the background pattern drifts the other way. The background is a fixed `body::before` layer for the same no-repaint reason.
- **Per-theme blend modes.** Dark paper takes `screen` for foil and sparkle; light paper needs `multiply` / `overlay` or nothing shows. The strengths are tokens (`--holo-*`) in each theme.

**Decisions and cautions.**

- The effect is intentionally subtle (foil opacity 0.05 on dark, 0.04 on light, glitter 0.2 and 0.1, rising by about 40% only while the pointer is active). Earlier values (0.34 rainbow, 0.2 silver, then 0.11 / 0.08, 0.07 / 0.04 and briefly 0.03 / 0.02, which was too faint) were not right.
- The foil also once had fine horizontal "brushed metal" lines; with the glitter they read as a grid texture, so they were removed.
- `.holo` never receives pointer events and is `aria-hidden`.
- **Reduced motion:** `js/holo.js` does not run, so the foil and parallax stay at their static resting values and there is no idle drift, gyro or hover tilt.
- **Battery:** the loop only writes a handful of custom properties, throttles to about 30 fps when idle, and stops while the tab is hidden.
- To photograph a specific look, run the browser with reduced motion forced (`--force-prefers-reduced-motion` in Chromium), then set `--px`, `--py`, `--holo` and the tilt properties by hand.

## Card material

The card face is translucent paper: a tint (`--card-bg`), a faint diagonal sheen, a lit rim, a soft shadow and a tiled noise "grain". There is **no `backdrop-filter`**: Firefox drops it on 3D-transformed elements (the card is one) and glitches while such an element turns, so the earlier frosted-glass version looked different on Android Firefox than elsewhere. Tint alone is identical everywhere.

## Touch and gestures

`.card` uses `touch-action: manipulation`: panning, pinch-zoom and pull-to-refresh still work when a drag starts on the card (on a phone the card covers most of the screen, so blocking them made the page feel stuck); only double-tap zoom is disabled. A cancelled press (the browser took over the touch) just releases the tilt.

## Links and the theme toggle

- The social links' hit boxes never move: only the icon inside lifts on hover/press. If the box lifted with the icon, a pointer near its bottom edge fell off it and the link flickered.
- Hover styles are behind `@media (hover: hover)`, because touch browsers keep `:hover` on the tapped element. Press feedback uses `:active` (transient) and keyboard focus keeps a visible ring.
- The theme toggle is a `<button>` with a constant label and `aria-pressed` for its state. Buttons do not inherit `font-size`, so the CSS sets `font-size: inherit`; otherwise the toggle would not scale with the card.
- **Dark is the default** (the base `:root` tokens are the dark ones; `[data-theme="light"]` overrides them), so the page is dark with no saved choice and even with JavaScript off. The saved theme is applied before first paint by an inline script (no flash), and `<meta name="theme-color">` follows the theme.

## Testing

There is no test framework. What exists:

- `npm run check` (`tools/check.js`): JavaScript parses; every local `href`/`src` exists; every `<img>` has `alt`; exactly one `<h1>`; every CSS `var(--x)` without a fallback is defined; card size and gutter constants agree between CSS and JS; the generated QR block is present.
- **Manual matrix** before a release: light and dark; landscape and portrait; a window that forces a shrink; a real iOS Safari and Android Firefox (the engines that behaved differently); the three-press turn on the left, right, top, bottom and corners; pull-to-refresh; `prefers-reduced-motion`.
- When comparing screenshots for a refactor, freeze CSS transitions first, and note that headless browsers may not advance animations.

## Known constraints

- The text sizes are tuned for 90 x 55 mm; a different card size needs both layouts re-checked.
- The perspective and easing constants were tuned by eye on real devices; change them with `?slow` open.
- Fonts come from Google Fonts. To go fully offline, self-host Noto Sans and replace the two `<link>` tags.
