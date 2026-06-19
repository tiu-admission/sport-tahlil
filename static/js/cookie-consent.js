// static/js/cookie-consent.js
document.addEventListener('DOMContentLoaded', () => {
    // Check if user has already made a cookie choice
    const cookieConsent = localStorage.getItem('cookie_consent');

    if (cookieConsent === null) {
        // User hasn't made a choice yet, show the cookie banner
        showCookieBanner();
    }

    function showCookieBanner() {
        // Create cookie consent banner
        const cookieBanner = document.createElement('div');
        cookieBanner.className = 'cookie-banner';
        cookieBanner.id = 'cookie-banner';

        // Banner content with animation
        cookieBanner.innerHTML = `
            <div class="cookie-content">
                <div class="cookie-icon">
                    <i class="fas fa-cookie-bite"></i>
                </div>
                <div class="cookie-text">
                    <h3>We Value Your Privacy</h3>
                    <p>This site uses cookies to enhance your experience, analyze site traffic, and assist in our marketing efforts. 
                    By continuing to use this site, you agree to our <a href="/privacy">privacy policy</a>.</p>
                </div>
                <div class="cookie-buttons">
                    <button id="accept-cookies" class="cookie-accept">Accept All</button>
                    <button id="reject-cookies" class="cookie-reject">Reject Non-Essential</button>
                    <button id="customize-cookies" class="cookie-customize">Customize</button>
                </div>
            </div>
        `;

        // Add the banner to the DOM
        document.body.appendChild(cookieBanner);

        // Animate entry
        setTimeout(() => {
            cookieBanner.classList.add('active');
        }, 300);

        // Set up event listeners
        document.getElementById('accept-cookies').addEventListener('click', () => {
            localStorage.setItem('cookie_consent', 'accepted');
            hideCookieBanner(cookieBanner);
        });

        document.getElementById('reject-cookies').addEventListener('click', () => {
            localStorage.setItem('cookie_consent', 'rejected');
            hideCookieBanner(cookieBanner);
        });

        document.getElementById('customize-cookies').addEventListener('click', () => {
            showCustomizeCookies(cookieBanner);
        });
    }

    function hideCookieBanner(banner) {
        banner.classList.remove('active');
        banner.classList.add('dismissed');

        // Remove banner after animation completes
        setTimeout(() => {
            if (banner.parentNode) {
                banner.parentNode.removeChild(banner);
            }
        }, 500);
    }

    function showCustomizeCookies(banner) {
        // Replace banner content with cookie options
        const cookieContent = banner.querySelector('.cookie-content');

        cookieContent.innerHTML = `
            <div class="cookie-text">
                <h3>Cookie Preferences</h3>
                <p>Select which cookies you want to accept. Essential cookies are required for the website to function properly.</p>
                
                <div class="cookie-options">
                    <div class="cookie-option">
                        <label>
                            <input type="checkbox" checked disabled>
                            <span>Essential Cookies</span>
                        </label>
                        <p class="cookie-description">Required for the website to function properly.</p>
                    </div>
                    
                    <div class="cookie-option">
                        <label>
                            <input type="checkbox" id="analytics-cookies">
                            <span>Analytics Cookies</span>
                        </label>
                        <p class="cookie-description">Help us improve our website by collecting anonymous usage data.</p>
                    </div>
                    
                    <div class="cookie-option">
                        <label>
                            <input type="checkbox" id="preference-cookies">
                            <span>Preference Cookies</span>
                        </label>
                        <p class="cookie-description">Remember your settings and preferences.</p>
                    </div>
                </div>
                
                <div class="cookie-buttons">
                    <button id="save-preferences" class="cookie-accept">Save Preferences</button>
                    <button id="cancel-customize" class="cookie-reject">Cancel</button>
                </div>
            </div>
        `;

        // Re-attach event listeners
        document.getElementById('save-preferences').addEventListener('click', () => {
            const analyticsConsent = document.getElementById('analytics-cookies').checked;
            const preferenceConsent = document.getElementById('preference-cookies').checked;

            localStorage.setItem('cookie_consent', 'customized');
            localStorage.setItem('analytics_cookies', analyticsConsent ? 'accepted' : 'rejected');
            localStorage.setItem('preference_cookies', preferenceConsent ? 'accepted' : 'rejected');

            hideCookieBanner(banner);
        });

        document.getElementById('cancel-customize').addEventListener('click', () => {
            showCookieBanner();
        });
    }
});