# Plan de desarrollo — Catán Assistant

> Plan completo de desarrollo del asistente digital para partidas presenciales de Catán. Basado en `prompt-claude-code-catan.md` (versión actualizada con MongoDB, auth JWT, Docker, construcciones iniciales y tema visual Catán) y aprovechando el equipo de agentes disponible en `.claude/agents/`.

---

## 1. Resumen del producto

App web **mobile-first** que reemplaza el papel y las cartas de recursos en una partida presencial de Catán. Sincronización en tiempo real entre los celulares de los jugadores mediante un código de sala. Soporta edición base (3–4 jugadores) y extensión 5–6 jugadores.

**Stack**:
- Backend: Node.js + Express + Socket.IO; **estado en vivo en memoria** (`Map<code, GameState>`); **MongoDB (Mongoose)** para usuarios, historial de partidas y estadísticas. Sirve el frontend compilado en un solo proceso.
- Autenticación: **JWT + bcrypt** (registro/login por REST; el socket manda el token en `auth.token`; modo invitado permitido).
- Frontend: React + Vite + Zustand + `socket.io-client`, TypeScript, mobile-first, **tema visual Catán** (océano + paleta del juego).
- **Docker:** `docker compose up` levanta mongo + server (multi-stage build). También se puede levantar solo mongo y desarrollar fuera del contenedor.
- Identificadores de código en inglés; UI en español.

---

## 2. Equipo de agentes y su responsabilidad

| Agente | Rol en este proyecto |
|---|---|
| **ux-architect** | Define los flujos de usuario y produce design briefs para cada pantalla (Login, Home, Lobby, Game, Profile) y para los flujos críticos (registro de construcciones iniciales, secuencia del 7, intercambio, entrega manual de cartas, fase de construcción especial). Identifica casos extremos. No escribe código. |
| **ui-engineer** | Implementa los componentes y pantallas en React + TypeScript + Tailwind. Conecta el cliente al Socket.IO y a la API REST de auth. Construye la store Zustand y los componentes funcionales (HandView, ProductionTable, DiceInput, Log, InitialBuildSetup, etc.). |
| **ux-writer** | Audita y mejora todo el copy en español: labels, CTAs, mensajes de error, toasts, notices públicos, empty states, instrucciones de fases. Define el glosario del producto. |
| **visual-designer** | Aplica el **tema Catán**: fondo océano, paleta del juego (recursos, jugadores, superficies pergamino/madera, acentos dorados), tipografía con carácter, **nuevos íconos** de recursos y cartas centralizados en `client/src/assets/icons.tsx` con fallback emoji. |
| **motion-engineer** | Agrega micro-interacciones y animaciones funcionales: feedback al recibir cartas, transición de fases del turno, banner de "es tu turno" con vibración, secuencia del 7, notice prominente del banco. Respeta `prefers-reduced-motion`. |
| **qa-auditor** | Auditoría final por fase: accesibilidad (WCAG AA, contraste sobre el fondo océano), Core Web Vitals, responsive en 360–414px, touch targets ≥44px, anti-patterns. Reporta P0–P3 y corrige P0/P1. |

> Los agentes son frontend. **El backend (Node + Express + Socket.IO + Mongoose + auth + lógica de reglas) lo implementa el orquestador** (Claude principal) directamente. Los agentes consumen ese backend mediante los eventos definidos en el contrato y la API REST de auth.

---

## 3. Fases

Estado actual: la Fase 1 original (MVP jugable sin DB) y gran parte de la Fase 2 (dev cards, insignias, victoria, extensión 5-6, dice stats) **ya están implementadas**. Este plan cubre el **delta** introducido por el prompt actualizado.

### Fase 0 — Infraestructura (orquestador) **[NUEVO]**

0a. **Docker + docker-compose**:
   - `docker-compose.yml`: servicio `mongo` (imagen `mongo:7`, volumen `mongo-data`, credenciales por env, `restart: unless-stopped`) y servicio `server` (build desde `server/Dockerfile`, `depends_on: mongo`, `env_file: .env`).
   - `server/Dockerfile` multi-stage (`node:20-alpine`, usuario no-root): etapa de build compila client (Vite) y server (tsc); etapa final copia `client/dist` + `server/dist` y corre `npm start`.
   - `.env.example` (`MONGODB_URI`, `JWT_SECRET`, `PORT`, credenciales mongo) y `.dockerignore`. `.env` en `.gitignore`.
   - Script raíz `npm run docker:db` para levantar solo mongo.
0b. **MongoDB + auth**:
   - `server/src/db/connection.ts`: conexión Mongoose por `MONGODB_URI`, tolerante a fallos (la app de juego funciona aunque mongo no esté; auth/persistencia se degradan con mensaje claro).
   - `server/src/db/models/User.ts`: username único, email opcional único, `passwordHash` (bcrypt), `displayName`, `avatarUrl`, `color`, `stats` (gamesPlayed, wins, losses, longestRoadBadges, largestArmyBadges, totalVictoryPoints), timestamps.
   - `server/src/db/models/Match.ts`: code, extension56, startedAt/endedAt, winner, players[] (con userId opcional para invitados).
   - `server/src/auth/auth.ts`: rutas REST `POST /api/auth/register`, `POST /api/auth/login` (bcrypt 10–12 rounds, JWT 30d), `GET /api/users/me`, `PATCH /api/users/me`. Nunca devolver `passwordHash`.
   - `server/src/auth/middleware.ts`: middleware Express (`Authorization: Bearer`) + guard del handshake de Socket.IO (`auth.token` → `socket.data.userId`; sin token = invitado permitido).

### Fase 1 — Delta MVP (backend: orquestador / frontend: agentes)

**Backend (orquestador):**
1. `state.ts`: tipo `InitialBuilding { id, type, spots[{number,resource}], grantsStartingResources }`; `Player.userId?`, `Player.avatarUrl?`, `Player.initialBuildings`.
2. `server/src/game/setup.ts` (**función pura testeable**): toma los `initialBuildings` de todos → valida (2 poblados, exactamente 1 con `grantsStartingResources`, números 2–12 sin 7, 1–3 spots) → devuelve `hexes` sembrados (merge por `number`+`resource`) + reparto de recursos de inicio (respetando banco).
3. Handlers: `lobby:setInitialBuildings` (validación servidor); `game:start` exige registro completo de todos; al iniciar reparte recursos del 2º poblado y siembra `hexes`.
4. `game:create`/`game:join` aceptan usuarios autenticados (toman `displayName`/`avatarUrl`/`color` preferido del `User`) e invitados (solo `name`).
5. Tests unitarios de `setup.ts` (sembrado, merge de hexes, banco limitado en inicio) además de los de `rules.ts`.

**Frontend (ui-engineer, tras brief del ux-architect):**
6. `client/src/api.ts` (REST auth) + pantalla **Login/Registro** con "Jugar como invitado". JWT en `localStorage` y en el handshake del socket.
7. **InitialBuildSetup** en el Lobby: formulario táctil de 2 poblados (selector 2–12 sin 7, recurso con íconos, marcar 2º poblado), check verde al completar, progreso "3/4 listos" para el host; botón Iniciar bloqueado hasta que todos completen.
8. Reconexión: JWT + `{code, playerId, sessionToken}` en `localStorage`.

### Fase 2 — Delta recomendadas

**Backend (orquestador):**
9. **Persistencia de resultados:** al `game:declareWin`, crear `Match` y actualizar `stats` con `$inc` atómico para cada jugador con `userId` (wins/losses, insignias, VP). Invitados solo quedan en `Match.players`.
10. **`admin:giveCard`** (host/bank manager, en cualquier momento): entrega recurso (descuenta banco; forzable si no hay) o carta de desarrollo (descuenta mazo). **Siempre** emite `notice { level, text }` a **todos** + entrada en log (anti-trampas).
11. Evento `notice` agregado al contrato servidor→cliente.

**Frontend (agentes, en este orden):**
12. **ui-engineer:** pantalla **Profile** (foto, displayName editable, stats); panel del banco con **"Entregar carta"** (selector jugador + recurso/dev + confirmar); banner `notice` prominente para todos; **tabla de producción colapsable** (estado persistido por dispositivo en `localStorage`) y patrón colapsable en secciones densas.
13. **ux-writer:** copy del login/registro/perfil, formulario de construcciones iniciales, notices del banco ("⚠️ El banco entregó 1 trigo a Ana"), errores de auth ("usuario ya existe", "credenciales inválidas").
14. **visual-designer:** **tema Catán completo**: fondo océano (degradado/textura sutil, sin distraer), superficies pergamino/madera semiopacas con contraste WCAG AA, paleta de recursos (terracota/bosque/lima/dorado/pizarra), acentos dorados en insignias, tipografía display para títulos y código de sala, **íconos nuevos** de recursos y dev cards centralizados en un solo módulo (`client/src/assets/icons.tsx`) con fallback emoji.
15. **motion-engineer:** animación del notice del banco, reparto de cartas, transición de fases, vibración de turno, parallax/olas muy sutiles del fondo (respetando `prefers-reduced-motion`).
16. **qa-auditor:** auditoría integral (contraste sobre océano, modales nuevos accesibles, responsive 360–414px, performance). Reporte P0–P3; el orquestador corrige P0/P1.

### Fase 3 — Futuro (solo ganchos, no implementar)

- Foto del tablero + visión para autocompletar `hexes`: el modelo ya es una lista editable; comentario en `state.ts` documenta el punto de extensión.
- Variante "paired players" como alternativa a la Fase de Construcción Especial: comentario en `handlers.ts`.
- Subida real de avatar (`POST /api/users/me/avatar` multipart): gancho documentado, MVP usa URL.

---

## 3.bis — Cómo evolucionó la implementación respecto al prompt original

> Comparación del estado real del código contra `prompt-claude-code-catan.md`. Estas cosas **cambiaron** durante el desarrollo y conviene tenerlas presentes (el `context.md` describe el estado vigente):

- **`InitialBuilding` → `Building`:** el modelo final (`state.ts`) usa `Building { id, type, spots[{number,resource,hexId?}], port? }`. El `hexId` identifica la ficha física para no duplicar producción ni VP. Durante la partida los poblados **solo crecen comprándolos** (`build`); `player:setBuildings` solo edita fichas de construcciones existentes.
- **VP ocultos → `vpCards`:** se eliminó `hiddenVP`. El marcador es totalmente público; `victoryPoints.vpCards` cuenta las cartas de Punto de victoria **ya usadas**. Las que siguen en mano solo se ven como `devCardsCount`.
- **Reglas extra (`ExtraRules`), nuevas, no estaban en el prompt:** `unequalTrades`, `sharedPorts` (usar puerto ajeno con comisión), `noSpecialBuild`, `robberNoStealFirstRound`, `robberEmptyGivesResource`. Toggles del host en el lobby.
- **Modo `seedInitialResources`:** se puede iniciar "sin fichas" (nadie recibe recursos de inicio y el registro de poblados es opcional).
- **Fase de Construcción Especial = jugador opuesto:** la implementación abre la fase para el **jugador opuesto** en la mesa (variante tipo "paired"), no la cola horaria completa del prompt.
- **Amigos (feature nueva):** `Friendship` model, `auth/friends.ts`, `FriendsPanel.tsx` — solicitudes/aceptación de amistad. No estaba en el prompt.
- **Color `purple` añadido a los colores base; `game:end`** (host finaliza sin ganador) añadido.
- **Íconos:** PNGs temáticos propios en `client/src/assets/icons/` (no el arte oficial de cartas), centralizados en `assets/icons.tsx` con fallback emoji. Avatar generado determinístico por defecto.

---

## 3.ter — Iteración de cambios actual (`cambios.txt`)

> Dos cambios solicitados. **Backend = orquestador; frontend = agentes.** Tras cada agente: verificar build/tests, commit y push a la rama de trabajo y mantener el PR a `main` actualizado.

### Cambio A — Bloquear "Terminar turno" hasta registrar las fichas del poblado construido

**Problema:** al comprar un Poblado en tu turno (`build` con `type:'settlement'`), se crea con `spots: []` y queda pendiente registrar qué fichas toca. Hoy el jugador puede terminar el turno sin registrarlas, perdiendo producción futura.

**Backend (orquestador):**
1. `Player.pendingSettlementRegistration: string[]` (ids de poblados construidos este turno que aún no tienen fichas). Inicializar `[]` en `rooms.ts:createPlayer`.
2. En `build` (rama `settlement`): empujar el `id` del nuevo poblado a la lista.
3. En `player:setBuildings`: quitar de la lista los ids que ya tengan `spots.length > 0`.
4. En `turn:end`: si el jugador activo tiene la lista no vacía → `error` claro y **no** avanzar el turno.
5. Igual en `specialBuild:done` (un poblado comprado en construcción especial también debe registrarse antes de pasar).
6. Limpiar la lista al rotar de turno (`nextTurn`), por seguridad.
7. Exponer `pendingSettlementRegistration` en la vista del dueño (`views.ts:me`) para que el cliente sepa que debe registrar.

**Frontend (agentes):** deshabilitar/condicionar "Terminar turno" cuando haya registro pendiente, resaltar el poblado nuevo en la tabla de construcción con un CTA "Registrar fichas", y copy claro del por qué.

### Cambio B — Racha de victorias (win streak) + insignia de fuego

**Backend / DB (orquestador):**
1. `User.stats`: añadir `currentWinStreak` y `longestWinStreak` (default 0).
2. `persistMatch.ts`: al persistir, usar update con **pipeline de agregación** por jugador:
   - Ganador: `currentWinStreak += 1`; luego `longestWinStreak = max(longestWinStreak, currentWinStreak)`.
   - Perdedor: `currentWinStreak = 0` (longest sin cambios).
   - Usar `$ifNull` para usuarios viejos sin los campos.
3. `toPublicUser` ya expone `stats` completo (los nuevos campos viajan solos).

**Frontend (agentes):**
1. `types.ts`: añadir `currentWinStreak`, `longestWinStreak` a `UserStats`.
2. **ProfileScreen:** insignia 🔥 **arriba a la derecha** del perfil con el número de victorias seguidas (`currentWinStreak`, visible cuando > 0); y un campo nuevo en las stats: **"Racha más larga"** (`longestWinStreak`).
3. **visual-designer:** estilo de la insignia de fuego (acento dorado/llama, tema Catán).
4. **motion-engineer:** micro-animación sutil de la llama (respeta `prefers-reduced-motion`).

### Orquestación de agentes para esta iteración (en orden)

1. **ux-architect** → brief de ambos cambios (UX del bloqueo de fin de turno y de la insignia de racha) en `docs/brief-cambios-v3.md`.
2. **ui-engineer** → implementa el frontend de A y B (guard de fin de turno, tipos, insignia 🔥, campo "Racha más larga").
3. **ux-writer** → copy: mensaje de bloqueo, CTA "Registrar fichas", labels de racha.
4. **visual-designer** → tratamiento visual de la insignia de fuego y el campo de racha.
5. **motion-engineer** → animación sutil de la llama.
6. **qa-auditor** → auditoría P0–P3 de ambos cambios; el orquestador corrige P0/P1.

---

## 4. Contrato entre fases / agentes

Cada agente recibe del anterior:
- **Brief** (ux-architect → ui-engineer): pantallas, flujos, casos extremos (guardado en `docs/`).
- **Componentes funcionales** (ui-engineer → ux-writer / visual-designer / motion-engineer): listos para refinar sin romper la lógica.
- **Reporte P0–P3** (qa-auditor → orquestador): correcciones priorizadas.

Después de cada agente, el orquestador verifica el output, ejecuta `npm run build` y los tests, y pasa al siguiente.

---

## 5. Entregables finales

- App funcional: `docker compose up --build` (todo en contenedores) **o** `docker compose up -d mongo` + `npm run dev` (desarrollo) **o** `npm run build` + `npm start` (producción local en un proceso).
- `.env.example` documentado; `.env` ignorado por git.
- README con ambos modos de uso y variables de entorno.
- Tests unitarios de `server/src/game/rules.ts` y `server/src/game/setup.ts`.
- Auth segura: bcrypt con sal, JWT por env, sin passwordHash al cliente, sin loguear secretos.
- UI 100% en español, identificadores en inglés, tema Catán en todas las pantallas.
- Mobile-first verificado en 360–414px. Accesibilidad WCAG AA.
