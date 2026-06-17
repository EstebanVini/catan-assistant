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
  | 'brown'
  | 'purple';

export const BASE_COLORS: PlayerColor[] = ['red', 'blue', 'white', 'orange', 'purple'];
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
  owners: Array<{ playerId: string; type: 'settlement' | 'city'; buildingId?: string }>;
}

// Reglas extra opcionales que el anfitrión activa en el lobby.
export interface ExtraRules {
  unequalTrades: boolean; // ofertas con un lado en 0 (regalar / pedir sin dar)
  sharedPorts: boolean; // usar el puerto de otro jugador (con comisión opcional)
  noSpecialBuild: boolean; // desactiva la construcción especial (modo 5-6)
  robberNoStealFirstRound: boolean; // el ladrón no roba en la primera ronda
  robberEmptyGivesResource: boolean; // ladrón en ficha vacía/desierto → recurso del banco
}

// Solicitud en curso para usar el puerto de otro jugador (regla sharedPorts).
// status: 'awaitingOwner' (el dueño decide) | 'awaitingRequester' (el dueño
// fijó comisión y el solicitante debe confirmarla antes de pagar).
export interface PortUseRequest {
  id: string;
  requesterId: string;
  ownerId: string;
  give: Resource;
  receive: Resource;
  ratio: number;
  status: 'awaitingOwner' | 'awaitingRequester';
  commission?: Partial<Hand>;
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string | null;
  give: Partial<Hand>;
  receive: Partial<Hand>;
  // Quiénes ya rechazaron: la oferta se oculta solo para ellos; el resto la
  // sigue viendo hasta aceptar o rechazar.
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

export interface VictoryPoints {
  settlements: number;
  cities: number;
  longestRoad: boolean;
  largestArmy: boolean;
  // Cartas de Punto de victoria USADAS (públicas). Las que siguen en la mano
  // (devCards.vp) no suman al marcador hasta que el dueño las use.
  vpCards: number;
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
  // Fase 3: identidad y registro inicial.
  avatarUrl?: string;
  isRegistered: boolean;
  setupComplete: boolean;
}

// Tabla de construcción del jugador: se registra en el lobby (2 poblados de
// salida) y se edita a voluntad durante la partida, sin requerir recursos.
export interface BuildingSpot {
  number: number; // 2–12 sin 7
  resource: Resource;
  // Identidad de la ficha física del tablero: dos spots con el mismo hexId son
  // la misma ficha (aunque sean de jugadores distintos); dos fichas físicas
  // con igual número+recurso tienen hexId distinto. Lo genera el cliente al
  // crear una ficha nueva, o lo copia al agrupar con una ficha existente.
  hexId?: string;
}

export interface Building {
  id: string;
  type: 'settlement' | 'city';
  spots: BuildingSpot[]; // 0–3 fichas (0–2 si tiene puerto)
  port?: PortType | null;
}

// Fase 3 — Notice público (banner prominente para todos).
export type NoticeLevel = 'info' | 'warn';

export interface NoticePayload {
  level: NoticeLevel;
  text: string;
}

// Fase 3 — Cuentas de usuario (REST /api/auth y /api/users).
export interface UserStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  longestRoadBadges: number;
  largestArmyBadges: number;
  totalVictoryPoints: number;
  // Racha de victorias. El backend usa `$ifNull` para usuarios viejos, pero el
  // cliente trata `undefined` como 0 por robustez hasta que todo esté migrado.
  currentWinStreak?: number;
  longestWinStreak?: number;
}

export interface User {
  id: string;
  username: string;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  color?: PlayerColor | null;
  stats: UserStats;
  createdAt: string;
}

// Fase 4 — Amigos.
export interface FriendUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  color?: PlayerColor | null;
  stats: UserStats;
}

// Resultado de búsqueda de usuarios (sin stats; para enviar solicitudes).
export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface FriendEntry {
  friendshipId: string;
  user: FriendUser;
}

export interface FriendsData {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
}

// Invitación a una sala recibida de un amigo (socket `friends:invited`).
export interface GameInvite {
  code: string;
  fromName: string;
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
  // Mi tabla de construcción (hidratación al reconectar).
  buildings?: Building[];
  // Ids de poblados comprados este turno cuyas fichas aún no se registran. El
  // servidor rechaza `turn:end` / `specialBuild:done` mientras no esté vacío;
  // el cliente lo anticipa deshabilitando esos botones y guiando el registro.
  pendingSettlementRegistration?: string[];
}

export interface PublicGameState {
  code: string;
  hostId: string;
  bankManagerId: string;
  status: GameStatus;
  extension56: boolean;
  citiesKnights: boolean;
  barbarianStep: number;
  robberActive: boolean;
  seedInitialResources: boolean;
  extraRules: ExtraRules;
  players: PublicPlayer[];
  turnOrder: string[];
  currentTurnIndex: number;
  phase: GamePhase;
  specialBuildQueue: string[];
  hexes: Hex[];
  bank: Hand;
  devDeckCount: number;
  diceStats: Record<number, number>;
  log: LogEntry[];
  pendingDiscards: Record<string, number>;
  pendingRobberMove: boolean;
  pendingRobberSteal: boolean;
  activeTrade?: TradeOffer;
  activePortUse?: PortUseRequest;
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
    vp.vpCards
  );
}

// Puntos necesarios para ganar: 13 en Caballeros y Ciudades, 10 en el base.
// Espejo de victoryTargetFor del servidor (server/src/game/state.ts).
export function victoryTarget(state: Pick<PublicGameState, 'citiesKnights'>): number {
  return state.citiesKnights ? 13 : 10;
}
