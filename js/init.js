// Initialize AOS with configuration
AOS.init({
    duration: 0,
    once: true
});

// Mobile menu functionality
document.addEventListener('DOMContentLoaded', () => {
    const burger = document.querySelector('.navbar-burger');
    const menu = document.querySelector('.navbar-menu');

    const toggleMenu = () => {
        burger.classList.toggle('is-active');
        menu.classList.toggle('is-active');
    };

    burger.addEventListener('click', toggleMenu);
}); 
