# Design brief — Cambios v2 (capa UI)

> UX Architect. Mobile-first, dark theme (surface-1/2/3), UI español 2ª persona,
> código inglés. emerald=acción, amber=pendiente/advertencia, sky=info,
> red=destructivo, touch ≥44px. **El backend/contrato lo implementa el autor del
> prompt; este brief diseña SOLO la capa de UI.**

## Supuestos declarados (no se entrevistó)

- `purple` se agrega a `PlayerColor`, `BASE_COLORS`/`EXTENSION_COLORS` y a los
  diccionarios `PLAYER_HEX`, `BORDER`, `COLOR_NAMES`. El backend ya valida
  unicidad de color como hoy.
- Los nuevos toggles del anfitrión se agregan a `ExtraRules` (o a state) y se
  propagan por `setExtraRules`/`state`, con el mismo patrón que `unequalTrades` /
  `sharedPorts`.
- `PortUseRequest` se amplía con un estado de comisión y un paso de confirmación
  del solicitante (campos del lado servidor; aquí solo se diseña qué se ve).
- `TradeOffer.receive` es lo que entrega quien acepta; el server ya puede decir si
  el receptor tiene esas cartas (campo derivado tipo `canAfford` en la vista, o se
  deriva en cliente desde `me.hand`). Diseñamos asumiendo que el dato existe.
- `morado` se escribe siempre con acento. Nombre canónico de color: **"Morado"**.

---

## 1) Color morado

**Problema.** Hay que sumar un 7º color sin romper la diferenciación cromática ni
los contrastes ya verificados sobre las superficies cálidas/oscuras.

**Solución UX.**
- El selector de color del lobby (`LobbyScreen.tsx`, sección "Tu color") ya itera
  `colorsAvailable`; al añadir `purple` a `BASE_COLORS`/`EXTENSION_COLORS` aparece
  solo, sin cambios de layout (los chips ya hacen wrap en `flex-wrap`). Verificar
  que `purple` quede disponible en **todos los modos** (base y extensión), según
  el contrato.
- `ColorChip` y cualquier leyenda (PublicPlayersPanel, TopBar accent, cola de
  construcción especial, RobberHexList) heredan el color automáticamente vía
  `PLAYER_HEX`/`playerHex`. No requieren cambios de marcado.
- Hex recomendado: un morado medio-frío legible sobre madera y sobre dark:
  `#8a5cd1` (cuerpo). Debe diferenciarse de `blue #3b6dd1` (más azul/frío) y de
  `red #d64545`. Borde como los demás colores oscuros: `rgba(0,0,0,0.45)`.
  El visual-designer debe validar contraste vs. azul y vs. el fondo y, si hace
  falta, ajustar el token canónico `--player-purple` en `index.css` +
  `tailwind.config.js` + `PLAYER_HEX` (los tres en sincronía, como advierte el
  comentario de `playerColors.ts`).
- `COLOR_NAMES.purple = 'Morado'`.

**Estados.**
- *Disponible:* chip + "Morado", tappable.
- *Tomado por otro:* `line-through` + "(Nombre)", deshabilitado (patrón existente).
- *Mío:* borde emerald + `aria-pressed`. Sin estado especial nuevo.
- *Badge "Nuevo":* el morado NO necesita el badge "Nuevo" que llevan verde/café al
  activar extensión (ese badge marca colores que aparecen al activar el modo; el
  morado está siempre presente).

**Copy.** `Morado`. aria-labels reutilizan los existentes: "Elegir color Morado",
"Color Morado (lo tiene {nombre})", "Color Morado (tu color actual)".

**Riesgo a vigilar.** `EXTENSION_COLORS` se usa para la lógica de "deshabilitar
extensión si hay colores de extensión en uso" (LobbyScreen ~L208). Si `purple` es
base (disponible siempre), NO debe entrar en esa comprobación `extColorsTaken`.
Anotar al ui-engineer.

---

## 2) Inicio sin recursos = 2 poblados vacíos (solo verificación de copy)

**Problema.** El cambio es backend (cada jugador arranca con 2 poblados sin
fichas). La UI no debe prometer algo distinto.

**Solución UX.** El copy actual ya es coherente, con un matiz:
- `InitialBuildSetup.tsx` L177–180 dice: *"Mira el tablero y registra las fichas
  con número que tocan tus 2 poblados. Al iniciar recibes 1 carta por cada ficha
  registrada."* — Esa última frase **solo es verdad en modo con recursos**. En
  modo sin-recursos (`seedInitialResources === false`) hay que cambiarla para no
  prometer cartas.
- Copy propuesto cuando `!seedOn`:
  > "Mira el tablero y registra las fichas que tocan tus 2 poblados. En esta
  > partida no se reparten recursos al iniciar, así que registrar es opcional;
  > ya empiezas con tus 2 poblados colocados."
- Mantener el copy actual cuando `seedOn`.
- La línea informativa del toggle del anfitrión (LobbyScreen L491) ya dice "Se
  inicia sin fichas: nadie recibe recursos y registrar tus poblados es opcional."
  → Coherente. Solo añadir, si cabe, "(ya empiezas con tus 2 poblados)".
- El no-anfitrión (L575) dice "Se inicia sin fichas: no recibirás recursos y
  registrar tus poblados es opcional." → añadir "Ya empiezas con tus 2 poblados."

**Estados.** Sin estados nuevos. Solo condicionar el texto a `seedOn`.

---

## 3) Confirmación al eliminar poblado/ciudad (ConstructionTable)

**Problema.** Hoy "Quitar" borra la construcción inmediatamente (L262–267). Es
destructivo e irreversible (pierde el edificio y todas sus fichas) sin confirmar.

**Solución UX.** Alertdialog rojo, mismo patrón que `KickConfirm` (LobbyScreen) y
`ConfirmEmptySteal`, usando `useModalA11y`. El botón "Quitar" abre el diálogo;
solo el botón rojo de confirmación ejecuta `removeBuilding`.
- Estructura: `role="alertdialog"`, `aria-modal`, `aria-labelledby`/`describedby`,
  cierre por ESC = cancelar, focus trap, foco inicial en "Cancelar" (acción segura
  por defecto en diálogos destructivos).
- El estado vive en `ConstructionTable` como `removeTarget: { id, label, n } | null`
  (label = "Poblado 2"/"Ciudad 1"; n = número de fichas registradas, para
  advertir de la pérdida).

**Estados.**
- *Sin fichas registradas:* el cuerpo no menciona pérdida de fichas.
- *Con fichas:* el cuerpo advierte cuántas fichas se borran.
- *Error/desconexión:* hereda el comportamiento de `setBuildings` (autosave); el
  diálogo solo dispara la mutación y se cierra.

**Copy.**
- Título: `¿Quitar {label}?` (p. ej. "¿Quitar Poblado 2?").
- Cuerpo sin fichas: "Se eliminará de tu tabla de construcción. Podrás volver a
  agregarlo desde Construir."
- Cuerpo con fichas: "Se eliminará junto con sus {n} {fichas/ficha} registradas.
  Podrás volver a agregarlo desde Construir." (usa singular/plural).
- Botones: `Cancelar` (neutro) · `Sí, quitar` (rojo, `border-red-500/40
  bg-red-500/[0.08] text-red-300`).
- aria-label del disparador "Quitar": dejar `Quitar {label}` para lectores.

---

## 4) Toggle "Desactivar construcción especial" (solo modo 5–6)

**Problema.** Nuevo control del anfitrión, relevante únicamente cuando
`extension56` está activa (la fase de construcción especial solo existe en 5–6).
No debe aparecer en base 3–4 ni añadir ruido.

**Solución UX.** Fila-toggle en la sección "Reglas extra" (LobbyScreen), idéntica
en estilo a `ExtraRuleToggle`. **Renderizar el toggle solo si `state.extension56`**.
Como "Reglas extra" hoy es una lista plana, agruparlo bajo un sub-encabezado
condicional opcional ("Solo en 5–6 jugadores") si se acumulan reglas de extensión;
con una sola, basta el toggle suelto.
- Semántica de copy: el toggle es por defecto OFF (la construcción especial está
  activa por defecto). Activar el toggle = quitar la fase. Para que el switch sea
  legible (ON = se aplica lo que dice el título), el título debe describir el
  estado activado.

**Estados.**
- *extension56 OFF:* el toggle no se monta. Si el anfitrión lo había activado y
  luego desactiva la extensión, el backend decide si persiste; en UI simplemente
  desaparece. Anotar: al re-activar extensión debe reflejar el valor real del
  state (no asumir OFF).
- *No-anfitrión:* aparece en "Reglas de la partida" (solo lectura) únicamente si
  está activo y la extensión activa. Texto: "Construcción especial: desactivada".

**Copy.**
- Título: "Desactivar construcción especial".
- Ayuda: "Quita la fase de construcción especial de los turnos en partidas de 5–6.
  Nadie podrá construir fuera de su turno."

---

## 5) Toggle "El ladrón no roba en la primera ronda"

**Problema.** Nuevo toggle del anfitrión, sin dependencia de modo.

**Solución UX.** Otra fila `ExtraRuleToggle` en "Reglas extra". Default OFF.
Disponible en todos los modos.

**Estados.**
- *No-anfitrión:* si está activa, aparece en "Reglas de la partida" como string en
  la lista `activeExtraRules` ("El ladrón no roba en la primera ronda").

**Copy.**
- Título: "Ladrón sin robo en la 1ª ronda".
- Ayuda: "Durante la primera ronda, mover el ladrón bloquea producción pero no
  roba cartas a nadie."
- (Consistencia: añadir el string a `activeExtraRules` y al resumen del no-host.)

---

## 6) Construcción especial 5–6: solo construye el jugador opuesto (SpecialBuildBanner)

**Problema.** El backend ahora limita la construcción especial al jugador opuesto
al que acaba de terminar turno (antes la cola incluía a varios). El banner ya está
construido alrededor de una **cola** (`specialBuildQueue`) con head/next/later.
Hay que asegurar que comunique con claridad quién puede construir y que no sugiera
falsamente que otros podrán.

**Solución UX.** Si el backend reduce `specialBuildQueue` a **un solo jugador**, el
banner ya se comporta bien: muestra solo el head, sin "Después:" ni next/later. Hay
que afinar el copy y el caso de cola unitaria:
- *Para el jugador en turno (head.id === me.id):* el header actual "Construcción
  especial — es tu turno" es correcto. Refuerzo opcional: "Es tu turno de
  construcción especial. Construye o compra una carta de desarrollo." (ya cubierto
  por subtitleText).
- *Para los demás:* hoy el subtítulo dice "Eres siguiente / Vas en N / Ya
  pasaste". Con la regla nueva, **nadie más está en cola**, así que esos textos no
  deben aparecer. Para quien no es el constructor el mensaje debe ser claramente
  pasivo: "Construcción especial — turno de {head.name}" + subtítulo "Espera. En
  esta fase solo construye {head.name}."
- Como la cola será unitaria, la mini-cola visual mostrará un solo `QueueItem`
  (head). Aceptable; opcionalmente ocultar la mini-cola cuando `queue.length === 1`
  para reducir ruido (el header ya nombra al jugador).
- La acción "Saltar" del host/banco sigue válida (saltar a ese único jugador).

**Estados.**
- *queue vacía:* el banner ya retorna null.
- *queue de 1 (caso nuevo normal):* sin flechas, sin "Después:", subtítulo pasivo
  para no-constructores.
- *head desconectado:* "Saltar" inmediato (ya implementado).

**Copy.**
- No-constructor: subtítulo "Espera. En esta fase solo construye {head.name}."
- Si la regla del ítem 4 ("Desactivar construcción especial") está activa, esta
  fase no debe entrarse: el banner no se monta. Sin copy adicional.

---

## 7) Aceptar intercambio sin recursos (TradeIncomingModal)

**Problema.** Hoy si el receptor acepta sin tener lo que pide la oferta (`receive`),
la oferta se cancela para todos. Nuevo comportamiento: el botón "Aceptar" debe estar
**deshabilitado con razón visible** para quien no pueda cumplir; los demás siguen
pudiendo aceptar.

**Solución UX.** En `ReceiverDialog`:
- Calcular `canAfford`: el receptor tiene en su mano (`me.hand`) cada recurso de
  `trade.receive` en la cantidad pedida. (Usar dato derivado del server si existe,
  o derivar en cliente.)
- Si `!canAfford`: botón "Aceptar" en estado deshabilitado (no clickable), con una
  línea de razón justo encima/debajo del par de botones. El botón "Rechazar" sigue
  habilitado (la salida siempre disponible).
- El bloque "Te pide" ya lista los recursos; resaltar en `red-300` los que le
  faltan ayuda a entender por qué no puede aceptar (opcional pero recomendado: por
  cada chip de `receive`, si `me.hand[r] < n`, marcar el chip con borde rojo y
  añadir "(te faltan X)").
- Reemplaza la frase actual L178-180 ("Si ya no tienes lo que pide, el intercambio
  no se hará.") por la nueva semántica: ya no se cancela para todos, solo no puedes
  aceptar tú.

**Estados.**
- *canAfford = true:* botón emerald "Aceptar", habilitado (igual que hoy).
- *canAfford = false:* botón deshabilitado, estilo
  `cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500`
  (mismo patrón que el CTA deshabilitado del lobby), `aria-disabled`,
  `aria-describedby` apuntando a la razón. La razón debe ser un nodo visible
  (no solo title), por contraste y a11y.
- *Receptor cambia de mano mientras el modal está abierto* (recibió/perdió
  cartas): el estado debe recalcularse en cada render desde `me.hand`, así el
  botón se habilita/deshabilita en vivo.

**Copy.**
- Razón (deshabilitado): "No tienes las cartas que pide." (corta, junto al botón).
- Detalle por chip (opcional): "(te falta 1 trigo)" usando `RESOURCE_NAMES_LOWER`
  y `joinList` si son varios → "Te faltan 1 madera y 2 trigo."
- Nota general reemplazada: "Al aceptar entregas lo que te pide y recibes lo que te
  da."
- Mantener "Rechazar" / "Aceptar".

---

## 8) Puerto ajeno con confirmación de comisión (sharedPorts) — flujo de 3 pasos

**Problema.** Hoy el dueño del puerto cobra comisión sin que el solicitante lo
confirme. Nuevo flujo: (1) solicitante pide usar el puerto → (2) dueño aprueba y
fija comisión o gratis → (3) si hay comisión, el SOLICITANTE confirma o rechaza el
cobro antes de ejecutar; si es gratis, se ejecuta directo.

**Solución UX.** Nuevo `PortFeeConfirmModal.tsx` (componente nuevo) para el paso 3,
más estados de espera en ambos lados. El modal del solicitante es el modal
bloqueante clave; los estados de espera son paneles sticky tipo "status"
(reutilizar el patrón `SenderPanel` de TradeIncomingModal: `role="status"`,
`aria-live="polite"`, sticky inferior).

**Flujo y vistas por rol** (asumiendo `PortUseRequest` con estados
`pending` → `approved(fee)` → `confirmed`/`rejected`):

- **Solicitante, paso 1 (pending):** panel sticky "Esperando a {dueño}: pediste
  usar su puerto {tipo}." con botón "Cancelar solicitud".
- **Dueño, paso 2:** modal/sheet de aprobación (puede ser otro componente o reusar
  un sheet existente; fuera del foco de este ítem pero referenciado): elige
  "Gratis" o fija comisión (1 recurso). Diseñar como pares: opción Gratis +
  selector de recurso de comisión. No detallado aquí salvo su copy.
- **Solicitante, paso 3 (approved con comisión) → `PortFeeConfirmModal`:**
  modal bloqueante (`role="dialog"`, `aria-modal`, `useModalA11y`, ESC = rechazar).
  Contenido:
  - Título: "{dueño} aprobó tu uso del puerto".
  - Resumen del trade del puerto: "Cambias {give×ratio} → {receive}" con
    `ResourceIcon` (reusar `ChipList`/`ResourceLine`).
  - Bloque de comisión destacado en amber: "Comisión: {n} {recurso}" con icono.
  - Total claro: "Pagas en total: {recursos del cambio} + {comisión}."
  - Botones: "Rechazar" (neutro) · "Confirmar y cambiar" (emerald).
- **Solicitante, paso 2 (approved gratis):** sin modal — se ejecuta directo; mostrar
  toast/notice "Listo: usaste el puerto de {dueño} sin comisión."
- **Dueño, esperando confirmación (paso 3):** panel sticky "Esperando a {solicitante}:
  debe confirmar la comisión de {n} {recurso}." con "Cancelar".

**Estados.**
- *Solicitante sin recursos para pagar (cambio + comisión):* botón "Confirmar"
  deshabilitado con razón "No tienes lo necesario para el cambio y la comisión."
  (mismo patrón de deshabilitado del ítem 7).
- *Dueño cancela tras aprobar / solicitante rechaza:* cerrar modal, toast neutro
  ("Se canceló el uso del puerto."). Sin penalización.
- *Comisión = 0 / gratis:* no se monta el modal de confirmación (ejecución directa).
- *Desconexión a mitad:* el modal refleja el `PortUseRequest` del state; si el
  request desaparece (cancelado/expiró), el modal se cierra (igual que
  TradeIncomingModal cuando `activeTrade` es null).

**Copy.**
- Solicitante pending: "Esperando a {dueño}." / "Pediste usar su Puerto {tipo}."
- Modal confirmación, título: "{dueño} aprobó tu uso del puerto".
- Comisión: "Comisión del puerto: {n} {recurso}." (amber).
- CTA: "Confirmar y cambiar" / "Rechazar".
- Gratis (notice): "{dueño} te dejó usar su puerto sin comisión."
- Deshabilitado: "No te alcanza para el cambio más la comisión."

---

## 9) Regla extra "Ladrón en ficha vacía da recurso"

**Problema.** Nuevo toggle del anfitrión + comunicar el premio cuando se otorga.

**Solución UX.**
- Toggle: otra fila `ExtraRuleToggle` en "Reglas extra". Default OFF. Disponible en
  todos los modos. Añadir a `activeExtraRules` para el resumen del no-host.
- Comunicación del premio: cuando el backend otorga 1 recurso aleatorio (ladrón a
  ficha sin dueños o desierto), mostrar un **notice/NoticeBanner** (sky=info, o
  emerald por ser ganancia) al jugador que movió el ladrón. Usar el componente
  `NoticeBanner` existente. El recurso recibido se muestra con `ResourceIcon`.
- El aviso debe ser personal para quien movió (positivo) y, si la mesa lo ve en el
  Log, en tono de transparencia (como el resto de avisos del banco): "{jugador}
  movió el ladrón a una ficha vacía y el banco le dio 1 carta." (sin revelar el
  tipo si se quiere mantener oculto; pero al ser recurso, normalmente es público —
  coordinar con el contrato).

**Estados.**
- *Ladrón a ficha CON dueños:* sin premio, sin notice (comportamiento normal).
- *Ladrón a ficha vacía o desierto + regla ON:* notice con el recurso.
- *Regla OFF:* sin cambios.
- *Banco sin esa carta:* el backend decide; si no se entrega, el notice no aparece
  o dice "El banco no tenía cartas para darte." (coordinar con contrato).

**Copy.**
- Toggle título: "Ladrón en ficha vacía da recurso".
- Ayuda: "Si mueves el ladrón a una ficha sin poblados o al desierto, el banco te
  da 1 recurso al azar."
- Notice al jugador: "El banco te dio 1 {recurso} por mover el ladrón a una ficha
  vacía." (con `ResourceIcon`).
- Log público: "{jugador} recibió 1 carta del banco (ladrón en ficha vacía)."

---

## Resumen de archivos a tocar

| Ítem | Archivos UI |
|---|---|
| 1 morado | `lib/playerColors.ts`, `lib/spanish.ts` (COLOR_NAMES), `types.ts` (BASE_COLORS), `ColorChip.tsx` (BORDER), `index.css`/`tailwind.config.js` (token) |
| 2 copy sin-recursos | `InitialBuildSetup.tsx`, `LobbyScreen.tsx` |
| 3 confirmar quitar | `ConstructionTable.tsx` (+ alertdialog inline, patrón KickConfirm) |
| 4 desactivar constr. especial | `LobbyScreen.tsx` (ExtraRuleToggle condicional a extension56) |
| 5 ladrón sin robo 1ª ronda | `LobbyScreen.tsx` |
| 6 constr. especial 5–6 | `SpecialBuildBanner.tsx` (copy + cola unitaria) |
| 7 aceptar sin recursos | `TradeIncomingModal.tsx` |
| 8 puerto ajeno + comisión | nuevo `PortFeeConfirmModal.tsx`, paneles de espera (patrón SenderPanel), `LobbyScreen` help text del toggle sharedPorts |
| 9 ladrón ficha vacía | `LobbyScreen.tsx`, `NoticeBanner.tsx` (uso), Log |

## Criterios de éxito

- Ningún flujo destructivo (quitar construcción) ejecuta sin confirmación.
- El selector de color muestra 7 colores diferenciables y accesibles; morado pasa
  contraste vs. azul y vs. fondo.
- En modo sin-recursos ningún copy promete cartas al iniciar.
- En construcción especial 5–6 solo el jugador habilitado ve "es tu turno"; el
  resto ve un mensaje pasivo, sin sugerir que podrán construir.
- Nadie puede aceptar un intercambio/uso de puerto que no puede pagar; el botón
  queda deshabilitado con razón visible (no solo title) y a11y correcta.
- El cobro de comisión de puerto nunca se ejecuta sin confirmación explícita del
  solicitante cuando hay comisión.

## Handoff

- **`ui-engineer`** — receptor principal: ítems 2, 3, 4, 5, 6, 7, 8, 9 (lógica de
  estados, componentes nuevos, copy condicional, deshabilitados a11y).
- **`visual-designer`** — ítem 1: definir/validar el token `--player-purple` y su
  contraste frente a azul y a las superficies; ajustar `PLAYER_HEX` y los tres
  espejos de color. También revisar el realce rojo de chips faltantes (ítem 7) y
  el bloque amber de comisión (ítem 8).
- **`ux-writer`** — validar microcopy de los ítems 3, 7, 8, 9 (mensajes
  destructivos, razones de deshabilitado, notices del banco en tono de
  transparencia).
