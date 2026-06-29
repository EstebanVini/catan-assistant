import {
  GameState,
  Player,
  emptyHand,
  emptyDevCards,
  handTotal,
  devCardsTotal,
  commodityTotal,
} from '../game/state';
import { playerSetupComplete } from '../game/setup';

// Vista personalizada: oculta manos y devCards ajenas; muestra solo conteos.
export interface PublicPlayer {
  id: string;
  name: string;
  avatarUrl?: string;
  isRegistered: boolean; // tiene cuenta (userId); los invitados no acumulan stats
  color: Player['color'];
  connected: boolean;
  winStreak: number; // racha de victorias activa (para el ícono 🔥); 0 si no hay
  setupComplete: boolean; // registro de construcciones iniciales válido (lobby)
  cardCount: number;
  commodityCount: number; // total de mercancías (público); el detalle es privado
  improvements: Player['improvements']; // niveles de mejora de ciudad (público)
  metropolises: Player['metropolises']; // disciplinas con metrópolis (público)
  progressCardsCount: number; // total de cartas de progreso (público); detalle privado
  knights: Player['knights']; // caballeros (rango + activo); público. Solo C&K.
  defenderCards: number; // cartas Defensor de Catán (+1 PV c/u); público
  walls: number; // muros de ciudad (0..3); público
  devCardsCount: number;
  knightsPlayed: number;
  ports: Player['ports'];
  victoryPoints: Player['victoryPoints'];
}

export interface PlayerView {
  me: {
    id: string;
    name: string;
    color: Player['color'];
    hand: Player['hand'];
    commodities: Player['commodities'];
    progressCards: Player['progressCards']; // mis cartas de progreso (privado)
    devCards: Player['devCards'];
    devCardsBoughtThisTurn: Player['devCardsBoughtThisTurn'];
    pendingSettlementRegistration: Player['pendingSettlementRegistration'];
    ports: Player['ports'];
    buildings: Player['buildings'];
    sessionToken?: string; // solo se manda en el handshake inicial
  } | null;
  state: {
    code: string;
    hostId: string;
    bankManagerId: string;
    status: GameState['status'];
    extension56: boolean;
    citiesKnights: boolean;
    barbarianStep: number;
    barbarianAttacks: number;
    robberActive: boolean;
    metropolisOwners: GameState['metropolisOwners'];
    lastRedDie: number | null;
    lastEventDie: GameState['lastEventDie'];
    pendingProgressDiscard: GameState['pendingProgressDiscard'];
    pendingBarbarianLoss: string[];
    seedInitialResources: boolean;
    extraRules: GameState['extraRules'];
    players: PublicPlayer[];
    turnOrder: string[];
    currentTurnIndex: number;
    phase: GameState['phase'];
    specialBuildQueue: string[];
    hexes: GameState['hexes'];
    bank: GameState['bank'];
    devDeckCount: number; // cartas restantes en el mazo de desarrollo (el contenido sigue oculto)
    diceStats: GameState['diceStats'];
    log: GameState['log'];
    pendingDiscards: GameState['pendingDiscards'];
    pendingRobberMove: boolean;
    pendingRobberSteal: boolean;
    robberOnEmpty: boolean;
    activeTrade?: GameState['activeTrade'];
    activePortUse?: GameState['activePortUse'];
    winnerId?: string;
    lastRolledNumber: number | null;
    turnsPlayed: number;
    stealsByPlayer: Record<string, number>;
  };
}

export function buildView(state: GameState, viewerId: string | null): PlayerView {
  const me = viewerId ? state.players.find((p) => p.id === viewerId) ?? null : null;
  return {
    me: me
      ? {
          id: me.id,
          name: me.name,
          color: me.color,
          hand: me.hand,
          commodities: me.commodities,
          progressCards: me.progressCards,
          devCards: me.devCards,
          devCardsBoughtThisTurn: me.devCardsBoughtThisTurn,
          pendingSettlementRegistration: me.pendingSettlementRegistration,
          ports: me.ports,
          buildings: me.buildings,
        }
      : null,
    state: {
      code: state.code,
      hostId: state.hostId,
      bankManagerId: state.bankManagerId,
      status: state.status,
      extension56: state.extension56,
      citiesKnights: state.citiesKnights,
      barbarianStep: state.barbarianStep,
      barbarianAttacks: state.barbarianAttacks,
      robberActive: state.robberActive,
      metropolisOwners: state.metropolisOwners,
      lastRedDie: state.lastRedDie,
      lastEventDie: state.lastEventDie,
      pendingProgressDiscard: state.pendingProgressDiscard,
      pendingBarbarianLoss: state.pendingBarbarianLoss,
      seedInitialResources: state.seedInitialResources,
      extraRules: state.extraRules,
      players: state.players.map((p) => toPublic(p, state)),
      turnOrder: state.turnOrder,
      currentTurnIndex: state.currentTurnIndex,
      phase: state.phase,
      specialBuildQueue: state.specialBuildQueue,
      hexes: state.hexes,
      bank: state.bank,
      devDeckCount: state.devDeck.length,
      diceStats: state.diceStats,
      log: state.log.slice(-100),
      pendingDiscards: state.pendingDiscards,
      pendingRobberMove: state.pendingRobberMove,
      pendingRobberSteal: state.pendingRobberSteal,
      robberOnEmpty: state.robberOnEmpty,
      activeTrade: state.activeTrade,
      activePortUse: state.activePortUse,
      winnerId: state.winnerId,
      lastRolledNumber: state.lastRolledNumber,
      turnsPlayed: state.turnsPlayed,
      stealsByPlayer: state.stealsByPlayer,
    },
  };
}

function toPublic(p: Player, state: GameState): PublicPlayer {
  return {
    id: p.id,
    name: p.name,
    avatarUrl: p.avatarUrl,
    isRegistered: !!p.userId,
    color: p.color,
    connected: p.connected,
    winStreak: p.winStreak ?? 0,
    // En el modo "sin fichas" el registro de salida es opcional: todos cuentan
    // como listos para no bloquear el inicio.
    setupComplete: !state.seedInitialResources || playerSetupComplete(p),
    cardCount: handTotal(p.hand),
    commodityCount: commodityTotal(p.commodities),
    improvements: { ...p.improvements },
    metropolises: [...p.metropolises],
    progressCardsCount: p.progressCards.length,
    knights: p.knights.map((k) => ({ ...k })),
    defenderCards: p.defenderCards,
    walls: p.walls,
    devCardsCount: devCardsTotal(p.devCards),
    knightsPlayed: p.knightsPlayed,
    ports: p.ports,
    // Todo el marcador es público: vpCards son cartas de Punto de victoria ya
    // usadas. Las que siguen en la mano solo se ven como devCardsCount.
    victoryPoints: { ...p.victoryPoints },
  };
}

// Alias histórico: cuando existían VP ocultos, la vista del dueño difería de
// la pública. Hoy son idénticas; se conserva el nombre para los handlers.
export function buildViewWithOwnHidden(state: GameState, viewerId: string): PlayerView {
  return buildView(state, viewerId);
}

// Helpers para construir manos/devCards vacíos sin importar desde state.
export { emptyHand, emptyDevCards };
