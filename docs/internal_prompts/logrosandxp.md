# logrosandxp.md — Plan de implementación de `cambios.txt`

> Plan de trabajo para los cambios solicitados en `cambios.txt` (Catán base): **bugs**, **features** y el sistema de **logros + XP**. Sigue la convención del proyecto (`context.md` §10): el **backend** (Node/Express/Socket.IO/Mongoose/reglas) lo implementa el **orquestador** (Claude principal); los **6 agentes son de frontend** y consumen el contrato Socket.IO + REST. Prioridad: **resolver bugs primero**. Cada cambio terminado y verificado se commitea en `main`.

---

## 0. Orden de ejecución y verificación

1. **Bugs** (P0/P1) → 2. **Features** (P2) → 3. **Logros + XP** (feature mayor).
2. Verificación por cambio: `cd server && npx tsc --noEmit && npm test`; `cd client && npm run build`. Cuando aplique, prueba manual del flujo.
3. **Commit en `main`** tras verificar cada cambio (mensaje convencional `fix(...)` / `feat(...)`).

Leyenda de agentes: `ux-architect` (diseña, no codea) · `ui-engineer` (implementa componentes) · `visual-designer` (refina visual) · `motion-engineer` (animación/micro-interacciones) · `ux-writer` (copy en español) · `qa-auditor` (audita A11y/perf/responsive, P0–P3).

---

## 1. BUGS (prioridad)

### B1 — 5–6 jugadores: deben existir **2 desiertos**
- **Síntoma:** `rebuildHexes` siempre crea exactamente 1 hex desierto.
- **Owner:** orquestador (backend). **Archivos:** `server/src/game/setup.ts` (`rebuildHexes`, `applyInitialSetup`) y sus llamadores en `handlers.ts`.
- **Plan:** `rebuildHexes` recibe el nº de desiertos (1 en base, 2 en `extension56`); preserva la posición del ladrón por id; los desiertos se identifican con ids estables. Pasar `state.extension56` en cada llamada.
- **Verifica:** test nuevo en `setup.test.ts` (5–6 → 2 desiertos; base → 1; ladrón sobrevive a rebuild).

### B2 — `robberNoStealFirstRound`: semántica correcta
- **Síntoma:** hoy, en la 1ª ronda, se fuerza el **descarte** de quienes tienen >7 y se **omite el robo**. Debe ser al revés.
- **Regla correcta (cambios.txt):** en la 1ª ronda con la regla activa, **NADIE descarta** por el 7, pero el ladrón se mueve y **roba 1 carta normal** al dueño elegido de la ficha.
- **Owner:** orquestador (backend). **Archivos:** `server/src/socket/handlers.ts` (`turn:rollNumber`, `turn:rollCK`, `robber:move`).
- **Plan:** en el 7, si `robberNoStealFirstRound && firstRound`: saltar `computePendingDiscards` (sin fase `discard`), ir directo a `robber` (`pendingRobberMove=true`). En `robber:move`: quitar la rama que ponía `phase='main'` en la 1ª ronda — el robo procede normal.
- **Verifica:** prueba manual del 7 en la 1ª ronda con la regla activa (sin descartes; sí robo).

### B3 — Contadores de los modales de descarte/puerto siempre en cero
- **Síntoma:** los selectores de cantidad conservan los valores de la vez anterior porque el componente vive montado y su `useState` persiste entre apariciones.
- **Owner:** `ui-engineer` (+ `qa-auditor` revisa). **Archivos:** `client/src/components/DiscardModal.tsx` y `client/src/components/PortIncomingModal.tsx`.
- **Plan:** resetear los `picks`/`commodityPicks`/`commission` a `{}` cuando el modal **(re)aparece** (efecto sobre la transición "no visible → visible", p. ej. `pendingDiscards[me.id]` 0→>0, o `pendingForMe` false→true). No cambia copy ni layout.
- **Verifica:** abrir el modal, descartar; al reaparecer en el mismo turno/ronda, todos los contadores en 0.

---

## 2. FEATURES

### F1 — Mover el ladrón a una **ficha vacía**
- **Estado:** `RobberHexList` (en `ConstructionTable.tsx`) ya lista el desierto y permite moverlo ahí; con **B1** habrá 2 desiertos en 5–6. Falta hacerlo **claro**.
- **Owner:** `ui-engineer` + `ux-writer`. **Archivos:** `ConstructionTable.tsx` (RobberHexList).
- **Plan:** etiquetar los desiertos como **"Ficha vacía (desierto)"**, agruparlos/destacarlos al final de la lista y dejar claro que mover ahí no roba a nadie (combina con `robberEmptyGivesResource`). Sin cambios de backend.

### F2 — **Salir de la partida** (devuelve cartas al banco, con confirmación)
- **Owner backend:** orquestador. **Archivos:** `handlers.ts` (nuevo `game:leave`), `state.ts`, `rules.ts`, `views.ts` si hace falta.
- **Plan backend:** durante `playing`, el jugador confirma y abandona: su mano vuelve al banco; sus cartas de desarrollo, al `devDeck`; en C&K también mercancías→`commodityBank` y cartas de progreso→mazos. Se le quita de `players`/`turnOrder`, se corrige `currentTurnIndex` (si era su turno, se avanza), se reasigna `hostId`/`bankManagerId` si era suyo, se `rebuildHexes` + `recomputeVictoryPoints`/`recomputeLargestArmy`. Log + `notice`. Acción no deshace stats (no estaba terminada).
- **Owner frontend:** `ui-engineer` (botón + modal de confirmación, patrón de `EndGameButton`), `ux-writer` (copy de confirmación: claro, sin culpar; advierte que pierde su lugar y devuelve cartas), `qa-auditor` (A11y del alertdialog). **Store:** `leaveGame()` → `socket.emit('game:leave')`.
- **Verifica:** salir en mitad de partida; banco recupera cartas; el turno avanza; roles reasignados.

### F3 — Ícono de **racha** 🔥 con número en la foto de perfil
- **Owner backend:** orquestador. **Archivos:** al crear/unirse (`handlers.ts loadProfile`/`createRoom`/`joinRoom` en `rooms.ts`) cargar `currentWinStreak` del `User` y guardarlo en `Player.winStreak`; exponerlo en `PublicPlayer` (`views.ts`).
- **Owner frontend:** `visual-designer` (badge sobre el avatar usando el `FireGlyph` ya existente en `assets/icons.tsx`), `motion-engineer` (micro-animación de aparición, respeta `prefers-reduced-motion`), `ui-engineer` (prop opcional `streak` en `Avatar` y mostrarlo donde se vean avatares: lobby, `PublicPlayersPanel`/marcador, `WinnerScreen`). Solo se muestra si `streak >= 1`.
- **Verifica:** un usuario con racha ≥1 muestra 🔥 + número; invitados (sin cuenta) no.

### F4 — Ver el **perfil de un amigo** (estadísticas completas)
- **Owner frontend:** `ux-architect` (mini-brief del detalle de perfil: qué stats, jerarquía, casos vacíos), `ui-engineer` (modal/pantalla de detalle abierto desde `FriendsPanel`), `visual-designer` (jerarquía visual de stats + XP/nivel + insignias), `qa-auditor`. **Backend:** `/api/friends` ya devuelve `stats` del amigo; al añadir XP/logros a `stats` (ver §3) el perfil del amigo los hereda gratis.
- **Verifica:** abrir un amigo desde la lista muestra: partidas/ganadas/PV/insignias/racha actual y máxima/XP/nivel/logros.

---

## 3. LOGROS + XP (feature mayor)

### 3.1 Modelo de XP
XP total acumulada por jugador registrado, al **terminar** la partida (`persistMatchResult`):
- **Partida ganada:** +10 · **Cada insignia** (camino más largo / ejército más grande): +5 · **Puntos de victoria:** +1 XP por PV · **Racha** (por cada victoria a partir de la 2ª consecutiva): +10 · **Logro desbloqueado:** su XP (una sola vez).
- **Nivel** (derivado, no se persiste aparte): `nivel = floor(sqrt(xp / 100)) + 1` (curva suave; documentar en la UI la XP al siguiente nivel). Decisión de orquestador; el `ux-architect` puede proponer otra curva.

### 3.2 Catálogo de logros (19)
| id | nombre | condición | XP | dato necesario |
|----|--------|-----------|----|----|
| `hay_overload` | El más pajero | 15 trigo (paja) en mano a la vez | 15 | pico de `grain` |
| `halfway` | A mitad de camino | 5 PV en un solo turno | 25 | Δ PV en el turno |
| `walker` | El caminante | 15 caminos en una partida | 15 | caminos construidos/partida |
| `you_know_it` | YA SE LA SABEN! | robar 10 recursos en una partida | 15 | `stealsByPlayer` (ya existe) |
| `loser` | Perdedor | terminar con ≤3 PV | 15 | PV final |
| `bad_luck` | Mala suerte | una ronda completa sin recibir recurso | 15 | recursos recibidos/ronda |
| `pacifist` | Pacifista | terminar sin robar ni un recurso | 15 | `stealsByPlayer == 0` |
| `amateur` | Amateur | 20 PV acumulados (carrera) | 20 | `stats.totalVictoryPoints` |
| `casual` | Jugador casual | 50 PV acumulados | 50 | idem |
| `pro` | Profesional | 200 PV acumulados | 200 | idem |
| `decorated` | Condecorado | ambas insignias en una partida | 15 | longestRoad && largestArmy |
| `bellyflop` | Panzazo | ganar mientras un rival tiene 9 PV | 15 | PV de rivales al ganar |
| `stone_addict` | Adicto a la piedra | 15 minerales en mano a la vez | 15 | pico de `ore` |
| `sea_trader` | Comerciante marítimo | 4 puertos en una partida | 25 | pico de `ports.length` |
| `crack` | Crack! | 6 PV en un solo turno | 40 | Δ PV en el turno |
| `developed` | Desarrollado | comprar 5 cartas de desarrollo en un turno | 15 | compras dev/turno |
| `demolisher` | Victoria demoledora | ganar sin que ningún rival llegue a 6 PV | 25 | PV de rivales al ganar |
| `streaker` | Enrachado | racha de 5 victorias seguidas | 50 | `currentWinStreak >= 5` |
| `villager` | Pueblerino | ganar sin construir una ciudad | 40 | ciudades al ganar |

### 3.3 Backend (orquestador)
- **Tracking en partida:** añadir `Player.gameStats` (en memoria; no entra a la vista) reseteado en `game:start`: picos por recurso, picos de puertos, caminos/partida, Δ PV por turno (con baseline `turnStartVP` al rotar turno), compras dev/turno, recursos recibidos en la ronda + flag `hadDryRound`. Hooks:
  - **Picos** (recurso y puertos): actualizar en `broadcastState` (una pasada barata por jugador en cada `state:update`).
  - **Δ PV por turno:** fijar baseline en `nextTurn`; en `broadcastState` actualizar el pico del turno del jugador activo.
  - **Caminos / compras dev:** en el handler `build`.
  - **Recursos por ronda / dry round:** sumar en `distributeForRoll`; al cerrar ronda (wrap de `currentTurnIndex` a 0) evaluar `hadDryRound`.
  - **Robos:** `stealsByPlayer` (existe).
- **Catálogo + evaluación:** nuevo módulo `server/src/game/achievements.ts` con el catálogo (`id, name, description, xp`) y `evaluateAchievements(player, gameStats, careerStats, ctx)` puro → ids recién desbloqueados. **Tests** en `achievements.test.ts`.
- **Persistencia:** `User.stats` gana `xp: number` y `achievements: string[]` (`$ifNull` para usuarios viejos). En `persistMatchResult`: calcular logros nuevos (excluyendo los ya desbloqueados), sumar XP (regla 3.1 + XP de logros nuevos), `$addToSet` los logros. Devolver al cliente (vía stats en `/api/users/me`) `xp`, `achievements`.
- **Tipos cliente:** espejar en `client/src/types.ts` (`UserStats.xp`, `achievements`).

### 3.4 Frontend
- **`ux-architect`:** mini-brief de la pantalla de logros (jerarquía: header con XP/nivel/barra al siguiente nivel; lista de logros; estado desbloqueado vs bloqueado; toggle "ocultar no conseguidos"; orden: desbloqueados arriba). Casos: 0 logros, todos desbloqueados.
- **`ui-engineer`:** catálogo espejo en cliente (`lib/achievements.ts`: id, nombre, descripción, XP, ícono); componente `AchievementsPanel`/sección en `ProfileScreen` (y reutilizable en el perfil de amigo de **F4**): lista con orden desbloqueados→bloqueados, toggle de ocultar bloqueados, contador de logros y de XP. Header de XP + nivel + barra de progreso.
- **`visual-designer`:** tratamiento de logro **bloqueado** (monocromo/atenuado) vs **desbloqueado** (con color del tema Catán), medalla/insignia, barra de XP premium; contraste WCAG AA.
- **`motion-engineer`:** al desbloquear (en `WinnerScreen` al terminar la partida) animar la entrada de los logros nuevos y el avance de la barra de XP; respeta `prefers-reduced-motion`.
- **`ux-writer`:** revisar nombres/descripciones de los 19 logros para que sean claros y con tono del juego; copy del header de XP/nivel y del toggle; empty state.
- **`qa-auditor`:** auditar `AchievementsPanel` y `ProfileScreen` (A11y de la lista y el toggle, contraste de estados bloqueado/desbloqueado, performance de la lista, responsive).

### 3.5 Verificación
- Tests del catálogo y de `evaluateAchievements` (server). Build cliente. Prueba manual: ganar una partida y ver XP/logros sumados en el perfil; toggle de ocultar; orden; perfil de amigo.

---

## 4. Resumen de asignación por agente

- **orquestador (backend):** B1, B2, F2 (server), F3 (server), §3.3 completo (tracking, catálogo, persistencia, tests), espejo de tipos.
- **ui-engineer:** B3, F1, F2 (UI+store), F3 (Avatar), F4 (modal de perfil), §3.4 (catálogo cliente, `AchievementsPanel`, header XP).
- **visual-designer:** F3 (badge 🔥), F4 (jerarquía visual), §3.4 (estados de logro, barra de XP).
- **motion-engineer:** F3 (animación del badge), §3.4 (desbloqueo en WinnerScreen, barra de XP).
- **ux-architect:** F4 (brief de perfil), §3.4 (brief de la pantalla de logros).
- **ux-writer:** F1 (label ficha vacía), F2 (confirmación), §3.4 (nombres/descripciones de logros, copy de XP).
- **qa-auditor:** revisión P0–P3 de B3, F2, F4 y §3.4.
