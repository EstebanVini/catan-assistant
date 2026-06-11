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

### 4. Desviaciones conocidas / deuda a resolver (requieren decisión o cambio de server)
- **Vaciar una card tras completar no baja el contador del host**: el server exige 1–3 spots, así que el cliente no emite estados con card vacía (brief §3 esperaba que el check se retirara). Opciones: server acepta payload "incompleto" marcando setupComplete=false, o se documenta como comportamiento final.
- **Toast personal "Recibiste 1 trigo del banco." omitido**: requiere evento dirigido del server al receptor (hoy: pulso de mano + notice público).
- **GiveCard sin ack**: éxito optimista a 900ms; ideal: ack en `admin:giveCard` para estados exactos (submitting→success/error).
- **Conteo del mazo de desarrollo no visible** en GiveCardModal (el estado público no expone devDeckCount; el brief mostraba "Mazo: 18 cartas").
- **Poblado con 0 fichas (desierto costero)**: relajación futura documentada en brief §3 caso 3.
- **Avatar en lista del lobby** usa `p.name` como seed (el username no es público); aceptable, revisar si el server expone username.

### 5. Verificación manual E2E (con backend + Mongo levantados)
- Flujo invitado completo (≤15s a lobby), login/registro reales, 503 con Mongo caído.
- Registro inicial con 3–4 dispositivos: autosave, reconexión a mitad, N/M listos, game:start bloqueado.
- Entregar carta: normal, con banco en 0 (force), notice visible con modal de descarte abierto en otro device.
- Persistencia de colapsables tras recarga; cerrar sesión no saca de la partida; dos pestañas (evento storage).

### 6. Cierre
- Commit (rama o main según convenga): client delta Fase 3 + fixes pre-existentes de tsc (`SpecialBuildBanner.tsx` prop `pulse`, `YearOfPlentyPickerModal.tsx` narrowing de `bank`).
- Actualizar README si aplica (variables, flujo de auth).
