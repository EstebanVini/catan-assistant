// Tipos compartidos con el backend. Se duplican aquí intencionalmente
// para no acoplar el bundle del cliente al código del servidor.

export type Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore';
export const RESOURCES: Resource[] = ['brick', 'lumber', 'wool', 'grain', 'ore'];

export type Hand = Record<Resource, number>;

export type DevCardType =
  | 'knight'
  | 'vp'
  | 'roadBuilding'
  | 'yearOfPlenty'
  | 'monopoly';

export type PortType = '3:1' | Resource;

export type PlayerColor =
  | 'red'
  | 'blue'
  | 'white'
  | 'orange'
  | 'green'
  | 'brown';

export const BASE_COLORS: PlayerColor[] = ['red', 'blue', 'white', 'orange'];
export const EXTENSION_COLORS: PlayerColor[] = ['green', 'brown'];

export interface DevCardCounts {
  knight: number;
  vp: number;
  roadBuilding: number;
  yearOfPlenty: number;
  monopoly: number;
}

export interface Hex {
  id: string;
  number: number | null;
  resource: Resource | null;
  robber: boolean;
  owners: Array<{ playerId: string; type: 'settlement' | 'city' }>;
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string | null;
  give: Partial<Hand>;
  receive: Partial<Hand>;
}

export type GamePhase = 'roll' | 'discard' | 'robber' | 'main' | 'specialBuild';
export type GameStatus = 'lobby' | 'playing' | 'ended';

export interface LogEntry {
  id: string;
  ts: number;
  text: string;
  playerId?: string;
}

export interface VictoryPoints {
  settlements: number;
  cities: number;
  longestRoad: boolean;
  largestArmy: boolean;
  hiddenVP: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  color: PlayerColor | null;
  connected: boolean;
  cardCount: number;
  devCardsCount: number;
  knightsPlayed: number;
  ports: PortType[];
  victoryPoints: VictoryPoints;
}

export interface MeView {
  id: string;
  name: string;
  color: PlayerColor | null;
  hand: Hand;
  devCards: DevCardCounts;
  devCardsBoughtThisTurn: DevCardType[];
  ports: PortType[];
  sessionToken?: string;
}

export interface PublicGameState {
  code: string;
  hostId: string;
  bankManagerId: string;
  status: GameStatus;
  extension56: boolean;
  players: PublicPlayer[];
  turnOrder: string[];
  currentTurnIndex: number;
  phase: GamePhase;
  specialBuildQueue: string[];
  hexes: Hex[];
  bank: Hand;
  diceStats: Record<number, number>;
  log: LogEntry[];
  pendingDiscards: Record<string, number>;
  pendingRobberMove: boolean;
  pendingRobberSteal: boolean;
  activeTrade?: TradeOffer;
  winnerId?: string;
  // Espejos directos del estado autoritativo del servidor (ver
  // server/src/game/state.ts). Reemplazan parseos derivados del log y
  // habilitan métricas para la pantalla de ganador.
  lastRolledNumber: number | null;
  turnsPlayed: number;
  stealsByPlayer: Record<string, number>;
}

export interface PlayerView {
  me: MeView | null;
  state: PublicGameState;
}

// Costos de construcción (espejo del servidor para mostrar en la UI)
export const BUILD_COSTS: Record<
  'road' | 'settlement' | 'city' | 'devcard',
  Partial<Hand>
> = {
  road: { lumber: 1, brick: 1 },
  settlement: { lumber: 1, brick: 1, wool: 1, grain: 1 },
  city: { grain: 2, ore: 3 },
  devcard: { wool: 1, grain: 1, ore: 1 },
};

export type BuildType = keyof typeof BUILD_COSTS;

export interface PersistedSession {
  code: string;
  playerId: string;
  sessionToken: string;
  name: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function emptyHand(): Hand {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
}

export function handTotal(hand: Hand): number {
  return hand.brick + hand.lumber + hand.wool + hand.grain + hand.ore;
}

export function devCardsTotal(d: DevCardCounts): number {
  return d.knight + d.vp + d.roadBuilding + d.yearOfPlenty + d.monopoly;
}

export function totalVictoryPoints(vp: VictoryPoints): number {
  return (
    vp.settlements +
    vp.cities * 2 +
    (vp.longestRoad ? 2 : 0) +
    (vp.largestArmy ? 2 : 0) +
    vp.hiddenVP
  );
}
