import { create } from 'zustand';
import {
  AchievementUnlock,
  Building,
  BuildType,
  Commodity,
  CommodityHand,
  ConnectionStatus,
  DevCardType,
  Discipline,
  EventDie,
  ProgressCardType,
  ExtraRules,
  GameInvite,
  Hand,
  NoticeLevel,
  NoticePayload,
  PersistedSession,
  PlayerColor,
  PlayerView,
  PortType,
  Resource,
  TradeItemKind,
  User,
} from './types';
import {
  CreateOrJoinResponse,
  emitWithAck,
  refreshSocketAuth,
  socket,
} from './socket';
import {
  clearAuth,
  clearSession,
  getAuthToken,
  getCachedUser,
  getGuestMode,
  getSession,
  setAuth as persistAuth,
  setCachedUser,
  setGuestMode as persistGuestMode,
  setSession,
} from './lib/persistence';

interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  text: string;
}

// Notice público (Fase 3): cola FIFO, uno visible a la vez (NoticeBanner).
export interface ActiveNotice {
  id: number;
  level: NoticeLevel;
  text: string;
}

interface StoreState {
  // Identidad
  session: PersistedSession | null;
  // Vista personalizada del servidor
  view: PlayerView | null;
  // Conexión
  connectionStatus: ConnectionStatus;
  showDisconnectedBanner: boolean;
  // Reconexión silenciosa
  attemptedReconnect: boolean;
  reconnectFailed: boolean;
  // Toasts
  toasts: Toast[];
  // Notices públicos (Fase 3)
  notices: ActiveNotice[];
  // Invitaciones de amigos pendientes de responder (Fase 4)
  invites: GameInvite[];
  // Sync
  initialSyncReceived: boolean;

  // Cuenta (Fase 3). Independiente de la sesión de sala (principio 17).
  authToken: string | null;
  authUser: User | null;
  guestMode: boolean;
  // Navegación fuera de partida: Home ↔ Perfil, y Login forzado (p. ej.
  // invitado que decide crear cuenta con sala activa).
  homeView: 'home' | 'profile';
  showLogin: boolean;

  // Helpers de sesión
  setSession: (s: PersistedSession | null) => void;
  pushToast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
  pushNotice: (n: NoticePayload) => void;
  shiftNotice: () => void;
  setView: (v: PlayerView) => void;
  setConnectionStatus: (s: ConnectionStatus) => void;
  setShowDisconnectedBanner: (v: boolean) => void;

  // Cuenta
  setAuth: (token: string, user: User) => void;
  updateAuthUser: (user: User) => void;
  clearAuthSession: () => void;
  logout: () => void;
  enterGuestMode: () => void;
  setHomeView: (v: 'home' | 'profile') => void;
  setShowLogin: (v: boolean) => void;
  refreshAuthFromStorage: () => void;

  // Emisores
  createGame: (name?: string) => Promise<CreateOrJoinResponse>;
  joinGame: (code: string, name?: string) => Promise<CreateOrJoinResponse>;
  reconnectGame: () => Promise<{ ok?: boolean; error?: string }>;
  forgetSession: () => void;
  leaveRoom: () => void;
  // Abandonar una partida EN CURSO: el servidor devuelve las cartas al banco y
  // quita al jugador del orden de turnos; aquí limpiamos la sesión local.
  leaveGame: () => void;

  // Invitaciones de amigos
  pushInvite: (invite: GameInvite) => void;
  dismissInvite: (code: string) => void;

  // Lobby
  setColor: (color: PlayerColor) => void;
  setTurnOrder: (ids: string[]) => void;
  setBankManager: (playerId: string) => void;
  setExtension56: (enabled: boolean) => void;
  setCitiesKnights: (enabled: boolean) => void;
  upgradeCity: (discipline: Discipline) => void;
  setSeedResources: (enabled: boolean) => void;
  setExtraRules: (rules: Partial<ExtraRules>) => void;
  kickPlayer: (playerId: string) => void;
  rollOrderByDice: () => void;
  startGame: () => void;
  // Invitar a un amigo a la sala actual (ack del servidor).
  inviteFriend: (friendUserId: string) => Promise<{ ok?: boolean; error?: string }>;
  // Ids de amigos en línea (para el selector de invitación).
  getOnlineFriendIds: () => Promise<string[]>;

  // Banco (Fase 3): entrega manual de cartas, en cualquier momento.
  giveCard: (payload: {
    targetPlayerId: string;
    kind: 'resource' | 'commodity' | 'dev';
    resource?: Resource;
    commodity?: Commodity;
    devCard?: DevCardType;
    force?: boolean;
  }) => void;

  // Tabla de construcción (lobby y partida): reemplaza la lista completa de
  // MIS construcciones; el server deriva los hexes de producción.
  setBuildings: (buildings: Building[]) => void;
  setPorts: (ports: PortType[]) => void;
  // Cambio A: confirma que un poblado nuevo (pendiente de registro y sin
  // fichas) no toca ningún recurso, liberando el bloqueo de fin de turno.
  ackNoResources: (buildingId: string) => void;

  // Turno y dado
  rollNumber: (n: number) => void;
  rollCK: (production: number, redDie: number, eventDie: EventDie) => void;
  discardProgress: (card: ProgressCardType) => void;
  playProgress: (payload: {
    card: ProgressCardType;
    resource?: Resource;
    commodity?: Commodity;
    // Objetivo (Espía, Maestro Mercader, Desertor).
    targetPlayerId?: string;
    // Caballeros a promover (Fragua) o a quitar (Desertor, knightIds[0]).
    knightIds?: string[];
    // Poblado a convertir en ciudad (Medicina).
    settlementId?: string;
  }) => void;
  buildKnight: () => void;
  activateKnight: (knightId: string) => void;
  promoteKnight: (knightId: string) => void;
  knightAction: (knightId: string, kind: 'move' | 'displace' | 'chaseRobber') => void;
  downgradeCity: (buildingId: string) => void;
  buildWall: () => void;
  submitDiscard: (
    resourcesToDiscard: Partial<Hand>,
    commoditiesToDiscard?: Partial<CommodityHand>
  ) => void;
  forceRandomDiscard: (targetPlayerId: string) => void;
  moveRobber: (hexId: string) => void;
  moveRobberEmpty: () => void;
  stealFrom: (targetPlayerId: string) => void;

  // Acciones. Comprar una ciudad exige decir qué poblado se convierte.
  build: (type: BuildType, settlementId?: string) => void;
  playDevCard: (card: DevCardType, payload?: unknown) => void;
  // Comercio con banco/puertos: en C&K el ítem dado/recibido puede ser una
  // mercancía (giveKind/receiveKind, 'resource' por defecto).
  tradeBank: (
    give: Resource | Commodity,
    receive: Resource | Commodity,
    giveKind?: TradeItemKind,
    receiveKind?: TradeItemKind
  ) => void;
  // Oferta entre jugadores: recursos y, en C&K, también mercancías.
  offerTrade: (
    toId: string | null,
    give: Partial<Hand>,
    receive: Partial<Hand>,
    giveCommodities?: Partial<CommodityHand>,
    receiveCommodities?: Partial<CommodityHand>
  ) => void;
  respondTrade: (accept: boolean) => void;
  cancelTrade: () => void;
  // Acueducto (Ciencia nivel 3): tomar 1 recurso del banco cuando no produces.
  aqueductPick: (resource: Resource) => void;
  // Uso de puerto ajeno (regla extra sharedPorts).
  requestPort: (ownerId: string, give: Resource, receive: Resource) => void;
  respondPort: (accept: boolean, commission?: Partial<Hand>) => void;
  // Paso 3: el solicitante confirma o rechaza la comisión fijada por el dueño.
  confirmPort: (accept: boolean) => void;
  cancelPort: () => void;
  endTurn: () => void;
  specialBuildDone: () => void;
  specialBuildSkip: (playerId: string) => void;

  // Insignias y victoria
  setLongestRoad: (playerId: string | null) => void;
  declareWin: () => void;
  // Finalizar sin ganador (solo anfitrión).
  endGame: () => void;

  // Undo
  undo: () => void;
}

let toastSeq = 1;
let noticeSeq = 1;

export const useStore = create<StoreState>((set, get) => ({
  session: getSession(),
  view: null,
  connectionStatus: 'connecting',
  showDisconnectedBanner: false,
  attemptedReconnect: false,
  reconnectFailed: false,
  toasts: [],
  notices: [],
  invites: [],
  initialSyncReceived: false,

  authToken: getAuthToken(),
  authUser: getCachedUser(),
  guestMode: getGuestMode(),
  homeView: 'home',
  showLogin: false,

  setSession: (s) => {
    if (s) setSession(s);
    else clearSession();
    set({ session: s });
  },

  pushToast: (kind, text) => {
    const id = toastSeq++;
    set((st) => ({ toasts: [...st.toasts, { id, kind, text }] }));
    window.setTimeout(() => {
      set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },

  dismissToast: (id) =>
    set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  pushNotice: (n) => {
    const id = noticeSeq++;
    set((st) => ({
      notices: [...st.notices, { id, level: n.level, text: n.text }],
    }));
  },

  shiftNotice: () => set((st) => ({ notices: st.notices.slice(1) })),

  setView: (v) => set({ view: v, initialSyncReceived: true }),

  setConnectionStatus: (s) => set({ connectionStatus: s }),
  setShowDisconnectedBanner: (v) => set({ showDisconnectedBanner: v }),

  setAuth: (token, user) => {
    persistAuth(token, user);
    persistGuestMode(false);
    set({
      authToken: token,
      authUser: user,
      guestMode: false,
      showLogin: false,
      homeView: 'home',
    });
    // Reciclar el socket para que el handshake lleve el token nuevo. La sesión
    // de sala (si existe) se recupera sola por la rutina de reconexión.
    refreshSocketAuth();
  },

  updateAuthUser: (user) => {
    setCachedUser(user);
    set({ authUser: user });
  },

  // Limpia solo la sesión de cuenta (token expirado/ inválido). No toca la
  // sala ni el flag de invitado.
  clearAuthSession: () => {
    clearAuth();
    set({ authToken: null, authUser: null, homeView: 'home' });
    refreshSocketAuth();
  },

  // Cerrar sesión explícito: limpia JWT y guestMode; NUNCA la sesión de sala.
  logout: () => {
    clearAuth();
    persistGuestMode(false);
    set({
      authToken: null,
      authUser: null,
      guestMode: false,
      homeView: 'home',
    });
    refreshSocketAuth();
  },

  enterGuestMode: () => {
    persistGuestMode(true);
    set({ guestMode: true, showLogin: false });
  },

  setHomeView: (v) => set({ homeView: v }),
  setShowLogin: (v) => set({ showLogin: v }),

  // Sincronización entre pestañas: el evento `storage` de window relee las
  // claves de cuenta (login/logout hecho en otra pestaña).
  refreshAuthFromStorage: () => {
    set({
      authToken: getAuthToken(),
      authUser: getCachedUser(),
      guestMode: getGuestMode(),
    });
  },

  createGame: async (name) => {
    const trimmed = (name ?? '').trim();
    const res = await emitWithAck<CreateOrJoinResponse>('game:create', {
      // Logueado, el nombre es opcional: el servidor usa el displayName.
      name: trimmed.length > 0 ? trimmed : undefined,
    });
    if (res.code && res.playerId && res.sessionToken) {
      const session: PersistedSession = {
        code: res.code,
        playerId: res.playerId,
        sessionToken: res.sessionToken,
        name: trimmed || get().authUser?.displayName || 'Jugador',
      };
      setSession(session);
      set({ session, reconnectFailed: false });
    }
    return res;
  },

  joinGame: async (code, name) => {
    const trimmed = (name ?? '').trim();
    const upper = code.trim().toUpperCase();
    const res = await emitWithAck<CreateOrJoinResponse>('game:join', {
      code: upper,
      name: trimmed.length > 0 ? trimmed : undefined,
    });
    if (res.code && res.playerId && res.sessionToken) {
      const session: PersistedSession = {
        code: res.code,
        playerId: res.playerId,
        sessionToken: res.sessionToken,
        name: trimmed || get().authUser?.displayName || 'Jugador',
      };
      setSession(session);
      set({ session, reconnectFailed: false });
    }
    return res;
  },

  reconnectGame: async () => {
    const s = get().session;
    if (!s) return { error: 'No hay sesión guardada.' };
    set({ attemptedReconnect: true });
    const res = await emitWithAck<{ ok?: boolean; error?: string }>(
      'game:reconnect',
      { code: s.code, playerId: s.playerId, sessionToken: s.sessionToken }
    );
    if (res.error) {
      set({ reconnectFailed: true });
    } else {
      set({ reconnectFailed: false });
    }
    return res;
  },

  forgetSession: () => {
    clearSession();
    set({
      session: null,
      view: null,
      reconnectFailed: false,
      attemptedReconnect: false,
      initialSyncReceived: false,
    });
  },

  leaveRoom: () => {
    socket.emit('lobby:leave');
    clearSession();
    set({
      session: null,
      view: null,
      reconnectFailed: false,
      attemptedReconnect: false,
      initialSyncReceived: false,
    });
  },

  leaveGame: () => {
    socket.emit('game:leave');
    clearSession();
    set({
      session: null,
      view: null,
      reconnectFailed: false,
      attemptedReconnect: false,
      initialSyncReceived: false,
    });
  },

  pushInvite: (invite) =>
    set((st) =>
      st.invites.some((i) => i.code === invite.code)
        ? st
        : { invites: [...st.invites, invite] }
    ),
  dismissInvite: (code) =>
    set((st) => ({ invites: st.invites.filter((i) => i.code !== code) })),

  setColor: (color) => socket.emit('lobby:setColor', { color }),
  setTurnOrder: (orderedPlayerIds) =>
    socket.emit('lobby:setTurnOrder', { orderedPlayerIds }),
  setBankManager: (playerId) =>
    socket.emit('lobby:setBankManager', { playerId }),
  setExtension56: (enabled) =>
    socket.emit('lobby:setExtension56', { enabled }),
  setCitiesKnights: (enabled) =>
    socket.emit('lobby:setCitiesKnights', { enabled }),
  upgradeCity: (discipline) => socket.emit('city:upgrade', { discipline }),
  setSeedResources: (enabled) =>
    socket.emit('lobby:setSeedResources', { enabled }),
  setExtraRules: (rules) => socket.emit('lobby:setExtraRules', rules),
  kickPlayer: (playerId) => socket.emit('lobby:kick', { playerId }),
  rollOrderByDice: () => socket.emit('lobby:rollOrderByDice'),
  startGame: () => socket.emit('game:start'),
  inviteFriend: (friendUserId) =>
    emitWithAck<{ ok?: boolean; error?: string }>('friends:invite', {
      friendUserId,
    }),
  getOnlineFriendIds: async () => {
    const res = await emitWithAck<{ onlineIds?: string[] }>(
      'friends:onlineIds',
      {}
    );
    return res.onlineIds ?? [];
  },

  giveCard: (payload) => socket.emit('admin:giveCard', payload),

  setBuildings: (buildings) =>
    socket.emit('player:setBuildings', { buildings }),
  setPorts: (ports) => socket.emit('player:setPorts', { ports }),
  ackNoResources: (buildingId) =>
    socket.emit('building:ackNoResources', { buildingId }),

  rollNumber: (number) => socket.emit('turn:rollNumber', { number }),
  rollCK: (production, redDie, eventDie) =>
    socket.emit('turn:rollCK', { production, redDie, eventDie }),
  discardProgress: (card) => socket.emit('progress:discard', { card }),
  playProgress: (payload) => socket.emit('progress:play', payload),
  buildKnight: () => socket.emit('knight:build'),
  activateKnight: (knightId) => socket.emit('knight:activate', { knightId }),
  promoteKnight: (knightId) => socket.emit('knight:promote', { knightId }),
  knightAction: (knightId, kind) => socket.emit('knight:action', { knightId, kind }),
  downgradeCity: (buildingId) => socket.emit('barbarian:downgradeCity', { buildingId }),
  buildWall: () => socket.emit('city:buildWall'),
  submitDiscard: (resourcesToDiscard, commoditiesToDiscard) =>
    socket.emit('discard:submit', { resourcesToDiscard, commoditiesToDiscard }),
  forceRandomDiscard: (targetPlayerId) =>
    socket.emit('discard:forceRandom', { targetPlayerId }),
  moveRobber: (hexId) => socket.emit('robber:move', { hexId }),
  moveRobberEmpty: () => socket.emit('robber:moveEmpty'),
  stealFrom: (targetPlayerId) =>
    socket.emit('robber:steal', { targetPlayerId }),

  build: (type, settlementId) => socket.emit('build', { type, settlementId }),
  playDevCard: (card, payload) =>
    socket.emit('dev:play', { card, payload }),
  tradeBank: (give, receive, giveKind = 'resource', receiveKind = 'resource') =>
    socket.emit('trade:bank', { give, receive, giveKind, receiveKind }),
  offerTrade: (toId, give, receive, giveCommodities, receiveCommodities) =>
    socket.emit('trade:offer', { toId, give, receive, giveCommodities, receiveCommodities }),
  aqueductPick: (resource) => socket.emit('aqueduct:pick', { resource }),
  respondTrade: (accept) => socket.emit('trade:respond', { accept }),
  cancelTrade: () => socket.emit('trade:cancel'),
  requestPort: (ownerId, give, receive) =>
    socket.emit('port:request', { ownerId, give, receive }),
  respondPort: (accept, commission) =>
    socket.emit('port:respond', { accept, commission }),
  confirmPort: (accept) => socket.emit('port:confirm', { accept }),
  cancelPort: () => socket.emit('port:cancel'),
  endTurn: () => socket.emit('turn:end'),
  specialBuildDone: () => socket.emit('specialBuild:done'),
  specialBuildSkip: (playerId) =>
    socket.emit('specialBuild:skip', { playerId }),

  setLongestRoad: (playerId) =>
    socket.emit('vp:setLongestRoad', { playerId }),
  declareWin: () => socket.emit('game:declareWin'),
  endGame: () => socket.emit('game:end'),

  undo: () => socket.emit('action:undo'),
}));

// Conexión con los eventos del socket: una sola subscripción.
let wired = false;
let disconnectedTimer: number | null = null;

export function wireSocket(): void {
  if (wired) return;
  wired = true;

  const store = useStore;

  socket.on('connect', () => {
    const wasDisconnected = store.getState().showDisconnectedBanner;
    store.getState().setConnectionStatus('connected');
    if (disconnectedTimer !== null) {
      window.clearTimeout(disconnectedTimer);
      disconnectedTimer = null;
    }
    if (wasDisconnected) {
      store.getState().setShowDisconnectedBanner(false);
      store.getState().pushToast('success', 'Reconectado.');
    }
    // Si ya nos habíamos identificado al servidor (attemptedReconnect=true) y
    // se cayó la conexión, reanudar identidad. La primera reconexión la dispara
    // App.tsx tras montar para tener control sobre el orden.
    const st = store.getState();
    if (st.session && st.attemptedReconnect) {
      void st.reconnectGame();
    }
  });

  socket.on('disconnect', () => {
    store.getState().setConnectionStatus('disconnected');
    // Mostrar banner tras 2s sin red (no por desconexiones efímeras).
    if (disconnectedTimer !== null) window.clearTimeout(disconnectedTimer);
    disconnectedTimer = window.setTimeout(() => {
      store.getState().setShowDisconnectedBanner(true);
    }, 2000);
  });

  socket.io.on('reconnect_attempt', () => {
    store.getState().setConnectionStatus('connecting');
  });

  socket.on('state:update', (view: PlayerView) => {
    store.getState().setView(view);
  });

  socket.on('error', (e: { message?: string }) => {
    const msg = e?.message ?? 'Algo salió mal.';
    store.getState().pushToast('error', msg);
  });

  // Notice público (Fase 3): banner prominente para todos. Se suprime en la
  // pantalla de ganador (la partida terminó; queda en el log).
  socket.on('lobby:cancelled', () => {
    store.getState().pushToast('info', 'El anfitrión canceló la sala.');
    clearSession();
    store.setState({
      session: null,
      view: null,
      reconnectFailed: false,
      attemptedReconnect: false,
      initialSyncReceived: false,
    });
  });

  socket.on('notice', (n: NoticePayload) => {
    if (!n || typeof n.text !== 'string') return;
    const st = store.getState();
    if (st.view?.state.status === 'ended') return;
    st.pushNotice(n);
  });

  socket.on('build:notify', (n: { text: string }) => {
    if (!n || typeof n.text !== 'string') return;
    const st = store.getState();
    if (st.view?.state.status === 'ended') return;
    st.pushToast('info', n.text);
  });

  // El anfitrión expulsó a este jugador de la sala de espera.
  socket.on('lobby:kicked', () => {
    store.getState().pushToast('info', 'El anfitrión te sacó de la sala.');
    clearSession();
    store.setState({
      session: null,
      view: null,
      reconnectFailed: false,
      attemptedReconnect: false,
      initialSyncReceived: false,
    });
  });

  // Invitación de un amigo a su sala (Fase 4).
  socket.on('friends:invited', (inv: GameInvite) => {
    if (!inv || typeof inv.code !== 'string') return;
    store.getState().pushInvite({ code: inv.code, fromName: inv.fromName });
  });

  // Logro desbloqueado en vivo (mitad de partida). Al dueño le llega una
  // notificación PROMINENTE (banner/notice); a los oponentes, una SILENCIOSA
  // (toast). El log de la partida ya registra el desbloqueo para todos.
  socket.on('achievement:unlocked', (a: AchievementUnlock) => {
    if (!a || typeof a.name !== 'string') return;
    const st = store.getState();
    if (a.mine) {
      st.pushNotice({
        level: 'info',
        text: `¡Logro desbloqueado! «${a.name}» · +${a.xp} XP`,
      });
    } else {
      st.pushToast('info', `${a.playerName} desbloqueó «${a.name}».`);
    }
  });
}
