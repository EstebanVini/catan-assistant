# Prompt para Claude Code — App Web de Asistente para Catán

> Copia y pega todo este archivo como primer mensaje a Claude Code. Está escrito para que construya la app por fases (MVP primero). Los identificadores de código van en inglés; la UI va en español.

---

## Contexto y objetivo

Quiero que construyas una **aplicación web mobile-first** que funcione como **asistente digital para partidas presenciales del juego de mesa Catán**. Debe soportar la **edición base (3–4 jugadores)** y la **extensión de 5–6 jugadores** (activable en el lobby). El tablero físico sigue existiendo; la app reemplaza el papel y las cartas de recursos para llevar la contabilidad sin trampas y de forma compartida en tiempo real.

Varios jugadores entran desde sus celulares a la **misma sesión** mediante un **código**. Todos ven un estado compartido que se actualiza al instante.

## Stack obligatorio

- **Backend:** Node.js + Express + **Socket.IO** para tiempo real. Estado de cada partida **en memoria** (un `Map` de `code -> GameState`). No uses base de datos en el MVP.
- **Frontend:** React + **Vite** + `socket.io-client`. Mobile-first. Estado global con Context o Zustand (tu elección, prefiero Zustand por simplicidad).
- **El backend sirve el frontend ya compilado.** Express debe servir los archivos estáticos de `client/dist` y tener un fallback SPA (`app.get('*', ...)`) para que las rutas de React funcionen. Un solo proceso, un solo comando para producción.
- TypeScript en ambos lados (preferido). Si te resulta más rápido y robusto, adelante.

## Estructura de proyecto sugerida

```
catan-assistant/
  package.json            # scripts raíz: dev, build, start
  server/
    index.js|ts           # Express + Socket.IO, sirve client/dist
    game/
      state.js|ts         # modelos y creación de GameState
      rules.js|ts         # lógica pura de Catán (costos, distribución, 7, robo)
      rooms.js|ts         # gestión de salas en memoria
    socket/
      handlers.js|ts      # registro de todos los eventos de Socket.IO
  client/
    index.html
    src/
      main.tsx
      socket.ts           # instancia única del cliente Socket.IO
      store.ts            # estado global (Zustand)
      screens/            # Home, Lobby, Game
      components/         # HandView, ProductionTable, DiceInput, Log, etc.
```

Scripts raíz deseados:
- `npm run dev` → corre server (nodemon) y client (vite) en paralelo, con proxy del cliente al server.
- `npm run build` → compila el client a `client/dist`.
- `npm start` → corre solo el server, que sirve `client/dist` (producción).

## Identidad y reconexión (importante, es móvil)

- No hay cuentas ni login. Al crear/unirse, el servidor asigna un `playerId` y un `sessionToken`. El cliente guarda `{ code, playerId, sessionToken }` en `localStorage`.
- Al recargar o si se cae la red del celular, el cliente reenvía esos datos y **recupera su identidad y su mano**. Maneja `disconnect`/`reconnect` de Socket.IO sin perder estado.
- Marca a los jugadores como `connected: true/false` y muéstralo en la UI, pero **no** elimines a un jugador desconectado de la partida.

---

## Modelo de datos (GameState)

```ts
type Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore';
type Hand = Record<Resource, number>; // conteos

interface Player {
  id: string;
  sessionToken: string;     // privado, no enviar a otros
  name: string;
  color: string;            // hex o nombre; único por partida
  connected: boolean;
  hand: Hand;               // PRIVADO: solo se envía al dueño
  cardCount: number;        // derivado, PÚBLICO (suma de hand)
  ports: Array<'3:1' | Resource>; // puertos activos del jugador
  devCards: { knights: number; vp: number; roadBuilding: number; yearOfPlenty: number; monopoly: number }; // privado, salvo conteos públicos opcionales
  knightsPlayed: number;    // público (para Ejército más grande)
  victoryPoints: { settlements: number; cities: number; longestRoad: boolean; largestArmy: boolean; hiddenVP: number };
}

// Cada ficha del tablero físico. El robo y el bloqueo del ladrón dependen de esto.
interface Hex {
  id: string;
  number: number | null;    // 2..12 (sin 7); null para desierto
  resource: Resource | null;// null para desierto
  robber: boolean;          // true si el ladrón está aquí -> NO produce
  owners: Array<{ playerId: string; type: 'settlement' | 'city' }>; // editable durante la partida
}

interface GameState {
  code: string;             // código de unión (4-6 chars, fácil de teclear, sin caracteres ambiguos)
  hostId: string;
  bankManagerId: string;    // quien ingresa el número del dado y reparte (por defecto = host)
  status: 'lobby' | 'playing' | 'ended';
  extension56: boolean;     // true = extensión 5-6 jugadores. Afecta máx. jugadores, banco, mazo y fase de construcción especial
  players: Player[];
  turnOrder: string[];      // ids en orden de juego
  currentTurnIndex: number;
  phase: 'roll' | 'discard' | 'robber' | 'main' | 'specialBuild'; // fase del turno actual
  specialBuildQueue: string[]; // solo extensión: ids pendientes de construir tras un turno (orden horario)
  hexes: Hex[];
  bank: Hand;               // inventario del banco: 19 por recurso (base) o 24 (extensión 5-6)
  diceStats: Record<number, number>; // cuántas veces salió cada número 2..12
  log: Array<{ id: string; ts: number; text: string }>;
  pendingDiscards: Record<string, number>; // playerId -> cuántas cartas debe descartar (fase discard)
  activeTrade?: TradeOffer; // intercambio en curso
  winnerId?: string;
}
```

**Regla de privacidad crítica:** el `hand` y las cartas de desarrollo de un jugador **solo** se envían a ese jugador. A los demás se les envía únicamente `cardCount` (el número total) y conteos públicos (caballeros jugados, puntos visibles). Implementa esto enviando a cada socket una **vista personalizada** del estado (oculta las manos ajenas) en lugar de difundir el estado crudo.

---

## Reglas de Catán que el servidor debe hacer cumplir (edición base)

Toda la lógica de reglas vive en el servidor (`rules.js`). El cliente nunca decide reglas, solo muestra y envía intenciones.

### Costos de construcción
- Camino: 1 lumber + 1 brick
- Poblado: 1 lumber + 1 brick + 1 wool + 1 grain
- Ciudad: 2 grain + 3 ore (mejora un poblado existente)
- Carta de desarrollo: 1 wool + 1 grain + 1 ore

Al construir: validar que el jugador tenga los recursos y que sea su turno; descontar de su mano y **devolver los recursos al banco**.

### Distribución de recursos al tirar
1. El bank manager (o el jugador activo, configurable) ingresa el número (2–12).
2. Incrementa `diceStats[number]`.
3. Si `number === 7`: ir a la secuencia del 7 (abajo). **No** se distribuyen recursos.
4. Si no: por cada `hex` donde `hex.number === number` y `hex.robber === false`, cada `owner` recibe del recurso del hex: **1** si es `settlement`, **2** si es `city`. Descontar del banco.
5. **Banco limitado:** si el banco no tiene suficientes cartas de un recurso para todos los que deberían recibirlo, sigue la regla oficial: si solo **un** jugador tiene derecho a ese recurso y no alcanza, recibe lo que quede; si son **varios** y no alcanza para todos, **nadie** de ellos recibe ese recurso. Aplica esto por recurso.
6. Registrar en el log qué recibió cada quién.

### Secuencia del 7
1. **Fase descarte:** todo jugador con `cardCount > 7` debe descartar `floor(cardCount / 2)` cartas. Las cartas de desarrollo **no** cuentan. Cada jugador afectado **elige él mismo** qué cartas dejar (qué recursos descartar) desde su propio celular. Pon `phase = 'discard'` y llena `pendingDiscards`. El turno no avanza hasta que todos terminen.
2. **Fase ladrón:** cuando los descartes terminan, `phase = 'robber'`. El jugador activo selecciona la `hex` donde pone el ladrón → poner `robber=true` ahí y `false` en la anterior.
3. **Robo:** se habilita el botón "Robar carta". El jugador activo elige a **uno** de los jugadores que son `owners` de esa hex (excluyéndose a sí mismo). El servidor toma **1 carta de recurso al azar** de la mano de ese objetivo y la pasa al jugador activo. Si el objetivo no tiene cartas de recurso, no pasa nada. Las cartas de desarrollo **no** se pueden robar.
4. Luego `phase = 'main'`.

> El botón "Robar carta" también debe poder dispararse al jugar una carta de Caballero (mismo flujo de ladrón + robo) en el turno del jugador.

### Intercambio (trade)
- **Solo en el turno del jugador activo.** El cliente debe deshabilitar las acciones de intercambio para los demás.
- **Con el banco / puertos:** 4:1 por defecto; 3:1 si el jugador tiene puerto genérico; 2:1 si tiene el puerto específico de ese recurso. Validar la proporción contra `player.ports`. Mover cartas entre la mano y el banco.
- **Entre jugadores:** el jugador activo crea una `TradeOffer { fromId, toId?, give: Partial<Hand>, receive: Partial<Hand> }`. El otro jugador acepta o rechaza desde su celular. Permite contraoferta (opcional pero deseable). Al aceptar, validar que ambos tengan las cartas y ejecutar el intercambio atómicamente.

### Cartas de desarrollo
- **Mazo según el modo (barajado al iniciar):**
  - Base (3-4): **25 cartas** → 14 Knight, 5 VP, 2 RoadBuilding, 2 YearOfPlenty, 2 Monopoly.
  - Extensión (5-6): **34 cartas** → 20 Knight, 5 VP, 3 RoadBuilding, 3 YearOfPlenty, 3 Monopoly.
- Comprar: paga 1 wool + 1 grain + 1 ore, roba la carta superior. **No se puede jugar la carta el mismo turno** en que se compra (excepto VP, que son automáticas/ocultas).
- Solo se juega en tu propio turno (las VP no se "juegan", suman en secreto).
- Efectos que el servidor ejecuta:
  - **Knight:** mover ladrón + robar (ver arriba). Incrementar `knightsPlayed`. Reevaluar Ejército más grande.
  - **Year of Plenty (Año de la abundancia):** el jugador toma 2 recursos cualquiera del banco.
  - **Monopoly (Monopolio):** el jugador nombra 1 recurso; todos los demás le entregan **todas** sus cartas de ese recurso. (Requiere lógica de servidor sobre todas las manos.)
  - **Road Building (Construcción de caminos):** el jugador construye 2 caminos gratis (descuenta 0 recursos; en esta app basta con registrar/permitir 2 construcciones de camino sin costo, ya que el tablero es físico).

### Puntos de victoria y fin de juego
- Poblado 1, Ciudad 2, Camino más largo (≥5) 2, Ejército más grande (≥3 caballeros, el mayor) 2, carta VP 1.
- **Camino más largo** y **Ejército más grande** son insignias transferibles: asigna/cambia automáticamente Ejército más grande según `knightsPlayed` (mínimo 3, se la queda quien tenga más; en empate la conserva el dueño previo). Camino más largo puede ser **asignación manual** por el bank manager (la longitud del camino se ve en el tablero físico), con la insignia mostrada para todos.
- Al alcanzar 10 puntos (incluyendo VP ocultas) **en su turno**, ese jugador puede declarar victoria → `status = 'ended'`, `winnerId`. Muestra pantalla de ganador.

### Extensión de 5–6 jugadores (cuando `extension56 === true`)

Activable desde el lobby. Cambia lo siguiente respecto a la base; **todo lo demás (costos, 7, ladrón, robo, puertos, victoria a 10) es igual**:

1. **Jugadores:** permite hasta **6**. Añade dos colores nuevos: **verde** y **café/marrón**. Cada jugador sigue teniendo 5 poblados, 4 ciudades y 15 caminos (eso es físico, no afecta la app).
2. **Banco:** el inventario inicial es **24 cartas de cada recurso** (en vez de 19). Deriva `bank` del modo al iniciar.
3. **Mazo de desarrollo:** 34 cartas (ver sección de cartas de desarrollo).
4. **Tablero más grande:** hay más fichas y puertos. Como la tabla de producción ya es una lista editable de `hexes`, **no requiere código especial**: el anfitrión simplemente agrega más fichas. No impongas un límite de fichas.
5. **Fase de Construcción Especial (la regla nueva más importante):**
   - Al terminar el turno del jugador activo (`turn:end`), **antes** de pasar al siguiente turno, se abre esta fase: `phase = 'specialBuild'`.
   - Llena `specialBuildQueue` con **todos los demás jugadores** en orden horario empezando por el que sigue al que acaba de jugar.
   - Cada jugador de la cola, **en orden**, puede **construir** (camino/poblado/ciudad) y **comprar** cartas de desarrollo con los recursos que ya tiene en mano. Cuando termina, pasa al siguiente con un evento de "listo".
   - **Prohibido en esta fase:** intercambiar (ni con banco/puertos ni entre jugadores) y **jugar** cartas de desarrollo (sí se pueden comprar, pero no jugar). Una carta de desarrollo comprada aquí tampoco se puede jugar hasta el propio turno del jugador.
   - El bank manager/host puede **saltar** a un jugador que se tarde (para no bloquear la partida).
   - Cuando `specialBuildQueue` queda vacía, avanza al siguiente turno normal (`phase = 'roll'`).
   - En partidas base (3-4) esta fase **no existe**: `turn:end` pasa directo al siguiente turno.

> Nota: existe una variante oficial más reciente ("turno de jugadores emparejados" / paired players) que reemplaza la fase de construcción especial. Implementa la **Fase de Construcción Especial** (la más conocida); puedes dejar comentado un punto de extensión por si más adelante quiero la variante emparejada.

---

## Contrato de eventos Socket.IO

Diseña eventos claros cliente→servidor y servidor→cliente. Sugerencia (ajústala como mejor funcione):

**Cliente → Servidor**
- `game:create { name }` → crea sala, devuelve `{ code, playerId, sessionToken, you }`
- `game:join { code, name }` → une, devuelve identidad
- `game:reconnect { code, playerId, sessionToken }`
- `lobby:setColor { color }`
- `lobby:setTurnOrder { orderedPlayerIds }` (solo host) — además permite que el orden inicial se decida tirando dados o arrastrando para reordenar
- `lobby:setBankManager { playerId }` (solo host)
- `lobby:setExtension56 { enabled }` (solo host, solo en lobby) — activa/desactiva la extensión 5-6; ajusta máx. jugadores (6), banco (24) y mazo (34)
- `game:start` (solo host)
- `hex:upsert { hex }` / `hex:addOwner { hexId, playerId, type }` / `hex:removeOwner {...}` — editar la tabla de producción durante la partida
- `player:setPorts { ports }`
- `turn:rollNumber { number }` (bank manager o jugador activo) — dispara distribución o secuencia del 7
- `discard:submit { resourcesToDiscard }`
- `robber:move { hexId }`
- `robber:steal { targetPlayerId }`
- `build { type: 'road'|'settlement'|'city'|'devcard' }` — valida y descuenta recursos
- `dev:play { card, payload }` (knight/monopoly/yearOfPlenty/roadBuilding)
- `trade:bank { give: Resource, receive: Resource }` — usa la mejor proporción según puertos
- `trade:offer { toId?, give, receive }` / `trade:respond { accept }`
- `turn:end` — en base pasa al siguiente turno; en extensión 5-6 abre la Fase de Construcción Especial
- `specialBuild:done` — el jugador en turno de la cola termina su construcción especial y pasa al siguiente
- `specialBuild:skip { playerId }` (bank manager/host) — salta a un jugador que se tarda en la fase especial
- `vp:setLongestRoad { playerId | null }` (manual, bank manager)
- `action:undo` (solo bank manager/host) — deshacer la última acción que modificó manos/banco
- `game:declareWin` (jugador activo si ≥10)

**Servidor → Cliente**
- `state:update { state }` — **vista personalizada** (oculta manos ajenas). Envía a cada socket lo que le corresponde ver.
- `you:hand { hand, devCards }` — la mano privada solo a su dueño (o inclúyela dentro de su vista personalizada).
- `error { message }`
- `toast { message }` — notificaciones ligeras (p. ej. "Es tu turno").

Implementa **undo** guardando snapshots ligeros del estado antes de cada acción mutadora (una pila de los últimos N estados), suficiente para revertir errores humanos comunes.

---

## Pantallas y UX (mobile-first)

Diseña para pantallas de celular: objetivos táctiles grandes (mín. 44px), una columna, navegación inferior, tipografía legible, contraste alto. Usa los colores de las piezas de cada jugador como acento de su identidad. Evita que el contenido importante quede tapado por el teclado.

### 1. Home
- Botón grande **"Crear partida"** (pide nombre) y **"Unirse"** (pide código + nombre).
- Si hay sesión guardada en `localStorage`, ofrece **"Reconectar"**.

### 2. Lobby
- Muestra el **código** grande y fácil de compartir (botón copiar).
- **Toggle "Extensión 5–6 jugadores"** (solo host). Al activarlo: permite hasta 6 jugadores, habilita los colores verde y café/marrón, y configura banco (24) y mazo (34). Muestra claramente si está activa.
- Lista de jugadores conectados, cada uno elige su **color** (no repetible). Paleta base: rojo, azul, blanco, naranja; con extensión se suman verde y café/marrón.
- **Orden de turnos:** arrastrar para reordenar, o botón "Decidir por dados". Visualiza claramente quién va después de quién.
- El host designa al **encargado del banco** (por defecto él).
- Botón **"Iniciar"** (solo host) cuando haya ≥3 jugadores con color (máx. 4 sin extensión, máx. 6 con extensión).

### 3. Pantalla de juego (la principal)
Layout sugerido con secciones colapsables/pestañas:

- **Barra superior:** de quién es el turno (resaltado con su color), fase actual, y tu rol (jugador / encargado del banco).
- **Tu mano (privada):** tus cartas por recurso con conteos grandes; botones +/- solo informativos (las modifica el sistema). Tus cartas de desarrollo.
- **Acciones (solo activas en tu turno):**
  - Botones de construir (Camino / Poblado / Ciudad / Carta de desarrollo) con su costo; deshabilitados si no alcanza, con feedback de por qué.
  - Intercambio con banco/puerto y con jugadores.
  - Jugar carta de desarrollo.
  - "Terminar turno".
- **Panel del encargado del banco:** teclado numérico grande para ingresar el número del dado (2–12) y repartir. Botón de **deshacer**.
- **Tabla de producción (visible para todos):** lista de fichas (`hexes`) con su número, recurso (ícono/color) y quién tiene poblado/ciudad. Editable: agregar/quitar dueños y marcar tipo. Indicador visual de la ficha con el **ladrón**.
- **Estado público de jugadores:** para cada jugador, su color, **número total de cartas** (no el tipo), puertos activos, caballeros jugados, e insignias (Camino más largo / Ejército más grande). Marcador de puntos de victoria (los visibles).
- **Secuencia del 7:** cuando aplique, UI clara para descartar (cada quién en su pantalla), luego para que el jugador activo coloque el ladrón y use **"Robar carta"** eligiendo objetivo.
- **Fase de Construcción Especial (solo extensión 5-6):** banner claro indicando "Construcción especial: turno de [jugador]". El jugador en turno de la cola ve sus botones de construir/comprar habilitados (intercambio y jugar desarrollo deshabilitados) y un botón **"Listo"**. Los demás ven a quién le toca y su posición en la cola.
- **Registro (log):** historial cronológico de acciones, visible para todos (anti-trampas).
- **Estadísticas de dados:** mini-histograma de qué números han salido.

Añade **vibración + toast** cuando empieza el turno de un jugador en su propio dispositivo.

---

## Prioridades de implementación (constrúyelo en este orden)

**Fase 1 — MVP jugable**
1. Backend con salas en memoria, Socket.IO, vistas personalizadas (ocultar manos ajenas), y Express sirviendo el client.
2. Home → crear/unirse con código → Lobby (colores, orden de turnos, encargado del banco) → Iniciar.
3. Reconexión por `localStorage`.
4. Tabla de producción editable (hexes con dueños) y puertos por jugador.
5. Ingreso del número por el banco → distribución automática de recursos (con banco limitado).
6. Mano privada por jugador + conteo público de cartas.
7. Turnos: solo el jugador activo puede intercambiar/construir; "Terminar turno".
8. Secuencia del 7 completa: descarte elegido por cada jugador + mover ladrón + **botón Robar carta** (robo aleatorio).
9. Intercambio con banco/puertos y entre jugadores (oferta/aceptar).
10. Construcción que descuenta recursos. Registro (log) y **deshacer**.

**Fase 2 — Recomendadas**
11. Cartas de desarrollo completas (mazo, comprar, Knight/Monopoly/Year of Plenty/Road Building) y conteo de caballeros.
12. Marcador de puntos de victoria + insignias (Ejército más grande automático, Camino más largo manual) + declarar victoria a 10.
13. **Extensión 5–6 jugadores:** toggle en lobby, hasta 6 jugadores + colores verde/café, banco 24, mazo 34, y **Fase de Construcción Especial** tras cada turno. Diseña desde el inicio el flujo de turnos para que insertar esta fase no requiera reescribir la lógica.
14. Estadísticas de dados (histograma).
15. Notificación/vibración de turno.

**Fase 3 — Futuro (deja ganchos, no lo implementes ahora)**
15. Tomar **foto del tablero** y autocompletar los `hexes` (números, recursos y dueños) por visión. Diseña el modelo de `hexes` para que esto encaje sin reescribir nada.

---

## Calidad y entregables

- Código limpio, lógica de reglas en módulos puros y testeables; idealmente unos tests unitarios de `rules.js` (distribución, costos, 7, robo, banco limitado).
- Maneja errores y casos límite con mensajes claros al usuario (no alcanza, no es tu turno, color repetido, etc.).
- README con instrucciones: `npm install`, `npm run dev` (desarrollo), `npm run build` + `npm start` (producción en un solo proceso/puerto).
- Mobile-first real: pruébalo mentalmente en 360–414px de ancho.

Empieza por la **Fase 1** y ve mostrándome el avance por partes para que pueda probar antes de seguir.
