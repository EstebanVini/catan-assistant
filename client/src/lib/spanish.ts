import {
  Commodity,
  DevCardType,
  Discipline,
  EventDie,
  GamePhase,
  PlayerColor,
  PortType,
  ProgressCardType,
  Resource,
} from '../types';

// Glosario centralizado del cliente. Mantener en sincronía con docs/ux-brief-mvp.md §5,
// docs/ux-brief-phase2.md §10 y server/src/socket/handlers.ts::esResource
// (minúsculas para frases naturales).
//
// Reglas duras de copy (ux-writer, Fase 2):
//  - Las cartas se nombran siempre así (nunca "Knight", "Soldado", "Monopoly",
//    "YoP", "Abundancia" o "Road Building"): "Caballero", "Monopolio",
//    "Año de la abundancia", "Construcción de caminos", "Punto de victoria".
//  - "Punto de victoria oculto" / "Cartas de victoria ocultas" en singular y
//    plural. Nunca "VP" en UI (sí en variables de código).
//  - "Insignia" como nombre genérico de Ejército más grande / Camino más largo.
//  - "Estadísticas de dados" e "Histograma" para el panel de tiradas.
//  - "Construcción especial" como nombre de la fase y de su cola
//    ("Cola de construcción especial").
//  - "Mazo de desarrollo" para la pila de 25 / 34 cartas.

export const RESOURCE_NAMES: Record<Resource, string> = {
  brick: 'Ladrillo',
  lumber: 'Madera',
  wool: 'Lana',
  grain: 'Trigo',
  ore: 'Mineral',
};

export const RESOURCE_NAMES_PLURAL: Record<Resource, string> = {
  brick: 'Ladrillos',
  lumber: 'Madera',
  wool: 'Lana',
  grain: 'Trigo',
  ore: 'Mineral',
};

// Forma en minúsculas para frases compuestas ("te falta 1 madera, 1 trigo").
export const RESOURCE_NAMES_LOWER: Record<Resource, string> = {
  brick: 'ladrillo',
  lumber: 'madera',
  wool: 'lana',
  grain: 'trigo',
  ore: 'mineral',
};

// Mercancías de Caballeros y Ciudades. Solo se usan en modo C&K. El nombre
// canónico en español (nunca "coin"/"paper"/"cloth" en UI): Moneda / Papel /
// Tela. Una mercancía NO es un recurso (se produce solo en ciudades).
export const COMMODITY_NAMES: Record<Commodity, string> = {
  coin: 'Moneda',
  paper: 'Papel',
  cloth: 'Tela',
};

// Forma en minúsculas para frases compuestas ("entregar 1 moneda a …").
export const COMMODITY_NAMES_LOWER: Record<Commodity, string> = {
  coin: 'moneda',
  paper: 'papel',
  cloth: 'tela',
};

// Disciplinas de mejora de ciudad (Caballeros y Ciudades). Solo se usan en
// modo C&K. Nombre canónico en español (nunca "trade"/"politics"/"science" en
// UI): Comercio / Política / Ciencia. Cada una tiene su color funcional y su
// mercancía asociada (Comercio↔Tela, Política↔Moneda, Ciencia↔Papel).
export const DISCIPLINE_NAMES: Record<Discipline, string> = {
  trade: 'Comercio',
  politics: 'Política',
  science: 'Ciencia',
};

// Descripción breve de la habilidad que desbloquea el nivel 3 de cada
// disciplina (caballeros-plan.md §2.4). Se muestra en el calendario de la
// ciudad bajo el nombre de la habilidad (DISCIPLINE_LEVEL3_ABILITY).
export const DISCIPLINE_LEVEL3_ABILITY_DESC: Record<Discipline, string> = {
  trade:
    'Cambia 2 mercancías o recursos iguales por 1 cualquiera con el banco.',
  politics: 'Permite promover tus caballeros a poderosos (nivel 3).',
  science:
    'Si en tu turno no produces ningún recurso, toma 1 a elección del banco.',
};

export const PHASE_NAMES: Record<GamePhase, string> = {
  roll: 'Tirar',
  discard: 'Descartar',
  robber: 'Mover ladrón',
  main: 'Jugar',
  specialBuild: 'Construcción especial',
};

export const DEV_CARD_NAMES: Record<DevCardType, string> = {
  knight: 'Caballero',
  vp: 'Punto de victoria',
  roadBuilding: 'Construcción de caminos',
  yearOfPlenty: 'Año de la abundancia',
  monopoly: 'Monopolio',
};

export const COLOR_NAMES: Record<PlayerColor, string> = {
  red: 'Rojo',
  blue: 'Azul',
  white: 'Blanco',
  orange: 'Naranja',
  green: 'Verde',
  brown: 'Café',
  purple: 'Morado',
};

export function portLabel(port: PortType): string {
  if (port === '3:1') return 'Puerto 3:1';
  return `Puerto 2:1 ${RESOURCE_NAMES[port]}`;
}

export function buildTypeLabel(t: 'road' | 'settlement' | 'city' | 'devcard'): string {
  return {
    road: 'Camino',
    settlement: 'Poblado',
    city: 'Ciudad',
    devcard: 'Carta de desarrollo',
  }[t];
}

// Une recursos en una lista natural: ["1 madera", "1 trigo"] → "1 madera y 1 trigo".
export function joinList(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

// Términos compartidos de Fase 2. Centralizados aquí para mantener una sola
// fuente de verdad y evitar derivas ("Ejército mayor" vs "Ejército más grande").
export const BADGE_LABELS = {
  largestArmy: 'Ejército más grande',
  longestRoad: 'Camino más largo',
} as const;

export const PHASE2_TERMS = {
  badge: 'Insignia',
  devDeck: 'Mazo de desarrollo',
  specialBuild: 'Construcción especial',
  specialBuildQueue: 'Cola de construcción especial',
  diceStats: 'Estadísticas de dados',
  histogram: 'Histograma',
} as const;

// Términos compartidos de Fase 3 (cuentas, registro inicial, banco
// transparente). Reglas duras de copy añadidas (ux-writer, Fase 3):
//  - "Cuenta" (nunca "perfil de usuario") e "Invitado" (nunca "anónimo").
//  - "Nombre visible" para displayName; "usuario" (minúscula) para username.
//  - "Poblado de salida" y "ficha" (número + recurso) para el registro
//    inicial. "Mi 2º poblado" es el que recibe recursos al iniciar.
//  - "Entregar carta" / "Forzar entrega" para las correcciones del banco;
//    quien las hace es el "Encargado del banco".
//  - El aviso público del banco siempre dice qué se entregó y a quién, en
//    tono de transparencia, nunca de acusación. Jamás revela el tipo de una
//    carta de desarrollo entregada.
export const PHASE3_TERMS = {
  account: 'Cuenta',
  guest: 'Invitado',
  displayName: 'Nombre visible',
  preferredColor: 'Color preferido',
  startingSettlement: 'Poblado de salida',
  spot: 'Ficha',
  giveCard: 'Entregar carta',
  forceGive: 'Forzar entrega',
  bankManager: 'Encargado del banco',
} as const;

// Frases canónicas de Fase 3 — una sola fuente para evitar derivas entre
// pantallas (LoginScreen, ProfileScreen, App).
export const DISPLAY_NAME_HELP = 'Es el nombre que verá la mesa al unirte.';
export const SESSION_EXPIRED = 'Tu sesión expiró. Vuelve a entrar.';

// Descripciones de las cartas de desarrollo para el preview (qué hace cada
// una antes de usarla). Una sola fuente para evitar reinterpretaciones.
export const DEV_CARD_DESCRIPTIONS: Record<
  'knight' | 'vp' | 'monopoly' | 'yearOfPlenty' | 'roadBuilding',
  string
> = {
  knight:
    'Mueve el ladrón a la ficha que elijas y roba 1 carta al azar a un jugador con poblado o ciudad ahí. Cada Caballero jugado cuenta para el Ejército más grande (2 puntos a partir de 3 caballeros).',
  vp: '1 punto de victoria. No suma a tu marcador hasta que la uses: al usarla, el punto se vuelve público para toda la mesa.',
  monopoly:
    'Declara un recurso: todos los demás jugadores te entregan TODAS sus cartas de ese recurso.',
  yearOfPlenty: 'Toma 2 cartas del banco, del recurso o los recursos que elijas.',
  roadBuilding: 'Coloca 2 caminos en el tablero sin pagar recursos.',
};

// Cartas de progreso (Caballeros y Ciudades, §2.10). Nombre canónico en
// español de cada una de las 25 cartas. Identificadores en inglés (espejo de
// `ProgressCardType` en types.ts); el nombre visible siempre sale de aquí.
// Nunca mostrar el id crudo ("alchemist", "warlord") en la UI.
export const PROGRESS_CARD_NAMES: Record<ProgressCardType, string> = {
  // Ciencia (verde / papel)
  alchemist: 'Alquimista',
  crane: 'Grúa',
  engineer: 'Ingeniero',
  inventor: 'Inventor',
  irrigation: 'Irrigación',
  mining: 'Minería',
  medicine: 'Medicina',
  roadBuildingP: 'Construcción de Caminos',
  smith: 'Herrero',
  printer: 'Imprenta',
  // Política (azul / moneda)
  spy: 'Espía',
  bishop: 'Obispo',
  constitution: 'Constitución',
  deserter: 'Desertor',
  diplomat: 'Diplomático',
  intrigue: 'Intriga',
  saboteur: 'Saboteador',
  warlord: 'Señor de la Guerra',
  wedding: 'Boda',
  // Comercio (amarillo / tela)
  merchant: 'Mercader',
  merchantFleet: 'Flota Mercante',
  commercialHarbor: 'Puerto Comercial',
  masterMerchant: 'Maestro Mercader',
  resourceMonopoly: 'Monopolio de Recurso',
  tradeMonopoly: 'Monopolio de Comercio',
};

// Descripción breve de cada carta de progreso para el tooltip / subtítulo
// (espejo del efecto resumido del §2.10). Aún NO son jugables (Fase C3): el
// texto sirve para que el jugador sepa qué guarda en la mano.
export const PROGRESS_CARD_DESCRIPTIONS: Record<ProgressCardType, string> = {
  alchemist: 'Antes de tirar, eliges el resultado de los dos dados de producción.',
  crane: 'Mejora una ciudad pagando 1 mercancía menos.',
  engineer: 'Construye 1 muro gratis.',
  inventor: 'Intercambia 2 fichas de número (no 2, 12, 6 ni 8).',
  irrigation: 'Gana 2 trigo por cada poblado o ciudad junto a una ficha de trigo.',
  mining: 'Gana 2 mineral por cada poblado o ciudad junto a una ficha de mineral.',
  medicine: 'Mejora un poblado a ciudad por 2 mineral y 1 trigo.',
  roadBuildingP: 'Coloca 2 caminos sin pagar recursos.',
  smith: 'Promueve gratis 2 de tus caballeros.',
  printer: 'Carta permanente: +1 punto de victoria.',
  spy: 'Mira las cartas de progreso de otro jugador y róbale una.',
  bishop: 'Mueve el ladrón y roba 1 carta a todos los jugadores junto a esa ficha.',
  constitution: 'Carta permanente: +1 punto de victoria.',
  deserter: 'Un rival retira un caballero; tú colocas uno gratis del mismo rango.',
  diplomat: 'Retira un camino abierto; si era tuyo, recolócalo gratis.',
  intrigue: 'Expulsa a un caballero rival que esté sobre tu camino.',
  saboteur: 'Cada rival con tantos o más puntos que tú descarta media mano.',
  warlord: 'Activa gratis todos tus caballeros.',
  wedding: 'Cada rival con más puntos que tú te entrega 2 recursos o mercancías.',
  merchant: 'Coloca el mercader sobre una ficha tuya para comerciar 2:1 con ese recurso.',
  merchantFleet: 'Comercia 2:1 con el banco un recurso o mercancía a tu elección este turno.',
  commercialHarbor: 'Cada rival te cambia 1 recurso por 1 mercancía tuya.',
  masterMerchant: 'Mira la mano del jugador con más puntos y róbale 2 cartas.',
  resourceMonopoly: 'Toma hasta 2 cartas de un recurso a elección de cada rival.',
  tradeMonopoly: 'Toma 1 mercancía a elección de cada rival.',
};

// Caras del dado de evento (Caballeros y Ciudades, §2.2): barco bárbaro o una
// puerta de color (disciplina). Nombre visible canónico para el input de la
// tirada y los avisos.
export const EVENT_DIE_NAMES: Record<EventDie, string> = {
  barbarian: 'Barco bárbaro',
  trade: 'Puerta de Comercio',
  politics: 'Puerta de Política',
  science: 'Puerta de Ciencia',
};

// Frase canónica para el bloque de cartas de Punto de victoria sin usar en la
// vista del dueño. Se usa en `PlayDevModal`.
export function vpCardsCopy(n: number): string {
  if (n === 1)
    return 'Tienes 1 carta de Punto de victoria sin usar. No suma a tu marcador hasta que la uses.';
  return `Tienes ${n} cartas de Punto de victoria sin usar. No suman a tu marcador hasta que las uses.`;
}
