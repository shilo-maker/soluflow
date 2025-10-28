import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css'; // Bootstrap base
import './styles/modern.css'; // Modern design system
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for offline support
serviceWorkerRegistration.register({
  onSuccess: () => {
    console.log('SoluFlow is now available offline!');
  },
  onUpdate: (registration) => {
    console.log('New version available! Auto-updating...');

    // Immediately activate the new service worker and reload
    const waitingWorker = registration.waiting;

    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });

      // Reload the page once the new service worker is activated
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  },
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
