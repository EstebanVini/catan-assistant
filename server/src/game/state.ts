export type Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore';
export const RESOURCES: Resource[] = ['brick', 'lumber', 'wool', 'grain', 'ore'];

export type Hand = Record<Resource, number>;

// === Mercancías (Caballeros y Ciudades) ===
// Segundo tipo de carta, SOLO lo producen las ciudades. Cada mercancía está
// ligada a un terreno y a una disciplina de mejora de ciudad:
//   coin  ← montañas (ore)    → Política
//   paper ← bosque   (lumber) → Ciencia
//   cloth ← pastura  (wool)   → Comercio
export type Commodity = 'coin' | 'paper' | 'cloth';
export const COMMODITIES: Commodity[] = ['coin', 'paper', 'cloth'];
export type CommodityHand = Record<Commodity, number>;

// Recurso → mercancía que produce una CIUDAD sobre ese terreno (las ciudades
// sobre grain/brick no producen mercancía: dan 2 recursos como en el base).
export const RESOURCE_COMMODITY: Partial<Record<Resource, Commodity>> = {
  ore: 'coin',
  lumber: 'paper',
  wool: 'cloth',
};

// === Mejoras de ciudad / disciplinas (Caballeros y Ciudades) ===
// Tres disciplinas, cada una mejorada con SU mercancía. Nivel 0..5.
//   trade    (Comercio, amarillo) ← cloth ; nivel 3 = Casa de comercio (2:1)
//   politics (Política, azul)     ← coin  ; nivel 3 = Fortaleza (caballeros nivel 3)
//   science  (Ciencia, verde)     ← paper ; nivel 3 = Acueducto
// Nivel 4 → reclama metrópolis (ciudad de 4 PV). Nivel 5 → la arrebata.
export type Discipline = 'trade' | 'politics' | 'science';
export const DISCIPLINES: Discipline[] = ['trade', 'politics', 'science'];
export const DISCIPLINE_COMMODITY: Record<Discipline, Commodity> = {
  trade: 'cloth',
  politics: 'coin',
  science: 'paper',
};
export type CityImprovements = Record<Discipline, number>; // nivel 0..5 por disciplina

export function emptyImprovements(): CityImprovements {
  return { trade: 0, politics: 0, science: 0 };
}

export const MAX_IMPROVEMENT_LEVEL = 5;
// Costo (en la mercancía de la disciplina) para subir AL nivel `target`
// (1→1, 2→2, ... 5→5). Devuelve 0 si fuera de rango.
export function improvementUpgradeCost(target: number): number {
  return target >= 1 && target <= MAX_IMPROVEMENT_LEVEL ? target : 0;
}

// === Cartas de progreso (Caballeros y Ciudades) ===
// Reemplazan a las cartas de desarrollo. 3 mazos, uno por disciplina; se roban
// por el "calendario de la ciudad" (dado de evento de color + dado rojo ≤ nivel
// de mejora). Límite de mano: 4. No se comercian. Sus EFECTOS se implementan
// en la fase C3; aquí solo se definen, se roban y se sostienen en la mano.
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

// Disciplina (mazo) a la que pertenece cada carta.
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

// Composición de cada mazo (cantidades oficiales: 18 por disciplina, 54 total).
export const PROGRESS_DECK_COUNTS: Record<Discipline, Partial<Record<ProgressCardType, number>>> = {
  science: {
    alchemist: 2, crane: 2, engineer: 1, inventor: 2, irrigation: 2,
    mining: 2, medicine: 2, roadBuildingP: 2, smith: 2, printer: 1,
  },
  politics: {
    spy: 3, bishop: 2, constitution: 1, deserter: 2, diplomat: 2,
    intrigue: 2, saboteur: 2, warlord: 2, wedding: 2,
  },
  trade: {
    merchant: 6, merchantFleet: 2, commercialHarbor: 2, masterMerchant: 2,
    resourceMonopoly: 4, tradeMonopoly: 2,
  },
};

// Cartas de progreso que otorgan +1 PV permanente al jugarse (como las VP del base).
export const PROGRESS_VP_CARDS: ProgressCardType[] = ['printer', 'constitution'];

export type ProgressDecks = Record<Discipline, ProgressCardType[]>;
export const PROGRESS_HAND_LIMIT = 4;

// Caras del dado de evento: barco bárbaro o una "puerta" de color (disciplina).
export type EventDie = 'barbarian' | Discipline;

// === Caballeros (Caballeros y Ciudades) ===
// Piezas con rango (1 básico, 2 fuerte, 3 poderoso) y estado activo/inactivo.
// En el asistente NO hay geometría de tablero (decisión caballeros-plan.md §13):
// se contabilizan rango y estado; los movimientos/expulsiones se arbitran en la
// mesa. La fuerza de defensa contra los bárbaros = suma del rango de los
// caballeros ACTIVOS.
export type KnightRank = 1 | 2 | 3;
export interface Knight {
  id: string;
  rank: KnightRank;
  active: boolean;
}
export const MAX_KNIGHTS = 6; // 2 de cada rango (informativo)

// Costos (en recursos) de las acciones de caballero.
export const KNIGHT_BUILD_COST: Partial<Hand> = { wool: 1, ore: 1 };
export const KNIGHT_ACTIVATE_COST: Partial<Hand> = { grain: 1 };
export const KNIGHT_PROMOTE_COST: Partial<Hand> = { wool: 1, ore: 1 };

// Fuerza de defensa de un jugador: suma del rango de sus caballeros ACTIVOS.
export function knightDefenseStrength(knights: Knight[]): number {
  return knights.reduce((sum, k) => sum + (k.active ? k.rank : 0), 0);
}

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
  commodities: CommodityHand; // PRIVADO; solo se usa en Caballeros y Ciudades
  // Niveles de mejora de ciudad por disciplina (público). Solo C&K.
  improvements: CityImprovements;
  // Disciplinas en las que el jugador tiene metrópolis (ciudad de 4 PV; máx 3,
  // una por disciplina). Cada una suma +2 PV sobre una ciudad normal. Público.
  metropolises: Discipline[];
  // Cartas de progreso en mano (PRIVADO; máx 4). Solo C&K. El conteo es público.
  progressCards: ProgressCardType[];
  // Caballeros del jugador (público: rango + estado activo). Solo C&K.
  knights: Knight[];
  // Cartas "Defensor de Catán" acumuladas (+1 PV cada una). Público. Solo C&K.
  defenderCards: number;
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
  // Modo "Caballeros y Ciudades" (Cities & Knights). Aditivo: cuando es false
  // (default) el juego se comporta EXACTAMENTE como el base. Los campos C&K
  // (barbarianStep, robberActive, y los nuevos del jugador) solo se usan
  // cuando es true. Ver caballeros-plan.md.
  citiesKnights: boolean;
  // Pista del barco bárbaro (0..7). Avanza con la cara de barco del dado de
  // evento; al llegar a 7 los bárbaros atacan y vuelve a 0. Solo en C&K.
  barbarianStep: number;
  // Nº de ataques bárbaros ocurridos. El primer ataque activa el ladrón
  // (robberActive). La resolución detallada del combate llega en la Fase D.
  barbarianAttacks: number;
  // El ladrón queda inmovilizado hasta el PRIMER ataque bárbaro: antes de eso
  // un 7 solo provoca descarte. false hasta el primer ataque. Solo en C&K; en
  // el modo base es true desde el inicio (el ladrón siempre se mueve).
  robberActive: boolean;
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
  // Banco de mercancías (solo Caballeros y Ciudades). Siempre presente para no
  // ramificar tipos; en el modo base queda en 0 y nadie lo toca.
  commodityBank: CommodityHand;
  // Dueño actual de cada metrópolis (playerId o null). Solo C&K.
  metropolisOwners: Record<Discipline, string | null>;
  // Mazos de cartas de progreso barajados (servidor; ocultos). Solo C&K.
  progressDecks: ProgressDecks;
  // Último dado rojo (1-6) y dado de evento ingresados (para la UI y el calendario).
  lastRedDie: number | null;
  lastEventDie: EventDie | null;
  // Jugadores que deben descartar cartas de progreso por exceder el límite de 4
  // (al robar la 5ª). playerId → cuántas debe soltar (normalmente 1). Solo C&K.
  pendingProgressDiscard: Record<string, number>;
  // Tras un ataque bárbaro perdido: jugadores que deben degradar una ciudad a
  // poblado (eligen cuál). Solo C&K. Vacío cuando no hay pendiente.
  pendingBarbarianLoss: string[];
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

export function emptyCommodities(): CommodityHand {
  return { coin: 0, paper: 0, cloth: 0 };
}

// Banco de mercancías: 12 de cada una (decisión de mesa: ilimitado informativo,
// igual que el banco de recursos del base).
export function fullCommodityBank(): CommodityHand {
  return { coin: 12, paper: 12, cloth: 12 };
}

export function commodityTotal(c: CommodityHand): number {
  return c.coin + c.paper + c.cloth;
}

export function emptyMetropolisOwners(): Record<Discipline, string | null> {
  return { trade: null, politics: null, science: null };
}

export function emptyProgressDecks(): ProgressDecks {
  return { trade: [], politics: [], science: [] };
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

// Puntos necesarios para ganar: 13 en Caballeros y Ciudades, 10 en el base.
export function victoryTargetFor(state: Pick<GameState, 'citiesKnights'>): number {
  return state.citiesKnights ? 13 : 10;
}
