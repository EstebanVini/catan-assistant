export type Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore';
export const RESOURCES: Resource[] = ['brick', 'lumber', 'wool', 'grain', 'ore'];

export type Hand = Record<Resource, number>;

export type DevCardType = 'knight' | 'vp' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly';

export type PortType = '3:1' | Resource;

export type PlayerColor = 'red' | 'blue' | 'white' | 'orange' | 'green' | 'brown' | 'purple';
export const BASE_COLORS: PlayerColor[] = ['red', 'blue', 'white', 'orange', 'purple'];
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
// Una ficha (número + recurso) que toca una construcción. `hexId` identifica
// la ficha FÍSICA del tablero: dos spots con el mismo `hexId` son la misma
// ficha (aunque pertenezcan a jugadores distintos), y dos fichas físicas con
// el mismo número+recurso tienen `hexId` distinto. Cuando falta (registros
// antiguos), el server agrupa por número+recurso como antes (compatibilidad).
export interface BuildingSpot {
  number: number;
  resource: Resource;
  hexId?: string;
}

export interface Building {
  id: string;
  type: 'settlement' | 'city';
  spots: BuildingSpot[]; // 0..3 fichas (0..2 si tiene puerto)
  port?: PortType | null;
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
  // Poblados comprados en el turno/construcción especial actual cuyas fichas
  // aún no se registran (spots vacíos). Bloquea terminar el turno hasta que el
  // dueño registre los recursos del poblado. Se vacía al rotar de turno.
  pendingSettlementRegistration: string[]; // ids de Building pendientes
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

// Reglas extra opcionales que el anfitrión activa en el lobby.
export interface ExtraRules {
  // Permite ofertas de intercambio "desiguales": un lado puede dar 0 cartas
  // (regalar o recibir sin dar).
  unequalTrades: boolean;
  // En tu turno puedes usar el puerto de otro jugador; el dueño aprueba y
  // puede pedir una comisión (cartas de recursos) o dejarlo gratis.
  sharedPorts: boolean;
  // Desactiva la fase de construcción especial en el modo 5-6 jugadores.
  noSpecialBuild: boolean;
  // El ladrón no roba recursos durante la primera ronda de turnos.
  robberNoStealFirstRound: boolean;
  // Si mueves el ladrón a una ficha sin dueños o al desierto, el banco te da
  // 1 recurso aleatorio.
  robberEmptyGivesResource: boolean;
}

export function defaultExtraRules(): ExtraRules {
  return {
    unequalTrades: false,
    sharedPorts: false,
    noSpecialBuild: false,
    robberNoStealFirstRound: false,
    robberEmptyGivesResource: false,
  };
}

// Solicitud en curso para usar el puerto de otro jugador (regla extra
// sharedPorts). Flujo de 3 pasos: el solicitante propone ('awaitingOwner');
// el dueño aprueba fijando una comisión opcional. Si hay comisión, pasa a
// 'awaitingRequester' para que el solicitante la confirme antes de ejecutar;
// si es gratis se ejecuta de inmediato. `ratio` es la mejor proporción del
// DUEÑO para el recurso dado.
export interface PortUseRequest {
  id: string;
  requesterId: string;
  ownerId: string;
  give: Resource;
  receive: Resource;
  ratio: number;
  status: 'awaitingOwner' | 'awaitingRequester';
  // Comisión fijada por el dueño (cartas que pagará el solicitante). Presente
  // cuando status es 'awaitingRequester'.
  commission?: Partial<Hand>;
}

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
  // Si es true (default), al iniciar se reparten los recursos de las fichas
  // registradas. Si es false, el registro de fichas es opcional y nadie
  // recibe recursos de inicio.
  seedInitialResources: boolean;
  extraRules: ExtraRules;
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
  activePortUse?: PortUseRequest; // solicitud en curso de uso de puerto ajeno
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
