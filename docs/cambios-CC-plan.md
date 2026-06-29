# cambios-CC-plan.md — Plan de la tanda de bugs de Caballeros y Ciudades (junio 2026)

> Plan de implementación de los cambios pedidos en `cambios.txt` (tanda de
> **Caballeros y Ciudades**). El archivo de **solicitudes** (`cambios.txt`) se
> conserva intacto como fuente; este documento es la **planeación** (la convención
> del proyecto es `docs/<nombre>-plan.md`, igual que `docs/cambios-plan.md` y
> `docs/logrosandxp.md`).
>
> **Prioridad: bugs primero** (instrucción del usuario). Las 8 entradas de
> `cambios.txt` son bugs de la expansión C&K. Se entregan en unidades verificables;
> cada unidad: backend (orquestador) → frontend (agentes) → build/tests → commit en
> la rama `Fix]caballeros-Ciudades`.
>
> **Convención de equipo** (context.md §10): el **backend** (reglas/handlers/state)
> lo implementa el **orquestador** (Claude principal). Los **agentes son frontend**
> y consumen el contrato Socket.IO. Por eso cada bug se hace en orden
> *backend → contrato → frontend*.
>
> **Íconos**: para cualquier ícono nuevo se **recicla** uno existente y se escribe
> la descripción del arte definitivo en `missing-icons.md` (si ya existe, se ignora).

---

## Resumen de las 8 entradas (todas son bugs)

| # | Bug (cambios.txt) | Capa | Prioridad |
|---|---|---|---|
| 1 | Cartas de progreso sin efecto ("Resolver en el tablero"); limitar conteos; quitar dev cards base | Backend + Frontend | **P0** |
| 3 | Al iniciar no se reparten las **mercancías** de la ciudad inicial | Backend | **P0** |
| 6 | Las mejoras de ciudad **nivel 3** no dan sus beneficios | Backend + Frontend | **P0** |
| 7 | **Comerciante**: falta colocar en ficha (2:1) y dar **+1 PV** | Backend + Frontend | **P1** |
| 4 | No se pueden **intercambiar mercancías entre jugadores** | Backend + Frontend | **P1** |
| 5 | No se cambian **recursos↔mercancías** en banco/puertos | Backend + Frontend | **P1** |
| 2 | Lobby: no se distingue el **poblado** de la **ciudad** inicial | Frontend | **P2** |
| 8 | Tablet/desktop: mover C&K a la **3ª columna** sobre los dados | Frontend | **P2** |

Orden de ejecución (dependencias): #1 → #3 → #6 → #7 → #4/#5 (comparten el motor de
comercio con mercancías) → #2 → #8.

---

## BUG #1 — Cartas de progreso (P0)

**Diagnóstico.** `progress:play` (handlers.ts) solo automatiza 7 cartas
(`printer`, `constitution`, `resourceMonopoly`, `tradeMonopoly`, `engineer`,
`irrigation`, `mining`); el resto cae en "Resuélvanla en la mesa". Los conteos por
mazo (`PROGRESS_DECK_COUNTS` en state.ts) **ya coinciden** con
`docs/Progress-Cards-CC.md` (18+18+18). Las dev cards base **ya** no se compran en
C&K (`build` rechaza `devcard`); falta confirmar que la UI no las exponga.

**Backend (orquestador).** Automatizar todo lo que no dependa de geometría de
tablero:
- `warlord` (Estratega): activa todos tus caballeros gratis.
- `crane` (Grúa): descuento de 1 mercancía en la próxima mejora de ciudad **este turno** (flag `craneDiscountActive` por jugador, scope turno).
- `smith` (Fragua): promueve hasta 2 caballeros gratis (picker; respeta Fortaleza para rango 3, no 2 promociones al mismo caballero).
- `medicine` (Medicina): sube un poblado a ciudad por 2 mineral + 1 trigo (picker de poblado).
- `spy` (Espía): roba 1 carta de progreso a un oponente (picker de oponente; robo de carta concreta o aleatoria).
- `masterMerchant` (Maestro Mercader): roba 2 cartas (recursos/mercancías) a un oponente con **más** PV (picker).
- `merchantFleet` (Flota Mercante): 2:1 de un tipo a tu elección hasta fin de turno (flag `merchantFleetActive`, se integra con el comercio con banco de #4/#5).
- `bishop` (Obispo): mueve el ladrón y roba 1 carta a **cada** jugador con poblado/ciudad en ese hex (reusa el flujo de ladrón con multi-robo).
- `roadBuildingP` (Construcción de carreteras): 2 caminos gratis (crédito `freeRoads` que consume `build('road')`).
- `deserter` (Desertor): un oponente pierde un caballero y tú colocas uno del mismo rango (picker de oponente + caballero).
- `merchant` (Comerciante): ver **BUG #7**.

Se mantienen **"en mesa"** (geometría/elección física multi-jugador) con log/notice:
`alchemist` (se juega antes de tirar; dados manuales), `inventor` (intercambiar
fichas de número), `diplomat` (quitar carretera), `intrigue` (expulsar caballero),
`saboteur` (descarte ajeno), `wedding` (regalo a elección), `commercialHarbor`
(intercambio con cada jugador). El motivo va documentado en el código.

Actualizar `PROGRESS_AUTOMATED` / `PROGRESS_NEEDS_*` (types.ts) y añadir nuevas
listas (`PROGRESS_NEEDS_TARGET`, `PROGRESS_NEEDS_KNIGHTS`, etc.) para que el
frontend sepa qué picker abrir.

**Frontend (agentes).**
- `ux-architect`: brief de los nuevos flujos de juego de carta (pickers de objetivo/caballero/poblado, multi-robo de Obispo, créditos de camino).
- `ui-engineer`: pickers nuevos en `ProgressHand` (target de jugador, caballeros a promover/quitar, poblado para Medicina), badges actualizados (Automática / En mesa), y consumo de `freeRoads` en `ActionGrid`/construcción.
- `ux-writer`: descripciones y mensajes de cada carta (qué automatiza la app vs qué se resuelve en mesa) en `spanish.ts`.
- `qa-auditor`: a11y de los nuevos modales (focus trap, labels), revisión P0–P3.

---

## BUG #3 — Reparto inicial de mercancías (P0)

**Diagnóstico.** En `game:start` (C&K) se sube el 2º poblado a **ciudad** y luego
`applyInitialSetup` reparte 1 recurso por ficha, pero **no** reparte mercancías. La
regla de producción ya da, para una ciudad sobre ore/lumber/wool, 1 recurso + 1
mercancía; el reparto inicial debe ser coherente.

**Backend (orquestador).** `applyInitialSetup` recibe `citiesKnights` y devuelve
`commodityGrants[playerId]`: por cada ficha de una **ciudad** sobre
ore→coin / lumber→paper / wool→cloth, +1 mercancía (los recursos quedan igual). En
`game:start` aplicar a `player.commodities` y registrar en el log. Tests en
`setup.test.ts`.

**Frontend.** Sin cambios (HandView ya muestra mercancías). `qa-auditor` verifica el
log inicial.

---

## BUG #6 — Habilidades de mejora de ciudad nivel 3 (P0)

**Diagnóstico.** `upgradeCityImprovement` marca `abilityUnlocked` al nivel 3 pero los
beneficios no se aplican (docs/cities_updates.md):
- **Guilda (trade ≥3)**: cambiar 2 mercancías (mismo tipo) 2:1 por 1 recurso o 1 mercancía distinta. → se integra con el comercio con banco (#5).
- **Fortaleza (politics ≥3)**: promover caballeros fuertes (2) a poderosos (3). → **ya implementado** en `knight:promote` (verificar y mantener).
- **Acueducto (science ≥3)**: si al tirar producción no recibes nada, tomas 1 recurso del banco a tu elección. Excepción del 7: igual recibes 1 recurso.

**Backend (orquestador).**
- Acueducto: tras `distributeForRoll`, los jugadores con science ≥3 que no recibieron recursos quedan con un pendiente `pendingAqueductPick[playerId]`; al resolver eligen 1 recurso del banco (nuevo evento `aqueduct:pick`). En el 7 también aplica.
- Guilda: el comercio con banco usa proporción 2:1 para **mercancías** si el jugador tiene trade ≥3 (ver #5).

**Frontend (agentes).**
- `ux-architect`: brief del flujo Acueducto (elegir recurso cuando no produces) y de cómo se comunica Guilda en el comercio.
- `ui-engineer`: modal/CTA de Acueducto (elegir 1 recurso), indicador de habilidad activa en `CityCalendarPanel`, y la proporción 2:1 de mercancías en el comercio (junto con #5).
- `ux-writer`: textos de habilidades activas y del prompt de Acueducto.
- `qa-auditor`: a11y del nuevo modal; responsive.

---

## BUG #7 — Comerciante (P1)

**Diagnóstico.** La carta `merchant` cae en "registro en mesa". Falta: colocar el
comerciante sobre una ficha de recurso adyacente a una construcción propia,
intercambiar 2:1 ese recurso mientras lo controles, y **+1 PV** al dueño. Al jugar
otra carta `merchant`, el comerciante (ventaja + PV) pasa al nuevo dueño.

**Backend (orquestador).**
- Estado nuevo en `GameState`: `merchant: { ownerId, resource } | null`.
- `progress:play merchant` con `{ resource }`: fija el dueño y el recurso, retira el PV al dueño anterior y lo da al nuevo, log/notice. Sin geometría: la ficha se elige por **recurso** (decisión §13, igual que el resto de C&K).
- `publicVictoryPoints`: +1 PV si `merchant.ownerId === p.id`.
- Comercio con banco: si controlas el comerciante y das su `resource`, proporción **2:1**.
- Vista: exponer `merchant` en `views.ts` / `types.ts`.

**Frontend (agentes).**
- `ux-architect`: brief del flujo de colocación (elegir recurso) y de la insignia del comerciante (quién lo tiene, +1 PV).
- `ui-engineer`: picker de recurso al jugar Mercader, indicador del dueño actual (marcador/`PublicPlayersPanel`), y la proporción 2:1 del comerciante en `TradeModal`/`BankPanel`.
- `visual-designer`: ícono del comerciante (reciclar `monopolio.png`/`obeja.png`; describir arte en `missing-icons.md`).
- `motion-engineer`: micro-feedback al ganar el comerciante / el +1 PV.
- `ux-writer`: copy de la insignia y del picker.
- `qa-auditor`: revisión final.

---

## BUG #4 y #5 — Comercio de mercancías (P1)

**Diagnóstico.** `TradeOffer` y `trade:bank` solo manejan `Hand` (recursos). No hay
forma de intercambiar mercancías entre jugadores ni recurso↔mercancía con el banco.

**Backend (orquestador) — motor común.**
- `TradeOffer.give/receive` pasan a `{ resources?: Partial<Hand>; commodities?: Partial<CommodityHand> }`. `validateTradeOffer`/`executeTrade` mueven ambos. (Decisión de mesa: las **cartas de progreso** siguen sin comerciarse.)
- `trade:bank` acepta dar/recibir recurso **o** mercancía. Proporción: 4:1 normal (3:1/2:1 con puerto de recurso); 2:1 de mercancía si el jugador tiene **Guilda** (trade ≥3); 2:1 del recurso del **comerciante** (#7); flag `merchantFleetActive` (#1) → 2:1 de un tipo. Banco de mercancías (`commodityBank`) se ajusta (ilimitado informativo).
- `bestBankRatio` se generaliza a recursos+mercancías con esos modificadores.

**Frontend (agentes).**
- `ux-architect`: brief de cómo mostrar mercancías junto a recursos en `TradeModal` (tabs Banco / Jugadores) y `BankPanel` sin saturar; estados de proporción (Guilda/comerciante/flota).
- `ui-engineer`: `TradeModal` y `BankPanel` con selección de mercancías + recursos; steppers de mercancías en el tab Jugadores; etiquetas de proporción.
- `ux-writer`: labels/tooltips (mercancías, proporciones especiales).
- `visual-designer`: que los íconos de mercancía (moneda/papel/tela) convivan con los de recurso sin confundir.
- `qa-auditor`: a11y/responsive del modal ampliado.

---

## BUG #2 — Lobby: poblado vs ciudad inicial (P2, frontend)

**Diagnóstico.** `InitialBuildSetup` siempre rotula "Poblado 1" y "Poblado 2", pero
en C&K la 2ª colocación es una **ciudad** (la app sube `buildings[1]` a ciudad al
iniciar). No se distingue cuál es cuál.

**Frontend (agentes).**
- `ui-engineer`: cuando `citiesKnights`, la 2ª card se rotula **"Ciudad de salida"** (con su ícono de ciudad), y el encabezado pasa a "Tu poblado y tu ciudad de salida". Fuera de C&K, sin cambios.
- `ux-writer`: copy del encabezado, ayuda y estados ("Te falta: fichas de tu ciudad").
- `visual-designer`: distinción visual (ícono ciudad vs poblado) en las dos cards.
- `qa-auditor`: revisión.

---

## BUG #8 — Layout: C&K en la tercera columna (P2, frontend)

**Diagnóstico.** En `GameScreen` los paneles C&K (Calendario de la ciudad, Defensa =
Muros+Caballeros, Cartas de progreso) viven en la **2ª columna** (banco/construcción).
El usuario los quiere en la **3ª columna, arriba de las estadísticas de dados**, para
hacer todas las acciones de un vistazo sin scroll en tablet/desktop.

**Frontend (agentes).**
- `ux-architect`: brief del reacomodo de columnas en md (2 col) y lg (3 col): C&K de acción cerca del marcador/dados; mantener banco+construcción en su columna.
- `ui-engineer`: mover `CityCalendarPanel`, `Defensa` y `ProgressHand` a la 3ª columna (lg) / columna del marcador (md), **arriba** de `DiceStatsCollapsible`. Conservar el flujo móvil en una sola columna.
- `qa-auditor` (`/adapt`): verificar breakpoints sm/md/lg/xl, sin overflow, touch targets; reporte P0–P3.
- `visual-designer`: ritmo/jerarquía de la nueva columna.

---

## Verificación y cierre

- **Backend**: `cd server && npx tsc --noEmit` + `npm test` (mantener verde; añadir tests de setup/rules para #1, #3, #6, #7).
- **Frontend**: `cd client && npm run build`.
- **Por bug**: commit en `Fix]caballeros-Ciudades` al verificar.
- **Cierre**: descripciones de íconos nuevos en `missing-icons.md`, actualización final de `context.md`, commit.

---

## Mapa de archivos por capa

**Backend (orquestador):** `server/src/game/state.ts` (merchant, flags, tipos de
trade), `server/src/game/rules.ts` (trade con mercancías, ratios, acueducto,
distribución), `server/src/game/setup.ts` (mercancías iniciales), `server/src/socket/handlers.ts`
(progress:play, city:upgrade, merchant, trade, aqueduct:pick, free roads),
`server/src/socket/views.ts` (merchant + flags públicos), tests.

**Frontend (agentes):** `client/src/types.ts` (espejo de contrato), `client/src/store.ts`
(emits nuevos), `client/src/lib/spanish.ts` (copy), `client/src/components/`
(`ProgressHand`, `TradeModal`, `BankPanel`, `InitialBuildSetup`, `CityCalendarPanel`,
`KnightsPanel`, pickers nuevos), `client/src/screens/GameScreen.tsx` (layout),
`client/src/assets/icons.tsx` (íconos), `missing-icons.md`.
