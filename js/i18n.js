// Create a simple i18n implementation
const i18n = {
    _locale: 'en',
    _messages: {},

    // Load translations from JSON files
    loadTranslations(locale) {
        return fetch(`translations/${locale}.json`)
            .then(response => response.json())
            .then(data => {
                this._messages[locale] = data;
            });
    },

    // Get translation by key path (e.g., "nav.about")
    t(key) {
        const path = key.split('.');
        let result = this._messages[this._locale];
        for (const segment of path) {
            result = result[segment];
        }
        return result || key;
    },

    // Set current locale
    setLocale(locale) {
        if (this._messages[locale]) {
            this._locale = locale;
            localStorage.setItem('preferredLanguage', locale);
            this.updateUI();
        } else {
            this.loadTranslations(locale).then(() => {
                this._locale = locale;
                localStorage.setItem('preferredLanguage', locale);
                this.updateUI();
            });
        }
    },

    // Update all UI elements
    updateUI() {
        // Update navigation
        document.querySelector('a[href="#about"]').textContent = this.t('nav.about');
        document.querySelector('a[href="#projects"]').textContent = this.t('nav.projects');
        document.querySelector('a[href="#contact"]').textContent = this.t('nav.contact');
        document.getElementById('currentLang').textContent = this.t('nav.language');

        // Update welcome section
        document.querySelector('#welcome .title').innerHTML = `
            ${this.t('welcome.hello')}<br>
            ${this._locale === 'en' ? 'Haodong Chen' : '陈 浩 东'}<br>
            <hr style="width: 300px; margin: 1rem auto 0.5rem auto;">
            ${this._locale === 'en' ? '陈 浩 东' : 'Haodong Chen'}<br>
            <span class="is-size-4">${this.t('welcome.callMeTom')}</span>
        `;

        // Update about section
        document.querySelector('#about .title.is-2').textContent = this.t('about.title');
        document.querySelector('#about .content p').textContent = this.t('about.content');

        // Update projects section
        document.querySelector('#projects .title.is-2').textContent = this.t('projects.title');
        const projectCards = document.querySelectorAll('#projects .paper-card');
        projectCards[0].querySelector('.title.is-4').textContent = this.t('projects.vrSolarSystem.title');
        projectCards[0].querySelector('.content').textContent = this.t('projects.vrSolarSystem.description');
        projectCards[1].querySelector('.title.is-4').textContent = this.t('projects.cateringGeofencing.title');
        projectCards[1].querySelector('.content').textContent = this.t('projects.cateringGeofencing.description');
        projectCards[2].querySelector('.title.is-4').textContent = this.t('projects.invoiceManagement.title');
        projectCards[2].querySelector('.content').textContent = this.t('projects.invoiceManagement.description');

        // Update contact section
        document.querySelector('#contact .title.is-2').textContent = this.t('contact.title');
        document.querySelector('#contact .content p').textContent = this.t('contact.content');
    }
};

// Replace changeLanguage function
function changeLanguage(locale) {
    i18n.setLocale(locale);
}

// Initialize with stored language or default to English
document.addEventListener('DOMContentLoaded', () => {
    const storedLang = localStorage.getItem('preferredLanguage') || 'en';
    i18n.setLocale(storedLang);
}); 