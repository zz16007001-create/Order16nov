import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  if (typeof window !== 'undefined') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          registrations.forEach((reg) => {
            reg.unregister().catch(() => {});
          });
        })
        .catch(() => {});
    }
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => {
          keys.forEach((key) => {
            caches.delete(key).catch(() => {});
          });
        })
        .catch(() => {});
    }
  }
} catch {
  // ignore
}

createRoot(document.getElementById('root')!).render(<App />);
