// src/serviceWorkerRegistration.js
export function register(config) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      // Check if the service worker file exists before registering
      fetch(swUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Service worker file not found at ${swUrl} (HTTP ${response.status})`);
          }
          return navigator.serviceWorker.register(swUrl);
        })
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) {
              return;
            }
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('New content is available; please refresh.');
                  if (config && config.onUpdate) {
                    config.onUpdate(registration);
                  }
                } else {
                  console.log('Content is cached for offline use.');
                  if (config && config.onSuccess) {
                    config.onSuccess(registration);
                  }
                }
              }
            };
          };
        })
        .catch((error) => {
          console.error('Error during service worker registration:', error);
        });
    });
  } else {
    console.warn('Service workers are not supported in this browser.');
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        console.log('Service Worker unregistered.');
      })
      .catch((error) => {
        console.error('Error during service worker unregistration:', error);
      });
  } else {
    console.warn('Service workers are not supported in this browser.');
  }
}
