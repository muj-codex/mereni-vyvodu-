import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(<App />);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        const signal = () => {
          if (navigator.serviceWorker.controller)
            window.dispatchEvent(new Event('app-offline-ready'));
        };
        signal();
        // Revalidate on launch and when returning to the installed PWA. Identity and DB stay stable.
        const update = () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => {});
        };
        update();
        document.addEventListener('visibilitychange', update);
        navigator.serviceWorker.addEventListener('controllerchange', signal);
        reg.addEventListener('updatefound', () => {
          reg.installing?.addEventListener('statechange', signal);
        });
      })
      .catch((error) => console.error('Offline příprava selhala:', error));
  });
}
