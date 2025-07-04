import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Enregistrer le service worker pour activer les notifications push et le mode hors ligne
serviceWorkerRegistration.register({
  onSuccess: (registration) => {
    console.log('Service Worker enregistré avec succès:', registration);
  },
  onUpdate: (registration) => {
    console.log('Service Worker mis à jour:', registration);
    // Optionnel : demander à l'utilisateur de recharger pour appliquer la mise à jour
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  },
});

// Mesurer les performances de l'application (optionnel)
reportWebVitals(console.log);
