// Initialize AOS with configuration
AOS.init({
    duration: 0,
    once: true
});

// Mobile menu functionality
document.addEventListener('DOMContentLoaded', () => {
    const burger = document.querySelector('.navbar-burger');
    const menu = document.querySelector('.navbar-menu');

    const isOpen = () => menu.classList.contains('is-active');

    const closeMenu = () => {
        burger.classList.remove('is-active');
        menu.classList.remove('is-active');
        burger.setAttribute('aria-expanded', 'false');
    };

    const toggleMenu = () => {
        const open = !isOpen();
        burger.classList.toggle('is-active', open);
        menu.classList.toggle('is-active', open);
        burger.setAttribute('aria-expanded', String(open));
    };

    burger.addEventListener('click', toggleMenu);

    // Close when tapping/clicking anywhere outside the navbar
    document.addEventListener('click', (e) => {
        if (isOpen() && !menu.contains(e.target) && !burger.contains(e.target)) {
            closeMenu();
        }
    });

    // Close after choosing a nav item
    menu.querySelectorAll('.navbar-item').forEach((item) => {
        item.addEventListener('click', closeMenu);
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) {
            closeMenu();
            burger.focus();
        }
    });
});
