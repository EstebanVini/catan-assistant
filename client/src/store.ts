import { create } from 'zustand';
import {
  BuildType,
  ConnectionStatus,
  DevCardType,
  Hand,
  Hex,
  PersistedSession,
  PlayerColor,
  PlayerView,
  PortType,
  Resource,
} from './types';
import {
  CreateOrJoinResponse,
  emitWithAck,
  socket,
} from './socket';
import { clearSession, getSession, setSession } from './lib/persistence';

interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
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
  // Sync
  initialSyncReceived: boolean;

  // Helpers de sesión
  setSession: (s: PersistedSession | null) => void;
  pushToast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
  setView: (v: PlayerView) => void;
  setConnectionStatus: (s: ConnectionStatus) => void;
  setShowDisconnectedBanner: (v: boolean) => void;

  // Emisores
  createGame: (name: string) => Promise<CreateOrJoinResponse>;
  joinGame: (code: string, name: string) => Promise<CreateOrJoinResponse>;
  reconnectGame: () => Promise<{ ok?: boolean; error?: string }>;
  forgetSession: () => void;

  // Lobby
  setColor: (color: PlayerColor) => void;
  setTurnOrder: (ids: string[]) => void;
  setBankManager: (playerId: string) => void;
  setExtension56: (enabled: boolean) => void;
  rollOrderByDice: () => void;
  startGame: () => void;

  // Tabla
  upsertHex: (hex: Hex) => void;
  removeHex: (hexId: string) => void;
  addHexOwner: (hexId: string, playerId: string, type: 'settlement' | 'city') => void;
  removeHexOwner: (hexId: string, playerId: string) => void;
  setPorts: (ports: PortType[]) => void;

  // Turno y dado
  rollNumber: (n: number) => void;
  submitDiscard: (resourcesToDiscard: Partial<Hand>) => void;
  forceRandomDiscard: (targetPlayerId: string) => void;
  moveRobber: (hexId: string) => void;
  stealFrom: (targetPlayerId: string) => void;

  // Acciones
  build: (type: BuildType) => void;
  playDevCard: (card: DevCardType, payload?: unknown) => void;
  tradeBank: (give: Resource, receive: Resource) => void;
  offerTrade: (toId: string | null, give: Partial<Hand>, receive: Partial<Hand>) => void;
  respondTrade: (accept: boolean) => void;
  cancelTrade: () => void;
  endTurn: () => void;
  specialBuildDone: () => void;
  specialBuildSkip: (playerId: string) => void;

  // Insignias y victoria
  setLongestRoad: (playerId: string | null) => void;
  declareWin: () => void;

  // Undo
  undo: () => void;
}

let toastSeq = 1;

export const useStore = create<StoreState>((set, get) => ({
  session: getSession(),
  view: null,
  connectionStatus: 'connecting',
  showDisconnectedBanner: false,
  attemptedReconnect: false,
  reconnectFailed: false,
  toasts: [],
  initialSyncReceived: false,

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

  setView: (v) => set({ view: v, initialSyncReceived: true }),

  setConnectionStatus: (s) => set({ connectionStatus: s }),
  setShowDisconnectedBanner: (v) => set({ showDisconnectedBanner: v }),

  createGame: async (name) => {
    const trimmed = name.trim();
    const res = await emitWithAck<CreateOrJoinResponse>('game:create', {
      name: trimmed,
    });
    if (res.code && res.playerId && res.sessionToken) {
      const session: PersistedSession = {
        code: res.code,
        playerId: res.playerId,
        sessionToken: res.sessionToken,
        name: trimmed,
      };
      setSession(session);
      set({ session, reconnectFailed: false });
    }
    return res;
  },

  joinGame: async (code, name) => {
    const trimmed = name.trim();
    const upper = code.trim().toUpperCase();
    const res = await emitWithAck<CreateOrJoinResponse>('game:join', {
      code: upper,
      name: trimmed,
    });
    if (res.code && res.playerId && res.sessionToken) {
      const session: PersistedSession = {
        code: res.code,
        playerId: res.playerId,
        sessionToken: res.sessionToken,
        name: trimmed,
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

  setColor: (color) => socket.emit('lobby:setColor', { color }),
  setTurnOrder: (orderedPlayerIds) =>
    socket.emit('lobby:setTurnOrder', { orderedPlayerIds }),
  setBankManager: (playerId) =>
    socket.emit('lobby:setBankManager', { playerId }),
  setExtension56: (enabled) =>
    socket.emit('lobby:setExtension56', { enabled }),
  rollOrderByDice: () => socket.emit('lobby:rollOrderByDice'),
  startGame: () => socket.emit('game:start'),

  upsertHex: (hex) => socket.emit('hex:upsert', { hex }),
  removeHex: (hexId) => socket.emit('hex:remove', { hexId }),
  addHexOwner: (hexId, playerId, type) =>
    socket.emit('hex:addOwner', { hexId, playerId, type }),
  removeHexOwner: (hexId, playerId) =>
    socket.emit('hex:removeOwner', { hexId, playerId }),
  setPorts: (ports) => socket.emit('player:setPorts', { ports }),

  rollNumber: (number) => socket.emit('turn:rollNumber', { number }),
  submitDiscard: (resourcesToDiscard) =>
    socket.emit('discard:submit', { resourcesToDiscard }),
  forceRandomDiscard: (targetPlayerId) =>
    socket.emit('discard:forceRandom', { targetPlayerId }),
  moveRobber: (hexId) => socket.emit('robber:move', { hexId }),
  stealFrom: (targetPlayerId) =>
    socket.emit('robber:steal', { targetPlayerId }),

  build: (type) => socket.emit('build', { type }),
  playDevCard: (card, payload) =>
    socket.emit('dev:play', { card, payload }),
  tradeBank: (give, receive) =>
    socket.emit('trade:bank', { give, receive }),
  offerTrade: (toId, give, receive) =>
    socket.emit('trade:offer', { toId, give, receive }),
  respondTrade: (accept) => socket.emit('trade:respond', { accept }),
  cancelTrade: () => socket.emit('trade:cancel'),
  endTurn: () => socket.emit('turn:end'),
  specialBuildDone: () => socket.emit('specialBuild:done'),
  specialBuildSkip: (playerId) =>
    socket.emit('specialBuild:skip', { playerId }),

  setLongestRoad: (playerId) =>
    socket.emit('vp:setLongestRoad', { playerId }),
  declareWin: () => socket.emit('game:declareWin'),

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
}
