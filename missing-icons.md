# missing-icons.md — Íconos faltantes para Caballeros y Ciudades

> Inventario de los íconos que la expansión **Caballeros y Ciudades** necesita y que **aún no existen** en `client/src/assets/icons/`. Mientras tanto se **reciclan** íconos del juego base (ver columna "Provisional"). Cuando Esteban genere el arte definitivo, se integra en el **único punto de cambio**: `client/src/assets/icons.tsx` (con su fallback emoji). El `visual-designer` mantiene este archivo.
>
> **Convención de arte del set actual:** estilo "medallón" cálido, trazo nogal casi negro (`#1a130c`), PNG ~128px optimizados (originales 2048px), centrados, sin texto incrustado. Los íconos nuevos deben **encajar con ese set** y, cuando apliquen, con la **paleta C&K** (`--ck-crimson #8e2f2a`, `--ck-steel #6b7078`, horizonte ámbar; ver `caballeros-plan.md` §6).
>
> Formato sugerido de archivo: `client/src/assets/icons/<nombre>.png` (kebab/underscore en español, como el set actual).

---

## 1. Mercancías (commodities) — 3 íconos

Deben **distinguirse claramente de los recursos** (que ya tienen su medallón). Idea: mismo medallón pero con **marco/cinta** que indique "mercancía" (cinta dorada heráldica) para no confundir mercancía con recurso de un vistazo.

| Nombre propuesto | Mercancía | Descripción del arte | Tamaños de uso | Provisional (reciclado) |
|---|---|---|---|---|
| `moneda.png` | **Moneda (coin)** — de montañas/mineral | Pila de monedas de oro acuñadas, o una moneda con sello heráldico. Dorado. | 16–48px (HandView, banco, calendario) | `mineral.png` o el dorado de `punto_de_victoria.png` |
| `papel.png` | **Papel (paper)** — de bosque/madera | Pergamino enrollado / hoja con pluma. Tono pergamino (`--commodity-paper`). | 16–48px | `madera.png` |
| `tela.png` | **Tela (cloth)** — de pastura/lana | Rollo de tela / bala de paño plegado. Marfil cálido (`--commodity-cloth`). | 16–48px | `obeja.png` |

## 2. Caballeros (knights) — rango y estado

Un único arte base de caballero existe (`caballero.png`). Faltan variantes de **rango** y **estado**. Opción A: 3 artes por rango. Opción B (preferida de momento): **1 arte + indicador** (estrellas/galones de rango y un tinte/halo para activo vs inactivo) resuelto en CSS por el `ui-engineer`.

| Nombre propuesto | Uso | Descripción del arte | Provisional |
|---|---|---|---|
| `caballero_basico.png` | Caballero rango 1 | Casco/figura simple, 1 galón. | `caballero.png` |
| `caballero_fuerte.png` | Caballero rango 2 | Armadura media, 2 galones. | `caballero.png` |
| `caballero_poderoso.png` | Caballero rango 3 | Armadura completa/penacho, 3 galones. | `caballero.png` |
| (indicador) `activo`/`inactivo` | Estado | Halo dorado = activo; gris/desaturado = inactivo (preferible vía CSS, sin arte nuevo). | estilo CSS |

## 3. Barco bárbaro y ataque

| Nombre propuesto | Uso | Descripción del arte | Provisional |
|---|---|---|---|
| `barco_barbaro.png` | Pista del bárbaro, notices | Drakkar/galera oscura con vela carmesí, silueta amenazante. Acero + carmesí. | `ladron.png` (silueta oscura) |
| `barbaros_atacan.png` (opcional) | Banner de ataque | Hachas/estandartes bárbaros cruzados; tono carmesí/acero. | `ladron.png` + color |

## 4. Mejoras de ciudad / disciplinas — 3 + metrópolis

| Nombre propuesto | Uso | Descripción del arte | Color/Provisional |
|---|---|---|---|
| `comercio.png` | Disciplina Comercio (amarillo, tela) | Balanza/bolsa de comercio o caravana. | Amarillo/dorado · prov. `obeja.png` |
| `politica.png` | Disciplina Política (azul, moneda) | Cetro/corona o sello político. | Azul · prov. `mineral.png` |
| `ciencia.png` | Disciplina Ciencia (verde, papel) | Engranaje/probeta/pluma. | Verde · prov. `madera.png` |
| `metropolis.png` | Ciudad mejorada a metrópolis (4 PV) | Ciudad amurallada con torres altas y estandarte heráldico; borde dorado/carmesí. | prov. `ciudad.png` con marco |
| `acueducto.png` (opc.) | Habilidad Ciencia nivel 3 | Arcos de acueducto. | prov. `madera.png` |
| `casa_comercio.png` (opc.) | Habilidad Comercio nivel 3 | Edificio de mercado con toldo. | prov. `obeja.png` |
| `fortaleza.png` (opc.) | Habilidad Política nivel 3 | Torre/fortín almenado. | prov. `mineral.png` |

## 5. Muro de ciudad

| Nombre propuesto | Uso | Descripción del arte | Provisional |
|---|---|---|---|
| `muro.png` | Muro de ciudad (límite de mano +2) | Sección de muralla de piedra almenada. | prov. `ciudad.png` / `desierto.png` (piedra) |

## 6. Defensor de Catán e insignias

| Nombre propuesto | Uso | Descripción del arte | Provisional |
|---|---|---|---|
| `defensor_catan.png` | Carta/insignia Defensor de Catán (+1 PV) | Escudo heráldico con espada y laurel; coherente con el set de **medallas doradas** existente (`BadgeGlyph`). | prov. insignia `army` (espadas cruzadas) |

## 7. Cartas de progreso (progress cards)

Reemplazan a las cartas de desarrollo. Tres mazos por color de disciplina. De momento se **reciclan** los íconos de dev cards (`caballero.png`, `monopolio.png`, `ano_abundancia.png`, `construccion_carreteras.png`, `punto_de_victoria.png`) y se distinguen por **etiqueta textual + color de disciplina**. Arte propio deseable a futuro (no bloqueante):

| Mazo | Cartas que necesitarían arte (ver `caballeros-plan.md` §2.10) |
|---|---|
| **Ciencia (verde)** | Alchemist, Crane, Engineer, Inventor, Irrigation, Mining, Medicine, Road Building, Smith, Printer |
| **Política (azul)** | Spy, Bishop, Constitution, Deserter, Diplomat, Intrigue, Saboteur, Warlord, Wedding |
| **Comercio (amarillo)** | Merchant, Merchant Fleet, Commercial Harbor, Master Merchant, Resource Monopoly, Trade Monopoly |

> Prioridad sugerida del arte definitivo: **(1)** mercancías (moneda/papel/tela) → **(2)** barco bárbaro + metrópolis + muro → **(3)** disciplinas → **(4)** rangos de caballero → **(5)** cartas de progreso. Las mercancías son las más usadas y las más fáciles de confundir con recursos, por eso van primero.
</content>
