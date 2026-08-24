// Dark mode toggle
(function () {
    const toggle = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon');

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        // Show the icon of the theme you'll switch TO (contrast circle icon works both ways)
        if (icon) {
            icon.className = 'fa-solid fa-circle-half-stroke';
            icon.style.transform = theme === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }

    // Sync icon with current theme (set inline in <head>)
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    if (icon) {
        icon.style.transform = current === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)';
    }

    if (toggle) {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const next = (document.documentElement.getAttribute('data-theme') === 'dark')
                ? 'light'
                : 'dark';
            applyTheme(next);
        });
    }
})();
