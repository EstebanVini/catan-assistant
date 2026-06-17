import {
  Commodity,
  DevCardType,
  GamePhase,
  PlayerColor,
  PortType,
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

// Frase canónica para el bloque de cartas de Punto de victoria sin usar en la
// vista del dueño. Se usa en `PlayDevModal`.
export function vpCardsCopy(n: number): string {
  if (n === 1)
    return 'Tienes 1 carta de Punto de victoria sin usar. No suma a tu marcador hasta que la uses.';
  return `Tienes ${n} cartas de Punto de victoria sin usar. No suman a tu marcador hasta que las uses.`;
}
