import { nanoid } from 'nanoid';
import {
  GameState,
  Player,
  emptyHand,
  emptyCommodities,
  emptyImprovements,
  emptyMetropolisOwners,
  emptyDevCards,
  fullBank,
  fullCommodityBank,
  defaultExtraRules,
  PlayerColor,
} from './state';
import { buildDevDeck } from './rules';

const rooms = new Map<string, GameState>();
// Pila de snapshots para undo (uno por sala)
const undoStack = new Map<string, string[]>();
const MAX_UNDO = 10;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0 O I 1 L

export function generateCode(): string {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
  } while (rooms.has(code));
  return code;
}

// Datos del usuario autenticado (si los hay) al crear/unirse; los invitados no traen nada.
export interface UserProfileInfo {
  userId?: string;
  avatarUrl?: string;
  preferredColor?: string;
}

function newPlayer(id: string, sessionToken: string, name: string, profile?: UserProfileInfo): Player {
  return {
    id,
    userId: profile?.userId,
    sessionToken,
    name: name.trim().slice(0, 20),
    avatarUrl: profile?.avatarUrl,
    color: null,
    connected: true,
    buildings: [],
    hand: emptyHand(),
    commodities: emptyCommodities(),
    improvements: emptyImprovements(),
    metropolises: [],
    ports: [],
    devCards: emptyDevCards(),
    devCardsBoughtThisTurn: [],
    pendingSettlementRegistration: [],
    knightsPlayed: 0,
    victoryPoints: { settlements: 0, cities: 0, longestRoad: false, largestArmy: false, vpCards: 0 },
  };
}

const ALL_COLORS: PlayerColor[] = ['red', 'blue', 'white', 'orange', 'green', 'brown', 'purple'];

// Intenta asignar el color preferido del usuario si es válido para el modo y está libre.
function tryPreferredColor(state: GameState, player: Player, preferred?: string): void {
  const color = ALL_COLORS.find((c) => c === preferred);
  if (!color) return;
  const extensionOnly = color === 'green' || color === 'brown';
  if (extensionOnly && !state.extension56) return;
  if (colorAvailable(state, color, player.id)) player.color = color;
}

export function createRoom(hostName: string, profile?: UserProfileInfo): { state: GameState; hostId: string; sessionToken: string } {
  const code = generateCode();
  const hostId = nanoid(10);
  const sessionToken = nanoid(24);
  const host = newPlayer(hostId, sessionToken, hostName, profile);
  const state: GameState = {
    code,
    hostId,
    bankManagerId: hostId,
    status: 'lobby',
    extension56: false,
    citiesKnights: false,
    barbarianStep: 0,
    // En el base el ladrón siempre está activo; en C&K se desactiva al iniciar
    // la partida (queda inmovilizado hasta el primer ataque bárbaro).
    robberActive: true,
    seedInitialResources: true,
    extraRules: defaultExtraRules(),
    players: [host],
    turnOrder: [hostId],
    currentTurnIndex: 0,
    phase: 'roll',
    specialBuildQueue: [],
    hexes: [],
    bank: fullBank(false),
    commodityBank: fullCommodityBank(),
    metropolisOwners: emptyMetropolisOwners(),
    devDeck: buildDevDeck(false),
    diceStats: { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
    startedAt: null,
    lastRolledNumber: null,
    turnsPlayed: 0,
    stealsByPlayer: {},
    log: [],
    pendingDiscards: {},
    pendingRobberMove: false,
    pendingRobberSteal: false,
  };
  rooms.set(code, state);
  undoStack.set(code, []);
  tryPreferredColor(state, host, profile?.preferredColor);
  return { state, hostId, sessionToken };
}

export function getRoom(code: string): GameState | undefined {
  return rooms.get(code.toUpperCase());
}

export function joinRoom(
  code: string,
  name: string,
  profile?: UserProfileInfo
): { state: GameState; playerId: string; sessionToken: string } | { error: string } {
  const state = getRoom(code);
  if (!state) return { error: 'No encontramos esa partida.' };
  if (state.status !== 'lobby') return { error: 'Esta partida ya empezó. Pide al anfitrión que te agregue antes de iniciar.' };
  const maxPlayers = state.extension56 ? 6 : 4;
  if (state.players.length >= maxPlayers) return { error: 'La sala está llena.' };

  const playerId = nanoid(10);
  const sessionToken = nanoid(24);
  // Nombre duplicado: sufijo silencioso
  let finalName = name.trim().slice(0, 20);
  const existing = state.players.filter((p) => p.name === finalName).length;
  if (existing > 0) finalName = `${finalName} (${existing + 1})`;
  const player = newPlayer(playerId, sessionToken, finalName, profile);
  state.players.push(player);
  state.turnOrder.push(playerId);
  tryPreferredColor(state, player, profile?.preferredColor);
  return { state, playerId, sessionToken };
}

export function reconnect(
  code: string,
  playerId: string,
  sessionToken: string
): { state: GameState; player: Player } | { error: string } {
  const state = getRoom(code);
  if (!state) return { error: 'Esta partida ya no está disponible.' };
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { error: 'No te encontramos en esta partida.' };
  if (player.sessionToken !== sessionToken) return { error: 'Sesión inválida.' };
  player.connected = true;
  return { state, player };
}

export function setPlayerConnection(state: GameState, playerId: string, connected: boolean): void {
  const p = state.players.find((p) => p.id === playerId);
  if (p) p.connected = connected;
}

export function pushSnapshot(state: GameState): void {
  const stack = undoStack.get(state.code) ?? [];
  stack.push(JSON.stringify({
    players: state.players,
    hexes: state.hexes,
    bank: state.bank,
    devDeck: state.devDeck,
    diceStats: state.diceStats,
    log: state.log,
    pendingDiscards: state.pendingDiscards,
    pendingRobberMove: state.pendingRobberMove,
    pendingRobberSteal: state.pendingRobberSteal,
    phase: state.phase,
    currentTurnIndex: state.currentTurnIndex,
    specialBuildQueue: state.specialBuildQueue,
    activeTrade: state.activeTrade,
    activePortUse: state.activePortUse,
    winnerId: state.winnerId,
    status: state.status,
  }));
  if (stack.length > MAX_UNDO) stack.shift();
  undoStack.set(state.code, stack);
}

export function popSnapshot(state: GameState): boolean {
  const stack = undoStack.get(state.code) ?? [];
  const snap = stack.pop();
  if (!snap) return false;
  const restored = JSON.parse(snap);
  Object.assign(state, restored);
  return true;
}

export function deleteRoom(code: string): void {
  rooms.delete(code);
  undoStack.delete(code);
}

export function colorAvailable(state: GameState, color: PlayerColor, exceptPlayerId?: string): boolean {
  return !state.players.some((p) => p.color === color && p.id !== exceptPlayerId);
}

export function allRooms(): GameState[] {
  return Array.from(rooms.values());
}
