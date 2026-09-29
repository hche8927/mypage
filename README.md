# haodong.page

The personal website of Haodong (Tom) Chen: an interactive, realistic **90 x 55 mm business card** (the Australian standard size) that fits itself to any screen.

Live at **<https://haodong.page>**.

## Features

- **Real card dimensions.** The card is 90 x 55 mm at 2x real size and scales down (never up) to fit small screens.
- **Two orientations, one card.** Landscape if it fits, otherwise portrait, otherwise it shrinks. The choice follows the screen and its rotation.
- **Feels physical.** Pressing the card dips it toward the pressed point and it springs back. Three quick presses in one spot turn it over to the other orientation, spinning the way it was pushed (a small easter egg).
- **Light and dark themes** with the choice remembered.
- **Sharp everywhere.** The QR code and its postage-stamp border are vector graphics, so they render identically in every browser and at every scale.
- **No runtime dependencies.** Plain HTML, CSS and JavaScript with no framework and no build step; the only third-party request is the Noto Sans web font, which falls back to system fonts.
- **Accessible.** Semantic markup, labelled links and toggle (`aria-pressed`), visible keyboard focus, no keyboard trap, and `prefers-reduced-motion` is respected.

## Quick start

Open `index.html` in a browser; it works straight from disk.

To serve it (needed to test from a phone on your network, or to check how it behaves when served), you need [Node.js](https://nodejs.org) 18 or newer. There is nothing to install:

```sh
npm run serve      # http://localhost:8000  (PORT=3000 npm run serve to change it)
npm run check      # sanity checks: syntax, local links, CSS variables, shared constants
npm run qr         # regenerate the QR code in index.html (see "Changing the QR code")
```

Adding `?slow` to the address (for example `http://localhost:8000/?slow`) plays the turn animation eight times slower, which helps when debugging it.

## Project structure

```
index.html            The whole page: one card (front face) plus the stamp artwork
css/styles.css        Design tokens, layout, card, stamp, links, toggle
js/card.js            Fitting (orientation + scale), press tilt, turn animation
js/theme.js           Light/dark toggle
assets/               favicon.svg, imdb.svg, theme-toggle.png
tools/
  check.js            Dependency-free sanity checks (npm run check)
  generate-qr.js      Renders the QR code into index.html (npm run qr)
  serve.js            Tiny static server for local development
  vendor/             qrcode.min.js, used only by generate-qr.js (MIT)
docs/
  ARCHITECTURE.md     How it works and why (read this before changing the card)
  archive/            Notes from earlier versions, kept for reference
CHANGELOG.md          Release history
CNAME                 Custom domain for GitHub Pages
```

## How it works, briefly

The card is drawn in **millimetres**: inside `.card-scene`, `1em = 1mm x --scale`, so every dimension is written in `em` and the whole card scales as one piece. `js/card.js` measures the screen, picks landscape or portrait and a scale, and writes `data-orient` and `--scale` onto the scene. Everything else is CSS.

The full design notes (the turn animation, the cross-browser decisions and the reasons behind them) are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Common changes

**Edit the content.** Text and links are in `index.html`, inside the `<article class="face">`. Colours and the card material are the custom properties at the top of `css/styles.css`.

**Change the card size.** Set `--card-w` / `--card-h` in the CSS (`.card-scene`) *and* `CARD_W` / `CARD_H` in `js/card.js`. `npm run check` fails if they disagree. Then re-check both layouts, since the text sizes are tuned for 90 x 55 mm.

**Changing the QR code.** The QR code is generated ahead of time and pasted into `index.html` between the `qr:start` and `qr:end` comments; visitors never download a QR library.

```sh
npm run qr                          # https://haodong.page
node tools/generate-qr.js https://example.com
```

Also update the `href` and `aria-label` of the `.qr` link.

**Tune the interaction.** All the numbers (tilt angle, press count and time window, turn duration and easing) are constants at the top of `js/card.js`, each with a comment.

## Browser support

Current versions of Chrome, Edge, Firefox and Safari (desktop, iOS and Android). The page relies on CSS `svh` units, `will-change`, the Web Animations API and `text-wrap: balance` (the last one only improves line breaks). Without JavaScript the card is shown at its default size and orientation, and the toggle and turn do nothing.

## Deployment and releases

The site is served by **GitHub Pages** from the `main` branch (root folder). Pushing to `main` deploys it; there is no build.

- Work happens on `dev`; merge into `main` to release.
- Releases are tagged with [semantic versions](https://semver.org) (`2.2.0`) and described in [CHANGELOG.md](CHANGELOG.md).
- Push branches and tags with separate `git push` commands. A single push that carries several refs can silently skip the Pages build.
- After a deploy, hard-refresh (`Ctrl+F5`) to bypass the browser cache; Pages sends a 10 minute cache lifetime.

## Credits and third-party material

| What | Source | Licence |
| --- | --- | --- |
| Theme toggle icon ("Half") | Freepik, [flaticon.com](https://www.flaticon.com/free-icon/half_3342251) | CC BY 3.0 (attribution required) |
| LinkedIn, GitHub and graduation-cap icons (inline SVG) and the favicon glyph | [Font Awesome Free 6.5.1](https://fontawesome.com/license/free) | Icons: CC BY 4.0 |
| IMDb mark (`assets/imdb.svg`) | Official [IMDb brand toolkit](https://brand.imdb.com); IMDb's brand guidelines apply | Trademark of IMDb |
| Noto Sans | Google Fonts | SIL OFL 1.1 |
| QR generator (`tools/vendor/`) | [qrcodejs](https://github.com/davidshimjs/qrcodejs) by Shim Sangmin | MIT |

The circuit-style background tile (crosses and circles) has no recorded source. If it came from a pattern library such as Hero Patterns (CC BY 4.0), add the credit here.

The repository has no licence file yet, so by default all rights are reserved. Add a `LICENSE` if you want others to reuse the code.
