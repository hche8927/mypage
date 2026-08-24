// Dark mode toggle
(function () {
    const toggle = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon');

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    // Sync icon with current theme (set inline in <head>)
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    if (icon) {
        icon.className = current === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
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
