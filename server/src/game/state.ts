export type Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore';
export const RESOURCES: Resource[] = ['brick', 'lumber', 'wool', 'grain', 'ore'];

export type Hand = Record<Resource, number>;

export type DevCardType = 'knight' | 'vp' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly';

export type PortType = '3:1' | Resource;

export type PlayerColor = 'red' | 'blue' | 'white' | 'orange' | 'green' | 'brown';
export const BASE_COLORS: PlayerColor[] = ['red', 'blue', 'white', 'orange'];
export const EXTENSION_COLORS: PlayerColor[] = ['green', 'brown'];

export interface DevCardCounts {
  knight: number;
  vp: number;
  roadBuilding: number;
  yearOfPlenty: number;
  monopoly: number;
}

// Construcción registrada por el jugador (su "Tabla de construcción"): un
// poblado o ciudad del tablero físico con las fichas (número + recurso) que
// toca. Se registra en el lobby (2 poblados de salida) y se edita a voluntad
// durante la partida; los hexes de producción se derivan de aquí.
export interface Building {
  id: string;
  type: 'settlement' | 'city';
  spots: Array<{ number: number; resource: Resource }>; // 0..3 fichas (el desierto no se registra)
}

export interface Player {
  id: string;
  userId?: string; // _id del User en MongoDB; ausente si juega como invitado
  sessionToken: string; // privado, no se envía a otros
  name: string;
  avatarUrl?: string; // foto de perfil (pública en la partida) si está registrado
  color: PlayerColor | null;
  connected: boolean;
  buildings: Building[]; // tabla de construcción del jugador (ver game/setup.ts)
  hand: Hand; // PRIVADO
  ports: PortType[];
  devCards: DevCardCounts; // PRIVADO en tipos; conteo total + caballeros jugados es público
  devCardsBoughtThisTurn: DevCardType[]; // no jugables el mismo turno
  knightsPlayed: number; // público
  victoryPoints: {
    settlements: number;
    cities: number;
    longestRoad: boolean;
    largestArmy: boolean;
    // Cartas de Punto de victoria USADAS (públicas). Las que siguen en la
    // mano (devCards.vp) no suman al marcador hasta que el dueño las use.
    vpCards: number;
  };
}

export interface Hex {
  id: string;
  number: number | null; // 2..12 (sin 7); null para desierto
  resource: Resource | null;
  robber: boolean;
  // buildingId agrupa las entradas que pertenecen a la MISMA construcción física
  // (un poblado toca 1..3 fichas): así los VP no se cuentan de más. Las entradas
  // sin buildingId (ediciones manuales de la tabla) cuentan 1 cada una.
  owners: Array<{ playerId: string; type: 'settlement' | 'city'; buildingId?: string }>;
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string | null; // null = a cualquiera (broadcast)
  give: Partial<Hand>;
  receive: Partial<Hand>;
  // Jugadores que ya rechazaron: la oferta se les oculta solo a ellos. Cuando
  // todos los elegibles rechazan, la oferta se retira para todos.
  rejectedBy: string[];
}

export type GamePhase = 'roll' | 'discard' | 'robber' | 'main' | 'specialBuild';
export type GameStatus = 'lobby' | 'playing' | 'ended';

export interface LogEntry {
  id: string;
  ts: number;
  text: string;
  playerId?: string;
}

export interface GameState {
  code: string;
  hostId: string;
  bankManagerId: string;
  status: GameStatus;
  extension56: boolean;
  players: Player[];
  turnOrder: string[];
  currentTurnIndex: number;
  phase: GamePhase;
  specialBuildQueue: string[]; // ids pendientes (solo extensión)
  hexes: Hex[];
  bank: Hand;
  devDeck: DevCardType[]; // mazo barajado (servidor)
  diceStats: Record<number, number>;
  startedAt: number | null; // epoch ms al iniciar la partida (para persistir el Match)
  lastRolledNumber: number | null; // último número del dado ingresado (UI sin parsear log)
  turnsPlayed: number; // turnos completos jugados (para resumen del ganador)
  stealsByPlayer: Record<string, number>; // playerId -> robos exitosos (para "MVP de robos")
  log: LogEntry[];
  pendingDiscards: Record<string, number>;
  pendingRobberMove: boolean; // tras el 7, el activo debe colocar el ladrón
  pendingRobberSteal: boolean; // tras colocar el ladrón, hay que robar
  activeTrade?: TradeOffer;
  winnerId?: string;
  // Punto de extensión futuro: variante "paired players" en lugar de specialBuild.
  // Punto de extensión futuro: autocompletar hexes desde foto del tablero.
}

export function emptyHand(): Hand {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
}

export function fullBank(extension56: boolean): Hand {
  const n = extension56 ? 24 : 19;
  return { brick: n, lumber: n, wool: n, grain: n, ore: n };
}

export function emptyDevCards(): DevCardCounts {
  return { knight: 0, vp: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0 };
}

export function handTotal(hand: Hand): number {
  return hand.brick + hand.lumber + hand.wool + hand.grain + hand.ore;
}

export function devCardsTotal(d: DevCardCounts): number {
  return d.knight + d.vp + d.roadBuilding + d.yearOfPlenty + d.monopoly;
}
