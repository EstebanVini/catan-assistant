import { GameState, Player, emptyHand, emptyDevCards, handTotal, devCardsTotal } from '../game/state';
import { playerSetupComplete } from '../game/setup';

// Vista personalizada: oculta manos y devCards ajenas; muestra solo conteos.
export interface PublicPlayer {
  id: string;
  name: string;
  avatarUrl?: string;
  isRegistered: boolean; // tiene cuenta (userId); los invitados no acumulan stats
  color: Player['color'];
  connected: boolean;
  setupComplete: boolean; // registro de construcciones iniciales válido (lobby)
  cardCount: number;
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
    devCards: Player['devCards'];
    devCardsBoughtThisTurn: Player['devCardsBoughtThisTurn'];
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
          devCards: me.devCards,
          devCardsBoughtThisTurn: me.devCardsBoughtThisTurn,
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
    // En el modo "sin fichas" el registro de salida es opcional: todos cuentan
    // como listos para no bloquear el inicio.
    setupComplete: !state.seedInitialResources || playerSetupComplete(p),
    cardCount: handTotal(p.hand),
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
