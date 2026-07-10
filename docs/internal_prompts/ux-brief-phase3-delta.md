# Design Brief — Catan Assistant (Fase 3 Delta: cuentas, setup inicial, banco transparente y tema)

**Autor:** ux-architect
**Destinatario siguiente:** ui-engineer (puntos 1–5) y visual-designer (punto 6)
**Alcance:** SOLO el delta del prompt actualizado — (1) Login/Registro, (2) Perfil, (3) registro de construcciones iniciales en el Lobby, (4) "Entregar carta" del banco + notice público, (5) colapsables persistentes, (6) dirección del tema visual Catán.
**Continuidad:** `ux-brief-mvp.md` y `ux-brief-phase2.md` siguen siendo contrato vigente (principios 1–13). Este brief solo añade.

---

## 0. Principios añadidos para este delta

14. **El invitado nunca paga la fricción de las cuentas.** La mesa quiere jugar ya. Todo flujo de identidad tiene una salida "como invitado" en un solo tap, y la sesión de sala guardada manda sobre la pantalla de login.
15. **El registro inicial es la barrera de entrada de la partida — debe sentirse como un juego, no como un formulario.** Selectores grandes, progreso visible, imposible equivocarse en silencio.
16. **Toda entrega manual del banco es un acto público.** No hay camino de UI que entregue una carta sin que toda la mesa lo vea en el mismo segundo.
17. **La sesión de sala y la sesión de cuenta son independientes.** Cerrar sesión (JWT) nunca te saca de una partida en curso; perder la red nunca te desloguea.
18. **El tema viste, no gobierna.** El océano y el pergamino se aplican sobre la estructura existente sin mover un solo control de lugar ni bajar de WCAG AA.

---

## 1. Pantalla Login/Registro (nueva, previa a Home)

### Objetivo del usuario
- **Invitado:** estar en Home en ≤2 segundos y 1 tap.
- **Usuario con cuenta:** no ver esta pantalla nunca más después del primer login (JWT 30 días en `localStorage`).
- **Usuario nuevo que sí quiere cuenta:** registrarse en ≤30 s con solo username + contraseña.

### Cuándo se muestra (lógica de entrada — crítica)
Orden de precedencia al abrir la app:

1. **Hay sesión de sala activa** (`{code, playerId, sessionToken}` en `localStorage`) → ir directo a **Home** (donde vive la card "Volver a la partida"), haya o no JWT. La partida en curso manda (principio 17).
2. **Hay JWT válido** → ir directo a **Home** en modo logueado. La validación (`GET /api/users/me`) corre en segundo plano; si falla por token expirado/ inválido, limpiar token y mostrar Login con toast "Tu sesión expiró. Vuelve a entrar." Si falla por red, Home funciona en modo degradado (ver estados).
3. **Nada de lo anterior** → mostrar **Login**.
4. **Modo invitado elegido previamente** (flag `guestMode` en `localStorage`) → ir directo a Home como invitado. El Login no se vuelve a imponer; el invitado puede volver a él desde Home ("Iniciar sesión").

### Layout (una columna, 360px)

```
┌──────────────────────────────┐
│  Asistente de Catán          │  marca compacta (≤20% viewport)
│  Lleva tu partida presencial │
│                              │
│ ┌──────────────────────────┐ │
│ │   Jugar como invitado    │ │  CTA PRIMARIO, 56px, el más visible
│ └──────────────────────────┘ │
│   Sin cuenta. No guarda      │  microcopy 1 línea
│   tus estadísticas.          │
│ ───────── o con tu cuenta ── │  divisor
│  Usuario                     │
│  [____________________]      │
│  Contraseña            [ojo] │
│  [____________________]      │
│ ┌──────────────────────────┐ │
│ │      Iniciar sesión      │ │  CTA secundario fuerte
│ └──────────────────────────┘ │
│  ¿No tienes cuenta?          │
│  Crear cuenta →              │  link, abre vista de registro
└──────────────────────────────┘
```

Decisiones:
- **"Jugar como invitado" arriba y primario.** Es el caso de la mesa: alguien que nunca usó la app y quiere unirse ya. No pide nombre aquí — el nombre se pide al crear/unirse, como hoy.
- El formulario de login está **inline** (no detrás de un tap): el usuario que vuelve con token expirado teclea y entra sin navegación extra.
- "Crear cuenta" es una **segunda vista de la misma pantalla** (transición lateral o swap), no un modal: el teclado en 360px deja poco espacio y un modal sobre teclado es frágil.

### Vista "Crear cuenta"

Campos en este orden:
1. **Usuario** (obligatorio, 3–20 chars, sin espacios; normalizar a minúsculas con preview). Validación inline al perder foco.
2. **Contraseña** (obligatoria, mínimo 8 chars, toggle de visibilidad). Indicador simple de requisito ("Mínimo 8 caracteres"), sin medidor de fuerza — no es banca.
3. **Sección colapsada "Opcionales"** (cerrada por defecto): **Nombre visible** (default = username, editable; es lo que verá la mesa) y **Email** (para recuperar cuenta en el futuro; hoy solo se guarda).
4. CTA "Crear cuenta" full-width. Link "Ya tengo cuenta ←" para volver.

Sin confirmación de contraseña (el toggle de visibilidad la sustituye; menos fricción, patrón moderno).

### Estados

| Estado | Qué se ve |
|---|---|
| Inicial | Formulario limpio, foco en primer campo solo si el usuario tocó "Iniciar sesión" / "Crear cuenta" (no autofocus al cargar: levantaría el teclado sobre el CTA de invitado) |
| Enviando login/registro | Botón en loading, campos deshabilitados, resto de la pantalla intacta |
| **Credenciales inválidas** | Mensaje inline bajo el formulario: "Usuario o contraseña incorrectos." **Genérico a propósito** (no revelar si el usuario existe). La contraseña se limpia; el usuario se conserva |
| **Usuario ya existe** | Inline bajo el campo Usuario: "Ese usuario ya existe. Elige otro o inicia sesión." con link a la vista de login (precarga el username) |
| Username inválido | Inline: "3–20 caracteres, sin espacios." |
| Contraseña corta | Inline: "Mínimo 8 caracteres." CTA deshabilitado |
| Sin red / server caído | Toast "Sin conexión con el servidor." + los CTAs de cuenta en disabled con razón; **"Jugar como invitado" sigue funcionando** (el juego en vivo no depende de Mongo) |
| Auth degradada (Mongo caído, juego vivo) | El server responde error claro → banner pequeño "Las cuentas no están disponibles ahora. Puedes jugar como invitado." |
| Login exitoso | Navegación a Home (sin pantalla intermedia). El socket se reconecta con `auth.token` |
| Token expirado al volver | Login con toast "Tu sesión expiró." |

### Home con sesión (cambios sobre la Home actual)

- **Header**: a la derecha del título, un **chip de cuenta** (avatar 32px + displayName truncado). Tap → menú/sheet con "Ver perfil" y "Cerrar sesión". Invitado: en el footer aparece el link discreto "Iniciar sesión o crear cuenta" (junto a la versión); no compite con Crear/Unirse.
- **Crear/Unirse logueado**: los modales **no piden nombre** — muestran "Jugarás como **[displayName]**" con link "cambiar" que revela el input (prellenado, editable solo para esa partida). Un tap menos para el caso común.
- **Cerrar sesión**: limpia JWT y `guestMode`, **no** toca la sesión de sala. Si hay partida activa guardada, confirmar con: "Tu partida guardada seguirá disponible como invitado. ¿Cerrar sesión?". Vuelve al Login.

### Casos extremos
- **Invitado a mitad de partida decide crear cuenta:** permitido desde Home, pero la partida en curso **no se vincula retroactivamente** (el `Player` ya nació sin `userId`). Microcopy en el registro si hay sala activa: "Esta cuenta contará tus estadísticas a partir de tu próxima partida."
- **JWT válido + sessionToken de una sala muerta:** Home en modo logueado + card "Esta partida ya no existe" (flujo existente). Independientes.
- **Dos pestañas, login en una:** la otra detecta el cambio de `localStorage` (`storage` event) y refresca su header. No forzar recarga.
- **Autocompletado del navegador/gestor de contraseñas:** usar `autocomplete="username"` / `"current-password"` / `"new-password"` correctos — es la única forma de que el gestor del celular funcione.
- **localStorage bloqueado (incógnito):** login funciona solo para la sesión en memoria; aviso discreto único (mismo patrón que Home actual).
- **Username con mayúsculas/espacios pegado:** normalizar en vivo, mostrar el valor normalizado (mismo patrón que el código de sala).

### Microinteracciones
- Transición login ↔ registro: slide horizontal 200ms (instantáneo con `prefers-reduced-motion`).
- Error de credenciales: shake sutil del formulario (reusar `anim-shake`).
- Tras registro exitoso, toast "Cuenta creada. ¡A jugar!" ya en Home.

---

## 2. Pantalla Perfil (nueva)

### Objetivo del usuario
Ver mis números de carrera y dejar listos avatar/nombre/color para que el próximo lobby no me pida nada.

### Acceso
Solo desde **Home** (chip de cuenta → "Ver perfil"). **No** hay acceso desde Lobby/Game: durante la partida el perfil es ruido, y editar el nombre a mitad de sala crearía inconsistencia (el `Player.name` se fija al unirse). Botón "← Inicio" arriba.
Invitados no tienen punto de entrada (no existe el chip).

### Layout

```
┌──────────────────────────────┐
│ ← Inicio          Mi perfil  │
│ ┌──────────────────────────┐ │
│ │      (avatar 96px)       │ │  avatar grande, centrado
│ │   Cambiar foto (URL)     │ │  link bajo el avatar
│ │  Nombre visible          │ │
│ │  [María____________] ✎   │ │  editable inline
│ │  @maria · desde jun 2026 │ │  username fijo + antigüedad
│ │  Color preferido         │ │
│ │  (●)(●)(●)(●)(●)(●)(∅)   │ │  6 chips + "sin preferencia"
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ESTADÍSTICAS             │ │
│ │  12        5       7     │ │
│ │ Partidas  Victorias Derr.│ │
│ │  42% de victorias        │ │
│ │ ────────────────────────  │ │
│ │ [🛤] Camino más largo ×3 │ │  chips de insignia (BadgeIcon
│ │ [⚔] Ejército más grande×2│ │  existente) + conteo histórico
│ │  VP acumulados: 87       │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### Comportamiento de cada bloque

**Avatar**
- Por defecto: **avatar generado determinístico** por `username` (estilo geométrico/iniciales con color de fondo derivado del hash; el visual-designer define el estilo). Nunca un "sin foto" gris.
- "Cambiar foto (URL)": revela un input de URL + **preview en vivo** antes de guardar. Si la imagen no carga (404, no-imagen, timeout 5s): mantener el generado + mensaje inline "No pudimos cargar esa imagen. Revisa la URL." y no permitir guardar esa URL rota.
- En partida, el avatar es **público** (aparece en lobby junto al nombre). Si la URL falla en los dispositivos ajenos → fallback al generado, en silencio.

**Nombre visible (displayName)**
- Edición inline (tap en ✎ o en el texto), 1–20 chars, mismas reglas que el nombre de partida. Guardado por campo (no un botón "Guardar todo"): `PATCH /api/users/me` al confirmar, con check verde efímero de "Guardado".
- Microcopy: "Es el nombre que verá la mesa al unirte."

**Color preferido**
- Los 6 colores de jugador (rojo, azul, blanco, naranja, verde, café) + chip "Sin preferencia". Los de extensión llevan subtítulo "solo en partidas 5–6".
- Microcopy: "Si está libre, te lo asignamos al entrar al lobby." (El lobby lo intenta; si está tomado, entra sin color como hoy — sin error.)

**Estadísticas (solo lectura)**
- Fila de 3 números grandes: Partidas / Victorias / Derrotas, + porcentaje de victorias (omitir el % si `gamesPlayed = 0`).
- Insignias con los mismos `BadgeIcon` del juego + conteo histórico ("×3"). Si ambas en 0, omitir la fila (no mostrar ceros decorativos).
- VP acumulados como línea simple.

### Estados

| Estado | Qué se ve |
|---|---|
| Cargando | Skeleton de avatar + 3 números |
| Sin partidas (`gamesPlayed = 0`) | Stats con empty state: "Aún no terminas ninguna partida con esta cuenta. Tus resultados aparecerán aquí." |
| Guardando campo | Spinner inline en ese campo; el resto editable |
| Guardado OK | Check verde 1.2s |
| Error al guardar (red) | Mensaje inline "No se guardó. Reintentar." con el valor editado conservado |
| Error de carga del perfil | "No pudimos cargar tu perfil." + botón Reintentar |
| Token expirado dentro del perfil | Redirigir a Login con toast "Tu sesión expiró." |

### Casos extremos
- **Cambiar displayName con una partida en curso:** el `Player.name` de la sala activa NO cambia. Nota contextual si hay sesión de sala: "El cambio aplica desde tu próxima partida."
- **URL de avatar con contenido pesado/lento:** timeout de preview 5s → tratar como fallo. Recomendar al ui-engineer `referrerpolicy="no-referrer"` y dimensiones fijas para evitar saltos de layout.
- **Stats actualizándose justo al entrar** (partida recién terminada): mostrar lo que devuelva `/me`; no hace falta tiempo real aquí.

---

## 3. Registro de construcciones iniciales en el Lobby (crítico)

### Objetivo del usuario
Cada jugador, mirando el tablero físico, registra sus 2 poblados de salida en ≤60 s sin posibilidad de error silencioso. El host inicia solo cuando los N están listos.

### Ubicación y jerarquía en el Lobby
Nueva sección **"Tus poblados de salida"** entre "Tu color" y los controles del host. Es **la tarea principal del lobby** una vez elegido el color, así que:
- Mientras mi registro esté incompleto, la sección lleva un borde de atención (ámbar) y el CTA inferior de no-host cambia de "Espera a que el anfitrión inicie" a **"Te falta registrar tus poblados ↓"** (tap → scroll a la sección).
- Completo: borde normal + check verde en el encabezado de la sección.

### Estructura: dos cards de poblado

```
┌─ TUS POBLADOS DE SALIDA ──── ✓/✗ ┐
│ ┌─ Poblado 1 ──────────────────┐ │
│ │  [6 ⛰ mineral]  [9 🐑 lana]  │ │  fichas registradas (chips)
│ │  [+ Agregar ficha]  (máx 3)  │ │
│ │  ( ) Es mi 2º poblado —      │ │  radio entre las dos cards
│ │      recibe recursos al      │ │
│ │      iniciar                 │ │
│ └──────────────────────────────┘ │
│ ┌─ Poblado 2 ──────────────────┐ │
│ │  Sin fichas todavía          │ │  empty state
│ │  [+ Agregar ficha]           │ │
│ │  (•) Es mi 2º poblado — ✓    │ │  PRE-MARCADO por defecto
│ └──────────────────────────────┘ │
│  ✓ Registro completo            │  resumen de estado
└──────────────────────────────────┘
```

Decisiones estructurales:
- **Dos cards fijas** (no "agregar poblado"): la regla es exactamente 2; la UI no ofrece grados de libertad inexistentes.
- **El marcador de "mi 2º poblado" es un radio entre las dos cards**: marcar una desmarca la otra. **Imposible** marcar dos o cero por construcción de la UI.
- **Poblado 2 viene pre-marcado** como el que recibe recursos: coincide con la regla oficial ("el segundo poblado colocado otorga recursos") y con el orden natural de llenado. Quien colocó al revés lo cambia con 1 tap. Cero taps en el caso común.
- Cada ficha registrada es un **chip grande (alto ≥44px)**: número + ícono + nombre del recurso, con "×" para quitar. Tap en el chip reabre el picker para editar.
- "Agregar ficha" desaparece al llegar a 3 fichas (no disabled: no hay nada que explicar, es el máximo físico).

### El picker de ficha (bottom-sheet, el control más importante)

Un solo sheet con dos pasos visibles a la vez (sin wizard) — en 360px cabe:

```
┌──────────────────────────────────┐
│  Ficha que toca tu poblado    ✕  │
│  NÚMERO                          │
│  ┌────┬────┬────┬────┬────┐      │
│  │ 2  │ 3  │ 4  │ 5  │ 6  │      │  botones ≥56×56px
│  ├────┼────┼────┼────┼────┤      │  6 y 8 con punto rojo
│  │ 8  │ 9  │ 10 │ 11 │ 12 │      │  (como las fichas reales)
│  └────┴────┴────┴────┴────┘      │
│  RECURSO                         │
│  ┌────┬────┬────┬────┬────┐      │
│  │ 🧱 │ 🌲 │ 🐑 │ 🌾 │ ⛰ │      │  ResourceIcon 32px +
│  │ladr│made│lana│trig│mine│      │  nombre, ≥56×64px
│  └────┴────┴────┴────┴────┘      │
│ ┌──────────────────────────────┐ │
│ │   Agregar ficha 6 · mineral  │ │  CTA refleja la selección;
│ └──────────────────────────────┘ │  disabled hasta tener ambos
└──────────────────────────────────┘
```

- **El 7 no existe en la grilla** (no disabled: simplemente no está, igual que el desierto no se registra). Una línea de ayuda bajo el título: "El desierto y el mar no se registran."
- 6 y 8 llevan el tratamiento de "número caliente" (punto/realce rojo como en las fichas físicas) — refuerza el mapeo con el tablero.
- Selección con estado visible (borde fuerte + atenuar el resto, mismo patrón del Monopolio de Fase 2).
- Editar una ficha existente abre el mismo sheet con la selección precargada y CTA "Guardar cambios".

### Autosave y servidor
- **Cada mutación (agregar/quitar/editar ficha, cambiar el radio) emite `lobby:setInitialBuildings` completo.** No hay botón "Guardar registro": si el celular muere, lo registrado vive en el servidor (principio 6 del MVP: reconexión silenciosa).
- El check verde individual y el progreso del host derivan **siempre del estado del servidor**, nunca de estado local.

### Validez y progreso

Registro de un jugador **completo** cuando: ambos poblados tienen ≥1 ficha, todas las fichas válidas (número 2–12 sin 7 — garantizado por el picker), y exactamente un poblado marcado (garantizado por el radio). Es decir: la única condición que el usuario puede incumplir es "fichas vacías" — todo lo demás es imposible por diseño.

- **En la lista de jugadores del lobby:** check verde junto al nombre de quien completó; los pendientes sin marca (no ✗ rojo: no han hecho nada malo, solo no han terminado).
- **Para el host:** el CTA "Iniciar partida" suma la condición. Texto del botón deshabilitado (reusa el patrón actual de `startReason`): "Faltan registros de salida (3/4 listos)". Tap en el botón deshabilitado → toast con los nombres: "Faltan: Juan, Ana." (el host puede gritárselos a la mesa — es presencial).
- **Para cada jugador:** bajo el encabezado de la sección, su propio estado: "✓ Registro completo" / "Te falta: fichas del Poblado 1".

### Estados

| Estado | Qué se ve |
|---|---|
| Vacío (recién entrado) | Dos cards con empty state "Sin fichas todavía" + radio pre-marcado en Poblado 2 |
| Parcial | Chips registrados + lo que falta en el resumen |
| Completo | Check verde en sección y en mi fila de la lista de jugadores |
| Editando tras completar | Permitido mientras `status = 'lobby'`; si vacío una card, el check se retira (y el del host baja a "2/4") |
| Sheet abierto + pierdo conexión | El sheet sigue editable; al confirmar, si no hay socket, toast "Sin conexión. Se guardará al reconectar." y reintento automático al reconectar |
| Partida iniciando (host tapeó Iniciar) | Sheet/inputs se cierran; navegación a Game para todos |

### Casos extremos

1. **Desconexión a mitad del registro:** lo último emitido está en el servidor; al reconectar, las cards se rehidratan desde `state`. Lo que estaba a medias dentro del sheet sin confirmar se pierde (aceptable: es 1 ficha, 2 taps).
2. **Host activa/desactiva extensión 5–6 con registros hechos:** los registros **no se tocan** (números y recursos siguen siendo válidos; la extensión solo cambia cupo/banco/mazo/colores). Ningún reset. Si entran jugadores 5 y 6 nuevos, simplemente empiezan su registro de cero y el contador del host pasa a "3/6 listos".
3. **Poblado costero que solo toca desierto/mar (0 fichas de recurso):** físicamente posible aunque rarísimo. **Decisión:** la UI exige ≥1 ficha (alineada con la validación 1–3 del servidor) **pero** se deja documentado como punto de relajación: si en pruebas reales aparece el caso, permitir 0 fichas con confirmación explícita "¿Tu poblado no toca ninguna ficha con número?" y ajuste del servidor. No bloquear esta fase por ello.
4. **Dos fichas idénticas (mismo número y recurso) en un mismo poblado:** permitido sin advertencia — en el tablero (sobre todo con extensión) puede ocurrir con dos hexes distintos. El merge/separación de hexes es problema del servidor, no del jugador.
5. **El mismo hex registrado por dos jugadores** (ambos tienen poblado en sus esquinas): esperado y correcto — el sembrado los une como co-owners. Nada que validar en UI.
6. **Jugador marca el poblado equivocado como 2º:** se nota al iniciar (recibe recursos incorrectos). Red de seguridad: el log registra "Recursos de inicio de María: 1 mineral, 1 lana" y el bank manager corrige con `admin:giveCard` / undo. No requiere UI extra aquí.
7. **Invitado vs registrado:** flujo idéntico. El registro inicial no depende de la cuenta.
8. **Host completa el suyo pero otro jugador se desconectó sin completar:** el host ve la fila "Desconectado" sin check y decide socialmente (esperarlo o que el server permita expulsarlo en futuro — fuera de alcance). El botón Iniciar sigue honesto: "Faltan registros (3/4)".
9. **Ciudad en colocación inicial** (variante rara): el modelo soporta `type: 'city'` pero la UI **no lo expone** en esta fase — siempre `settlement`. Documentado como gancho.

### Microinteracciones
- Confirmar ficha en el sheet: el chip nuevo entra con pop sutil (`anim-pulse-scale`); el sheet se cierra solo.
- Completar el registro: el check de sección entra con un tick animado + vibración corta 50ms (es un logro de tarea, merece confirmación háptica).
- En el host, el contador "N/M listos" pulsa cuando sube.

---

## 4. "Entregar carta" del banco (`admin:giveCard`) + notice público

### Objetivo del usuario (bank manager)
Corregir un reparto o entregar una carta especial a cualquier jugador, **en cualquier momento y fase**, en ≤4 taps — con toda la mesa enterándose en el mismo instante.

### Entrada
Botón **"Entregar carta"** dentro del `BankPanel` (debajo del teclado/undo), estilo secundario — es herramienta de corrección, no flujo principal. Disponible en cualquier fase, incluso fuera del turno del bank manager. Solo lo ve el bank manager (y host si son distintos, según permisos del server).

### Modal de entrega (3 decisiones en una pantalla, sin wizard)

```
┌──────────────────────────────────┐
│  Entregar carta del banco     ✕  │
│  ¿A QUIÉN?                       │
│  [● María] [● Juan] [● Ana] ...  │  chips con ColorChip, incluye
│                                  │  al propio bank manager
│  ¿QUÉ CARTA?                     │
│  Recursos                        │
│  [🧱 12] [🌲 9] [🐑 0] [🌾 15] [⛰ 7] │  ícono + stock del banco
│  Carta de desarrollo             │
│  [🂠 Mazo: 18 cartas]            │  una sola opción (carta al azar
│                                  │  de la cima, como comprar)
│ ────────────────────────────────  │
│  ⚠ Todos los jugadores verán     │
│    esta entrega.                 │
│ ┌──────────────────────────────┐ │
│ │  Entregar 1 trigo a Ana      │ │  CTA refleja selección;
│ └──────────────────────────────┘ │  disabled hasta elegir ambos
│ [        Cancelar              ] │
└──────────────────────────────────┘
```

Decisiones:
- **Una carta por operación.** Para entregar 3 trigos: 3 confirmaciones (o mantener el modal abierto tras confirmar — ver microinteracciones). Mantiene cada notice atómico y legible ("entregó 1 trigo", no "entregó cosas").
- **El bank manager puede entregarse a sí mismo.** Prohibirlo no protege nada (podría pedirle a otro) y a veces es la corrección legítima; la transparencia del notice es la defensa real (principio 16).
- **Recurso con stock 0:** chip atenuado con "0". Tap → revela la opción **"Forzar entrega sin banco"** con confirmación extra ("El banco no tiene lana. ¿Entregar de todas formas? Quedará registrado."). Cubre el caso físico de conteo desfasado sin esconder la anomalía: el log dice "(forzado, banco en 0)".
- **Dev card:** entrega la carta superior del mazo (no se elige el tipo — igual que comprar; elegir tipo rompería el mazo barajado). Si el mazo está agotado: opción atenuada con "Mazo agotado", sin forzado (no hay forma coherente de forzar una dev card).
- La advertencia "Todos los jugadores verán esta entrega" es **permanente en el modal**, no un segundo paso. El CTA con el resumen completo ("Entregar 1 trigo a Ana") ES la confirmación — no añadir otro modal encima.

### Estados del modal

| Estado | Qué se ve |
|---|---|
| `idle` | Nada seleccionado, CTA "Elige jugador y carta" disabled |
| `partial` | Una de dos selecciones, CTA disabled con lo que falta |
| `ready` | CTA con el resumen exacto |
| `submitting` | CTA loading, taps bloqueados |
| `forcing` | Confirmación inline del forzado |
| `success` | Modal permanece abierto con flash verde + selección de carta reseteada (jugador conservado) — permite entregas consecutivas al mismo jugador; "Cancelar" pasa a decir "Cerrar" |
| `error` | Toast con la razón del server, vuelve a `ready` |

### El notice público (banner prominente) — jerarquía frente a toasts

Componente nuevo `NoticeBanner`, distinto de los toasts en cuatro dimensiones:

| | Toast (existente) | **Notice** |
|---|---|---|
| Posición | Apilado, borde de pantalla, pequeño | **Full-width bajo la TopBar**, empuja o cubre el contenido superior |
| Duración | ~3s | **8s** + botón ✕ para descartar antes |
| Tono | Neutro/contextual | **Ámbar (`warn`)** o azul (`info`) según `level`, con ícono ⚠/ℹ a la izquierda y texto 15–16px semibold |
| Audiencia | Quien lo necesita | **Todos los dispositivos, siempre** |

Reglas:
- **Z-index por encima de cualquier modal.** Si un jugador está dentro del modal de descarte y el banco entrega una carta, lo ve igual. La transparencia no se negocia (principio 16).
- **Cola, no pila:** si llegan varios notices seguidos, se muestran uno por uno (mínimo 2.5s cada uno antes de avanzar). Nunca dos superpuestos.
- **Sin vibración** (no exige acción de nadie; la vibración se reserva para "te toca actuar" — principio de Fase 2 §6.1).
- Texto canónico (el ux-writer afinará): "⚠️ El banco entregó 1 trigo a Ana" / "⚠️ El banco entregó 1 carta de desarrollo a Juan" / sufijo "(forzado)" cuando aplique. **Nunca** revela el tipo de la dev card entregada — eso es información privada del receptor; el notice dice "1 carta de desarrollo" y punto.
- Toda entrega queda **también** en el log con el mismo texto (el notice es efímero; el log es la memoria).
- En el **receptor**, además: su chip de mano pulsa con delta +1 (mecánica existente de HandView) y toast personal "Recibiste 1 trigo del banco."

### Casos extremos
- **Entrega durante `phase = 'discard'` a un jugador que debe descartar:** permitido (el server manda). El `pendingDiscards` no se recalcula (regla: se fijó al salir el 7). El notice lo hace visible si genera debate en la mesa.
- **Entrega a un jugador desconectado:** permitida; verá su mano actualizada al volver. El notice informa a la mesa igual.
- **Undo de una entrega:** `action:undo` la revierte (es una acción mutadora más). El undo ya emite su propio evento de log; recomendar que el server emita también notice "Se deshizo la última entrega del banco" para simetría de transparencia.
- **Notice llega durante la pantalla de ganador:** suprimir (la partida terminó; solo log).
- **Espectador del modal con `state:update` que cambia el stock mientras elige:** los chips de stock se rehidratan en vivo; si la selección quedó sin stock, vuelve a `partial` con el chip atenuado.

---

## 5. Colapsables persistentes (tabla de producción y secciones densas)

### Estado actual
`ProductionTable` ya colapsa con `useState(true)` y se fuerza abierta en fase de ladrón. El delta es **persistencia por dispositivo** y **generalizar el patrón**.

### Especificación
- Preferencia guardada en `localStorage` por sección: clave `ui.collapse.<sectionId>` (`productionTable`, `publicPlayers`, `diceStats`, `log`). **Por dispositivo, no por partida**: la preferencia expresa cómo le gusta a ESTE usuario usar SU pantalla, y sobrevive entre partidas.
- **Forzados temporales no escriben la preferencia.** La fase `robber` abre la tabla; al terminar la fase, vuelve al estado preferido. Mismo principio para cualquier auto-apertura futura.
- Defaults de primera vez (sin clave guardada): Tabla de producción **colapsada**, Estado de jugadores **expandido** (es el marcador de la partida), Estadísticas de dados **colapsada** (ya decidido en Fase 2), Log **colapsado**.
- El header de cada colapsable conserva su **resumen útil en estado cerrado** (ya existe en la tabla: "12 fichas"): jugadores cerrado → "4 jugadores · va María"; log cerrado → badge de entradas nuevas (ya definido en MVP §H). Cerrado nunca significa ciego.
- Affordance unificada: mismo chevron/símbolo y misma animación de altura en todas las secciones (componente compartido `CollapsibleSection`).
- **La mano propia y las acciones de turno NUNCA son colapsables.** Son el corazón de la pantalla.

### Casos extremos
- `localStorage` lleno/bloqueado: degradar a comportamiento actual (estado en memoria), sin avisos.
- Cambio de rol (me vuelvo bank manager): el `BankPanel` no es colapsable por el usuario — aparece/desaparece por rol, como hoy.
- Hex con ladrón mientras la tabla está colapsada: el header cerrado muestra un indicador 🥷/punto rojo para que el ladrón nunca quede invisible.

---

## 6. Dirección del tema visual Catán (para visual-designer)

Esto es dirección de UX; la ejecución (tokens, assets, ajustes finos) es del visual-designer. Restricciones no negociables primero:

### Restricciones duras
1. **WCAG AA en todo texto y control** (≥4.5:1 texto normal, ≥3:1 texto grande e iconografía funcional). El qa-auditor verificará contra las superficies nuevas, no contra el fondo.
2. **Nada de texto directamente sobre el océano.** Todo contenido vive en superficies semiopacas/sólidas (regla del prompt). El océano es ambiente, no fondo de lectura.
3. **Cero regresión de layout:** el tema cambia color, textura, tipografía y assets — no posiciones, tamaños de touch target (≥44px) ni jerarquía definida en los briefs anteriores.
4. **Rendimiento móvil:** fondo = degradado CSS + textura sutil (SVG/imagen pequeña repetible), sin video, sin canvas. Cualquier movimiento de olas/parallax es del motion-engineer, discreto, y respeta `prefers-reduced-motion`.

### Dirección por capa
- **Fondo (océano):** azul profundo con variación tonal suave (degradado radial/vertical + textura de olas de muy bajo contraste). Constante en TODAS las pantallas (Login, Home, Lobby, Game, Profile, Winner) — es lo que une la app.
- **Superficies (pergamino/madera):** las cards actuales (`bg-white/[0.03]` sobre neutro oscuro) migran a paneles tipo pergamino/arena o madera oscura semiopaca. El visual-designer decide si el tema queda oscuro (madera/noche, menor riesgo de contraste — recomendado como primera iteración) o claro (pergamino); **una sola decisión global**, no mezcla por pantalla.
- **Paleta funcional:** recursos (terracota, verde bosque, lima pastura, dorado trigo, gris pizarra) ya viven en `ResourceIcon` — formalizarlos como tokens. Colores de jugador = piezas reales. Dorado **reservado** para insignias, código de sala y victoria (si todo es dorado, nada lo es).
- **Tipografía:** display con aire de mapa/aventura SOLO en: título de la app, código de sala, "GANADOR" y encabezados de pantalla. Datos, números y controles permanecen en la sans actual (los `nums` tabulares del juego son funcionales, no se tocan).
- **Íconos:** mantener la arquitectura centralizada existente (`ResourceIcon.tsx`, `BadgeIcon.tsx`) y **extenderla a un módulo único** `client/src/assets/icons.tsx` que cubra también las 5 cartas de desarrollo y el ladrón, con **fallback emoji** (🧱🌲🐑🌾⛰ / ⚔️🏆💰🎁🛤️) si un asset no carga. Si se usa arte de las cartas de Catán: `client/src/assets/cards/`, documentar fuente y uso personal/no comercial. El contrato para los componentes: importan del módulo, nunca conocen el asset.
- **Microdetalle temático con presupuesto:** botones con sensación madera/piedra y notices con borde tipo sello — pero el chrome temático nunca compite con el contenido. Prioridad de aplicación: Game (donde se vive) → Lobby → Home/Login → Profile → Winner.

### Entregables esperados del visual-designer
1. Tokens CSS centralizados (superficies, océano, recursos, jugadores, dorado, tipografías).
2. Módulo de íconos unificado con fallback.
3. Pase pantalla por pantalla sin tocar estructura.
4. Tabla de verificación de contraste (par superficie/texto → ratio) para el qa-auditor.

---

## 7. Glosario añadido

- **Cuenta** (`User`): identidad persistente con stats. **Invitado**: jugador sin cuenta; no acumula stats.
- **Sesión de cuenta** (JWT) vs **sesión de sala** (`sessionToken`): independientes (principio 17).
- **Nombre visible** (`displayName`): nombre que ve la mesa; editable en Perfil.
- **Color preferido**: se intenta asignar al entrar al lobby si está libre.
- **Poblado de salida** (`InitialBuilding`): uno de los 2 poblados de la colocación inicial.
- **Ficha** (`spot`): número (2–12, sin 7) + recurso que toca un poblado de salida.
- **Mi 2º poblado** (`grantsStartingResources`): el que otorga 1 recurso por ficha al iniciar. Exactamente uno.
- **Registro completo**: 2 poblados con ≥1 ficha y uno marcado. Condición de inicio.
- **Entregar carta** (`admin:giveCard`): entrega manual del banco, siempre pública.
- **Notice** (`notice`): banner público prominente para todos; por encima de modales; queda en log.
- **Forzar entrega**: entrega de recurso con banco en 0, marcada en log.

## 8. Decisiones documentadas (delta)

1. La sesión de sala activa salta el Login; el invitado nunca ve fricción de cuentas.
2. "Jugar como invitado" es el CTA primario del Login; login inline; registro como segunda vista, no modal.
3. Error de login genérico ("usuario o contraseña incorrectos") — no se revela existencia de usuarios. "Usuario ya existe" sí es específico en el registro.
4. Sin confirmación de contraseña; toggle de visibilidad en su lugar.
5. Cerrar sesión nunca destruye la sesión de sala.
6. Logueado, los modales de crear/unirse no piden nombre (prellenan displayName editable).
7. Perfil accesible solo desde Home; cambios de displayName no afectan la partida en curso.
8. Avatar generado determinístico como default; URL con preview obligatorio y fallback silencioso en dispositivos ajenos.
9. Registro inicial: dos cards fijas + radio compartido → imposible marcar 0 o 2 "segundos poblados". Poblado 2 pre-marcado.
10. El picker omite el 7 y el desierto en lugar de deshabilitarlos.
11. Autosave por mutación vía `lobby:setInitialBuildings`; el servidor es la fuente del progreso "N/M listos".
12. Cambiar extensión 5–6 no resetea registros iniciales.
13. UI exige ≥1 ficha por poblado; el caso "0 fichas" (desierto costero) queda documentado como relajación futura.
14. Entregar carta: 1 carta por operación; auto-entrega permitida; forzado con confirmación explícita; dev card siempre de la cima del mazo.
15. Notice: full-width bajo TopBar, 8s, por encima de modales, en cola, sin vibración, nunca revela el tipo de dev card.
16. Colapsables: preferencia por dispositivo en `localStorage`; forzados temporales no la sobrescriben; mano y acciones nunca colapsan.
17. Tema: una sola decisión global claro/oscuro; dorado reservado; estructura y touch targets intocables; íconos centralizados con fallback emoji.

## 9. Criterios de éxito

1. Invitado nuevo: de abrir la app a estar en un lobby en ≤15 s (igual que hoy — el Login no añade fricción al camino de invitado).
2. Registro de cuenta completo en ≤30 s con solo 2 campos obligatorios.
3. Registro de construcciones iniciales: ≤60 s por jugador, ≤14 taps en el caso típico (2 poblados × 2–3 fichas), cero estados inválidos alcanzables desde la UI.
4. El host nunca pregunta "¿quién falta?": el botón y el contador se lo dicen.
5. Entrega del banco: ≤4 taps; el notice es visible en el 100% de los dispositivos conectados, incluso con modales abiertos.
6. Ninguna entrega manual existe sin su entrada de log.
7. Preferencias de colapso sobreviven a recargas y entre partidas en el mismo dispositivo.
8. Tras el tema visual: 0 violaciones AA reportadas por el qa-auditor y mismas posiciones/tamaños de todos los controles.
9. Un usuario con cuenta y JWT vigente no ve el Login nunca; uno con token expirado lo entiende en una línea.

## 10. Siguiente paso y reparto

**Orden recomendado de implementación (ui-engineer):**
1. Punto 3 (registro inicial) — bloquea el flujo de juego correcto, es lo crítico.
2. Punto 4 (entregar carta + `NoticeBanner`) — corto y de alto valor anti-trampas.
3. Punto 5 (`CollapsibleSection` persistente) — pequeño, despeja el Game.
4. Puntos 1 y 2 (Login/Registro y Perfil) — requieren el backend de auth (Fase 0b del plan) ya disponible.

Componentes nuevos: `LoginScreen` (vistas login/registro), `ProfileScreen`, `AccountChip` (header de Home), `InitialBuildSetup` (sección de Lobby + sheet picker), `GiveCardModal` (en BankPanel), `NoticeBanner`, `CollapsibleSection`.
Componentes a modificar: `HomeScreen` (chip de cuenta, modales sin nombre si logueado), `LobbyScreen` (sección de setup, checks por jugador, razón del botón Iniciar), `BankPanel` (botón Entregar carta), `ProductionTable`/`PublicPlayersPanel`/`Log`/`DiceStats` (migrar a `CollapsibleSection`), `App.tsx` (routing de entrada según sesión).

**Después:** `ux-writer` (copy de auth, errores, notices, picker) → `visual-designer` (punto 6 completo) → `motion-engineer` (notice, checks de registro, transiciones de Login) → `qa-auditor` (contraste sobre el tema nuevo, 360–414px, touch targets, a11y de los sheets/modales nuevos).
