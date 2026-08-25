// Dark mode toggle (mobile toggle in brand + desktop toggle in menu)
(function () {
    const toggles = document.querySelectorAll('.theme-toggle');
    const icons = document.querySelectorAll('.theme-icon');

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        // Rotate the contrast icon: the solid half shows the theme you'll switch TO.
        // (Icon color adapts automatically via CSS filter on [data-theme=dark].)
        icons.forEach(icon => {
            icon.style.transform = theme === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    }

    // Sync icon with current theme (set inline in <head>)
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    icons.forEach(icon => {
        icon.style.transform = current === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)';
    });

    toggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const next = (document.documentElement.getAttribute('data-theme') === 'dark')
                ? 'light'
                : 'dark';
            applyTheme(next);
        });
    });
})();
