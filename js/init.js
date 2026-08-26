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

    // iOS Safari sticks :active/:focus on the tapped element until the
    // next tap anywhere, so navbar buttons (burger / About / theme
    // toggle) look "held down" until you tap elsewhere. Blurring the
    // tapped element right after the tap releases both states while
    // real press feedback (pointer down -> up) still works.
    document.addEventListener('touchend', (e) => {
        const el = e.target.closest('.navbar-item, .navbar-link, .navbar-burger');
        if (!el) return;
        setTimeout(() => {
            const ae = document.activeElement;
            if (ae && (ae === el || el.contains(ae))) ae.blur();
        }, 0);
    }, { passive: true });
});
