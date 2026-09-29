#!/usr/bin/env node
/**
 * Dependency-free sanity checks for the site. Run with `npm run check`.
 *
 *  - JavaScript files parse
 *  - every local href/src in index.html points at an existing file
 *  - every <img> has an alt attribute; there is exactly one <h1>
 *  - every CSS var(--x) without a fallback is defined somewhere
 *  - the card size / gutter constants in js/card.js match the CSS
 *  - the generated QR block is present in index.html
 *
 * Exits non-zero when something is wrong, so it can run in CI or a git hook.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const problems = [];
const fail = (message) => problems.push(message);

// --- JavaScript parses -------------------------------------------------------
const scripts = [
    ...fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => f.endsWith('.js')).map((f) => `tools/${f}`)
];
for (const file of scripts) {
    try {
        // A leading shebang is valid for Node but not for the parser
        new vm.Script(read(file).replace(/^#!.*/, ''), { filename: file });
    } catch (err) {
        fail(`${file}: ${err.message}`);
    }
}

// --- index.html --------------------------------------------------------------
const html = read('index.html');

for (const [, attr, target] of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|data:|#)/.test(target)) continue;
    const file = target.split(/[?#]/)[0];
    if (!fs.existsSync(path.join(ROOT, file))) fail(`index.html: ${attr}="${target}" does not exist`);
}

for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt=/.test(tag)) fail(`index.html: <img> without alt: ${tag.slice(0, 60)}`);
}

const h1Count = (html.match(/<h1\b/g) || []).length;
if (h1Count !== 1) fail(`index.html: expected exactly one <h1>, found ${h1Count}`);

if (!/<html[^>]*\blang="/.test(html)) fail('index.html: <html> has no lang attribute');
if (!/<!-- qr:start[\s\S]*<svg[\s\S]*<!-- qr:end -->/.test(html)) {
    fail('index.html: generated QR block missing (run `npm run qr`)');
}

// --- CSS ---------------------------------------------------------------------
const css = read('css/styles.css');
const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
for (const [, name] of css.matchAll(/var\((--[\w-]+)\s*\)/g)) { // no fallback given
    if (!defined.has(name)) fail(`css/styles.css: var(${name}) is never defined`);
}

// --- constants shared between CSS and JS ------------------------------------
const cardJs = read('js/card.js');
const num = (source, pattern, label) => {
    const match = source.match(pattern);
    if (!match) { fail(`could not find ${label}`); return NaN; }
    return Number(match[1]);
};
const pairs = [
    ['card width', num(cardJs, /const CARD_W = (\d+)/, 'CARD_W in js/card.js'), num(css, /--card-w:\s*(\d+)/, '--card-w in css')],
    ['card height', num(cardJs, /const CARD_H = (\d+)/, 'CARD_H in js/card.js'), num(css, /--card-h:\s*(\d+)/, '--card-h in css')],
    ['gutter', num(cardJs, /const GUTTER = (\d+)/, 'GUTTER in js/card.js'), num(css, /\.stage\s*\{[^}]*padding:\s*(\d+)px/, '.stage padding in css')]
];
for (const [label, fromJs, fromCss] of pairs) {
    if (fromJs !== fromCss) fail(`${label}: js/card.js says ${fromJs}, css says ${fromCss}`);
}

// --- report ------------------------------------------------------------------
if (problems.length) {
    console.error(`check failed (${problems.length}):`);
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
}
console.log(`check passed (${scripts.length} scripts, index.html, css/styles.css).`);
