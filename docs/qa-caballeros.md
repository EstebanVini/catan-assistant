# QA — Caballeros y Ciudades (Cities & Knights)

**Autor:** qa-auditor · **Fecha:** 2026-06-17 · **Rama:** `claude/nice-meitner-xsnctw`
**Alcance:** todo lo nuevo/modificado de C&K en `client/src/` (Fases A–E1).
**Build:** `cd client && npm run build` → ✅ compila (tsc + vite, 0 errores).

---

## Resumen ejecutivo

El frontend de C&K está **listo para producción** tras corregir los P1 de
contraste. Los cuatro criterios críticos se cumplen:

- **Privacidad (P0): APROBADO.** Ningún componente lee el detalle de manos,
  mercancías o cartas de progreso ajenas. Todo el detalle (`hand`,
  `commodities`, `progressCards`, `devCards`) se lee exclusivamente vía `me.*`;
  de los demás (`p.*` en `PublicPlayersPanel`) solo se muestran conteos
  (`cardCount`, `commodityCount`, `progressCardsCount`) y datos públicos por
  diseño (`knights` rango+activo, `improvements`, `walls`, `metropolises`,
  `defenderCards`).
- **No regresión del modo base (P0): APROBADO.** Todos los paneles C&K están
  doble-gateados: en `GameScreen` por `state.citiesKnights` y, además, cada
  componente retorna `null` si `!state.citiesKnights`. `BankPanel` conserva el
  `NumericKeypad` base y solo cambia a `DiceInputCK` en C&K. `data-mode="ck"`
  se aplica/retira correctamente en `<html>` (App.tsx) y se limpia al salir del
  modo, terminar la partida o desmontar.
- **Consistencia: APROBADO.** Clases de color por disciplina como literales
  estáticas (mapas `DISCIPLINE_CLASSES`/`DISCIPLINE_CHIP_*` — sin
  `bg-discipline-${x}` dinámico). Cero emojis en markup (los mapas
  `*_EMOJI` de `icons.tsx` son rutas de `fallback` opcionales, no se renderizan
  por defecto). Glifos centralizados en `assets/icons.tsx`.
- **Responsive 360–414px: APROBADO.** Calendario `grid-cols-1 md:grid-cols-3`
  (1 columna en móvil), input de dados `grid-cols-6` con celdas `h-11` (44px) y
  `gap-1.5` cabe en 360px, paneles de caballeros/muros en columna. Touch
  targets ≥44px en toda acción.

### Scores por dimensión (0–4)

| Dimensión | Score | Nota |
|---|---|---|
| Accesibilidad (A11y) | 4 | AA tras corregir el carmesí como texto pequeño. Focus trap/ESC correctos; modales forzados intencionalmente no-descartables. |
| Performance | 4 | Sin layout properties animadas; deltas con timers limpiados; respeta el patrón existente. |
| Responsive | 4 | Sin desbordes 360–414px; touch ≥44px. |
| Theming | 4 | Tokens `ck-*`/`commodity-*`/`discipline-*` consistentes con la verificación de contraste; sin colores hardcoded fuera de glifos SVG (inline por necesidad). |
| Anti-patterns | 4 | Sin `h-screen`, sin emojis, sin `any` injustificado, sin clases dinámicas del JIT. |

---

## Hallazgos por severidad

### P0 — Bloquean ship
Ninguno. Privacidad y no-regresión verificadas correctas.

### P1 — Corregidos en esta auditoría

**P1-1 — Carmesí (`ck-crimson`) usado como color de TEXTO pequeño (falla WCAG AA).**
`docs/contrast-verification.md` §CK.2 es explícito: `ck-crimson` (#bf4a40) sobre
superficies de madera da **3.08–3.56:1** — válido solo como acento **no-texto**
(bordes/swatches, ≥3:1), **falla** para texto normal (requiere 4.5:1). El propio
doc indica usar `red-200`/`red-300` (base) para texto carmesí pequeño. Varios
componentes usaban `text-ck-crimson` en texto <18px.

Ubicaciones y corrección aplicada (texto → `red-300`/`red-200`; bordes y fondos
`ck-crimson` se conservan):

| Archivo | Antes | Después |
|---|---|---|
| `components/DiceInputCK.tsx:262` | `text-ck-crimson` ("dado rojo", ~11px) | `text-red-300` |
| `components/BarbarianTrack.tsx:60` | `text-ck-crimson` ("¡A las puertas!") | `text-red-300` |
| `components/BarbarianTrack.tsx:148` | `text-ck-crimson` (veredicto "En riesgo", 11px) | `text-red-300` |
| `components/BarbarianTrack.tsx:169` | `text-ck-crimson` (nº de ataques) | `text-red-300` |
| `components/BarbarianTrack.tsx:194` | `text-ck-crimson` (cifra de ataque, `StrengthStat`) | `text-red-300` |
| `components/ProgressHand.tsx:152` | `text-ck-crimson` (contador X/4 excedido, 14px) | `text-red-300` |
| `components/ProgressHand.tsx:170` | `text-ck-crimson` (aviso excedente, 12px) | `text-red-300` |
| `components/ProgressHand.tsx:303` | `text-ck-crimson` (botón "Descartar", 12px) | `text-red-200` |
| `components/BarbarianLossModal.tsx:57` | `text-ck-crimson` (título "Saqueo bárbaro", 18px) | `text-red-200` |
| `components/BarbarianLossModal.tsx:151` | `text-ck-crimson` (botón "Degradar", 14px) | `text-red-200` |

`red-200` (#fecaca, 10.21:1 sobre carmesí/15% según el doc) para texto sobre
rellenos carmesí; `red-300` (#fca5a5) para texto carmesí sobre madera. Las cajas
de tono carmesí (`border-ck-crimson/*`, `bg-ck-crimson/*`) y la barra del barco
bárbaro **no cambian**: ahí el carmesí es relleno/borde no-texto (≥3:1, válido).

Resultado: ✅ build OK; toda lectura de texto carmesí queda ≥4.5:1.

### P2 — Documentados (no corregidos; mejora importante)

**P2-1 — `DiceInputCK`: `role="radiogroup"` sin gestión de foco "roving".**
Los selectores de dado usan `role="radio"` + `aria-checked`, pero todos los
radios son tabulables individualmente (sin `tabindex` roving ni navegación con
flechas). Un usuario de teclado tabula por las 6 caras una a una en vez de
entrar al grupo y moverse con flechas. No bloquea el uso (Enter/Espacio activan)
y los `aria-label` son correctos, por eso es P2. Fix sugerido: roving tabindex
(solo el seleccionado/primero `tabIndex=0`, resto `-1`) + `onKeyDown` con flechas,
o migrar a `<fieldset>`+`<input type="radio">` reales.

**P2-2 — Botones "informativos" con `aria-disabled` en lugar de `disabled`.**
En `KnightsPanel`/`WallControl`/`CityCalendarPanel`, los botones bloqueados usan
`aria-disabled={true}` (no `disabled`) para poder capturar el tap y mostrar un
toast con la razón ("Te falta…"). Es un patrón **deliberado y correcto para
móvil** (un `disabled` real no dispara eventos táctiles y el `title` no es
accesible al tacto), y el motivo se duplica en texto visible bajo el botón en mi
turno. Se deja documentado como decisión consciente: un lector de pantalla
anuncia "no disponible" pero el botón sigue siendo enfocable. Aceptable; sin
acción requerida salvo que se quiera estandarizar.

**P2-3 — `CityCalendarPanel`: botón secundario de "razón" sin rol claro.**
Cuando el botón "Mejorar" está bloqueado por falta de mercancía, debajo se
renderiza un segundo `<button>` cuyo único efecto es relanzar el toast con la
razón. Funciona y es accesible (es un botón con texto), pero semánticamente es
texto informativo presentado como botón. Menor; podría ser un `<p>` con la razón
y dejar el toast solo en el botón principal.

### P3 — Nice-to-have

**P3-1 — Glifos SVG con hex literales repetidos.** `MetropolisMark`,
`BarbarianShipMark`, `SackGlyph`, `CityGlyph`, `WallGlyph`, `DefenderShieldGlyph`
repiten los hex de la paleta C&K (#bf4a40, #8b919b, #5e1d1a…) inline en cada
componente. Es coherente con el patrón existente de `icons.tsx` (los glifos del
set ya usan hex literales por necesidad de SVG), pero hay duplicación entre
`WallControl` y `PublicPlayersPanel` (ambos definen un `WallGlyph` casi idéntico).
Consolidar en `assets/icons.tsx` reduciría deriva visual futura.

**P3-2 — Bundle > 500 kB.** `index.js` 507 kB (134 kB gzip). Es un aviso
preexistente del proyecto, no introducido por C&K, pero los nuevos paneles
suman. Code-splitting de los modales C&K (dynamic import) lo aliviaría. Fuera
del alcance de C&K.

**P3-3 — `BankPanel` mantiene el `NumericKeypad` montado lógicamente bajo el
ternario** — sin impacto (no se renderiza en C&K). Solo nota.

---

## Verificaciones puntuales realizadas

- **Privacidad (grep exhaustivo de `.hand`/`.commodities`/`.progressCards`/
  `.devCards`):** todas las lecturas de detalle pasan por `me.*`. `PublicPlayersPanel`
  solo usa `p.cardCount`, `p.commodityCount`, `p.progressCardsCount` y campos
  públicos. ✅
- **Gating del modo base:** `GameScreen` envuelve cada bloque C&K en
  `state.citiesKnights ? … : null`; cada componente C&K además auto-gatea. ✅
- **Clases dinámicas del JIT:** no hay `bg-discipline-${x}`/`text-discipline-${x}`;
  todos los colores por disciplina viven en mapas de literales. ✅
- **Modales forzados:** `BarbarianLossModal` y `DiscardModal` usan `useModalA11y`
  con `onClose` no-op (atrapan foco, no cierran con ESC/backdrop) — intencional
  y correcto. Los modales descartables (`KnightActionModal`, pickers de
  monopolio, `PlayConfirmModal`) cierran con ESC/backdrop y tienen
  `role="dialog"`/`alertdialog`, `aria-modal`, `aria-labelledby`. ✅
- **Touch targets:** botones de acción `min-h-[44px]`/`48px`/`56px`; dados
  `h-11` (44px); ±/− de descarte `h-11 w-11`. ✅
- **Tokens de tema:** `ck-*`, `commodity-*`, `discipline-*` presentes y coherentes
  en `tailwind.config.js` ↔ `index.css` ↔ hex inline de `icons.tsx`. ✅

---

## Archivos modificados por esta auditoría (P1)

- `client/src/components/DiceInputCK.tsx`
- `client/src/components/BarbarianTrack.tsx`
- `client/src/components/ProgressHand.tsx`
- `client/src/components/BarbarianLossModal.tsx`

(Sin cambios en backend, `store.ts` ni `types.ts`.)

## Resultado del build

```
tsc && vite build → ✓ built in ~2.9s, 0 errores
```
