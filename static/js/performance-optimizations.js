// static/js/performance-optimizations.js - Advanced performance enhancements

/**
 * This module contains additional performance optimizations that can be
 * implemented when the site needs further speed improvements.
 */

// Image optimization function
function optimizeImages() {
    // Convert all images to WebP format where supported
    if ('pictureSourceWebp' in document.createElement('picture')) {
        document.querySelectorAll('img:not([data-no-optimize])').forEach(img => {
            const imgSrc = img.getAttribute('src');
            if (imgSrc && !imgSrc.endsWith('.svg') && !imgSrc.startsWith('data:')) {
                // Create picture element for WebP fallback
                const picture = document.createElement('picture');

                // WebP source
                const webpSource = document.createElement('source');
                webpSource.srcset = imgSrc.replace(/\.(png|jpg|jpeg)$/i, '.webp');
                webpSource.type = 'image/webp';

                // Original source
                const originalSource = document.createElement('source');
                originalSource.srcset = imgSrc;

                // Move all attributes from img to picture
                Array.from(img.attributes).forEach(attr => {
                    if (attr.name !== 'src' && attr.name !== 'srcset') {
                        picture.setAttribute(attr.name, attr.value);
                    }
                });

                picture.appendChild(webpSource);
                picture.appendChild(originalSource);
                picture.appendChild(img.cloneNode(true));

                img.parentNode.replaceChild(picture, img);
            }
        });
    }
}

// Resource hints for faster loading
function addResourceHints() {
    // Define critical domains to preconnect
    const criticaDomains = [
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com'
    ];

    // Create preconnect links
    criticaDomains.forEach(domain => {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    });
}

// Enable HTTP/2 Server Push (server-side implementation required)
// This would go in the server configuration

// Code splitting for non-critical JavaScript
function setupCodeSplitting() {
    // Dynamic import for less critical features
    const loadNonCriticalModules = () => {
        // Wait until the page is fully loaded
        if (document.readyState === 'complete') {
            // Dynamically import non-critical modules
            import('/static/js/analytics.js').then(module => {
                module.initialize();
            }).catch(err => {
                console.warn('Non-critical module loading failed:', err);
            });
        } else {
            window.addEventListener('load', loadNonCriticalModules);
        }
    };

    loadNonCriticalModules();
}

// Implement Intersection Observer API for content lazy loading
function setupLazyContent() {
    if ('IntersectionObserver' in window) {
        const contentObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;

                    // Handle deferred content
                    if (element.dataset.src) {
                        element.src = element.dataset.src;
                        element.removeAttribute('data-src');
                    }

                    // Handle iframe lazy loading
                    if (element.tagName === 'IFRAME' && element.dataset.src) {
                        element.src = element.dataset.src;
                        element.removeAttribute('data-src');
                    }

                    // Handle HTML content lazy loading
                    if (element.dataset.content) {
                        element.innerHTML = element.dataset.content;
                        element.removeAttribute('data-content');
                    }

                    observer.unobserve(element);
                }
            });
        }, {
            rootMargin: '200px 0px', // Load when within 200px of viewport
            threshold: 0.01
        });

        // Observe all elements with lazy loading data attributes
        document.querySelectorAll('[data-src], [data-content]').forEach(element => {
            contentObserver.observe(element);
        });
    }
}

// Service Worker for offline capability and caching
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }).catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
}

// Web Worker for heavy computations
function setupWebWorker() {
    if (window.Worker) {
        const worker = new Worker('/static/js/chat-worker.js');

        // Example of offloading text processing to worker
        worker.postMessage({
            action: 'process',
            data: {
                text: 'Sample text for preprocessing'
            }
        });

        worker.onmessage = function(e) {
            console.log('Message received from worker:', e.data);
        };
    }
}

// Implement requestIdleCallback for non-critical operations
function scheduleIdleWork() {
    const idleWork = deadline => {
        // While we have time and work to do
        while (deadline.timeRemaining() > 0 && workQueue.length > 0) {
            doSomeWork(workQueue.pop());
        }

        // If there's still work to do, schedule more idle time
        if (workQueue.length > 0) {
            requestIdleCallback(idleWork);
        }
    };

    // Use requestIdleCallback or fallback to setTimeout
    if ('requestIdleCallback' in window) {
        requestIdleCallback(idleWork);
    } else {
        setTimeout(idleWork, 1);
    }
}

// Implement these optimizations when needed
// Note: This file contains advanced techniques that should be implemented
// only when basic optimizations are not sufficient.

// Export functions for selective use
export {
    optimizeImages,
    addResourceHints,
    setupCodeSplitting,
    setupLazyContent,
    registerServiceWorker,
    setupWebWorker,
    scheduleIdleWork
};