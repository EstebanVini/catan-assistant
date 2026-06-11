# Fase 3 — Tareas pendientes (retomar aquí)

Estado (2026-06-10, cierre): pases de qa-auditor, visual-designer y motion-engineer **completados** y commiteados. Builds de client y server en verde; 21 tests del server pasan. Queda solo la verificación manual E2E multi-dispositivo (§5) y la deuda de §4 que no se resolvió con los cambios de lógica posteriores.

## Hecho (no repetir)

1. Tipos nuevos en `client/src/types.ts` (InitialBuilding, NoticePayload, User/UserStats, avatarUrl/isRegistered/setupComplete).
2. `client/src/api.ts` (register/login/getMe/patchMe, manejo de 503 y red).
3. JWT en handshake del socket (`client/src/socket.ts`, `refreshSocketAuth`).
4. Store: auth (token/user/guest), cola de notices, `setInitialBuildings`, `giveCard`, name opcional en create/join.
5. `InitialBuildSetup` en Lobby (cards fijas, radio, picker sin 7, autosave, hidratación, progreso N/M, gating de Iniciar).
6. `GiveCardModal` en BankPanel + `NoticeBanner` global (cola, 8s/2.5s, z sobre modales).
7. `CollapsibleSection` + `useCollapsePref` aplicado a ProductionTable / PublicPlayersPanel / DiceStats / Log (`ui.collapse.<id>`).
8. `LoginScreen`, `ProfileScreen`, chip de cuenta en Home, modales sin nombre si hay sesión, routing de entrada en `App.tsx`, evento `storage` entre pestañas.
9. Proxy `/api` en `client/vite.config.ts`.
10. Pase de copy (ux-writer): glosario `PHASE3_TERMS` y frases canónicas en `lib/spanish.ts`.
11. Pase visual-designer (punto 6 del brief) COMPLETO: tema oscuro madera/noche; tokens canónicos como custom properties `:root` en `client/src/index.css` (espejos: `tailwind.config.js`, `lib/playerColors.ts`, `assets/icons.tsx`); módulo único `client/src/assets/icons.tsx` (recursos + 5 dev cards + ladrón + insignias, fallback emoji); `font-display` SOLO en título de app (Home/Login, dorado), código de sala (Lobby), h1 de WinnerScreen (dorado) y encabezados de sección; `neutral-500` subido a `#9a8268` y texto sobre océano subido a ≥`neutral-300` para AA; tabla de verificación en `docs/contrast-verification.md`.

## Pendiente (en orden recomendado)

### 1. qa-auditor — HECHO
- Corregido (P1): NoticeBanner info `bg-sky-600`→`bg-sky-700`; botones destructivos `bg-red-500`→`bg-red-600` (GiveCardModal, LogoutConfirm); botón × de chips de ficha a 44×44; links inline con área táctil 44px (LoginScreen, HomeScreen, ProfileScreen); pila de toasts baja a `top-[4.75rem]` cuando hay notice activo (App.tsx).
- Verificado sin cambios: NoticeBanner ámbar (9.2:1), estados emerald/ámbar, toggle de contraseña, a11y de SpotPickerSheet/GiveCardModal/AccountMenu (todos con `useModalA11y`).
- P2/P3 reportados (no bloquean): roving tabindex en radiogroups de SpotPickerSheet; GiveCardModal correlaciona errores por regex del copy (fix real = ack, §4); NoticeBanner `role="status"`+assertive; badge "Tú" a 9px; toasts sin aria-label de descarte.

### 2. visual-designer — punto 6 del brief — HECHO (ver "Hecho" #11)
- Queda para el qa-auditor: re-verificar contra `docs/contrast-verification.md` (en especial texto sobre océano y el nuevo `neutral-500`).
- Quedan para el ui-engineer (gancho, opcional): `DevCardGlyph`/`RobberGlyph` ya existen en `assets/icons.tsx` sin consumidor — usarlos cuando se agreguen íconos a chips de dev cards / pill "Ladrón" (se evitó aquí para no mover tamaños).

### 3. motion-engineer — HECHO
- Login ↔ registro: slide horizontal 200ms con paneles persistentes (`.view-pane` en index.css); en reduced-motion el swap es instantáneo.
- Tick "Registro completo": pop con micro-rebote (320ms) + check que se dibuja con stroke-dashoffset (220ms, delay 120ms); `CheckIcon` con prop `animated` opt-in.
- Olas del océano: capa `body::after` con drift de un tile completo (52s, lineal, transform en compositor); en reduced-motion `animation: none`.

### 4. Desviaciones conocidas / deuda a resolver
- ~~**Vaciar una card tras completar no baja el contador del host**~~ RESUELTO: `player:setBuildings` acepta estados parciales (0–3 fichas); `setupComplete` solo es true con 2 poblados de 1–3 fichas.
- ~~**Conteo del mazo de desarrollo no visible**~~ RESUELTO: el estado público expone `devDeckCount` y GiveCardModal muestra "Mazo: N".
- ~~**Poblado con 0 fichas (desierto costero)**~~ RESUELTO: la validación laxa permite 0 fichas durante la partida (para INICIAR sigue exigiéndose 1–3 por poblado).
- **Toast personal "Recibiste 1 trigo del banco." omitido**: requiere evento dirigido del server al receptor (hoy: pulso de mano + notice público).
- **GiveCard sin ack**: éxito optimista a 900ms; ideal: ack en `admin:giveCard` para estados exactos (submitting→success/error).
- **Avatar en lista del lobby** usa `p.name` como seed (el username no es público); aceptable, revisar si el server expone username.

### 4b. Cambios de lógica post-Fase 3 (2026-06-11, pedidos por Esteban)
1. **Recursos de inicio para todos los poblados**: al iniciar, cada jugador recibe 1 carta por CADA ficha que tocan sus 2 poblados (ya no solo el 2º). `grantsStartingResources` eliminado del modelo y el radio del lobby retirado.
2. **Rechazo de intercambio individual**: `TradeOffer.rejectedBy` — la oferta se oculta solo para quien rechazó; se retira cuando todos los elegibles rechazaron (o el único destinatario, si era dirigida). El emisor ve "N de M rechazaron".
3. **Tabla de construcción** (reemplaza "Tabla de producción"): listas de poblados y ciudades SOLO propias; cualquier jugador agrega/edita/quita a voluntad, en cualquier momento y sin requerir recursos (`player:setBuildings`, también usado por el lobby). El server deriva los hexes de producción (merge número+recurso, desierto fijo, ladrón preservado) y los VP/recuentos se cuentan desde la tabla. Recuento público de poblados/ciudades en el panel de Jugadores. El picker del ladrón vive en la misma sección (lista de fichas de toda la mesa, derivada). Los handlers `hex:*` se eliminaron.
- Verificado con smoke E2E real (server + 3 sockets): reparto inicial, edición fuera de turno, producción compartida, rechazos individuales, oferta dirigida, aceptación.
- Nota de diseño: los botones "Construir" del ActionGrid siguen siendo el flujo que descuenta recursos (con validación de costo); el registro libre es vía la Tabla de construcción.

### 4d. Cambios 3 de cambios.txt (2026-06-11, pedidos por Esteban)
1. **Tabla dirigida por compras**: ya no se agregan poblados/ciudades a mano (botones eliminados). Comprar un Poblado crea su slot vacío en la tabla; comprar una Ciudad pide elegir qué poblado convertir (`build {type, settlementId}`). `player:setBuildings` en partida solo permite editar fichas y quitar (el server rechaza altas y cambios de tipo). En el lobby sigue libre para el registro inicial.
2. **Confirmación de compra**: toda compra (camino, poblado, ciudad, carta) pasa por un modal con el costo; la ciudad integra ahí el selector de poblado.
3. **Banco ilimitado**: ningún flujo se bloquea por banco insuficiente (tirada, trade banco, YoP, entrega manual, reparto inicial). Los contadores son informativos con piso en 0 (`drainBank`). El forzado del GiveCardModal quedó solo para el mazo de desarrollo. Bonus: entrega de dev card sin tipo ahora sí toma la cima del mazo (bug previo).
4. **Marcador propio en el TopBar**: nombre + color + "N pts" siempre visibles.
5. **Sección "Cartas de desarrollo"** bajo la Tabla de construcción: lista mis cartas con preview de solo lectura (arte grande + descripción); `DevCardPreview` extraído como componente compartido con el modal de jugar.
- Verificado con smoke E2E real (12 checks): compra de poblado/ciudad, rechazo de altas a mano, edición de fichas, banco que nunca bloquea.

### 4c. Cambios previos (2026-06-11, pedidos por Esteban)
1. **Íconos más grandes**: +30–40% en mano, descarte, pickers, trades, recetas y tabla de construcción.
2. **Recetas ocultables**: toggle "Ocultar recetas" en las acciones de construcción (preferencia por dispositivo, `ui.collapse.buildRecipes`).
3. **Arte propio de cartas de desarrollo** integrado en `DevCardGlyph` (medallones a 160px en `assets/icons/`).
4. **Preview de carta de desarrollo**: tocar una carta abre su preview (arte grande + descripción canónica `DEV_CARD_DESCRIPTIONS`) y desde ahí se confirma "Jugar carta".
5. **VP cards diferidas** (`hiddenVP` → `vpCards`): comprar/recibir una carta de Punto de victoria NO suma al marcador; "usarla" (`dev:play vp`, permitido en roll/main, incluso comprada ese turno) suma +1 público para todos. El marcador es 100% público (ya no hay reveal del ganador); para declarar victoria hay que usar las cartas primero. Verificado con smoke E2E (8 checks).

### 5. Verificación manual E2E (con backend + Mongo levantados)
- Flujo invitado completo (≤15s a lobby), login/registro reales, 503 con Mongo caído.
- Registro inicial con 3–4 dispositivos: autosave, reconexión a mitad, N/M listos, game:start bloqueado.
- Entregar carta: normal, con banco en 0 (force), notice visible con modal de descarte abierto en otro device.
- Persistencia de colapsables tras recarga; cerrar sesión no saca de la partida; dos pestañas (evento storage).

### 6. Cierre
- Commit (rama o main según convenga): client delta Fase 3 + fixes pre-existentes de tsc (`SpecialBuildBanner.tsx` prop `pulse`, `YearOfPlentyPickerModal.tsx` narrowing de `bank`).
- Actualizar README si aplica (variables, flujo de auth).
