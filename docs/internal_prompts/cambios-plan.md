# cambios-plan.md — Plan de implementación de `cambios.txt` (junio 2026)

> Fuente: `cambios.txt` (solicitud del usuario) + `logros.txt`. Este documento traduce
> esa solicitud en tareas concretas, asigna cada una al agente adecuado (ver §10 de
> `context.md`) y define el orden de ejecución. **Prioridad: corrección de reglas/datos
> antes que features cosméticas.** El backend (Node/Socket.IO/reglas) lo implementa el
> orquestador; los agentes hacen frontend sobre el contrato Socket.IO / REST.

## Resumen de cambios solicitados

| # | Cambio | Tipo | Prioridad |
|---|--------|------|-----------|
| A | Ajustar XP: `Desarrollado` 15→40, `Victoria demoledora` 25→40 | Datos/corrección | **Alta** |
| B | Mover el ladrón a una **ficha vacía** (independiente del desierto); solo da carta si la regla `robberEmptyGivesResource` está activa | Regla/lógica | **Alta** |
| C | Toggle para **ocultar tus recursos** | Feature UI | Media |
| D | Toggle para **ver/ocultar las cartas de desarrollo** de tu mano | Feature UI | Media |

Orden de ejecución: **A → B → (C+D juntos)** — corrección de datos y de reglas primero,
features de privacidad de la mano al final. Cada cambio: implementar → verificar (build/tests)
→ **commit en `main`**. Al terminar todo: actualizar `context.md`.

---

## Cambio A — Ajuste de XP de logros (orquestador)

**Qué:** subir el XP de dos logros existentes.
- `developed` (Desarrollado): `15 → 40`.
- `demolisher` (Victoria demoledora): `25 → 40`.

**Archivos:**
- `server/src/game/achievements.ts` — catálogo `ACHIEVEMENTS` (fuente de verdad).
- `client/src/lib/achievements.ts` — espejo del catálogo.
- `logros.txt` — documentación de referencia (`Desarrollado: ... 40XP`, `Victoria demoledora: ... 40XP`).

**Riesgo de tests:** ninguno. `achievements.test.ts` solo verifica **pertenencia** de
`developed`/`demolisher` en `satisfiedAchievements`, no su XP; el test de `xpForGame` usa
`halfway` (25 XP, sin cambios). Verificado antes de implementar.

**Responsable:** **Orquestador** (dato correctivo crítico, fuente + espejo).
**Verificación:** `cd server && npm test` (63 verdes) + `cd client && npm run build`.
**Commit:** `fix(logros): sube XP de Desarrollado (40) y Victoria demoledora (40)`.

---

## Cambio B — Mover el ladrón a una "ficha vacía" (independiente del desierto)

**Problema actual:** el único destino "vacío" del ladrón es el hex del **desierto** que aparece
en `RobberHexList` (etiquetado "ficha vacía (desierto)"). No existe una opción genérica para
"parquear" el ladrón en una ficha que no le produce a nadie y que sea **distinta del desierto**.
La regla extra `robberEmptyGivesResource` (banco da 1 recurso al mover a ficha vacía) solo se
dispara hoy sobre el desierto o sobre un hex sin víctimas.

**Solución:** añadir una acción explícita **"Mover a ficha vacía"**, separada del desierto.
Al usarla: el ladrón no queda sobre ningún hex modelado (no bloquea producción de nadie), no
hay robo, y **solo si `robberEmptyGivesResource` está activa** el banco entrega 1 recurso al azar.

### B.1 Backend (orquestador)
- `server/src/game/state.ts`: nuevo campo `GameState.robberOnEmpty: boolean` (ladrón sobre una
  ficha vacía no modelada). Inicializa `false`.
- `server/src/game/rooms.ts`: `robberOnEmpty: false` en `createRoom` y en el clon de snapshot.
- `server/src/socket/views.ts`: exponer `robberOnEmpty` en la vista pública.
- `server/src/socket/handlers.ts`:
  - Nuevo handler `robber:moveEmpty`: guard (activo + `phase==='robber'` + `pendingRobberMove`),
    `pushSnapshot`, limpia `robber` de todos los hexes, `robberOnEmpty=true`,
    `pendingRobberMove=false`; log + `notice`; si `extraRules.robberEmptyGivesResource` → `drainBank`
    + 1 recurso al jugador + notice; **sin robo**, `phase='main'`; `broadcastState`.
  - En `robber:move` (hex real): poner `state.robberOnEmpty = false`.

### B.2 Contrato cliente (orquestador)
- `client/src/types.ts`: añadir `robberOnEmpty: boolean` al estado público.
- `client/src/store.ts`: acción `moveRobberEmpty: () => socket.emit('robber:moveEmpty')` (+ interfaz).

### B.3 Frontend UI (ui-engineer)
- `client/src/components/ConstructionTable.tsx` → `RobberHexList`:
  - Añadir un botón/acción destacada **"Mover a ficha vacía"** (con su copy de ux-writer),
    separado de la lista de hexes, visible durante la fase del ladrón.
  - Renombrar la etiqueta del hex desierto de `"ficha vacía (desierto)"` a **`"desierto"`**
    (ahora "ficha vacía" es la opción genérica nueva).
  - Reflejar el estado "ladrón en ficha vacía" en la etiqueta superior (`robberLabel`) cuando
    `robberOnEmpty` y ningún hex tiene el ladrón.
  - Cablear a `store.moveRobberEmpty()`.

### B.4 Copy (ux-writer)
- Texto del botón ("Mover a ficha vacía"), microcopy que aclare que **solo da carta si la regla
  está activa**, etiqueta de estado ("ladrón en ficha vacía") y el `notice` del servidor.

**Verificación:** `cd server && npm run build && npm test`; `cd client && npm run build`.
Repaso manual del flujo del 7 → mover a ficha vacía (con y sin la regla).
**Commit:** `feat(robber): mover el ladrón a una ficha vacía (carta solo si la regla extra está activa)`.

---

## Cambios C + D — Toggles de privacidad de la mano (ocultar recursos / cartas de desarrollo)

**Qué:** dos toggles **locales** (solo afectan la pantalla del dueño, no el estado compartido)
en `HandView`:
- **C:** ocultar/mostrar tus **recursos** (privacidad cuando alguien mira tu celular).
- **D:** ocultar/mostrar tus **cartas de desarrollo**.
Persistir la preferencia por dispositivo (localStorage, patrón de `lib/persistence.ts`).

### Diseño (ux-architect) — brief breve
- Afordancia clara tipo ojo (mostrar) / ojo tachado (ocultar) por sección.
- Estado oculto: enmascara los conteos por recurso/carta (placeholder); decidir si el **Total**
  permanece visible (recomendado: el dueño puede ver su total, se ocultan los desgloses).
- Casos extremos: mano vacía, C&K (mercancías), reduced-motion, accesibilidad del botón.

### Copy (ux-writer)
- Labels y `aria-label`: "Ocultar recursos"/"Mostrar recursos", "Ocultar cartas de desarrollo"/
  "Mostrar cartas de desarrollo". Texto del placeholder oculto.

### Implementación (ui-engineer)
- `client/src/components/HandView.tsx`: botones toggle en el encabezado de la sección de recursos
  y de la sección de cartas de desarrollo; estado enmascarado; persistencia.
- `client/src/lib/persistence.ts`: helper genérico de preferencia booleana de UI (o reutilizar el
  patrón de `getCollapsePref`/`setCollapsePref`).

### Visual (visual-designer)
- Tratamiento del ícono ojo y del estado enmascarado (placeholder con textura/blur sutil acorde
  al tema Catán, contraste WCAG AA).

### Movimiento (motion-engineer)
- Transición de revelar/ocultar (fade/scale con `transform`/`opacity`), respetando
  `prefers-reduced-motion`.

### Auditoría (qa-auditor)
- Audita TODO el frontend de B+C+D: a11y (labels, focus, contraste), touch targets ≥44px,
  responsive. Reporte P0–P3 y corrige P0/P1.

**Verificación:** `cd client && npm run build`.
**Commit:** `feat(mano): toggles para ocultar recursos y cartas de desarrollo`.

---

## Asignación por agente (resumen)

| Agente | Tareas |
|--------|--------|
| **Orquestador** | Todo el backend (A: XP fuente; B: state/rooms/views/handlers) + contrato cliente (types, store) + espejos de datos (A: client mirror, logros.txt) + verificación/commits + `context.md`. |
| **ux-architect** | Brief breve de los toggles de privacidad (C+D). |
| **ux-writer** | Copy de B (botón "ficha vacía", microcopy, notices) y de C+D (labels/aria de los toggles). |
| **ui-engineer** | UI de B (`ConstructionTable`/`RobberHexList`) y de C+D (`HandView` + `persistence`). |
| **visual-designer** | Tratamiento visual del ícono ojo y estado enmascarado (C+D). |
| **motion-engineer** | Animación de revelar/ocultar de los toggles (C+D), reduced-motion. |
| **qa-auditor** | Auditoría final a11y/perf/responsive de todo el frontend de B+C+D. |

## Definición de "hecho" por cambio
1. Implementado (orquestador + agente(s)). 2. `npm run build` (server y/o client) y `npm test`
(server) en verde. 3. Repaso manual del flujo afectado. 4. **Commit en `main`**. Al final de
todo: `context.md` actualizado y commit.
