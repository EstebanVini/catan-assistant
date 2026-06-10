# Design Brief — Catan Assistant (Fase 2 Recomendadas)

**Autor:** ux-architect
**Destinatario siguiente:** ui-engineer
**Alcance:** 6 features sobre el MVP cerrado — cartas de desarrollo completas, marcador de VP + insignias, pantalla de ganador, extensión 5–6 + Construcción Especial, estadísticas de dados, notificaciones de turno.
**Continuidad:** este brief asume el `ux-brief-mvp.md` como contrato vigente. Los 8 principios rectores siguen aplicando. Sólo se añaden matices abajo.

---

## 0. Principios añadidos para Fase 2

Los 8 del MVP siguen vigentes. Sobre ellos:

9. **El peso del evento se siente en la UI.** Monopolio mueve muchas cartas a la vez; YoP toma del banco. Estas acciones merecen confirmación y feedback distintos de "construir un camino".
10. **Las insignias son símbolos, no medallas.** Ejército y Camino más largo se muestran con icono propio reconocible. No se sobrecargan de oro/brillos.
11. **Casi-victoria es información pública.** Si alguien llega a ≥10 VP visibles + ocultas en su turno, el CTA de declarar aparece en su pantalla — pero el resto sólo ve el conteo visible (≥10 si todos sus VPs son públicas). Las hidden VP nunca se filtran antes de declarar.
12. **El ganador no es un fuegos artificiales.** Pantalla sobria con color del ganador, desglose de puntos y un par de métricas de la partida. Nada caricaturesco.
13. **Construcción especial es una micro-fase, no un turno.** Visual menos pesado que el banner contextual normal — debe transmitir "esto es un paréntesis", no "esto es un turno nuevo".

---

## 1. Modal "Jugar carta de desarrollo" (completo)

Hoy `GameScreen.PlayDevModal` sólo ofrece Caballero. Se extiende a las cinco cartas con sus sub-flujos.

### Objetivo del usuario
Desde "Jugar carta de desarrollo", elegir una de mis cartas elegibles y completar el sub-flujo de esa carta en ≤2 taps adicionales (excepto en Monopolio que requiere confirmación).

### Entrada al modal
- Botón "Jugar carta de desarrollo" en `ActionGrid` (sigue como hoy).
- Sólo habilitado en mi turno, `phase = 'main'`.
- Deshabilitado con razón explícita en `phase = 'specialBuild'`, `phase = 'roll'`, `phase = 'discard'`, `phase = 'robber'` o turno ajeno (igual que hoy).

### Estructura del modal (`PlayDevModal` ampliado)

**Header**
- Título: "Jugar carta de desarrollo".
- Subtítulo: "No puedes jugar una carta comprada este turno." (ya existe).
- Si ya jugó una carta este turno: subtítulo adicional "Sólo se puede jugar una carta por turno." y todas las cartas deshabilitadas con esa razón.

**Lista de cartas — una fila por tipo elegible**

| Carta | Subtítulo del item | Estado disabled |
|---|---|---|
| Caballero | "Mueve el ladrón y roba 1 carta." | Si `available <= 0`. |
| Monopolio | "Toma todas las cartas de 1 recurso de los demás." | Si `available <= 0`. |
| Año de la abundancia | "Toma 2 recursos del banco." | Si `available <= 0` o si **banco totalmente vacío** (caso extremo). |
| Construcción de caminos | "Coloca 2 caminos físicos sin costo." | Si `available <= 0`. |
| Punto de victoria | No aparece en la lista. Es informativa. | — |

Cada fila muestra a la derecha el conteo disponible (`×N`) con el desglose `nueva` cuando aplique, igual que el modal actual. Cartas con conteo `0` simplemente se omiten de la lista (no fila gris).

**Sección "VP ocultas" (privada)**
Debajo de la lista, si `me.devCards.vp > 0`:
- Card destacada en tono ámbar neutro (no warn).
- Texto: "Tienes N punto(s) de victoria oculto(s). Suman al final."
- Sin botón. Informativa.

**Footer**: botón "Cerrar".

### Sub-flujos

#### 1.1 Caballero
**Sin cambios respecto al MVP.** Cierra el modal y reusa el flujo del 7 (`pendingRobberMove` → `pendingRobberSteal`). Misma microinteracción que hoy.

#### 1.2 Monopolio

Sub-modal nuevo (`MonopolyPickerModal`).

**Objetivo**: el activo elige 1 recurso y todos los demás le entregan todas sus cartas de ese recurso.

**Estructura**
- Header: "Monopolio".
- Texto explicativo (1 línea): "Elige un recurso. Todos los demás te darán todas sus cartas de ese recurso."
- Grid 5x1 de **botones grandes** (mín. 88x88), cada uno con `ResourceIcon` (size 32) + nombre del recurso debajo. Touch target generoso.
- Sin botón "Cancelar" oculto: botón "Cancelar" abajo (full width secundario).
- Botón primario "Confirmar Monopolio sobre [Recurso]" sólo aparece tras tap de un recurso. Mientras no haya selección, dice "Elige un recurso" deshabilitado.
- **Por qué confirmación**: es disruptivo. Tap accidental sobre "Mineral" cuando querías "Madera" puede definir la partida. Confirmación obligatoria.

**Estado seleccionado**: el recurso elegido tiene borde fuerte (color del recurso) y leve elevación. Los otros 4 se atenúan a 60%.

**Micro-confirmación textual antes del confirm**: bajo el botón "Confirmar", una línea pequeña: "Esto es definitivo." Sin segundo modal.

**Estados**
- `idle`: ningún recurso seleccionado.
- `selected`: recurso elegido, botón habilitado.
- `submitting`: tras tap "Confirmar", botón loading. Bloquear taps.
- `error`: si el server rechaza (no debería ocurrir si validación es coherente), toast + volver a `selected`.

**Resultado / microinteracción crítica**
- Cuando el servidor procesa: log público "Monopolio: María tomó todas las [cartas] de [Recurso] (N cartas)".
- En la mano del activo: el chip del recurso ganado pulsa con delta `+N` (HandView ya soporta deltas; basta con que llegue el cambio).
- En los `PublicPlayersPanel.cards` de los víctimas: pulso `anim-pulse-scale` (ya existe) y `cardCount` baja. **Stagger** entre cards: el motion-engineer puede escalonar 80ms por víctima para que se sienta el barrido.
- Toast efímero para el activo: "Tomaste N [recurso] del Monopolio." Para las víctimas: "Perdiste N [recurso] (Monopolio de María)."

**Casos extremos**
- **Monopolio sin víctimas** (nadie tiene ese recurso): el server resuelve normal, llega `0` ganado. Log: "Monopolio: nadie tenía [Recurso]." Sin error, sin toast negativo. En la UI del activo: toast neutro "Nadie tenía [Recurso]." Sin pulso de delta.
- **Activo tiene `n` del recurso antes**: no afecta. Sólo cuentan las cartas ajenas que vienen.
- **Víctima desconectada**: el server tiene sus manos en estado autoritativo, igual transfiere. Log lo registra. La card del desconectado pulsa cuando reconecte y vea su nuevo `cardCount`.

#### 1.3 Año de la abundancia (Year of Plenty)

Sub-modal nuevo (`YearOfPlentyPickerModal`).

**Objetivo**: el activo toma 2 recursos del banco. Permite 2 iguales si hay 2 en el banco.

**Estructura**
- Header: "Año de la abundancia".
- Texto: "Toma 2 recursos del banco. Pueden ser iguales."
- **Dos selectores idénticos** apilados verticalmente: "Recurso 1" y "Recurso 2".
- Cada selector es una fila horizontal de 5 chips de recurso (icono + cantidad disponible en banco abajo, ej "12"). Tamaño chip ≥56x72.
- Recurso con `bank[r] === 0`: chip atenuado a 40%, badge "0 en banco" debajo, no tappeable.
- Recurso con `bank[r] === 1` y ya está seleccionado en el otro selector: chip atenuado en este selector con badge "Sin stock para 2°", no tappeable.
- Indicador de progreso textual: "Has elegido 0/2" → "1/2" → "2/2".
- Botón primario "Tomar [r1] y [r2]" (texto refleja selección). Deshabilitado hasta tener 2 elegidos.
- Botón "Cancelar".

**Por qué dos selectores y no uno + contador**: hay que permitir 2 iguales y sentirse simétrico. Un selector con `+/-` y total `2` es más confuso para el mismo costo de espacio.

**Estados**
- `idle`: 0 elegidos.
- `partial`: 1 elegido. El otro selector limita stock dinámicamente.
- `ready`: 2 elegidos. Botón habilitado.
- `submitting`: loading.
- `bank_exhausted_total`: caso extremo abajo. El modal no abre; alerta en el modal padre.

**Microinteracciones**
- Mano del activo: chips pulsan +1 y +1 con stagger 120ms para que se distingan los dos eventos.
- Log: "Año de la abundancia: María tomó 1 trigo y 1 mineral."

**Casos extremos**
- **Banco totalmente vacío (0 en todos los recursos)**: el item "Año de la abundancia" en el modal padre se deshabilita con razón "El banco está vacío."
- **Banco con sólo 1 carta total**: el modal abre, pero tras elegir esa única opción para el selector 1, todos los recursos del selector 2 quedan a 0 → no se puede llegar a 2/2. **Decisión**: mostrar mensaje persistente arriba del modal: "El banco sólo tiene 1 carta. Sólo podrás tomar 1." Permitir confirmar con 1 sola elección (botón cambia a "Tomar [r1] del banco"). El server ya tolera esto (regla del banco corto). Log refleja "tomó 1 trigo (banco corto)".
- **Servidor rechaza por desincronización (otro jugador cambió el banco entre apertura y confirm)**: el server regresa con error; el modal recalcula el banco desde el `state:update` recibido y muestra toast "El banco cambió. Revisa tu elección." Resetea a `partial`.

#### 1.4 Construcción de caminos

Sub-modal nuevo (`RoadBuildingConfirmModal`). El más simple.

**Objetivo**: confirmar que se va a jugar la carta para que el server registre el efecto. No hay selección — el tablero es físico.

**Estructura**
- Header: "Construcción de caminos".
- Cuerpo (≤3 líneas): "Vas a colocar 2 caminos en el tablero físico sin gastar madera ni ladrillo. Tómate el tiempo de colocarlos antes de tocar 'Listo'."
- Botón primario: "Listo, ya los coloqué".
- Botón secundario: "Cancelar".

**No descuenta recursos** (la regla en la app es sólo registrar). El server simplemente loguea "María jugó Construcción de caminos." y marca `devCards.roadBuilding -= 1` y `cardsPlayedThisTurn += 1`.

**Casos extremos**
- **Jugador olvida colocar los caminos**: irrelevante para el server; el `action:undo` del bank manager puede revertir si fue un error de tap. No hay "regla" que la app deba hacer cumplir aquí.

**Microinteracción**
- Sin animaciones especiales. Log discreto.

#### 1.5 Punto de victoria (VP)

**No es jugable.** No aparece en la lista del modal. Aparece como información en la sección "VP ocultas" descrita arriba.

**Estados**
- `tengo 0 VP`: la sección no aparece.
- `tengo ≥1 VP`: card informativa "Tienes N punto(s) de victoria oculto(s). Suman al final."
- **Importante**: en el `PublicPlayersPanel` de los demás jugadores, las VP ocultas **no se filtran**. Sólo se ven cuando declaro victoria (ver §3).

---

## 2. Marcador de puntos de victoria + insignias

Refinamiento de `PublicPlayersPanel` y reglas alrededor de Ejército y Camino más largo.

### Objetivo del usuario
En un vistazo (≤2s) saber: quién tiene cada insignia, quién está más cerca de los 10, si yo puedo declarar victoria ahora.

### 2.1 Insignias en las cards de jugadores

Hoy `PublicPlayersPanel` muestra ambas insignias como `Badge tone="warn"` con texto plano "Ejército más grande" / "Camino más largo". Reemplazar por **chips con icono**.

**Diseño del chip**
- Pieza compacta de ~28x28 con icono SVG distintivo + tooltip con el nombre.
- **Ejército más grande**: icono de cascos / espadas cruzadas. Color: rojo apagado.
- **Camino más largo**: icono de camino sinuoso o muralla. Color: ámbar apagado.
- Sin emoji.
- Ambos chips llevan tooltip / aria-label con el nombre completo y los puntos: "Ejército más grande (2 pts)".
- Ubicación en la card: línea de badges, alineados a la derecha del nombre o en su propia fila si no caben.

**Visual del titular vs no-titular**
- Sólo la card del titular muestra el chip. Las demás no muestran "espacio reservado" del chip.

### 2.2 Ejército más grande (automático)

**Lógica recordatoria**: server transfiere cuando alguien supera al titular previo con ≥3 caballeros jugados. Empate: conserva el titular previo (regla oficial).

**Microinteracción crítica (transferencia)**
- Al transferir, el chip "salta" visualmente de la card origen a la card destino. Implementación sugerida (a discreción del motion-engineer):
  - **Opción A — FLIP**: medir posición del chip en origen y destino, animar con `transform: translate` en 600ms con easing. Mejor calidad.
  - **Opción B — fade-out / fade-in con highlight**: el chip se desvanece en la card origen y aparece en la card destino con `anim-pulse-scale`. Más simple, casi tan bueno.
- Toast efímero global (para todos): "[Nuevo titular] tomó Ejército más grande."
- Si es transferencia desde un titular previo, log: "Ejército más grande: pasó de Juan a María."
- Si es primera asignación (nadie lo tenía), log: "María obtuvo Ejército más grande con 3 caballeros."
- Sin sonido. Sin vibración (no requiere acción de nadie).

**Caso extremo**
- **Empate al jugar el 3° caballero**: si el desafiante empata con el titular previo, no hay transferencia. Sin animación, sin log de cambio. El log del caballero jugado se registra normal: "María jugó Caballero. Caballeros: 3."
- **Reevaluación tras `undo`**: si el bank manager deshace y la insignia revierte, **misma animación inversa**. Toast: "Ejército más grande volvió a Juan." Esto es raro pero el flujo de undo debe respetarlo.

### 2.3 Camino más largo (manual)

Hoy `PublicPlayersPanel` ya tiene un botón "Asignar Camino más largo" (bank manager / host) que abre un pop-in inline con chips de jugadores + "Nadie" + "Cancelar". Esa solución es buena.

**Decisión de diseño (tomada): mantener el botón en `PublicPlayersPanel`, no en `BankPanel`.**

**Argumentación**
- El bank manager mira las cards de los jugadores cuando alguien declara que tiene 5+ caminos. La asignación está en el mismo contexto visual: ves la card, le pones la insignia. Es semánticamente correcto.
- En `BankPanel` la decisión sería remota: tengo que recordar el orden de jugadores, buscar el nombre, asignar. Más fricción cognitiva.
- Además, el "bank manager" en MVP también puede ser un jugador normal (host). El `PublicPlayersPanel` es visible para todos; el botón "Asignar Camino más largo" sólo aparece para quien tiene permiso. Visualmente integrado.

**Mejoras al botón existente**
- Texto del botón cuando hay titular: "Cambiar Camino más largo (actual: [Nombre])". Cuando no hay: "Asignar Camino más largo".
- Confirmación inline: tras tap en un jugador, mostrar 1s un "✓ Camino más largo: María" antes de cerrar el panel. Reduce la duda de si funcionó.
- Tras quitar la insignia ("Nadie"), toast "Camino más largo: sin titular." y log.

**Microinteracción**
- Cuando se asigna nuevo titular (incluyendo "Nadie"), animar la transferencia del chip igual que Ejército (FLIP o fade).
- Si el bank manager se equivoca y vuelve a abrir el selector, no es un drama — sólo otra asignación. **No requiere undo separado.**

**Caso extremo**
- **Transferencia simultánea de insignia**: dos bank managers no existen (sólo uno por partida). El host podría hacerlo si fuera bank manager también; sigue siendo un sólo emisor. No hay carrera real.
- **Asignar a jugador desconectado**: permitido. El log lo registra y cuando el jugador reconecte verá su chip.
- **Jugador con la insignia se va de la partida**: no aplica en MVP. Asumir que se queda.

### 2.4 Banner "Casi ganan" / CTA "Declarar victoria"

Hoy `GameScreen` ya muestra el botón cuando `myVP >= 10` y es mi turno en `main`. Se mantiene y se refina.

**Comportamiento exacto**
- Sólo aparece en el dispositivo del activo, en su turno, en `phase = 'main'`.
- Condición: `myVP_total = settlements + cities*2 + (longestRoad?2:0) + (largestArmy?2:0) + hiddenVP >= 10`. El server ya envía `hiddenVP` al dueño en `myPublic`.
- Ubicación: encima de "Terminar turno" (donde está hoy), tratamiento ámbar (`shadow-cta-amber`).
- Texto del botón: "Declarar victoria con N puntos" (ya existe).

**¿Sustituye o se añade a la grilla de acciones?**
**Decisión**: **se añade arriba** de "Terminar turno", no sustituye. Razones:
1. El activo puede llegar a 10 a media construcción y querer construir aún más antes de declarar (raro, pero legítimo).
2. "Terminar turno" sigue siendo válido — declarar es opcional, no obligado.
3. Visualmente queda jerarquizado: el ámbar grande arriba grita "victoria disponible"; verde mediano abajo grita "siguiente turno".

**Casos extremos**
- **VP retroceden a <10 entre apertura y declaración (ej: undo del bank manager revirtió un caballero)**: el botón desaparece al siguiente `state:update`. Si el activo alcanzó a tappear justo antes, el server rechaza la declaración con error y toast "Ya no tienes 10 puntos."
- **Activo llega a 10 fuera de su turno** (ej. un Camino más largo manual le fue asignado mientras no es turno): NO debe aparecer el botón hasta su turno y `main`. Confirmar que el server respeta esto (sí lo hace en MVP).
- **Empate teórico a 10**: imposible — sólo el activo puede declarar y debe estar en su turno. Las VP ocultas no se filtran a otros.

**Microinteracción**
- Cuando el botón aparece por primera vez (transición de `myVP=9 → 10`), animación de entrada con `anim-slide-down` desde la posición de "Terminar turno" + `anim-pulse-scale` una vez. Vibración corta (100ms).
- Toast efímero para el activo: "Puedes declarar victoria."
- No toast para los demás (no deben enterarse de las VP ocultas).

---

## 3. Pantalla de ganador

Cuando se declara victoria, overlay full-screen sobre `GameScreen`.

### Objetivo del usuario
Cerrar la partida con sensación de cierre satisfactoria pero no infantil. Ver cómo se llegó al 10. Volver al inicio fácilmente.

### Estructura

**Overlay**
- Full-screen, `position: fixed; inset: 0; z-50`.
- Fondo: gradiente del color del ganador → negro/gris muy oscuro, no satura. El color sólo es ~25% de la pantalla (parte superior). El resto es neutro oscuro para que el texto descanse.
- Animación de entrada: fade-in 400ms + slight scale-up del contenido central (de 0.96 a 1.0).

**Bloque 1 — Anuncio (zona color)**
- Banda superior con color del ganador (gradiente vertical hacia abajo).
- Texto pequeño (12px, tracking ancho): "GANADOR".
- Nombre del ganador grande (48–64px, semibold, tracking ajustado).
- Subtítulo: "N puntos · M turnos" (un solo renglón resumen).

**Bloque 2 — Desglose de puntos** (card translúcida sobre neutro)
- Tabla simple de 5–6 filas. Cada fila: icono pequeño + label + valor (alineado derecha).
- Filas:
  - Poblados: `settlements × 1`
  - Ciudades: `cities × 2`
  - Camino más largo: `longestRoad ? 2 : 0`
  - Ejército más grande: `largestArmy ? 2 : 0`
  - **VP ocultas: N** (ahora públicas porque la partida terminó).
  - **Total: N** (énfasis, mismo color del ganador).
- Si `hiddenVP > 0`: subrayado visual sutil indicando "se revelan al final". El ux-writer puede afinar copy.

**Bloque 3 — Resumen de partida**
**Decisión: 3 métricas, no más.** Sobrecargar mata el cierre.

Las tres elegidas:
1. **Turnos totales**: "M turnos" (cuenta cuántas veces se cerró un ciclo `turn:end`).
2. **Distribución de dados (mini histograma)**: 11 barras (2–12) en estilo idéntico al de `BankPanel`, **siempre visible aquí** (no detrás de un toggle, porque la partida ya terminó). Resalta sutilmente la barra más alta.
3. **MVP de robos**: el jugador que más cartas robó (acumulado por el server o derivado del log). "Más robos: [Nombre] (N cartas)." Si nadie robó, ocultar la fila.

**Métricas explícitamente descartadas para Fase 2** (anota para futuro):
- Cartas de desarrollo compradas por jugador.
- Trades realizados.
- Tiempo total de partida.
Razón: requieren contadores nuevos en server o cálculos del log poco confiables. Que no se acumulen ahora.

**Bloque 4 — CTA**
- Botón primario full-width sticky bottom: "Volver al inicio".
- Acción: limpia `localStorage` de esta sala y navega a `HomeScreen`.
- Sin botón secundario. Sin "Compartir resultado" (gancho fase 3).

### Visibilidad por jugador
- **Todos los jugadores** ven la misma pantalla, con el desglose del ganador (no el suyo).
- Subtítulo personalizado pequeño bajo el ganador: si **yo soy el ganador**: "Felicidades, [mi nombre]". Si **no soy**: "Ganó [Nombre]. Tú quedaste con N puntos."
- Las VP ocultas de los **demás** jugadores se siguen ocultando — sólo se revelan las del ganador (porque era necesario para validar la victoria). Esto evita filtrar la mano final de los perdedores. Si se decidiera revelar todo, debería decidirlo el `ux-architect` en una iteración futura; por ahora **conservar privacidad**.

### Estados
- `loading`: brevemente, al recibir `state:update` con `winnerId` pero antes de calcular métricas locales. Skeleton mínimo (logo + spinner).
- `ready`: pantalla completa.
- `back_pressed`: navega a Home.
- **`error_partial_data`**: si por alguna razón el server marcó ganador pero faltan métricas, mostrar igual el bloque 1 + 2 + CTA, omitir bloque 3. Nunca bloquear el cierre.

### Casos extremos
- **Desconectado durante la declaración**: al reconectar, recibir `status = 'ended'` y mostrar la pantalla. No replay de animación de entrada — directo en estado final.
- **Declarar mientras alguien estaba en Construcción Especial**: el server debe terminar la fase al instante. Pantalla de ganador se impone.
- **Bank manager hace `undo` después de declarar**: no debería permitirse (server cierra `status='ended'` y el log es final). Asegurar que el botón de undo está deshabilitado tras `ended`. La UI debe reflejarlo.

### Microinteracciones
- Entrada: fade + scale 400ms.
- Histograma: barras suben con stagger 30ms (decorativo, no funcional).
- **No confeti**. **No emoji**. **No sonidos**.
- Vibración corta (150ms) al aparecer, sólo en el dispositivo del ganador.

---

## 4. Extensión 5–6 jugadores y Fase de Construcción Especial

### 4.1 Lobby — qué falta documentar

El toggle ya existe (`lobby:setExtension56`). El `LobbyScreen` ya pinta chips verde/café cuando `extension56=true` (usa `EXTENSION_COLORS`). Lo que falta en UI:

**Documentación pendiente para ui-engineer**
- **Label de los chips nuevos**: cuando el toggle pasa a `true`, los chips verde y café aparecen con etiqueta "Nuevo" durante 4s. Implementación: clase CSS efímera con timeout. Cuando se desactiva el toggle, los chips desaparecen — si alguien los había elegido, el server los recoloca a `null` y emite toast "[Jugador] perdió su color porque se desactivó la extensión." (esto requiere coordinación con el server; ya está parcialmente implementado).
- **Capacidad visual**: encabezado del lobby muestra "Jugadores (N/4)" en base y "Jugadores (N/6)" en extensión. La cifra del máximo cambia con el toggle.
- **Estado del banco**: en el footer del lobby (informativo, pequeño): "Banco: 19 por recurso" en base, "Banco: 24 por recurso" en extensión. Subtle, no protagónico.
- **Mensaje del toggle deshabilitado**:
  - Si hay verde/café elegido y se intenta desactivar → tooltip: "Hay jugadores con color verde o café. Cambia sus colores primero."
  - Si hay 5–6 jugadores y se intenta desactivar → tooltip: "Hay más de 4 jugadores. Saca a algunos primero."

### 4.2 In-game — banner de Construcción Especial

Hoy `ContextBanner` ya emite el texto correcto: "Construcción especial: es tu turno..." / "Construcción especial: turno de X. Te toca en N." Mantener y refinar.

**Refinamiento visual**
- Tratamiento de banner: **azul** (`kind = 'info'`), pero con **icono prefix** propio (icono de cono de construcción / herramientas) para distinguirlo a primera vista del banner de "esperando dado" o "es tu turno". El icono inline va a la izquierda del texto, antes del dot existente.
- Persistencia: el banner permanece mientras `phase === 'specialBuild'`. No se oculta entre transiciones de jugador en cola.

### 4.3 Acciones permitidas

Hoy `ActionGrid` ya distingue `inMain` vs `inSpecial`. En `inSpecial`:
- Construir (camino/poblado/ciudad) habilitado.
- Comprar carta de desarrollo habilitado.
- "Intercambiar" deshabilitado con razón "No puedes intercambiar en construcción especial."
- "Jugar carta de desarrollo" deshabilitado con razón "No puedes jugar cartas en construcción especial."
- "Listo, paso" como CTA principal (verde, `emerald-500`), en lugar de "Terminar turno".

**Refuerzo de explicación al usuario** (decisión nueva): cuando el usuario en cola tappea sobre los botones deshabilitados (Intercambiar / Jugar dev), además del `title` actual, mostrar **toast efímero** "En construcción especial no se puede [intercambiar / jugar cartas]." Razón: el `title` es invisible en móvil sin hover. Tap explícito → feedback explícito.

### 4.4 Cola visible — quiénes vienen

**Nueva sección**: cuando `phase === 'specialBuild'`, el `ContextBanner` se complementa con un **mini visualizador de cola** debajo del banner principal.

**Estructura**
- Lista horizontal scrolleable (raro que exceda 5).
- Cada item: chip de color del jugador + nombre corto (12-18 chars truncados).
- Estados visuales:
  - **En turno** (índice 0 de `specialBuildQueue`): borde fuerte, ligeramente más grande, sin opacidad.
  - **Siguiente** (índice 1): borde tenue.
  - **Después** (índice 2+): atenuado a 50%.
- Solo se muestran las primeras **3** posiciones por defecto. Si la cola es más larga, sufijo "+N más" al final.
- Si soy yo el que está en turno: indicador "Tú →" antes del item.

**Estados**
- `cola_vacia`: este componente no se renderiza (el server ya transiciona a `phase = 'roll'`).
- `cola_con_uno`: render normal pero sin "siguiente".
- `cola_con_dos`: muestra "en turno" + "siguiente".
- `cola_con_3+`: muestra los tres.

### 4.5 "Saltar a [Jugador]"

**Trigger del control**
- Sólo visible para `bankManager` o `host`.
- Aparece cuando el jugador #0 de la cola lleva **≥30 segundos** sin emitir `specialBuild:done`. Antes de los 30s, el control está oculto (para no fomentar el salto).
- Implementación: timestamp local en cliente cuando entra a `phase='specialBuild'` con un nuevo `queue[0]`, comparado con `Date.now()` en un setInterval de 5s. **No es autoritativo** — sólo control de UI. El server siempre acepta `specialBuild:skip` del host/bank manager sin importar el tiempo, pero el botón sólo aparece tras 30s para evitar abuso.
- Texto del botón: "Saltar a [Nombre]". Estilo: secundario tenue, no llamativo.
- Ubicación: bajo el visualizador de cola, alineado a la derecha.

**Confirmación**
- Tap → confirmación inline "¿Saltar a [Nombre]?" con botones "Sí, saltar" / "Cancelar". No modal pesado.
- Razón: salto es una acción social delicada. La confirmación da espacio a no equivocarse.

**Caso extremo — desconectado**: si el jugador #0 está desconectado, la confirmación cambia a "[Nombre] está desconectado. Saltarlo." Y el control aparece **inmediatamente** sin esperar 30s. Hay un indicador en su item de la cola: badge "Desconectado" tenue.

**Casos extremos generales**
- **Salta a alguien que sí estaba activo**: el log refleja "Bank manager saltó a María en construcción especial." Sin penalización en VP ni nada.
- **Bank manager se salta a sí mismo**: permitido. Misma confirmación.
- **Cola se vacía por saltos**: el server transita a `phase = 'roll'`. Banner desaparece.

### 4.6 Quedo en cola pero sin recursos

Caso ya identificado en MVP. Refuerzo:
- `ActionGrid` ya atenúa las construcciones que no puedo pagar con razón "Te falta: X". Eso ya funciona.
- "Listo, paso" siempre disponible (verde grande). El usuario sabe que su salida es ese botón aunque no construya.
- **Mensaje adicional sugerido** (small text bajo "Listo, paso" cuando no puedo pagar nada): "No alcanza para construir nada. Pulsa 'Listo, paso'." Reduce confusión inicial.

---

## 5. Estadísticas de dados (`DiceStats`)

Hoy existe un mini-histograma básico dentro de `BankPanel`. Se extrae a un componente propio y se decide visibilidad.

### 5.1 Decisión de diseño: ¿quién lo ve?

**Decisión: visible para todos, colapsable por defecto.**

**Argumentación**
- El histograma es **información del estado público de la partida**. Negarlo a los no-bank managers no aporta nada (anti-trampa: ya saben qué números han salido del log).
- Si lo ocultamos a no-bank-managers, alguien curioso tiene que pedirle al bank manager que se lo lea. Fricción social innecesaria.
- Colapsado por defecto evita ruido. El que quiere verlo, lo abre.
- **Excepción**: dentro de `BankPanel`, sigue expandido por defecto (es la herramienta de trabajo del bank manager).

### 5.2 Componente nuevo: `DiceStats`

**Estructura**
- 11 barras vertical: una por número 2–12.
- **Altura proporcional**: `(count / max) * altura_max`, con altura mínima 2px para barras con count > 0 (visible que existe) y 0 estricto para count = 0.
- Altura máxima sugerida: 40px (más generosa que la actual en `BankPanel` que es 28px) cuando es el componente standalone. Dentro de `BankPanel` queda en 28–32px.
- **Conteo encima** de cada barra (centrado, `nums`, 10px). Si count = 0, no mostrar número (o mostrar "0" muy tenue).
- **Número del dado debajo** de cada barra (2–12, `nums`, 10px).
- Color: ámbar por defecto. **Rojo apagado para el 7** (mantener consistencia con `BankPanel` actual).
- **Resaltar la barra del último número salido** (último entry en `log`): borde inferior fuerte o highlight transitorio.

**Variantes**
- `compact`: usada dentro de `BankPanel`. 28px altura.
- `default`: standalone. 40px altura.
- `expanded`: usada en pantalla de ganador. 56px altura, con etiquetas de probabilidad teórica debajo (opcional). Probabilidad teórica como tono muy tenue debajo del número, ej "2 · 3%".

### 5.3 Ubicación standalone

Nuevo bloque colapsable en `GameScreen`, debajo de `PublicPlayersPanel` o dentro de él como sub-sección. **Recomendación**: bloque propio, colapsable, etiquetado "Estadísticas de dados" con conteo total: "Tiradas hasta ahora (N)". Cerrado por defecto.

### 5.4 Estados
- `sin_tiradas`: total = 0. Barras vacías. Texto "Aún no hay tiradas." Colapsado por defecto.
- `pocas_tiradas` (1–10): barras visibles pero muy poco diferenciadas. Sin mensaje especial.
- `tiradas_normales` (10+): render normal.
- `muchas_tiradas` (50+): mismo render. La altura proporcional se autoescala.

### 5.5 Microinteracciones
- Cuando llega una tirada nueva (cambia `lastNumber`), la barra correspondiente hace `anim-pulse-scale` corto + el número de conteo encima cuenta de N a N+1 con transición numérica (sin animación pesada — basta con un re-mount con `key`).

---

## 6. Vibración + notificaciones de turno

### 6.1 Vibración (ya implementada)

Vibración 200ms al iniciar mi turno: ya existe en `GameScreen` con `safeVibrate(200)`. Mantener.

**Extensiones para Fase 2**
- Vibración corta (50ms) al recibir un trade entrante (`TradeIncomingModal` aparece). Ya parece estar parcialmente cubierto por `ContextBanner.needsAction`. **Verificar y reforzar**.
- Vibración corta (100ms) al aparecer "Declarar victoria" por primera vez. Nueva.
- **No vibrar** por cambios menores (descuento de cartas por construcción ajena, etc.) — esto degrada la utilidad de la vibración.

### 6.2 Notificaciones del navegador (Web Notifications API)

**Decisión: NO entra en Fase 2. Se queda como gancho para Fase 3.**

**Argumentación**
1. **Permisos del navegador**: pedir permiso de notificaciones es un dialogo intrusivo. Pedirlo durante una sesión activa de juego rompe el flujo.
2. **Caso de uso real estrecho**: el usuario suele tener la app abierta y la pantalla encendida durante toda la partida (es presencial). Background es excepción, no norma.
3. **Comportamiento heterogéneo**: iOS Safari restringió notifications en webapps PWA hasta hace poco; Android es más permisivo. Soporte irregular → frustración.
4. **Vibración cubre el 80% del caso**: si el usuario tiene el celular en la mano y otra pestaña activa, la vibración llega cuando el dispositivo está despierto.
5. **Riesgo de "ruido caro"**: implementar mal puede generar notificaciones falsas (reconexión que dispara "es tu turno" otra vez). Coste de testing > beneficio en Fase 2.

**Lo que sí queda para Fase 3** (no implementar ahora):
- Punto de extensión: hook nuevo `useTurnNotification()` con stubs vacíos en `lib/`.
- Pedir permiso **una sola vez**, opt-in desde un Setting menu (no automático).
- Sólo disparar si `document.hidden === true` Y es mi turno Y han pasado ≥5s desde el cambio (evitar dobles disparos).
- Click en la notificación → traer la pestaña al frente.

**Lo que se hace ahora (mínimo viable de Fase 2 sobre este tema)**: documentar en código un comentario en `GameScreen` señalando el punto donde irían las notifications, sin implementar. Eso es todo.

---

## 7. Estados globales (consolidación para Fase 2)

Adiciones a la tabla del MVP §3 "Estados globales":

| Estado | Qué se ve |
|---|---|
| Modal Monopolio abierto | Sub-modal centrado, 5 botones grandes, "Confirmar" tras selección |
| Modal YoP abierto | Sub-modal con 2 selectores + indicador progreso 0/2, 1/2, 2/2 |
| Modal Construcción de caminos abierto | Confirmación simple, 1 párrafo + 2 botones |
| Transferencia de insignia en curso | Chip animado entre cards (FLIP o fade) durante ~600ms |
| Casi-victoria del activo (≥10 VP totales) | Botón ámbar "Declarar victoria con N puntos" sobre "Terminar turno" |
| Partida terminada | Overlay full-screen con bloques anuncio + desglose + resumen + CTA |
| Construcción Especial activa | Banner azul + mini cola visual debajo |
| Saltar disponible (≥30s o desconectado) | Botón secundario "Saltar a [Nombre]" bajo cola |
| Histograma standalone abierto | Sección colapsada con 11 barras + conteos |

---

## 8. Casos extremos transversales — Fase 2

Adiciones al MVP §3 "Casos extremos":

1. **Banco sin recursos para YoP**: documentado en §1.3. Banco vacío total deshabilita la carta; banco con 1 sola carta permite tomar 1.
2. **Monopolio sin víctimas**: log + toast neutro, sin error.
3. **Servidor rechaza compra de dev por mazo agotado**: el item del modal "Comprar carta de desarrollo" en `ActionGrid` muestra "Mazo agotado" como razón. Bank manager y todos los demás también lo ven en log "Mazo de desarrollo agotado."
4. **Carta jugada el mismo turno que se compró**: server ya rechaza. UI: en `PlayDevModal`, las cartas con `me.devCardsBoughtThisTurn` incluyendo ese tipo se muestran con subnota "Comprada este turno — no se puede jugar todavía." y deshabilitadas.
5. **Transferencia de insignia simultánea con declaración de victoria**: si el activo declara victoria justo cuando la insignia transferiría a otro (caso casi imposible), el server resuelve la declaración primero (porque el botón ya estaba habilitado). UI: la pantalla de ganador se impone; no se muestra la animación de insignia.
6. **`undo` del bank manager revierte Monopolio**: posible. La animación de retorno NO es necesaria — basta con que los `cardCount` y manos se actualicen y los chips pulsen normalmente. Log: "Deshecha la última acción."
7. **`undo` revierte Ejército más grande**: documentado en §2.2. Animación inversa.
8. **Jugador en cola de Construcción Especial declara victoria**: imposible. El botón sólo aparece en `phase = 'main'` del activo. Construcción especial NO es el turno del jugador. Si llegara a 10 VP por una compra de dev en construcción especial (raro pero posible si era una VP), debe esperar a su próximo turno propio. Esto es regla oficial.
9. **Transferencia de Camino más largo a alguien que no llega a 5 caminos físicos**: la app no valida la longitud física. El bank manager es responsable. Si se equivoca, otro `setLongestRoad` lo corrige.
10. **Reconexión durante la animación de transferencia de insignia**: al reconectar, se ve el estado final estático. Sin replay.
11. **Modal de Monopolio abierto cuando me toca descartar (otro tira 7 mientras el modal está abierto)**: el modal de descarte tiene prioridad. **Decisión**: al cambiar `phase` a `discard`, cerrar automáticamente el `MonopolyPickerModal` y abrir `DiscardModal`. Toast informativo: "Se canceló el Monopolio. Descarta primero." (En la práctica el activo es el del 7, no le toca descartar por él mismo a menos que también tenga >7 cartas. Pero la regla cubre el caso.)

---

## 9. Microinteracciones críticas — Fase 2

Resumen consolidado:

- **Monopolio aplicado**: cards de víctimas pulsan con stagger 80ms. Chip del activo pulsa con delta +N. Log + toast.
- **YoP aplicado**: chips del activo pulsan con stagger 120ms (los dos recursos). Log.
- **Transferencia de insignia (Ejército o Camino)**: FLIP del chip entre cards en 600ms. Toast global. Log explícito.
- **Aparición de "Declarar victoria"**: `anim-slide-down` + `anim-pulse-scale` una vez. Vibración 100ms.
- **Aparición de pantalla de ganador**: fade-in + scale-up 400ms. Vibración 150ms sólo al ganador. Histograma con stagger 30ms.
- **Cambio de jugador en cola de Construcción Especial**: el item de cola que era #1 se promueve a #0 con `anim-slide-left` o slide horizontal. El nuevo item #0 toma el borde fuerte con `anim-pulse-scale`.
- **Botón "Saltar a X" aparece tras 30s**: fade-in suave (≥300ms) para no parecer agresivo.
- **Histograma**: barra del último número pulsa al llegar.

**Restricción global**: todas estas animaciones respetan `prefers-reduced-motion`. En ese caso, fade-ins se reducen a 100ms instantáneos, sin scale, sin stagger.

---

## 10. Glosario añadido (Fase 2)

Suma a los términos del MVP:

- **Insignia** (`badge`): pieza visual transferible que indica posesión de Ejército más grande o Camino más largo. Vale 2 VP.
- **Ejército más grande** (`largestArmy`): insignia automática asignada al jugador con más caballeros jugados (mínimo 3). Empate conserva el titular previo.
- **Camino más largo** (`longestRoad`): insignia manual asignada por el bank manager (la longitud se cuenta en el tablero físico).
- **Casi-victoria**: estado del activo cuando `totalVP >= 10` en su turno en `phase = 'main'`. Habilita "Declarar victoria".
- **Declarar victoria** (`declareWin`): acción del activo en casi-victoria. Termina la partida.
- **VP oculta** (`hiddenVP`): punto de victoria de una carta de desarrollo "Punto de victoria". Privada hasta declarar.
- **Mazo de desarrollo** (`devDeck`): pila barajada de 25 (base) o 34 (extensión) cartas.
- **Monopolio** (`monopoly`): carta que toma todas las cartas de 1 recurso de todos los demás.
- **Año de la abundancia** (`yearOfPlenty`): carta que toma 2 recursos del banco.
- **Construcción de caminos** (`roadBuilding`): carta que permite colocar 2 caminos físicos sin costo.
- **Fase de Construcción Especial** (`specialBuild`): micro-fase entre turnos en extensión 5–6. Permite construir/comprar dev sin intercambiar ni jugar dev.
- **Cola de Construcción Especial** (`specialBuildQueue`): orden horario de los jugadores no activos pendientes en `specialBuild`.
- **Saltar** (`skip`): acción del host/bank manager para retirar a un jugador de la cola.
- **MVP de robos**: jugador con más robos exitosos en la partida (métrica del resumen final).
- **Histograma de dados** (`diceStats`): distribución de 2–12 tiradas a lo largo de la partida.

---

## 11. Decisiones documentadas (Fase 2)

1. Monopolio requiere confirmación obligatoria — peso del evento.
2. YoP usa 2 selectores en lugar de un selector con cantidad — claridad y simetría.
3. Construcción de caminos es sólo confirmación, sin selección — la app no maneja tablero.
4. VP no es jugable; se muestra como sección informativa privada.
5. Insignias con icono SVG propio (no emoji, no medalla); chip compacto.
6. Camino más largo se asigna desde `PublicPlayersPanel`, no desde `BankPanel` — contexto visual.
7. Botón "Declarar victoria" se añade sobre "Terminar turno", no lo sustituye.
8. Pantalla de ganador: 3 métricas en resumen (turnos, histograma, MVP robos). Otras métricas quedan para futuro.
9. VP ocultas de no-ganadores NO se revelan en pantalla final. Privacidad.
10. Histograma de dados visible para todos, colapsable, expandido sólo dentro de `BankPanel`.
11. Web Notifications NO entran en Fase 2. Gancho documentado para Fase 3.
12. Botón "Saltar" en Construcción Especial aparece tras 30s o si el jugador está desconectado.
13. Cola de Construcción Especial muestra hasta 3 jugadores, con "+N más" si hay más.
14. Toasts explícitos cuando se tappea un botón deshabilitado en `specialBuild` (compensar falta de hover móvil).

---

## 12. Criterios de éxito (Fase 2)

1. Jugar Monopolio: ≤3 taps desde el botón "Jugar carta de desarrollo" (abrir, elegir, confirmar).
2. Jugar YoP: ≤4 taps (abrir, elegir, elegir, confirmar).
3. Transferencia de Ejército más grande: cambio de chip visible en ≤700ms desde que llega el `state:update`.
4. Asignar Camino más largo: ≤3 taps desde `PublicPlayersPanel` (abrir, elegir jugador, confirmar inline).
5. Aparición de "Declarar victoria" no requiere refresh ni acción adicional.
6. Pantalla de ganador carga en ≤1s desde declaración.
7. Construcción Especial avanza de jugador a jugador sin que ningún participante pregunte "¿a quién le toca?".
8. Bank manager puede saltar a un desconectado en ≤2 taps con confirmación.
9. Histograma visible para todos en ≤1 tap (expandir el colapsable).
10. Cero violaciones de privacidad: ningún flujo expone manos, devCards o hiddenVP ajenas en ningún momento antes de declarar.

---

## 13. Siguiente paso

Pasar este brief al **`ui-engineer`**.

Componentes nuevos a crear (lista para que el ui-engineer organice el trabajo):
- `MonopolyPickerModal`
- `YearOfPlentyPickerModal`
- `RoadBuildingConfirmModal`
- `DiceStats` (extracción + variantes `compact` / `default` / `expanded`)
- `WinnerScreen` (overlay full-screen)
- `SpecialBuildQueue` (visualizador horizontal)
- `BadgeIcon` (componente compartido para insignias con SVG propio)

Componentes a modificar:
- `GameScreen` (overlay del ganador, integración del DiceStats standalone, hooks de transferencia de insignia, gancho de notifications stub)
- `ActionGrid` (toast en deshabilitados de specialBuild)
- `PublicPlayersPanel` (chips de insignia con icono, texto del botón de asignar Camino más largo, confirmación inline)
- `ContextBanner` (icono prefix para specialBuild, integración del mini-visualizador de cola debajo)
- `PlayDevModal` → expandir a las 4 cartas jugables + sección informativa de VP
- `BankPanel` (refactor del histograma para usar `DiceStats` variant compact)
- `LobbyScreen` (etiqueta "Nuevo" en colores de extensión + footer informativo de banco + cifra de capacidad)

Después del `ui-engineer`: `ux-writer` → `visual-designer` → `motion-engineer` → `qa-auditor`, en ese orden, igual que en Fase 1.
