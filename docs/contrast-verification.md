# Verificación de contraste — Tema Catán "madera/noche" (Fase 3 §6)

**Autor:** visual-designer · **Destinatario:** qa-auditor
**Fecha:** 2026-06-10
**Método:** ratios WCAG 2.1 calculados sobre los hex finales de los tokens
(`client/src/index.css` `:root` / `tailwind.config.js`). Para fondos con
alpha (`bg-amber-500/[0.08]`, `bg-gold/[0.12]`, `bg-red-600/20`) el ratio se
calcula contra el color **compuesto** sobre la superficie real.

**Criterios:** texto normal ≥ 4.5:1 · texto grande (≥24px, o ≥18.66px bold) ≥ 3:1
· iconografía/controles no-texto ≥ 3:1. Estados *disabled* exentos por WCAG.

## 1. Texto sobre superficies de madera

| Par (fg / bg) | Hex | Ratio | Dónde se usa | AA |
|---|---|---|---|---|
| neutral-50 / surface-1 | `#f8f1e3` / `#1f1812` | 15.60:1 | Texto principal en paneles y secciones | ✅ |
| neutral-50 / surface-2 | `#f8f1e3` / `#271e15` | 14.56:1 | Mano, cards del lobby | ✅ |
| neutral-50 / surface-3 | `#f8f1e3` / `#2f2419` | 13.47:1 | Chips, inputs, botones secundarios | ✅ |
| neutral-100 / surface-2 | `#f0e6d2` / `#271e15` | 13.22:1 | Texto en botones secundarios | ✅ |
| neutral-200 / surface-3 | `#ddcfb4` / `#2f2419` | 9.85:1 | Texto de chips (dev cards en mano) | ✅ |
| neutral-300 / surface-1 | `#c5b290` / `#1f1812` | 8.47:1 | Encabezados de sección (11px uppercase) | ✅ |
| neutral-300 / surface-2 | `#c5b290` / `#271e15` | 7.91:1 | Headers, texto secundario | ✅ |
| neutral-400 / surface-1 | `#a28b6d` / `#1f1812` | 5.39:1 | Texto secundario/ayudas (11–12px) | ✅ |
| neutral-400 / surface-2 | `#a28b6d` / `#271e15` | 5.03:1 | ídem | ✅ |
| neutral-400 / surface-3 | `#a28b6d` / `#2f2419` | 4.65:1 | Hints en chips/inputs | ✅ |
| neutral-500 / surface-1 | `#9a8268` / `#1f1812` | 4.82:1 | Resúmenes de colapsables ("12 fichas"), timestamps del log | ✅ |
| neutral-500 / surface-2 | `#9a8268` / `#271e15` | 4.50:1 | Notas pequeñas en cards | ✅ |
| neutral-50 / neutral-900 | `#f8f1e3` / `#251d14` | 14.77:1 | Títulos de modales | ✅ |
| neutral-400 / neutral-900 | `#a28b6d` / `#251d14` | 5.10:1 | Cuerpo de modales | ✅ |
| neutral-500 / neutral-900 | `#9a8268` / `#251d14` | 4.56:1 | Microcopy de modales | ✅ |
| neutral-500 / neutral-950 | `#9a8268` / `#191310` | 5.05:1 | Eyebrow "Fin de la partida" (WinnerScreen) | ✅ |

> **Cambio de token en este pase:** `neutral-500` subió de `#87715a`
> (3.79:1 / 3.54:1 sobre surface-1/2 — **fallaba AA**) a `#9a8268`. Texto
> `text-neutral-500` sobre `surface-3` queda en 4.16:1: hoy solo lo usan
> estados *disabled* (exentos). **Regla para nuevas pantallas:** sobre
> surface-3, texto informativo mínimo `neutral-400`.

## 2. Texto sobre el océano (Login/Home: encabezados y pie)

Representativo contra `--ocean-mid #0c3553`; el extremo superior central del
degradado llega a `--ocean-high #176087` y solo hospeda los títulos display
(texto grande, criterio 3:1).

| Par (fg / bg) | Hex | Ratio | Dónde se usa | AA |
|---|---|---|---|---|
| gold-light / ocean-high | `#ecc35f` / `#176087` | 4.10:1 | Título de la app (26–28px bold = texto grande, peor caso en el tope del degradado) | ✅ (grande) |
| gold-light / ocean-mid | `#ecc35f` / `#0c3553` | 7.60:1 | ídem, posición real del título | ✅ |
| neutral-300 / ocean-mid | `#c5b290` / `#0c3553` | 6.15:1 | Subtítulos, labels y microcopy del Login (subidos de 400/500 en este pase) | ✅ |
| neutral-300 / ocean-deep | `#c5b290` / `#07243a` | 7.67:1 | ídem, mitad inferior | ✅ |
| neutral-400 / ocean-deep | `#a28b6d` / `#07243a` | 4.88:1 | Pie de Home (versión + links, subido de 500) | ✅ |

> Regla operativa que deja este pase: **texto directamente sobre el océano,
> mínimo `neutral-300`** (los `neutral-400`/`neutral-500` que había en
> Login/Home daban 3.91:1 y 2.75:1 — corregidos). Idealmente nada de texto
> nuevo sobre el océano: usar superficies (regla del brief).

## 3. Acentos funcionales y estados

| Par (fg / bg) | Hex | Ratio | Dónde se usa | AA |
|---|---|---|---|---|
| gold-light / surface-1 | `#ecc35f` / `#1f1812` | 10.47:1 | Insignias, acentos dorados sobre paneles | ✅ |
| gold-light / gold·12% ⊕ surface-1 | `#ecc35f` / `#352917` | 8.47:1 | BadgeChip (medalla) | ✅ |
| gold-light / medallón fuego (base) | `#ecc35f` / `#241509` | 10.57:1 | Nº de la insignia de racha 🔥 (degradado terracota→nogal, peor caso = base oscura) | ✅ |
| gold-light / gold·5% ⊕ surface-1 | `#ecc35f` / `#211910` | 10.35:1 | Nº "Racha más larga" (estadísticas) | ✅ |
| neutral-300 / gold·5% ⊕ surface-1 | `#c5b290` / `#211910` | 8.38:1 | Label "Racha más larga" | ✅ |
| emerald-300 / surface-1 | `#6ee7b7` / `#1f1812` | 11.50:1 | Estados "listo"/éxito, header "Sigue donde lo dejaste" | ✅ |
| neutral-950 / emerald-500 | `#191310` / `#10b981` | 7.25:1 | CTAs primarios (Iniciar, Jugar como invitado) | ✅ |
| amber-200 / surface-2 | `#fde68a` / `#271e15` | 13.14:1 | Header "Panel del banco" | ✅ |
| amber-100 / amber·8% ⊕ surface-1 | `#fef3c7` / `#302311` | 13.72:1 | Avisos ámbar inline (auth degradada, registro incompleto) | ✅ |
| neutral-950 / amber-500 | `#191310` / `#f59e0b` | 8.56:1 | NoticeBanner `warn` (fix qa-auditor, intacto) | ✅ |
| white / sky-700 | `#ffffff` / `#0369a1` | 5.93:1 | NoticeBanner `info` (fix qa-auditor, intacto) | ✅ |
| white / red-600 | `#ffffff` / `#dc2626` | 4.83:1 | Botones destructivos (fix qa-auditor, intacto) | ✅ |
| red-200 / red·20% ⊕ surface-1 | `#fecaca` / `#451b16` | 10.21:1 | Pill "Ladrón", avisos de descarte | ✅ |

## 4. Iconografía funcional y colores de jugador (no-texto, ≥3:1)

Los chips de jugador siempre se apoyan en superficies (nunca en el océano) y
llevan borde/aro propio (`ColorChip`).

| Color | Hex / surface-1 | Ratio | AA (3:1) |
|---|---|---|---|
| player-red | `#d64545` / `#1f1812` | 4.00:1 | ✅ |
| player-blue | `#3b6dd1` / `#1f1812` | 3.59:1 | ✅ |
| player-white | `#ececec` / `#1f1812` | 14.84:1 | ✅ |
| player-orange | `#e58a3a` / `#1f1812` | 6.70:1 | ✅ |
| player-green | `#3fa05a` / `#1f1812` | 5.33:1 | ✅ |
| player-brown | `#9a6a4a` / `#1f1812` | 3.79:1 | ✅ |

> ⚠️ `player-blue` sobre océano da 2.60:1 — **no colocar ColorChips
> directamente sobre el fondo océano** (hoy ningún componente lo hace;
> verificar en pantallas futuras).

## 5. Notas para el qa-auditor

1. El anillo de foco (`--ring-focus`, dorado al 90%) se dibuja con halo
   interior `--ink-dark`: visible sobre madera, océano y CTAs esmeralda.
2. Estados *disabled* (`text-neutral-500` sobre surface-2/3 en botones
   `cursor-not-allowed`) están exentos de AA por WCAG 2.1 (1.4.3).
3. La tipografía display (Iowan/Palatino/Georgia) solo cambia la fuente, no
   los colores: hereda los pares ya verificados arriba.
4. Cero cambios de layout en este pase: solo tokens, clases de color y
   `font-display` añadido a encabezados existentes.
