import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { applyThemeById } from '@/config/theme';

// Apply theme from .env before the React tree mounts so there is no flash.
applyThemeById(import.meta.env.VITE_THEME ?? 'kaaladristi');

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
