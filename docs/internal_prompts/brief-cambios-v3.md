# Brief de UX — Cambios v3

> **Autor:** ux-architect · **Fecha:** 2026-06-14 · **Destinatarios:** `ui-engineer` (implementación), luego `ux-writer` (copy), `visual-designer` (insignia 🔥) y `motion-engineer` (animación de la llama).
>
> Backend YA implementado (orquestador). Este documento define **solo el frontend**: flujos, estados, jerarquía visual y casos límite. No contiene código. UI 100% en español; identificadores en inglés; tema Catán (océano + pergamino/madera, contraste WCAG AA, respeta `prefers-reduced-motion`).

---

## CAMBIO A — Bloquear "Terminar turno" hasta registrar las fichas del poblado construido

### 1. Contexto del usuario y objetivo

- **Quién:** el jugador en turno (fase `main`) o en su turno de Construcción Especial (fase `specialBuild`), justo después de comprar un Poblado en `Construir`.
- **Qué hace antes de llegar aquí:** pulsó `Construir → Poblado`, confirmó el pago. El server creó el poblado con `spots: []` y lo añadió a `me.pendingSettlementRegistration`. El jugador ve un nuevo "Poblado N" en la `ConstructionTable` con "Sin fichas todavía".
- **Objetivo:** que **no termine el turno** sin registrar qué fichas (número 2–12 + recurso) toca el poblado nuevo; de lo contrario pierde producción futura y desincroniza la contabilidad de la mesa.
- **Problema actual:** el botón "Terminar turno" no impide cerrar el turno; el server ahora rechaza `turn:end` / `specialBuild:done`, pero el jugador solo se enteraría por un toast de error reactivo. Queremos que sea **proactivo y guiado**, no por ensayo y error.

### 2. Dato disponible en el cliente

- `view.me.pendingSettlementRegistration: string[]` — ids de `Building` (poblados) construidos este turno aún sin fichas.
- **Acción requerida en `types.ts`:** añadir `pendingSettlementRegistration: string[]` a `MeView` (hoy no existe). El `ui-engineer` debe incluirlo.
- La `ConstructionTable` ya registra fichas vía `player:setBuildings`; el server quita un id de la lista cuando ese poblado pasa a `spots.length > 0`.

### 3. Decisión central: deshabilitar el botón (no solo advertir)

**Recomendación: deshabilitar "Terminar turno" / "Listo, paso" mientras `pendingSettlementRegistration.length > 0`, y mostrar el motivo.** Justificación:

- Es lo más robusto: el server ya rechaza la acción, así que permitir el clic solo produce un error reactivo confuso. Mejor cerrar el camino y señalar la salida.
- Coherente con el patrón existente del proyecto: el botón ya tiene estado deshabilitado (`!inMain`) con `title` de motivo y, en el patrón `DisabledAwareButton`, un toast informativo al tocar el botón deshabilitado. Reusar ese patrón.
- Evita la trampa del "no toca recursos": el server solo libera el pendiente si `spots.length > 0`, así que **un poblado solo de desierto/puerto debe registrarse igual** (ver §6). Deshabilitar + CTA fuerza el camino correcto; "permitir e intentar" dejaría al usuario atascado sin entender por qué.

### 4. Flujo y estados del botón "Terminar turno" / "Listo, paso"

Aplica tanto al botón de fase `main` ("Terminar turno") como al de `specialBuild` ("Listo, paso") en `ActionGrid` — ambos deben respetar el bloqueo.

**Estado bloqueado (hay registro pendiente):**
- Estilo deshabilitado, igual al actual `!inMain`: `cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500`.
- `disabled` real + `aria-disabled`. `title` con el motivo.
- Al tocar el botón deshabilitado: toast informativo (no error) con el motivo y, sobre todo, un atajo: hacer scroll/expandir la `ConstructionTable` y resaltar el poblado pendiente (ver §5). Patrón `onDisabledClick → pushToast('info', …)` ya existe en `ActionGrid`.
- **Texto auxiliar bajo el botón** (siempre visible cuando hay pendiente, sin necesidad de tocar): una línea breve en ámbar tipo aviso, p. ej. "Registra las fichas de tu poblado nuevo para terminar." El conteo importa si hay más de uno: "Te faltan N poblados por registrar." El copy final lo afina `ux-writer`; debe coincidir en intención con el error del server ("Registra las fichas del poblado que construiste antes de terminar el turno.").

**Estado habilitado (lista vacía):** comportamiento actual sin cambios.

**Prioridad con "Declarar victoria":** el CTA "Declarar victoria con N puntos" se mantiene por encima. Nota: declarar victoria por sí mismo no pasa por `turn:end`, pero un poblado recién comprado que da el 10º punto debe registrarse igual para que la contabilidad sea correcta; **no** bloqueamos "Declarar victoria" en este cambio (fuera de alcance del backend descrito), pero el aviso de registro pendiente debe seguir visible.

### 5. Resaltar el poblado pendiente en `ConstructionTable`

El jugador necesita una ruta de un toque desde "no puedo terminar" hasta "registrar las fichas".

- **Auto-revelar:** cuando `pendingSettlementRegistration.length > 0`, la `ConstructionTable` debe ser fácil de encontrar. Usar el mecanismo `forceOpen` ya existente de `CollapsibleSection` (hoy se usa en fase robber) para forzarla abierta mientras haya pendientes, o al menos abrirla al tocar el botón deshabilitado / el aviso. Recomiendo `forceOpen` mientras haya pendiente: es el estado que el jugador DEBE atender antes de seguir.
- **Resaltado del item:** en `BuildingList`, el `<li>` de cada poblado cuyo `id ∈ pendingSettlementRegistration` recibe tratamiento de "acción requerida": borde/acento ámbar (no rojo — no es error destructivo, es una tarea pendiente), distinto del borde neutro `border-white/10` actual. Reusar el lenguaje de "hot" ámbar ya presente (`border-amber-400/80`, `text-amber-*`).
- **Etiqueta de estado:** junto al label "Poblado N", un micro-badge tipo "Pendiente" / "Falta registrar" en ámbar. Debe tener `aria-label` o texto accesible.
- **CTA primario "Registrar fichas":** sustituir o promover el botón "+ Agregar ficha" a un CTA prominente **solo en el poblado pendiente** con el texto "Registrar fichas". Mismo destino: abre el `SpotPickerSheet` (`onAddSpot`). Debe ser claramente el siguiente paso (peso visual de botón sólido ámbar, min-height 44px). Para poblados ya registrados, "+ Agregar ficha" se mantiene como está.
- **El resto de la tabla** (poblados/ciudades sin pendiente) no cambia.

### 6. Caso límite — poblado sin recursos (solo desierto y/o puerto)

Un poblado puede tocar 0 fichas de recurso (solo desierto, o desierto + puerto). El server **solo libera el pendiente si `spots.length > 0`**, por lo que el jugador igual debe dejar registro explícito. Dado que deshabilitamos el botón, hay que ofrecer una forma de "cerrar" ese poblado:

- **Decisión:** el desierto es un spot válido en el modelo (`SpotPickerSheet` ya soporta `existingHexes` con desierto y el `RobberHexList` muestra el desierto como ficha sin número). El jugador debe **registrar el spot de desierto** como una ficha más: abre "Registrar fichas", elige el hex desierto, guarda. Eso deja `spots.length = 1` y libera el pendiente. Esto mantiene la regla del server sin un caso especial.
- **Copy de soporte:** en el `SpotPickerSheet` y/o en el aviso del poblado pendiente, aclarar que si el poblado solo toca desierto/puerto, debe registrar el desierto (o el puerto + desierto) para confirmarlo. `ux-writer` redacta: idea = "¿Tu poblado no toca números? Registra el desierto que sí toca para confirmarlo."
- **No** añadir un botón separado "Sin fichas" que llame a `setBuildings` con `spots: []`: no liberaría el pendiente (el server exige `spots.length > 0`) y sería un callejón sin salida. Registrar el desierto es el único camino consistente con el backend.

### 7. Construcción especial (`specialBuild`)

- Mismo bloqueo aplica al botón "Listo, paso" (`specialBuild:done`): si compraste un poblado en tu turno de construcción especial, debes registrarlo antes de pasar.
- El `SpecialBuildBanner` (subtítulo "Construye o compra…") puede ganar una línea condicional cuando hay pendiente: recordatorio de que debe registrar fichas antes de "Listo, paso". Mantener tono pasivo/neutro del banner; el aviso fuerte vive junto al botón (§4).
- La `ConstructionTable` es accesible durante `specialBuild`, así que el flujo de §5 funciona igual.

### 8. Casos límite adicionales

- **Varios poblados pendientes** (raro pero posible en construcción especial encadenada, o si se construye y se quita): el aviso usa el conteo ("Te faltan N…"); todos los items pendientes se resaltan; el botón sigue bloqueado hasta vaciar la lista.
- **El jugador quita el poblado pendiente** (botón "Quitar" existente): al borrarse el Building, su id desaparece de la lista en el siguiente `state:update`. El botón se rehabilita. Sin tratamiento especial.
- **Reconexión / cambio de turno:** el server limpia la lista al rotar de turno; el cliente solo refleja `me.pendingSettlementRegistration` del último `state:update`. No mantener estado local derivado: leer siempre de la vista.
- **No es mi turno:** no aplica (el botón ya está deshabilitado por `!inMain`). La lista solo llega poblada en mi propia vista.

### 9. Criterios de éxito (Cambio A)

1. Tras comprar un poblado, "Terminar turno"/"Listo, paso" queda visiblemente deshabilitado con motivo claro, sin que el jugador tenga que provocar un error.
2. Existe una ruta de ≤2 toques desde el botón bloqueado hasta el `SpotPickerSheet` del poblado correcto.
3. El poblado pendiente es inconfundible en la tabla (acento ámbar + badge + CTA "Registrar fichas").
4. Un poblado de solo desierto se puede confirmar registrando el desierto; el botón se rehabilita.
5. Lectores de pantalla anuncian el motivo del bloqueo y el estado "pendiente" del poblado.

---

## CAMBIO B — Racha de victorias (win streak) con insignia de fuego

### 1. Contexto del usuario y objetivo

- **Quién:** usuario autenticado viendo su `ProfileScreen` (accesible solo desde Home). Invitados no tienen stats → no aplica.
- **Objetivo:** dar reconocimiento y motivación visible a las victorias consecutivas. Dos piezas:
  1. **Insignia 🔥 arriba a la derecha del bloque de perfil**, con el número de la racha **actual** dentro.
  2. **Campo "Racha más larga"** en el bloque de estadísticas, junto a Partidas / Victorias / Derrotas.
- **Datos:** `user.stats.currentWinStreak` y `user.stats.longestWinStreak` (defaults 0). `toPublicUser` ya los expone.
- **Acción en `types.ts`:** añadir `currentWinStreak: number` y `longestWinStreak: number` a `UserStats`.

### 2. Insignia 🔥 — ubicación y aspecto

- **Ubicación:** esquina superior derecha del `IdentityCard` (la `<section>` con avatar/nombre). Posicionamiento absoluto dentro de la card (`relative` en la section, badge `absolute top-3 right-3` aprox.), de modo que flote sobre el header del perfil sin empujar el avatar centrado.
- **Forma:** cápsula/medallón compacto, lenguaje visual coherente con `BadgeChip` (cápsula `rounded-full`, borde + relieve `shadow-medal`), pero con **acento de llama/dorado** en vez del dorado de medalla puro. El `visual-designer` define el tratamiento exacto: ícono de fuego (preferir un glifo SVG en `assets/icons.tsx` con fallback al emoji 🔥, coherente con el patrón de íconos del proyecto) + el número de la racha.
- **Contenido:** glifo de fuego + número `currentWinStreak`. Ejemplo de lectura: "🔥 3".
- **Tamaño/tap:** decorativo, no interactivo (no es botón). No necesita 44px de target; sí buen contraste y legibilidad del número (usar clase `nums`).
- **Contraste sobre océano:** el fondo de la card es `surface-1` (pergamino/oscuro), no el océano directo; aun así el `visual-designer` debe verificar AA del número y del glifo sobre ese fondo y sobre el acento de llama. Documentar en `contrast-verification.md` si se añade un color nuevo.

### 3. Cuándo mostrar / ocultar la insignia

- **Mostrar solo cuando `currentWinStreak >= 1`.** Una racha de 0 no es logro; mostrar "🔥 0" sería ruido y desmotivador.
- Cuando `currentWinStreak === 0`: no renderizar la insignia (la esquina queda limpia).
- No mostrar para usuarios sin partidas (`gamesPlayed === 0` implica `currentWinStreak === 0`, así que queda cubierto por la regla anterior).

### 4. Campo "Racha más larga" en estadísticas

- **Ubicación:** dentro del `StatsCard`, en el bloque de métricas. Hoy hay un grid de 3 columnas (Partidas / Victorias / Derrotas). Opciones:
  - **Recomendado:** añadir "Racha más larga" como una métrica más. Pasar el grid a 2 filas × 3, o a 4 columnas, evaluando legibilidad en móvil (≤360px). En móvil estrecho, 4 columnas aprieta; preferir **2×2 ó 3+1**: mantener las 3 actuales arriba y "Racha más larga" en una fila propia debajo, o integrarla junto al % de victorias / Puntos VP como línea destacada.
  - Mantener el mismo lenguaje visual de las métricas existentes: número grande (`nums text-count`) + label en `text-[10px] uppercase tracking-wide text-neutral-400`.
- **Acento:** usar un acento de llama/dorado sutil en el número de "Racha más larga" para vincularlo visualmente con la insignia 🔥 (igual que `wins` usa `text-emerald-300`). Decisión final de color: `visual-designer`.
- **Solo lectura**, como el resto de stats. Aparece solo dentro del bloque que ya se oculta cuando `gamesPlayed === 0` (empty state existente). No requiere empty state propio.

### 5. Accesibilidad

- La insignia es informativa: `role="img"` con `aria-label` descriptivo, p. ej. "Racha actual: 3 victorias seguidas." (el emoji/glifo va `aria-hidden`; el significado lo lleva el `aria-label`). Mismo patrón que `BadgeChip`.
- El campo "Racha más larga" debe tener su label textual asociado visualmente (ya lo da el patrón de métrica número+label); para SR el conjunto número+label se lee bien si están en el mismo contenedor.
- Verificar contraste AA del número de la insignia sobre el acento de llama y del acento sobre `surface-1`.
- La micro-animación de la llama (motion-engineer) debe **respetar `prefers-reduced-motion`** (usar `lib/motion.ts`): sin animación → llama estática.

### 6. Estados límite (Cambio B)

- **Racha 0:** insignia oculta. "Racha más larga" puede ser 0 (si nunca ganó) → se muestra "0" dentro del bloque de stats solo si `gamesPlayed > 0`; con 0 partidas el bloque entero es el empty state.
- **Racha 1:** insignia visible "🔥 1". Copy del `aria-label` en singular: "1 victoria seguida" (ux-writer maneja singular/plural).
- **Racha grande (2 dígitos+):** la cápsula debe acomodar números de 2–3 cifras sin romperse (ancho flexible, no círculo fijo). Probar con "🔥 12".
- **`currentWinStreak > longestWinStreak`** no debería ocurrir (el backend hace `longest = max(longest, current)`), pero el frontend no debe asumir lo contrario ni recalcular; solo muestra ambos valores tal cual llegan.
- **Usuarios viejos sin los campos:** el backend usa `$ifNull` → llegan como 0. El frontend debe tolerar `undefined` por robustez (tratar como 0) hasta que todos los registros estén migrados.

### 7. Criterios de éxito (Cambio B)

1. La insignia 🔥 aparece arriba a la derecha del perfil solo con racha ≥ 1, con el número actual legible y accesible.
2. "Racha más larga" es visible y clara en el bloque de estadísticas, sin romper el layout en móvil ≤360px.
3. Contraste AA verificado; animación respeta `prefers-reduced-motion`.
4. Racha 0 → sin insignia; racha de 2–3 dígitos → cápsula intacta.

---

## Handoff — orden de agentes

1. **`ui-engineer`** (recibe este brief primero): implementa A y B.
   - `types.ts`: `MeView.pendingSettlementRegistration`; `UserStats.currentWinStreak` + `longestWinStreak`.
   - A: bloqueo + texto auxiliar en `ActionGrid` (botones "Terminar turno" y "Listo, paso"); resaltado + badge "pendiente" + CTA "Registrar fichas" + `forceOpen` en `ConstructionTable`/`BuildingList`; línea condicional en `SpecialBuildBanner`.
   - B: insignia 🔥 (estructura + posición + a11y) en `IdentityCard`; campo "Racha más larga" en `StatsCard`.
2. **`ux-writer`:** copy del aviso de bloqueo (alineado con el error del server), CTA "Registrar fichas", ayuda del caso desierto, labels y `aria-label` de la racha (singular/plural).
3. **`visual-designer`:** tratamiento de acento ámbar del poblado pendiente; estilo de la insignia de fuego (glifo, acento llama/dorado, `shadow-medal`) y acento del campo "Racha más larga"; verificación de contraste.
4. **`motion-engineer`:** micro-animación sutil de la llama (con `prefers-reduced-motion`).
5. **`qa-auditor`:** auditoría P0–P3 de ambos cambios.

**Para el `ui-engineer`:** este es el siguiente agente que debe recibir el brief.
