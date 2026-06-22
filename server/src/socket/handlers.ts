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
  Commodity,
  CommodityHand,
  COMMODITIES,
  Discipline,
  DISCIPLINES,
  EventDie,
  ProgressCardType,
  PROGRESS_HAND_LIMIT,
  MAX_KNIGHTS_PER_RANK,
  KNIGHT_BUILD_COST,
  KNIGHT_ACTIVATE_COST,
  KNIGHT_PROMOTE_COST,
  MAX_WALLS,
  WALL_COST,
  emptyHand,
  emptyGameStats,
  fullBank,
  handTotal,
  victoryTargetFor,
} from '../game/state';
import {
  BUILD_COSTS,
  activePlayer,
  bestBankRatio,
  buildDevDeck,
  canAfford,
  computePendingDiscards,
  distributeForRoll,
  drainBank,
  drainCommodityBank,
  drawsProgressCard,
  upgradeCityImprovement,
  resolveBarbarianAttack,
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
  deleteRoom,
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
import { acceptedFriendIds } from '../auth/friends';
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
      currentWinStreak: user.stats?.currentWinStreak ?? 0,
      displayName: user.displayName,
    };
  } catch {
    return undefined;
  }
}

// Actualiza los picos por partida (logros) en cada cambio de estado: máximo de
// cada recurso sostenido en mano, máximo de puertos, y el máximo Δ PV logrado
// dentro del turno del jugador activo. Barato: una pasada por jugador.
function trackPeaks(state: GameState): void {
  for (const p of state.players) {
    const gs = p.gameStats;
    if (!gs) continue;
    for (const r of RESOURCES) {
      if (p.hand[r] > gs.peakResource[r]) gs.peakResource[r] = p.hand[r];
    }
    if (p.ports.length > gs.peakPorts) gs.peakPorts = p.ports.length;
  }
  if (state.status === 'playing') {
    const active = activePlayer(state);
    if (active?.gameStats) {
      const gain = totalVictoryPoints(active) - active.gameStats.turnStartVP;
      if (gain > active.gameStats.maxVpGainInTurn) active.gameStats.maxVpGainInTurn = gain;
    }
  }
}

// Suma a cada jugador los recursos recibidos en una tirada (para el logro
// "Mala suerte": una ronda completa sin recibir ningún recurso).
function recordReceipts(state: GameState, perPlayer: Record<string, Partial<Hand>>): void {
  for (const [pid, gained] of Object.entries(perPlayer)) {
    const p = findPlayer(state, pid);
    if (!p?.gameStats) continue;
    const total = Object.values(gained).reduce((a, b) => a + (b ?? 0), 0);
    p.gameStats.resourcesReceivedThisRound += total;
  }
}

// Broadcast vista personalizada a cada socket de una sala
function broadcastState(io: Server, state: GameState): void {
  trackPeaks(state);
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

// Avanza al siguiente turno. En extensión 5–6 (salvo que el anfitrión la
// desactive con la regla extra noSpecialBuild) abre la fase de construcción
// especial. Regla corregida: SOLO construye el jugador OPUESTO al que acaba
// de terminar su turno (≈ media vuelta en el orden), no todos.
function advanceTurnOrSpecialBuild(state: GameState): void {
  if (state.extension56 && !state.extraRules.noSpecialBuild) {
    const n = state.turnOrder.length;
    const activeIdx = state.currentTurnIndex;
    const oppositeIdx = (activeIdx + Math.floor(n / 2)) % n;
    const oppositeId = state.turnOrder[oppositeIdx];
    if (oppositeId && oppositeId !== state.turnOrder[activeIdx]) {
      state.specialBuildQueue = [oppositeId];
      state.phase = 'specialBuild';
      const p = findPlayer(state, oppositeId);
      logAction(state, `Construcción especial: turno de ${p?.name ?? 'jugador'} (jugador opuesto).`, oppositeId);
    } else {
      nextTurn(state);
    }
  } else {
    nextTurn(state);
  }
}

function nextTurn(state: GameState): void {
  // Limpiar dev compradas este turno antes de pasar (regla: no se juegan el mismo turno)
  // Las pasamos al pool jugable para el dueño que las compró.
  for (const p of state.players) {
    if (p.devCardsBoughtThisTurn.length > 0) p.devCardsBoughtThisTurn = [];
    // El registro pendiente es por turno: al rotar, ningún poblado queda
    // bloqueando (turn:end/specialBuild:done ya lo exigieron en su momento).
    if (p.pendingSettlementRegistration.length > 0) p.pendingSettlementRegistration = [];
  }
  state.turnsPlayed += 1;
  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  state.phase = 'roll';
  state.pendingRobberMove = false;
  state.pendingRobberSteal = false;
  // Cerrar negociaciones del turno anterior que quedaran abiertas.
  state.activeTrade = undefined;
  state.activePortUse = undefined;
  // Frontera de ronda (logros): al volver el índice a 0 terminó una ronda
  // completa. Quien no recibió ningún recurso en ella desbloquea "Mala suerte".
  if (state.currentTurnIndex === 0) {
    for (const p of state.players) {
      if (!p.gameStats) continue;
      if (p.gameStats.resourcesReceivedThisRound === 0) p.gameStats.hadDryRound = true;
      p.gameStats.resourcesReceivedThisRound = 0;
    }
  }
  const next = activePlayer(state);
  if (next) {
    logAction(state, `Turno de ${next.name}.`, next.id);
    // Baseline de PV y contador de compras dev para el turno que inicia.
    if (next.gameStats) {
      next.gameStats.turnStartVP = totalVictoryPoints(next);
      next.gameStats.devBoughtThisTurn = 0;
    }
  }
}

function checkAllDiscardsDone(state: GameState): void {
  const remaining = Object.values(state.pendingDiscards).reduce((a, b) => a + b, 0);
  if (remaining === 0) {
    state.phase = 'robber';
    state.pendingRobberMove = true;
    logAction(state, 'Todos descartaron. Turno de mover el ladrón.');
  }
}

// Sala personal de un usuario autenticado: recibe invitaciones de amigos
// aunque no esté en ninguna partida.
function personalRoom(userId: string): string {
  return `user:${userId}`;
}

export function registerHandlers(io: Server, socket: Socket): void {
  // No reiniciar socket.data: el guard del handshake ya adjuntó userId si había JWT.
  const authedUserId = (socket.data as SocketData).userId;
  if (authedUserId) socket.join(personalRoom(authedUserId));

  // === Amigos ===
  // Devuelve, entre los amigos aceptados del usuario, cuáles tienen al menos
  // un socket conectado (para mostrar "en línea" al invitar).
  socket.on('friends:onlineIds', async (_payload: unknown, cb?: (res: unknown) => void) => {
    const userId = (socket.data as SocketData).userId;
    if (!userId) {
      cb?.({ onlineIds: [] });
      return;
    }
    try {
      const friendIds = await acceptedFriendIds(userId);
      const online: string[] = [];
      for (const id of friendIds) {
        const room = io.sockets.adapter.rooms.get(personalRoom(id));
        if (room && room.size > 0) online.push(id);
      }
      cb?.({ onlineIds: online });
    } catch {
      cb?.({ onlineIds: [] });
    }
  });

  // Invitar a un amigo a la sala actual: le llega un aviso en tiempo real con
  // el código (esté donde esté en la app).
  socket.on('friends:invite', async ({ friendUserId }: { friendUserId: string }, cb?: (res: unknown) => void) => {
    const userId = (socket.data as SocketData).userId;
    if (!userId) {
      cb?.({ error: 'Inicia sesión para invitar amigos.' });
      return;
    }
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'lobby') {
      cb?.({ error: 'Solo puedes invitar desde la sala de espera.' });
      return;
    }
    try {
      const friendIds = await acceptedFriendIds(userId);
      if (!friendIds.has(friendUserId)) {
        cb?.({ error: 'Ese usuario no está en tu lista de amigos.' });
        return;
      }
    } catch {
      cb?.({ error: 'No pudimos enviar la invitación. Intenta de nuevo.' });
      return;
    }
    const me = findPlayer(state, socket.data.playerId ?? '');
    const room = io.sockets.adapter.rooms.get(personalRoom(friendUserId));
    if (!room || room.size === 0) {
      cb?.({ error: 'Tu amigo no está conectado ahora mismo.' });
      return;
    }
    io.to(personalRoom(friendUserId)).emit('friends:invited', {
      code: state.code,
      fromName: me?.name ?? 'Un amigo',
    });
    cb?.({ ok: true });
  });

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

  // Modo "Caballeros y Ciudades": toggle del anfitrión en el lobby. Aditivo:
  // cambia el objetivo de victoria a 13 y habilita las mecánicas C&K (se
  // implementan por fases; ver caballeros-plan.md). El juego base no se ve
  // afectado cuando está apagado.
  socket.on('lobby:setCitiesKnights', ({ enabled }: { enabled: boolean }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'lobby') return;
    if (!ensureHost(state, socket.data.playerId)) return;
    state.citiesKnights = enabled;
    logAction(
      state,
      enabled
        ? 'Se activó la expansión Caballeros y Ciudades (victoria a 13 puntos).'
        : 'Se desactivó la expansión Caballeros y Ciudades.'
    );
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

  // Modo "iniciar sin fichas": cuando está desactivado, el registro de
  // poblados de salida es opcional y nadie recibe recursos al iniciar.
  socket.on('lobby:setSeedResources', ({ enabled }: { enabled: boolean }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'lobby') return;
    if (!ensureHost(state, socket.data.playerId)) return;
    state.seedInitialResources = !!enabled;
    logAction(
      state,
      enabled
        ? 'Se repartirán recursos de inicio según las fichas registradas.'
        : 'La partida iniciará sin fichas: nadie recibe recursos de inicio.'
    );
    broadcastState(io, state);
  });

  // Reglas extra (todos los toggles del host en el lobby). El cliente puede
  // mandar cualquier subconjunto de claves; aplicamos solo las booleanas
  // presentes. Recorrer las claves conocidas evita que un toggle nuevo quede
  // silenciosamente ignorado (bug previo: solo se aplicaban unequalTrades y
  // sharedPorts, así que los toggles del ladrón y noSpecialBuild no activaban).
  socket.on(
    'lobby:setExtraRules',
    (rules: Partial<Record<keyof GameState['extraRules'], boolean>>) => {
      const state = getRoom(socket.data.code ?? '');
      if (!state || state.status !== 'lobby') return;
      if (!ensureHost(state, socket.data.playerId)) return;
      const keys: (keyof GameState['extraRules'])[] = [
        'unequalTrades',
        'sharedPorts',
        'noSpecialBuild',
        'robberNoStealFirstRound',
        'robberEmptyGivesResource',
      ];
      for (const key of keys) {
        if (typeof rules[key] === 'boolean') state.extraRules[key] = rules[key] as boolean;
      }
      broadcastState(io, state);
    }
  );

  // El anfitrión expulsa a un jugador antes de iniciar la partida.
  socket.on('lobby:kick', ({ playerId }: { playerId: string }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'lobby') return;
    if (!ensureHost(state, socket.data.playerId)) return;
    if (playerId === state.hostId) {
      socket.emit('error', { message: 'No puedes expulsarte a ti mismo. Usa "Cancelar sala".' });
      return;
    }
    const target = findPlayer(state, playerId);
    if (!target) return;
    state.players = state.players.filter((p) => p.id !== playerId);
    state.turnOrder = state.turnOrder.filter((id) => id !== playerId);
    if (state.bankManagerId === playerId) state.bankManagerId = state.hostId;
    logAction(state, `${target.name} fue expulsado de la sala por el anfitrión.`);
    // Avisar y desconectar los sockets del jugador expulsado de la sala.
    const sockets = io.sockets.adapter.rooms.get(state.code);
    if (sockets) {
      for (const sid of sockets) {
        const s = io.sockets.sockets.get(sid);
        if (!s) continue;
        if ((s.data as SocketData).playerId === playerId) {
          s.emit('lobby:kicked');
          s.leave(state.code);
          (s.data as SocketData).code = undefined;
          (s.data as SocketData).playerId = undefined;
        }
      }
    }
    broadcastState(io, state);
  });

  // Tabla de construcción del jugador: en el lobby registra sus 2 poblados de
  // salida (edición libre). Durante la partida los poblados/ciudades SOLO
  // crecen comprando ('build'): aquí únicamente se editan las fichas de las
  // construcciones existentes o se quita una registrada por error. Solo edita
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
    if (playing) {
      const prevById = new Map(player.buildings.map((b) => [b.id, b]));
      for (const b of buildings) {
        const prev = prevById.get(b.id);
        if (!prev) {
          socket.emit('error', { message: 'Los poblados se agregan comprándolos en Construir.' });
          return;
        }
        if (prev.type !== b.type) {
          socket.emit('error', { message: 'Para subir un poblado a ciudad, compra una Ciudad en Construir.' });
          return;
        }
      }
    }
    if (playing) pushSnapshot(state);
    const before = {
      settlements: player.buildings.filter((b) => b.type === 'settlement').length,
      cities: player.buildings.filter((b) => b.type === 'city').length,
    };
    player.buildings = buildings.map((b) => ({
      id: b.id || nanoid(8),
      type: b.type,
      spots: b.spots.map((s) => ({
        number: s.number,
        resource: s.resource,
        ...(s.hexId ? { hexId: s.hexId } : {}),
      })),
      ...(b.port ? { port: b.port } : {}),
    }));
    // Un poblado pendiente de registro deja de estarlo cuando ya tiene fichas
    // (o si el dueño lo eliminó por error de la tabla).
    if (player.pendingSettlementRegistration.length > 0) {
      player.pendingSettlementRegistration = player.pendingSettlementRegistration.filter((id) => {
        const b = player.buildings.find((x) => x.id === id);
        return b !== undefined && b.spots.length === 0;
      });
    }
    // Sincronizar puertos derivados de los edificios con puerto registrado.
    const buildingPorts = player.buildings.filter((b) => b.port).map((b) => b.port as PortType);
    if (buildingPorts.length > 0) {
      player.ports = buildingPorts;
    }
    // Derivar los hexes también en el lobby: así el selector de fichas puede
    // ofrecer "agrupar con una ficha ya registrada en la mesa".
    if (!playing) {
      state.hexes = rebuildHexes(state.players, state.hexes, state.extension56 ? 2 : 1);
    }
    if (playing) {
      state.hexes = rebuildHexes(state.players, state.hexes, state.extension56 ? 2 : 1);
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
    // El registro de poblados de salida solo es obligatorio cuando se reparten
    // recursos de inicio. En el modo "sin fichas" se inicia sin registro.
    if (state.seedInitialResources) {
      const incomplete = state.players.filter((p) => !playerSetupComplete(p));
      if (incomplete.length > 0) {
        socket.emit('error', {
          message: `Falta el registro de poblados iniciales de: ${incomplete.map((p) => p.name).join(', ')}.`,
        });
        return;
      }
    }
    // Modo "sin recursos": cada jugador empieza con sus 2 poblados de salida
    // pero SIN fichas de recursos (nadie recibe cartas). Garantiza que la
    // Tabla de construcción muestre 2 poblados aunque no se haya registrado
    // nada en el lobby.
    if (!state.seedInitialResources) {
      for (const player of state.players) {
        player.buildings = [
          { id: nanoid(8), type: 'settlement', spots: [] },
          { id: nanoid(8), type: 'settlement', spots: [] },
        ];
      }
    }
    state.status = 'playing';
    state.phase = 'roll';
    state.currentTurnIndex = 0;
    state.startedAt = Date.now();
    // En Caballeros y Ciudades el ladrón arranca INMOVILIZADO: queda fuera de
    // juego hasta el primer ataque bárbaro (un 7 antes de eso solo descarta).
    if (state.citiesKnights) {
      state.robberActive = false;
      state.barbarianStep = 0;
      // Cada jugador empieza con 1 poblado + 1 ciudad: en el juego oficial la
      // 2ª colocación inicial es una ciudad. Subimos su SEGUNDO poblado
      // registrado a ciudad, gratis, al iniciar (antes de derivar los hexes,
      // para que la ciudad produzca desde el primer turno).
      for (const player of state.players) {
        const second = player.buildings[1];
        if (second && second.type === 'settlement') {
          second.type = 'city';
        }
      }
    }

    // Derivar los hexes de producción y repartir los recursos de inicio:
    // 1 carta por cada ficha que tocan los poblados registrados (todos).
    // En el modo "sin fichas" no se reparte nada.
    const setup = applyInitialSetup(state.players, state.bank, state.seedInitialResources, state.extension56 ? 2 : 1);
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
    // Reiniciar el acumulador de logros por partida y fijar el baseline de PV
    // del primer jugador (incluye la ciudad gratuita de C&K si aplica).
    for (const player of state.players) player.gameStats = emptyGameStats();
    const firstActive = activePlayer(state);
    if (firstActive?.gameStats) firstActive.gameStats.turnStartVP = totalVictoryPoints(firstActive);
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
      // Regla extra robberNoStealFirstRound: en la PRIMERA ronda NADIE descarta
      // por el 7 (el ladrón aún se mueve y roba normal en robber:move).
      const firstRound = state.turnsPlayed < state.turnOrder.length;
      const skipDiscard = state.extraRules.robberNoStealFirstRound && firstRound;
      const pending = skipDiscard ? {} : computePendingDiscards(state);
      logAction(
        state,
        skipDiscard
          ? 'Salió un 7. Primera ronda: con la regla activa nadie descarta.'
          : 'Salió un 7. Quienes tengan más de 7 cartas descartan la mitad.'
      );
      if (Object.keys(pending).length > 0) {
        state.pendingDiscards = pending;
        state.phase = 'discard';
      } else {
        state.phase = 'robber';
        state.pendingRobberMove = true;
        logAction(state, 'Turno de mover el ladrón.');
      }
    } else {
      const result = distributeForRoll(state, number);
      recordReceipts(state, result.perPlayer);
      const lines: string[] = [];
      const allIds = new Set([
        ...Object.keys(result.perPlayer),
        ...Object.keys(result.perPlayerCommodities),
      ]);
      for (const pid of allIds) {
        const p = findPlayer(state, pid);
        if (!p) continue;
        const parts = (Object.entries(result.perPlayer[pid] ?? {}) as [Resource, number][]).map(
          ([r, n]) => `${n} ${esResource(r)}`
        );
        const cparts = (
          Object.entries(result.perPlayerCommodities[pid] ?? {}) as [Commodity, number][]
        ).map(([c, n]) => `${n} ${esCommodity(c)}`);
        lines.push(`${p.name} recibe ${[...parts, ...cparts].join(', ')}`);
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

  // === Tirada de Caballeros y Ciudades (3 dados) ===
  // El encargado del banco ingresa: production (suma de los 2 dados de
  // producción, 2-12), redDie (el dado rojo solo, 1-6, para el calendario) y
  // eventDie (cara del dado de evento: 'barbarian' o una disciplina de color).
  socket.on(
    'turn:rollCK',
    ({ production, redDie, eventDie }: { production: number; redDie: number; eventDie: EventDie }) => {
      const state = getRoom(socket.data.code ?? '');
      if (!state || state.status !== 'playing') return;
      if (!state.citiesKnights) return; // este evento es exclusivo de C&K
      if (!ensureBankManager(state, socket.data.playerId)) {
        socket.emit('error', { message: 'Solo el encargado del banco puede ingresar los dados.' });
        return;
      }
      if (state.phase !== 'roll') {
        socket.emit('error', { message: 'Ya no es la fase Tirar.' });
        return;
      }
      if (production < 2 || production > 12) return;
      if (redDie < 1 || redDie > 6) return;
      const yellow = production - redDie;
      if (yellow < 1 || yellow > 6) {
        socket.emit('error', { message: 'El dado rojo no es compatible con ese total. Revisa los valores.' });
        return;
      }
      if (eventDie !== 'barbarian' && !DISCIPLINES.includes(eventDie)) return;

      pushSnapshot(state);
      state.diceStats[production] = (state.diceStats[production] ?? 0) + 1;
      state.lastRolledNumber = production;
      state.lastRedDie = redDie;
      state.lastEventDie = eventDie;

      // 1) Resolver el DADO DE EVENTO (independiente de la producción).
      if (eventDie === 'barbarian') {
        state.barbarianStep = Math.min(7, state.barbarianStep + 1);
        if (state.barbarianStep >= 7) {
          // Los bárbaros llegan a Catán: se resuelve el combate (fuerza de
          // caballeros activos vs ciudades+metrópolis), se otorga el Defensor de
          // Catán (o cartas en empate), se marcan perdedores, se desactivan los
          // caballeros y se activa el ladrón en el primer ataque.
          resolveBarbarianAttackCK(io, state);
        } else {
          logAction(state, `El barco bárbaro avanza a ${state.barbarianStep}/7.`);
        }
      } else {
        // Puerta de color → calendario de la ciudad: cada jugador roba 1 carta
        // de esa disciplina si su nivel de mejora ≥ el dado rojo.
        const drawers: string[] = [];
        for (const p of state.players) {
          if (!drawsProgressCard(p.improvements[eventDie], redDie)) continue;
          const deck = state.progressDecks[eventDie];
          if (deck.length === 0) continue;
          const card = deck.pop()!;
          p.progressCards.push(card);
          if (p.progressCards.length > PROGRESS_HAND_LIMIT) {
            state.pendingProgressDiscard[p.id] =
              p.progressCards.length - PROGRESS_HAND_LIMIT;
          }
          drawers.push(p.name);
        }
        const discName = DISCIPLINE_NAMES[eventDie];
        logAction(
          state,
          drawers.length
            ? `Puerta de ${discName} (rojo ${redDie}): roban carta de progreso ${drawers.join(', ')}.`
            : `Puerta de ${discName} (rojo ${redDie}): nadie alcanza el nivel para robar.`
        );
      }

      // 2) Resolver la PRODUCCIÓN (igual que turn:rollNumber, con el ladrón
      //    condicionado a que ya haya habido un ataque bárbaro).
      if (production === 7) {
        const firstRound = state.turnsPlayed < state.turnOrder.length;
        const skipDiscard = state.extraRules.robberNoStealFirstRound && firstRound;
        const pending = skipDiscard ? {} : computePendingDiscards(state);
        logAction(
          state,
          skipDiscard
            ? 'Salió un 7. Primera ronda: con la regla activa nadie descarta.'
            : 'Salió un 7. Quienes tengan más de 7 cartas descartan la mitad.'
        );
        if (Object.keys(pending).length > 0) {
          state.pendingDiscards = pending;
          state.phase = 'discard';
        } else if (state.robberActive) {
          state.phase = 'robber';
          state.pendingRobberMove = true;
          logAction(state, 'Nadie descarta. Turno de mover el ladrón.');
        } else {
          state.phase = 'main';
          logAction(state, 'El ladrón sigue inmovilizado (aún no hay ataque bárbaro).');
        }
      } else {
        const result = distributeForRoll(state, production);
        recordReceipts(state, result.perPlayer);
        const lines: string[] = [];
        const allIds = new Set([
          ...Object.keys(result.perPlayer),
          ...Object.keys(result.perPlayerCommodities),
        ]);
        for (const pid of allIds) {
          const p = findPlayer(state, pid);
          if (!p) continue;
          const parts = (Object.entries(result.perPlayer[pid] ?? {}) as [Resource, number][]).map(
            ([r, n]) => `${n} ${esResource(r)}`
          );
          const cparts = (
            Object.entries(result.perPlayerCommodities[pid] ?? {}) as [Commodity, number][]
          ).map(([c, n]) => `${n} ${esCommodity(c)}`);
          lines.push(`${p.name} recibe ${[...parts, ...cparts].join(', ')}`);
        }
        logAction(state, `Salió ${production}. ${lines.join('; ') || 'Nadie recibió recursos.'}`);
        state.phase = 'main';
      }
      broadcastState(io, state);
    }
  );

  // Descarte de cartas de progreso por exceder el límite de 4 (al robar la 5ª).
  socket.on('progress:discard', ({ card }: { card: ProgressCardType }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    const owed = state.pendingProgressDiscard[player.id] ?? 0;
    if (owed <= 0) return;
    const idx = player.progressCards.indexOf(card);
    if (idx === -1) {
      socket.emit('error', { message: 'No tienes esa carta de progreso.' });
      return;
    }
    pushSnapshot(state);
    player.progressCards.splice(idx, 1);
    const remaining = owed - 1;
    if (remaining > 0) state.pendingProgressDiscard[player.id] = remaining;
    else delete state.pendingProgressDiscard[player.id];
    logAction(state, `${player.name} descartó una carta de progreso (excedía el límite de 4).`, player.id);
    broadcastState(io, state);
  });

  // === Jugar una carta de progreso (Caballeros y Ciudades) ===
  // Decisión del proyecto (caballeros-plan.md §13.2): "registro asistido". Las
  // cartas autocontenidas se automatizan por completo; las que dependen de
  // caballeros/muros/caminos o de geometría de tablero se registran (se quitan
  // de la mano + log/notice) para que la mesa las resuelva físicamente. Esas
  // recibirán automatización plena en las fases D/E.
  socket.on(
    'progress:play',
    ({ card, resource, commodity }: { card: ProgressCardType; resource?: Resource; commodity?: Commodity }) => {
      const state = getRoom(socket.data.code ?? '');
      if (!state || !state.citiesKnights) return;
      const player = findPlayer(state, socket.data.playerId ?? '');
      if (!player) return;
      if (!ensureActive(state, player.id) || state.phase !== 'main') {
        socket.emit('error', { message: 'Solo puedes jugar cartas de progreso en tu turno, después de tirar.' });
        return;
      }
      const idx = player.progressCards.indexOf(card);
      if (idx === -1) {
        socket.emit('error', { message: 'No tienes esa carta de progreso.' });
        return;
      }
      pushSnapshot(state);
      const name = esProgressCard(card);
      let handled = true;

      if (card === 'printer' || card === 'constitution') {
        // +1 PV permanente (como las cartas de PV del base).
        player.victoryPoints.vpCards += 1;
        logAction(state, `${player.name} jugó ${name}: +1 punto de victoria.`, player.id);
        io.to(state.code).emit('notice', { level: 'info', text: `${player.name} jugó ${name} (+1 PV).` });
      } else if (card === 'resourceMonopoly') {
        // Nombra un recurso; cada jugador te da hasta 2 de ese recurso.
        if (!resource || !RESOURCES.includes(resource)) {
          popSnapshot(state);
          socket.emit('error', { message: 'Elige un recurso válido.' });
          return;
        }
        let total = 0;
        for (const other of state.players) {
          if (other.id === player.id) continue;
          const take = Math.min(2, other.hand[resource]);
          other.hand[resource] -= take;
          total += take;
        }
        player.hand[resource] += total;
        logAction(state, `${player.name} jugó Monopolio de Recurso (${esResource(resource)}) y tomó ${total}.`, player.id);
        io.to(state.code).emit('notice', { level: 'warn', text: `${player.name} jugó Monopolio de ${esResource(resource)} (tomó ${total}).` });
      } else if (card === 'tradeMonopoly') {
        // Nombra una mercancía; cada jugador te da 1 si tiene.
        if (!commodity || !COMMODITIES.includes(commodity)) {
          popSnapshot(state);
          socket.emit('error', { message: 'Elige una mercancía válida.' });
          return;
        }
        let total = 0;
        for (const other of state.players) {
          if (other.id === player.id) continue;
          const take = Math.min(1, other.commodities[commodity]);
          other.commodities[commodity] -= take;
          total += take;
        }
        player.commodities[commodity] += total;
        logAction(state, `${player.name} jugó Monopolio de Comercio (${esCommodity(commodity)}) y tomó ${total}.`, player.id);
        io.to(state.code).emit('notice', { level: 'warn', text: `${player.name} jugó Monopolio de Comercio de ${esCommodity(commodity)} (tomó ${total}).` });
      } else if (card === 'engineer') {
        // Construye 1 muro de ciudad gratis (respeta el máximo).
        if (player.walls >= MAX_WALLS) {
          popSnapshot(state);
          socket.emit('error', { message: `Ya tienes el máximo de ${MAX_WALLS} muros.` });
          return;
        }
        player.walls += 1;
        logAction(state, `${player.name} jugó Ingeniero: construyó un muro gratis (${player.walls}/${MAX_WALLS}).`, player.id);
        io.to(state.code).emit('notice', { level: 'info', text: `${player.name} jugó Ingeniero (muro gratis).` });
      } else if (card === 'irrigation' || card === 'mining') {
        // 2 recursos por cada ficha (spot) del recurso que toquen tus
        // construcciones. irrigation→trigo, mining→mineral.
        const res: Resource = card === 'irrigation' ? 'grain' : 'ore';
        let spots = 0;
        for (const b of player.buildings) {
          for (const s of b.spots) if (s.resource === res) spots += 1;
        }
        const gained = spots * 2;
        player.hand[res] += gained;
        drainBank(state.bank, res, gained);
        logAction(state, `${player.name} jugó ${name}: ganó ${gained} ${esResource(res)} (${spots} fichas de ${esResource(res)}).`, player.id);
        io.to(state.code).emit('notice', { level: 'info', text: `${player.name} jugó ${name} (+${gained} ${esResource(res)}).` });
      } else {
        // Registro asistido: la carta se retira y la mesa la resuelve.
        handled = false;
        logAction(state, `${player.name} jugó ${name}. Resuélvanla en la mesa.`, player.id);
        io.to(state.code).emit('notice', { level: 'info', text: `${player.name} jugó ${name}. Resuélvanla en la mesa.` });
      }

      // Quitar la carta de la mano (por índice; ya validado arriba).
      const removeAt = player.progressCards.indexOf(card);
      if (removeAt !== -1) player.progressCards.splice(removeAt, 1);
      void handled; // (handled se conserva por claridad; ambas ramas quitan la carta)
      broadcastState(io, state);
      checkVictory(io, state, player);
    }
  );

  // === Descarte ===
  // En Caballeros y Ciudades el descarte puede incluir mercancías (cuentan para
  // el total). `commoditiesToDiscard` es opcional (vacío en el modo base).
  socket.on(
    'discard:submit',
    ({
      resourcesToDiscard,
      commoditiesToDiscard,
    }: {
      resourcesToDiscard: Partial<Hand>;
      commoditiesToDiscard?: Partial<CommodityHand>;
    }) => {
      const state = getRoom(socket.data.code ?? '');
      if (!state) return;
      const player = findPlayer(state, socket.data.playerId ?? '');
      if (!player) return;
      if (state.phase !== 'discard') return;
      const required = state.pendingDiscards[player.id] ?? 0;
      if (required === 0) return;
      const resTotal = Object.values(resourcesToDiscard).reduce((a, b) => a + (b ?? 0), 0);
      const commTotal = Object.values(commoditiesToDiscard ?? {}).reduce((a, b) => a + (b ?? 0), 0);
      if (resTotal + commTotal !== required) {
        socket.emit('error', { message: `Debes descartar exactamente ${required} cartas.` });
        return;
      }
      for (const [res, n] of Object.entries(resourcesToDiscard) as [Resource, number][]) {
        if (player.hand[res] < n) {
          socket.emit('error', { message: 'No tienes esas cartas en la mano.' });
          return;
        }
      }
      for (const [c, n] of Object.entries(commoditiesToDiscard ?? {}) as [Commodity, number][]) {
        if (player.commodities[c] < n) {
          socket.emit('error', { message: 'No tienes esas mercancías en la mano.' });
          return;
        }
      }
      pushSnapshot(state);
      for (const [res, n] of Object.entries(resourcesToDiscard) as [Resource, number][]) {
        player.hand[res] -= n;
        state.bank[res] += n;
      }
      for (const [c, n] of Object.entries(commoditiesToDiscard ?? {}) as [Commodity, number][]) {
        player.commodities[c] -= n;
        state.commodityBank[c] = Math.min(12, state.commodityBank[c] + n);
      }
      delete state.pendingDiscards[player.id];
      logAction(state, `${player.name} descartó ${required} cartas.`, player.id);
      checkAllDiscardsDone(state);
      broadcastState(io, state);
    }
  );

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
    io.to(state.code).emit('notice', { level: 'warn', text: `${active.name} movió el ladrón a ${targetHex.resource ? `${targetHex.number} ${esResource(targetHex.resource)}` : 'el desierto'}.` });

    const candidates = targetHex.owners.filter((o) => o.playerId !== active.id);
    // Ficha "vacía": el desierto o cualquier hex sin jugadores a quien robar.
    const emptyOrDesert = !targetHex.resource || candidates.length === 0;

    // Regla extra: ladrón a ficha vacía/desierto → el banco da 1 recurso al azar.
    if (state.extraRules.robberEmptyGivesResource && emptyOrDesert) {
      const r = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
      drainBank(state.bank, r, 1);
      active.hand[r] += 1;
      logAction(state, `El banco le dio 1 ${esResource(r)} a ${active.name} por mover el ladrón a una ficha vacía.`, active.id);
      io.to(state.code).emit('notice', { level: 'info', text: `${active.name} recibió 1 recurso del banco (ladrón en ficha vacía).` });
    }

    // Nota: la regla robberNoStealFirstRound NO impide robar: en la primera
    // ronda solo se omite el DESCARTE del 7 (ver turn:rollNumber/turn:rollCK).
    // El robo procede normal aquí, robándole 1 carta al dueño elegido.
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
  // Comprar es la ÚNICA forma de crecer la Tabla de construcción durante la
  // partida: un Poblado crea su slot (sin fichas; el dueño las registra
  // después) y una Ciudad convierte el poblado que el comprador eligió
  // (settlementId).
  socket.on(
    'build',
    ({ type, settlementId }: { type: 'road' | 'settlement' | 'city' | 'devcard'; settlementId?: string }) => {
      const state = getRoom(socket.data.code ?? '');
      if (!state) return;
      const player = findPlayer(state, socket.data.playerId ?? '');
      if (!player) return;
      // Caballeros y Ciudades: NO existen las cartas de desarrollo. Se
      // reemplazan por las cartas de progreso, que solo llegan por el calendario
      // de la ciudad (turn:rollCK). No se pueden comprar.
      if (type === 'devcard' && state.citiesKnights) {
        socket.emit('error', {
          message: 'En Caballeros y Ciudades no se compran cartas: se reparten por el calendario de la ciudad.',
        });
        return;
      }
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
      // Ciudad: validar el poblado a convertir ANTES de cobrar.
      const targetSettlement =
        type === 'city'
          ? player.buildings.find((b) => b.id === settlementId && b.type === 'settlement')
          : undefined;
      if (type === 'city' && !targetSettlement) {
        socket.emit('error', { message: 'Elige qué poblado se convierte en ciudad.' });
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
        // Logro "Desarrollado": compras dev en un solo turno (solo fase main).
        if (player.gameStats && state.phase === 'main') {
          player.gameStats.devBoughtThisTurn += 1;
          if (player.gameStats.devBoughtThisTurn > player.gameStats.maxDevBoughtInTurn) {
            player.gameStats.maxDevBoughtInTurn = player.gameStats.devBoughtThisTurn;
          }
        }
        // Las cartas de Punto de victoria NO suman al marcador al comprarse:
        // cuentan cuando el dueño las usa (dev:play). Por eso tampoco entran a
        // devCardsBoughtThisTurn (pueden usarse el mismo turno).
        if (card !== 'vp') player.devCardsBoughtThisTurn.push(card);
        logAction(state, `${player.name} compró una carta de desarrollo.`, player.id);
        io.to(state.code).emit('build:notify', { text: `${player.name} compró una carta de desarrollo.` });
      } else if (type === 'settlement') {
        const newSettlement = { id: nanoid(8), type: 'settlement' as const, spots: [] };
        player.buildings.push(newSettlement);
        // Queda pendiente registrar las fichas que toca: no podrá terminar el
        // turno hasta hacerlo (ver turn:end / specialBuild:done).
        player.pendingSettlementRegistration.push(newSettlement.id);
        state.hexes = rebuildHexes(state.players, state.hexes, state.extension56 ? 2 : 1);
        recomputeVictoryPoints(state);
        logAction(state, `${player.name} construyó un Poblado. Le falta registrar sus fichas.`, player.id);
        io.to(state.code).emit('build:notify', { text: `${player.name} construyó un Poblado.` });
      } else if (type === 'city') {
        targetSettlement!.type = 'city';
        state.hexes = rebuildHexes(state.players, state.hexes, state.extension56 ? 2 : 1);
        recomputeVictoryPoints(state);
        logAction(state, `${player.name} construyó una Ciudad (subió un poblado).`, player.id);
        io.to(state.code).emit('build:notify', { text: `${player.name} construyó una Ciudad.` });
      } else {
        if (player.gameStats) player.gameStats.roadsBuilt += 1; // logro "El caminante"
        logAction(state, `${player.name} construyó un Camino.`, player.id);
        io.to(state.code).emit('build:notify', { text: `${player.name} construyó un Camino.` });
      }
      broadcastState(io, state);
      checkVictory(io, state, player);
    }
  );

  // Confirmar que un poblado recién construido NO toca recursos (solo desierto
  // o mar): libera el bloqueo de fin de turno sin registrar fichas. Evita el
  // callejón sin salida del poblado de pura costa/desierto.
  socket.on('building:ackNoResources', ({ buildingId }: { buildingId: string }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    const idx = player.pendingSettlementRegistration.indexOf(buildingId);
    if (idx === -1) return;
    const building = player.buildings.find((b) => b.id === buildingId);
    if (!building || building.spots.length > 0) {
      socket.emit('error', { message: 'Ese poblado sí tiene fichas registradas.' });
      return;
    }
    pushSnapshot(state);
    player.pendingSettlementRegistration.splice(idx, 1);
    logAction(state, `${player.name} confirmó que su poblado nuevo no toca recursos.`, player.id);
    broadcastState(io, state);
  });

  // === Cartas de desarrollo ===
  socket.on('dev:play', ({ card, payload }: { card: 'knight' | 'monopoly' | 'yearOfPlenty' | 'roadBuilding' | 'vp'; payload?: any }) => {
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
    // Knight y Punto de victoria permitidos antes de tirar (en 'roll');
    // las demás solo en 'main'.
    if (card !== 'knight' && card !== 'vp' && state.phase !== 'main') {
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
      io.to(state.code).emit('notice', { level: 'info', text: `${player.name} jugó un Caballero.` });
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
      io.to(state.code).emit('notice', { level: 'warn', text: `${player.name} declaró Monopolio de ${esResource(res)} (${total} cartas).` });
    } else if (card === 'yearOfPlenty') {
      const picks = (payload?.resources as Resource[]) ?? [];
      if (picks.length !== 2 || picks.some((r) => !RESOURCES.includes(r))) {
        socket.emit('error', { message: 'Elige 2 recursos.' });
        return;
      }
      // Banco ilimitado: siempre hay de dónde tomar.
      for (const r of picks) {
        drainBank(state.bank, r, 1);
        player.hand[r] += 1;
      }
      logAction(state, `${player.name} jugó Año de la abundancia: tomó ${picks.map(esResource).join(' y ')}.`, player.id);
      io.to(state.code).emit('notice', { level: 'info', text: `${player.name} jugó Año de la abundancia: ${picks.map(esResource).join(' y ')}.` });
    } else if (card === 'roadBuilding') {
      logAction(state, `${player.name} jugó Construcción de caminos.`, player.id);
      io.to(state.code).emit('notice', { level: 'info', text: `${player.name} jugó Construcción de caminos.` });
    } else if (card === 'vp') {
      // Usar la carta la hace pública: +1 al marcador de todos a la vista.
      player.victoryPoints.vpCards += 1;
      logAction(state, `${player.name} usó una carta de Punto de victoria: +1 punto.`, player.id);
      io.to(state.code).emit('notice', { level: 'info', text: `${player.name} usó una carta de Punto de victoria.` });
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

  // === Mejora de ciudad (Caballeros y Ciudades) ===
  socket.on('city:upgrade', ({ discipline }: { discipline: Discipline }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    if (!state.citiesKnights) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    const canActNow =
      (ensureActive(state, player.id) && state.phase === 'main') ||
      (state.phase === 'specialBuild' && state.specialBuildQueue[0] === player.id);
    if (!canActNow) {
      socket.emit('error', { message: 'Solo puedes mejorar ciudades en tu turno, después de tirar.' });
      return;
    }
    if (!DISCIPLINES.includes(discipline)) return;
    pushSnapshot(state);
    const r = upgradeCityImprovement(state, player, discipline);
    if (!r.ok) {
      popSnapshot(state);
      socket.emit('error', { message: r.reason ?? 'No pudimos mejorar la ciudad.' });
      return;
    }
    const discName = DISCIPLINE_NAMES[discipline];
    logAction(state, `${player.name} mejoró ${discName} al nivel ${r.level}.`, player.id);
    if (r.abilityUnlocked) {
      const abilityName = ABILITY_NAMES[r.abilityUnlocked];
      io.to(state.code).emit('notice', {
        level: 'info',
        text: `${player.name} desbloqueó ${abilityName} (${discName} nivel 3).`,
      });
    }
    if (r.gainedMetropolis) {
      const stoleFrom = r.stoleMetropolisFrom ? findPlayer(state, r.stoleMetropolisFrom) : null;
      io.to(state.code).emit('notice', {
        level: 'success',
        text: stoleFrom
          ? `${player.name} arrebató la Metrópolis de ${discName} a ${stoleFrom.name}.`
          : `${player.name} construyó la Metrópolis de ${discName} (4 puntos).`,
      });
    } else if (r.metropolisBlocked) {
      // Subió a nivel 4+, pero el dueño ya la blindó en nivel 5: no se la lleva.
      // Aviso personal (toast informativo) solo para quien mejoró.
      socket.emit('build:notify', {
        text: `La Metrópolis de ${discName} está blindada (su dueño llegó a nivel 5): no puedes arrebatarla.`,
      });
    }
    checkVictory(io, state, player);
  });

  // === Muro de ciudad (Caballeros y Ciudades) ===
  socket.on('city:buildWall', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || !state.citiesKnights) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    const canActNow =
      (ensureActive(state, player.id) && state.phase === 'main') ||
      (state.phase === 'specialBuild' && state.specialBuildQueue[0] === player.id);
    if (!canActNow) {
      socket.emit('error', { message: 'Solo puedes construir muros en tu turno, después de tirar.' });
      return;
    }
    if (player.walls >= MAX_WALLS) {
      socket.emit('error', { message: `Máximo ${MAX_WALLS} muros.` });
      return;
    }
    if (!canAfford(player.hand, WALL_COST)) {
      socket.emit('error', { message: 'Necesitas 2 ladrillos para un muro.' });
      return;
    }
    pushSnapshot(state);
    payToBank(player.hand, state.bank, WALL_COST);
    player.walls += 1;
    logAction(state, `${player.name} construyó un muro de ciudad (${player.walls}/${MAX_WALLS}).`, player.id);
    broadcastState(io, state);
  });

  // === Caballeros (Caballeros y Ciudades) ===
  // Helper: ¿el jugador puede actuar ahora (su turno en main, o cabeza de cola
  // en construcción especial)?
  function canActCK(state: GameState, player: Player): boolean {
    return (
      (ensureActive(state, player.id) && state.phase === 'main') ||
      (state.phase === 'specialBuild' && state.specialBuildQueue[0] === player.id)
    );
  }

  socket.on('knight:build', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || !state.citiesKnights) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    if (!canActCK(state, player)) {
      socket.emit('error', { message: 'Solo puedes contratar caballeros en tu turno, después de tirar.' });
      return;
    }
    // Hasta 2 caballeros de cada rango: contratar crea uno básico (rango 1).
    if (player.knights.filter((k) => k.rank === 1).length >= MAX_KNIGHTS_PER_RANK) {
      socket.emit('error', { message: `Máximo ${MAX_KNIGHTS_PER_RANK} caballeros básicos a la vez.` });
      return;
    }
    if (!canAfford(player.hand, KNIGHT_BUILD_COST)) {
      socket.emit('error', { message: 'Necesitas 1 lana y 1 mineral para un caballero.' });
      return;
    }
    pushSnapshot(state);
    payToBank(player.hand, state.bank, KNIGHT_BUILD_COST);
    player.knights.push({ id: nanoid(8), rank: 1, active: false });
    logAction(state, `${player.name} contrató un caballero básico (inactivo).`, player.id);
    broadcastState(io, state);
  });

  socket.on('knight:activate', ({ knightId }: { knightId: string }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || !state.citiesKnights) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    if (!canActCK(state, player)) {
      socket.emit('error', { message: 'Solo puedes activar caballeros en tu turno, después de tirar.' });
      return;
    }
    const knight = player.knights.find((k) => k.id === knightId);
    if (!knight) return;
    if (knight.active) {
      socket.emit('error', { message: 'Ese caballero ya está activo.' });
      return;
    }
    if (!canAfford(player.hand, KNIGHT_ACTIVATE_COST)) {
      socket.emit('error', { message: 'Necesitas 1 trigo para activar un caballero.' });
      return;
    }
    pushSnapshot(state);
    payToBank(player.hand, state.bank, KNIGHT_ACTIVATE_COST);
    knight.active = true;
    logAction(state, `${player.name} activó un caballero (fuerza ${knight.rank}).`, player.id);
    broadcastState(io, state);
  });

  socket.on('knight:promote', ({ knightId }: { knightId: string }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || !state.citiesKnights) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    if (!canActCK(state, player)) {
      socket.emit('error', { message: 'Solo puedes promover caballeros en tu turno, después de tirar.' });
      return;
    }
    const knight = player.knights.find((k) => k.id === knightId);
    if (!knight) return;
    if (knight.rank >= 3) {
      socket.emit('error', { message: 'Ese caballero ya es poderoso (nivel máximo).' });
      return;
    }
    // Promover a nivel 3 (poderoso) requiere Fortaleza (Política nivel 3).
    if (knight.rank === 2 && player.improvements.politics < 3) {
      socket.emit('error', { message: 'Necesitas la Fortaleza (Política nivel 3) para promover a caballero poderoso.' });
      return;
    }
    // Hasta 2 caballeros de cada rango: no se puede promover si ya hay 2 en el
    // rango destino.
    const targetRank = knight.rank + 1;
    if (player.knights.filter((k) => k.rank === targetRank).length >= MAX_KNIGHTS_PER_RANK) {
      const rankName = targetRank === 2 ? 'fuertes' : 'poderosos';
      socket.emit('error', { message: `Máximo ${MAX_KNIGHTS_PER_RANK} caballeros ${rankName} a la vez.` });
      return;
    }
    if (!canAfford(player.hand, KNIGHT_PROMOTE_COST)) {
      socket.emit('error', { message: 'Necesitas 1 lana y 1 mineral para promover un caballero.' });
      return;
    }
    pushSnapshot(state);
    payToBank(player.hand, state.bank, KNIGHT_PROMOTE_COST);
    knight.rank = (knight.rank + 1) as 1 | 2 | 3;
    logAction(state, `${player.name} promovió un caballero a fuerza ${knight.rank}.`, player.id);
    broadcastState(io, state);
  });

  // Acción de un caballero ACTIVO (mover/expulsar/ahuyentar). Sin geometría de
  // tablero: se arbitra en la mesa (decisión §13). Usar el caballero lo
  // desactiva. 'chaseRobber' solo tras el primer ataque bárbaro.
  socket.on('knight:action', ({ knightId, kind }: { knightId: string; kind: 'move' | 'displace' | 'chaseRobber' }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || !state.citiesKnights) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    if (!canActCK(state, player)) {
      socket.emit('error', { message: 'Solo puedes usar caballeros en tu turno.' });
      return;
    }
    const knight = player.knights.find((k) => k.id === knightId);
    if (!knight) return;
    if (!knight.active) {
      socket.emit('error', { message: 'El caballero debe estar activo para actuar.' });
      return;
    }
    if (kind === 'chaseRobber' && !state.robberActive) {
      socket.emit('error', { message: 'El ladrón aún no está en juego (falta el primer ataque bárbaro).' });
      return;
    }
    pushSnapshot(state);
    knight.active = false; // usar el caballero lo desactiva
    const verb = kind === 'move' ? 'movió' : kind === 'displace' ? 'expulsó con' : 'ahuyentó al ladrón con';
    logAction(state, `${player.name} ${verb} un caballero. Resuélvanlo en la mesa.`, player.id);
    io.to(state.code).emit('notice', { level: 'info', text: `${player.name} usó un caballero (${kind === 'chaseRobber' ? 'ahuyentar ladrón' : kind === 'displace' ? 'expulsar' : 'mover'}). Resuélvanlo en la mesa.` });
    broadcastState(io, state);
  });

  // Tras un saqueo bárbaro: el perdedor elige qué ciudad degradar a poblado.
  socket.on('barbarian:downgradeCity', ({ buildingId }: { buildingId: string }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || !state.citiesKnights) return;
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (!player) return;
    if (!state.pendingBarbarianLoss.includes(player.id)) return;
    // No se puede degradar una metrópolis: debe quedar al menos una ciudad
    // no-metrópolis para poder elegir.
    if (player.victoryPoints.cities - player.metropolises.length <= 0) {
      socket.emit('error', { message: 'No tienes una ciudad (no metrópolis) que degradar.' });
      return;
    }
    const building = player.buildings.find((b) => b.id === buildingId && b.type === 'city');
    if (!building) {
      socket.emit('error', { message: 'Elige una de tus ciudades.' });
      return;
    }
    pushSnapshot(state);
    building.type = 'settlement';
    state.hexes = rebuildHexes(state.players, state.hexes, state.extension56 ? 2 : 1);
    recomputeVictoryPoints(state);
    state.pendingBarbarianLoss = state.pendingBarbarianLoss.filter((id) => id !== player.id);
    logAction(state, `${player.name} degradó una ciudad a poblado por el saqueo bárbaro.`, player.id);
    io.to(state.code).emit('notice', { level: 'warn', text: `${player.name} perdió una ciudad ante los bárbaros.` });
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
      const giveTotal = Object.values(give).reduce((a, b) => a + (b ?? 0), 0);
      const recvTotal = Object.values(receive).reduce((a, b) => a + (b ?? 0), 0);
      if (giveTotal === 0 && recvTotal === 0) {
        socket.emit('error', { message: 'Tu oferta no tiene cartas.' });
        return;
      }
      if ((giveTotal === 0 || recvTotal === 0) && !state.extraRules.unequalTrades) {
        socket.emit('error', { message: 'Tu oferta necesita cartas en ambos lados.' });
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
    // Si el OFERTANTE ya no tiene las cartas que ofrece, la oferta está muerta
    // para todos: se retira.
    const offererCanPay = (Object.entries(offer.give) as [Resource, number][]).every(
      ([res, n]) => from.hand[res] >= n
    );
    if (!offererCanPay) {
      socket.emit('error', { message: `${from.name} ya no tiene las cartas que ofrecía.` });
      state.activeTrade = undefined;
      logAction(state, 'La oferta se retiró: el ofertante ya no tiene esas cartas.');
      broadcastState(io, state);
      return;
    }
    // Si quien acepta NO tiene las cartas necesarias (lado `receive`), es un
    // fallo INDIVIDUAL: la oferta sigue activa para los demás y a esta persona
    // se le marca como rechazada (no debe poder bloquear a nadie).
    const responderCanPay = (Object.entries(offer.receive) as [Resource, number][]).every(
      ([res, n]) => responder.hand[res] >= n
    );
    if (!responderCanPay) {
      socket.emit('error', { message: 'No tienes las cartas necesarias para aceptar este intercambio.' });
      offer.rejectedBy.push(responder.id);
      const eligible = offer.toId
        ? [offer.toId]
        : state.players.filter((p) => p.id !== offer.fromId).map((p) => p.id);
      if (eligible.every((id) => offer.rejectedBy.includes(id))) {
        state.activeTrade = undefined;
        logAction(state, 'Nadie pudo aceptar el intercambio: la oferta se retiró.');
      }
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

  // === Uso de puerto ajeno (regla extra sharedPorts) ===
  // El jugador en turno propone usar el puerto de otro; el dueño aprueba (con
  // comisión opcional) o rechaza.
  socket.on(
    'port:request',
    ({ ownerId, give, receive }: { ownerId: string; give: Resource; receive: Resource }) => {
      const state = getRoom(socket.data.code ?? '');
      if (!state) return;
      if (!state.extraRules.sharedPorts) {
        socket.emit('error', { message: 'El uso de puertos ajenos no está activado en esta partida.' });
        return;
      }
      const player = findPlayer(state, socket.data.playerId ?? '');
      if (!player) return;
      if (!ensureActive(state, player.id) || state.phase !== 'main') {
        socket.emit('error', { message: 'Solo puedes usar un puerto ajeno en tu turno, después de tirar.' });
        return;
      }
      if (state.activePortUse || state.activeTrade) {
        socket.emit('error', { message: 'Ya hay una negociación en curso. Termínala primero.' });
        return;
      }
      const owner = findPlayer(state, ownerId);
      if (!owner || owner.id === player.id) {
        socket.emit('error', { message: 'Elige a otro jugador con puerto.' });
        return;
      }
      if (owner.ports.length === 0) {
        socket.emit('error', { message: `${owner.name} no tiene ningún puerto.` });
        return;
      }
      if (!RESOURCES.includes(give) || !RESOURCES.includes(receive) || give === receive) {
        socket.emit('error', { message: 'Elige dos recursos distintos.' });
        return;
      }
      const ratio = bestBankRatio(owner, give);
      if (player.hand[give] < ratio) {
        socket.emit('error', { message: `Necesitas ${ratio} ${esResource(give)} para usar ese puerto.` });
        return;
      }
      state.activePortUse = {
        id: nanoid(8),
        requesterId: player.id,
        ownerId: owner.id,
        give,
        receive,
        ratio,
        status: 'awaitingOwner',
      };
      logAction(state, `${player.name} pidió usar el puerto de ${owner.name}.`, player.id);
      broadcastState(io, state);
    }
  );

  // Paso 2: el dueño aprueba o rechaza, fijando una comisión opcional. Si la
  // comisión es 0 (gratis) se ejecuta de inmediato; si hay comisión, pasa a
  // 'awaitingRequester' para que el SOLICITANTE confirme el cobro (paso 3).
  socket.on(
    'port:respond',
    ({ accept, commission }: { accept: boolean; commission?: Partial<Hand> }) => {
      const state = getRoom(socket.data.code ?? '');
      if (!state || !state.activePortUse) return;
      const req = state.activePortUse;
      if (socket.data.playerId !== req.ownerId) return;
      if (req.status !== 'awaitingOwner') return;
      const owner = findPlayer(state, req.ownerId);
      const requester = findPlayer(state, req.requesterId);
      if (!owner || !requester) {
        state.activePortUse = undefined;
        broadcastState(io, state);
        return;
      }
      if (!accept) {
        state.activePortUse = undefined;
        logAction(state, `${owner.name} no prestó su puerto.`, owner.id);
        broadcastState(io, state);
        return;
      }
      // Comisión: cartas que el solicitante pagará al dueño (puede ir vacía).
      const fee: Partial<Hand> = {};
      let feeTotal = 0;
      for (const [res, n] of Object.entries(commission ?? {}) as [Resource, number][]) {
        if (!RESOURCES.includes(res) || !Number.isFinite(n) || n <= 0) continue;
        fee[res] = Math.floor(n);
        feeTotal += Math.floor(n);
      }
      if (feeTotal === 0) {
        // Gratis: nada que confirmar, se ejecuta directo.
        const r = executePortUse(io, state, fee);
        if (!r.ok) socket.emit('error', { message: r.reason ?? 'No se pudo usar el puerto.' });
        broadcastState(io, state);
        return;
      }
      // Con comisión: esperar la confirmación del solicitante.
      req.status = 'awaitingRequester';
      req.commission = fee;
      logAction(
        state,
        `${owner.name} aceptó prestar su puerto con una comisión de ${(Object.entries(fee) as [Resource, number][]).map(([r, n]) => `${n} ${esResource(r)}`).join(', ')}. Falta que ${requester.name} confirme.`,
        owner.id
      );
      io.to(state.code).emit('notice', {
        level: 'info',
        text: `${owner.name} pide comisión por su puerto. ${requester.name} debe confirmar.`,
      });
      broadcastState(io, state);
    }
  );

  // Paso 3: el solicitante confirma (paga la comisión y ejecuta) o rechaza el
  // cobro.
  socket.on('port:confirm', ({ accept }: { accept: boolean }) => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || !state.activePortUse) return;
    const req = state.activePortUse;
    if (socket.data.playerId !== req.requesterId) return;
    if (req.status !== 'awaitingRequester') return;
    if (!accept) {
      const requester = findPlayer(state, req.requesterId);
      state.activePortUse = undefined;
      logAction(state, `${requester?.name ?? 'El solicitante'} no aceptó la comisión: el intercambio se canceló.`, req.requesterId);
      broadcastState(io, state);
      return;
    }
    const r = executePortUse(io, state, req.commission ?? {});
    if (!r.ok) socket.emit('error', { message: r.reason ?? 'No se pudo usar el puerto.' });
    broadcastState(io, state);
  });

  socket.on('port:cancel', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || !state.activePortUse) return;
    if (state.activePortUse.requesterId !== socket.data.playerId) return;
    const requester = findPlayer(state, state.activePortUse.requesterId);
    state.activePortUse = undefined;
    logAction(state, `${requester?.name ?? 'El solicitante'} canceló la solicitud de puerto.`, requester?.id);
    broadcastState(io, state);
  });

  // === Fin de turno ===
  socket.on('turn:end', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state) return;
    if (state.phase === 'main' && ensureActive(state, socket.data.playerId)) {
      const player = findPlayer(state, socket.data.playerId ?? '');
      if (player && player.pendingSettlementRegistration.length > 0) {
        socket.emit('error', {
          message: 'Registra las fichas del poblado que construiste antes de terminar el turno.',
        });
        return;
      }
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
    const player = findPlayer(state, socket.data.playerId ?? '');
    if (player && player.pendingSettlementRegistration.length > 0) {
      socket.emit('error', {
        message: 'Registra las fichas del poblado que construiste antes de terminar.',
      });
      return;
    }
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
    const target = victoryTargetFor(state);
    if (totalVictoryPoints(player) < target) {
      socket.emit('error', { message: `Necesitas ${target} puntos para declarar victoria.` });
      return;
    }
    state.status = 'ended';
    state.winnerId = player.id;
    logAction(state, `${player.name} declaró victoria con ${totalVictoryPoints(player)} puntos.`, player.id);
    broadcastState(io, state);
    // Persistir resultado y stats en MongoDB (no bloquea la partida si falla)
    void persistMatchResult(state);
  });

  // El anfitrión puede finalizar la partida SIN ganador (acuerdo de mesa:
  // se hizo tarde, se deshizo el tablero, etc.). No se persiste el Match ni
  // las stats — persistMatchResult ignora partidas sin winnerId.
  socket.on('game:end', () => {
    const state = getRoom(socket.data.code ?? '');
    if (!state || state.status !== 'playing') return;
    if (!ensureHost(state, socket.data.playerId)) {
      socket.emit('error', { message: 'Solo el anfitrión puede finalizar la partida.' });
      return;
    }
    const host = findPlayer(state, socket.data.playerId ?? '');
    state.status = 'ended';
    state.winnerId = undefined;
    logAction(state, `${host?.name ?? 'El anfitrión'} finalizó la partida. Nadie ganó.`);
    broadcastState(io, state);
  });

  // === Entrega manual de cartas (admin/banco, en cualquier momento) ===
  // Anti-trampas: SIEMPRE notifica a todos (notice) y queda en el log.
  socket.on(
    'admin:giveCard',
    ({
      targetPlayerId,
      kind,
      resource,
      commodity,
      devCard,
      force,
    }: {
      targetPlayerId: string;
      kind: 'resource' | 'commodity' | 'dev';
      resource?: Resource;
      commodity?: Commodity;
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
        // Banco ilimitado: la entrega nunca se bloquea ni requiere forzado.
        pushSnapshot(state);
        drainBank(state.bank, resource, 1);
        target.hand[resource] += 1;
        const text = `⚠️ El banco entregó 1 ${esResource(resource)} a ${target.name}`;
        logAction(state, `${text} (entrega manual de ${giver?.name ?? 'banco'}).`, target.id);
        io.to(state.code).emit('notice', { level: 'warn', text });
      } else if (kind === 'commodity') {
        if (!commodity || !COMMODITIES.includes(commodity)) {
          socket.emit('error', { message: 'Elige una mercancía válida.' });
          return;
        }
        pushSnapshot(state);
        drainCommodityBank(state.commodityBank, commodity, 1);
        target.commodities[commodity] += 1;
        const text = `⚠️ El banco entregó 1 ${esCommodity(commodity)} a ${target.name}`;
        logAction(state, `${text} (entrega manual de ${giver?.name ?? 'banco'}).`, target.id);
        io.to(state.code).emit('notice', { level: 'warn', text });
      } else {
        const validDev: DevCardType[] = ['knight', 'vp', 'roadBuilding', 'yearOfPlenty', 'monopoly'];
        // Sin tipo explícito: la carta superior del mazo (es lo que promete
        // el modal del banco).
        const chosen = devCard ?? state.devDeck[state.devDeck.length - 1];
        if (!chosen || !validDev.includes(chosen)) {
          socket.emit('error', { message: 'No quedan cartas en el mazo de desarrollo.' });
          return;
        }
        const idxInDeck = state.devDeck.lastIndexOf(chosen);
        if (idxInDeck === -1 && !force) {
          socket.emit('error', { message: 'No quedan cartas de ese tipo en el mazo. Puedes forzar la entrega si la mesa lo acuerda.' });
          return;
        }
        pushSnapshot(state);
        if (idxInDeck !== -1) state.devDeck.splice(idxInDeck, 1);
        target.devCards[chosen] += 1;
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

  // === Salir de sala de espera ===
  socket.on('lobby:leave', () => {
    const code = socket.data.code ?? '';
    const playerId = socket.data.playerId ?? '';
    const state = getRoom(code);
    if (!state || state.status !== 'lobby') return;

    if (state.hostId === playerId) {
      deleteRoom(code);
      io.to(code).emit('lobby:cancelled');
    } else {
      const player = findPlayer(state, playerId);
      const name = player?.name ?? 'Jugador';
      state.players = state.players.filter((p) => p.id !== playerId);
      state.turnOrder = state.turnOrder.filter((id) => id !== playerId);
      if (state.bankManagerId === playerId) state.bankManagerId = state.hostId;
      socket.leave(code);
      logAction(state, `${name} salió de la sala.`);
      broadcastState(io, state);
    }
    socket.data.code = undefined;
    socket.data.playerId = undefined;
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

// Ejecuta un uso de puerto ajeno ya aprobado (con o sin comisión): valida que
// el solicitante cubra la proporción + comisión, hace el intercambio de banco
// con la proporción del DUEÑO y le paga la comisión. Limpia activePortUse.
function executePortUse(io: Server, state: GameState, fee: Partial<Hand>): { ok: boolean; reason?: string } {
  const req = state.activePortUse;
  if (!req) return { ok: false, reason: 'No hay solicitud de puerto.' };
  const owner = findPlayer(state, req.ownerId);
  const requester = findPlayer(state, req.requesterId);
  if (!owner || !requester) {
    state.activePortUse = undefined;
    return { ok: false, reason: 'Jugador no encontrado.' };
  }
  let feeTotal = 0;
  for (const n of Object.values(fee)) feeTotal += n ?? 0;
  // El solicitante debe cubrir la proporción del puerto Y la comisión.
  const needed: Partial<Hand> = { [req.give]: req.ratio };
  for (const [res, n] of Object.entries(fee) as [Resource, number][]) {
    needed[res] = (needed[res] ?? 0) + n;
  }
  for (const [res, n] of Object.entries(needed) as [Resource, number][]) {
    if (requester.hand[res] < n) {
      state.activePortUse = undefined;
      return { ok: false, reason: `${requester.name} ya no tiene cartas para pagar el intercambio y la comisión.` };
    }
  }
  pushSnapshot(state);
  // Intercambio de banco usando el puerto del dueño.
  requester.hand[req.give] -= req.ratio;
  state.bank[req.give] += req.ratio;
  requester.hand[req.receive] += 1;
  drainBank(state.bank, req.receive, 1);
  // Pago de la comisión: del solicitante al dueño.
  for (const [res, n] of Object.entries(fee) as [Resource, number][]) {
    requester.hand[res] -= n;
    owner.hand[res] += n;
  }
  state.activePortUse = undefined;
  const feeLabel =
    feeTotal > 0
      ? ` (comisión: ${(Object.entries(fee) as [Resource, number][]).map(([r, n]) => `${n} ${esResource(r)}`).join(', ')})`
      : ' (gratis)';
  logAction(
    state,
    `${requester.name} usó el puerto ${req.ratio}:1 de ${owner.name}: dio ${req.ratio} ${esResource(req.give)}, recibió 1 ${esResource(req.receive)}${feeLabel}.`,
    requester.id
  );
  io.to(state.code).emit('notice', {
    level: 'info',
    text: `${requester.name} usó el puerto de ${owner.name}${feeTotal > 0 ? ' y le pagó comisión' : ' gratis'}.`,
  });
  return { ok: true };
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

function esCommodity(c: Commodity): string {
  return { coin: 'moneda', paper: 'papel', cloth: 'tela' }[c];
}

const DISCIPLINE_NAMES: Record<Discipline, string> = {
  trade: 'Comercio',
  politics: 'Política',
  science: 'Ciencia',
};

const ABILITY_NAMES: Record<'tradingHouse' | 'fortress' | 'aqueduct', string> = {
  tradingHouse: 'la Casa de Comercio',
  fortress: 'la Fortaleza',
  aqueduct: 'el Acueducto',
};

const PROGRESS_CARD_NAMES_ES: Record<ProgressCardType, string> = {
  alchemist: 'Alquimista', crane: 'Grúa', engineer: 'Ingeniero', inventor: 'Inventor',
  irrigation: 'Irrigación', mining: 'Minería', medicine: 'Medicina',
  roadBuildingP: 'Construcción de Caminos', smith: 'Herrero', printer: 'Imprenta',
  spy: 'Espía', bishop: 'Obispo', constitution: 'Constitución', deserter: 'Desertor',
  diplomat: 'Diplomático', intrigue: 'Intriga', saboteur: 'Saboteador',
  warlord: 'Señor de la Guerra', wedding: 'Boda',
  merchant: 'Mercader', merchantFleet: 'Flota Mercante', commercialHarbor: 'Puerto Comercial',
  masterMerchant: 'Maestro Mercader', resourceMonopoly: 'Monopolio de Recurso',
  tradeMonopoly: 'Monopolio de Comercio',
};

function esProgressCard(card: ProgressCardType): string {
  return PROGRESS_CARD_NAMES_ES[card];
}

// Resuelve el ataque bárbaro (cuando el barco llega a 7) y anuncia el resultado.
function resolveBarbarianAttackCK(io: Server, state: GameState): void {
  const r = resolveBarbarianAttack(state);
  logAction(state, `¡Los bárbaros atacaron! Fuerza bárbara ${r.attack} vs defensa ${r.defense}.`);
  if (r.defended) {
    if (r.uniqueDefender) {
      const w = findPlayer(state, r.uniqueDefender);
      logAction(state, `Catán se defendió. ${w?.name ?? 'Alguien'} recibe el Defensor de Catán (+1 PV).`, r.uniqueDefender);
      io.to(state.code).emit('notice', { level: 'success', text: `Catán repelió a los bárbaros. ${w?.name ?? 'Alguien'} es el Defensor de Catán (+1 PV).` });
    } else if (r.tieRewardDraws.length) {
      const names = r.tieRewardDraws.map((d) => findPlayer(state, d.playerId)?.name).filter(Boolean).join(', ');
      logAction(state, `Catán se defendió. Empate de defensa: ${names} roban una carta de progreso.`);
      io.to(state.code).emit('notice', { level: 'success', text: `Catán repelió a los bárbaros. Empate: ${names} roban carta de progreso.` });
    } else {
      io.to(state.code).emit('notice', { level: 'success', text: 'Catán repelió a los bárbaros.' });
    }
  } else if (r.losers.length) {
    const names = r.losers.map((id) => findPlayer(state, id)?.name).filter(Boolean).join(', ');
    logAction(state, `¡Los bárbaros saquearon! ${names} debe(n) degradar una ciudad a poblado.`);
    io.to(state.code).emit('notice', { level: 'warn', text: `¡Los bárbaros saquearon Catán! ${names} debe(n) degradar una ciudad a poblado.` });
  } else {
    logAction(state, '¡Los bárbaros atacaron, pero nadie tenía una ciudad que perder!');
    io.to(state.code).emit('notice', { level: 'warn', text: '¡Los bárbaros saquearon, pero no había ciudades que perder!' });
  }
}

function checkVictory(io: Server, state: GameState, player: Player): void {
  recomputeVictoryPoints(state);
  if (totalVictoryPoints(player) >= victoryTargetFor(state) && state.status === 'playing') {
    // No declarar automáticamente; pero notificar al jugador con un mensaje en el log silencioso
    // El jugador debe tocar "Declarar victoria".
  }
  broadcastState(io, state);
}
