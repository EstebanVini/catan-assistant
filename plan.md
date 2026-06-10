# Plan de desarrollo — Catán Assistant

> Plan completo de desarrollo del asistente digital para partidas presenciales de Catán. Basado en `prompt-claude-code-catan.md` y aprovechando el equipo de agentes disponible en `.claude/agents/`.

---

## 1. Resumen del producto

App web **mobile-first** que reemplaza el papel y las cartas de recursos en una partida presencial de Catán. Sincronización en tiempo real entre los celulares de los jugadores mediante un código de sala. Soporta edición base (3–4 jugadores) y extensión 5–6 jugadores.

**Stack**:
- Backend: Node.js + Express + Socket.IO, estado en memoria, sirve el frontend compilado en un solo proceso.
- Frontend: React + Vite + Zustand + `socket.io-client`, TypeScript, mobile-first.
- Identificadores de código en inglés; UI en español.

---

## 2. Equipo de agentes y su responsabilidad

| Agente | Rol en este proyecto |
|---|---|
| **ux-architect** | Define los flujos de usuario y produce design briefs para cada pantalla (Home, Lobby, Game) y para los flujos críticos (secuencia del 7, intercambio, fase de construcción especial). Identifica casos extremos. No escribe código. |
| **ui-engineer** | Implementa los componentes y pantallas en React + TypeScript + Tailwind. Conecta el cliente al Socket.IO. Construye la store Zustand y los componentes funcionales (HandView, ProductionTable, DiceInput, Log, etc.). |
| **ux-writer** | Audita y mejora todo el copy en español: labels, CTAs, mensajes de error, toasts, empty states, instrucciones de fases. Define el glosario del producto (Camino, Poblado, Ciudad, Carta de desarrollo, etc.). |
| **visual-designer** | Refina la jerarquía visual, paleta de color (incluida la identidad de cada jugador), tipografía y espaciado. Eleva el look-and-feel a calidad premium sin desviarse del mobile-first. |
| **motion-engineer** | Agrega micro-interacciones y animaciones funcionales: feedback al recibir cartas, transición de fases del turno, banner de "es tu turno" con vibración, secuencia del 7. Respeta `prefers-reduced-motion`. |
| **qa-auditor** | Auditoría final por fase: accesibilidad (WCAG AA), Core Web Vitals, responsive en 360–414px, touch targets ≥44px, anti-patterns. Reporta P0–P3 y corrige P0/P1. |

> Los agentes son frontend. **El backend (Node + Express + Socket.IO + lógica de reglas) lo implementa el orquestador** (Claude principal) directamente, porque ningún agente está especializado en backend. Los agentes consumen ese backend mediante los eventos definidos en el contrato.

---

## 3. Fases

El proyecto sigue las fases del prompt original: **Fase 1 (MVP jugable)**, **Fase 2 (recomendadas)**, **Fase 3 (futuro, solo ganchos)**.

### Fase 0 — Setup (orquestador)

- Crear `package.json` raíz con workspaces o scripts coordinados (`dev`, `build`, `start`).
- Estructura de carpetas: `server/` y `client/`.
- TypeScript en ambos lados.
- Tailwind CSS en el client, Vite con proxy a `http://localhost:3001`.
- Express sirve `client/dist` + fallback SPA.

### Fase 1 — MVP jugable

Orden de turnos por agente:

1. **ux-architect** — produce 3 design briefs:
   - **Home**: crear partida, unirse por código, reconectar desde `localStorage`.
   - **Lobby**: código compartible, lista de jugadores, selección de color, orden de turnos, encargado del banco, toggle extensión 5-6.
   - **Game**: barra de turno, mano privada, acciones (construir/intercambiar/terminar turno), tabla de producción editable, panel del banco, estado público de jugadores, log, secuencia del 7 (descarte + ladrón + robar carta).

2. **Orquestador (backend)** — Fase 1 del servidor:
   - `server/game/state.ts`: tipos `Resource`, `Hand`, `Player`, `Hex`, `GameState`.
   - `server/game/rules.ts`: lógica pura (costos, distribución con banco limitado, secuencia del 7, robo aleatorio, intercambio con puertos, validación de construcción).
   - `server/game/rooms.ts`: `Map<code, GameState>`, helpers de creación e identidad (`playerId`, `sessionToken`).
   - `server/socket/handlers.ts`: registro de los eventos `game:create`, `game:join`, `game:reconnect`, `lobby:*`, `turn:rollNumber`, `discard:submit`, `robber:move`, `robber:steal`, `build`, `trade:*`, `turn:end`, `action:undo`, `hex:*`.
   - **Vista personalizada por socket**: serializa el estado ocultando manos ajenas.
   - Pila de snapshots para `undo`.
   - Express sirve `client/dist` + fallback SPA.

3. **ui-engineer** — Fase 1 del cliente:
   - `client/src/socket.ts`: instancia única de `socket.io-client` con reconexión y reenvío de credenciales desde `localStorage`.
   - `client/src/store.ts`: Zustand con `me`, `state` (vista personalizada), `hand`, helpers para emitir eventos.
   - Pantallas: `Home`, `Lobby`, `Game`.
   - Componentes: `HandView`, `ProductionTable` (editable: agregar/quitar dueños, marcar `settlement`/`city`, indicar ladrón), `DiceInput` (teclado 2–12, solo bank manager), `BuildActions`, `TradePanel` (banco/puertos + entre jugadores), `DiscardModal`, `RobberFlow` (mover ladrón + botón "Robar carta"), `Log`, `PublicPlayersPanel`.
   - Mobile-first puro: una columna, touch targets ≥44px, navegación inferior.

4. **ux-writer** — pasa sobre el cliente:
   - Define el glosario (Camino, Poblado, Ciudad, Carta de desarrollo, Mano, Banco, Encargado del banco, Tirar, Descartar, Mover ladrón, Robar carta, Terminar turno, etc.).
   - Mejora CTAs, mensajes de error ("no alcanza para construir Poblado: te faltan 1 madera, 1 trigo"), empty states, toasts ("Es tu turno", "Recibiste 2 ovejas, 1 mineral"), instrucciones de la secuencia del 7.
   - Verifica voz activa y segunda persona.

5. **visual-designer** — pasa visual:
   - Paleta: define colores de identidad de jugador (rojo, azul, blanco, naranja) con contraste accesible sobre fondo oscuro y claro.
   - Iconos de recursos (brick, lumber, wool, grain, ore) con consistencia cromática.
   - Tipografía: jerarquía clara entre número de cartas (grandes), labels (medianos), log (pequeño).
   - Estado activo del turno con tratamiento visual claro (borde de color, no solo texto).
   - Cards de jugador y panel del banco con jerarquía premium.

6. **motion-engineer** — micro-interacciones funcionales:
   - Transición suave al cambiar de fase (`roll` → `discard` → `robber` → `main`).
   - Feedback al recibir/perder cartas (count anima de un número al otro con spring).
   - Banner "Es tu turno" con entrada animada + vibración (`navigator.vibrate`).
   - Toast del log con auto-dismiss.
   - Botones con feedback de press (scale 0.97).
   - Respeta `prefers-reduced-motion` siempre.

7. **qa-auditor** — auditoría Fase 1:
   - Accesibilidad: contraste, focus indicators, ARIA en modales (descarte, intercambio), navegación por teclado.
   - Responsive: 360–414px sin overflow, touch targets ≥44px, `min-h-[100dvh]` donde aplique.
   - Performance: animaciones solo `transform`/`opacity`, no layout thrashing.
   - Anti-patterns: sin emojis, sin `any` injustificado, sin código truncado.
   - Reporte P0–P3; corrige P0 y P1.

### Fase 2 — Recomendadas

Misma rotación de agentes, ahora sobre los features añadidos:

1. **ux-architect** — briefs para:
   - Cartas de desarrollo (comprar, jugar Knight/Monopoly/Year of Plenty/Road Building).
   - Marcador de puntos de victoria + insignias (Ejército más grande automático, Camino más largo manual).
   - Declarar victoria a 10.
   - **Extensión 5–6 jugadores**: toggle en lobby, colores verde/café, banco 24, mazo 34, **Fase de Construcción Especial** (cola, "Listo", saltar).
   - Estadísticas de dados (histograma).
   - Notificación/vibración de turno.

2. **Orquestador (backend)** — Fase 2 del servidor:
   - Mazo de desarrollo barajado según el modo (base 25 / extensión 34).
   - Efectos de cartas de desarrollo (Knight reusa el flujo del 7; Monopoly transfiere todas las cartas del recurso; Year of Plenty toma 2 del banco; Road Building permite 2 caminos sin costo).
   - Regla "no se juega el mismo turno que se compra".
   - Cálculo de Ejército más grande (≥3, mayor, empate conserva el dueño previo).
   - Asignación manual de Camino más largo (`vp:setLongestRoad`).
   - Detección de victoria a 10 + `game:declareWin`.
   - Toggle `extension56` en lobby: ajusta máx jugadores (6), banco (24), mazo (34).
   - Fase de Construcción Especial: tras `turn:end`, llenar `specialBuildQueue` con los demás en orden horario; cada jugador puede construir/comprar dev (no intercambiar ni jugar dev); `specialBuild:done` y `specialBuild:skip`; al vaciarse, siguiente turno.
   - `diceStats` (histograma).
   - Tests unitarios mínimos de `rules.ts`.

3. **ui-engineer** — Fase 2 del cliente:
   - `DevCardsPanel` (privado): comprar, listar, jugar.
   - `VictoryTracker` público con insignias.
   - Banner ganador.
   - Lobby: toggle 5-6, colores adicionales.
   - `SpecialBuildBanner` y flujo de cola con botón "Listo" + opción del host de "Saltar".
   - `DiceStats` (mini-histograma).
   - Vibración de turno (`navigator.vibrate`).

4. **ux-writer** — copy de:
   - Nombres y descripciones de cartas de desarrollo.
   - Mensaje claro al ganar.
   - Tooltips del marcador (qué incluye Ejército más grande, Camino más largo).
   - Banner de Fase de Construcción Especial.
   - Mensajes del histograma.

5. **visual-designer** — refina:
   - Insignias (Camino más largo, Ejército más grande) con tratamiento icónico.
   - Tarjetas de desarrollo con identidad visual distinguible (Knight ≠ Monopoly).
   - Colores verde y café/marrón coherentes con la paleta base.
   - Estado "Fase de Construcción Especial" claramente diferenciado del turno normal.
   - Pantalla de ganador con tratamiento celebratorio (contenido, no caricaturesco).

6. **motion-engineer** —
   - Entrega/recibo de cartas en Monopoly (transferencia masiva con stagger).
   - Animación al obtener una insignia (transferida entre jugadores).
   - Confeti contenido o tratamiento sutil al declarar victoria.
   - Avance de cola en la Fase de Construcción Especial.

7. **qa-auditor** — auditoría Fase 2:
   - Verifica que los modales nuevos (compra de dev, declaración de victoria, fase especial) son accesibles.
   - Responsive sigue intacto.
   - Performance no degradada por las nuevas animaciones.
   - Reporte P0–P3.

### Fase 3 — Futuro (solo ganchos)

- Foto del tablero + visión para autocompletar `hexes`: el modelo de `hexes` ya está diseñado como lista editable, así que no se requiere reescritura. Solo un comentario en `state.ts` documentando el punto de extensión.
- Variante "paired players" (turno emparejado) como alternativa a la Fase de Construcción Especial: comentario en `handlers.ts` señalando dónde insertar el flujo alternativo.

---

## 4. Contrato entre fases / agentes

Cada agente recibe del anterior:
- **Brief** (cuando es ux-architect → ui-engineer): pantallas, flujos, casos extremos.
- **Componentes funcionales** (cuando es ui-engineer → ux-writer / visual-designer / motion-engineer): listos para refinar sin romper la lógica.
- **Reporte P0–P3** (cuando es qa-auditor → orquestador): correcciones priorizadas.

Después de cada agente, el orquestador (yo) verifica el output, ejecuta `npm run build` cuando aplica, y pasa al siguiente.

---

## 5. Entregables finales

- App funcional con un solo `npm start` que sirve frontend + backend en un proceso.
- README con instrucciones de instalación y uso.
- Tests unitarios mínimos de `server/game/rules.ts`.
- UI 100% en español, identificadores en inglés.
- Mobile-first verificado en 360–414px.
- Accesibilidad WCAG AA.
