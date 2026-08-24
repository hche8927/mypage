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
            result = result ? result[segment] : undefined;
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
        const navMap = {
            '#about': 'nav.about',
            '#experience': 'nav.experience',
            '#research': 'nav.research',
            '#projects': 'nav.projects',
            '#contact': 'nav.contact'
        };
        for (const [href, key] of Object.entries(navMap)) {
            const el = document.querySelector(`a[href="${href}"]`);
            if (el) el.textContent = this.t(key);
        }
        document.getElementById('currentLang').textContent = this.t('nav.language');

        // Update welcome section
        document.querySelector('#welcome .title').innerHTML = `
            ${this.t('welcome.hello')}<br>
            ${this._locale === 'en' ? 'Haodong Chen' : '陈 浩 东'}<br>
            <hr style="width: 300px; margin: 1rem auto 0.5rem auto;">
            ${this._locale === 'en' ? '陈 浩 东' : 'Haodong Chen'}<br>
            <span class="is-size-4">${this.t('welcome.callMeTom')}</span>
        `;
        const tagline = document.querySelector('[data-i18n="welcome.tagline"]');
        if (tagline) tagline.textContent = this.t('welcome.tagline');

        // Update about section
        document.querySelector('#about .title.is-2').textContent = this.t('about.title');
        document.querySelector('#about .content p').textContent = this.t('about.content');
        const eduTitle = document.querySelector('[data-i18n="about.education.title"]');
        if (eduTitle) eduTitle.textContent = this.t('about.education.title');
        const eduList = document.querySelector('#about .content ul');
        if (eduList) {
            eduList.innerHTML = `
                <li><b>${this.t('about.education.phd')}</b><br>
                    <span class="is-size-6">${this.t('about.education.phdDetail')}</span></li>
                <li><b>${this.t('about.education.bachelor')}</b></li>
            `;
        }

        // Update experience section
        const expTitle = document.querySelector('#experience .title.is-2');
        if (expTitle) expTitle.textContent = this.t('experience.title');
        const expBlocks = document.querySelectorAll('#experience .content.mb-5, #experience div.content');
        const expKeys = ['finvfx', 'research', 'tutor', 'swd', 'hampr'];
        expKeys.forEach((key, i) => {
            const block = expBlocks[i];
            if (!block) return;
            block.querySelector('.title.is-4').textContent = this.t(`experience.${key}.title`);
            block.querySelector('.has-text-grey').textContent = this.t(`experience.${key}.period`);
            const body = block.querySelectorAll('p');
            body[body.length - 1].textContent = this.t(`experience.${key}.description`);
        });

        // Update research section
        const resTitle = document.querySelector('#research .title.is-2');
        if (resTitle) resTitle.textContent = this.t('research.title');
        const resCards = document.querySelectorAll('#research .paper-card');
        const resKeys = ['ammnet', 'skim', 'hdgs', 'linear', 'neuro'];
        resKeys.forEach((key, i) => {
            const card = resCards[i];
            if (!card) return;
            card.querySelector('.title.is-4').textContent = this.t(`research.${key}.title`);
            card.querySelector('.content').textContent = this.t(`research.${key}.description`);
        });

        // Update projects section
        document.querySelector('#projects .title.is-2').textContent = this.t('projects.title');
        const projectCards = document.querySelectorAll('#projects .paper-card');
        const projKeys = ['vrSolarSystem', 'cateringGeofencing', 'invoiceManagement'];
        projKeys.forEach((key, i) => {
            const card = projectCards[i];
            if (!card) return;
            card.querySelector('.title.is-4').textContent = this.t(`projects.${key}.title`);
            card.querySelector('.content').textContent = this.t(`projects.${key}.description`);
        });

        // Update contact section
        document.querySelector('#contact .title.is-2').textContent = this.t('contact.title');
        document.querySelector('#contact .content > p').textContent = this.t('contact.content');

        // Update html lang attribute
        document.documentElement.lang = this._locale;
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
