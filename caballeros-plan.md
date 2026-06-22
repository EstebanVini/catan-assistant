# caballeros-plan.md — Plan de adaptación de **Caballeros y Ciudades** (Cities & Knights)

> Plan de desarrollo para adaptar la expansión **Catán: Caballeros y Ciudades** al asistente digital ya existente (`context.md`, `plan.md`). Este documento es **solo planeación**: define el alcance, las reglas investigadas, el modelo de dominio nuevo, el contrato Socket.IO, la estética/paleta, las fases y — sobre todo — **las actividades detalladas de cada agente** del proyecto. Es la guía de referencia para todo el desarrollo posterior.
>
> **Alcance inicial: 4 jugadores.** La adaptación a 5–6 jugadores se hará después (ver §12).
>
> Convención del proyecto (se mantiene): **UI en español**, **identificadores de código en inglés**; el **backend** (Node/Express/Socket.IO/Mongoose/reglas) lo implementa el orquestador; **los agentes son frontend** y consumen el backend por el contrato Socket.IO + REST.

---

## 1. Filosofía de la adaptación

La app **no es un simulador de tablero**: es un **asistente de contabilidad** para una partida **presencial**. El tablero físico, las piezas de caballero, los marcadores de mejora de ciudad, la pista del barco bárbaro y los muros existen en la mesa. La app **lleva la cuenta sin trampas y sincronizada**: recursos, **mercancías** (commodities), cartas de progreso (privadas), niveles de mejora de ciudad, fuerza de caballeros, posición del barco bárbaro, muros, puntos de victoria y la resolución de los ataques bárbaros.

Principios heredados que **no cambian**:
- La **mano** (recursos + mercancías) y las **cartas de progreso** de cada jugador **solo** se envían a su dueño; los demás ven conteos públicos (`views.ts`).
- El **bank manager** (gerente del banco) sigue siendo quien ingresa la tirada de dados y arbitra. En C&K ingresa **tres dados**.
- **Undo** (`pushSnapshot`) antes de cada acción mutadora.
- Toda acción pública anti-trampas se anuncia con `notice`/`log`.

Decisión global: **C&K es un modo nuevo** (`citiesKnights: boolean`), un toggle del anfitrión en el lobby, **mutuamente excluyente del flujo de dev cards base** pero **coexistiendo en el mismo código**. El juego base sigue intacto cuando el modo está apagado.

---

## 2. Reglas de Caballeros y Ciudades (referencia canónica investigada)

> Fuentes: catan.com, Wikipedia (Catan: Cities & Knights), UltraBoardGames, colonist.io, officialgamerules.org, guías de cartas de progreso y foros (BGG/Reddit). Resumen verificado y reconciliado entre fuentes.

### 2.1 Cambios estructurales respecto al juego base
- **Victoria a 13 puntos** (no 10).
- Se juega con **3 dados** cada turno: **2 dados de producción** (uno rojo, uno amarillo/blanco) + **1 dado de evento** (event die).
- Las **cartas de desarrollo desaparecen**; se reemplazan por **cartas de progreso** (3 mazos por disciplina).
- **No existe la carta de "Ejército más grande"** como punto de victoria. Tener muchos caballeros sigue dando ventaja (defensa, Defensor de Catán), pero **no otorga 2 PV automáticos** como en el base.
- Aparecen las **mercancías** (commodities): **moneda (coin)**, **papel (paper)**, **tela (cloth)** — un segundo tipo de carta que **solo producen las ciudades**.
- Aparecen los **caballeros** (piezas en el tablero con rango y estado activo/inactivo), las **mejoras de ciudad** (3 disciplinas), las **metrópolis**, los **muros de ciudad** y el **barco bárbaro**.

### 2.2 El dado de evento (event die) y la tirada
El dado de evento tiene **6 caras**: **3 con barco negro (bárbaro)** y **3 con "puertas/castillo" de color** — una **amarilla (Comercio)**, una **verde (Ciencia)** y una **azul (Política)**.

Secuencia al inicio del turno (la ingresa el bank manager):
1. Se tiran los 3 dados. La **suma de los 2 dados de producción** (2–12) determina la producción de recursos **y de mercancías**, igual que en el base (incluido el **7** → ladrón/descarte, con la salvedad del §2.8).
2. **Dado de evento = barco** → el **barco bárbaro avanza 1 paso** hacia Catán (ver §2.7).
3. **Dado de evento = color (puerta)** → se reparten **cartas de progreso** según el **"calendario de la ciudad"**: cada jugador mira el **dado rojo (1–6)**; si el valor del dado rojo es **≤ su nivel de mejora** en la disciplina de ese color, **roba 1 carta de progreso** de ese mazo. (Nivel 0 nunca roba; nivel 1 roba con rojo=1; … nivel 5 roba con rojo 1–5; nunca con rojo=6.)

### 2.3 Mercancías (commodities)
- Tres mercancías, ligadas a un terreno y a una disciplina:
  | Mercancía | Terreno que la produce | Disciplina | Color |
  |---|---|---|---|
  | **Moneda (coin)** | Montañas (mineral/ore) | **Política** | Azul |
  | **Papel (paper)** | Bosque (madera/lumber) | **Ciencia** | Verde |
  | **Tela (cloth)** | Pastura (lana/wool) | **Comercio** | Amarillo |
- **Producción**: cuando sale el número de una ficha:
  - Un **poblado** produce **1 recurso** (igual que el base) — **nunca** produce mercancías.
  - Una **ciudad** sobre **bosque / pastura / montaña** produce **1 recurso + 1 mercancía** del tipo correspondiente (en vez de 2 recursos).
  - Una **ciudad** sobre **trigo (grain) / ladrillo (brick)** produce **2 recursos** (no hay mercancía asociada a esos terrenos).
- Las mercancías se usan **solo** para mejorar ciudades (calendario). Hay 36 cartas (12 de cada tipo) — banco tratado como **ilimitado**, igual que en el base (decisión de mesa ya vigente).

### 2.4 Mejoras de ciudad (city improvements) y el calendario
Tres **disciplinas**, cada una con **5 niveles**, mejoradas pagando su mercancía:

| Nivel | Costo (mercancía de esa disciplina) |
|---|---|
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 4 |
| 5 | 5 |

Disciplinas y habilidades:
- **Comercio (amarillo, tela)** — *Trade*:
  - Nivel 3 → **Casa de comercio (Trading House)**: cambia **2 mercancías iguales → 1 recurso o mercancía cualquiera** (intercambio 2:1 de mercancías con el banco).
  - Nivel 4 → habilita reclamar **Metrópolis de Comercio**.
  - Nivel 5 → puede **arrebatar** la metrópolis de comercio a otro jugador.
- **Ciencia (verde, papel)** — *Science*:
  - Nivel 3 → **Acueducto (Aqueduct)**: si en tu turno **no produces ningún recurso** (ninguna de tus fichas salió o están bloqueadas), **tomas 1 recurso a elección** del banco.
  - Nivel 4 → habilita **Metrópolis de Ciencia**.
  - Nivel 5 → arrebatar metrópolis de ciencia.
- **Política (azul, moneda)** — *Politics*:
  - Nivel 3 → **Fortaleza (Fortress)**: habilita **promover caballeros a nivel 3 (poderoso/mighty)**. Sin nivel 3 de política **no puedes** tener caballeros poderosos.
  - Nivel 4 → habilita **Metrópolis de Política**.
  - Nivel 5 → arrebatar metrópolis de política.

> Nota: para subir a **nivel 4** una disciplina, debes tener una **ciudad** disponible para convertir en metrópolis. Para subir a **nivel 5** debe existir una metrópolis (tuya o ajena) en juego en esa disciplina, según las reglas de "robo de metrópolis".

### 2.5 Metrópolis
- La **primera** persona en llegar a **nivel 4** de una disciplina convierte una de sus **ciudades en metrópolis**: vale **4 PV** (en lugar de 2). Hay **una metrópolis por disciplina** como máximo (3 en total en juego).
- Si otro jugador alcanza **nivel 5** en una disciplina cuya metrópolis ya posee alguien con nivel 4, **se la arrebata** (la metrópolis se mueve a una de sus ciudades; el anterior dueño vuelve a tener una ciudad normal). El que tiene nivel 5 no puede ser arrebatado salvo por… (en C&K el nivel 5 es el tope; queda protegida).
- Una metrópolis **no puede** ser reducida por los bárbaros (ver §2.7) ni destruida.

### 2.6 Caballeros (knights)
Piezas en el tablero (intersecciones), con **rango** y **estado**:
- **Rangos**: **Básico (fuerza 1)**, **Fuerte (fuerza 2)**, **Poderoso (fuerza 3)**.
- **Estado**: **activo** o **inactivo**. Un caballero recién construido o recién promovido nace **inactivo**. Bloquea caminos esté activo o no; para **actuar** debe estar **activo**.
- **Costos**:
  - **Construir** caballero (básico): **1 lana (wool) + 1 mineral (ore)**.
  - **Activar** un caballero: **1 trigo (grain)**.
  - **Promover** un caballero un nivel: **1 lana + 1 mineral** (a nivel 3 requiere **Fortaleza** = política nivel 3).
- Acciones de un caballero **activo** (cuesta haberlo activado; mover/actuar **gasta su activación** ese turno):
  - **Moverse** por tus caminos a una intersección libre.
  - **Expulsar (displace)** a un caballero enemigo de **menor rango** de una intersección conectada a tus caminos; el dueño desplazado lo reubica o lo pierde si no puede.
  - **Ahuyentar al ladrón / pirata** (mover el ladrón a otra ficha) sin necesidad de un 7 — pero **solo después del primer ataque bárbaro** (§2.8).
- **Límite**: hasta **6 caballeros** por jugador (2 de cada rango, según componentes). En el asistente: límite informativo, lo arbitra la mesa.

### 2.7 El barco bárbaro y los ataques
- El barco bárbaro empieza en el **paso 0** de una pista de **7 pasos**. Cada cara de **barco** en el dado de evento lo **avanza 1 paso**. Al llegar al **paso 7**, **ataca** y luego **regresa a 0**.
- **Resolución del ataque** (se compara fuerza total entre **todos** los jugadores):
  - **Fuerza de ataque bárbara** = número total de **ciudades + metrópolis** de **todos** los jugadores (cada ciudad/metrópolis = 1).
  - **Fuerza de defensa** = suma de la **fuerza de los caballeros ACTIVOS** de **todos** los jugadores (básico 1, fuerte 2, poderoso 3).
  - **Defensa ≥ ataque** → **los bárbaros son repelidos**. El jugador que aportó **más fuerza de defensa** recibe la carta **Defensor de Catán** (+1 PV). En **empate** de mayor aporte, cada empatado roba **1 carta de progreso a elección** (en vez del PV).
  - **Defensa < ataque** → **los bárbaros saquean**. El/los jugador(es) con **menos** fuerza de defensa aportada pierden **1 ciudad** (se reduce a **poblado**). Las **metrópolis** y los **poblados** son **inmunes**. Si un jugador con la menor defensa tiene **muro**, el muro se destruye en vez de (o además de, según reglas) reducir la ciudad — convención de la mesa, ver decisiones abiertas §13.
  - Tras **cualquier** ataque: **todos los caballeros se desactivan** (vuelven a inactivo) y el barco vuelve al paso 0.
- **Defensor de Catán**: cartas de +1 PV; un jugador puede acumular varias a lo largo de la partida.

### 2.8 El ladrón en C&K
- **El ladrón queda inmovilizado** hasta el **primer ataque bárbaro**. Antes de eso, un **7** **solo provoca descarte** (quien tenga de más); **no se mueve el ladrón ni se roba**. Tampoco se puede mover el ladrón con caballeros ni cartas (Bishop) antes del primer ataque.
- Tras el primer ataque, el ladrón funciona como en el base (7 → descarte + mover + robar) **y además** los caballeros activos pueden ahuyentarlo.

### 2.9 Muros de ciudad (city walls)
- **Costo**: **2 ladrillos (brick)**. Hasta **3 muros** por jugador (uno por ciudad).
- Cada muro permite **+2 cartas** de límite de mano antes de descartar con el 7. Base = **7**; con 3 muros = **13** cartas.
- Un muro se **destruye** si los bárbaros saquean esa ciudad (§2.7, decisión de mesa).

### 2.10 Cartas de progreso (progress cards)
- **3 mazos** por disciplina, robadas por el calendario (§2.2). **Límite de mano: 4** cartas de progreso; si robas la 5ª debes **descartar/jugar una** de inmediato. **No se pueden comerciar** nunca.
- Las cartas de **Punto de victoria** dentro de progreso (Printer/Constitution) son permanentes (+1 PV) y se revelan al jugarse.
- Listado canónico (cantidades por mazo de 18; total 54). Para el asistente, lo relevante es **el efecto** y si es **inmediato, de PV, o de "guardar y jugar"**:

  **Ciencia (verde / papel):**
  - *Alchemist* (2) — antes de tirar, eliges el resultado de los dos dados de producción.
  - *Crane* (2) — mejora una ciudad pagando **1 mercancía menos**.
  - *Engineer* (1) — construye **1 muro gratis**.
  - *Inventor* (2) — intercambia 2 fichas de número (no 2/12/6/8).
  - *Irrigation* (2) — gana 2 trigo por cada poblado/ciudad junto a ficha de trigo.
  - *Mining* (2) — gana 2 mineral por cada poblado/ciudad junto a ficha de mineral.
  - *Medicine* (2) — mejora poblado→ciudad por **2 mineral + 1 trigo**.
  - *Road Building* (2) — construye **2 caminos gratis**.
  - *Smith* (2) — **promueve 2 caballeros** un nivel **gratis**.
  - *Printer* (1) — **+1 PV** permanente.

  **Política (azul / moneda):**
  - *Spy* (3) — mira las cartas de progreso de otro y **roba 1**.
  - *Bishop* (2) — mueve el ladrón y roba a **todos** los afectados.
  - *Constitution* (1) — **+1 PV** permanente.
  - *Deserter* (2) — un rival quita 1 caballero; tú colocas uno de igual fuerza.
  - *Diplomat* (2) — quita un camino enemigo libre o reubica uno tuyo.
  - *Intrigue* (2) — expulsa un caballero enemigo en intersección conectada a tus caminos.
  - *Saboteur* (2) — jugadores con ≥ tus PV descartan la mitad de su mano.
  - *Warlord* (2) — **activas todos tus caballeros gratis**.
  - *Wedding* (2) — rivales con más PV te dan 2 cartas cada uno.

  **Comercio (amarillo / tela):**
  - *Merchant* (6) — coloca el Mercader en una ficha junto a tu poblado/ciudad (2:1 de ese recurso) y **+1 PV** mientras lo tengas.
  - *Merchant Fleet* (2) — comercio 2:1 ilimitado de un recurso/mercancía ese turno.
  - *Commercial Harbor* (2) — fuerza a rivales a cambiarte recurso por mercancía.
  - *Master Merchant* (2) — toma 2 cartas de un rival con más PV.
  - *Resource Monopoly* (4) — nombra un recurso; cada jugador te da 2.
  - *Trade Monopoly* (2) — nombra una mercancía; cada jugador te da 1.

### 2.11 Setup inicial en C&K
- **Regla oficial:** cada jugador empieza con **1 poblado + 1 ciudad** (la 2ª colocación inicial es una **ciudad**, no un poblado), más sus 2 caminos.
- **Implementación en esta app (decisión confirmada con Esteban, actualizada):** el **registro inicial se mantiene con 2 poblados** (sin tocar el flujo `InitialBuildSetup`), pero al **iniciar la partida cada jugador empieza ya con 1 poblado + 1 ciudad**: en `game:start`, si `state.citiesKnights`, el **segundo poblado registrado se convierte automáticamente en ciudad** (antes de derivar los hexes, para que produzca como ciudad desde el primer turno). Las ciudades siguientes cuestan lo normal (2 trigo + 3 mineral). *(Histórico: una versión previa concedía una mejora gratuita manual en partida vía `Player.freeCityUsed` / `me.freeCityAvailable`; se reemplazó por la conversión automática al inicio y ese mecanismo se eliminó.)*
- Diferencias: el **ladrón** se coloca en el desierto pero **inmovilizado** (§2.8); el **barco bárbaro** arranca en el paso 0; nadie empieza con caballeros, mercancías ni mejoras.
- Mazo de cartas de desarrollo del base **no se usa**; en su lugar, los 3 mazos de progreso.

---

## 3. Qué reglas extra del base se conservan / descartan

`ExtraRules` actuales: `unequalTrades`, `sharedPorts`, `noSpecialBuild`, `robberNoStealFirstRound`, `robberEmptyGivesResource`.

| Regla extra | En C&K |
|---|---|
| `unequalTrades` (ofertas desiguales) | **Se conserva** (aplica a recursos y mercancías). |
| `sharedPorts` (usar puerto ajeno) | **Se conserva**. |
| `noSpecialBuild` (sin fase de construcción especial) | **Aplica solo en 5–6**; irrelevante en 4 jugadores (fuera de alcance inicial). |
| `robberNoStealFirstRound` | **Se descarta/oculta en C&K**: redundante, porque el ladrón ya está inmovilizado hasta el primer ataque bárbaro (§2.8), regla más fuerte. La ocultamos del lobby cuando `citiesKnights` está activo. |
| `robberEmptyGivesResource` | **Se conserva** (aplica una vez que el ladrón está activo). |

Reglas nuevas específicas de C&K que se añaden como comportamiento del modo (no como toggles, salvo decisión del host): ladrón inmovilizado, victoria a 13, 3 dados, etc.

---

## 4. Modelo de dominio nuevo (propuesta backend)

> Todo **aditivo** y **opcional** para no romper el juego base. Los campos C&K solo se pueblan/leen cuando `state.citiesKnights === true`.

### 4.1 `state.ts` — tipos
```ts
// Mercancías
export type Commodity = 'coin' | 'paper' | 'cloth';
export const COMMODITIES: Commodity[] = ['coin', 'paper', 'cloth'];
export type CommodityHand = Record<Commodity, number>;

// Disciplinas de mejora de ciudad
export type Discipline = 'trade' | 'politics' | 'science'; // amarillo / azul / verde
// trade↔cloth, politics↔coin, science↔paper
export type CityImprovements = Record<Discipline, number>; // nivel 0..5

// Caballeros
export type KnightRank = 1 | 2 | 3; // básico / fuerte / poderoso
export interface Knight { id: string; rank: KnightRank; active: boolean; }

// Cartas de progreso
export type ProgressCardType = /* nombres del §2.10 */ string;
export interface ProgressCardDecks { trade: ProgressCardType[]; politics: ProgressCardType[]; science: ProgressCardType[]; }

// Metrópolis: dueño por disciplina (playerId o null)
export type MetropolisOwners = Record<Discipline, string | null>;
```

Extensiones a `Player`:
```ts
commodities: CommodityHand;        // PRIVADO (como hand)
improvements: CityImprovements;    // público (nivel por disciplina)
knights: Knight[];                 // público (rango + activo)
walls: number;                     // 0..3 (público)
progressCards: ProgressCardType[]; // PRIVADO (máx 4)
defenderCards: number;             // Defensor de Catán acumulados (público, +1 PV c/u)
metropolises: Discipline[];        // disciplinas en las que tiene metrópolis (público)
// victoryPoints gana: metropolisBonus (deriva de metropolises.length), defender (deriva de defenderCards)
```

Extensiones a `Building`/`Hex`: un `Building` puede ser `type: 'metropolis'` (o un flag `isMetropolis` sobre la ciudad). La producción de mercancías se deriva de `hex.resource` + `owner.type` en `distributeForRoll`.

Extensiones a `GameState`:
```ts
citiesKnights: boolean;            // modo activo
barbarianStep: number;             // 0..7
barbarianAttacks: number;          // nº de ataques ocurridos (>=1 desactiva la inmovilización del ladrón)
robberActive: boolean;             // false hasta el primer ataque bárbaro
metropolisOwners: MetropolisOwners;
progressDecks: ProgressCardDecks;  // servidor (oculto)
lastEventDie?: 'barbarian' | Discipline; // último dado de evento ingresado
lastRedDie?: number;               // 1..6 (para el calendario)
pendingProgressDiscard?: Record<string, true>; // quién debe descartar por exceso (>4)
pendingBarbarian?: { ... };        // estado de resolución de ataque en curso
```

`fullBank` y `commodityBank`: añadir un banco de mercancías (12 c/u, ilimitado como el de recursos). Límite de mano para el 7 = `7 + 2*walls` (cuenta recursos + mercancías).

Victoria: `totalVictoryPoints` suma poblados (1), ciudades (2), **metrópolis (4, es decir +2 sobre ciudad)**, longestRoad (2), **Defensor de Catán (+1 c/u)**, cartas de PV de progreso (Printer/Constitution). **Se elimina largestArmy** del cómputo en modo C&K. Objetivo: `state.citiesKnights ? 13 : 10`.

### 4.2 Pureza y tests
- `rules.ts`: añadir funciones **puras y testeadas**:
  - `produceForRoll` con mercancías (ciudad sobre bosque/pastura/montaña → recurso+mercancía).
  - `improvementUpgradeCost(level)`, `canUpgrade`, `applyUpgrade` (con metrópolis y robo).
  - `knightBuildCost/activateCost/promoteCost`, `canPromoteTo3` (requiere fortaleza).
  - `barbarianStrength(state)` (ciudades+metrópolis), `defenseStrength(state)` (caballeros activos), `resolveBarbarianAttack(state)` (puro: devuelve ganador/perdedores, sin I/O).
  - `drawProgressCard(deck)`, `progressHandLimit = 4`, `handLimitForSeven(player) = 7 + 2*walls`.
  - `progressDrawByCalendar(player, discipline, redDie)` (¿roba? `redDie <= level`).
- Nuevos archivos de test: `cities-knights.rules.test.ts`, `barbarian.test.ts`, `improvements.test.ts`.

---

## 5. Contrato Socket.IO nuevo (propuesta)

**Lobby**
- `lobby:setCitiesKnights { enabled }` — activa/desactiva el modo (host; solo en lobby; reinicializa bancos/mazos; oculta toggles incompatibles). Mutuamente compatible con `extension56` (se permitirá 5–6 después).

**Turno / dados**
- `turn:rollCK { production: number, redDie: number, eventDie: 'barbarian'|'trade'|'politics'|'science' }` — el bank manager ingresa los 3 dados. El server: distribuye recursos+mercancías por `production`; si `eventDie==='barbarian'` avanza el barco (y resuelve ataque si llega a 7); si es color, reparte cartas de progreso por calendario. Maneja el 7 (descarte; ladrón solo si `robberActive`).

**Mercancías / mejoras de ciudad**
- `city:upgrade { discipline }` — paga la mercancía del nivel siguiente; sube nivel; aplica metrópolis/robo y habilidades (fortaleza, etc.).
- `city:buildWall` — paga 2 brick, +1 muro (máx 3).
- `trade:commodityBank { give: Commodity, receive: Resource|Commodity }` — Casa de comercio 2:1 (requiere trade≥3).

**Caballeros**
- `knight:build` — 1 wool + 1 ore → caballero básico inactivo.
- `knight:activate { knightId }` — 1 grain → activo.
- `knight:promote { knightId }` — 1 wool + 1 ore (nivel 3 requiere fortaleza).
- `knight:action { knightId, kind: 'move'|'displace'|'chaseRobber', target? }` — gasta la activación; mueve/expulsa/ahuyenta (ahuyentar solo si `robberActive`).

**Bárbaros**
- `barbarian:resolve { ... }` — confirmación/arbitraje del bank manager cuando el barco llega a 7 (la app calcula el resultado y pide confirmar pérdidas/ganador; soporta el caso de empates y elección de carta).

**Cartas de progreso**
- `progress:play { cardType, params }` — juega una carta (efectos del §2.10; muchas requieren parámetros e interacción con otros jugadores, espejo de los flujos de dev cards actuales).
- `progress:discard { cardType }` — descarte por exceso (>4).

**Muros / robos / PV** — reusar `admin:giveCard`, `action:undo`, `vp:setLongestRoad`, `game:declareWin` (con objetivo 13).

**Servidor→Cliente** — se mantienen `state:update`, `error`, `toast`, `notice`, `build:notify`; se añaden notices C&K: avance del barco, ataque resuelto, metrópolis ganada/arrebatada, Defensor de Catán.

Las **vistas** (`views.ts`) exponen: mercancías propias (privado), conteo público de mercancías ajenas, `improvements`, `knights` (rango+activo), `walls`, `metropolises`, `defenderCards`, `barbarianStep`, `robberActive`, conteo de cartas de progreso ajenas (privado el contenido).

---

## 6. Estética y paleta (subtil shift al mundo de Caballeros y Ciudades)

**Objetivo del usuario:** misma estética general que el juego base, **paleta de color sutilmente desplazada** hacia la caja de la expansión.

**Referencias de la caja (5ª/6ª ed.):** cielo tormentoso, **barcos de guerra bárbaros**, **horizonte naranja/ámbar incandescente**, **estandartes y armaduras carmesí/granate**, **acero/hierro de caballero (gris frío)**, dorado heráldico. El base es océano azul sereno; C&K es **el mismo mar pero al anochecer, con tormenta y fuego en el horizonte**.

**Estrategia:** **no** rehacer el tema; **ajustar tokens** de `index.css` (con sus espejos en `tailwind.config.js`, `playerColors.ts`, `icons.tsx`) **solo cuando el modo C&K está activo** — vía un atributo `[data-mode="ck"]` en `<html>`/`#root` que sobreescribe un puñado de custom properties. El tema base queda **idéntico** cuando el modo está apagado.

Tokens nuevos / ajustados propuestos (los afina el `visual-designer`):
```css
[data-mode="ck"] {
  /* Horizonte tormentoso: el degradado del océano gana un borde ámbar/carmesí arriba */
  --ocean-high: #2a4a63;                 /* mar de anochecer (un punto más frío/oscuro) */
  --ck-horizon: #c25a2a;                 /* fuego del horizonte (ámbar quemado) */
  --ocean-gradient: radial-gradient(130% 95% at 50% -12%,
      var(--ck-horizon) 0%, #1c3invalid... ); /* el visual-designer calcula los stops */

  /* Acentos C&K */
  --ck-crimson: #8e2f2a;                 /* estandarte/armadura carmesí (acento primario C&K) */
  --ck-crimson-deep: #5e1d1a;
  --ck-steel: #6b7078;                   /* hierro de caballero */
  --ck-steel-light: #9aa0a8;

  /* Mercancías (cartas nuevas) */
  --commodity-coin: var(--gold);         /* moneda → dorado */
  --commodity-cloth: #e8e0cf;            /* tela → marfil cálido */
  --commodity-paper: #cdbb95;            /* papel → pergamino */

  /* Disciplinas (colores funcionales del juego, como los recursos) */
  --discipline-trade: #d9a93e;           /* amarillo/dorado */
  --discipline-politics: #3b6dd1;        /* azul */
  --discipline-science: #3a8049;         /* verde */
}
```
El **dorado reservado** (marca/victoria/insignias) **se mantiene**; el **carmesí** entra como **acento secundario de peligro/heráldica** (barra del bárbaro, botón de "resolver ataque", borde de metrópolis). Contraste WCAG AA obligatorio sobre madera y sobre océano (lo verifica `qa-auditor`).

> **Importante:** la paleta del base **no se toca** fuera de `[data-mode="ck"]`. Es un *reskin* condicional, no un rediseño.

---

## 7. Íconos

De momento se **reciclan** los íconos existentes (mapeo en `client/src/assets/icons.tsx`) como provisionales:
- Mercancías → reutilizar temporalmente: `coin`→`mineral.png`, `paper`→`madera.png`, `cloth`→`obeja.png` (con un badge/marco que los distinga de los recursos), o el dorado/PV para coin.
- Caballero (todos los rangos) → `caballero.png` (variar con un indicador de rango 1/2/3 y estado activo/inactivo por estilo, no por arte).
- Barco bárbaro, muro, metrópolis, mejoras por disciplina, Defensor de Catán, Mercader, cartas de progreso → reusar el más cercano (p. ej. construcciones, `ladron.png`, insignias) **con etiqueta textual**.

**Todos los íconos que faltan se documentan en `missing-icons.md`** (creado junto a este plan) con nombre, uso, tamaño, y descripción del arte deseado para cuando Esteban genere el set definitivo. El `visual-designer` mantiene ese archivo al día.

---

## 8. Fases de desarrollo (entregables, cada una termina en commit funcional)

> Cada fase deja la app **compilando y jugable**. El modo base **nunca** se rompe.

### Fase A — Fundaciones del modo (orquestador + visual-designer + ui-engineer)
- Backend: flag `citiesKnights` en `GameState`; `lobby:setCitiesKnights`; objetivo de victoria 13; ocultar `robberNoStealFirstRound` en el lobby; banco de mercancías; `robberActive=false` y `barbarianStep=0` al iniciar. Sin lógica nueva de juego todavía (solo cimientos y que no rompa nada). Tests existentes verdes.
- Frontend: toggle en el lobby ("Caballeros y Ciudades"), badge de modo en la pantalla de juego, **paleta condicional** `[data-mode="ck"]`.
- **Entregable:** se puede crear una partida C&K, verla con la paleta desplazada, y ganar a 13. Commit.

### Fase B — Mercancías y producción
- Backend: `commodities` en `Player`/vistas; `produceForRoll` con mercancías (ciudad sobre bosque/pastura/montaña). Límite de mano del 7 = `7 + 2*walls` contando mercancías. Tests.
- Frontend: `HandView` muestra recursos **y** mercancías (separadas visualmente); panel del banco incluye mercancías; entrega manual (`admin:giveCard`) soporta mercancías.
- **Entregable:** las ciudades producen mercancías y se contabilizan. Commit.

### Fase C — Mejoras de ciudad, calendario y cartas de progreso
- Backend: `improvements`, `city:upgrade`, costos por nivel, habilidades (acueducto, casa de comercio, fortaleza), metrópolis y robo de metrópolis; 3 mazos de progreso; `turn:rollCK` con dado de evento de color → reparto por calendario; límite de 4 cartas de progreso; `progress:play`/`progress:discard` (al menos las cartas "simples"; las complejas se iteran). Tests.
- Frontend: panel de **calendario de ciudad** (3 disciplinas, niveles, costo siguiente, habilidad), input de **3 dados** del bank manager, panel/`HandView` de cartas de progreso (privado), modales de juego de cartas (espejo de `DevCardsPanel`).
- **Entregable:** subir disciplinas, ganar metrópolis, robar y jugar cartas de progreso. Commit(s) por subconjunto.

### Fase D — Caballeros y bárbaros
- Backend: `knights` (build/activate/promote/move/displace/chaseRobber), `barbarianStep`, avance por dado de evento, `resolveBarbarianAttack` (puro), Defensor de Catán, desactivación tras ataque, **activación del ladrón tras el primer ataque**. Tests exhaustivos del combate.
- Frontend: panel de **caballeros** (construir/activar/promover/acciones, con rango y estado), **pista del barco bárbaro** (0–7) con estado de defensa total vs ataque, flujo de **resolución de ataque** arbitrado por el bank manager (espejo de `RobberFlow`), notices prominentes.
- **Entregable:** ciclo bárbaro completo y caballeros funcionales. Commit(s).

### Fase E — Muros, pulido, copy, motion, QA
- Backend: `city:buildWall`, ajustes finos, cartas de progreso restantes (complejas).
- Frontend: muros en la UI; **ux-writer** revisa todo el copy/glosario C&K; **motion-engineer** anima avance del bárbaro, ataque, metrópolis ganada, recepción de mercancías/cartas; **qa-auditor** audita (WCAG AA con la nueva paleta, responsive 360–414px, touch ≥44px, P0–P3). Íconos definitivos cuando existan.
- **Entregable:** experiencia C&K de 4 jugadores pulida. Commit(s).

### Fase F — 5–6 jugadores (posterior, fuera del alcance inicial)
- Combinar `citiesKnights` + `extension56`: bancos/mazos para 6, fase de construcción especial compatible con C&K, segundo barco/variantes si aplica. Ver §12.

---

## 9. Plan de actividades **por agente** (guía detallada de desarrollo)

> El **orquestador (Claude principal)** implementa **todo el backend** (tipos, reglas puras + tests, handlers Socket.IO, vistas, persistencia) y **orquesta** a los agentes. Los agentes son **frontend** y consumen el contrato del §5. Cada agente recibe, por fase, un brief con el contrato exacto de eventos/vistas que ya existe en el server.

### 9.1 `ux-architect` (flujos y briefs — no escribe código)
Responsable de **diseñar los flujos** antes de implementar, identificando casos extremos. Entregables por fase:
- **Fase A:** brief del **toggle de modo** en el lobby (cómo conviven base/C&K/extensión; qué toggles se ocultan; copy de ayuda "¿qué es Caballeros y Ciudades?"). Mapa de pantallas afectadas.
- **Fase B:** flujo de **mercancías**: dónde viven en la mano (separadas de recursos), cómo se ven los conteos públicos, cómo el bank manager entrega mercancías manualmente. Casos extremos: ciudad sobre grain/brick (2 recursos, 0 mercancía).
- **Fase C:** flujo del **calendario de ciudad** (mejorar, ver habilidad desbloqueada, momento de la metrópolis y su robo), flujo del **input de 3 dados**, flujo de **robar y jugar cartas de progreso** (límite 4, descarte forzado, cartas que tocan a otros jugadores). Brief por cada carta compleja (Spy, Wedding, Master Merchant, monopolios) reutilizando patrones de trade/monopoly existentes.
- **Fase D:** flujo de **caballeros** (estados activo/inactivo, promover, acciones y su coste de activación) y el **flujo de resolución del ataque bárbaro** arbitrado (quién pierde ciudad, empates, Defensor de Catán, muros). Diseña la **pista del bárbaro** como pieza de tensión central.
- **Fase E:** flujo de **muros**; revisión de consistencia de toda la experiencia C&K; lista priorizada de casos extremos para `qa-auditor`.
- **Transversal:** mantener un mini–mapa de estados del turno C&K (roll→evento→producción/calendario/bárbaro→main→fin) para alinear a todos.

### 9.2 `ui-engineer` (implementación React/TS — el constructor principal)
Implementa componentes y los conecta al socket/store. Entregables por fase:
- **Fase A:** toggle `CitiesKnightsToggle` en `LobbyScreen`; badge de modo en `TopBar`/`GameScreen`; cableado de `lobby:setCitiesKnights` en `store.ts`/`socket.ts`/`types.ts`; aplicar `data-mode="ck"` en la raíz según la vista.
- **Fase B:** extender `HandView` y `ResourceIcon`/`assets/icons.tsx` para **mercancías**; `CommodityRow`; extender `BankPanel`/`GiveCardModal` para entregar mercancías; reflejar mercancías en `types.ts`/vistas.
- **Fase C:** nuevo `CityCalendarPanel` (3 columnas de disciplina con niveles, costo siguiente, habilidad, botón mejorar → `city:upgrade`); `DiceInputCK` (3 dados) para el bank manager; `ProgressHand`/`ProgressCardsPanel` + modales de juego (clonar patrón de `DevCardsPanel`, `MonopolyPickerModal`, `YearOfPlentyPickerModal`); indicador de **metrópolis** en `PublicPlayersPanel`/`ConstructionTable`.
- **Fase D:** `KnightsPanel` (lista de caballeros con rango/estado, acciones build/activate/promote/action); `BarbarianTrack` (0–7, fuerza de defensa total vs ataque, contador de ataques); `BarbarianResolutionModal` (arbitraje del bank manager, espejo de `RobberFlow`/`DiscardModal`).
- **Fase E:** `WallControl` (construir muro, mostrar 0–3 y límite de mano resultante); integrar íconos definitivos cuando lleguen; corregir P0/P1 de `qa-auditor`.
- **Reglas del agente:** verificar `package.json` antes de librerías; sin emojis en markup (usar el sistema de glifos de `icons.tsx`); código completo sin placeholders; mobile-first; touch ≥44px.

### 9.3 `ux-writer` (copy en español + glosario)
- **Glosario C&K** (term canónico en español): Caballeros y Ciudades, mercancías (moneda/papel/tela), disciplinas (Comercio/Política/Ciencia), mejoras de ciudad, metrópolis, caballero (básico/fuerte/poderoso), activar/promover, barco bárbaro, ataque bárbaro, Defensor de Catán, muro de ciudad, casa de comercio, acueducto, fortaleza, cartas de progreso.
- **Por fase:** labels y ayudas del toggle (A); nombres y tooltips de mercancías y el caso grain/brick (B); textos del calendario, habilidades, cada carta de progreso, mensajes de límite 4 y descarte forzado, input de 3 dados (C); copy de la pista del bárbaro, resultado del ataque (repelido/saqueado), Defensor de Catán, estados de caballero, errores de "necesitas Fortaleza para promover a poderoso" (D); muros, empty states, notices prominentes (E).
- **Tono:** claro, breve, sin jerga innecesaria; mensajes de error accionables. Mantener consistencia con el copy base existente.

### 9.4 `visual-designer` (tema/paleta/íconos)
- **Fase A:** definir y afinar la **paleta condicional** `[data-mode="ck"]` (§6): calcular los stops reales del degradado del horizonte tormentoso, fijar `--ck-crimson/steel/horizon` y mercancías/disciplinas con **contraste AA verificado**; reflejar en `tailwind.config.js`, `playerColors.ts`, `icons.tsx`. Documentar en `docs/contrast-verification.md`.
- **Fase B–E:** estilos de las **mercancías** (marco/medallón que las separe de recursos), **chips de disciplina** (amarillo/azul/verde), aspecto de **metrópolis** (borde heráldico dorado/carmesí), **pista del bárbaro** (tensión visual, sin estridencia), **insignia Defensor de Catán** (coherente con el set de medallas existente).
- **Íconos:** mantener `missing-icons.md`; cuando Esteban entregue arte, integrarlo en `icons.tsx` (un único punto de cambio) con fallback emoji.

### 9.5 `motion-engineer` (micro-interacciones)
- Animar (respetando `prefers-reduced-motion`): **avance del barco bárbaro** paso a paso, **resolución del ataque** (repelido vs saqueo), **subida de nivel de mejora**/desbloqueo de habilidad, **ganar/arrebatar metrópolis**, **recepción de mercancías y de cartas de progreso**, **activación/promoción de caballero**, banner prominente de "¡Los bárbaros atacan!" con vibración (como el banner de "es tu turno").
- Coordinar con `ui-engineer` para que las animaciones cuelguen de los `notice`/`build:notify` ya existentes.

### 9.6 `qa-auditor` (calidad por fase)
- Auditar al cierre de cada fase: **WCAG AA** sobre la nueva paleta (carmesí/acero/horizonte sobre madera y océano), **responsive** 360–414px con los paneles nuevos (calendario, caballeros, pista bárbara), **touch ≥44px**, Core Web Vitals, anti-patterns. Verificar que el **modo base no se degradó**. Reportar **P0–P3** y corregir P0/P1.
- Casos especiales: que **manos/cartas ajenas nunca se filtren** (mercancías y cartas de progreso son privadas como la mano), igual que la garantía de privacidad existente.

---

## 10. Orquestación y dependencias entre agentes

- El **orquestador** entrega, al inicio de cada fase, el **contrato del server ya implementado** (eventos del §5 + forma de las vistas) para que los agentes trabajen contra algo real.
- Orden por fase: `ux-architect` (brief) → `ui-engineer` (implementación) + `visual-designer` (paleta/estilos en paralelo) → `ux-writer` (copy) → `motion-engineer` (animación) → `qa-auditor` (auditoría y P0/P1).
- Trabajo paralelizable: visual-designer y ux-writer pueden avanzar mientras ui-engineer construye; qa-auditor cierra.
- **Cada incremento funcional → commit** (sin PR; Esteban abrirá el PR).

---

## 11. Testing y criterios de aceptación

- **Unitarios (vitest, server):** producción con mercancías; costos/niveles de mejora y metrópolis; combate bárbaro (defensa vs ataque, empates, perdedores, Defensor); calendario (robo de carta por dado rojo ≤ nivel); límites (4 cartas de progreso, `7+2*walls`); inmovilización del ladrón hasta el primer ataque; victoria a 13.
- **Regresión:** **toda** la suite base sigue verde; el modo base no cambia de comportamiento.
- **Aceptación manual (4 jugadores):** partida C&K completa de extremo a extremo — producir mercancías, subir las 3 disciplinas, ganar/arrebatar metrópolis, construir/activar/promover caballeros, repeler y sufrir un ataque, jugar cartas de progreso, construir muros, ganar a 13 — con manos privadas intactas.
- **Build:** `cd server && npm run build` y `cd client && npm run build` sin errores; `npm test` verde.

---

## 12. 5–6 jugadores (posterior)

Cuando se aborde: permitir `citiesKnights && extension56`; bancos (recursos y mercancías) y mazos de progreso dimensionados para 6; **fase de construcción especial** compatible con acciones C&K (construir/mejorar/caballeros); revisar la regla del **segundo barco bárbaro** de la variante 5–6 (si se adopta) y el ajuste del límite de mano. Reusar `specialBuildQueue` existente. Mantener colores verde/café.

---

## 13. Decisiones abiertas (para confirmar con Esteban)

1. **Muro y saqueo:** ¿el muro **absorbe** el saqueo (se destruye en vez de reducir la ciudad) o solo aumenta el límite de mano? (Reglas oficiales: el muro **no** protege del saqueo; solo sube el límite de mano. Propuesta: seguir lo oficial, con nota.)
2. **Nivel de detalle de las cartas de progreso complejas** (Spy, Diplomat, Intrigue, Deserter): ¿flujo guiado completo en la app o registro asistido (la app arbitra cartas, la mesa mueve piezas)? Propuesta: registro asistido como el resto del asistente.
3. **Caballeros en el tablero:** la app **no** dibuja el tablero; ¿basta con contabilizar caballeros (rango/estado/cantidad) sin posiciones de intersección? Propuesta: **sí**, contabilidad sin geometría (coherente con que el tablero es físico).
4. **Movimientos/expulsiones de caballero:** al no haber geometría, ¿se registran como eventos arbitrados (log/notice) sin validar adyacencia? Propuesta: **sí**.
5. **Tela/papel/moneda — banco limitado vs ilimitado:** seguir la decisión vigente de **banco ilimitado informativo**. Confirmar.

> Mientras no se confirmen, el desarrollo asume las "Propuestas" anteriores y las marca como tales en el código (comentarios) para fácil ajuste.

---

## 14. Resumen ejecutable

1. **Fase A** primero (modo + paleta + victoria 13): pequeño, no rompe nada, da el "esqueleto" visible. → commit.
2. Luego **B → C → D → E** en incrementos, cada uno con su commit funcional, backend por el orquestador y frontend por los agentes según §9.
3. **5–6 jugadores** al final (§12).
4. Íconos provisionales reciclados; faltantes en `missing-icons.md`.
5. Sin PR — Esteban lo abre.
</content>
</invoke>
