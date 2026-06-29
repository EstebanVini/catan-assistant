# context.md — Catán Assistant (referencia rápida por sesión)

> Lee este archivo al inicio de cada sesión de Claude Code. Describe **qué es la app, cómo está construida y dónde vive cada cosa**, para no tener que redescubrir el proyecto cada vez. El plan de trabajo está en `plan.md`; el prompt original (la visión completa) en `prompt-claude-code-catan.md`. Cuando algo de aquí deje de ser cierto, **actualiza este archivo**.

---

## 1. Qué es

Aplicación web **mobile-first** que funciona como **asistente digital para partidas presenciales del juego de mesa Catán**. El tablero físico sigue existiendo; la app reemplaza el papel y las cartas de recursos para llevar la contabilidad sin trampas y compartida en tiempo real.

- Varios jugadores entran desde sus celulares a la **misma sesión** con un **código de sala** y ven un estado compartido que se actualiza al instante.
- Soporta la **edición base (3–4 jugadores)**, la **extensión 5–6 jugadores** (toggle en el lobby) y la **expansión Caballeros y Ciudades** (toggle `citiesKnights`, victoria a 13; ver §5b y `caballeros-plan.md`).
- **UI 100% en español**; **identificadores de código en inglés**.

## 1b. Funcionalidades (catálogo completo)

Todo lo siguiente está **implementado y funcionando** salvo lo marcado como futuro (§8 `pending-phase3.md`).

**Cuentas e identidad**
- Registro / inicio de sesión con **JWT + bcrypt**; **modo invitado** (juega sin acumular stats). Sincronización de sesión entre pestañas (`storage`).
- **Perfil** (`ProfileScreen`): editar `displayName`, color preferido y `avatarUrl`; **avatar generado** determinístico (iniciales + color por hash) con fallback si la imagen falla.
- **Estadísticas** del usuario: partidas, ganadas/perdidas, % de victorias, PV totales, insignias (camino más largo / ejército más grande), **racha actual y máxima**, **XP + nivel** y **logros** (ver §5c).
- **Amigos** (`FriendsPanel`): buscar usuarios, enviar/aceptar/rechazar/cancelar solicitudes, eliminar amigos, ver quién está **en línea**, **invitar a la sala** en tiempo real, y **ver el perfil completo de un amigo** (`FriendProfileModal`: stats + XP + logros).

**Sala / lobby**
- Crear sala (código de 5 caracteres) y unirse por código; **reconexión** automática con `sessionToken`.
- El anfitrión configura: **colores** por jugador, **orden de turnos** (manual o sorteo con dados), **encargado del banco**, toggle **extensión 5–6**, toggle **Caballeros y Ciudades**, toggle **iniciar sin recursos**, y las **reglas extra** (ver §4). Puede **expulsar** jugadores y **cancelar** la sala.
- Registro de los **2 poblados de salida** de cada jugador (fichas que tocan); gating para iniciar (salvo modo "sin fichas").

**Partida (motor de juego)**
- **Tirada**: el encargado del banco ingresa el número (base) o los 3 dados (C&K); reparte producción a poblados/ciudades y lleva **estadísticas de dados**.
- **Secuencia del 7**: descarte forzado (>7 cartas) → mover ladrón → robo aleatorio. El ladrón puede ir a un hex de la mesa, al **desierto**, o a una **ficha vacía genérica** (opción "Mover a ficha vacía", independiente del desierto: no queda sobre ningún hex → `robberOnEmpty`, no bloquea producción ni roba). Reglas extra del ladrón (no roba 1ª ronda: solo omite descarte; ficha vacía/desierto da recurso del banco si `robberEmptyGivesResource`).
- **Construir**: caminos, poblados, ciudades, cartas de desarrollo; **Tabla de construcción** editable que deriva los hexes de producción; registro de fichas pendientes tras comprar un poblado.
- **Cartas de desarrollo**: Caballero (+ Ejército más grande), Año de la abundancia, Monopolio, Construcción de caminos, Punto de victoria (privadas hasta usarse). No se juegan el turno en que se compran.
- **Intercambios**: con el banco/puertos (proporciones 4:1/3:1/2:1), **entre jugadores** (ofertas dirigidas o abiertas, rechazo individual), y **uso de puerto ajeno** con comisión opcional (regla `sharedPorts`, flujo de 3 pasos).
- **Insignias y victoria**: Camino más largo (manual, banco/anfitrión), Ejército más grande (automático), declarar victoria (10 base / 13 C&K) → persiste la partida y stats.
- **Banco**: entrega manual de cartas (anti-trampas: siempre notifica), **deshacer** (undo) la última acción.
- **Fase de Construcción Especial** (extensión 5–6).
- **Salir de la partida** en curso (devuelve cartas al banco/mazos y libera el lugar) y **finalizar partida** sin ganador (anfitrión).
- **Expansión Caballeros y Ciudades** completa (ver §5b).

**Tiempo real, privacidad y feedback**
- Estado compartido vía Socket.IO con **vista personalizada** (las manos/cartas ajenas nunca se envían; solo conteos públicos).
- **Privacidad de tu propia mano:** en `HandView` hay dos toggles **locales** (no tocan el estado compartido) para **ocultar tus recursos** (y mercancías en C&K) y **ocultar tus cartas de desarrollo**, útiles en partidas presenciales. El Total queda visible; se enmascara la composición. La preferencia persiste por dispositivo.
- **Notices** públicos prominentes (anti-trampas), **toasts**, **log** de la partida, banner de desconexión/reconexión, **invitaciones** de amigos.
- **PWA instalable** (offline shell; nunca cachea `/socket.io/` ni `/api/`).
- Tema Catán, **accesibilidad** (WCAG AA, focus trap en modales, `prefers-reduced-motion`), animaciones y micro-interacciones.

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
        persistMatch.ts   # al ganar: crea Match y actualiza stats (racha, XP, logros)
        models/User.ts    # usuario + stats (incl. xp, achievements, rachas)
        models/Match.ts    # historial de partidas terminadas
        models/Friendship.ts
      auth/
        auth.ts           # rutas REST register/login, /api/users/me (GET/PATCH)
        middleware.ts     # guard REST (Bearer) + handshake Socket.IO (auth.token)
        friends.ts        # endpoints de amistades
      game/
        state.ts          # TIPOS del dominio + GameState + Player.gameStats + helpers
        rules.ts          # lógica PURA de Catán (costos, distribución, 7, robo, VP, C&K) — testeada
        setup.ts          # sembrado de hexes (1–2 desiertos) + reparto inicial — testeada
        achievements.ts   # catálogo de 20 logros + reglas de XP + nivel — testeada
        rooms.ts          # salas en memoria; createRoom / joinRoom (carga racha del usuario)
        rules.test.ts, setup.test.ts, achievements.test.ts  # vitest
      socket/
        handlers.ts       # TODOS los eventos Socket.IO (turno + tracking de logros)
        views.ts          # vista personalizada por jugador (oculta manos ajenas)
  client/
    src/
      main.tsx, App.tsx
      socket.ts           # instancia única del cliente Socket.IO (manda el JWT)
      store.ts            # estado global Zustand
      api.ts              # llamadas REST de auth/perfil/amigos
      types.ts            # tipos compartidos del cliente (espejo de las vistas del server)
      screens/            # LoginScreen, HomeScreen, LobbyScreen, GameScreen, ProfileScreen
      components/         # ~45 componentes (ver §6)
      assets/icons.tsx    # mapeo recurso/carta → asset (PNG temáticos) + glifos SVG (FireGlyph, ...)
      assets/icons/       # PNGs de recursos y cartas
      lib/                # motion.ts, persistence.ts, playerColors.ts, spanish.ts, useModalA11y.ts, achievements.ts (espejo del catálogo)
```

## 4. Modelo de dominio (server/src/game/state.ts)

- `Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore'`; `Hand = Record<Resource, number>`.
- `Building { id, type: 'settlement'|'city', spots: BuildingSpot[], port? }`. Cada **spot** es una ficha que toca la construcción: `{ number, resource, hexId? }`. Un poblado toca 0–3 fichas (0–2 si tiene puerto). Los `hexes` de producción se **derivan** de los `buildings` de todos (`rebuildHexes`).
- `Player`: `id, userId?, sessionToken, name, avatarUrl?, color, connected, winStreak (racha activa cargada al unirse, pública), buildings[], hand (privado), ports[], devCards (privado), devCardsBoughtThisTurn[], knightsPlayed, victoryPoints {settlements, cities, longestRoad, largestArmy, vpCards}`, campos C&K (`commodities`, `improvements`, `metropolises`, `progressCards`, `knights`, `defenderCards`, `walls`), y `gameStats?` (acumulador por partida para logros: picos de recursos/puertos, PV por turno, caminos, compras dev/turno, ronda seca — **no se envía a la vista**).
- `Hex { id, number, resource, robber, owners[] }`. El robo y la producción dependen de esto.
- `GameState`: `code, hostId, bankManagerId, status ('lobby'|'playing'|'ended'), extension56, seedInitialResources, extraRules, players[], turnOrder[], currentTurnIndex, phase ('roll'|'discard'|'robber'|'main'|'specialBuild'), specialBuildQueue[], hexes[], bank, devDeck[], diceStats, log[], pendingDiscards, pendingRobberMove/Steal, robberOnEmpty (ladrón en ficha vacía, sobre ningún hex), activeTrade?, activePortUse?, winnerId?, ...`.
- **ExtraRules** (toggles del host en el lobby): `unequalTrades, sharedPorts, noSpecialBuild, robberNoStealFirstRound, robberEmptyGivesResource`.

## 5. Reglas que el servidor hace cumplir (todo en `rules.ts` / `handlers.ts`)

- **Colocación inicial:** cada jugador registra en el lobby sus 2 poblados (fichas que tocan: número 2–12 sin 7 + recurso) y marca cuál es el 2º (otorga recursos al iniciar). Al `game:start` el server reparte esos recursos y **siembra los hexes** (`setup.ts`).
- **Costos:** Camino 1 lumber+1 brick · Poblado 1 lumber+1 brick+1 wool+1 grain · Ciudad 2 grain+3 ore · Dev card 1 wool+1 grain+1 ore. Al construir, se descuenta de la mano y **se devuelve al banco**.
- **Distribución al tirar:** el bank manager ingresa el número; cada hex con ese número y sin ladrón produce a sus dueños (1 poblado / 2 ciudad). **Banco limitado** según regla oficial.
- **Secuencia del 7:** descarte (cada quien elige en su celular si tiene >7) → mover ladrón → robar carta aleatoria a un dueño de esa ficha.
- **Cartas de desarrollo:** mazo base 25 / extensión 34. Knight (mueve ladrón + roba + Ejército más grande), Year of Plenty, Monopoly, Road Building, VP (ocultas hasta usarse). No se juega la carta el mismo turno en que se compra.
- **Puntos de victoria:** Poblado 1, Ciudad 2, Camino más largo ≥5 (manual, bank manager) 2, Ejército más grande ≥3 (automático) 2, carta VP 1. Victoria a **10** en tu turno → `game:declareWin` → persiste Match + stats.
- **Extensión 5–6:** hasta 6 jugadores (colores verde/café), banco 24, mazo 34, y **Fase de Construcción Especial** tras cada turno (salvo `noSpecialBuild`).

## 5b. Caballeros y Ciudades (expansión `citiesKnights`)

> **Acceso restringido (en desarrollo):** solo las cuentas en la allowlist (`esteban`, `yoyo`) pueden **activar** C&K en el lobby. El servidor es la verja autoritativa (`lobby:setCitiesKnights` rechaza `enabled=true` si el `username` del anfitrión no está en `CK_ALLOWED_USERNAMES` de `handlers.ts`); el lobby deshabilita el toggle y muestra "en desarrollo y todavía no está disponible" (espejo en `client/src/lib/featureFlags.ts`). Desactivarla siempre se permite.

Aditiva: con el toggle apagado el juego se comporta EXACTAMENTE como el base. Con él encendido (decisiones en `caballeros-plan.md`; reporte QA en `docs/qa-caballeros.md`):
- **Mercancías** (`coin`/`paper`/`cloth`): segundo tipo de carta; SOLO las producen las ciudades sobre montaña/bosque/pastura (1 recurso + 1 mercancía en vez de 2 recursos). Banco de mercancías informativo (12 c/u).
- **Mejoras de ciudad** en 3 disciplinas (`trade`/`politics`/`science`), niveles 0–5, se pagan con la mercancía de la disciplina. Nivel 3 desbloquea habilidad (Casa de comercio / Fortaleza / Acueducto); nivel 4 reclama **metrópolis** (+2 PV), nivel 5 la blinda.
- **Cartas de progreso** (3 mazos de 18, límite de mano 4): reemplazan a las de desarrollo, se reparten por el **calendario de la ciudad** (dado de evento de color + dado rojo ≤ nivel). "Registro asistido": las autocontenidas se automatizan, las que dependen del tablero se retiran y la mesa las resuelve.
- **Caballeros** (`Knight` rango 1–3, activo/inactivo; sin geometría: rango + estado): se contratan, activan y promueven con recursos. Fuerza de defensa = suma de rango de los activos.
- **Bárbaros:** dado de evento `barbarian` avanza la pista `barbarianStep` 0→7; al llegar atacan (`resolveBarbarianAttack`): defensa de caballeros vs ciudades, **Defensor de Catán** (+1 PV) al mayor defensor o cartas en empate, perdedores degradan una ciudad. El **ladrón arranca inmovilizado** (`robberActive=false`) hasta el primer ataque.
- **Muros de ciudad** (0–3, 2 ladrillos c/u): cada uno sube +2 el límite de mano del 7.
- **Inicio C&K:** cada jugador empieza con 1 poblado + 1 ciudad (se sube su 2º poblado registrado). Victoria a **13** (`victoryTargetFor`).
- Eventos socket nuevos: `lobby:setCitiesKnights`, `turn:rollCK`, `progress:discard/play`, `city:upgrade/buildWall`, `knight:build/activate/promote/action`, `barbarian:downgradeCity`.

## 5c. Estadísticas, racha, logros y XP

- **Stats persistidas** (`User.stats`): `gamesPlayed, wins, losses, longestRoadBadges, largestArmyBadges, totalVictoryPoints, currentWinStreak, longestWinStreak, xp, achievements[]`. Se actualizan al terminar la partida en `persistMatch.ts` (lectura-modificación-escritura por usuario; los invitados no acumulan).
- **Racha** (`currentWinStreak`): se carga al unirse a una sala y se expone como `winStreak` en la vista pública para mostrar el ícono de fuego 🔥 con el número en los avatares (lobby + marcador).
- **XP** (regla en `achievements.ts xpForGame`): victoria +10 · cada insignia +5 · 1 XP por PV · +10 por cada victoria que suma a la racha (desde la 2ª consecutiva) · + XP de los logros recién desbloqueados. **Nivel** derivado de la XP (`levelForXp`, curva cuadrática; espejado en `client/src/lib/achievements.ts`).
- **Logros** (`server/src/game/achievements.ts`, 20 en total, con tests): catálogo `{id, name, description, xp, kind}`. El servidor **trackea por partida** en `Player.gameStats` (picos de recursos/puertos, Δ PV por turno, caminos, compras dev por turno, ronda sin recibir recursos) vía hooks en `handlers.ts` (`trackPeaks` en `broadcastState`, frontera de ronda en `nextTurn`, `build`, distribución). `satisfiedAchievements`/`newlyUnlocked` deciden los desbloqueados al terminar. El cliente espeja el catálogo en `lib/achievements.ts` y los muestra en `AchievementsPanel` (perfil propio y de amigos).
- **Desbloqueo EN VIVO + notificaciones:** tras cada cambio de estado, `checkMidGameAchievements` (en `broadcastState`) evalúa los logros monótonos detectables a mitad de partida (`midGameSatisfied`; subconjunto `MIDGAME_ACHIEVEMENT_IDS` — nunca dispara los de fin de partida como pacifista/perdedor/carrera/racha/condicionados a ganar). Para cada logro nuevo de un jugador **registrado** (baseline = `Player.unlockedAchievements` cargado al unirse + `newAchievementsThisGame`): emite `achievement:unlocked` con `mine` por socket → al dueño una notificación **prominente** (`notice`/banner), a los oponentes una **silenciosa** (`toast`); además queda en el log. Se persisten al terminar (`persistMatch` los recalcula desde `gameStats`).

## 6. Frontend — pantallas y componentes clave

- **Pantallas:** `LoginScreen` (registro/login/invitado), `HomeScreen` (crear/unirse/reconectar), `LobbyScreen` (código, colores, orden de turnos, bank manager, registro de construcciones iniciales, toggles de reglas), `GameScreen` (la principal), `ProfileScreen` (avatar, displayName, color, **stats + XP/logros**).
- **Componentes notables:** `HandView` (mano propia + **toggles para ocultar recursos/cartas de desarrollo**), `ConstructionTable` (incluye el selector de mover ladrón `RobberHexList`, con el desierto y la acción "Mover a ficha vacía" genérica), `ActionGrid`, `BankPanel` (+ `NumericKeypad`, `GiveCardModal`), `DiceStats`, `Log`, `InitialBuildSetup`, `RobberFlow`, `DiscardModal`, `TradeModal`/`TradeIncomingModal`, `DevCardsPanel` (+ pickers Monopoly/YearOfPlenty/RoadBuilding), `PortFeeConfirmModal`/`PortIncomingModal`, `SpecialBuildBanner`, `PublicPlayersPanel` (marcador + racha 🔥), `NoticeBanner`, `WinnerScreen`, `CollapsibleSection`, `Avatar` (con badge de racha opcional), `BadgeIcon`, `EndGameButton`, `LeaveGameButton` (salir de partida), `FriendsPanel`, `FriendProfileModal` (perfil de amigo), `AchievementsPanel` (logros + XP, reutilizable).
- **Componentes Caballeros y Ciudades:** `DiceInputCK` (3 dados), `KnightsPanel`, `BarbarianTrack`, `BarbarianLossModal`, `CityCalendarPanel`, `WallControl`, `ProgressHand`, `DevCardPreview`, `CommodityMonopolyPickerModal`, `ResourceMonopolyPickerModal`, `RoadBuildingConfirmModal`, `ContextBanner`, `TopBar`. Íconos C&K (mercancías, caballeros, disciplinas) en `assets/icons.tsx`, varios reciclados (ver `missing-icons.md`). Hay un `FireGlyph` ya disponible en `icons.tsx`.
- **Estado:** Zustand en `store.ts`; el socket actualiza la vista; `types.ts` espeja `views.ts`.
- **Tema visual:** fondo océano + superficies pergamino/madera (contraste WCAG AA); íconos centralizados en `assets/icons.tsx` con fallback emoji. Respeta `prefers-reduced-motion` (`lib/motion.ts`).

## 7. Contrato Socket.IO (resumen)

- **Cliente→Servidor (handlers.ts):**
  - *Sesión/lobby:* `game:create/join/reconnect`, `lobby:setColor/setTurnOrder/setBankManager/setExtension56/setCitiesKnights/setSeedResources/setExtraRules`, `lobby:rollOrderByDice`, `lobby:kick`, `lobby:leave`, `game:start`.
  - *Construcción/turno:* `player:setBuildings`, `player:setPorts`, `building:ackNoResources`, `turn:rollNumber`, `turn:rollCK` (C&K), `discard:submit`, `discard:forceRandom`, `robber:move`, `robber:moveEmpty` (ficha vacía genérica), `robber:steal`, `build {type, settlementId?}`, `dev:play`, `turn:end`, `specialBuild:done/skip`.
  - *Comercio:* `trade:bank/offer/respond/cancel`, `port:request/respond/confirm/cancel` (regla `sharedPorts`).
  - *Caballeros y Ciudades:* `progress:discard/play`, `city:upgrade/buildWall`, `knight:build/activate/promote/action`, `barbarian:downgradeCity`.
  - *Banco/victoria/salida:* `vp:setLongestRoad`, `admin:giveCard`, `action:undo`, `game:declareWin`, `game:end`, `game:leave` (salir de partida en curso → devuelve cartas).
  - *Amigos:* `friends:onlineIds`, `friends:invite`.
- **Servidor→Cliente:** `state:update` (vista personalizada), `error`, `toast`, `notice` (público prominente, anti-trampas), `build:notify`, `lobby:cancelled`, `lobby:kicked`, `friends:invited`, `achievement:unlocked` (logro en vivo; `mine` distingue notificación prominente vs silenciosa).
- **REST (api.ts):** `/api/auth/register|login`, `/api/users/me` (GET/PATCH), `/api/users/search`, `/api/friends` (+ `request`, `:id/accept`, `:id` DELETE).
- **Undo:** `pushSnapshot(state)` antes de cada acción mutadora; `action:undo` revierte.

## 8. Documentación de apoyo (docs/)

- `ux-brief-mvp.md`, `ux-brief-phase2.md`, `ux-brief-phase3-delta.md` — briefs de UX por fase.
- `brief-cambios.md`, `brief-cambios-v2.md`, `brief-cambios-v3.md` — briefs de iteraciones de cambios.
- `contrast-verification.md` — verificación de contraste WCAG.
- `qa-caballeros.md` — reporte QA de la expansión Caballeros y Ciudades.
- `pending-phase3.md` — ganchos futuros (foto del tablero, paired players, subida de avatar).
- `logrosandxp.md` — plan de implementación de logros + XP y del resto de `cambios.txt` (bugs y features), con tareas por agente.
- `cambios-plan.md` — plan de la tanda de `cambios.txt` de junio 2026 (toggles de privacidad, ladrón a ficha vacía, ajuste de XP), con tareas por agente.
- `cambios-CC-plan.md` — plan de la tanda de **bugs de Caballeros y Ciudades** de `cambios.txt` (cartas de progreso, reparto de mercancías, mejoras nivel 3, comerciante, comercio de mercancías, lobby poblado/ciudad, layout 3ª columna), con tareas por agente.
- `Progress-Cards-CC.md` — texto oficial de las 54 cartas de progreso C&K (referencia para implementar sus efectos). `cities_updates.md` — beneficios de las mejoras de ciudad nivel 3.
- En la raíz: `caballeros-plan.md` (plan completo de la expansión C&K) y `missing-icons.md` (arte pendiente / reciclado).

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

La app es jugable de extremo a extremo: auth, lobby, MVP completo, cartas de desarrollo, insignias, victoria, persistencia, extensión 5–6, dice stats, tema visual, amigos y **expansión Caballeros y Ciudades** (ver §5b). Catálogo completo de funcionalidades en §1b.

**Entregado de `cambios.txt`** (planes en `docs/logrosandxp.md` y `docs/cambios-plan.md`): bugs corregidos (2 desiertos en 5–6; semántica de `robberNoStealFirstRound` = solo omite descarte, sí roba; reset de contadores en modales de descarte/puerto) y features (salir de partida devolviendo cartas al banco; ícono de racha 🔥 en avatares; ver perfil completo de amigos; **sistema de logros + XP** con 20 logros, nivel y `AchievementsPanel`). Detalle en §5c.

**Última tanda (`docs/cambios-plan.md`, junio 2026):** ajuste de XP (`Desarrollado` 40, `Victoria demoledora` 40); **acción "Mover a ficha vacía"** del ladrón independiente del desierto (`robber:moveEmpty` + `robberOnEmpty`; recurso del banco solo con `robberEmptyGivesResource`); y **toggles de privacidad** en `HandView` para ocultar tus recursos y tus cartas de desarrollo. Verificado: 65 tests de servidor en verde + build de cliente; frontend diseñado/auditado por el equipo de agentes (ux-architect, ux-writer, ui-engineer, visual-designer, motion-engineer, qa-auditor).

**Batch en progreso (`docs/cambios-CC-plan.md`, junio 2026):** corrección de bugs de Caballeros y Ciudades pedidos en `cambios.txt` — (1) automatizar los efectos de las cartas de progreso (hoy muchas solo dicen "Resolver en el tablero") y confirmar conteos/limpieza de dev cards base; (3) repartir las **mercancías** de la ciudad inicial al empezar; (6) habilidades de mejora de ciudad **nivel 3** (Guilda 2:1 mercancías, Fortaleza, Acueducto); (7) **comerciante** (colocar en ficha, 2:1, +1 PV); (4/5) **comercio de mercancías** entre jugadores y con banco/puertos; (2) distinguir **poblado vs ciudad** inicial en el lobby; (8) reacomodo de los paneles C&K a la **3ª columna** en tablet/desktop. Se trabaja en la rama `Fix]caballeros-Ciudades`, con commit por bug verificado.

**Pendiente / futuro:** celebración de logros y XP en `WinnerScreen` al terminar la partida (hoy se ven en el perfil); y los ganchos de `docs/pending-phase3.md` (foto del tablero, paired players, subida de avatar).
