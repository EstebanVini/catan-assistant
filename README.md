# Catán Assistant

Asistente digital **mobile-first** para partidas presenciales del juego de mesa Catán. Reemplaza el papel y las cartas de recursos; el tablero físico sigue existiendo. Sincronización en tiempo real entre los celulares de los jugadores conectados a la misma sala por código.

UI en español, identificadores de código en inglés.

## Stack

- **Backend**: Node.js + Express + Socket.IO + TypeScript. El estado en vivo de cada partida vive **en memoria**; **MongoDB (Mongoose)** persiste usuarios, historial de partidas y estadísticas.
- **Autenticación**: cuentas con login simple **JWT + bcrypt** (registro/login por REST, token en el handshake de Socket.IO). El **modo invitado** funciona sin cuenta (no acumula stats).
- **Frontend**: React 18 + Vite + Zustand + Tailwind CSS + `socket.io-client` + TypeScript.
- **Un solo proceso** en producción: Express sirve el cliente compilado (`client/dist`) y mantiene el socket.
- **Docker**: `docker compose up --build` levanta MongoDB + la app completa.

## Estructura

```
catan-assistant/
  package.json          # scripts raíz (dev, build, start, test, docker:*)
  docker-compose.yml    # mongo + server (build multi-stage del client+server)
  .env.example          # MONGODB_URI, JWT_SECRET, PORT, credenciales mongo
  server/               # backend (Express + Socket.IO)
    Dockerfile          # multi-stage: compila client + server, imagen final ligera
    src/
      index.ts          # entry: Express + Socket.IO + auth + mongo, sirve client/dist
      auth/
        auth.ts         # REST: register/login (bcrypt+JWT), GET/PATCH /api/users/me
        middleware.ts   # Bearer en REST + guard del handshake Socket.IO (invitado ok)
      db/
        connection.ts   # conexión Mongoose (tolerante: el juego sigue sin DB)
        persistMatch.ts # al terminar: crea Match y actualiza stats ($inc atómico)
        models/         # User.ts, Match.ts
      game/
        state.ts        # tipos del dominio (Resource, Hand, Player, Hex, GameState)
        rules.ts        # lógica pura (costos, distribución, 7, robo, trade)
        setup.ts        # construcciones iniciales -> hexes sembrados + recursos de inicio
        rooms.ts        # gestión de salas en memoria + snapshots para undo
      socket/
        handlers.ts     # eventos cliente <-> servidor
        views.ts        # vista personalizada por jugador (oculta manos ajenas)
  client/               # frontend (React + Vite)
    src/
      main.tsx
      App.tsx
      api.ts            # llamadas REST de auth
      socket.ts         # cliente Socket.IO con reconexión (manda el JWT)
      store.ts          # estado global (Zustand)
      screens/          # Login, Home, Lobby, Game, Profile
      components/       # HandView, ActionGrid, BankPanel, ProductionTable, ...
      lib/              # persistence, motion, playerColors, spanish, useModalA11y
  docs/                 # briefs de UX por fase
  plan.md               # plan completo de desarrollo
  prompt-claude-code-catan.md
```

## Requisitos

- Node.js ≥ 18 y npm ≥ 9 (para correr fuera de Docker)
- Docker + Docker Compose (para MongoDB y/o la app completa)

## Configuración

```bash
cp .env.example .env
# Edita JWT_SECRET (usa un valor largo y aleatorio) y, si quieres, las credenciales de mongo.
```

Variables de entorno:

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto del server (Express + Socket.IO) | `3001` |
| `MONGODB_URI` | Conexión a MongoDB | `mongodb://catan:...@localhost:27017/catan?authSource=admin` |
| `JWT_SECRET` | Secreto para firmar los JWT | — (obligatorio en producción) |
| `MONGO_INITDB_ROOT_USERNAME/PASSWORD` | Credenciales del contenedor de mongo | `catan` / `catan-dev-password` |

> Si MongoDB no está disponible, la app sigue funcionando para **jugar** (salas en memoria, modo invitado); solo se deshabilitan cuentas y persistencia de resultados.

## Instalación

```bash
npm run install:all
```

## Desarrollo (DB en Docker, código local)

```bash
npm run docker:db   # levanta solo mongo (docker compose up -d mongo)
npm run dev
```

- Server con `tsx watch` en `http://localhost:3001`.
- Client con Vite en `http://localhost:5173` (proxy `/socket.io` y `/api` al server; escucha en la red local para probar desde celulares).

## Producción local (un solo proceso, un solo puerto)

```bash
npm run build
npm start
```

- `build` compila el cliente a `client/dist`.
- `start` arranca el server, que sirve los estáticos del cliente y el SPA fallback en el puerto `PORT` (3001).

## Todo en Docker

```bash
docker compose up --build
```

Levanta `mongo` (volumen `mongo-data` persistente) y `server` (imagen multi-stage `node:20-alpine`, usuario no-root) sirviendo la app completa en `http://localhost:3001`.

```bash
npm run docker:down   # detener todo
```

## Tests

```bash
npm test
```

Vitest cubre la lógica pura del juego:
- `rules.ts`: distribución con banco limitado, descartes tras el 7, proporciones de intercambio con banco/puertos.
- `setup.ts`: validación de la tabla de construcción, derivación de los hexes de producción (merge por número+recurso, desierto con ladrón, posición del ladrón preservada al editar) y reparto de recursos de inicio con banco limitado.

## Funcionalidad

- **Cuentas y perfil**: registro/login (JWT + bcrypt), perfil con avatar, nombre visible, color preferido y estadísticas (partidas, victorias, insignias). Modo invitado sin fricción.
- **Salas**: crear / unirse por código / reconectar desde `localStorage` (sesión de sala independiente del JWT).
- **Lobby**: código compartible, selección de color (sin repetir), reordenar turnos (o sorteo por dados), encargado del banco, toggle Extensión 5–6, y **registro de construcciones iniciales** (cada jugador registra sus 2 poblados con las fichas número+recurso que tocan). El host ve el progreso y solo puede iniciar cuando todos completaron.
- **Inicio de partida**: reparto automático de recursos — **todos los poblados registrados dan 1 carta por cada ficha que tocan** — y derivación de los hexes de producción a partir de los registros (el ladrón arranca en el desierto).
- **Juego**: barra de turno, mano privada, acciones (construir, intercambiar, terminar turno), panel del banco (teclado 2–12, deshacer, **entrega manual de cartas con notificación pública anti-trampas**), **Tabla de construcción** personal y colapsable (listas de poblados y ciudades propias, editables a voluntad sin requerir recursos; el recuento por jugador es público en la lista de Jugadores), estado público de jugadores, log cronológico.
- **Intercambios entre jugadores**: el rechazo es individual — la oferta solo se oculta para quien la rechazó y sigue activa para el resto hasta que alguien la acepta o todos la rechazan.
- **Reglas que el servidor hace cumplir**: distribución con banco limitado, secuencia del 7 completa (descarte + ladrón + robo aleatorio), intercambio banco/puertos (4:1, 3:1, 2:1) y entre jugadores, cartas de desarrollo completas (Caballero, Monopolio, Año de la abundancia, Construcción de caminos; no jugables el turno en que se compran), insignias (Ejército más grande automático, Camino más largo manual), victoria a 10 declarada en tu turno.
- **Cartas de Punto de victoria**: no suman al marcador al comprarse; el dueño las **usa** cuando quiere (incluso el mismo turno) y solo entonces el punto se vuelve público para toda la mesa. Cada carta de desarrollo tiene **preview con descripción** antes de jugarla.
- **Extensión 5–6**: hasta 6 jugadores (verde y café), banco 24, mazo 34, Fase de Construcción Especial entre turnos.
- **Al terminar**: el resultado se guarda en MongoDB (`matches`) y las stats de los usuarios registrados se actualizan atómicamente; los invitados quedan en el historial sin cuenta.

## Privacidad y seguridad

- Las manos de recurso y los tipos de cartas de desarrollo son **privados**: el servidor envía una vista personalizada por socket (los demás solo ven conteos).
- Contraseñas hasheadas con **bcrypt** (sal incluida); el `passwordHash` nunca sale del servidor; no se loguean contraseñas ni tokens.
- `JWT_SECRET` por variable de entorno; `.env` está en `.gitignore`.
- Toda entrega manual del banco genera notificación pública + entrada en el log (anti-trampas).

## Licencia

Privado.
