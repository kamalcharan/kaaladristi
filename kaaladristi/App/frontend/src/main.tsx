import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { applyThemeById } from '@/config/theme';

// Apply theme from .env before the React tree mounts so there is no flash.
applyThemeById(import.meta.env.VITE_THEME ?? 'kaaladristi');

// Service worker management.
// A stale SW from a prior deployment can intercept /api/ and /db/ requests,
// returning empty responses and breaking all API calls. We replace it with a
// no-op SW (public/sw.js) that immediately activates, clears all caches, and
// never intercepts any fetch. This runs before React mounts so the network is
// clean before any data fetching begins.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      // Re-register with our no-op SW only if the scope doesn't already point
      // to /sw.js (prevents re-registering on every page load).
      const swUrl = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? '';
      if (!swUrl.endsWith('/sw.js')) {
        reg.unregister();
      }
    }
  });
  // Register the no-op SW so browsers that never had one also get it,
  // ensuring any future stale SW is replaced on the next deploy.
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
