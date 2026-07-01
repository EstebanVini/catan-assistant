# cambios-CC-plan-5.md — 5ª tanda de bugs de Caballeros y Ciudades

> Plan de la tanda de `cambios.txt` (julio 2026). Cubre **solo** la expansión
> Caballeros y Ciudades. Rama de trabajo: **`main`** (commit por cambio
> verificado, según instrucción del usuario). Referencia de reglas: el texto
> oficial de las 54 cartas de progreso está en `docs/Progress-Cards-CC.md`
> (extraído del PDF de reglas subido por el usuario).

## Contexto y convención

- **Backend** (Node/Express/Socket.IO/reglas + mirrors de contrato en
  `client/src/types.ts` y `client/src/lib/spanish.ts`): lo implementa el
  **orquestador** (Claude principal).
- **Frontend** (componentes React/TS, arte, copy visible, a11y): lo implementan
  los **agentes** del proyecto con tareas específicas (ver §"Tareas por agente").
- Verificación por cambio: `cd server && npm run build && npm test` +
  `cd client && npm run build`. Commit a `main` solo cuando el cambio compila,
  pasa tests y se confirma correcto.

## Filosofía de automatización de cartas de progreso

`cambios.txt` pide integrar **todas** las cartas "que se resuelven en mesa" para
que se resuelvan en automático. Tras revisar las 8 que hoy caen al "registro
asistido" (`alchemist, inventor, diplomat, intrigue, saboteur, wedding,
commercialHarbor, bishop`), se dividen así:

**Automatizables ahora** (sin geometría de tablero; la "elección" ajena se
aproxima al azar, igual que el patrón ya existente de Maestro Mercader/Monopolio):
- `saboteur` (Saboteador), `wedding` (Boda), `commercialHarbor` (Puerto de
  mercancías), `bishop` (Obispo).

**Se quedan "en mesa"** (requieren geometría física de tablero que el asistente
no modela, o dependen de la tirada manual):
- `alchemist` (Alquimista): se juega **antes de tirar** y fija los dados, que el
  encargado del banco ya ingresa a mano → sin efecto automatizable.
- `inventor` (Inventor): intercambia dos fichas de número en el tablero físico.
- `diplomat` (Diplomático): quita el tramo final de una carretera (geometría de
  caminos, no modelada).
- `intrigue` (Intriga): expulsa un caballero de una encrucijada (geometría).

Resultado: `PROGRESS_TABLE_RESOLVED` queda en **4** cartas
(`alchemist, inventor, diplomat, intrigue`), con copy "en mesa" que explica el
porqué.

---

## Cambios (uno por bug de `cambios.txt`)

### B1 — Ícono de Ciencia desproporcionado *(frontend — visual-designer)*
- **Síntoma:** el medallón de Ciencia (`client/src/assets/icons/ciencia.png`) se
  ve más pequeño que Comercio/Política "en todos lados".
- **Diagnóstico:** los tres PNG son 256×256 y sus medallones llenan ~96% del
  lienzo por igual; lo que se lee "pequeño" es el **símbolo interior** (el compás
  verde) dibujado más chico/fino que la balanza (Comercio) y el sello (Política).
- **Fix:** reescalar el símbolo interior de `ciencia.png` para igualar el peso
  visual de los otros dos medallones (mantener el marco de cobre y el fondo de
  madera; ampliar el compás centrado). Verificar a tamaños reales (18–28 px) en
  `DisciplineGlyph`, `CityCalendarPanel` y `ProgressHand`. No tocar `icons.tsx`
  salvo que se prefiera un ajuste de render (evitar escalar el `<img>` completo,
  que agrandaría también el marco).
- **Aceptación:** las tres disciplinas se leen del mismo tamaño lado a lado.

### B2 — Grúa: el calendario no refleja el descuento ni habilita "Mejorar" *(frontend — ui-engineer + ux-writer)*
- **Síntoma:** al jugar Grúa el backend sí descuenta 1 mercancía (`city:upgrade`
  pasa `craneOn ? 1 : 0` a `upgradeCityImprovement`, que hace
  `Math.max(0, cost - discount)`), pero `CityCalendarPanel` sigue mostrando el
  costo lleno y **deshabilita el botón** cuando te falta esa 1 mercancía.
- **Diagnóstico:** el panel calcula `cost = improvementUpgradeCost(nextLevel)` y
  `canAfford = commodityHave >= cost` **sin** mirar `view.me.craneDiscount` (que
  ya viaja en la vista, `views.ts:50/115`, y en `client/src/types.ts:376`).
- **Fix (`CityCalendarPanel.tsx`):**
  - Leer `me.craneDiscount`. Calcular `effectiveCost = Math.max(0, cost - (craneActive ? 1 : 0))`.
  - Usar `effectiveCost` para `canAfford`, el texto del botón, aria-labels y el
    bloque informativo de no-activos.
  - Mostrar un distintivo de descuento cuando la Grúa está activa (p. ej. costo
    original tachado + `−1 Grúa`, o un chip "Grúa"). Copy por **ux-writer**.
  - El descuento aplica a la **próxima** mejora del turno; una vez usada, el
    backend limpia `craneDiscount` y el panel vuelve al costo normal solo.
- **Aceptación:** con Grúa activa el costo mostrado baja 1, el botón "Mejorar" se
  habilita si tienes el costo con descuento, y hay señal visual clara.

### B3 — Obispo (bishop) automático *(backend + frontend)*
- **Regla (`Progress-Cards-CC.md`):** desplaza al ladrón y roba **1 carta**
  (recurso o mercancía) a **cada** jugador con poblado/ciudad en ese hex (máx 1
  por jugador aunque tenga 2 construcciones). Con la regla extra
  `robberEmptyGivesResource`, moverlo al desierto o a ficha vacía da 1 carta del
  banco (paralelo al flujo normal del ladrón).
- **Backend (orquestador):**
  - Nuevo flag `pendingBishop: boolean` en `GameState` (state.ts) + vista
    (`views.ts`) para que el cliente distinga el modo.
  - En `progress:play` caso `'bishop'`: en vez de caer al "else", pasar
    `phase='robber'`, `pendingRobberMove=true`, `pendingBishop=true` (funciona
    aunque `robberActive=false`: el Obispo mueve el ladrón igual). La carta se
    retira/recicla como las demás.
  - En `robber:move` y `robber:moveEmpty`: si `pendingBishop`, resolver en modo
    Obispo → robar 1 carta mixta (`stealRandomMixed(owner, active, 1)`) a **cada**
    dueño ≠ activo del hex (dedupe por jugador); en ficha vacía/desierto aplicar
    `robberEmptyGivesResource`. No fijar `pendingRobberSteal`; terminar en
    `phase='main'`. Limpiar `pendingBishop`.
  - `notice`/`logAction` en español con el detalle del robo múltiple.
  - Tests (`rules`/handlers): roba a todos los dueños; máx 1 por jugador; ficha
    vacía con y sin regla extra.
- **Frontend (ui-engineer + ux-writer):** el selector de ladrón ya aparece con
  `phase==='robber' && pendingRobberMove` (ConstructionTable/`RobberHexList`).
  Añadir un aviso de contexto "Obispo: robarás 1 carta a **cada** jugador de esa
  ficha" (ContextBanner/encabezado del selector). Mover `bishop` de "En mesa" a
  "Automática" (vía `PROGRESS_TABLE_RESOLVED`, lo hace el orquestador) y ajustar
  su descripción (ux-writer).

### B4 — Acueducto no debe activarse con un 7 *(backend)*
- **Regla:** el Acueducto (Ciencia 3) da 1 recurso del banco a quien **no
  produjo** al tirar. Un 7 no es "no producir": bloquea la producción por el
  ladrón; no debe otorgar el recurso del Acueducto.
- **Diagnóstico:** en `turn:rollCK`, tras el bloque del 7, se calcula
  `aqueductBeneficiaries(state.players, receivedAny)` con `receivedAny` vacío →
  hoy **sí** dispara en un 7 (el comentario del código lo admite explícitamente).
- **Fix (`handlers.ts`, orquestador):** envolver el cálculo/asignación de
  `pendingAqueductPick` en `if (production !== 7) { … } else { state.pendingAqueductPick = []; }`.
  Tests: 7 → sin beneficiarios de Acueducto; número que no produce a nadie →
  beneficiarios normales.

### B5 — Tratos vacíos / desiguales no funcionan *(backend investiga → posible frontend)*
- **Síntoma reportado:** con la regla extra activa no deja mandar tratos con un
  lado vacío ("regalar" ni "pedir sin dar").
- **Estado del código:** el toggle `unequalTrades` existe en el lobby
  ("Intercambios desiguales"), y tanto `trade:offer`/`trade:respond` (server)
  como `TradeModal`/`TradeIncomingModal` (client) **ya** contemplan el caso
  desigual. → **Reproducir primero** de punta a punta antes de tocar nada.
- **Plan:** el orquestador reproduce los 4 escenarios (regalar dirigido/abierto,
  pedir sin dar dirigido/abierto) en base y en C&K (incluyendo mercancías). Si
  hay una brecha real (gating, validación, o UX que confunde), corregir el
  archivo puntual; si ya funciona, añadir prueba/confirmación y dejar constancia.
  Si el problema es de **claridad** (el usuario no asocia "Intercambios
  desiguales" con "tratos vacíos"), ux-writer ajusta el rótulo/ayuda del toggle
  y del TradeModal.
- **Aceptación:** con la regla activa se pueden enviar y aceptar ofertas de un
  solo lado; con la regla apagada se bloquean con mensaje claro.

### B6 — Puerto de mercancías (commercialHarbor) automático *(backend + frontend)*
- **Regla:** en tu turno ofreces a **cada** jugador 1 recurso; a cambio, cada uno
  que tenga mercancías te da 1 mercancía (de su elección). Un intercambio por
  jugador; si no tiene mercancías, no hay trato (y no le das el recurso).
- **Decisión de automatización:** resolución automática al estilo asistente —
  para cada oponente con ≥1 mercancía, **si el jugador aún tiene recursos que
  dar**: se le entrega 1 recurso (del jugador) y se toma 1 mercancía al azar del
  oponente. La "elección" de mercancía del oponente y de recurso del jugador se
  aproxima al azar (consistente con Maestro Mercader/Monopolio). Se documenta la
  decisión. Sin picker nuevo.
- **Backend (orquestador):** implementar el efecto en `progress:play`
  (`'commercialHarbor'`), respetando el banco de recursos y el de mercancías.
  Tests: intercambia con quien tiene mercancías; omite a quien no; se detiene si
  el jugador se queda sin recursos.
- **Frontend (ux-writer):** mover a "Automática"; descripción y `notice` claros
  ("intercambiaste recurso↔mercancía con N jugadores").

### B7 — Saboteador (saboteur) automático *(backend + frontend)*
- **Regla:** cada oponente con PV **≥** los tuyos descarta la **mitad** de su
  mano (recursos y/o mercancías), redondeando hacia abajo (9 → descarta 4).
- **Backend (orquestador):** en `progress:play` (`'saboteur'`), para cada
  oponente con `playerVP(state, opp) >= playerVP(state, me)`: descartar al azar
  `Math.floor((handTotal + commodityTotal)/2)` cartas mixtas al banco (helper
  nuevo, p. ej. `discardRandomMixed`). `notice`/log con el detalle. Tests:
  umbral `>=` correcto; conteo `floor`; mezcla recursos+mercancías; no afecta a
  quien tiene menos PV.
- **Frontend (ux-writer):** mover a "Automática"; descripción/aviso claros.

### B8 — Boda (wedding) automática + cierre del "revisa todas" *(backend + frontend)*
- **Regla:** cada oponente con **más** PV que tú te regala 2 cartas (recursos
  y/o mercancías, de su elección; si solo tiene 1, te da 1; si no tiene, nada).
- **Backend (orquestador):** en `progress:play` (`'wedding'`), para cada oponente
  con `playerVP(state, opp) > playerVP(state, me)`: `stealRandomMixed(opp, me, 2)`.
  Tests: umbral `>`; toma hasta 2; respeta manos cortas.
- **Cierre:** actualizar `PROGRESS_TABLE_RESOLVED` (types.ts) a
  `['alchemist','inventor','diplomat','intrigue']` y su copy "en mesa"
  (ux-writer) explicando por qué siguen en mesa (geometría/tirada).

---

## Tareas por agente

- **visual-designer** — B1: reescalar el símbolo interior de `ciencia.png` para
  igualar el peso visual de `comercio.png`/`politica.png`; verificar a 18–28 px.
- **ui-engineer** — B2: descuento de Grúa en `CityCalendarPanel` (costo efectivo,
  `canAfford`, botón, aria) + señal visual. B3: aviso de contexto del Obispo en
  el selector de ladrón. Consumir solo la vista/contrato existentes.
- **ux-writer** — copy en español de: chip/etiqueta de descuento de Grúa (B2);
  aviso del Obispo (B3); descripciones y avisos de las cartas ahora automáticas
  (`bishop`, `commercialHarbor`, `saboteur`, `wedding`) en
  `PROGRESS_CARD_DESCRIPTIONS` (spanish.ts) y sus `notice`; copy "en mesa" de las
  4 que permanecen (alchemist/inventor/diplomat/intrigue) explicando el porqué;
  y, si aplica (B5), aclarar el rótulo del toggle "Intercambios desiguales".
- **qa-auditor** — auditoría final (a11y/responsive) de `CityCalendarPanel`,
  `ProgressHand`, el selector de ladrón (Obispo) y `TradeModal`; verificar los
  4 escenarios de tratos desiguales (B5). Reporta P0–P3.
- **Orquestador (backend)** — B3/B4/B6/B7/B8 en `handlers.ts`/`rules.ts`/
  `state.ts`/`views.ts` + tests; mirrors de contrato en `types.ts`; investigación
  y fix/confirmación de B5; integración de los cambios de los agentes; builds,
  tests y commits por cambio a `main`; y actualización final de `context.md`.

## Orden de ejecución sugerido (commit por cambio verificado)

1. B4 (aislado, backend + test).
2. B7 Saboteador (backend + test) + copy.
3. B8 Boda (backend + test) + `PROGRESS_TABLE_RESOLVED` + copy.
4. B6 Puerto de mercancías (backend + test) + copy.
5. B3 Obispo (backend + test) + aviso de contexto (frontend).
6. B2 Grúa en el calendario (frontend).
7. B1 Ícono de Ciencia (arte).
8. B5 Tratos desiguales (reproducir → fix/confirmar).
9. Auditoría qa-auditor + actualización de `context.md`.
</content>
</invoke>
