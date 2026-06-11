# Prompt para Claude Code — App Web de Asistente para Catán

> Copia y pega todo este archivo como primer mensaje a Claude Code. Está escrito para que construya la app por fases (MVP primero). Los identificadores de código van en inglés; la UI va en español.

---

## Contexto y objetivo

Quiero que construyas una **aplicación web mobile-first** que funcione como **asistente digital para partidas presenciales del juego de mesa Catán**. Debe soportar la **edición base (3–4 jugadores)** y la **extensión de 5–6 jugadores** (activable en el lobby). El tablero físico sigue existiendo; la app reemplaza el papel y las cartas de recursos para llevar la contabilidad sin trampas y de forma compartida en tiempo real.

Varios jugadores entran desde sus celulares a la **misma sesión** mediante un **código**. Todos ven un estado compartido que se actualiza al instante.

## Stack obligatorio

- **Backend:** Node.js + Express + **Socket.IO** para tiempo real. El **estado en vivo de cada partida** vive **en memoria** (un `Map` de `code -> GameState`) por velocidad; **MongoDB** se usa para lo que debe persistir entre sesiones (usuarios, historial de partidas, estadísticas).
- **Base de datos:** **MongoDB** (driver oficial `mongodb` o **Mongoose**, tu elección; prefiero Mongoose por los esquemas). Se levanta con Docker (ver sección Docker). La URL de conexión va por variable de entorno `MONGODB_URI`.
- **Autenticación:** cuentas de usuario con **login simple basado en JWT**. Las contraseñas se guardan **hasheadas con sal** usando **bcrypt** (`bcryptjs` o `bcrypt`; bcrypt ya incorpora la sal en el hash) — **nunca** en texto plano. El JWT se firma con `JWT_SECRET` (variable de entorno) y se envía en el `Authorization: Bearer <token>` o se pasa en el handshake de Socket.IO (`auth.token`).
- **Frontend:** React + **Vite** + `socket.io-client`. Mobile-first. Estado global con Context o Zustand (tu elección, prefiero Zustand por simplicidad).
- **El backend sirve el frontend ya compilado.** Express debe servir los archivos estáticos de `client/dist` y tener un fallback SPA (`app.get('*', ...)`) para que las rutas de React funcionen. Un solo proceso, un solo comando para producción.
- TypeScript en ambos lados (preferido). Si te resulta más rápido y robusto, adelante.
- **Toda la app (cliente, servidor y MongoDB) se levanta con `docker compose up`** (ver sección Docker y Docker Compose).

## Estructura de proyecto sugerida

```
catan-assistant/
  package.json            # scripts raíz: dev, build, start
  docker-compose.yml      # levanta mongo + server (+ build del client)
  .env.example            # MONGODB_URI, JWT_SECRET, PORT, etc.
  server/
    Dockerfile            # imagen del backend (multi-stage: build client + server)
    index.js|ts           # Express + Socket.IO, sirve client/dist
    db/
      connection.js|ts    # conexión a MongoDB (Mongoose), lee MONGODB_URI
      models/
        User.js|ts        # esquema de usuario (perfil, stats, credenciales)
        Match.js|ts       # historial de partidas terminadas (resultados, ganador)
    auth/
      auth.js|ts          # registro/login: hash+sal (bcrypt), firma/verifica JWT
      middleware.js|ts    # middleware Express + guard del handshake Socket.IO
    game/
      state.js|ts         # modelos y creación de GameState
      rules.js|ts         # lógica pura de Catán (costos, distribución, 7, robo)
      rooms.js|ts         # gestión de salas en memoria
      setup.js|ts         # construcciones iniciales -> recursos de inicio
    socket/
      handlers.js|ts      # registro de todos los eventos de Socket.IO
  client/
    Dockerfile            # (opcional) imagen para servir el client en dev
    index.html
    src/
      main.tsx
      socket.ts           # instancia única del cliente Socket.IO (envía el JWT)
      store.ts            # estado global (Zustand)
      api.ts              # llamadas REST de auth (register/login)
      screens/            # Login, Home, Lobby, Game, Profile
      components/         # HandView, ProductionTable, DiceInput, Log, InitialBuildSetup, etc.
```

Scripts raíz deseados:
- `npm run dev` → corre server (nodemon) y client (vite) en paralelo, con proxy del cliente al server.
- `npm run build` → compila el client a `client/dist`.
- `npm start` → corre solo el server, que sirve `client/dist` (producción).

## Cuentas, identidad y reconexión (importante, es móvil)

- **Hay cuentas de usuario con login simple (JWT).** El usuario se registra/inicia sesión con `username` (o email) + contraseña; el cliente guarda el **JWT** en `localStorage` y lo manda en cada conexión de Socket.IO (`auth.token`) y en las llamadas REST. Con el token, el servidor sabe **quién** es sin pedir nombre de nuevo.
- **Permite también jugar como invitado (opcional):** si no hay token, el flujo de crear/unirse sigue funcionando pidiendo solo un `name` (sin persistir stats). Útil para alguien que no quiere registrarse en la mesa. Un invitado **no** acumula victorias ni perfil.
- Al crear/unirse, el servidor asigna un `playerId` y un `sessionToken` de **esa partida** (independiente del JWT). El cliente guarda `{ code, playerId, sessionToken }` en `localStorage` para reconectar a la sala.
- Al recargar o si se cae la red del celular, el cliente reenvía esos datos y **recupera su identidad y su mano**. Maneja `disconnect`/`reconnect` de Socket.IO sin perder estado. Si además hay JWT, el `Player` queda vinculado a su `userId`.
- Marca a los jugadores como `connected: true/false` y muéstralo en la UI, pero **no** elimines a un jugador desconectado de la partida.
- Al **terminar** una partida (`status = 'ended'`), persiste el resultado en MongoDB y actualiza las **estadísticas** de los usuarios registrados que participaron (victorias, partidas jugadas, etc.).

---

## Modelo de datos (GameState)

```ts
type Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore';
type Hand = Record<Resource, number>; // conteos

// Una construcción inicial registrada por el jugador en el lobby.
// Representa un poblado/ciudad colocado en el tablero físico durante la fase de colocación.
interface InitialBuilding {
  id: string;
  type: 'settlement' | 'city';       // en la colocación inicial normalmente 'settlement'
  // Cada construcción toca 1..3 fichas; el jugador registra el número y recurso de cada una.
  spots: Array<{ number: number; resource: Resource }>; // p. ej. [{number:6,resource:'ore'},{number:9,resource:'wool'}]
  grantsStartingResources: boolean;  // true para el SEGUNDO poblado: otorga recursos al iniciar (regla oficial)
}

interface Player {
  id: string;
  userId?: string;          // _id del User en MongoDB si está autenticado; ausente si juega como invitado
  sessionToken: string;     // privado, no enviar a otros
  name: string;
  avatarUrl?: string;       // foto de perfil del usuario (PÚBLICA en la partida), si está registrado
  color: string;            // hex o nombre; único por partida
  connected: boolean;
  initialBuildings: InitialBuilding[]; // construcciones iniciales registradas en el lobby (ver setup)
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

## Usuarios, autenticación y persistencia (MongoDB)

El estado en vivo de la partida sigue en memoria; MongoDB guarda **usuarios** y **resultados de partidas**.

### Modelo `User` (colección `users`)

```ts
interface User {
  _id: string;
  username: string;          // único, índice único
  email?: string;            // opcional, único si se provee
  passwordHash: string;      // bcrypt (incluye la sal); NUNCA texto plano
  displayName: string;       // nombre visible en la mesa (editable)
  avatarUrl?: string;        // foto de perfil (URL); ver nota de almacenamiento abajo
  color?: string;            // color preferido (se intenta usar en el lobby si está libre)
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;          // partidas terminadas en las que participó y no ganó
    longestRoadBadges: number;
    largestArmyBadges: number;
    totalVictoryPoints: number; // acumulado histórico (opcional, para promedios)
  };
  createdAt: Date;
  updatedAt: Date;
}
```

> **Foto de perfil:** para el MVP basta con guardar una `avatarUrl` (el usuario pega una URL o se usa un avatar generado). Si quieres subida real de archivos, deja el gancho: endpoint `POST /api/users/me/avatar` que reciba la imagen (multipart) y la guarde en disco/volumen montado o en un bucket, devolviendo la URL. No bloquees el MVP con esto.

### Modelo `Match` (colección `matches`)

```ts
interface Match {
  _id: string;
  code: string;              // código de la sala
  extension56: boolean;
  startedAt: Date;
  endedAt: Date;
  winner: { userId?: string; name: string };
  players: Array<{
    userId?: string;         // ausente si era invitado
    name: string;
    color: string;
    victoryPoints: number;
    longestRoad: boolean;
    largestArmy: boolean;
    knightsPlayed: number;
  }>;
}
```

### Flujo de autenticación (JWT + bcrypt)

- `POST /api/auth/register { username, password, displayName?, email? }`
  - Valida que `username` no exista. Hashea la contraseña con **bcrypt** (`bcrypt.hash(password, saltRounds)`, p. ej. 10–12 rounds — la sal queda dentro del hash). Crea el `User` con `stats` en cero. Devuelve `{ token, user }` (sin `passwordHash`).
- `POST /api/auth/login { username, password }`
  - Busca el usuario, compara con `bcrypt.compare`. Si coincide, firma un **JWT** (`jwt.sign({ sub: user._id, username }, JWT_SECRET, { expiresIn: '30d' })`). Devuelve `{ token, user }`.
- `GET /api/users/me` (requiere JWT) → devuelve el perfil propio (sin `passwordHash`).
- `PATCH /api/users/me` (requiere JWT) → editar `displayName`, `avatarUrl`, `color`, etc.
- **Middleware de auth:** verifica el `Authorization: Bearer <token>` en REST y el `socket.handshake.auth.token` en Socket.IO. En Socket.IO, si el token es válido, adjunta `socket.data.userId`; si no hay token, el socket sigue permitido como **invitado**.
- **Nunca** devuelvas `passwordHash` ni la sal al cliente. Maneja errores con mensajes claros ("usuario ya existe", "credenciales inválidas").

### Persistencia de resultados

- Al declarar victoria (`status = 'ended'`), crea un documento `Match` y, para cada jugador con `userId`, incrementa atómicamente sus `stats` (`$inc`): `gamesPlayed`, `wins`/`losses`, insignias y VP. Los invitados (sin `userId`) se guardan en `Match.players` pero no actualizan ningún `User`.

---

## Reglas de Catán que el servidor debe hacer cumplir (edición base)

Toda la lógica de reglas vive en el servidor (`rules.js`). El cliente nunca decide reglas, solo muestra y envía intenciones.

### Colocación inicial y recursos de inicio (registro de construcciones iniciales)

En Catán físico, cada jugador coloca **2 poblados y 2 caminos** al empezar, y el **segundo poblado** otorga recursos de inicio (1 carta por cada ficha adyacente a ese poblado). Como el tablero es físico, la app no decide dónde se coloca: **cada jugador registra sus construcciones iniciales desde su celular en el lobby** y el servidor reparte los recursos correspondientes al iniciar.

1. **En el lobby**, antes de iniciar, cada jugador llena su **registro de construcciones iniciales** (`player.initialBuildings`): para cada uno de sus 2 poblados, registra las **fichas que toca** indicando el **número (2–12)** y el **recurso** de cada una (un poblado toca 1, 2 o 3 fichas; el desierto no se registra). Marca **cuál es el segundo poblado** (`grantsStartingResources = true`).
2. **Validación del servidor:** cada jugador debe registrar exactamente **2 poblados** y marcar **uno solo** como el que otorga recursos de inicio, antes de que el host pueda iniciar. Los números deben ser válidos (2–12, sin 7).
3. **Al iniciar (`game:start`):** por cada `spot` del poblado marcado con `grantsStartingResources`, el jugador recibe **1 carta** de ese recurso (descontándola del banco, respetando el inventario). Registra en el log "Recursos de inicio de [jugador]".
4. **Sembrar la tabla de producción:** con todas las construcciones iniciales registradas, **rellena automáticamente `hexes`** (crea/une las fichas por `number`+`resource` y agrega a cada jugador como `owner` tipo `settlement`). Así, durante la partida los jugadores **reciben materiales según vaya saliendo cada número** sin tener que editar la tabla a mano. La tabla sigue siendo editable después (para construir más, mejorar a ciudad, etc.).
5. Si dos fichas distintas comparten número (posible en la extensión), trátalas como `hexes` separados; ambas producen cuando sale ese número.

> Implementa la lógica de sembrado y reparto inicial en `server/game/setup.js`, como función pura testeable que toma los `initialBuildings` de todos y devuelve los `hexes` iniciales + el reparto de recursos de inicio.

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

Diseña eventos claros cliente→servidor y servidor→cliente. Sugerencia (ajústala como mejor funcione).

> **Auth:** el registro/login se hace por **REST** (`/api/auth/register`, `/api/auth/login`, ver sección de Usuarios), no por Socket.IO. El cliente conecta el socket pasando el JWT en `auth: { token }`; el servidor lo verifica en el middleware y adjunta `socket.data.userId` (o lo trata como invitado si no hay token).

**Cliente → Servidor**
- `game:create { name }` → crea sala, devuelve `{ code, playerId, sessionToken, you }`
- `game:join { code, name }` → une, devuelve identidad
- `game:reconnect { code, playerId, sessionToken }`
- `lobby:setColor { color }`
- `lobby:setTurnOrder { orderedPlayerIds }` (solo host) — además permite que el orden inicial se decida tirando dados o arrastrando para reordenar
- `lobby:setBankManager { playerId }` (solo host)
- `lobby:setInitialBuildings { initialBuildings }` — el jugador registra/actualiza sus 2 poblados iniciales (número + recurso de cada ficha, y cuál es el 2º que da recursos). El servidor valida.
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
- `admin:giveCard { targetPlayerId, kind: 'resource'|'dev', resource?, devCard? }` (solo host/bank manager) — entrega manualmente **en cualquier momento** una carta de recurso o de desarrollo a cualquier jugador (correcciones, casos especiales, repartos manuales). Descuenta del banco/mazo si hay; si no, permite forzarlo (configurable). **Siempre** genera un evento público y un `toast` a **todos** (anti-trampas, ver abajo).
- `action:undo` (solo bank manager/host) — deshacer la última acción que modificó manos/banco
- `game:declareWin` (jugador activo si ≥10)

**Servidor → Cliente**
- `state:update { state }` — **vista personalizada** (oculta manos ajenas). Envía a cada socket lo que le corresponde ver.
- `you:hand { hand, devCards }` — la mano privada solo a su dueño (o inclúyela dentro de su vista personalizada).
- `error { message }`
- `toast { message }` — notificaciones ligeras (p. ej. "Es tu turno").
- `notice { level: 'info'|'warn', text }` — **notificación pública prominente a todos los jugadores**. Úsala para acciones manuales del admin/banco que deben ser transparentes, p. ej. cuando el banco entrega una carta a alguien (`admin:giveCard`): *"⚠️ El banco entregó 1 trigo a Ana"*. Toda entrega manual queda **también** en el `log`. La idea es que ningún reparto manual sea secreto: si el banco se equivoca o intenta hacer trampa, **toda la mesa lo ve**.

Implementa **undo** guardando snapshots ligeros del estado antes de cada acción mutadora (una pila de los últimos N estados), suficiente para revertir errores humanos comunes.

---

## Estética y diseño visual (tema Catán)

La app debe **sentirse como estar dentro de Catán**, no como una utilidad genérica. Toma toda la dirección visual del propio juego.

- **Ambiente "dentro del juego":** el **fondo** de la app es un **océano** (el mar que rodea el tablero de Catán): un azul profundo con textura/olas suaves, idealmente un degradado o una ilustración sutil que evoque el agua. Puede tener un leve movimiento/parallax muy discreto, pero **nunca** debe distraer ni competir con el contenido. Opcionalmente, bordes/marcos que recuerden las piezas de costa hexagonales.
- **Legibilidad por encima de todo (cuidado con el fondo):** todos los elementos de UI (tarjetas, paneles, texto, botones) deben ir sobre **superficies semiopacas/sólidas** (paneles tipo "pergamino"/madera claros, o tarjetas con sombra y suficiente contraste) para que **nada se pierda contra el océano**. Garantiza contraste **WCAG AA** mínimo en texto y controles. Nada de texto claro flotando directamente sobre el agua.
- **Paleta tomada de Catán:**
  - **Recursos:** brick = terracota/rojo arcilla, lumber = verde bosque, wool = verde claro/lima de pastura, grain = amarillo dorado/trigo, ore = gris pizarra/azulado. Usa estos colores de forma consistente en íconos, fichas y conteos de mano.
  - **Colores de jugador:** rojo, azul, blanco, naranja (+ verde y café/marrón en extensión), como en las piezas reales.
  - **Neutros / superficies:** tonos madera y arena/pergamino para paneles; mar (azules) para fondo; acentos en dorado para títulos/insignias (Camino más largo / Ejército más grande).
- **Tipografía con carácter:** un titular con aire de mapa/aventura (serif o display temática) para encabezados y el código de sala; una sans legible para datos y números. Sin exagerar: la legibilidad manda.
- **Íconos de recursos y cartas (reemplazar los actuales):** los íconos actuales **no** gustan; cámbialos. En orden de preferencia:
  1. **Arte de las cartas de Catán** (carátulas de las cartas de recurso y de desarrollo) como imágenes de los recursos/cartas. Si las usas, guárdalas en `client/src/assets/cards/` y respeta que sean para uso personal/no comercial; documenta la fuente.
  2. Si no consigues el arte oficial, usa un **set de íconos temáticos** (estilo ilustrado: ladrillo, tronco/árbol, oveja, espiga de trigo, roca/mena; y para desarrollo: caballero, punto de victoria, monopolio, año de la abundancia, construcción de caminos) — por ejemplo de bibliotecas de íconos libres (game-icons.net u similar, con licencia compatible). Mantén un estilo uniforme entre todos.
  3. **Como último recurso, emojis** consistentes: 🧱 brick, 🌲 lumber, 🐑 wool, 🌾 grain, ⛰️ ore; desarrollo: ⚔️ caballero, 🏆 punto de victoria, 💰 monopolio, 🎁 año de la abundancia, 🛤️ construcción de caminos.
  - Centraliza la asignación recurso/carta → asset en un solo módulo (p. ej. `client/src/assets/icons.ts`) para poder intercambiar el set sin tocar los componentes. Provee un **fallback** (emoji) por si una imagen no carga.
- **Microdetalle temático:** botones que recuerden madera/piedra, el ladrón con su ícono, insignias con aspecto de medalla/sello. Animaciones suaves al repartir cartas o al cambiar de turno, sin sacrificar rendimiento en celulares.

> Mantén un tema CSS centralizado (variables CSS o tokens de Tailwind) con la paleta y las superficies, para que toda la app sea coherente y fácil de ajustar.

## Pantallas y UX (mobile-first)

Diseña para pantallas de celular: objetivos táctiles grandes (mín. 44px), una columna, navegación inferior, tipografía legible, contraste alto. Usa los colores de las piezas de cada jugador como acento de su identidad. Evita que el contenido importante quede tapado por el teclado. **Aplica el tema visual de la sección anterior (océano + paleta Catán) en todas las pantallas.**

### 1. Home
- Botón grande **"Crear partida"** (pide nombre) y **"Unirse"** (pide código + nombre).
- Si hay sesión guardada en `localStorage`, ofrece **"Reconectar"**.

### 2. Lobby
- Muestra el **código** grande y fácil de compartir (botón copiar).
- **Toggle "Extensión 5–6 jugadores"** (solo host). Al activarlo: permite hasta 6 jugadores, habilita los colores verde y café/marrón, y configura banco (24) y mazo (34). Muestra claramente si está activa.
- Lista de jugadores conectados, cada uno elige su **color** (no repetible). Paleta base: rojo, azul, blanco, naranja; con extensión se suman verde y café/marrón.
- **Orden de turnos:** arrastrar para reordenar, o botón "Decidir por dados". Visualiza claramente quién va después de quién.
- El host designa al **encargado del banco** (por defecto él).
- **Registro de construcciones iniciales (cada jugador, en su celular):** un formulario claro donde cada quien registra sus **2 poblados** de salida. Para cada poblado, agrega las fichas que toca con su **número** (selector 2–12) y su **recurso** (íconos: brick/lumber/wool/grain/ore). Un botón **"Marcar como mi 2º poblado (recibe recursos al iniciar)"** indica cuál otorga los recursos de inicio. Muestra un check verde cuando el registro del jugador está completo y válido (2 poblados, 1 marcado). El host ve el progreso de todos ("3/4 listos"). Hazlo a prueba de errores: números grandes y táctiles, no permitir 7, no permitir más de un poblado marcado como inicial.
- Botón **"Iniciar"** (solo host) **habilitado solo cuando** haya ≥3 jugadores con color **y todos hayan completado su registro de construcciones iniciales** (máx. 4 sin extensión, máx. 6 con extensión). Al iniciar, el servidor reparte los recursos del 2º poblado y siembra la tabla de producción (ver "Colocación inicial y recursos de inicio").

### 3. Pantalla de juego (la principal)
Layout sugerido con secciones colapsables/pestañas:

- **Barra superior:** de quién es el turno (resaltado con su color), fase actual, y tu rol (jugador / encargado del banco).
- **Tu mano (privada):** tus cartas por recurso con conteos grandes; botones +/- solo informativos (las modifica el sistema). Tus cartas de desarrollo.
- **Acciones (solo activas en tu turno):**
  - Botones de construir (Camino / Poblado / Ciudad / Carta de desarrollo) con su costo; deshabilitados si no alcanza, con feedback de por qué.
  - Intercambio con banco/puerto y con jugadores.
  - Jugar carta de desarrollo.
  - "Terminar turno".
- **Panel del encargado del banco:** teclado numérico grande para ingresar el número del dado (2–12) y repartir. Botón de **deshacer**. **"Entregar carta" (solo admin/banco):** selector de jugador + elegir recurso (los 5) o carta de desarrollo, y confirmar; entrega la carta **en cualquier momento** (no solo en su turno). Al confirmar, **todos** reciben una notificación prominente (`notice`) y queda en el log. Pensado para correcciones y casos especiales, con total transparencia anti-trampas.
- **Tabla de producción (visible para todos, colapsable):** lista de fichas (`hexes`) con su número, recurso (ícono/color) y quién tiene poblado/ciudad. Editable: agregar/quitar dueños y marcar tipo. Indicador visual de la ficha con el **ladrón**. Incluye un botón de **ocultar/mostrar** (toggle) para **colapsarla y liberar la vista** cuando la mesa no la necesite, de modo que la pantalla no se sature; recuerda el estado (colapsada/expandida) por dispositivo. Aplica el mismo patrón colapsable a otras secciones densas si ayuda a despejar la vista en celular.
- **Estado público de jugadores:** para cada jugador, su color, **número total de cartas** (no el tipo), puertos activos, caballeros jugados, e insignias (Camino más largo / Ejército más grande). Marcador de puntos de victoria (los visibles).
- **Secuencia del 7:** cuando aplique, UI clara para descartar (cada quién en su pantalla), luego para que el jugador activo coloque el ladrón y use **"Robar carta"** eligiendo objetivo.
- **Fase de Construcción Especial (solo extensión 5-6):** banner claro indicando "Construcción especial: turno de [jugador]". El jugador en turno de la cola ve sus botones de construir/comprar habilitados (intercambio y jugar desarrollo deshabilitados) y un botón **"Listo"**. Los demás ven a quién le toca y su posición en la cola.
- **Registro (log):** historial cronológico de acciones, visible para todos (anti-trampas).
- **Estadísticas de dados:** mini-histograma de qué números han salido.

Añade **vibración + toast** cuando empieza el turno de un jugador en su propio dispositivo.

---

## Prioridades de implementación (constrúyelo en este orden)

**Fase 0 — Infraestructura (base para lo demás)**
0a. **Docker + docker-compose** para mongo y el server; `.env.example`. Que `docker compose up -d mongo` y `npm run dev` funcionen de inmediato.
0b. **MongoDB + auth:** modelos `User`/`Match`, registro/login con **bcrypt (hash+sal)** y **JWT**, middleware REST y guard del handshake de Socket.IO (con modo invitado).

**Fase 1 — MVP jugable**
1. Backend con salas en memoria, Socket.IO, vistas personalizadas (ocultar manos ajenas), y Express sirviendo el client.
2. Pantalla de **Login/registro** (o entrar como invitado) → Home → crear/unirse con código → Lobby (colores, orden de turnos, encargado del banco, **registro de construcciones iniciales**) → Iniciar.
3. Reconexión por `localStorage` (token JWT + datos de sala).
4. **Registro de construcciones iniciales:** reparto de recursos del 2º poblado al iniciar y **sembrado automático** de la tabla de producción.
5. Tabla de producción editable (hexes con dueños) y puertos por jugador.
6. Ingreso del número por el banco → distribución automática de recursos (con banco limitado).
7. Mano privada por jugador + conteo público de cartas.
8. Turnos: solo el jugador activo puede intercambiar/construir; "Terminar turno".
9. Secuencia del 7 completa: descarte elegido por cada jugador + mover ladrón + **botón Robar carta** (robo aleatorio).
10. Intercambio con banco/puertos y entre jugadores (oferta/aceptar).
11. Construcción que descuenta recursos. Registro (log) y **deshacer**.

**Fase 2 — Recomendadas**
12. Cartas de desarrollo completas (mazo, comprar, Knight/Monopoly/Year of Plenty/Road Building) y conteo de caballeros.
13. Marcador de puntos de victoria + insignias (Ejército más grande automático, Camino más largo manual) + declarar victoria a 10.
14. **Persistencia de resultados y perfil:** al terminar, guardar el `Match` y actualizar `stats` de los usuarios. Pantalla de **perfil** (foto, victorias, partidas jugadas).
15. **Tema visual Catán:** fondo océano, paleta del juego, superficies legibles y **nuevos íconos** de recursos y cartas de desarrollo (arte de cartas / set temático / emojis como fallback), centralizados para intercambiarlos fácil. Aplícalo a todas las pantallas.
16. **Entrega manual de cartas por el admin/banco** (`admin:giveCard`) con **notificación pública** a todos (anti-trampas) y registro en log.
17. **Tabla de producción colapsable** (y otras secciones densas) para liberar la vista en celular.
18. **Extensión 5–6 jugadores:** toggle en lobby, hasta 6 jugadores + colores verde/café, banco 24, mazo 34, y **Fase de Construcción Especial** tras cada turno. Diseña desde el inicio el flujo de turnos para que insertar esta fase no requiera reescribir la lógica.
19. Estadísticas de dados (histograma).
20. Notificación/vibración de turno.

**Fase 3 — Futuro (deja ganchos, no lo implementes ahora)**
21. Tomar **foto del tablero** y autocompletar los `hexes` (números, recursos y dueños) por visión. Diseña el modelo de `hexes` para que esto encaje sin reescribir nada.

---

## Docker y Docker Compose

Todo debe poder levantarse con Docker, tanto la **base de datos** como el **proyecto**.

- **`docker-compose.yml`** con al menos dos servicios:
  - **`mongo`**: imagen oficial `mongo:7` (o similar). Expone el puerto `27017`, usa un **volumen** nombrado para persistir datos (`mongo-data:/data/db`), y credenciales por variables (`MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`). `restart: unless-stopped`.
  - **`server`**: construido desde `server/Dockerfile`. Depende de `mongo` (`depends_on`), lee `MONGODB_URI`, `JWT_SECRET` y `PORT` del entorno (`env_file: .env`), expone el puerto de la app (p. ej. `3001`). Sirve el client compilado (un solo proceso en producción).
  - (Opcional) un servicio **`client`** solo para desarrollo con Vite en modo host; en producción no hace falta porque el `server` ya sirve `client/dist`.
- **`server/Dockerfile`** **multi-stage**: una etapa instala dependencias y **compila el client** (`npm run build`) y el server (TS→JS); la etapa final copia `client/dist` + el server compilado y corre `npm start`. Imagen base `node:20-alpine`. Usuario no-root.
- **`.env.example`** con todas las variables necesarias y valores de ejemplo (sin secretos reales): `MONGODB_URI`, `JWT_SECRET`, `PORT`, credenciales de mongo. El `.env` real va en `.gitignore`.
- **Dos modos de uso documentados en el README:**
  - **Solo la base de datos en Docker** (para desarrollo local del código fuera de contenedor): `docker compose up -d mongo`, y luego `npm run dev` apuntando `MONGODB_URI` a `localhost:27017`.
  - **Todo en Docker** (la app completa + mongo): `docker compose up --build`.
- Añade un **`.dockerignore`** (node_modules, dist, .env, etc.) para imágenes ligeras.
- Scripts raíz útiles: `docker compose up`, `docker compose down`, y opcionalmente `npm run docker:db` para levantar solo mongo.

## Calidad y entregables

- Código limpio, lógica de reglas en módulos puros y testeables; idealmente unos tests unitarios de `rules.js` (distribución, costos, 7, robo, banco limitado).
- Maneja errores y casos límite con mensajes claros al usuario (no alcanza, no es tu turno, color repetido, etc.).
- README con instrucciones: `npm install`, copiar `.env.example` a `.env`, levantar mongo (`docker compose up -d mongo`), `npm run dev` (desarrollo), `npm run build` + `npm start` (producción en un solo proceso/puerto) y **`docker compose up --build`** (todo en contenedores). Documenta las variables de entorno (`MONGODB_URI`, `JWT_SECRET`, `PORT`).
- **Seguridad básica:** nunca loguear contraseñas ni tokens; `JWT_SECRET` fuerte por entorno; bcrypt con sal; validar entradas de auth. `.env` en `.gitignore`.
- Mobile-first real: pruébalo mentalmente en 360–414px de ancho.

Empieza por la **Fase 1** y ve mostrándome el avance por partes para que pueda probar antes de seguir.
