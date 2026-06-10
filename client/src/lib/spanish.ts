import {
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
  hiddenVPSingular: 'Punto de victoria oculto',
  hiddenVPPlural: 'Cartas de victoria ocultas',
  diceStats: 'Estadísticas de dados',
  histogram: 'Histograma',
} as const;

// Frase canónica para el bloque de puntos de victoria ocultos en la vista del
// dueño. Se usa en `PlayDevModal` para evitar reinterpretaciones libres.
export function hiddenVPCopy(n: number): string {
  if (n === 1) return 'Tienes 1 punto de victoria oculto. Sumará cuando declares victoria.';
  return `Tienes ${n} puntos de victoria ocultos. Sumarán cuando declares victoria.`;
}
