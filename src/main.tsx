import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '@fontsource/rubik/hebrew-400.css';
import '@fontsource/rubik/hebrew-700.css';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-700.css';
import './styles/index.css';

// Trigger SW update check whenever the user brings the app to foreground.
// iOS Safari PWA won't auto-check for SW updates — this forces it every time.
if ('serviceWorker' in navigator) {
  const triggerUpdate = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch { /* ignore network errors */ }
  };

  // Check on startup
  window.addEventListener('load', triggerUpdate);

  // Check every time user returns to the app (re-opens from background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerUpdate();
  });

  // Reload page when new SW takes control (new version active)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

import { initAnalytics } from './services/analytics';
const _deviceId = localStorage.getItem('expense_device_id') ?? 'anonymous';
initAnalytics(_deviceId);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
