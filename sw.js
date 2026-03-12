/**
 * BinIt - Service Worker
 * Provides offline functionality with cache-first strategy
 */

const CACHE_NAME = 'binit-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Nunito+Sans:wght@300;400;600&display=swap'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[SW] Assets cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests except for fonts
    if (!event.request.url.startsWith(self.location.origin) && 
        !event.request.url.includes('fonts.googleapis.com') &&
        !event.request.url.includes('fonts.gstatic.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response if found
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Otherwise fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            // Allow caching of font responses
                            if (response && response.type === 'cors') {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(event.request, responseClone);
                                    });
                            }
                            return response;
                        }
                        
                        // Clone the response
                        const responseClone = response.clone();
                        
                        // Cache the fetched response
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // Return offline fallback if available
                        if (event.request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('[SW] Service worker script loaded');
