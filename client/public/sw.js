/*
 * Service Worker — Asistente de Catán (PWA)
 * ──────────────────────────────────────────────────────────────────────────
 * Objetivo doble:
 *   1) Hacer la app INSTALABLE (Chrome/Edge/Android exigen un SW con manejador
 *      de `fetch` + un manifest válido).
 *   2) Carga rápida y arranque básico sin red, SIN romper el tiempo real.
 *
 * Reglas de oro de una app en vivo (Socket.IO + REST de auth):
 *   - NUNCA interceptar `/socket.io/` ni `/api/`: el estado de la partida y la
 *     sesión deben ir siempre a la red. El SW los deja pasar tal cual.
 *   - La navegación (cargar la app) es NETWORK-FIRST: si hay red, siempre sirve
 *     el HTML fresco (así un deploy nuevo se ve al instante); sin red, cae al
 *     app shell cacheado para que la app al menos abra.
 *   - Los assets con hash de Vite (`/assets/*`), íconos y el manifest son
 *     inmutables → STALE-WHILE-REVALIDATE (instantáneos, se refrescan detrás).
 *
 * Al cambiar la lógica de este archivo, sube CACHE_VERSION para invalidar lo
 * viejo (el `activate` borra cachés con otra versión).
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `catan-assistant-${CACHE_VERSION}`;
const APP_SHELL = '/index.html';

// Precarga mínima del app shell para el primer arranque offline.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(['/', APP_SHELL]))
      .catch(() => undefined) // si la red falla en install, no bloquear
      .then(() => self.skipWaiting())
  );
});

// Limpiar cachés de versiones anteriores y tomar control de inmediato.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('catan-assistant-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Permitir que la página pida activación inmediata de un SW nuevo.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.ico' ||
    /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ttf)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo GET del mismo origen. Lo demás (POST, otros orígenes) va directo a red.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Tiempo real y auth: jamás se cachean ni interceptan.
  if (url.pathname.startsWith('/socket.io/') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Navegación (abrir la app): network-first con fallback al app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Guardar copia fresca del shell para el próximo arranque offline.
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy));
          return res;
        })
        .catch(() =>
          caches.match(APP_SHELL).then((cached) => cached ?? caches.match('/'))
        )
    );
    return;
  }

  // Assets inmutables: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached ?? network;
        })
      )
    );
  }
});
