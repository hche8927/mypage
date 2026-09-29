# Changelog

All notable changes to this site. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org).

## [Unreleased]

## [3.1.1] - 2026-09-29

### Fixed
- In the vertical layout, tilting far to the right slid the foil off the card and revealed a strip with no foil. The foil position is now relative to the card, so it covers it fully in both orientations.

### Changed
- The parallax inside the card is about 60% gentler, and the glitter drifts about 80% less.
- The foil and the glitter are weaker in both themes (foil 0.03 dark / 0.02 light, glitter 0.2 / 0.1).
- The largest glitter dots are about 40% smaller.

## [3.1.0] - 2026-09-29

### Added
- `?gyro` in the URL shows a debug panel for the tilt effect: permission state, events per second, the raw `alpha` / `beta` / `gamma`, the screen angle, and the derived foil position; on iOS it includes an "Enable motion sensors" button.
- **Holographic foil and parallax**, in the spirit of the foil cards in Pokemon TCG Pocket: a subtle foil (silver in dark mode, rainbow in light mode) and glitter of varied sizes slide across the card as the pointer or the device moves; the text, links, QR stamp and toggle float at different depths; the background pattern drifts the other way; the card leans toward the pointer. It drifts on its own when nothing is moving. Driven by the new `js/holo.js`; nothing moves with `prefers-reduced-motion`.
- `tools/generate-sparkle.js` (`npm run sparkle`) generates `assets/sparkle.svg`, an irregular, seamlessly wrapping glitter tile, so the dots never line up into a visible grid.
- On iPhones and iPads the first tap asks permission to read the motion sensors (needed for the tilt effect).
- `npm run check` now also verifies that every element id the scripts look up exists in the page.

### Changed
- **The tilt effect now works with the screen turned sideways** (landscape). Device angles are converted through the direction of gravity and the screen's rotation, instead of using `beta` / `gamma` directly, which swap roles when the phone is turned.
- **The page is dark by default** (was light). A saved choice still wins.
- The background pattern is a fixed layer of its own instead of the `html` background, so it can drift without repainting.

### Removed
- The QR code is no longer a link; it is only for scanning.

## [3.0.0] - 2026-09-29

A major release: a codebase-wide refactor plus the project's first licence. The page looks and behaves the same for visitors, but the file layout moved (for example `imdb.svg` is now `assets/imdb.svg`, and the Font Awesome and QR libraries are no longer loaded), so anything that linked to those files or copied the old structure needs updating.

### Added
- **Licence:** the project is now under CC BY-NC 4.0 (`LICENSE`). The README explains what that means and what stays third-party.
- **Credit** for the background pattern, "Tic Tac Toe" from [Hero Patterns](https://heropatterns.com/) by Steve Schoger (CC BY 4.0), in the README, the CSS and the HTML.
- README, this changelog and `docs/ARCHITECTURE.md`.
- `tools/check.js` (`npm run check`), `tools/generate-qr.js` (`npm run qr`), `tools/serve.js` (`npm run serve`) and `package.json` scripts; none has a dependency.
- `.editorconfig`, `.gitattributes` (LF line endings) and a fuller `.gitignore`.
- `<meta>` tags for canonical URL, Open Graph and `theme-color` (kept in sync with the theme), an SVG favicon file, and `aria-pressed` on the theme toggle.

### Changed
- Refactored the codebase: `js/card.js` is organised into named sections with grouped constants and single-purpose helpers; `css/styles.css` into numbered sections, with stale comments and unused tokens removed.
- Social icons (LinkedIn, GitHub, Scholar) are inline SVG instead of the Font Awesome icon font, which removes a render-blocking stylesheet and a font download. They sit where the glyphs sat, within anti-aliasing differences.
- The QR code is rendered ahead of time by `tools/generate-qr.js` and inlined in the HTML, so the QR library is no longer downloaded and the code no longer pops in after load.
- The theme icon's half-turn is CSS only; `js/theme.js` is much smaller and tolerates blocked storage.
- The old session notes moved to `docs/archive/`.

### Removed
- The `?v=NN` cache-busting query strings (they had to be bumped by hand).

## [2.2.0] - 2026-09-29

### Changed
- The turn no longer pauses at edge-on. The old design fades out and the new one fades in as the card passes through edge-on, with the layout swapped in the fully transparent moment.

## [2.1.5] - 2026-09-29

### Fixed
- The layout swap during a turn happened while the card was still about 30% wide, so the new design was visible early. The turn now holds briefly at edge-on and swaps inside the hold.

## [2.1.4] - 2026-09-29

### Fixed
- On mobile, a flat finished card flashed and the turn seemed to play again. The turn is now one continuous animation instead of two chained ones.

### Added
- `?slow` in the URL plays the turn eight times slower for debugging.

## [2.1.3] - 2026-09-29

### Changed
- Smoother turn on mobile (the card keeps its own graphics layer; edges are anti-aliased while it turns).
- The card is less transparent.

## [2.1.2] - 2026-09-29

### Fixed
- The QR stamp differed on iOS Safari: its body is now a vector shape.
- The turn could replay on Android after a right-side press: the press tilt is cleared as the turn starts and the layout swap runs once.

## [2.1.1] - 2026-09-29

### Fixed
- Stray paper edge on the horizontal stamp on iOS (perforation tile sizes).
- Card looked too transparent on Android Firefox: the backdrop blur was dropped so the card looks the same everywhere.
- Finger gestures and pull-to-refresh were blocked by the card; they work again.

## [2.1.0] - 2026-09-29

### Changed
- Frosted-glass card, sharp vector QR code, and steadier social links and QR stamp (the link hit boxes no longer move on hover).
- Smaller QR stamp in the vertical layout.

## [2.0.0] - 2026-09-29

### Changed
- **New design:** the page is now a realistic 90 x 55 mm business card that fits any screen, with landscape and portrait orientations, a postage-stamp QR code, an on-card theme toggle, a press-tilt effect and a three-press turn easter egg.

### Removed
- The navigation bar, the hero and About sections, and the Bulma, AOS and Pacifico dependencies.

## [1.0.0] - 2026-08-26

The original classic single page: navigation bar, hero with social links, and an About section, with a liquid-glass look, a circuit-board background and light/dark themes. Notes from that version are in [docs/archive/session-log-2026-08.md](docs/archive/session-log-2026-08.md).

[Unreleased]: https://github.com/hche8927/mypage/compare/3.1.1...HEAD
[3.1.1]: https://github.com/hche8927/mypage/compare/3.1.0...3.1.1
[3.1.0]: https://github.com/hche8927/mypage/compare/3.0.0...3.1.0
[3.0.0]: https://github.com/hche8927/mypage/compare/2.2.0...3.0.0
[2.2.0]: https://github.com/hche8927/mypage/compare/2.1.5...2.2.0
[2.1.5]: https://github.com/hche8927/mypage/compare/2.1.4...2.1.5
[2.1.4]: https://github.com/hche8927/mypage/compare/2.1.3...2.1.4
[2.1.3]: https://github.com/hche8927/mypage/compare/2.1.2...2.1.3
[2.1.2]: https://github.com/hche8927/mypage/compare/2.1.1...2.1.2
[2.1.1]: https://github.com/hche8927/mypage/compare/2.1.0...2.1.1
[2.1.0]: https://github.com/hche8927/mypage/compare/2.0.0...2.1.0
[2.0.0]: https://github.com/hche8927/mypage/compare/1.0.0...2.0.0
[1.0.0]: https://github.com/hche8927/mypage/releases/tag/1.0.0
