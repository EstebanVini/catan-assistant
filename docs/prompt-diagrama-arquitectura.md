## INICIO DEL PROMPT

Eres un arquitecto de software experto en diagramas. Genera un **diagrama de
arquitectura de contenedores (estilo C4 nivel 2 / arquitectura por capas)** para
la aplicación web **"Catán Assistant"**. Prioriza claridad sobre exhaustividad:
usa **agrupaciones (boundaries/subgraphs)**, **nodos con etiqueta y tecnología**,
y **flechas dirigidas con etiqueta** que indiquen protocolo y propósito. Si el
formato lo permite, entrega **Mermaid** (`flowchart TB`) además de una versión
visual. Orientación vertical (top-down). Distingue con color: cliente (azul),
servidor/tiempo real (verde), lógica de dominio (morado), persistencia (naranja),
externos/infra (gris).

### 1. Qué es el sistema (contexto)

Catán Assistant es un **asistente digital mobile-first (PWA)** para partidas
**presenciales** del juego de mesa Catán. El tablero físico sigue existiendo; la
app reemplaza el papel, la banca y las cartas para llevar la contabilidad
**sin trampas y sincronizada en tiempo real** entre los celulares de los
jugadores. Varios jugadores entran a la **misma sala** con un **código de 5
caracteres** y ven un estado compartido que se actualiza al instante.
UI 100% en español; identificadores de código en inglés. Soporta edición base
(3–4), extensión 5–6 jugadores y la expansión **Caballeros y Ciudades**.

Característica arquitectónica central: **el estado en vivo de cada partida vive
en memoria en el servidor** (fuente de verdad autoritativa); MongoDB solo
persiste lo que sobrevive entre sesiones (cuentas, historial, stats, amistades).
El servidor **degrada con gracia**: si Mongo no está disponible, se puede seguir
jugando en modo invitado (solo se deshabilitan cuentas y persistencia).

### 2. Actores / clientes (externos, arriba)

- **Jugador (móvil)** — 3 a 6 navegadores/PWA instaladas en celulares, en la
  misma sala. Cada uno ve una **vista personalizada** (su mano privada + estado
  público de los demás).
- **Anfitrión (host)** — un jugador con permisos extra (configurar lobby,
  iniciar, expulsar, deshacer, finalizar).
- **Encargado del banco (bank manager)** — rol que ingresa las tiradas de dados
  y hace entregas manuales de cartas.

### 3. Capa Cliente (Frontend SPA + PWA) — "Navegador del jugador"

Tecnología: **React 18 + Vite + TypeScript + Zustand + Tailwind CSS +
socket.io-client**. SPA de una sola página; **navegación dirigida por estado**
(sin React Router: `App.tsx` elige la pantalla con un `if/else` sobre el store).

Nodos internos a dibujar dentro del boundary "Cliente":

- **App shell (`App.tsx`)** — selecciona pantalla según estado; monta overlays
  globales (NoticeBanner, InviteCard, toasts) y efectos de arranque (reconexión
  silenciosa, validación de JWT, sincronización entre pestañas vía evento
  `storage`, atributo `data-mode="ck"`).
- **Pantallas (`screens/`)**: `LoginScreen` (login/registro + "jugar como
  invitado"), `HomeScreen` (crear/unirse/reconectar + panel de amigos),
  `LobbyScreen` (configuración pre-partida), `GameScreen` (partida en curso:
  compone TopBar, HandView, ActionGrid, BankPanel, ConstructionTable,
  PublicPlayersPanel, Log y decenas de modales), `ProfileScreen` (perfil/stats),
  `WinnerScreen` (pantalla de ganador).
- **Store global (`store.ts`, Zustand)** — fuente de verdad del cliente. Guarda:
  `view` (la vista personalizada que empuja el servidor), `session` (código,
  playerId, sessionToken de la sala), `authToken`/`authUser`/`guestMode`
  (cuenta, independiente de la sala), `toasts`, `notices` (banner público),
  `invites`, `connectionStatus`. Sus **acciones son wrappers finos sobre
  `socket.emit(...)`**; las de RPC usan `emitWithAck<T>()`.
- **Puente de socket (`wireSocket()` + `socket.ts`)** — instancia única de
  socket.io-client con reconexión automática; el **JWT viaja en el handshake
  (`auth.token`)**. Escucha eventos del servidor y los vuelca al store.
- **Cliente REST (`api.ts`)** — llamadas `fetch` a `/api/*` (auth, perfil,
  amigos) con token Bearer.
- **`lib/` (utilidades)**: `persistence.ts` (wrapper seguro de localStorage:
  sesión de sala, JWT+usuario cacheado, modo invitado, prefs de UI),
  `featureFlags.ts` (gate de Caballeros y Ciudades), `spanish.ts` (glosario de
  copy), `playerColors.ts`, `motion.ts`, `achievements.ts` (espejo del catálogo
  de logros), `useModalA11y.ts` (focus trap/ESC).
- **Service Worker (`sw.js`) + `manifest.webmanifest`** — PWA instalable.
  **Network-first** para navegación; **nunca** intercepta `/socket.io/` ni
  `/api/` (el tiempo real y la auth siempre van a la red). Registrado solo en
  producción.
- **localStorage (almacén del navegador)** — persiste sesión de sala, JWT,
  usuario cacheado y modo invitado. Dibújalo como data-store local del cliente.

### 4. Capa Servidor (un solo proceso Node) — "Servidor de aplicación"

Tecnología: **Node.js + Express + Socket.IO + TypeScript**. **Un solo proceso**
que en producción **sirve el cliente compilado (`client/dist`) con fallback SPA**
Y mantiene el WebSocket. Punto de entrada `server/src/index.ts`.

Sub-módulos a dibujar dentro del boundary "Servidor":

**4a. Borde HTTP / WebSocket**
- **Express HTTP server** — sirve estáticos (`client/dist`), fallback SPA
  (`GET *` → `index.html`), y monta los routers REST.
- **Servidor Socket.IO** — WebSocket (fallback polling), CORS abierto.

**4b. Autenticación (`auth/`)**
- **`authRouter` (REST)** — `POST /api/auth/register`, `POST /api/auth/login`
  (**bcrypt** para hash, **JWT** de 30 días), `GET/PATCH /api/users/me`.
- **`friendsRouter` (REST)** — `GET /api/users/search`, `GET /api/friends`,
  `POST /api/friends/request`, `POST /api/friends/:id/accept`,
  `DELETE /api/friends/:id`.
- **`middleware.ts`** — `requireAuth` (guard Bearer en REST) + `socketAuthGuard`
  (verifica el JWT del handshake y adjunta `socket.data.userId`; **sin token se
  permite como invitado**).

**4c. Capa de tiempo real (`socket/handlers.ts`) — el corazón**
- **`registerHandlers(io, socket)`** — registra ~60 manejadores de eventos
  cliente→servidor (ver §6). Cada socket:
  - se une a una **sala de Socket.IO nombrada por el código de partida**
    (`socket.join(code)`),
  - y (si está autenticado) a una **sala personal `user:<userId>`** para recibir
    invitaciones fuera de partida.
- **`broadcastState(io, state)`** — **fan-out central**. NO usa
  `io.to(code).emit`; **itera cada socket de la sala y emite `state:update` con
  una vista construida individualmente** (`buildViewWithOwnHidden(state,
  playerId)`), de modo que **cada jugador recibe su mano privada y solo conteos
  públicos de los demás**. Dibuja esto como el mecanismo clave de privacidad.
- **`socket/views.ts`** — construye la **vista personalizada** (`PlayerView`):
  `me` (mano, mercancías, cartas privadas) + `state` (jugadores públicos con
  `cardCount`, VP visibles, etc.). Marca este nodo como "frontera de privacidad".
- Orquestación: `nextTurn`/`advanceTurnOrSpecialBuild` (rotación de turno y fase
  de construcción especial 5–6), `checkVictory`, `checkMidGameAchievements`,
  `resolveBarbarianAttackCK`, `executePortUse`.

**4d. Estado en memoria (`game/rooms.ts`)** — data-store en memoria (¡no una DB!)
- **`Map<code, GameState>`** — todas las salas activas.
- **`Map<code, string[]>`** — pila de snapshots por sala para **deshacer (undo)**
  (`pushSnapshot`/`popSnapshot`, máx 10). Casi todo manejador que muta llama
  `pushSnapshot` antes.
- Funciones: `createRoom`/`joinRoom`/`reconnect`/`getRoom`/`deleteRoom`.
  Dibújalo como un **almacén volátil dentro del proceso** (se pierde al
  reiniciar).

**4e. Lógica de dominio PURA (`game/`) — sin efectos secundarios, testeada con Vitest**
- **`state.ts`** — tipos del dominio: `GameState`, `Player`, `Hex`, `Building`,
  `TradeOffer`, recursos/mercancías/disciplinas/caballeros/cartas de progreso.
- **`rules.ts`** — reglas puras de Catán: costos, distribución por tirada, banco,
  secuencia del 7 (descarte/ladrón/robo), intercambios (banco/puertos 4:1/3:1/2:1
  y entre jugadores), cartas de desarrollo, VP, y toda la lógica de Caballeros y
  Ciudades (mejoras de ciudad, metrópolis, caballeros, bárbaros, cartas de
  progreso, acueducto, comerciante).
- **`setup.ts`** — siembra de hexes y reparto inicial (`applyInitialSetup`,
  `rebuildHexes`, `validateBuildings`).
- **`achievements.ts`** — catálogo de ~20 logros, XP y niveles.
Dibuja `handlers.ts` **dependiendo de** este bloque de lógica pura (llamadas de
función, no red).

**4f. Persistencia (`db/`)**
- **`connection.ts`** — conexión Mongoose **tolerante a fallos** (reintenta;
  `isDbConnected()` gatea auth/persistencia).
- **`persistMatch.ts`** — al declarar victoria: crea el `Match` y **actualiza
  atómicamente las stats** de cada usuario registrado (racha, XP, logros).
- **Modelos Mongoose**: `User`, `Match`, `Friendship`.

### 5. Capa de Persistencia (externa) — "Base de datos"

- **MongoDB** (contenedor `mongo:4.4`, volumen `mongo-data`). Colecciones:
  - **`users`** — cuenta (username, email, `passwordHash` [nunca sale del
    servidor], displayName, avatarUrl, color) + `stats` embebidas (partidas,
    victorias/derrotas, insignias, PV totales, racha actual/máxima, XP, logros).
  - **`matches`** — historial de partidas terminadas (ganador + jugadores con
    VP/insignias; los invitados quedan sin `userId`).
  - **`friendships`** — relación entre 2 usuarios (`requester`/`recipient`,
    estado `pending`/`accepted`; índice único por par).
Conexión vía driver Mongoose (TCP, red interna). Solo el servidor la toca.

### 6. Conexiones y flujos de datos (dibuja estas flechas etiquetadas)

**Cliente ↔ Servidor:**
1. **Navegador → Express**: `HTTPS/HTTP` — carga del app shell, assets con hash,
   `manifest`. (En prod: mismo origen; en dev: Vite en :5173 hace **proxy** de
   `/api` y `/socket.io` al backend :3001.)
2. **`api.ts` → `authRouter`/`friendsRouter`**: `REST/JSON sobre HTTP` con
   `Authorization: Bearer <JWT>` — registro, login, perfil, amigos. (Respuestas
   con unión discriminada por `ok`; 503 = "cuentas no disponibles".)
3. **`socket.ts` ↔ Socket.IO**: `WebSocket` (handshake lleva `auth.token`).
   Bidireccional y en tiempo real. Esta es la **arteria principal** de la app.

**Contrato de tiempo real (etiquetas para la flecha WebSocket):**
- **Cliente → Servidor (eventos, agrupar por familia)**: ciclo de sala
  (`game:create`, `game:join`, `game:reconnect`, `lobby:leave`, `game:leave`);
  lobby (`lobby:setColor`, `lobby:setTurnOrder`, `lobby:setBankManager`,
  `lobby:setExtension56`, `lobby:setCitiesKnights`, `lobby:setExtraRules`,
  `lobby:kick`, `lobby:rollOrderByDice`, `game:start`); tablero/construcción
  (`player:setBuildings`, `player:setPorts`, `build`, `building:ackNoResources`);
  turno y dados (`turn:rollNumber`, `turn:rollCK`, `turn:end`); secuencia del 7
  (`discard:submit`, `robber:move`, `robber:moveEmpty`, `robber:steal`); cartas
  de desarrollo (`dev:play`); comercio (`trade:bank`, `trade:offer`,
  `trade:respond`, `trade:cancel`, `port:request/respond/confirm/cancel`);
  Caballeros y Ciudades (`city:upgrade`, `city:buildWall`, `aqueduct:pick`,
  `knight:build/activate/promote/action`, `progress:play`, `progress:discard`,
  `barbarian:downgradeCity`); admin/victoria (`admin:giveCard`,
  `vp:setLongestRoad`, `game:declareWin`, `game:end`, `action:undo`); amigos
  (`friends:invite`, `friends:onlineIds`).
- **Servidor → Cliente (emits)**: `state:update` (vista personalizada, **por
  socket** — el evento principal), `error` (a un socket), `notice` (banner
  público a toda la sala, anti-trampas), `build:notify` (toast de construcción),
  `achievement:unlocked` (logro en vivo), `friends:invited` (a la sala personal
  del amigo), `lobby:kicked`, `lobby:cancelled`.
- **RPC con ack**: `game:create/join/reconnect`, `friends:invite`,
  `friends:onlineIds` responden por callback (no broadcast).

**Servidor interno (llamadas de función, no red):**
4. `handlers.ts` → `rooms.ts` (leer/mutar `GameState` en memoria; `pushSnapshot`).
5. `handlers.ts` → `rules.ts`/`setup.ts`/`achievements.ts` (lógica pura).
6. `handlers.ts` → `views.ts` (`buildView` por socket antes de emitir).
7. `game:declareWin` → `persistMatch.ts` → Mongoose → **MongoDB** (crea `Match` +
   `$inc`/`$set` de stats). **Único punto de persistencia de partidas.**
8. `authRouter`/`friendsRouter` → modelos Mongoose → **MongoDB**.
9. `socketAuthGuard`/`requireAuth` → verifican **JWT** (bcrypt en login).

**Cliente interno:**
10. `store.ts` ↔ `localStorage` (persistir/rehidratar sesión de sala, JWT,
    usuario, modo invitado).
11. Service Worker intercepta solo navegación/assets (cache), **deja pasar**
    `/api` y `/socket.io`.

### 7. Topología de despliegue (dibuja como vista secundaria o boundary "Infra")

- **Docker Compose**: dos servicios —
  - **`server`** (imagen multi-stage `node:20-alpine`, usuario no-root): build
    compila cliente (Vite) + servidor (tsc); imagen final corre
    `node server/dist/index.js`, sirve `client/dist` y el WebSocket en el
    **puerto 3001** (único puerto expuesto). **Un solo contenedor sirve front +
    back + tiempo real.**
  - **`mongo`** (`mongo:4.4`, volumen persistente `mongo-data`, **no** expuesto
    al host: solo accesible por la red interna de compose).
- **Variables de entorno**: `PORT`, `MONGODB_URI`, `JWT_SECRET`, credenciales de
  Mongo (`.env`, fuera de git).
- **Desarrollo**: Vite dev server (:5173, escucha en la LAN para probar desde
  celulares) con proxy a Node (:3001); Mongo en Docker.

### 8. Notas de estilo para el diagrama

- Marca claramente la **frontera de privacidad**: el servidor construye una vista
  distinta por jugador; las manos/cartas privadas nunca cruzan a otros clientes.
- Destaca que el **estado de la partida es volátil (en memoria)** y separado de
  la **persistencia duradera (MongoDB)**.
- Resalta el **WebSocket como canal principal** y REST como canal secundario
  (solo cuentas/perfil/amigos).
- Muestra la **degradación con gracia**: una anotación "si MongoDB cae → juego
  sigue en modo invitado".
- Incluye una **leyenda** con: protocolo (WebSocket / REST-HTTP / driver Mongo /
  llamada de función / acceso a localStorage), y los colores por capa.
- Sugerencia de agrupaciones (subgraphs): `Clientes móviles`, `Cliente SPA/PWA`,
  `Servidor Node (proceso único)` con sub-boxes {Borde HTTP+WS, Auth/REST,
  Tiempo real, Estado en memoria, Dominio puro, Persistencia}, `MongoDB`, `Infra
  Docker`.

## FIN DEL PROMPT
