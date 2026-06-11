import { Server, Socket } from 'socket.io';
import { nanoid } from 'nanoid';
import {
  GameState,
  Hand,
  Player,
  PlayerColor,
  PortType,
  Resource,
  RESOURCES,
  emptyHand,
  fullBank,
  handTotal,
} from '../game/state';
import {
  BUILD_COSTS,
  activePlayer,
  bestBankRatio,
  buildDevDeck,
  canAfford,
  computePendingDiscards,
  distributeForRoll,
  executeTrade,
  findPlayer,
  payToBank,
  recomputeLargestArmy,
  recomputeVictoryPoints,
  shortfall,
  stealRandomResource,
  takeFromBank,
  totalVictoryPoints,
  tradeWithBank,
  validateTradeOffer,
} from '../game/rules';
import {
  UserProfileInfo,
  colorAvailable,
  createRoom,
  getRoom,
  joinRoom,
  popSnapshot,
  pushSnapshot,
  reconnect,
  setPlayerConnection,
} from '../game/rooms';
import { Building, DevCardType } from '../game/state';
import { applyInitialSetup, playerSetupComplete, rebuildHexes, validateBuildings } from '../game/setup';
import { buildViewWithOwnHidden } from './views';
import { isDbConnected } from '../db/connection';
import { User } from '../db/models/User';
import { persistMatchResult } from '../db/persistMatch';

// Trackea qué socket pertenece a qué playerId / code
interface SocketData {
  code?: string;
  playerId?: string;
  userId?: string; // adjuntado por el guard del handshake si el JWT es válido
}

// Perfil del usuario autenticado (displayName, avatar, color preferido) para crear/unirse.
async function loadProfile(socket: Socket): Promise<(UserProfileInfo & { displayName?: string }) | undefined> {
  const userId = (socket.data as SocketData).userId;
  if (!userId || !isDbConnected()) return undefined;
  try {
    const user = await User.findById(userId);
    if (!user) return undefined;
    return {
      userId,
      avatarUrl: user.avatarUrl ?? undefined,
      preferredColor: user.color ?? undefined,
      displayName: user.displayName,
    };
  } catch {
    return undefined;
  }
}

// Broadcast vista personalizada a cada socket de una sala
function broadcastState(io: Server, state: GameState): void {
  const sockets = io.sockets.adapter.rooms.get(state.code);
  if (!sockets) return;
  for (const sid of sockets) {
    const s = io.sockets.sockets.get(sid);
    if (!s) continue;
    const data = s.data as SocketData;
    const view = buildViewWithOwnHidden(state, data.playerId ?? '');
    s.emit('state:update', view);
  }
}

function logAction(state: GameState, text: string, playerId?: string): void {
  state.log.push({ id: nanoid(8), ts: Date.now(), text, playerId });
}

function ensureActive(state: GameState, playerId: string | undefined): boolean {
  const active = activePlayer(state);
  return !!active && !!playerId && active.id === playerId;
}

function ensureBankManager(state: GameState, playerId: string | undefined): boolean {
  return !!playerId && state.bankManagerId === playerId;
}

function ensureHost(state: GameState, playerId: string | undefined): boolean {
  return !!playerId && state.hostId === playerId;
}

// Avanza al siguiente turno. En extensión 5–6, abre fase de construcción especial.
function advanceTurnOrSpecialBuild(state: GameState): void {
  if (state.extension56) {
    // Construir cola: todos menos el activo, en orden horario empezando por el siguiente
    const activeIdx = state.currentTurnIndex;
    const order = state.turnOrder;
    const queue: string[] = [];
    for (let i = 1; i < order.length; i++) {
      queue.push(order[(activeIdx + i) % order.length]);
    }
    state.specialBuildQueue = queue;
    state.phase = 'specialBuild';
    logAction(state, 'Empieza la fase de Construcción especial.');
  } else {
    nextTurn(state);
  }
}

function nextTurn(state: GameState): void {
  // Limpiar dev compradas este turno antes de pasar (regla: no se juegan el mismo turno)
  // Las pasamos al pool jugable para el dueño que las compró.
  for (const p of state.players) {
    if (p.devCardsBoughtThisTurn.length > 0) p.devCardsBoughtThisTurn = [];
  }
  state.turnsPlayed += 1;
  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  state.phase = 'roll';
  state.pendingRobberMove = false;
  state.pendingRobberSteal = false;
  const next = activePlayer(state);
  if (next) logAction(state, `Turno de ${next.name}.`, next.id);
}

function checkAllDiscardsDone(state: GameState): void {
  const remaining = Object.values(state.pendingDiscards).reduce((a, b) => a + b, 0);
  if (remaining === 0) {
    state.phase = 'robber';
    state.pendingRobberMove = true;
    logAction(state, 'Todos descartaron. Turno de mover el ladrón.');
  }
}

export function registerHandlers(io: Server, socket: Socket): void {
  // No reiniciar socket.data: el guard del handshake ya adjuntó userId si había JWT.

  socket.on('game:create', async ({ name }: { name?: string }, cb?: (res: unknown) => void) => {
    const profile = await loadProfile(socket);
    const finalName = (typeof name === 'string' && name.trim()) || profile?.displayName || '';
    if (!finalName) {
      cb?.({ error: 'Escribe tu nombre para continuar.' });
      return;
    }
    const { state, hostId, sessionToken } = createRoom(finalName, profile);
    socket.data.code = state.code;
    socket.data.playerId = hostId;
    socket.join(state.code);
    cb?.({ code: state.code, playerId: hostId, sessionToken });
    broadcastState(io, state);
  });

  socket.on('game:join', async ({ code, name }: { code: string; name?: string }, cb?: (res: unknown) => void) => {
    const profile = await loadProfile(socket);
    const finalName = (typeof name === 'string' && name.trim()) || profile?.displayName || '';
    if (!code || !finalName) {
      cb?.({ error: 'Necesitas un código y tu nombre.' });
      return;
    }
    const result = joinRoom(code, finalName, profile);
    if ('error' in result) {
      cb?.({ error: result.error });
      return;
    }
    socket.data.code = result.state.code;
    socket.data.playerId = result.playerId;
    socket.join(result.state.code);
    cb?.({ code: result.state.code, playerId: result.playerId, sessionToken: result.sessionToken });
    logAction(result.state, `${result.state.players.find((p) => p.id === result.playerId)!.name} se unió a la sala.`, result.playerId);
    broadcastState(io, result.state);
  });

  socket.on(
    'game:reconnect',
    (
      { code, playerId, sessionToken }: { code: string; playerId: string; sessionToken: string },
      cb?: (res: unknown) => void
    ) => {
      const r = reconnect(code, playerId, sessionToken);
      if ('error' in r) {
        cb?.({ error: r.error });
        return;
      }
      socket.data.code = r.state.code;
      socket.data.playerId = playerId;
      socket.join(r.state.code);
      cb?.({ ok: true });
      broadcastState(io, r.state);
    }
  );

  // === Lobby ===
  socket.on('lobby:setColor', ({ color }: { color: PlayerColor }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'lobby') return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    const extensionColors: PlayerColor[] = ['green', 'brown'];
    if (extensionColors.includes(color) && !state.extension56) {
      socket.emit('error', { message: 'Ese color solo está en la extensión 5–6.' });
      return;
    }
    if (!colorAvailable(state, color, player.id)) {
      socket.emit('error', { message: 'Ese color ya está tomado. Elige otro.' });
      return;
    }
    player.color = color;
    broadcastState(io, state);
  });

  socket.on('lobby:setTurnOrder', ({ orderedPlayerIds }: { orderedPlayerIds: string[] }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'lobby') return;
    if (!ensureHost(state, socket.data.playerId)) return;
    const ids = new Set(state.players.map((p) => p.id));
    if (orderedPlayerIds.length !== state.players.length || !orderedPlayerIds.every((id) => ids.has(id))) {
      socket.emit('error', { message: 'No pudimos reordenar. Intenta de nuevo.' });
      return;
    }
    state.turnOrder = orderedPlayerIds;
    broadcastState(io, state);
  });

  socket.on('lobby:setBankManager', ({ playerId }: { playerId: string }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'lobby') return;
    if (!ensureHost(state, socket.data.playerId)) return;
    if (!findPlayer(state, playerId)) return;
    state.bankManagerId = playerId;
    broadcastState(io, state);
  });

  socket.on('lobby:setExtension56', ({ enabled }: { enabled: boolean }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'lobby') return;
    if (!ensureHost(state, socket.data.playerId)) return;
    if (!enabled) {
      // Bloquear si hay >4 jugadores o alguno con color de extensión
      const extColors: PlayerColor[] = ['green', 'brown'];
      if (state.players.length > 4) {
        socket.emit('error', { message: 'Quita jugadores hasta quedar en 4 para desactivar la extensión.' });
        return;
      }
      if (state.players.some((p) => p.color && extColors.includes(p.color))) {
        socket.emit('error', { message: 'Pide a los jugadores en Verde o Café que cambien de color primero.' });
        return;
      }
    }
    state.extension56 = enabled;
    state.bank = fullBank(enabled);
    state.devDeck = buildDevDeck(enabled);
    broadcastState(io, state);
  });

  socket.on('lobby:rollOrderByDice', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'lobby') return;
    if (!ensureHost(state, socket.data.playerId)) return;
    state.turnOrder = state.turnOrder
      .map((id) => ({ id, r: Math.random() }))
      .sort((a, b) => b.r - a.r)
      .map((x) => x.id);
    logAction(state, 'Se sorteó el orden de turnos con dados.');
    broadcastState(io, state);
  });

  // Tabla de construcción del jugador: en el lobby registra sus 2 poblados de
  // salida; durante la partida agrega/edita poblados y ciudades A VOLUNTAD
  // (sin requerir recursos — el tablero físico es la autoridad). Solo edita
  // la suya; los hexes de producción se derivan de las tablas de todos.
  socket.on('player:setBuildings', ({ buildings }: { buildings: Building[] }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status === 'ended') return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    const val = validateBuildings(buildings);
    if (!val.ok) {
      socket.emit('error', { message: val.reason });
      return;
    }
    const playing = state.status === 'playing';
    if (playing) pushSnapshot(state);
    const before = {
      settlements: player.buildings.filter((b) => b.type === 'settlement').length,
      cities: player.buildings.filter((b) => b.type === 'city').length,
    };
    player.buildings = buildings.map((b) => ({
      id: b.id || nanoid(8),
      type: b.type,
      spots: b.spots.map((s) => ({ number: s.number, resource: s.resource })),
    }));
    if (playing) {
      state.hexes = rebuildHexes(state.players, state.hexes);
      recomputeVictoryPoints(state);
      const after = {
        settlements: player.buildings.filter((b) => b.type === 'settlement').length,
        cities: player.buildings.filter((b) => b.type === 'city').length,
      };
      if (after.settlements !== before.settlements || after.cities !== before.cities) {
        logAction(
          state,
          `${player.name} actualizó su tabla: ${after.settlements} ${after.settlements === 1 ? 'poblado' : 'poblados'} y ${after.cities} ${after.cities === 1 ? 'ciudad' : 'ciudades'}.`,
          player.id
        );
      }
    }
    broadcastState(io, state);
  });

  socket.on('game:start', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'lobby') return;
    if (!ensureHost(state, socket.data.playerId)) return;
    const ready = state.players.filter((p) => p.color);
    if (ready.length < 3) {
      socket.emit('error', { message: 'Faltan jugadores con color. Mínimo 3.' });
      return;
    }
    if (state.players.some((p) => !p.color)) {
      socket.emit('error', { message: 'Falta que todos elijan color.' });
      return;
    }
    const incomplete = state.players.filter((p) => !playerSetupComplete(p));
    if (incomplete.length > 0) {
      socket.emit('error', {
        message: `Falta el registro de poblados iniciales de: ${incomplete.map((p) => p.name).join(', ')}.`,
      });
      return;
    }
    state.status = 'playing';
    state.phase = 'roll';
    state.currentTurnIndex = 0;
    state.startedAt = Date.now();

    // Derivar los hexes de producción y repartir los recursos de inicio:
    // 1 carta por cada ficha que tocan los poblados registrados (todos).
    const setup = applyInitialSetup(state.players, state.bank);
    state.hexes = setup.hexes;
    for (const player of state.players) {
      const grant = setup.grants[player.id];
      if (!grant) continue;
      const parts = (Object.entries(grant) as [Resource, number][])
        .filter(([, n]) => n > 0)
        .map(([r, n]) => {
          player.hand[r] += n;
          return `${n} ${esResource(r)}`;
        });
      if (parts.length > 0) logAction(state, `Recursos de inicio de ${player.name}: ${parts.join(', ')}.`, player.id);
    }
    for (const s of setup.shortages) {
      const p = findPlayer(state, s.playerId);
      logAction(state, `El banco no tenía ${esResource(s.resource)} para los recursos de inicio de ${p?.name ?? 'jugador'}.`);
    }
    recomputeVictoryPoints(state);
    logAction(state, `Empieza la partida. Turno de ${activePlayer(state)?.name}.`);
    broadcastState(io, state);
  });

  // (Los antiguos handlers hex:* desaparecieron: los hexes ahora se derivan
  // de las tablas de construcción vía player:setBuildings.)

  socket.on('player:setPorts', ({ ports }: { ports: PortType[] }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    pushSnapshot(state);
    player.ports = ports;
    broadcastState(io, state);
  });

  // === Tirada ===
  socket.on('turn:rollNumber', ({ number }: { number: number }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'playing') return;
    if (!ensureBankManager(state, socket.data.playerId)) {
      socket.emit('error', { message: 'Solo el encargado del banco puede ingresar el dado.' });
      return;
    }
    if (state.phase !== 'roll') {
      socket.emit('error', { message: 'Ya no es la fase Tirar.' });
      return;
    }
    if (number < 2 || number > 12) return;
    pushSnapshot(state);
    state.diceStats[number] = (state.diceStats[number] ?? 0) + 1;
    state.lastRolledNumber = number;
    if (number === 7) {
      const pending = computePendingDiscards(state);
      logAction(state, 'Salió un 7. Quienes tengan más de 7 cartas descartan la mitad.');
      if (Object.keys(pending).length > 0) {
        state.pendingDiscards = pending;
        state.phase = 'discard';
      } else {
        state.phase = 'robber';
        state.pendingRobberMove = true;
        logAction(state, 'Nadie descarta. Turno de mover el ladrón.');
      }
    } else {
      const result = distributeForRoll(state, number);
      const lines: string[] = [];
      for (const [pid, hand] of Object.entries(result.perPlayer)) {
        const p = findPlayer(state, pid);
        if (!p) continue;
        const parts = (Object.entries(hand) as [Resource, number][]).map(([r, n]) => `${n} ${esResource(r)}`);
        lines.push(`${p.name} recibe ${parts.join(', ')}`);
      }
      logAction(state, `Salió ${number}. ${lines.join('; ') || 'Nadie recibió recursos.'}`);
      for (const partial of result.partials) {
        const p = findPlayer(state, partial.playerId);
        if (!p) continue;
        logAction(state, `El banco solo tenía ${partial.given} ${esResource(partial.resource)} para ${p.name}: recibió ${partial.given} en vez de ${partial.wanted}.`);
      }
      for (const res of result.shortages) {
        logAction(state, `El banco no alcanzaba para todos con ${esResource(res)}: nadie recibió.`);
      }
      state.phase = 'main';
    }
    broadcastState(io, state);
  });

  // === Descarte ===
  socket.on('discard:submit', ({ resourcesToDiscard }: { resourcesToDiscard: Partial<Hand> }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    if (state.phase !== 'discard') return;
    const required = state.pendingDiscards[player.id] ?? 0;
    if (required === 0) return;
    const total = Object.values(resourcesToDiscard).reduce((a, b) => a + (b ?? 0), 0);
    if (total !== required) {
      socket.emit('error', { message: `Debes descartar exactamente ${required} cartas.` });
      return;
    }
    for (const [res, n] of Object.entries(resourcesToDiscard) as [Resource, number][]) {
      if (player.hand[res] < n) {
        socket.emit('error', { message: 'No tienes esas cartas en la mano.' });
        return;
      }
    }
    pushSnapshot(state);
    for (const [res, n] of Object.entries(resourcesToDiscard) as [Resource, number][]) {
      player.hand[res] -= n;
      state.bank[res] += n;
    }
    delete state.pendingDiscards[player.id];
    logAction(state, `${player.name} descartó ${required} cartas.`, player.id);
    checkAllDiscardsDone(state);
    broadcastState(io, state);
  });

  // El bank manager puede descartar por un jugador desconectado (aleatorio)
  socket.on('discard:forceRandom', ({ targetPlayerId }: { targetPlayerId: string }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.phase !== 'discard') return;
    if (!ensureBankManager(state, socket.data.playerId) && !ensureHost(state, socket.data.playerId)) return;
    const target = findPlayer(state, targetPlayerId);
    if (!target) return;
    if (target.connected) {
      socket.emit('error', { message: 'Ese jugador volvió a conectarse.' });
      return;
    }
    const required = state.pendingDiscards[targetPlayerId] ?? 0;
    if (required === 0) return;
    pushSnapshot(state);
    const pool: Resource[] = [];
    for (const r of RESOURCES) for (let i = 0; i < target.hand[r]; i++) pool.push(r);
    for (let i = 0; i < required && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const res = pool[idx];
      pool.splice(idx, 1);
      target.hand[res] -= 1;
      state.bank[res] += 1;
    }
    delete state.pendingDiscards[targetPlayerId];
    logAction(state, `${target.name} estaba desconectado: el banco descartó ${required} cartas al azar.`, target.id);
    checkAllDiscardsDone(state);
    broadcastState(io, state);
  });

  // === Ladrón ===
  socket.on('robber:move', ({ hexId }: { hexId: string }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    if (!ensureActive(state, socket.data.playerId)) {
      socket.emit('error', { message: 'Solo el jugador en turno mueve el ladrón.' });
      return;
    }
    if (state.phase !== 'robber' || !state.pendingRobberMove) return;
    const targetHex = state.hexes.find((h) => h.id === hexId);
    if (!targetHex) return;
    if (targetHex.robber) {
      socket.emit('error', { message: 'El ladrón ya está ahí. Elige otra ficha.' });
      return;
    }
    pushSnapshot(state);
    for (const h of state.hexes) h.robber = false;
    targetHex.robber = true;
    state.pendingRobberMove = false;
    const active = activePlayer(state)!;
    logAction(state, `${active.name} movió el ladrón.`, active.id);

    // Verificar si hay a quién robar
    const candidates = targetHex.owners.filter((o) => o.playerId !== active.id);
    if (candidates.length === 0) {
      logAction(state, 'No hay a quién robarle en esa ficha.');
      state.phase = 'main';
    } else {
      state.pendingRobberSteal = true;
    }
    broadcastState(io, state);
  });

  socket.on('robber:steal', ({ targetPlayerId }: { targetPlayerId: string }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    if (!ensureActive(state, socket.data.playerId)) return;
    if (!state.pendingRobberSteal) return;
    const active = activePlayer(state)!;
    const victim = findPlayer(state, targetPlayerId);
    if (!victim || victim.id === active.id) return;
    // Validar que sea dueño del hex del ladrón
    const robberHex = state.hexes.find((h) => h.robber);
    if (!robberHex || !robberHex.owners.some((o) => o.playerId === targetPlayerId)) {
      socket.emit('error', { message: 'Ese jugador no tiene poblado ni ciudad en esa ficha.' });
      return;
    }
    pushSnapshot(state);
    const stolen = stealRandomResource(victim, active);
    if (stolen) {
      state.stealsByPlayer[active.id] = (state.stealsByPlayer[active.id] ?? 0) + 1;
      logAction(state, `${active.name} le robó 1 carta a ${victim.name}.`, active.id);
    } else {
      logAction(state, `${active.name} intentó robarle a ${victim.name}, pero ${victim.name} no tenía cartas.`, active.id);
    }
    state.pendingRobberSteal = false;
    state.phase = 'main';
    broadcastState(io, state);
  });

  // === Construir ===
  socket.on('build', ({ type }: { type: 'road' | 'settlement' | 'city' | 'devcard' }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    // En main solo el activo; en specialBuild solo el primero de la cola
    if (state.phase === 'main') {
      if (!ensureActive(state, player.id)) {
        socket.emit('error', { message: 'No es tu turno.' });
        return;
      }
    } else if (state.phase === 'specialBuild') {
      if (state.specialBuildQueue[0] !== player.id) {
        socket.emit('error', { message: 'No es tu turno en la Construcción especial.' });
        return;
      }
    } else {
      socket.emit('error', { message: 'No puedes construir ahora.' });
      return;
    }
    const cost = BUILD_COSTS[type];
    if (!canAfford(player.hand, cost)) {
      const lack = shortfall(player.hand, cost);
      const parts = (Object.entries(lack) as [Resource, number][]).map(([r, n]) => `${n} ${esResource(r)}`);
      socket.emit('error', { message: `Te falta: ${parts.join(', ')}.` });
      return;
    }
    pushSnapshot(state);
    payToBank(player.hand, state.bank, cost);
    if (type === 'devcard') {
      const card = state.devDeck.pop();
      if (!card) {
        socket.emit('error', { message: 'No quedan cartas de desarrollo.' });
        return;
      }
      player.devCards[card] += 1;
      if (card === 'vp') player.victoryPoints.hiddenVP += 1;
      else player.devCardsBoughtThisTurn.push(card);
      logAction(state, `${player.name} compró una carta de desarrollo.`, player.id);
    } else {
      const label = type === 'road' ? 'un Camino' : type === 'settlement' ? 'un Poblado' : 'una Ciudad';
      logAction(state, `${player.name} construyó ${label}.`, player.id);
    }
    broadcastState(io, state);
    checkVictory(io, state, player);
  });

  // === Cartas de desarrollo ===
  socket.on('dev:play', ({ card, payload }: { card: 'knight' | 'monopoly' | 'yearOfPlenty' | 'roadBuilding'; payload?: any }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    if (!ensureActive(state, player.id)) {
      socket.emit('error', { message: 'Solo el jugador en turno juega cartas de desarrollo.' });
      return;
    }
    if (state.phase !== 'roll' && state.phase !== 'main') {
      socket.emit('error', { message: 'No puedes jugar cartas de desarrollo ahora.' });
      return;
    }
    // Knight permitido antes de tirar (en 'roll'); las demás solo en 'main'
    if (card !== 'knight' && state.phase !== 'main') {
      socket.emit('error', { message: 'Solo puedes jugar esta carta después de tirar.' });
      return;
    }
    if (player.devCards[card] <= 0) {
      socket.emit('error', { message: 'No tienes esa carta.' });
      return;
    }
    if (player.devCardsBoughtThisTurn.includes(card)) {
      socket.emit('error', { message: 'No puedes jugar una carta comprada este turno.' });
      return;
    }
    pushSnapshot(state);
    player.devCards[card] -= 1;
    if (card === 'knight') {
      player.knightsPlayed += 1;
      const prev = state.players.find((p) => p.victoryPoints.largestArmy)?.id ?? null;
      recomputeLargestArmy(state, prev);
      state.phase = 'robber';
      state.pendingRobberMove = true;
      logAction(state, `${player.name} jugó un Caballero.`, player.id);
    } else if (card === 'monopoly') {
      const res = payload?.resource as Resource;
      if (!RESOURCES.includes(res)) {
        socket.emit('error', { message: 'Elige un recurso válido.' });
        return;
      }
      let total = 0;
      for (const other of state.players) {
        if (other.id === player.id) continue;
        total += other.hand[res];
        other.hand[res] = 0;
      }
      player.hand[res] += total;
      logAction(state, `${player.name} declaró Monopolio de ${esResource(res)} y se llevó ${total} cartas.`, player.id);
    } else if (card === 'yearOfPlenty') {
      const picks = (payload?.resources as Resource[]) ?? [];
      if (picks.length !== 2) {
        socket.emit('error', { message: 'Elige 2 recursos.' });
        return;
      }
      for (const r of picks) {
        if (!RESOURCES.includes(r) || state.bank[r] < 1) {
          socket.emit('error', { message: 'El banco se quedó sin ese recurso.' });
          return;
        }
      }
      for (const r of picks) {
        state.bank[r] -= 1;
        player.hand[r] += 1;
      }
      logAction(state, `${player.name} jugó Año de la abundancia: tomó ${picks.map(esResource).join(' y ')}.`, player.id);
    } else if (card === 'roadBuilding') {
      logAction(state, `${player.name} jugó Construcción de caminos.`, player.id);
      // El tablero es físico; no descontamos recursos. Si quisiéramos llevar conteo, iría aquí.
    }
    broadcastState(io, state);
    checkVictory(io, state, player);
  });

  // === Intercambio con banco/puertos ===
  socket.on('trade:bank', ({ give, receive }: { give: Resource; receive: Resource }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    if (!ensureActive(state, player.id) || state.phase !== 'main') {
      socket.emit('error', { message: 'Solo puedes intercambiar en tu turno, después de tirar.' });
      return;
    }
    pushSnapshot(state);
    const r = tradeWithBank(state, player, give, receive);
    if (!r.ok) {
      popSnapshot(state); // revertir
      socket.emit('error', { message: r.reason ?? 'No pudimos hacer el intercambio.' });
      return;
    }
    logAction(state, `${player.name} intercambió con el banco ${r.ratio}:1: dio ${esResource(give)}, recibió ${esResource(receive)}.`, player.id);
    broadcastState(io, state);
  });

  // === Intercambio entre jugadores ===
  socket.on(
    'trade:offer',
    ({ toId, give, receive }: { toId: string | null; give: Partial<Hand>; receive: Partial<Hand> }) => {
      const state = getRoom(socket.data.code ?? '');
      if (!state) return;
      const player = findPlayer(state, socket.data.playerId ?? '');
      if (!player) return;
      if (!ensureActive(state, player.id) || state.phase !== 'main') {
        socket.emit('error', { message: 'Solo puedes ofrecer intercambios en tu turno, después de tirar.' });
        return;
      }
      state.activeTrade = {
        id: nanoid(8),
        fromId: player.id,
        toId,
        give,
        receive,
        rejectedBy: [],
      };
      logAction(state, `${player.name} ofreció un intercambio.`, player.id);
      broadcastState(io, state);
    }
  );

  socket.on('trade:respond', ({ accept }: { accept: boolean }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || !state.activeTrade) return;
    const responder = findPlayer(state, socket.data.playerId ?? '');
    if (!responder) return;
    const offer = state.activeTrade;
    if (offer.toId && offer.toId !== responder.id) return;
    if (responder.id === offer.fromId) return;
    // Quien ya rechazó no puede volver a responder a la misma oferta.
    if (offer.rejectedBy.includes(responder.id)) return;
    if (!accept) {
      // El rechazo es individual: la oferta se oculta solo para quien
      // rechazó; los demás la siguen viendo hasta aceptar o rechazar.
      offer.rejectedBy.push(responder.id);
      logAction(state, `${responder.name} rechazó el intercambio.`, responder.id);
      const eligible = offer.toId
        ? [offer.toId]
        : state.players.filter((p) => p.id !== offer.fromId).map((p) => p.id);
      if (eligible.every((id) => offer.rejectedBy.includes(id))) {
        state.activeTrade = undefined;
        logAction(state, 'Nadie aceptó el intercambio: la oferta se retiró.');
      }
      broadcastState(io, state);
      return;
    }
    const from = findPlayer(state, offer.fromId);
    if (!from) return;
    const val = validateTradeOffer(from, responder, offer.give, offer.receive);
    if (!val.ok) {
      socket.emit('error', { message: val.reason ?? 'La oferta ya no es válida.' });
      state.activeTrade = undefined;
      broadcastState(io, state);
      return;
    }
    pushSnapshot(state);
    executeTrade(from, responder, offer.give, offer.receive);
    logAction(state, `${responder.name} aceptó el intercambio con ${from.name}.`, responder.id);
    state.activeTrade = undefined;
    broadcastState(io, state);
  });

  socket.on('trade:cancel', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || !state.activeTrade) return;
    if (state.activeTrade.fromId !== socket.data.playerId) return;
    state.activeTrade = undefined;
    broadcastState(io, state);
  });

  // === Fin de turno ===
  socket.on('turn:end', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    if (state.phase === 'main' && ensureActive(state, socket.data.playerId)) {
      pushSnapshot(state);
      advanceTurnOrSpecialBuild(state);
      broadcastState(io, state);
    }
  });

  // === Fase de construcción especial ===
  socket.on('specialBuild:done', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.phase !== 'specialBuild') return;
    if (state.specialBuildQueue[0] !== socket.data.playerId) return;
    pushSnapshot(state);
    state.specialBuildQueue.shift();
    if (state.specialBuildQueue.length === 0) {
      nextTurn(state);
    }
    broadcastState(io, state);
  });

  socket.on('specialBuild:skip', ({ playerId }: { playerId: string }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.phase !== 'specialBuild') return;
    if (!ensureHost(state, socket.data.playerId) && !ensureBankManager(state, socket.data.playerId)) return;
    if (state.specialBuildQueue[0] !== playerId) return;
    const p = findPlayer(state, playerId);
    pushSnapshot(state);
    state.specialBuildQueue.shift();
    logAction(state, `Se saltó el turno de ${p?.name ?? 'jugador'} en Construcción especial.`);
    if (state.specialBuildQueue.length === 0) {
      nextTurn(state);
    }
    broadcastState(io, state);
  });

  // === Insignias y victoria ===
  socket.on('vp:setLongestRoad', ({ playerId }: { playerId: string | null }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    if (!ensureBankManager(state, socket.data.playerId) && !ensureHost(state, socket.data.playerId)) return;
    pushSnapshot(state);
    for (const p of state.players) p.victoryPoints.longestRoad = false;
    if (playerId) {
      const p = findPlayer(state, playerId);
      if (p) {
        p.victoryPoints.longestRoad = true;
        logAction(state, `${p.name} tiene el Camino más largo.`, p.id);
      }
    } else {
      logAction(state, `Nadie tiene el Camino más largo.`);
    }
    broadcastState(io, state);
  });

  socket.on('game:declareWin', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    if (!ensureActive(state, player.id)) {
      socket.emit('error', { message: 'Solo puedes declarar victoria en tu turno.' });
      return;
    }
    if (totalVictoryPoints(player) < 10) {
      socket.emit('error', { message: 'Necesitas 10 puntos para declarar victoria.' });
      return;
    }
    state.status = 'ended';
    state.winnerId = player.id;
    logAction(state, `${player.name} declaró victoria con ${totalVictoryPoints(player)} puntos.`, player.id);
    broadcastState(io, state);
    // Persistir resultado y stats en MongoDB (no bloquea la partida si falla)
    void persistMatchResult(state);
  });

  // === Entrega manual de cartas (admin/banco, en cualquier momento) ===
  // Anti-trampas: SIEMPRE notifica a todos (notice) y queda en el log.
  socket.on(
    'admin:giveCard',
    ({
      targetPlayerId,
      kind,
      resource,
      devCard,
      force,
    }: {
      targetPlayerId: string;
      kind: 'resource' | 'dev';
      resource?: Resource;
      devCard?: DevCardType;
      force?: boolean;
    }) => {
      const state = getRoom(socket.data.code ?? '');
      if (!state || state.status === 'ended') return;
      if (!ensureBankManager(state, socket.data.playerId) && !ensureHost(state, socket.data.playerId)) {
        socket.emit('error', { message: 'Solo el anfitrión o el encargado del banco pueden entregar cartas.' });
        return;
      }
      const target = findPlayer(state, targetPlayerId);
      if (!target) return;
      const giver = findPlayer(state, socket.data.playerId ?? '');
      if (kind === 'resource') {
        if (!resource || !RESOURCES.includes(resource)) {
          socket.emit('error', { message: 'Elige un recurso válido.' });
          return;
        }
        if (state.bank[resource] < 1 && !force) {
          socket.emit('error', { message: `El banco no tiene ${esResource(resource)}. Puedes forzar la entrega si la mesa lo acuerda.` });
          return;
        }
        pushSnapshot(state);
        if (state.bank[resource] >= 1) state.bank[resource] -= 1;
        target.hand[resource] += 1;
        const text = `⚠️ El banco entregó 1 ${esResource(resource)} a ${target.name}`;
        logAction(state, `${text} (entrega manual de ${giver?.name ?? 'banco'}).`, target.id);
        io.to(state.code).emit('notice', { level: 'warn', text });
      } else {
        const validDev: DevCardType[] = ['knight', 'vp', 'roadBuilding', 'yearOfPlenty', 'monopoly'];
        if (!devCard || !validDev.includes(devCard)) {
          socket.emit('error', { message: 'Elige una carta de desarrollo válida.' });
          return;
        }
        const idxInDeck = state.devDeck.indexOf(devCard);
        if (idxInDeck === -1 && !force) {
          socket.emit('error', { message: 'No quedan cartas de ese tipo en el mazo. Puedes forzar la entrega si la mesa lo acuerda.' });
          return;
        }
        pushSnapshot(state);
        if (idxInDeck !== -1) state.devDeck.splice(idxInDeck, 1);
        target.devCards[devCard] += 1;
        if (devCard === 'vp') target.victoryPoints.hiddenVP += 1;
        const text = `⚠️ El banco entregó 1 carta de desarrollo a ${target.name}`;
        logAction(state, `${text} (entrega manual de ${giver?.name ?? 'banco'}).`, target.id);
        io.to(state.code).emit('notice', { level: 'warn', text });
      }
      broadcastState(io, state);
    }
  );

  // === Undo ===
  socket.on('action:undo', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    if (!ensureBankManager(state, socket.data.playerId) && !ensureHost(state, socket.data.playerId)) return;
    if (popSnapshot(state)) {
      logAction(state, 'El banco deshizo la última acción.');
      broadcastState(io, state);
    }
  });

  // === Desconexión ===
  socket.on('disconnect', () => {
    const data = socket.data as SocketData;
    if (!data.code || !data.playerId) return;
    const state = getRoom(data.code);
    if (!state) return;
    setPlayerConnection(state, data.playerId, false);
    broadcastState(io, state);
  });
}

function esResource(r: Resource): string {
  return {
    brick: 'ladrillo',
    lumber: 'madera',
    wool: 'lana',
    grain: 'trigo',
    ore: 'mineral',
  }[r];
}

function checkVictory(io: Server, state: GameState, player: Player): void {
  recomputeVictoryPoints(state);
  if (totalVictoryPoints(player) >= 10 && state.status === 'playing') {
    // No declarar automáticamente; pero notificar al jugador con un mensaje en el log silencioso
    // El jugador debe tocar "Declarar victoria".
  }
  broadcastState(io, state);
}
