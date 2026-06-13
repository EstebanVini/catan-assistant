# Design Brief — 6 cambios de Catán Assistant

> Autor: UX Architect · Fecha: 2026-06-13 · Destinatario principal: **ui-engineer**
> Mobile-first, dark theme, español en 2ª persona. Touch targets ≥44px. aria/focus/reduced-motion respetados.
> Lenguaje visual de referencia: `LobbyScreen.tsx`, `TradeModal.tsx`, `InitialBuildSetup.tsx`, `ConstructionTable.tsx`, `RobberFlow.tsx`.

## Supuestos declarados (no se hizo entrevista)

1. **Cuentas y amigos**: "Amigos" solo existe para usuarios con cuenta. El usuario anónimo (sin login) no ve la entrada a Amigos ni el botón "Invitar amigos" en el lobby; en su lugar ve un estado de upsell suave ("Inicia sesión para jugar con amigos").
2. **Tiempo real**: las solicitudes de amistad y las invitaciones de sala llegan por socket. La invitación entrante se materializa como un **toast accionable persistente** (no auto-dismiss) reusando el sistema `pushToast`, más una entrada en un centro de avisos si ya existe; si no existe, basta el toast con botón "Unirme".
3. **Stats de amigo**: el backend devuelve por amigo `{ gamesPlayed, wins, badges[] }`. "Insignias" se renderiza como conteo + las 3 más recientes; el detalle completo queda fuera de alcance de estos cambios.
4. **Presencia**: el backend marca `online: boolean` y `inRoom: boolean` por amigo. "Invitar amigos" en el lobby lista solo `online === true`; los que están `inRoom` se muestran deshabilitados con etiqueta "En otra sala".
5. **Expulsar**: solo el anfitrión, solo en lobby (antes de iniciar). El expulsado es devuelto a Home y no puede re-entrar con el mismo código salvo nueva invitación/código (el backend lo gestiona; la UI solo muestra el aviso).
6. **`hexId`**: lo asigna el cliente al crear una ficha nueva (p. ej. `crypto.randomUUID()` o `h_<ts>`), y reusa el `hexId` existente al agrupar. El server agrupa por `hexId`, no por número+recurso.
7. **Modos del anfitrión** (repartir recursos, intercambios desiguales, puertos ajenos) viven en `state` y son de solo-lectura para los no-anfitriones, que ven su estado en una línea informativa.
8. **Comisión de puerto ajeno** se paga en cartas de recurso del solicitante al dueño; el server valida que el solicitante las tenga. El flujo de aprobación es asíncrono (socket), igual que una oferta de intercambio.

---

## 1. Amigos

### Problema
No existe forma de mantener relaciones entre partidas ni de invitar a gente conocida sin dictar el código de sala en voz alta. La fricción está en el momento de armar la mesa.

### Solución de UX

**Entrada**: una tarjeta/acción "Amigos" en Home y un acceso espejo en Profile. Badge ámbar con el número de solicitudes pendientes sobre el icono cuando `pending > 0`.

**Pantalla Amigos** — tres zonas en una sola vista scrollable (no tabs salvo que crezca):

1. **Buscar y agregar** (arriba, siempre visible)
   - Input de búsqueda por `@username` con botón "Buscar". Resultado: fila con avatar + username + botón "Agregar" (emerald). Estados del botón por resultado: `Agregar` → `Enviada` (disabled, ámbar) → `Amigos` (disabled, neutro) si ya lo son; `Te envió solicitud` lleva a la zona de pendientes.
   - Empty de búsqueda: "No encontramos a nadie con ese usuario."
   - Error de red: "No pudimos buscar. Revisa tu conexión." con botón "Reintentar".

2. **Solicitudes pendientes** (colapsable, solo si hay)
   - Cada fila: avatar + username + dos botones: "Aceptar" (emerald) y "Rechazar" (neutro, no rojo — rechazar no es destructivo). Distinguir entrantes ("Te envió solicitud") de salientes ("Pendiente · enviada por ti", con acción "Cancelar").
   - El borde de la sección usa el tono ámbar de "pendiente" (`border-amber-500/40 bg-amber-500/[0.03]`), igual que la card de registro incompleto.

3. **Mis amigos** (lista principal)
   - Fila por amigo reusando el patrón de fila de jugador del lobby (avatar + nombre + tags). Stats en una línea secundaria: `12 partidas · 5 victorias · 3 insignias` con `nums`. Punto de presencia: verde si `online`, neutro si offline; texto "En otra sala" si `inRoom`.
   - Acción secundaria por amigo: menú/overflow con "Eliminar amigo" (rojo, con confirmación — ver abajo). Eliminar SÍ es destructivo.

**Confirmación de eliminar**: `alertdialog` pequeño (patrón `ConfirmEmptySteal`): "¿Eliminar a @usuario de tus amigos?" · "Cancelar" / "Sí, eliminar" (rojo).

### Estado vacío (sin amigos)
Tarjeta centrada con ilustración/emoji-libre (usar glyph del proyecto, no emoji): título "Aún no tienes amigos aquí", cuerpo "Busca por nombre de usuario y envíales una solicitud para invitarlos a tus partidas." y el input de búsqueda enfocado. No mostrar la zona "Mis amigos" vacía con una lista en blanco.

### Primer uso / sin cuenta
Usuario anónimo: card de upsell "Inicia sesión para jugar con amigos" + botón a login. No renderizar la búsqueda.

### Invitar desde el Lobby
- Botón "Invitar amigos" en el lobby, ubicado en la zona de jugadores (cerca del código de sala), estilo secundario (`bg-surface-3`, `min-h-[44px]`). Solo visible para usuarios con cuenta.
- Abre un **bottom-sheet** (patrón `SpotPickerSheet`): título "Invitar amigos a la sala", subtítulo con el código. Lista de amigos `online`:
  - Conectado y libre: botón "Invitar" → tras tap pasa a "Invitado ✓" (disabled, emerald, no spam).
  - `inRoom`: fila atenuada (`opacity-60`) + etiqueta "En otra sala", sin botón.
  - Offline: agrupados abajo bajo "Desconectados", no accionables, o directamente ocultos para reducir ruido (preferible ocultar).
- Empty: "Ninguno de tus amigos está conectado ahora. Comparte el código." con botón "Copiar código" (reusa `copyCode`).

### Aviso de invitación entrante (lado receptor)
Toast persistente accionable: avatar + "**@anfitrión** te invitó a una sala" + código + botón "Unirme" (emerald) y "Descartar" (neutro). Si el receptor ya está en una sala, la acción "Unirme" pide confirmación de salida de la actual.

### Jerarquía
Buscar (acción de crecimiento) > Pendientes (requiere acción, ámbar) > Lista (consulta). En el sheet de invitar: amigos conectados libres primero.

### Copy sugerido
- "Buscar por nombre de usuario"
- "Solicitud enviada", "Te envió solicitud", "Aceptar", "Rechazar"
- "12 partidas · 5 victorias · 3 insignias"
- "Invitar amigos a la sala", "Invitar", "Invitado", "En otra sala"
- "@anfitrión te invitó a una sala · UNIRME"

### Criterios de éxito
Un usuario puede, sin dictar código, invitar a un amigo conectado y que este se una en ≤2 taps desde el aviso. Las solicitudes pendientes nunca pasan desapercibidas (badge + sección ámbar).

---

## 2. Sacar jugador del lobby (expulsar)

### Problema
El anfitrión no puede limpiar la mesa de un jugador equivocado o ausente antes de iniciar; hoy solo el propio jugador puede salir.

### Solución de UX
- En la lista de jugadores del lobby (`LobbyScreen.tsx`, sección "Jugadores"), añadir por fila —solo para el anfitrión y solo en filas que **no** son la suya— un botón de expulsar discreto: icono X (la misma `path` de cierre ya usada), `h-11 w-11`, color neutro que vira a rojo en `active`. Colocarlo junto a las flechas de orden ↑/↓ existentes, sin romper esa columna.
- `aria-label`: "Expulsar a {nombre} de la sala".

### Confirmación
`alertdialog` (patrón `ConfirmEmptySteal`):
- Título: "¿Expulsar a {nombre}?"
- Cuerpo: "Volverá a la pantalla de inicio y tendrás que invitarlo de nuevo para que regrese."
- Botones: "Cancelar" (neutro) / "Sí, expulsar" (rojo, `border-red-500/40 bg-red-500/[0.08] text-red-300`).

### Qué ve el expulsado
Es devuelto a Home y recibe un toast de tono ámbar/info (no error rojo — no hizo nada malo): "El anfitrión te sacó de la sala {código}." El estado de la sala se limpia del cliente igual que en `leaveRoom`.

### Estados
- Auto-expulsión bloqueada: el anfitrión no ve botón en su propia fila.
- Concurrencia: si el jugador se desconecta justo antes, el server resuelve; la UI no necesita caso especial más allá de cerrar el alertdialog si la fila desaparece.

### Copy sugerido
"Expulsar a {nombre} de la sala" · "Volverá a la pantalla de inicio…" · "Sí, expulsar" · "El anfitrión te sacó de la sala {código}."

### Criterios de éxito
El anfitrión expulsa en 2 taps (X → confirmar). El expulsado entiende sin ambigüedad qué pasó y que no es un error de la app.

---

## 3. Iniciar sin fichas (toggle "Repartir recursos de inicio")

### Problema
Algunos grupos quieren empezar sin recursos iniciales (o no quieren registrar fichas de salida). Hoy registrar los 2 poblados es **condición obligatoria** de inicio, lo que bloquea ese modo.

### Solución de UX

**Toggle (anfitrión)**: en la card del código de sala / controles, una fila toggle reusando el patrón del toggle "Extensión 5–6": "Repartir recursos de inicio", default **ON**.
- Para no-anfitriones: línea informativa "Recursos de inicio: Sí / No" (como hoy se muestra "Modo: Base/Extensión").

**Cuando está OFF** (no se reparten recursos):
1. La card "Tus poblados de salida" (`InitialBuildSetup.tsx`) cambia de tono: deja de usar el borde ámbar de "obligatorio" y pasa a `border-white/10 bg-surface-1` (neutro), porque ya no bloquea.
2. El título secundario cambia el copy del cuerpo: en vez de "Al iniciar recibes 1 carta por cada ficha registrada." → "Modo sin recursos de inicio: registrar tus fichas es opcional (te ayuda a recordar tu producción)."
3. El registro deja de ser condición de inicio:
   - `canStart` ya no exige `allSetupComplete` cuando el modo es OFF.
   - El botón "Iniciar partida" no muestra el motivo "Faltan registros de salida".
   - El contador "N/M listos" de los Controles del anfitrión se oculta (o se reemplaza por una etiqueta neutra "Registro opcional"), porque no hay meta que cumplir.
   - El CTA del no-anfitrión "Te falta registrar tus poblados ↓" desaparece; en su lugar el estado de espera normal.

**Cuando vuelve a ON**: la card recupera el tono ámbar si el registro está incompleto y se restablecen las condiciones de inicio.

### Estados
- Cambio de toggle en vivo mientras alguien registra: la transición de tono de la card debe ser suave (`transition-colors`, ya existe) y respetar `reduced-motion`.
- Primer uso: default ON conserva el comportamiento actual; nadie nota cambio salvo que lo apague.

### Copy sugerido
- Toggle: "Repartir recursos de inicio"
- No-anfitrión: "Recursos de inicio: No"
- Card OFF: "Modo sin recursos de inicio: registrar tus fichas es opcional."
- Etiqueta de controles: "Registro opcional" (en vez de "N/M listos").

### Jerarquía
El modo debe ser legible de un vistazo: el estado de la card "Tus poblados de salida" (ámbar vs neutro) es la señal primaria de si el registro es obligatorio.

### Criterios de éxito
Con el toggle OFF, el anfitrión puede iniciar con 0 fichas registradas y nadie ve mensajes de "falta registrar".

---

## 4. Bug de layout del lobby (barra fija tapa "Controles del anfitrión")

### Diagnóstico
En `LobbyScreen.tsx`:
- El contenedor `<main>` tiene `pb-28` (línea 134) — padding inferior fijo de 7rem.
- La barra de acción es `fixed inset-x-0 bottom-0` con su propio padding y `safe-area-inset-bottom` (línea 439).
- Para el **anfitrión**, esa barra crece: contiene el CTA `min-h-[56px]` "Iniciar partida" **más** el botón "Cancelar sala" (y, cuando `confirmLeave`, dos botones). Su altura real supera los 7rem reservados por `pb-28`, sobre todo con safe-area en iPhone.
- Resultado: la última sección del flujo —"Controles del anfitrión" (sortear orden, encargado del banco), que en móvil es la última en el DOM (líneas 381–435)— queda **por debajo del borde superior de la barra fija**, tapada y sin poder tocarse.

### Solución de layout (especificación)
1. **Padding inferior dinámico, no fijo.** Reemplazar el `pb-28` estático por un padding que iguale la altura real de la barra:
   - Medir la barra con un `ref` + `ResizeObserver` y aplicar el alto como `padding-bottom` inline en `<main>` (o exponerlo como CSS var `--lobby-bar-h` y usar `pb-[var(--lobby-bar-h)]`).
   - Alternativa sin JS: dar a la barra una altura/área conocida y reservar generosamente para el caso anfitrión (`pb-40`/`pb-44`) **más** `env(safe-area-inset-bottom)`. La opción con `ResizeObserver` es la robusta y la recomendada porque la barra cambia de alto entre roles y entre `confirmLeave` true/false.
2. **Incluir el safe-area en el cálculo** para que en dispositivos con notch inferior el último control no quede pegado/oculto.
3. **Reordenar para resiliencia**: en el flujo de una columna (móvil), los "Controles del anfitrión" no deberían ser lo último que puede quedar bajo la barra. Subirlos por encima de "Tus poblados de salida" no es ideal (el registro es la tarea principal). Mejor: garantizar el padding correcto (punto 1) y, como refuerzo, hacer `scroll-margin-bottom` en los controles para que un foco/scroll programático nunca los deje bajo la barra.
4. Verificar en el layout `md:grid md:grid-cols-2`: en escritorio los controles van en la segunda columna y la barra está centrada `max-w-md`; el bug es de móvil pero el padding dinámico no debe romper el grid (aplicarlo a `<main>` está bien).

### Criterios de éxito
En móvil (incl. con safe-area), el anfitrión puede hacer scroll hasta ver y tocar completos los botones "Sortear orden con dados" y los chips de "Encargado del banco" sin que la barra fija los tape, en ambos estados de `confirmLeave`.

---

## 5. Desambiguar el ladrón / agrupar fichas (`hexId`)

### Problema
Hoy las fichas se fusionan por `número + recurso`. Dos fichas físicas distintas con el mismo número y recurso (p. ej. dos "8 trigo") colapsan en una sola entrada, así que al mover el ladrón es imposible distinguir cuál es y a quién toca. El backend introduce `hexId`: fichas con el mismo `hexId` son la misma ficha física.

### Solución de UX — paso de desambiguación en `SpotPickerSheet`

Hoy el sheet (en `InitialBuildSetup.tsx`, reusado por `ConstructionTable.tsx`) confirma con `(número, recurso)`. Nuevo flujo:

1. El jugador elige número y recurso como ahora (sin cambios en esos dos grids).
2. **Al confirmar**, si ya existe ≥1 ficha en la mesa con ese mismo número+recurso, en vez de cerrar, el sheet revela un **tercer bloque de decisión** (in-place, sin abrir otro modal):
   - Encabezado: "Ya hay una ficha **{n} {recurso}** en juego. ¿Es la misma?"
   - Lista de las fichas existentes con ese número+recurso. Cada opción muestra: el número (con el tratamiento hot 6/8), el recurso, y **quién la toca** (chips de color + P/C, reusando el patrón de `owners` de `RobberHexList`). Texto tipo "La tocan: 🔴P 🔵C". Tocar una opción = **agrupar** (reusa ese `hexId`).
   - Una opción final, visualmente separada: **"Es una ficha nueva (otra distinta en el tablero)"** → crea `hexId` nuevo.
   - CTA inferior se adapta: cuando hay decisión pendiente, el botón principal queda deshabilitado hasta que el jugador elija agrupar o crear nueva. Copy: "Elige si es la misma ficha o una nueva".
3. Si **no** existe ninguna ficha previa con ese número+recurso, se omite el paso: se crea `hexId` nuevo y se confirma directo (comportamiento idéntico al actual; cero fricción para el caso común).

**Nota de implementación para el contrato**: `confirmSpot`/`confirmSheet` pasan a llevar `hexId` además de `number`/`resource`. El sheet necesita como prop la lista de fichas ya existentes en la mesa (derivada del server: `{ hexId, number, resource, owners[] }`) para poder ofrecer las coincidencias.

### Estados
- **Sin coincidencias** (caso mayoritario): sin paso extra, igual de rápido que hoy.
- **Editando una ficha existente** (`editing = true`): si el cambio de número/recurso crea una nueva colisión, se vuelve a ofrecer el paso; si no, se mantiene el `hexId` actual.
- **Primer uso**: el jugador no necesita entender `hexId`; el lenguaje es siempre físico ("la misma ficha del tablero" / "otra distinta").
- **Error**: si el server rechaza el `hexId` (ya no existe), toast "Esa ficha cambió. Vuelve a elegir." y reabrir el paso.

### Cambio en `RobberHexList`
Ahora puede haber varias entradas con el mismo número+recurso. Para distinguirlas:
- Mantener una fila por `hexId`.
- Cuando dos o más hexes comparten número+recurso, **etiquetarlos** con un sufijo desambiguador derivado de sus dueños, NO un id técnico. Prioridad de etiqueta:
  1. Por dueños: "8 trigo · de Ana" / "8 trigo · de Beto y Carla". Es lo más útil para decidir a quién robar.
  2. Si dos comparten dueños o no tienen, añadir índice ordinal humano: "8 trigo (1)" / "8 trigo (2)", estable por orden del server.
- Visualmente, el bloque de `owners` (chips color + P/C) ya existente es la clave principal; el sufijo de texto es el refuerzo. Resaltar la diferencia para que dos filas "8 trigo" nunca se vean idénticas.
- `aria-label` de cada opción debe incluir la desambiguación: "Mover ladrón a 8 trigo de Ana".

### Jerarquía y copy
- Sheet: número/recurso (entrada) → "¿Es la misma ficha que ya está en juego, o una nueva?" (decisión) → CTA.
- "Ya hay una ficha {n} {recurso} en juego. ¿Es la misma?"
- "La tocan: {dueños}" · "Es una ficha nueva (otra distinta en el tablero)"
- RobberHexList: "8 trigo · de Ana", "8 trigo (2)".

### Criterios de éxito
Dos fichas "8 trigo" físicamente distintas aparecen como dos entradas distinguibles tanto al registrar como en la lista del ladrón. El caso común (sin colisión) no gana ningún tap extra.

---

## 6. Reglas extra (toggles del anfitrión)

### Ubicación común
Nueva sección "Reglas extra" en el lobby (anfitrión), con el mismo patrón de fila-toggle de "Extensión 5–6". Dos toggles independientes, ambos default **OFF**. No-anfitriones ven una línea informativa con las reglas activas ("Reglas extra: Intercambios desiguales, Puertos ajenos") o "Reglas extra: ninguna".

---

### 6a. Intercambios desiguales

#### Problema
El `TradeModal` (tab Jugadores) bloquea ofertas con un lado en 0 (`submitOffer` rechaza `giveTotal === 0 || receiveTotal === 0`). Eso impide regalar cartas o pedir sin dar, que algunos grupos permiten.

#### Solución de UX
- Cuando el modo está **OFF** (default): sin cambios, el bloqueo sigue.
- Cuando está **ON**: se permite que un lado sea 0.
  - `submitOffer` deja de exigir ambos lados > 0; exige solo que la oferta no sea totalmente vacía (`giveTotal + receiveTotal > 0`).
  - Mostrar un texto contextual cuando un lado queda en 0, para que sea intencional y no un error:
    - Solo "Doy" con cartas, "Recibo" en 0 → "Estás regalando estas cartas."
    - Solo "Recibo" con cartas, "Doy" en 0 → "Estás pidiendo sin dar nada a cambio."
  - El receptor de la oferta debe ver claramente el desbalance en su vista de oferta entrante (regalo vs petición), con el mismo copy.
- Si el modo está OFF y el usuario intenta una oferta desbalanceada, conservar el mensaje actual "Tu oferta necesita cartas en ambos lados." pero, si es anfitrión, podría sugerir activar la regla (opcional, baja prioridad).

#### Copy sugerido
"Estás regalando estas cartas." · "Estás pidiendo sin dar nada a cambio." · Toggle: "Intercambios desiguales (regalar o pedir sin dar)".

---

### 6b. Usar puertos ajenos

#### Problema
En tu turno quieres usar el puerto de otro jugador (regla de casa). No existe flujo: el `TradeModal` solo intercambia con el banco usando **tus** puertos, o con jugadores. Falta un flujo de permiso + posible comisión.

#### Solución de UX — un tercer tab "Puerto de otro"
El `TradeModal` pasa de 2 a 3 tabs: **Banco / Puertos · Jugadores · Puerto de otro** (este último solo aparece si la regla está ON). Confirmar con ux-writer si el header de tabs cabe en móvil; si no, abreviar a "Banco · Jugadores · Puerto ajeno".

**Lado del solicitante (tu turno):**
1. Elegir **dueño de puerto**: lista de jugadores que tienen puertos (chips color + nombre + qué puertos tienen, p. ej. "2:1 trigo, 3:1").
2. Tras elegir dueño, se muestran **sus** puertos como proporciones disponibles; el solicitante arma un intercambio de banco (Doy / Recibo) idéntico al tab Banco pero con la proporción del puerto ajeno.
3. El sistema calcula la posible **comisión**: el solicitante envía la **solicitud** (no se ejecuta aún). CTA: "Pedir permiso a {dueño}".
4. Estado tras enviar: "Esperando que {dueño} apruebe…" con opción "Cancelar solicitud". Bloquea reenvíos (patrón `hasActiveOffer`).

**Lado del dueño del puerto (aprobador):**
- Recibe un aviso (toast accionable + entrada en el modal cuando lo abra): "**{solicitante}** quiere usar tu puerto {tipo} para cambiar X→Y."
- Tres acciones:
  1. **Aprobar gratis** (emerald): el intercambio de banco se ejecuta para el solicitante, sin comisión.
  2. **Aprobar con comisión**: el dueño define N cartas de recurso a cobrar (stepper por recurso, reusa `ResourceSteppers`). El solicitante paga esas cartas al dueño además del intercambio. CTA: "Aprobar y cobrar {resumen comisión}".
  3. **Rechazar** (neutro, no rojo): "Rechazar". El solicitante recibe "Tu solicitud fue rechazada."
- Si el dueño pide comisión, el solicitante ve una **segunda confirmación**: "{dueño} pide {comisión} por usar su puerto. ¿Aceptas?" → "Pagar y cambiar" / "Cancelar". Solo entonces se ejecuta. (Esto evita cobrar sin consentimiento del solicitante.)

#### Estados
- **Sin jugadores con puerto**: el tab muestra empty "Nadie tiene puertos registrados." → sugerir registrar puertos en "Mis puertos".
- **Solicitante sin cartas** para el intercambio o para la comisión: deshabilitar CTA con motivo ("Te faltan cartas para la comisión").
- **Dueño desconectado / no responde**: la solicitud expira (server) → "Tu solicitud expiró. Inténtalo de nuevo."
- **Fuera de turno**: el tab "Puerto de otro" solo es accionable en tu turno; si no es tu turno, mostrar "Solo puedes usar puertos ajenos en tu turno."
- **Regla OFF**: el tab no se renderiza.

#### Jerarquía y copy
- Solicitante: elegir dueño → armar cambio → "Pedir permiso a {dueño}" → esperar → (si comisión) "Pagar y cambiar".
- Dueño: "Aprobar gratis" / "Aprobar y cobrar {comisión}" / "Rechazar".
- "{solicitante} quiere usar tu puerto {tipo}." · "Comisión (opcional)" · "Tu solicitud fue rechazada." · "Tu solicitud expiró."
- Toggle: "Usar puertos ajenos (con permiso del dueño)".

#### Criterios de éxito
El solicitante completa un intercambio por puerto ajeno con permiso explícito del dueño; el dueño puede cobrar comisión y ningún jugador paga sin haber confirmado el monto. Todo el flujo vive en el `TradeModal`, sin pantallas nuevas.

---

## Mapa de archivos a tocar (referencia para ui-engineer)

- **Lobby (todos los cambios de lobby)**: `client/src/screens/LobbyScreen.tsx` — expulsar (§2), toggle recursos de inicio (§3), fix layout barra fija (§4), sección "Reglas extra" (§6), botón "Invitar amigos" + sheet (§1).
- **Registro de fichas**: `client/src/components/InitialBuildSetup.tsx` (`SpotPickerSheet`, card "Tus poblados de salida") — paso de agrupar/crear `hexId` (§5), copy del modo sin recursos (§3). `client/src/components/ConstructionTable.tsx` reusa `SpotPickerSheet` (§5) y contiene `RobberHexList` (etiquetado §5).
- **Intercambios**: `client/src/components/TradeModal.tsx` — intercambios desiguales (§6a), tab "Puerto de otro" (§6b).
- **Ladrón**: `client/src/components/RobberFlow.tsx` y `RobberHexList` en `ConstructionTable.tsx` — desambiguación (§5).
- **Amigos (pantalla nueva)**: nuevo componente/screen (p. ej. `client/src/screens/FriendsScreen.tsx`) + entradas en Home/Profile + avisos vía `pushToast`.

## Reglas transversales (todas las features)
- Touch targets ≥44px (los X/steppers existentes ya usan `h-11 w-11`).
- Tonos: emerald = acción/confirmar, amber = pendiente/advertencia, sky = info, red = destructivo (expulsar, eliminar amigo). Rechazar solicitud/oferta = neutro, no rojo.
- Sheets y modales: reusar `useModalA11y`, `anim-slide-up`, y el patrón `role="dialog"`/`alertdialog` ya establecido. Respetar `reduced-motion`.
- Estados informativos para no-anfitriones en vez de controles ocultos sin explicación.
