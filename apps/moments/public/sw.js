// Service worker for the installable app. It caches nothing on purpose: uploads must always
// reach the server live, so every request goes straight to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
