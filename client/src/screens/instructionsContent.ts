// Contenido de la pantalla "Cómo jugar" (instructivo de uso de la app).
// Este módulo es solo texto: el ui-engineer lo renderiza sin lógica.
// UI 100% en español. Glosario consistente:
//   recursos = ladrillo, madera, lana, trigo, mineral.
//   poblado, ciudad, ficha, puerto, banco, ladrón, carta de desarrollo,
//   sala, anfitrión, encargado del banco.

export type InstructionImageKind = 'board' | 'app' | 'result' | 'tile';

export interface InstructionImage {
  src: string;
  alt: string;
  caption?: string;
  kind: InstructionImageKind;
}

export interface IllustratedBlock {
  id: string;
  title: string;
  lead?: string;
  images: InstructionImage[];
  caption: string;
}

export interface InstructionSection {
  id: string;
  title: string;
  body: string[];
  blocks?: IllustratedBlock[];
  // Capturas de la app (del walkthrough) que ilustran la sección. A diferencia
  // de `blocks` (foto tablero -> app -> resultado, solo en registrar-poblados),
  // `figures` son capturas sueltas con leyenda que acompañan al texto.
  figures?: InstructionImage[];
  defaultOpen?: boolean;
}

export const INSTRUCTIONS_ENTRY = {
  title: 'Cómo jugar',
  subtitle: 'Guía de uso de la app, paso a paso',
  ariaLabel: 'Cómo jugar. Guía de uso de la app',
};

export const INSTRUCTIONS_LEAD =
  'Esta app lleva la cuenta de tu Catán presencial: el banco, los recursos y las cartas. El tablero sigue en la mesa; aquí solo registras lo que pasa. Las secciones siguen el orden de una partida.';

export const INSTRUCTIONS_BACK = 'Volver al inicio';

export const INSTRUCTIONS_TOC_TITLE = 'Contenido';

export const INSTRUCTIONS: InstructionSection[] = [
  {
    id: 'que-es',
    title: '¿Qué es esta app?',
    body: [
      'Esta app es el asistente digital de tu partida de Catán presencial. No sustituye al juego de mesa: el tablero, las losetas y tus piezas siguen sobre la mesa. Lo que hace la app es llevar la contabilidad por ti (el banco, los recursos de cada jugador y las cartas de desarrollo) para que nadie tenga que contar fichas de cartón ni discutir cuánto le tocó a cada quien.',
      'Todos juegan en la misma sala, cada uno desde su propio celular. Una persona crea la sala y comparte un código; los demás se unen con ese código y todo se sincroniza en tiempo real: cuando alguien construye o el banco reparte recursos, lo ves al instante en tu pantalla.',
      'Ten presente algo desde el principio: la app no ve el tablero. No sabe dónde están tus poblados ni qué fichas tocan. Por eso hay dos momentos en los que tú le pasas esa información: al inicio registras las fichas de tus poblados de salida, y las insignias de Camino más largo y Ejército más grande se asignan a mano. Todo lo demás lo lleva la app sola.',
    ],
    figures: [
      {
        src: '/instructions/19-game-turn-main.jpg',
        kind: 'app',
        alt: 'Captura de la app durante la partida. Arriba, "TU MANO" con el total de cartas y tus cinco recursos (ladrillo, madera, lana, trigo y mineral), cada uno con su cantidad. Debajo, las recetas de construcción (Camino, Poblado, Ciudad y Carta de desarrollo) con su costo, los botones "Intercambiar" y "Jugar carta de desarrollo", y el botón verde "Terminar turno".',
        caption: 'Esta es tu pantalla base durante la partida: aquí ves tu mano, consultas lo que puedes construir y cierras tu turno.',
      },
    ],
  },
  {
    id: 'sala',
    title: 'Crear o unirte a una sala',
    body: [
      'Toda partida vive dentro de una sala. Si tú organizas el juego, crea una sala nueva: la app genera un código corto que compartes con el resto de la mesa. Si alguien más ya la creó, elige unirte e introduce ese código para entrar a la misma partida.',
      'Puedes jugar de dos formas. Como invitado solo eliges un nombre y entras enseguida, sin registrarte, ideal para quien juega una sola vez. Con una cuenta, en cambio, la app recuerda tu nombre y tu historial entre partidas. Los dos tipos de jugador conviven en la misma sala sin problema.',
      'Comparte el código en voz alta o por mensaje; como están todos en la misma mesa, lo más rápido suele ser dictarlo. En cuanto cada quien entra, aparece en la sala de espera, listo para el siguiente paso.',
    ],
    figures: [
      {
        src: '/instructions/01-home-guest.jpg',
        kind: 'app',
        alt: 'Captura de la pantalla de inicio "Asistente de Catán". En la parte baja hay un botón verde "Crear partida" y, debajo, uno oscuro "Unirse a partida". En la esquina inferior derecha aparece el enlace "Iniciar sesión o crear cuenta".',
        caption: 'Desde el inicio: toca "Crear partida" si tú organizas la mesa, o "Unirse a partida" para entrar con el código de otro.',
      },
    ],
  },
  {
    id: 'lobby',
    title: 'La sala de espera (lobby)',
    body: [
      'La sala de espera es donde se reúnen todos antes de empezar. Aquí cada jugador elige su color; procura que coincida con el color de tus piezas físicas en la mesa, así no te confundes durante la partida.',
      'El anfitrión (quien creó la sala) tiene algunos controles extra. Ordena los turnos, elige quién será el encargado del banco (la persona que capturará los dados y confirmará los repartos) y activa las variantes de la partida.',
      'Entre esas variantes están el modo 5-6 jugadores y la expansión Caballeros y Ciudades. Actívalas aquí, antes de arrancar, si van a jugar con ellas. Cuando todos tengan color y la mesa esté lista, pasan a registrar los poblados de salida.',
    ],
    figures: [
      {
        src: '/instructions/08-lobby-host.jpg',
        kind: 'app',
        alt: 'Captura de la sala de espera vista por el anfitrión. Arriba, "CÓDIGO DE PARTIDA" con el código y un botón "Copiar", el interruptor "Extensión 5-6 jugadores" y el botón "Invitar amigos". Debajo, la lista "JUGADORES": tú apareces marcado como Anfitrión y Banco, y cada jugador tiene flechas para reordenarlo y una equis para expulsarlo.',
        caption: 'Como anfitrión ves el código para compartir y los controles para reordenar o expulsar jugadores.',
      },
      {
        src: '/instructions/09-lobby-player-color.jpg',
        kind: 'app',
        alt: 'Captura de la sala de espera con la sección "TU COLOR": botones Rojo, Azul, Blanco, Naranja y Morado. El Azul aparece tachado y deshabilitado porque otro jugador ya lo eligió.',
        caption: 'Elige tu color en "TU COLOR"; los que ya tomó otro jugador salen tachados y deshabilitados.',
      },
    ],
  },
  {
    id: 'registrar-poblados',
    title: 'Registrar tus poblados de salida',
    defaultOpen: true,
    body: [
      'Este es el paso más importante y el único que toma algo de tiempo. Como la app no ve el tablero, necesita que le digas qué produce cada uno de tus poblados de salida. Para cada poblado registras las fichas que toca: su número y su recurso. Con eso, la app sabrá repartirte recursos el resto de la partida.',
      'Coloca primero tus poblados y sus caminos en el tablero físico, como siempre. Luego, en la app, abre cada poblado y ve agregando sus fichas una por una con "+ Agregar ficha". Fíjate bien en el tablero mientras lo haces: es el momento de mirar la mesa, no la pantalla.',
      'Los bloques de abajo te muestran, con fotos del tablero y capturas de la app, cómo se ve cada caso: una ficha por dentro, un poblado con tres fichas, un poblado sobre un puerto, qué hacer con el desierto y cómo tratar una ficha que compartes con otro jugador.',
      'Un detalle: las capturas de la app son ejemplos para enseñarte la pantalla y no siempre corresponden a la foto del tablero de su bloque. Fíjate en el concepto que ilustran, no en que los números coincidan con la foto.',
    ],
    blocks: [
      {
        id: 'anatomia-ficha',
        title: 'Cada ficha: un número y un recurso',
        lead: 'Antes de registrar nada, mira cómo es una ficha por dentro.',
        images: [
          {
            src: '/instructions/ladrillo6.png',
            kind: 'tile',
            alt: 'Ventana de la app para elegir una ficha. Está seleccionado el número 6, marcado en rojo, y el recurso Ladrillo. El botón inferior dice "Agregar ficha 6 · ladrillo".',
            caption: 'Ficha 6 de ladrillo.',
          },
          {
            src: '/instructions/lana5.png',
            kind: 'tile',
            alt: 'Ventana de la app para elegir una ficha. Están seleccionados el número 5 y el recurso Lana. El botón inferior dice "Agregar ficha 5 · lana".',
            caption: 'Ficha 5 de lana.',
          },
          {
            src: '/instructions/madera9.png',
            kind: 'tile',
            alt: 'Ventana de la app para elegir una ficha. Están seleccionados el número 9 y el recurso Madera. El botón inferior dice "Agregar ficha 9 · madera".',
            caption: 'Ficha 9 de madera.',
          },
        ],
        caption:
          'Cada loseta con número del tablero es una ficha: un número del 2 al 12 y un recurso (ladrillo, madera, lana, trigo o mineral). En la app eliges primero el número y luego el recurso. El 6 y el 8 salen en rojo porque son los que más se producen. El desierto y el mar no llevan número, así que no se registran.',
      },
      {
        id: 'tres-fichas',
        title: 'Un poblado que toca 3 fichas',
        lead: 'El caso más común: un poblado en tierra firme.',
        images: [
          {
            src: '/instructions/poblado_3fichas_recursos.jpg',
            kind: 'board',
            alt: 'Foto del tablero físico. Un poblado azul colocado en el vértice donde se juntan tres losetas: unas colinas con el número 6 en rojo, un pasto con el número 5 y un bosque con el número 9. Junto al poblado hay un camino azul.',
          },
          {
            src: '/instructions/poblado_3_recursos.png',
            kind: 'result',
            alt: 'Captura de la app. Tarjeta "Poblado 1" sin puerto, con tres fichas registradas: 6 de ladrillo, 5 de mineral y 3 de madera, cada una con una equis para quitarla.',
            caption: 'La tarjeta va listando las fichas que registras.',
          },
        ],
        caption:
          'Un poblado normal toca hasta tres fichas. Regístralas una por una con "+ Agregar ficha" hasta completar las que toca en tu tablero.',
      },
      {
        id: 'puerto',
        title: 'Un poblado sobre un puerto',
        lead: 'Si tu poblado está en la costa, sobre un puerto, hay un paso extra.',
        images: [
          {
            src: '/instructions/poblado_puerto_1ficha.jpg',
            kind: 'board',
            alt: 'Foto del tablero físico. Un poblado azul construido en la costa, sobre un puerto de mineral 2:1: junto al muelle se ven el símbolo "2:1" y un trozo de mineral. El poblado toca una loseta de pasto con el número 8 en rojo. Sale un camino azul del poblado.',
          },
          {
            src: '/instructions/puerto_mineral.png',
            kind: 'app',
            alt: 'Captura de la app. Ventana "Puerto — Poblado 2" con la nota de que una construcción con puerto toca máximo 2 fichas. Entre las opciones (Sin puerto, Puerto 3:1 y los puertos 2:1 de cada recurso) está marcado "mineral 2:1".',
            caption: 'Primero eliges el tipo de puerto.',
          },
          {
            src: '/instructions/lana8.png',
            kind: 'tile',
            alt: 'Captura de la app. Ventana para elegir una ficha del Poblado 2: seleccionados el número 8, en rojo, y el recurso Lana. El botón dice "Agregar ficha 8 · lana".',
            caption: 'Luego agregas su primera ficha.',
          },
          {
            src: '/instructions/poblado_app_1recurso_puerto.png',
            kind: 'result',
            alt: 'Captura de la app. Tarjeta "Poblado 2" con "Puerto Mineral" y una sola ficha registrada: 8 de lana. Debajo, el botón "+ Agregar ficha" con la nota "máx. 2 con puerto".',
            caption: 'Con puerto, hasta 2 fichas.',
          },
          {
            src: '/instructions/poblado_puerto_2fichas.jpg',
            kind: 'board',
            alt: 'Foto del tablero físico. Un poblado azul en la costa, junto al mismo tipo de puerto de mineral 2:1. Toca dos losetas: un bosque con el número 10 y un pasto con el número 8 en rojo. Salen dos caminos azules del poblado.',
          },
          {
            src: '/instructions/madera10.png',
            kind: 'tile',
            alt: 'Captura de la app. Ventana para elegir una ficha del Poblado 2: seleccionados el número 10 y el recurso Madera. El botón dice "Agregar ficha 10 · madera".',
            caption: 'Agregas la segunda ficha.',
          },
          {
            src: '/instructions/poblado_app_2recursos_puerto.png',
            kind: 'result',
            alt: 'Captura de la app. Tarjeta "Poblado 2" con "Puerto Mineral" y dos fichas registradas: 8 de lana y 10 de madera. Ya no aparece el botón para agregar más fichas.',
            caption: 'Al llegar a 2, "Agregar ficha" desaparece.',
          },
        ],
        caption:
          'Cuando el poblado está sobre un puerto, primero eliges el tipo de puerto (3:1 genérico o el 2:1 de un recurso) y luego registras sus fichas. Un poblado con puerto toca como máximo dos fichas: al llegar a la segunda, el botón "Agregar ficha" desaparece.',
      },
      {
        id: 'desierto',
        title: 'El desierto (y el mar) no se registran',
        lead: 'No todas las losetas producen.',
        images: [
          {
            src: '/instructions/poblado_desierto.jpg',
            kind: 'board',
            alt: 'Foto del tablero físico. Un poblado azul con dos caminos, colocado junto a una loseta de desierto: arena clara y sin número. Alrededor hay unas montañas con el número 6 en rojo, un pasto con el número 5 y un bosque con el número 9.',
          },
          {
            src: '/instructions/poblado_app_desierto.png',
            kind: 'result',
            alt: 'Captura de la app. Tarjeta "Poblado 2" sin puerto, con solo dos fichas registradas: 6 de mineral y 5 de lana. Debajo sigue disponible el botón "+ Agregar ficha".',
            caption: 'Un poblado junto al desierto tiene una ficha menos.',
          },
        ],
        caption:
          'El desierto y el mar no producen recursos, así que no se registran. Anota solo las losetas con número; por eso un poblado pegado al desierto tendrá una ficha menos de lo normal.',
      },
      {
        id: 'ficha-compartida',
        title: '¿Es la misma ficha o una nueva?',
        lead: 'A veces dos poblados tocan la misma loseta.',
        images: [
          {
            src: '/instructions/2poblados_ficha_compartida.jpg',
            kind: 'board',
            alt: 'Foto del tablero físico. Una loseta central de colinas con el número 6 en rojo. En dos de sus vértices hay poblados de jugadores distintos, uno rojo y uno azul, así que ambos comparten esa misma ficha. Abajo asoma otra loseta con el número 8 en rojo.',
          },
          {
            src: '/instructions/ficha_recurso_compartida_app.png',
            kind: 'app',
            alt: 'Captura de la app. Al agregar la ficha 6 de ladrillo del Poblado 1 aparece el aviso "Ya hay una ficha 6 ladrillo en juego. ¿Es la misma?". Está marcada la opción "La tocan", que muestra a otro jugador tocándola.',
            caption: 'La tocan: es la misma',
          },
          {
            src: '/instructions/ficha_recursos_NO_compartida.png',
            kind: 'app',
            alt: 'Captura de la app. Al agregar la ficha 5 de lana del Poblado 2 aparece el aviso "Ya hay una ficha 5 lana en juego. ¿Es la misma?". Está marcada la opción "Es una ficha nueva (otra distinta en el tablero)".',
            caption: 'Es una ficha nueva',
          },
        ],
        caption:
          'Si registras una ficha con un número y recurso que ya existen en la partida, la app te pregunta si es la MISMA loseta física (la que compartes con otro poblado) o una distinta que por casualidad tiene el mismo número y recurso. Mira quién más la toca para reconocerla. Elegir bien evita que el reparto se duplique o se pierda.',
      },
    ],
  },
  {
    id: 'iniciar',
    title: 'Iniciar la partida',
    body: [
      'Cuando cada jugador termine de registrar sus poblados de salida, marca "Registro completo" en su pantalla. La app espera a que todos lo hagan: así se asegura de que ningún tablero quedó a medias antes de empezar a repartir.',
      'Con todos listos, se sortea el orden de juego con los dados. Tira tus dados físicos y captura el resultado; la app ordena los turnos según lo que saque cada quien. El anfitrión también puede activar aquí algunas reglas extra opcionales, si acordaron jugar con ellas.',
      'A partir de este punto empieza la partida normal, ronda por ronda, siguiendo el orden que quedó definido.',
    ],
    figures: [
      {
        src: '/instructions/15-lobby-host-controls.jpg',
        kind: 'app',
        alt: 'Captura de los "CONTROLES DEL ANFITRIÓN". Arriba se ve la marca verde "Registro completo". Dentro del panel están el interruptor "Caballeros y Ciudades", el botón "Sortear orden con dados" y la sección "ENCARGADO DEL BANCO" con los jugadores para elegir a uno.',
        caption: 'El anfitrión sortea el orden con dados, nombra al encargado del banco y activa variantes como Caballeros y Ciudades.',
      },
    ],
  },
  {
    id: 'turno',
    title: 'Tu turno: tirar y producir',
    body: [
      'Cada turno empieza con la tirada de producción. Tira los dos dados físicos sobre la mesa, como siempre. La app no ve los dados, así que el encargado del banco captura el número que salió.',
      'Con ese número, la app reparte automáticamente los recursos: a cada jugador le da lo que producen sus fichas con ese número, según lo que registraste al inicio. Verás aparecer los aumentos como pequeños "+N" en cada recurso, para que quede claro cuánto te tocó.',
      'Si sale un 7 no hay producción: se activa el ladrón (lo ves en su propia sección). En cualquier otro caso, tras el reparto ya puedes construir, intercambiar o jugar cartas.',
    ],
    figures: [
      {
        src: '/instructions/17-game-roll-phase.jpg',
        kind: 'app',
        alt: 'Captura del inicio del turno. Un aviso azul dice "Ingresa el número que salió en el dado". Debajo se ve tu mano y, más abajo, el "PANEL DEL BANCO" con un teclado numérico para capturar la tirada.',
        caption: 'Al empezar el turno, el encargado del banco toca en el teclado el número que salió en los dados físicos.',
      },
      {
        src: '/instructions/18-game-production.jpg',
        kind: 'app',
        alt: 'Captura tras la tirada. En la fila de recursos, los que produjeron muestran una etiqueta verde "+N" sobre su cantidad. Más abajo, el "PANEL DEL BANCO" indica la última tirada registrada.',
        caption: 'Después de capturar la tirada, cada recurso que te tocó aparece con un "+N" verde para que veas cuánto produjiste.',
      },
    ],
  },
  {
    id: 'construir',
    title: 'Construir',
    body: [
      'En tu turno puedes gastar recursos para construir. Las opciones son las de siempre: un camino, un poblado, una ciudad (que mejora un poblado que ya tengas) o comprar una carta de desarrollo. La app te muestra lo que puedes pagar y descuenta el costo al confirmar.',
      'Cada compra se confirma antes de aplicarse, para que no se cuele un gasto por error. Al confirmar, mueve también la pieza de verdad en el tablero: la app lleva la cuenta, pero el poblado o el camino los colocas tú en la mesa.',
      'Ojo con los poblados nuevos: como la app no ve dónde lo pusiste, un poblado recién construido queda PENDIENTE hasta que registres las fichas que toca, igual que hiciste con los de salida. Mientras esté pendiente no produce; en cuanto lo registras, empieza a darte recursos.',
    ],
    figures: [
      {
        src: '/instructions/24-game-buy-settlement.jpg',
        kind: 'app',
        alt: 'Captura con la confirmación "Comprar poblado". Muestra el costo en recursos y una nota de que al confirmar se descuentan y el poblado aparece en tu Tabla de construcción. Abajo, los botones "Cancelar" y "Confirmar compra".',
        caption: 'Cada construcción se confirma antes de aplicarse y te recuerda su costo, para que no se cuele un gasto por error.',
      },
      {
        src: '/instructions/42-game-construction-table.jpg',
        kind: 'app',
        alt: 'Captura de la "Tabla de construcción". Un poblado recién comprado aparece con la etiqueta "PENDIENTE", sin fichas todavía, con el botón "Registrar fichas" y el enlace "No toca recursos".',
        caption: 'Un poblado nuevo queda marcado "Pendiente" y no produce hasta que registres las fichas que toca.',
      },
    ],
  },
  {
    id: 'cartas',
    title: 'Cartas de desarrollo',
    body: [
      'Comprar una carta de desarrollo te da una carta al azar del mazo. Puede ser un Caballero, una carta de Construcción de caminos, Año de la abundancia, Monopolio o un Punto de victoria. La app te dice cuál te tocó y la guarda en tu mano.',
      'Una regla clave: no puedes jugar una carta el mismo turno en que la compras (los Puntos de victoria son la excepción, porque solo suman al final). La app respeta esa espera, así que una carta recién comprada aparecerá disponible hasta tu siguiente turno.',
      'Cuando juegues una carta, la app aplica su efecto: el Caballero mueve el ladrón y cuenta para el Ejército más grande; Año de la abundancia te da dos recursos del banco a tu elección; Monopolio te entrega todas las cartas de un recurso del resto de jugadores; y Construcción de caminos te deja poner dos caminos. Los Puntos de victoria se quedan ocultos en tu mano hasta que ganas.',
    ],
    figures: [
      {
        src: '/instructions/50-game-play-card-menu.jpg',
        kind: 'app',
        alt: 'Captura del menú "Jugar carta de desarrollo". Lista las cartas de tu mano, cada una con una breve explicación y su cantidad: Caballero, Punto de victoria, Año de la abundancia y Construcción de caminos.',
        caption: 'Desde este menú eliges qué carta de desarrollo jugar; cada opción resume su efecto y cuántas tienes.',
      },
      {
        src: '/instructions/28-card-knight.jpg',
        kind: 'app',
        alt: 'Captura del preview de la carta Caballero: su ilustración y el texto que explica que mueve el ladrón, roba una carta al azar a un jugador con poblado o ciudad ahí y cuenta para el Ejército más grande.',
        caption: 'Toca una carta para leer qué hace antes de jugarla, como este preview del Caballero.',
      },
    ],
  },
  {
    id: 'intercambiar',
    title: 'Intercambiar',
    body: [
      'Hay dos maneras de conseguir lo que te falta. Con el banco cambias recursos según tu mejor ratio: 4:1 normal, 3:1 si tienes un puerto genérico o 2:1 si tienes el puerto de ese recurso. La app conoce tus puertos y aplica sola el mejor ratio disponible, sin que tengas que calcularlo.',
      'Con otros jugadores propones un trato (doy esto, pido aquello) que se cierra cuando ambos aceptan. Los recursos pasan de una mano a otra dentro de la app al confirmar, así que no hace falta mover fichas de cartón.',
      'También puedes usar el puerto de otro jugador si en tu mesa juegan con esa regla, con o sin la comisión que hayan acordado. La app te deja registrar ese intercambio para que las cuentas cuadren.',
    ],
    figures: [
      {
        src: '/instructions/34-game-trade-bank.jpg',
        kind: 'app',
        alt: 'Captura del intercambio con la pestaña "Banco / Puertos" activa. La fila "DOY" te deja elegir qué recursos entregas y la fila "RECIBO" muestra lo que el banco te daría a cambio. Abajo, el botón "Confirmar intercambio".',
        caption: 'Con el banco y los puertos eliges qué das y qué recibes; la app aplica sola tu mejor ratio disponible.',
      },
      {
        src: '/instructions/35-game-trade-players.jpg',
        kind: 'app',
        alt: 'Captura del intercambio con la pestaña "Jugadores" activa. Cada recurso de las filas "DOY" y "RECIBO" tiene sumadores (menos, cantidad, más) para armar la oferta.',
        caption: 'Con otros jugadores armas el trato con los sumadores: subes lo que ofreces y lo que pides a cambio.',
      },
    ],
  },
  {
    id: 'siete',
    title: 'El 7 y el ladrón',
    body: [
      'Cuando alguien saca un 7 no se produce nada y pasan tres cosas. Primero, todo jugador con más cartas del límite permitido debe descartar la mitad; la app te avisa y te hace elegir qué sueltas antes de seguir.',
      'Después, quien tiró mueve el ladrón. En el tablero físico colocas la ficha del ladrón sobre una loseta; en la app eliges esa misma loseta para que sepa cuál queda bloqueada. Esa loseta deja de producir mientras el ladrón esté encima.',
      'Por último, robas una carta al azar a un jugador que tenga un poblado o ciudad en esa loseta. Eliges a la víctima en la app y ella se encarga de pasar un recurso al azar a tu mano, sin que nadie vea cuál.',
    ],
    figures: [
      {
        src: '/instructions/44-game-discard-seven.jpg',
        kind: 'app',
        alt: 'Captura del descarte forzado. El aviso "Te toca descartar" indica que salió un 7 y que debes descartar exactamente N cartas; lista tus recursos con sumadores para elegir cuáles sueltas y un contador de lo que llevas elegido.',
        caption: 'Tras un 7, si te pasas del límite la app te hace soltar exactamente la cantidad de cartas que indica.',
      },
      {
        src: '/instructions/46-game-robber-pick-hex.jpg',
        kind: 'app',
        alt: 'Captura para mover el ladrón. El aviso "Elige la ficha a donde se mueve el ladrón" lista las fichas con poblados o ciudades, cada una con su número, su recurso y quién la toca, para seleccionar una.',
        caption: 'En la app eliges la misma ficha donde colocaste el ladrón en el tablero, y así queda bloqueada.',
      },
    ],
  },
  {
    id: 'ganar',
    title: 'Insignias y ganar',
    body: [
      'Dos insignias dan dos puntos cada una: el Camino más largo y el Ejército más grande. Como la app no ve el tablero, no puede contar por sí sola quién tiene el camino más largo, así que estas insignias se asignan a mano: cuando alguien cumpla el requisito, márcalo en la app para que le sume los puntos.',
      'El Ejército más grande es de quien haya jugado más Caballeros (mínimo tres); ese conteo sí lo lleva la app, pero la asignación se confirma igual para que todos estén de acuerdo. El resto de puntos (poblados, ciudades y Puntos de victoria de cartas) la app los suma automáticamente.',
      'La partida termina en cuanto un jugador llega a los puntos necesarios en su turno. La app avisa del ganador y cierra la partida. Aun así, cotejen los puntos con el tablero antes de cantar victoria, sobre todo las insignias que se asignan a mano.',
    ],
    figures: [
      {
        src: '/instructions/52-game-players-badges.jpg',
        kind: 'app',
        alt: 'Captura del panel de jugadores. Bajo un jugador aparecen las insignias "Ejército más grande" y "Camino más largo", cada una con sus 2 puntos, junto a sus conteos de mano, poblados, ciudades, desarrollo, caballeros y puntos.',
        caption: 'En el panel de jugadores ves quién tiene el Ejército más grande y el Camino más largo, cada insignia con sus puntos.',
      },
      {
        src: '/instructions/56-game-ended.jpg',
        kind: 'app',
        alt: 'Captura de la pantalla de fin de partida "Partida finalizada". Muestra un resumen con turnos jugados, quién robó más y número de tiradas, más las estadísticas de dados. Abajo, el botón "Volver al inicio".',
        caption: 'Al terminar, la app cierra la partida y te deja un resumen de cómo estuvo.',
      },
    ],
  },
  {
    id: 'privacidad',
    title: 'Privacidad y anti-trampas',
    body: [
      'Como cada quien juega en su propio celular, tu mano es privada por dispositivo: solo tú ves tus cartas y tus recursos. Nadie puede espiar tu pantalla para saber qué guardas, igual que no verían tus cartas de cartón.',
      'A la vez, las acciones que deben ser públicas sí se anuncian. El banco publica avisos de lo que ocurre (cuánto se repartió, quién construyó, quién intercambió) para que la mesa confíe en las cuentas sin necesidad de revelar manos privadas.',
      'Si algo se captura mal, existe la opción de deshacer la última acción, y todo queda en un registro cronológico de la partida. Ante una duda, revisen ese historial: deja ver qué pasó y en qué orden, y ayuda a resolver cualquier desacuerdo sin discutir de memoria.',
    ],
    figures: [
      {
        src: '/instructions/27-game-hand-hidden.jpg',
        kind: 'app',
        alt: 'Captura de tu mano con la privacidad activada. En "TU MANO" se ve el total de cartas, pero cada recurso aparece tapado con un punto y la nota "OCULTO — toca para mostrar"; lo mismo pasa con tus cartas de desarrollo.',
        caption: 'Con el toggle de privacidad se ve tu total pero no el detalle: nadie espía en tu pantalla qué guardas.',
      },
      {
        src: '/instructions/30-game-bank-give-card.jpg',
        kind: 'app',
        alt: 'Captura de "Entregar carta del banco": eliges a quién le das y qué carta (un recurso del stock del banco o una de desarrollo). Un aviso amarillo advierte que todos los jugadores verán esta entrega.',
        caption: 'Cuando el banco entrega una carta a mano, la app siempre avisa a toda la mesa para que la cuenta sea pública.',
      },
    ],
  },
];
