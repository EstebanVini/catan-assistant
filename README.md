# Catán Assistant

Asistente digital **mobile-first** para partidas presenciales del juego de mesa Catán. Reemplaza el papel y las cartas de recursos; el tablero físico sigue existiendo. Sincronización en tiempo real entre los celulares de los jugadores conectados a la misma sala por código.

UI en español, identificadores de código en inglés.

## Stack

- **Backend**: Node.js + Express + Socket.IO + TypeScript. Estado de cada partida en memoria.
- **Frontend**: React 18 + Vite + Zustand + Tailwind CSS + `socket.io-client` + TypeScript.
- **Un solo proceso** en producción: Express sirve el cliente compilado (`client/dist`) y mantiene el socket.

## Estructura

```
catan-assistant/
  package.json          # scripts raíz (dev, build, start, install:all, test)
  server/               # backend (Express + Socket.IO)
    src/
      index.ts          # entry: monta Express + Socket.IO, sirve client/dist
      game/
        state.ts        # tipos del dominio (Resource, Hand, Player, Hex, GameState)
        rules.ts        # lógica pura (costos, distribución, 7, robo, trade)
        rules.test.ts   # tests unitarios (vitest)
        rooms.ts        # gestión de salas en memoria + snapshots para undo
      socket/
        handlers.ts     # eventos cliente <-> servidor
        views.ts        # vista personalizada por jugador (oculta manos ajenas)
  client/               # frontend (React + Vite)
    src/
      main.tsx
      App.tsx
      socket.ts         # cliente Socket.IO con reconexión
      store.ts          # estado global (Zustand)
      screens/          # HomeScreen, LobbyScreen, GameScreen
      components/       # HandView, ActionGrid, BankPanel, ProductionTable, ...
      lib/              # persistence, motion, playerColors, spanish, useModalA11y
  docs/
    ux-brief-mvp.md     # contrato de UX del MVP
  plan.md               # plan completo de desarrollo
  prompt-claude-code-catan.md
```

## Requisitos

- Node.js ≥ 18
- npm ≥ 9

## Instalación

```bash
npm run install:all
```

Esto instala las dependencias en la raíz, en `server/` y en `client/`.

## Desarrollo

```bash
npm run dev
```

- Server con `tsx watch` en `http://localhost:3001`.
- Client con Vite en `http://localhost:5173` (proxy `/socket.io` al server).

## Producción (un solo proceso, un solo puerto)

```bash
npm run build
npm start
```

- `build` compila el cliente a `client/dist`.
- `start` arranca el server, que sirve los estáticos del cliente y el SPA fallback.

Por defecto escucha en el puerto `3001`. Configurable con la variable de entorno `PORT`.

## Tests

```bash
npm test
```

Vitest cubre la lógica pura de `server/src/game/rules.ts`: distribución con banco limitado, descartes tras el 7, proporciones de intercambio con banco/puertos.

## Alcance actual (Fase 1 — MVP)

- Crear sala / unirse por código / reconectar desde `localStorage`.
- Lobby con código compartible, selección de color (sin repetir), reordenar turnos, encargado del banco, toggle Extensión 5–6.
- Pantalla de juego con barra de turno, mano privada, acciones (construir, intercambiar, terminar turno), panel del encargado del banco (teclado 2–12 + deshacer), tabla de producción editable, estado público de jugadores, log cronológico.
- Distribución automática de recursos con banco limitado (regla oficial).
- Secuencia del 7 completa: descarte forzado, mover ladrón, robo aleatorio.
- Intercambio con banco/puertos y entre jugadores (oferta / aceptar / rechazar).
- Cartas de desarrollo: compra y juego de Caballero (mover ladrón + robar).
- Mobile-first verificado (360–414 px), accesibilidad WCAG AA en componentes interactivos, micro-interacciones funcionales con `prefers-reduced-motion` respetado.

## Próximo (Fase 2)

- Cartas de desarrollo completas (Monopolio, Año de la abundancia, Construcción de caminos).
- Marcador de puntos de victoria + insignias (Ejército más grande automático, Camino más largo manual) + declarar victoria a 10.
- Extensión 5–6 jugadores activa: Fase de Construcción Especial entre turnos.
- Estadísticas de dados (histograma).
- Vibración de turno + notificaciones.

## Privacidad

Las manos de recurso y los tipos de cartas de desarrollo son **privados**. El servidor envía una vista personalizada por socket: cada jugador recibe solo su propia mano detallada y `cardCount` / `devCardsCount` / `knightsPlayed` de los demás. El cliente nunca recibe la mano ajena.

## Licencia

Privado.
