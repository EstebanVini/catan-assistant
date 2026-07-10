# Design Brief — Catan Assistant (Fase 1 MVP)

**Autor:** ux-architect
**Destinatario siguiente:** ui-engineer
**Alcance:** 3 pantallas del MVP (Home, Lobby, Game) + flujos transversales

---

## 0. Principios rectores

1. **El tablero físico manda.** La app es un cuaderno de contabilidad compartido, no un simulador. Cualquier discrepancia se corrige fácilmente desde la app.
2. **Anti-trampa por diseño.** Log público + cardCount visible hacen innecesaria la confianza ciega.
3. **Privacidad por defecto.** Manos y tipos de cartas de desarrollo son del dueño. El servidor envía vistas personalizadas.
4. **Mobile-first real.** 360–414px, pulgar de una sola mano alcanza los CTAs, nunca controles críticos tapados por el teclado.
5. **El turno es la unidad de poder.** Acciones fuera de turno: deshabilitadas con razón visible, no ocultas.
6. **Reconexión silenciosa.** ≤30s sin red no destruye sesión.
7. **Estados terminales explícitos.** Toda acción async tiene "esperando a X" visible.
8. **El encargado del banco es el árbitro humano.** Le damos herramientas (deshacer, saltar, marcar Camino más largo).

---

## 1. HOME

### Objetivo del usuario
Pasados ≤15 s desde abrir la app, estar dentro de un Lobby (creado, unido o reconectado).

### Layout (mobile-first, una columna)
1. Marca compacta (≤15% viewport).
2. **Zona de reconexión** (solo si hay sesión en localStorage): card destacada con nombre + código + "Reconectar". Arriba de todo.
3. CTA primario "Crear partida".
4. CTA secundario "Unirse a partida".
5. Pie con "Olvidar partida guardada" (si aplica) + versión.

CTAs en mitad inferior (alcance del pulgar).

**Modal "Crear partida"**: solo nombre (1–20 chars, trim). Botones "Crear" y "Cancelar".
**Modal "Unirse"**: código + nombre. Filtrado/uppercase del código. "Unirse" deshabilitado hasta ambos válidos.

### Estados
| Estado | Qué se ve |
|---|---|
| Sin sesión | Solo Crear/Unirse |
| Con sesión | Card reconexión arriba |
| Cargando reconexión | Botón en loading, overlay sutil |
| Reconexión fallida (sala perdida) | Card → "Esta partida ya no está disponible" + "Borrar" |
| Error de red al crear/unirse | Toast "Sin conexión. Reintentar." — modales mantienen datos |
| Código inválido | Mensaje inline bajo el campo |
| Nombre vacío | Mensaje inline + botón deshabilitado |
| Primer uso | Igual a "Sin sesión", sin onboarding |

### Casos extremos
- Código sin `O`, `0`, `I`, `1`, `L` (servidor). Cliente filtra y normaliza uppercase.
- sessionToken inválido tras reinicio del servidor → limpiar localStorage automáticamente.
- Sesión de partida ya terminada → mismo trato.
- Nombre duplicado: aceptar, mostrar `Esteban` y `Esteban (2)` solo donde la ambigüedad importa.
- localStorage bloqueado (incógnito): aviso discreto una vez, no bloquear.
- Dos pestañas: la nueva invalida la vieja; la vieja muestra "Tu sesión se abrió en otra ventana".

### Microinteracciones críticas
- Card de reconexión sin flash (leer localStorage antes del primer render).
- Foco inmediato al primer input al abrir modal; modal sticky-bottom.
- "Reconectar" muestra loading ≥250 ms.
- Toast "Sin conexión" se descarta cuando vuelve `online` (no por tap).

---

## 2. LOBBY

### Objetivo del usuario
Del lobby al primer turno en ≤90 s cuando ya están todos sentados.

### Layout
1. **Header de sala**: código grande (32–44px, monospaced/tracking), botón "Copiar", share nativo en tap largo.
2. **Toggle "Extensión 5–6"** (host) / texto "Modo: …" (no-host). Justo debajo del código.
3. **Lista de jugadores**: avatar de color (o gris), nombre, badges Host/Banco, indicador de conexión. Resaltar el propio. Si host: handle de arrastre.
4. **Selector de color** propio: 4 chips base + 2 si extensión. Tachados con nombre del dueño los tomados.
5. **Controles del host**: "Decidir orden por dados" + radio "Encargado del banco".
6. **CTA sticky bottom**: host → "Iniciar partida" (con razón si deshabilitado); no-host → "Esperando al anfitrión…".

### Estados
| Estado | Qué se ve |
|---|---|
| Sala recién creada | Solo host + "Esperando jugadores…" |
| Entradas en vivo | Fade+slide; toast "Se unió María" |
| Jugador sin color | Avatar gris; en su celular, chips resaltados |
| Conflicto de color | Servidor adjudica al primero; perdedor: chip vuelve a "tomado" + toast |
| Extensión recién activada | Chips nuevos con etiqueta "Nuevo" |
| Extensión OFF con >4 jugadores | Toggle deshabilitado con tooltip |
| Extensión OFF con verde/café elegidos | Toggle deshabilitado |
| Cargando "Iniciar partida" | Botón loading, pantalla bloqueada visual |
| Host desconectado | "El anfitrión está desconectado. Esperando que vuelva." Sin reasignación auto en MVP |
| Jugador desconectado en lobby | Fila atenuada "Desconectado"; cuenta solo si ya tenía color |
| Reconexión a lobby | Aparece con mismo color, orden y rol |

### Casos extremos
- Reorder simultáneo: servidor es fuente de verdad; optimistic + rollback si rechaza.
- "Decidir por dados" sin colores: permitido; "Iniciar" sigue exigiendo color.
- Bank manager desconectado al iniciar: UI bloquea ingreso de dado hasta volver o reasignar.
- Toggle de extensión a mitad del lobby: no cambia colores ya elegidos; al desactivar, ver caso anterior.
- Sala vacía: servidor la conserva 5 min de grace.
- Copy al portapapeles: aprovechar gesto explícito; feedback "Copiado".

### Microinteracciones
- Tap código → copy + checkmark 1.2s + toast.
- Tap chip de color → optimistic; snap-back+vibración si rechaza.
- Drag-to-reorder: háptico al levantar/soltar; servidor recibe orden completo al soltar.
- "Decidir por dados": animación 1.5–2s (mismo broadcast en todos los celulares).
- Toggle extensión: micro entrada/salida de chips.
- "Iniciar partida": navegación automática en todos (vía `state:update`).

---

## 3. GAME

Dashboard que cambia de modo según fase y rol.

### Objetivo del usuario
En ≤2 s responder: "¿Es mi turno? ¿Qué fase? ¿Qué puedo hacer? ¿Qué hacen los demás? ¿Cuánto le falta a alguien para ganar?"

### Layout

#### A. Barra superior fija (~64 px, sticky top)
- Izquierda: chip color jugador en turno + nombre + "TU TURNO" si soy yo.
- Centro: fase (`Tirar` / `Descartar` / `Mover ladrón` / `Jugar` / `Construcción especial`).
- Derecha: mi rol (`Tú` / `Banco`) + estado de conexión.

#### B. Banner contextual (condicional)
Sólo cuando algo lo amerita: "Debes descartar X cartas", "Esperando a María coloque el ladrón", "Te ofrecieron un intercambio", "Construcción especial: turno de Juan", "Esperando el número del dado", "Te tocará cuando termine Carla". Sin banner si no hace falta.

#### C. Tu mano privada (pliegue 1)
- 5 chips de recurso con icono, color y conteo grande (24–32 px).
- Total a la derecha.
- Fila de cartas de desarrollo (si tengo).
- **Sin botones +/-**: la mano solo la modifica el sistema.

#### D. Acciones de mi turno (pliegue 1–2)
- Grid 2x2: Camino, Poblado, Ciudad, Carta de desarrollo (con costo, atenuadas con razón).
- "Intercambiar" (modal con tabs Banco/Puertos y Jugadores).
- "Jugar carta de desarrollo".
- "Terminar turno" (full-width).

Fuera de mi turno: bloque deshabilitado con header "No es tu turno".

#### E. Panel del encargado del banco (solo si soy banco)
- Teclado numérico 2–12 (botones 60–80 px).
- "Deshacer última acción" (con descripción de qué se va a deshacer).
- Último número + mini histograma.

Si no soy banco, no se muestra (no ocupa espacio).

#### F. Tabla de producción editable (pliegue 2, colapsable)
- Por defecto colapsada salvo en `robber` o al editar.
- Filas: número (sombreado para 6/8), recurso, dueños (chip color + P/C), indicador de ladrón.
- Botón "Editar" abre modal (agregar/quitar dueño, cambiar P↔C).
- En fase `robber`: filas tocables; hexes válidos resaltados.
- **No es mapa del tablero**: es lista. El tablero físico es la visual.

#### G. Estado público de jugadores (pliegue 2–3, colapsable)
- Card por jugador, ordenadas por turno actual.
- Color como banda lateral, nombre, badges, `cardCount`, caballeros jugados, conteo total de dev no jugadas (sin tipos), puertos, insignias, puntos visibles.

#### H. Log (pliegue 3, colapsable)
- Lista invertida, timestamp relativo, una línea por entrada con chip del jugador involucrado.
- Auto-scroll al tope salvo que el usuario haya scrolleado manualmente (badge "3 acciones nuevas").

### Estados globales
| Estado | Qué se ve |
|---|---|
| No mi turno, activo en `main` | Acciones deshabilitadas con razón. Banner "Turno de María." |
| Mi turno, `roll` | Banner "Esperando el número del dado" |
| Mi turno, `main` | Acciones habilitadas según mano |
| `discard`, yo descarto | Banner rojo + modal forzado, resto atenuado |
| `discard`, otros descartan | Banner amarillo con conteo por jugador |
| `robber`, soy activo | Tabla expandida con hexes resaltados |
| `robber`, no soy activo | Banner "María está moviendo el ladrón" |
| `specialBuild`, mi turno en cola | Banner azul + acciones de construcción/compra + botón "Listo, paso" |
| `specialBuild`, no me toca | Banner "Construcción especial: turno de Carla. Tú vas en 2" |
| Trade entrante | Modal central bloqueante |
| Partida terminada | Overlay ganador + puntaje + "Volver al inicio" |
| Cargando inicial | Skeleton + "Sincronizando…" |
| Desconectado | Banner negro arriba, resto atenuado, acciones con razón |
| Reconectado | Banner reemplazado por toast verde efímero |

### Casos extremos (Catán)
1. **Banco sin suficiente recurso**: 1 solo destinatario → recibe lo que quede; varios → nadie recibe ese recurso. Log explícito.
2. **Robar a quien tiene 0 cartas**: permitido (regla), con confirmación.
3. **Ladrón en hex sin dueños / con solo el activo**: salta el robo automáticamente.
4. **Descarte de jugador desconectado**: tras 30 s, bank manager puede "Descartar por X (aleatorio)" con confirmación.
5. **Turno de jugador desconectado**: host puede "Terminar turno por X" tras 30–60 s de grace. Log lo registra.
6. **Bank manager se equivoca de número**: 1 tap a "Deshacer" antes de otra acción.
7. **Intercambio banco/puertos sin stock**: botón "Confirmar" deshabilitado con razón.
8. **Trade que ya no es válido al confirmar**: servidor rechaza con razón; modal lo refleja.
9. **Monopoly sin víctimas**: log "Nadie tenía X". Sin error.
10. **Year of Plenty con banco corto**: el modal solo deja elegir lo que el banco tiene.
11. **Knight el mismo turno que se compra**: filtrado en modal con etiqueta.
12. **Empate de caballeros**: insignia se mantiene en el dueño previo.
13. **Camino más largo**: bank manager asigna/transfiere/quita manualmente.
14. **Declarar victoria <10 o fuera de turno**: botón solo aparece al cumplir condiciones.
15. **Construcción especial: jugador en cola sin recursos**: acciones atenuadas; "Listo, paso" siempre disponible.
16. **Construcción especial: jugador desconectado en cola**: `specialBuild:skip` por bank manager/host.

### Microinteracciones críticas
- Inicio de turno: vibración 200ms + toast "Es tu turno" + cambio de barra superior.
- Cambio en mi cardCount: chips pulsan + delta efímero ("+1"/"−2").
- Cambio en cardCount ajeno: su card pulsa.
- Log nuevo: si visible, slide-in; si colapsado, badge con conteo de nuevas.
- Banner contextual: slide-down; vibración solo si requiere mi acción.
- Tirar número (banco): confirmación visual instantánea; banner cambia en todos; pulso háptico a los receptores.
- Robar: animación de carta saliendo del objetivo y entrando al activo (sin revelar tipo).
- Trade entrante: vibración corta + modal. Recordatorio sutil tras 20s.

---

## 4. Flujos críticos transversales

### 4.1 Secuencia del 7
1. **Setup**: banco ingresa 7 → `phase = 'discard'`, calcular `pendingDiscards[player] = floor(cardCount/2)` para cada uno con `cardCount > 7`.
2. **Descarte** (cada jugador en su celular):
   - Yo descarto: banner rojo + modal forzado, +/- por recurso, total visible "3/4", "Confirmar" deshabilitado hasta el exacto. No se cierra.
   - Yo no descarto: banner amarillo "Esperando descartes: María (3), Juan (4)". Resto atenuado.
   - Yo soy activo y no descarto: mismo banner, sin botón de "Mover ladrón" todavía.
   - Desconectado >30s: bank manager ve "Descartar por X (aleatorio)" con confirmación → log explícito.
3. **Mover ladrón** (cuando todos terminaron):
   - Activo: tabla expandida, hexes válidos resaltados, tap → confirmación inline → mover. Hex origen pierde el icono, destino lo gana.
   - No activo: "María está moviendo el ladrón." Tabla no interactiva.
4. **Robar**:
   - Sub-modal con dueños del hex (sin el activo). Lista vacía → "No hay a quién robar".
   - Objetivo con 0 cartas → confirmación "No tiene cartas. ¿Continuar?".
   - Objetivo con cartas → servidor toma una al azar. UI activo pulsa chip recibido; UI objetivo pulsa chip perdido. Demás: log "María robó 1 carta a Juan" (sin tipo).
   - **Knight**: mismo flujo, disparable en `phase = 'main'` del activo.
5. **Fin**: `phase = 'main'`. Banner desaparece. Acciones del activo se habilitan.

### 4.2 Intercambio

**Con banco/puertos**: solo activo en `main`. Selector "Doy" (recursos con cantidad suficiente) + "Recibo" (de los que el banco tiene). Proporción mejor automática (4:1 / 3:1 / 2:1) con indicador "Estás usando puerto 2:1 de lana". Servidor valida.

**Entre jugadores**:
- Emisor (activo): modal con "Doy"/"Recibo" + "Para" (jugador específico). Enviar oferta → estado "Esperando respuesta de Juan…" + "Cancelar oferta".
- Receptor: modal central con la oferta. "Aceptar"/"Rechazar"/"Contraofertar" (gancho, fase 2).
- Si se acepta y ya no es válida (recurso cambió): servidor rechaza con razón; modal lo refleja.

Estados: `idle`, `pending`, `accepted`, `rejected`, `expired`, `invalid_at_confirm`.

Restricciones por fase: deshabilitado en `roll`, `discard`, `robber`, `specialBuild` con razón explícita.

### 4.3 Reconexión silenciosa

**Pérdida breve (1–10 s)**: Socket.IO reconecta. UI muestra banner negro tras 2 s. Acciones con razón "Sin conexión". Al volver: toast verde efímero.

**Pérdida larga (>30s) o cambio de red**: cliente reenvía `game:reconnect`. Servidor responde vista completa. Si cambió de fase mientras estaba fuera: salto directo al estado actual sin transición intermedia.

**Pérdida total / cierre de app**: Home detecta sesión → "Reconectar". Si servidor reinició y perdió sala: Home limpia localStorage.

Garantías UI:
- Mi mano sigue siendo mía.
- Mi color es el mío.
- Si era mi turno, sigue siéndolo.
- Trades pendientes siguen pendientes (a menos que el otro cancelara).
- Descarte pendiente sigue pendiente.

Cualquier acción optimista pendiente se descarta al reconectar. El servidor es la única fuente de verdad.

---

## 5. Glosario inicial (español)

- **Camino** (`road`): 1 madera + 1 ladrillo.
- **Poblado** (`settlement`): 1 madera + 1 ladrillo + 1 lana + 1 trigo. 1 punto.
- **Ciudad** (`city`): 2 trigo + 3 mineral. 2 puntos. Mejora un poblado.
- **Carta de desarrollo** (`devcard`): 1 lana + 1 trigo + 1 mineral.
- **Mano** (`hand`): tus recursos. Privada.
- **Banco** (`bank`): inventario común. 19 por recurso (base) / 24 (extensión).
- **Encargado del banco** (`bankManager`): ingresa el dado y administra repartos.
- **Anfitrión** (`host`): creador de la partida. Controla toggles.
- **Tirar** / **Descartar** / **Mover ladrón** / **Robar carta** / **Terminar turno**.
- **Fase de Construcción Especial** (`specialBuild`): extensión 5–6.
- **Puerto 3:1** / **Puerto 2:1**.
- **Recursos**: madera (`lumber`), ladrillo (`brick`), lana (`wool`), trigo (`grain`), mineral (`ore`).
- **Cartas de desarrollo**: Caballero (`knight`), Año de la abundancia (`yearOfPlenty`), Monopolio (`monopoly`), Construcción de caminos (`roadBuilding`), Punto de victoria (`vp`).
- **Camino más largo** (`longestRoad`): 2 puntos, manual por bank manager.
- **Ejército más grande** (`largestArmy`): 2 puntos, automático ≥3 caballeros.
- **Declarar victoria** (`declareWin`): a 10 puntos, en tu turno.
- **Log / Registro** (`log`).
- **Reconectar** (`reconnect`).
- **Extensión 5–6 jugadores** (`extension56`).

---

## 6. Decisiones documentadas

1. No mapa visual, solo lista de hexes.
2. CTAs en mitad inferior (pulgar).
3. Banner contextual, no rediseño completo por fase.
4. Acciones deshabilitadas con razón, no ocultas.
5. Mano propia sin +/-.
6. Tabla no clickable salvo en `robber` o al "Editar".
7. Reconexión silenciosa sin diálogos.
8. Bank manager puede descartar/saltar por desconectados con log explícito.
9. Permitir robar a jugador sin cartas.
10. Códigos sin caracteres ambiguos.
11. No reasignación automática de host en MVP.
12. Construcción especial visible para todos.
13. VP ocultos no se revelan hasta declarar victoria final.

---

## 7. Criterios de éxito

1. Jugador nuevo entra y juega en ≤30s.
2. Secuencia del 7 ≤90s con 4 jugadores.
3. Caída de red de 30s no requiere intervención.
4. Nunca "¿por qué no puedo tocar esto?" sin razón visible.
5. Bank manager corrige tirada errónea en ≤5s.
6. Imposible inferir tipos de cartas ajenas desde UI o log.
7. El log final es legible como narración.

---

## 8. Siguiente paso

Pasar al **`ui-engineer`** con este brief como contrato. Después: `ux-writer` → `visual-designer` → `motion-engineer` → `qa-auditor`.
