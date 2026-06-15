import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el elemento #root');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: registrar el service worker (lo que hace la app instalable y permite el
// arranque básico sin red). Solo en producción: en `vite dev` un SW interfiere
// con el HMR. El archivo vive en client/public/sw.js → se sirve en /sw.js.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
