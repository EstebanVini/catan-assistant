// Tipos compartidos con el backend. Se duplican aquí intencionalmente
// para no acoplar el bundle del cliente al código del servidor.

export type Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore';
export const RESOURCES: Resource[] = ['brick', 'lumber', 'wool', 'grain', 'ore'];

export type Hand = Record<Resource, number>;

// Mercancías (Caballeros y Ciudades). Espejo de server/src/game/state.ts.
export type Commodity = 'coin' | 'paper' | 'cloth';
export const COMMODITIES: Commodity[] = ['coin', 'paper', 'cloth'];
export type CommodityHand = Record<Commodity, number>;

export function emptyCommodities(): CommodityHand {
  return { coin: 0, paper: 0, cloth: 0 };
}

export function commodityTotal(c: CommodityHand): number {
  return c.coin + c.paper + c.cloth;
}

// Mejoras de ciudad / disciplinas (Caballeros y Ciudades). Espejo del server.
export type Discipline = 'trade' | 'politics' | 'science';
export const DISCIPLINES: Discipline[] = ['trade', 'politics', 'science'];
export const DISCIPLINE_COMMODITY: Record<Discipline, Commodity> = {
  trade: 'cloth',
  politics: 'coin',
  science: 'paper',
};
export type CityImprovements = Record<Discipline, number>;
export const MAX_IMPROVEMENT_LEVEL = 5;

// Costo (en la mercancía de la disciplina) para subir AL nivel `target`.
export function improvementUpgradeCost(target: number): number {
  return target >= 1 && target <= MAX_IMPROVEMENT_LEVEL ? target : 0;
}

// Habilidad desbloqueada al nivel 3 de cada disciplina.
export const DISCIPLINE_LEVEL3_ABILITY: Record<Discipline, string> = {
  trade: 'Casa de Comercio',
  politics: 'Fortaleza',
  science: 'Acueducto',
};

// Cartas de progreso (Caballeros y Ciudades). Espejo del server.
export type ScienceCard =
  | 'alchemist' | 'crane' | 'engineer' | 'inventor' | 'irrigation'
  | 'mining' | 'medicine' | 'roadBuildingP' | 'smith' | 'printer';
export type PoliticsCard =
  | 'spy' | 'bishop' | 'constitution' | 'deserter' | 'diplomat'
  | 'intrigue' | 'saboteur' | 'warlord' | 'wedding';
export type TradeCard =
  | 'merchant' | 'merchantFleet' | 'commercialHarbor' | 'masterMerchant'
  | 'resourceMonopoly' | 'tradeMonopoly';
export type ProgressCardType = ScienceCard | PoliticsCard | TradeCard;

export const PROGRESS_CARD_DISCIPLINE: Record<ProgressCardType, Discipline> = {
  alchemist: 'science', crane: 'science', engineer: 'science', inventor: 'science',
  irrigation: 'science', mining: 'science', medicine: 'science', roadBuildingP: 'science',
  smith: 'science', printer: 'science',
  spy: 'politics', bishop: 'politics', constitution: 'politics', deserter: 'politics',
  diplomat: 'politics', intrigue: 'politics', saboteur: 'politics', warlord: 'politics',
  wedding: 'politics',
  merchant: 'trade', merchantFleet: 'trade', commercialHarbor: 'trade',
  masterMerchant: 'trade', resourceMonopoly: 'trade', tradeMonopoly: 'trade',
};

export const PROGRESS_HAND_LIMIT = 4;

// Cartas de progreso con automatización plena en la app (las demás son de
// "registro asistido": se juegan y se resuelven en la mesa). Espejo de la
// lógica de progress:play en el servidor.
export const PROGRESS_AUTOMATED: ProgressCardType[] = [
  'printer', 'constitution', 'resourceMonopoly', 'tradeMonopoly', 'irrigation', 'mining', 'engineer',
];
// Cartas que requieren elegir un recurso / una mercancía al jugarse.
export const PROGRESS_NEEDS_RESOURCE: ProgressCardType[] = ['resourceMonopoly'];
export const PROGRESS_NEEDS_COMMODITY: ProgressCardType[] = ['tradeMonopoly'];

// Caras del dado de evento: barco bárbaro o una puerta de color (disciplina).
export type EventDie = 'barbarian' | Discipline;

// Caballeros (Caballeros y Ciudades). Espejo del server.
export type KnightRank = 1 | 2 | 3;
export interface Knight {
  id: string;
  rank: KnightRank;
  active: boolean;
}
export const MAX_KNIGHTS = 6;
// Hasta 2 caballeros de cada rango (básico/fuerte/poderoso) a la vez.
export const MAX_KNIGHTS_PER_RANK = 2;
export const MAX_WALLS = 3;

// Límite de mano antes de descartar con un 7 (espejo del server). En C&K cada
// muro suma +2 y el conteo incluye recursos + mercancías.
export function handLimitForSeven(walls: number, citiesKnights: boolean): number {
  return citiesKnights ? 7 + 2 * walls : 7;
}
export const KNIGHT_RANK_NAMES: Record<KnightRank, string> = {
  1: 'Básico',
  2: 'Fuerte',
  3: 'Poderoso',
};

export function knightDefenseStrength(knights: Knight[]): number {
  return knights.reduce((sum, k) => sum + (k.active ? k.rank : 0), 0);
}

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
  commodityCount: number; // total de mercancías (público); el detalle es privado
  improvements: CityImprovements; // niveles de mejora de ciudad (público)
  metropolises: Discipline[]; // disciplinas con metrópolis (público)
  progressCardsCount: number; // total de cartas de progreso (público); detalle privado
  knights: Knight[]; // caballeros (rango + activo); público. Solo C&K.
  defenderCards: number; // cartas Defensor de Catán (+1 PV c/u); público
  walls: number; // muros de ciudad (0..3); público
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
  commodities: CommodityHand; // mercancías propias (privado; solo Caballeros y Ciudades)
  progressCards: ProgressCardType[]; // mis cartas de progreso (privado; máx 4)
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
  barbarianAttacks: number;
  robberActive: boolean;
  metropolisOwners: Record<Discipline, string | null>;
  lastRedDie: number | null;
  lastEventDie: EventDie | null;
  pendingProgressDiscard: Record<string, number>;
  pendingBarbarianLoss: string[]; // jugadores que deben degradar una ciudad
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

// PV TOTALES de un jugador público, incluyendo lo de Caballeros y Ciudades
// (metrópolis +2 c/u, Defensor de Catán +1 c/u). Espejo de publicVictoryPoints
// del servidor. Usar SIEMPRE este en vez de totalVictoryPoints(vp) cuando se
// dispone del PublicPlayer, para no subcontar en C&K.
export function playerVictoryPoints(
  p: Pick<PublicPlayer, 'victoryPoints' | 'metropolises' | 'defenderCards'>
): number {
  return (
    totalVictoryPoints(p.victoryPoints) +
    2 * (p.metropolises?.length ?? 0) +
    (p.defenderCards ?? 0)
  );
}
