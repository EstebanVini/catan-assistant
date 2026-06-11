# Fase 3 — Tareas pendientes (retomar aquí)

Estado al pausar (2026-06-10): **delta del cliente de Fase 3 implementado y `cd client && npm run build` en verde** (tsc + vite). Pase de copy del ux-writer aplicado. Nada commiteado todavía.

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

## Pendiente (en orden recomendado)

### 1. qa-auditor (siguiente paso inmediato)
- Contraste WCAG AA de superficies nuevas: NoticeBanner ámbar (`bg-amber-500` + texto `neutral-950`), estados emerald/ámbar de InitialBuildSetup y GiveCardModal.
- Touch targets ≥44px en 360–414px: links inline ("cambiar", "inicia sesión"), botón × de chips de ficha, toggle de contraseña.
- A11y de sheets/modales nuevos: SpotPickerSheet, GiveCardModal, AccountMenu (focus trap, ESC, aria).
- Revisar solape toasts (z-100) sobre NoticeBanner (z-95) en la franja superior.

### 2. visual-designer — punto 6 del brief (`docs/ux-brief-phase3-delta.md` §6)
- Tokens CSS centralizados (océano, superficies, recursos, jugadores, dorado reservado).
- Decisión global oscuro (madera/noche, recomendado) vs claro (pergamino).
- Módulo único `client/src/assets/icons.tsx` (extiende ResourceIcon/BadgeIcon + 5 dev cards + ladrón, con fallback).
- Tipografía display solo en: título app, código de sala, GANADOR, encabezados.
- Tabla de verificación de contraste para el qa-auditor. Cero regresión de layout.

### 3. motion-engineer
- Transición login ↔ registro: slide horizontal 200ms (hoy es fade simple).
- Tick animado del check de registro completo (hoy `anim-scale-in` genérico).
- Olas/parallax discreto del océano (tras el tema), respetando `prefers-reduced-motion`.

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
