# missing-icons.md — Íconos faltantes para Caballeros y Ciudades

> Inventario de los íconos que la expansión **Caballeros y Ciudades** necesita y que **aún no existen** en `client/src/assets/icons/`. Mientras tanto se **reciclan** íconos del juego base (ver columna "Provisional"). Cuando Esteban genere el arte definitivo, se integra en el **único punto de cambio**: `client/src/assets/icons.tsx` (con su fallback emoji). El `visual-designer` mantiene este archivo.
>
> **Convención de arte del set actual:** estilo "medallón" cálido, trazo nogal casi negro (`#1a130c`), PNG ~128px optimizados (originales 2048px), centrados, sin texto incrustado. Los íconos nuevos deben **encajar con ese set** y, cuando apliquen, con la **paleta C&K** (`--ck-crimson #8e2f2a`, `--ck-steel #6b7078`, horizonte ámbar; ver `caballeros-plan.md` §6).
>
> Formato sugerido de archivo: `client/src/assets/icons/<nombre>.png` (kebab/underscore en español, como el set actual).

---

## Estado de integración (actualizado: 2026-06-29)

Esteban entregó el **arte definitivo** de la mayoría de los íconos C&K y se
**INTEGRARON** en el punto único `client/src/assets/icons.tsx`. Todos son
**medallones completos con su propio marco** y el color/rango **ya integrado en
el arte**, así que se renderizan DIRECTO (como `ResourceGlyph`/`ImgGlyph`): se
**retiraron** los tratamientos CSS que envolvían el arte reciclado (anillo
dorado de mercancía, anillo de color de disciplina, galones de rango del
caballero) porque ahora serían un **doble marco**.

| Set | Estado | Archivos |
|---|---|---|
| Mercancías (§1) | ✅ **INTEGRADO** | `moneda.png`, `papel.png`, `tela.png` |
| Caballeros por rango (§2) | ✅ **INTEGRADO** | `caballero_nivel1/2/3.png` (estado activo/inactivo sigue en CSS) |
| Barco bárbaro + ataque (§3) | ✅ **INTEGRADO** | `barco_barbaro.png`, `barbaros_atacan.png` |
| Disciplinas (§4) | ✅ **INTEGRADO** | `comercio.png`, `politica.png`, `ciencia.png` |
| Metrópolis (§4) | ✅ **INTEGRADO** | `metropolis.png` |
| Muro de ciudad (§5) | ✅ **INTEGRADO** | `muralla.png` |
| Defensor de Catán (§6) | ✅ **INTEGRADO** | `defensor_catan_1vp.png` |
| Comerciante / Mercader (§8) | ✅ **INTEGRADO** | `comerciante.png` |
| **Cartas de progreso (§7)** | ⏳ **PENDIENTE** | aún sin arte propio: siguen con dev cards recicladas + anillo de disciplina |
| Edificios nivel 3 opcionales (§4) | ⏳ opcional | `acueducto.png`, `casa_comercio.png`, `fortaleza.png` (no usados aún) |

> ⚠️ **Peso de los PNG nuevos:** el arte definitivo se subió a resolución
> original (~2048px → **2–7 MB por archivo**), no a los ~128px optimizados del
> set base (40–67 KB). El bundle del cliente crece ~70 MB en imágenes que se
> muestran a 14–48px. **Recomendado** (no bloqueante): redimensionar a ~128–256px
> y recomprimir, igual que el set base, manteniendo los mismos nombres de archivo
> (no requiere tocar `icons.tsx`).

---

## 1. Mercancías (commodities) — 3 íconos  ✅ INTEGRADO

Deben **distinguirse claramente de los recursos** (que ya tienen su medallón). Idea: mismo medallón pero con **marco/cinta** que indique "mercancía" (cinta dorada heráldica) para no confundir mercancía con recurso de un vistazo.

| Nombre propuesto | Mercancía | Descripción del arte | Tamaños de uso | Provisional (reciclado) |
|---|---|---|---|---|
| `moneda.png` | **Moneda (coin)** — de montañas/mineral | Pila de monedas de oro acuñadas, o una moneda con sello heráldico. Dorado. | 16–48px (HandView, banco, calendario) | `mineral.png` o el dorado de `punto_de_victoria.png` |
| `papel.png` | **Papel (paper)** — de bosque/madera | Pergamino enrollado / hoja con pluma. Tono pergamino (`--commodity-paper`). | 16–48px | `madera.png` |
| `tela.png` | **Tela (cloth)** — de pastura/lana | Rollo de tela / bala de paño plegado. Marfil cálido (`--commodity-cloth`). | 16–48px | `obeja.png` |

## 2. Caballeros (knights) — rango y estado  ✅ INTEGRADO

Un único arte base de caballero existe (`caballero.png`). Faltan variantes de **rango** y **estado**. Opción A: 3 artes por rango. Opción B (preferida de momento): **1 arte + indicador** (estrellas/galones de rango y un tinte/halo para activo vs inactivo) resuelto en CSS por el `ui-engineer`.

| Nombre propuesto | Uso | Descripción del arte | Provisional |
|---|---|---|---|
| `caballero_basico.png` | Caballero rango 1 | Casco/figura simple, 1 galón. | `caballero.png` |
| `caballero_fuerte.png` | Caballero rango 2 | Armadura media, 2 galones. | `caballero.png` |
| `caballero_poderoso.png` | Caballero rango 3 | Armadura completa/penacho, 3 galones. | `caballero.png` |
| (indicador) `activo`/`inactivo` | Estado | Halo dorado = activo; gris/desaturado = inactivo (preferible vía CSS, sin arte nuevo). | estilo CSS |

## 3. Barco bárbaro y ataque  ✅ INTEGRADO

| Nombre propuesto | Uso | Descripción del arte | Provisional |
|---|---|---|---|
| `barco_barbaro.png` | Pista del bárbaro, notices | Drakkar/galera oscura con vela carmesí, silueta amenazante. Acero + carmesí. | `ladron.png` (silueta oscura) |
| `barbaros_atacan.png` (opcional) | Banner de ataque | Hachas/estandartes bárbaros cruzados; tono carmesí/acero. | `ladron.png` + color |

## 4. Mejoras de ciudad / disciplinas — 3 + metrópolis  ✅ INTEGRADO (disciplinas + metrópolis)

| Nombre propuesto | Uso | Descripción del arte | Color/Provisional |
|---|---|---|---|
| `comercio.png` | Disciplina Comercio (amarillo, tela) | Balanza/bolsa de comercio o caravana. | Amarillo/dorado · prov. `obeja.png` |
| `politica.png` | Disciplina Política (azul, moneda) | Cetro/corona o sello político. | Azul · prov. `mineral.png` |
| `ciencia.png` | Disciplina Ciencia (verde, papel) | Engranaje/probeta/pluma. | Verde · prov. `madera.png` |
| `metropolis.png` | Ciudad mejorada a metrópolis (4 PV) | Ciudad amurallada con torres altas y estandarte heráldico; borde dorado/carmesí. | prov. `ciudad.png` con marco |
| `acueducto.png` (opc.) | Habilidad Ciencia nivel 3 | Arcos de acueducto. | prov. `madera.png` |
| `casa_comercio.png` (opc.) | Habilidad Comercio nivel 3 | Edificio de mercado con toldo. | prov. `obeja.png` |
| `fortaleza.png` (opc.) | Habilidad Política nivel 3 | Torre/fortín almenado. | prov. `mineral.png` |

## 5. Muro de ciudad  ✅ INTEGRADO

| Nombre propuesto | Uso | Descripción del arte | Provisional |
|---|---|---|---|
| `muro.png` | Muro de ciudad (límite de mano +2) | Sección de muralla de piedra almenada. | prov. `ciudad.png` / `desierto.png` (piedra) |

## 6. Defensor de Catán e insignias  ✅ INTEGRADO

| Nombre propuesto | Uso | Descripción del arte | Provisional |
|---|---|---|---|
| `defensor_catan.png` | Carta/insignia Defensor de Catán (+1 PV) | Escudo heráldico con espada y laurel; coherente con el set de **medallas doradas** existente (`BadgeGlyph`). | prov. insignia `army` (espadas cruzadas) |

## 7. Cartas de progreso (progress cards)  ⏳ PENDIENTE (sin arte propio)

Reemplazan a las cartas de desarrollo. Tres mazos por color de disciplina. De momento se **reciclan** los íconos de dev cards (`caballero.png`, `monopolio.png`, `ano_abundancia.png`, `construccion_carreteras.png`, `punto_de_victoria.png`) y se distinguen por **etiqueta textual + color de disciplina**. Arte propio deseable a futuro (no bloqueante):

| Mazo | Cartas que necesitarían arte (ver `caballeros-plan.md` §2.10) |
|---|---|
| **Ciencia (verde)** | Alchemist, Crane, Engineer, Inventor, Irrigation, Mining, Medicine, Road Building, Smith, Printer |
| **Política (azul)** | Spy, Bishop, Constitution, Deserter, Diplomat, Intrigue, Saboteur, Warlord, Wedding |
| **Comercio (amarillo)** | Merchant, Merchant Fleet, Commercial Harbor, Master Merchant, Resource Monopoly, Trade Monopoly |

> Prioridad sugerida del arte definitivo: **(1)** mercancías (moneda/papel/tela) → **(2)** barco bárbaro + metrópolis + muro → **(3)** disciplinas → **(4)** rangos de caballero → **(5)** cartas de progreso. Las mercancías son las más usadas y las más fáciles de confundir con recursos, por eso van primero.

## 8. Comerciante (merchant token)  ✅ INTEGRADO

Ficha del **comerciante** que coloca la carta de progreso **Mercader** (mazo Comercio, ver §7): se planta sobre un recurso para comerciar **2:1** y otorga **+1 PV** a quien lo controla. Aparece (a) en el **picker** al jugar la carta (elegir sobre qué ficha colocarlo) y (b) como **insignia** junto al jugador que lo controla en el marcador. **No confundir** con la *carta* Mercader de §7 (el evento que activa la ficha): esto es el arte de la **ficha/insignia**, una necesidad de arte distinta.

| Nombre propuesto | Uso | Descripción del arte | Tamaños de uso | Provisional (reciclado) |
|---|---|---|---|---|
| `comerciante.png` | Picker (colocar ficha) + insignia de control en marcador (+1 PV, 2:1) | Medallón cálido con un **mercader ambulante**: carromato/carreta cubierta con un **cofre o saco de mercancías** y, opcional, una pequeña **balanza** y un **"2:1"** sugerido por dos sacos vs. uno (sin texto incrustado). Horizonte ámbar al fondo, trazo nogal `#1a130c`. Acentos en **amarillo de Comercio** para anclarlo a esa disciplina. Silueta limpia y **legible a 16–24px**: que el contorno del carromato + cofre se reconozca sin detalle. | 16–24px (insignia en marcador) · ~40px (picker) | **Picker:** `monopolio.png` (escena de comercio/mercader). **Insignia:** medallón dorado vía `BadgeGlyph` o `punto_de_victoria.png` tintado al amarillo de Comercio (a 16–24px `monopolio.png` se vuelve ilegible y choca con la carta de Monopolio). |

**Distinciones obligatorias para el arte definitivo:**
- **vs. Comercio (disciplina, §4):** la disciplina es una **balanza/bolsa o caravana abstracta**; el comerciante debe protagonizar el **carromato + cofre** (mercader concreto, no símbolo) para diferenciarse.
- **vs. Monopolio (carta, §7):** Monopolio muestra un **señor sentado recibiendo tributo**; el comerciante es un **mercader solitario en camino**. Evitar figura entronizada.

**Recomendación de confusión (insignia en el marcador):** el comerciante suma **+1 PV**, igual que `defensor_catan.png` y que el medallón de `punto_de_victoria.png`. Si las tres insignias se muestran como medallas doradas casi idénticas a 16–24px, el jugador no distinguirá *quién* aporta cada punto. Sugerencia: dar al comerciante un **color de acento propio (amarillo Comercio)** o un **distintivo de silueta (carromato)** que lo separe del escudo del Defensor y del castillo del Punto de Victoria. Mientras se recicle `monopolio.png` como provisional de la insignia, **no** usar también `monopolio.png` para la carta de progreso Monopolio en la misma vista del marcador/picker.
</content>
