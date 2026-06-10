import { GameState, Player, emptyHand, emptyDevCards, handTotal, devCardsTotal } from '../game/state';

// Vista personalizada: oculta manos y devCards ajenas; muestra solo conteos.
export interface PublicPlayer {
  id: string;
  name: string;
  color: Player['color'];
  connected: boolean;
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
    sessionToken?: string; // solo se manda en el handshake inicial
  } | null;
  state: {
    code: string;
    hostId: string;
    bankManagerId: string;
    status: GameState['status'];
    extension56: boolean;
    players: PublicPlayer[];
    turnOrder: string[];
    currentTurnIndex: number;
    phase: GameState['phase'];
    specialBuildQueue: string[];
    hexes: GameState['hexes'];
    bank: GameState['bank'];
    diceStats: GameState['diceStats'];
    log: GameState['log'];
    pendingDiscards: GameState['pendingDiscards'];
    pendingRobberMove: boolean;
    pendingRobberSteal: boolean;
    activeTrade?: GameState['activeTrade'];
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
        }
      : null,
    state: {
      code: state.code,
      hostId: state.hostId,
      bankManagerId: state.bankManagerId,
      status: state.status,
      extension56: state.extension56,
      // Al terminar la partida, revelamos las VP ocultas SOLO del ganador.
      players: state.players.map((p) => toPublic(p, state.status === 'ended' && state.winnerId === p.id)),
      turnOrder: state.turnOrder,
      currentTurnIndex: state.currentTurnIndex,
      phase: state.phase,
      specialBuildQueue: state.specialBuildQueue,
      hexes: state.hexes,
      bank: state.bank,
      diceStats: state.diceStats,
      log: state.log.slice(-100),
      pendingDiscards: state.pendingDiscards,
      pendingRobberMove: state.pendingRobberMove,
      pendingRobberSteal: state.pendingRobberSteal,
      activeTrade: state.activeTrade,
      winnerId: state.winnerId,
      lastRolledNumber: state.lastRolledNumber,
      turnsPlayed: state.turnsPlayed,
      stealsByPlayer: state.stealsByPlayer,
    },
  };
}

function toPublic(p: Player, revealHidden: boolean = false): PublicPlayer {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    connected: p.connected,
    cardCount: handTotal(p.hand),
    devCardsCount: devCardsTotal(p.devCards),
    knightsPlayed: p.knightsPlayed,
    ports: p.ports,
    // hiddenVP solo se revela del ganador al terminar la partida (los demás siguen ocultos).
    victoryPoints: { ...p.victoryPoints, hiddenVP: revealHidden ? p.victoryPoints.hiddenVP : 0 },
  };
}

// Para el dueño, hiddenVP sí va.
export function buildViewWithOwnHidden(state: GameState, viewerId: string): PlayerView {
  const view = buildView(state, viewerId);
  const myPublic = view.state.players.find((p) => p.id === viewerId);
  const meRecord = state.players.find((p) => p.id === viewerId);
  if (myPublic && meRecord) {
    myPublic.victoryPoints = { ...meRecord.victoryPoints };
  }
  return view;
}

// Helpers para construir manos/devCards vacíos sin importar desde state.
export { emptyHand, emptyDevCards };
