# context.md — Catán Assistant (referencia rápida por sesión)

> Lee este archivo al inicio de cada sesión de Claude Code. Describe **qué es la app, cómo está construida y dónde vive cada cosa**, para no tener que redescubrir el proyecto cada vez. El plan de trabajo está en `plan.md`; el prompt original (la visión completa) en `prompt-claude-code-catan.md`. Cuando algo de aquí deje de ser cierto, **actualiza este archivo**.

---

## 1. Qué es

Aplicación web **mobile-first** que funciona como **asistente digital para partidas presenciales del juego de mesa Catán**. El tablero físico sigue existiendo; la app reemplaza el papel y las cartas de recursos para llevar la contabilidad sin trampas y compartida en tiempo real.

- Varios jugadores entran desde sus celulares a la **misma sesión** con un **código de sala** y ven un estado compartido que se actualiza al instante.
- Soporta la **edición base (3–4 jugadores)** y la **extensión 5–6 jugadores** (toggle en el lobby).
- **UI 100% en español**; **identificadores de código en inglés**.

## 2. Stack y arquitectura

- **Backend:** Node.js + Express + **Socket.IO** (TypeScript). El **estado en vivo de cada partida vive en memoria** (`Map<code, GameState>` en `server/src/game/rooms.ts`). **MongoDB (Mongoose)** persiste solo lo que sobrevive entre sesiones: usuarios, historial de partidas, estadísticas y amistades.
- **Auth:** cuentas con **JWT + bcrypt** (registro/login por REST). El socket manda el token en `auth.token`. **Modo invitado** permitido (sin stats).
- **Frontend:** React + **Vite** + **Zustand** + `socket.io-client` (TypeScript), mobile-first, **tema visual Catán** (fondo océano + paleta del juego).
- **PWA instalable:** `client/public/manifest.webmanifest` + `client/public/sw.js` (service worker registrado en `main.tsx`, **solo en producción**) hacen la app instalable desde Chrome/Edge/Android ("Instalar") y iOS ("Agregar a inicio"). El SW es **network-first** para la navegación y **nunca** intercepta `/socket.io/` ni `/api/` (el tiempo real y la auth siempre van a la red). Íconos en `client/public/icons/` (generados desde `src/public/icons/app_logo.png`). Migrar a React Native sigue siendo opción futura: ver `docs/mobile-app-plan-React-Navite.md`.
- **Un solo proceso en producción:** Express sirve `client/dist` con fallback SPA.
- **Docker:** `docker compose up --build` levanta mongo + server (multi-stage). También `docker compose up -d mongo` + `npm run dev` para desarrollo fuera del contenedor.
- **Privacidad crítica:** la mano (`hand`) y las cartas de desarrollo de cada jugador **solo** se envían a su dueño. A los demás se les manda una **vista personalizada** (`server/src/socket/views.ts`) con conteos públicos (`cardCount`, `knightsPlayed`, puntos visibles), nunca el detalle ajeno.

## 3. Mapa del repositorio

```
catan-assistant/
  package.json            # scripts raíz: dev, build, start, test, docker:*
  docker-compose.yml
  prompt-claude-code-catan.md  # visión original completa
  plan.md                 # plan de desarrollo y fases (delta sobre lo ya hecho)
  context.md              # ESTE archivo
  cambios.txt             # cambios pendientes solicitados por el usuario
  docs/                   # briefs de UX y reportes (ver §8)
  .claude/agents/         # definiciones de los 6 subagentes del proyecto
  server/
    src/
      index.ts            # Express + Socket.IO; sirve client/dist
      db/
        connection.ts     # conexión Mongoose (tolerante a fallos: el juego corre sin mongo)
        persistMatch.ts   # al ganar: crea Match y actualiza stats con update atómico
        models/User.ts    # usuario + stats
        models/Match.ts    # historial de partidas terminadas
        models/Friendship.ts
      auth/
        auth.ts           # rutas REST register/login, /api/users/me (GET/PATCH)
        middleware.ts     # guard REST (Bearer) + handshake Socket.IO (auth.token)
        friends.ts        # endpoints de amistades
      game/
        state.ts          # TIPOS del dominio + GameState + helpers (emptyHand, fullBank, ...)
        rules.ts          # lógica PURA de Catán (costos, distribución, 7, robo, VP) — testeada
        setup.ts          # sembrado de hexes + reparto de recursos de inicio — testeada
        rooms.ts          # salas en memoria; createPlayer / createRoom
        rules.test.ts, setup.test.ts  # vitest
      socket/
        handlers.ts       # TODOS los eventos Socket.IO (el corazón de la lógica de turno)
        views.ts          # vista personalizada por jugador (oculta manos ajenas)
  client/
    src/
      main.tsx, App.tsx
      socket.ts           # instancia única del cliente Socket.IO (manda el JWT)
      store.ts            # estado global Zustand
      api.ts              # llamadas REST de auth/perfil/amigos
      types.ts            # tipos compartidos del cliente (espejo de las vistas del server)
      screens/            # LoginScreen, HomeScreen, LobbyScreen, GameScreen, ProfileScreen
      components/         # ~40 componentes (ver §6)
      assets/icons.tsx    # mapeo recurso/carta → asset (PNG temáticos), con fallback emoji
      assets/icons/       # PNGs de recursos y cartas
      lib/                # motion.ts, persistence.ts, playerColors.ts, spanish.ts, useModalA11y.ts
```

## 4. Modelo de dominio (server/src/game/state.ts)

- `Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore'`; `Hand = Record<Resource, number>`.
- `Building { id, type: 'settlement'|'city', spots: BuildingSpot[], port? }`. Cada **spot** es una ficha que toca la construcción: `{ number, resource, hexId? }`. Un poblado toca 0–3 fichas (0–2 si tiene puerto). Los `hexes` de producción se **derivan** de los `buildings` de todos (`rebuildHexes`).
- `Player`: `id, userId?, sessionToken, name, avatarUrl?, color, connected, buildings[], hand (privado), ports[], devCards (privado), devCardsBoughtThisTurn[], knightsPlayed, victoryPoints {settlements, cities, longestRoad, largestArmy, vpCards}`.
- `Hex { id, number, resource, robber, owners[] }`. El robo y la producción dependen de esto.
- `GameState`: `code, hostId, bankManagerId, status ('lobby'|'playing'|'ended'), extension56, seedInitialResources, extraRules, players[], turnOrder[], currentTurnIndex, phase ('roll'|'discard'|'robber'|'main'|'specialBuild'), specialBuildQueue[], hexes[], bank, devDeck[], diceStats, log[], pendingDiscards, pendingRobberMove/Steal, activeTrade?, activePortUse?, winnerId?, ...`.
- **ExtraRules** (toggles del host en el lobby): `unequalTrades, sharedPorts, noSpecialBuild, robberNoStealFirstRound, robberEmptyGivesResource`.

## 5. Reglas que el servidor hace cumplir (todo en `rules.ts` / `handlers.ts`)

- **Colocación inicial:** cada jugador registra en el lobby sus 2 poblados (fichas que tocan: número 2–12 sin 7 + recurso) y marca cuál es el 2º (otorga recursos al iniciar). Al `game:start` el server reparte esos recursos y **siembra los hexes** (`setup.ts`).
- **Costos:** Camino 1 lumber+1 brick · Poblado 1 lumber+1 brick+1 wool+1 grain · Ciudad 2 grain+3 ore · Dev card 1 wool+1 grain+1 ore. Al construir, se descuenta de la mano y **se devuelve al banco**.
- **Distribución al tirar:** el bank manager ingresa el número; cada hex con ese número y sin ladrón produce a sus dueños (1 poblado / 2 ciudad). **Banco limitado** según regla oficial.
- **Secuencia del 7:** descarte (cada quien elige en su celular si tiene >7) → mover ladrón → robar carta aleatoria a un dueño de esa ficha.
- **Cartas de desarrollo:** mazo base 25 / extensión 34. Knight (mueve ladrón + roba + Ejército más grande), Year of Plenty, Monopoly, Road Building, VP (ocultas hasta usarse). No se juega la carta el mismo turno en que se compra.
- **Puntos de victoria:** Poblado 1, Ciudad 2, Camino más largo ≥5 (manual, bank manager) 2, Ejército más grande ≥3 (automático) 2, carta VP 1. Victoria a **10** en tu turno → `game:declareWin` → persiste Match + stats.
- **Extensión 5–6:** hasta 6 jugadores (colores verde/café), banco 24, mazo 34, y **Fase de Construcción Especial** tras cada turno (salvo `noSpecialBuild`).

## 6. Frontend — pantallas y componentes clave

- **Pantallas:** `LoginScreen` (registro/login/invitado), `HomeScreen` (crear/unirse/reconectar), `LobbyScreen` (código, colores, orden de turnos, bank manager, registro de construcciones iniciales, toggles de reglas), `GameScreen` (la principal), `ProfileScreen` (avatar, displayName, color, **stats**).
- **Componentes notables:** `HandView`, `ConstructionTable`, `ActionGrid`, `BankPanel` (+ `NumericKeypad`, `GiveCardModal`), `DiceStats`, `Log`, `InitialBuildSetup`, `RobberFlow`, `DiscardModal`, `TradeModal`/`TradeIncomingModal`, `DevCardsPanel` (+ pickers Monopoly/YearOfPlenty/RoadBuilding), `PortFeeConfirmModal`/`PortIncomingModal`, `SpecialBuildBanner`, `PublicPlayersPanel`, `NoticeBanner`, `WinnerScreen`, `CollapsibleSection`, `Avatar`, `BadgeIcon`, `FriendsPanel`.
- **Estado:** Zustand en `store.ts`; el socket actualiza la vista; `types.ts` espeja `views.ts`.
- **Tema visual:** fondo océano + superficies pergamino/madera (contraste WCAG AA); íconos centralizados en `assets/icons.tsx` con fallback emoji. Respeta `prefers-reduced-motion` (`lib/motion.ts`).

## 7. Contrato Socket.IO (resumen)

- **Cliente→Servidor (handlers.ts):** `game:create/join/reconnect`, `lobby:setColor/setTurnOrder/setBankManager/setExtension56`, `player:setBuildings`, `player:setPorts`, `game:start`, `hex:*`, `turn:rollNumber`, `discard:submit`, `robber:move/steal`, `build {type, settlementId?}`, `dev:play`, `trade:bank/offer/respond`, `turn:end`, `specialBuild:done/skip`, `vp:setLongestRoad`, `admin:giveCard`, `action:undo`, `game:declareWin`, `game:end`.
- **Servidor→Cliente:** `state:update` (vista personalizada), `error`, `toast`, `notice` (público prominente, anti-trampas), `build:notify`.
- **Undo:** `pushSnapshot(state)` antes de cada acción mutadora; `action:undo` revierte.

## 8. Documentación de apoyo (docs/)

- `ux-brief-mvp.md`, `ux-brief-phase2.md`, `ux-brief-phase3-delta.md` — briefs de UX por fase.
- `brief-cambios.md`, `brief-cambios-v2.md` — briefs de iteraciones de cambios.
- `contrast-verification.md` — verificación de contraste WCAG.
- `pending-phase3.md` — ganchos futuros (foto del tablero, paired players, subida de avatar).

## 9. Cómo correr y verificar

- **Desarrollo:** `docker compose up -d mongo` y `npm run dev` (server con nodemon + client con Vite). 
- **Producción local:** `npm run build` (compila client) + `npm start` (server sirve `client/dist`).
- **Todo en Docker:** `docker compose up --build`.
- **Tests:** `npm test` (vitest sobre `rules.ts` y `setup.ts` en el server).
- **Build de verificación:** `cd server && npm run build` (tsc) y `cd client && npm run build` (vite/tsc).
- Variables de entorno: `MONGODB_URI`, `JWT_SECRET`, `PORT` (+ credenciales de mongo). `.env` está en `.gitignore`; ver `.env.example`.

## 10. Equipo de agentes (.claude/agents/)

`ux-architect` (flujos/briefs, no escribe código) · `ui-engineer` (componentes React/TS) · `ux-writer` (copy en español) · `visual-designer` (tema Catán, íconos) · `motion-engineer` (micro-interacciones) · `qa-auditor` (accesibilidad/perf/responsive, reporta P0–P3).

> **Convención del proyecto:** el **backend** (Node/Express/Socket.IO/Mongoose/auth/reglas) lo implementa el orquestador (Claude principal). Los **agentes son frontend** y consumen el backend vía el contrato Socket.IO y la API REST.

## 11. Estado actual

La app es jugable de extremo a extremo: auth, lobby, MVP completo, cartas de desarrollo, insignias, victoria, persistencia, extensión 5–6, dice stats, tema visual, amigos. El trabajo nuevo se rastrea en `cambios.txt` y se planifica en `plan.md`.
