/* eslint-disable no-restricted-globals */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

// Permet au service worker de prendre le contrôle immédiatement
clientsClaim();

// Pré-cache tous les actifs générés par le processus de build
precacheAndRoute(self.__WB_MANIFEST);

// Configuration du routage App Shell pour les requêtes de navigation
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }) => {
    // Ne pas appliquer le routage App Shell pour les requêtes non-HTML ou les URLs avec extensions
    if (request.mode !== 'navigate' || url.pathname.match(fileExtensionRegexp)) {
      return false;
    }
    return true;
  },
  createHandlerBoundToURL('/index.html')
);

// Mise en cache des ressources statiques (images, CSS, JS) avec la stratégie StaleWhileRevalidate
registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'style' ||
    request.destination === 'script',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
      }),
    ],
  })
);

// Gestion des notifications push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Notification Pixels Media';
  const options = {
    body: data.body || 'Vous avez reçu une nouvelle notification.',
    icon: '/logo192.png', // Icône du manifeste React
    badge: '/logo192.png',
    data: {
      url: data.data?.url || 'http://localhost:3000', // URL par défaut vers l'application
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Gestion du clic sur une notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || 'http://localhost:3000';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Vérifier si une fenêtre est déjà ouverte
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Gestion de l'activation du service worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activé');
  event.waitUntil(clients.claim());
});
