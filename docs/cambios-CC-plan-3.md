# cambios-CC-plan-3.md — 3ª tanda de bugs C&K (julio 2026)

> Plan de implementación de la tanda de `cambios.txt` (3ª iteración de Caballeros
> y Ciudades). `cambios.txt` se conserva como **fuente de solicitudes**; este es el
> documento de **planeación** (convención `docs/<nombre>-plan.md`). **Rama de
> trabajo: `main`** (la rama `Fix]caballeros-Ciudades` ya se fusionó en PR #6).
> Commit por cambio verificado. **Prioridad: bugs.**
>
> **Íconos:** esta tanda **no requiere íconos nuevos** (son cambios de layout,
> texto y lógica). `missing-icons.md` queda igual; la regla de reciclar/describir
> sigue vigente para futuros íconos.

## Diagnóstico previo (lectura del código actual)

- **B3 (Acueducto en 7):** el **backend es correcto** — tras `turn:rollCK`, en un 7
  `receivedAny` queda vacío, así que TODOS los de Ciencia ≥3 entran a
  `pendingAqueductPick`. El bug es de **alcance del modal**: `AqueductPickModal` usa
  `z-50`, pero el flujo del ladrón (robo) usa `z-[60]`, así que en la secuencia del 7
  (descartar → mover ladrón → robar) el modal del acueducto queda **tapado** y el
  jugador no lo resuelve. Fix: subir su `z-index` por encima del flujo del 7 + test
  del backend.
- **B4 (mercancía→recurso con banco/puerto):** la **UI y el servidor ya lo soportan**
  (`TradeModal` muestra la fila de mercancías en Doy/Recibo; `tradeWithBankCK` ejecuta
  recurso↔mercancía). Ratio: 4:1 normal, 3:1 con puerto genérico, 2:1 con Guilda
  (Comercio 3). Acción: **verificar end-to-end** (test del ratio 4:1 sin Guilda) y
  mejorar descubribilidad; reportar al usuario (probablemente percibido como "no se
  puede" por el 4:1 por defecto, que es la regla oficial).

---

## Bugs (prioridad)

### B3 — Acueducto en el 7 (P0)
- **Backend (orquestador):** extraer la elegibilidad del acueducto a un helper puro
  (`aqueductBeneficiaries`) y testearlo (incluye el caso del 7 = nadie recibió).
- **Frontend (ui-engineer):** subir `AqueductPickModal` a `z-[70]` (sobre el robo
  `z-[60]`) para que sea lo primero que se resuelve en un 7. Verifica que sigue
  apareciendo en producción normal.

### B4 — Comercio mercancía↔recurso (P0)
- **Backend (orquestador):** test de `tradeWithBankCK` para commodity→resource a 4:1
  (sin Guilda) y resource→commodity. (Confirmar que el contrato funciona.)
- **Frontend (ui-engineer):** revisar el tab Banco de `TradeModal` end-to-end; si el
  ratio 4:1 confunde, reforzar el copy de la proporción. (No cambiar la regla oficial
  sin confirmación del usuario.)

### B2 — Calendario de ciudad: textos del contador (P1)
- **Frontend (ui-engineer):** en `CityCalendarPanel`, **eliminar** los labels
  "Habilidad" y "Arrebatar" del contador de niveles; dejar **solo "Metrópolis"**,
  **alineada bajo el nivel 4** (hoy la fila de 3 spans bajo una escala de 5 pasos
  desalinea "Metrópolis" hacia el nivel 3). La metrópolis se desbloquea en nivel 4.

### B6 — Reciclar cartas de progreso (P1)
- **Backend (orquestador):** pila de descarte por disciplina (`progressDiscards`).
  Las cartas que **salen de la mano** (jugadas no-VP y descartadas por exceder el
  límite) van a la pila; al robar con el mazo vacío, se **rebaraja** la pila dentro
  del mazo. Las cartas de PV (printer/constitution) quedan como PV permanente (no se
  reciclan). Helper `drawProgressCard` + test. Aplica en `turn:rollCK` y en el
  empate bárbaro.

### B1 — Layout v3 (P1)
- **Frontend (ui-engineer):** en `GameScreen`, md/lg:
  - 3ª columna (marcador): **Defensa primero, luego Calendario de ciudad**, **arriba**
    del `PublicPlayersPanel` (las "estadísticas de los jugadores").
  - 2ª columna (banco/construcción): **Cartas de progreso arriba de
    `ConstructionTable`**.
  - Móvil: una sola columna, orden coherente.

### B5 — Lobby: toggle a reglas extra (P2)
- **Frontend (ui-engineer) + ux-writer:** mover el toggle "Repartir recursos de
  inicio" a la sección de **Reglas extra**, invertirlo a **"No repartir recursos de
  inicio"** (checked = no repartir), **default desactivado** (= se reparten por
  defecto, `seedInitialResources` sigue `true`). Sin cambio de backend (se reutiliza
  `setSeedResources` con semántica invertida en la UI).

---

## Regla extra

### F1 — Cartas de progreso ilimitadas
- **Backend (orquestador):** `ExtraRules.unlimitedProgressCards` (default false). Con
  ella activa, **no se aplica el límite de 4** (no se fija `pendingProgressDiscard`
  en `turn:rollCK`, ni al robar con Espía, ni en el empate bárbaro). Exponer en el
  contrato.
- **Frontend (ui-engineer) + ux-writer:** toggle en el lobby (junto a las otras
  reglas extra); `ProgressHand` no muestra el aviso de excedente cuando está activa.

---

## Reparto por agente

- **ui-engineer:** B3 (z-index), B2 (textos del calendario), B1 (layout), B5 (UI del
  lobby), F1 (toggle lobby + `ProgressHand`), B4 (verificación de la UI de comercio).
- **ux-writer:** copy de B5 ("No repartir recursos de inicio" + ayuda) y de F1
  ("Cartas de progreso ilimitadas" + descripción).
- **qa-auditor:** auditoría final (a11y/responsive/contraste) de los cambios de UI.
- **Orquestador (backend):** B3 helper+test, B4 test, B6 (reciclaje), F1 (lógica de
  regla extra), contrato (`views.ts`/`types.ts`/`store.ts`).
- **visual-designer / motion-engineer / ux-architect:** sin tareas esta tanda (no hay
  íconos nuevos, ni animaciones nuevas, ni un feature de UX que requiera brief; los
  cambios son layout/texto/lógica acotados). La regla de íconos sigue vigente para el
  futuro.

## Verificación
- Servidor: `npx tsc --noEmit` + `npm test` (añadir tests de B3, B4, B6, F1).
- Cliente: `npm run build`.
- Commit por bug en `main`; al cerrar, actualizar `context.md`.
