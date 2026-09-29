/**
 * Light / dark theme toggle.
 *
 * The saved theme is applied before first paint by the inline script in
 * index.html (to avoid a flash); this file keeps the buttons in sync with it and
 * handles clicks. Keep STORAGE_KEY and DEFAULT_THEME in sync with that script.
 * The icon's half-turn and colour inversion are pure CSS (see css/styles.css).
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'theme';
    const DEFAULT_THEME = 'light';
    const THEME_COLOR = { light: '#F5EFE4', dark: '#0d1117' }; // <meta name="theme-color">

    const root = document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const toggles = document.querySelectorAll('.theme-toggle');

    function loadTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
        } catch (err) {
            return DEFAULT_THEME; // storage blocked (private mode, strict settings)
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (err) {
            /* not persisted; the choice still applies to this visit */
        }
    }

    function applyTheme(theme) {
        root.setAttribute('data-theme', theme);
        if (metaThemeColor) metaThemeColor.setAttribute('content', THEME_COLOR[theme]);
        toggles.forEach((button) => button.setAttribute('aria-pressed', String(theme === 'dark')));
    }

    applyTheme(root.getAttribute('data-theme') || loadTheme());

    toggles.forEach((button) => {
        button.addEventListener('click', () => {
            const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            saveTheme(next);
        });
    });
})();
