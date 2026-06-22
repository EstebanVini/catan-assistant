import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import {
  acceptFriend,
  getFriends,
  removeFriend,
  requestFriend,
  searchUsers,
} from '../api';
import type { FriendEntry, FriendUser, UserSearchResult } from '../types';
import { Avatar } from './Avatar';
import { BadgeChip } from './BadgeIcon';
import { FriendProfileModal } from './FriendProfileModal';
import { useModalA11y } from '../lib/useModalA11y';

// Panel de Amigos (brief §1). Overlay full-screen tipo sheet con tres zonas
// scrollables en una sola vista (no tabs): buscar/agregar, solicitudes
// pendientes (entrantes ámbar + salientes) y la lista de amigos con sus stats.
//
// Refresca con `getFriends` tras cada mutación para que la fuente de verdad sea
// el servidor (estados de botón derivados, sin estado optimista frágil).
// Solo tiene sentido con cuenta: la entrada (Home/Profile) ya lo condiciona a
// `authUser`, pero igual se protege ante la ausencia de token.

type LoadState = 'loading' | 'ready' | 'error';

export function FriendsPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const authToken = useStore((s) => s.authToken);
  const authUser = useStore((s) => s.authUser);
  const pushToast = useStore((s) => s.pushToast);

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  // F4 — perfil completo de un amigo. Estado local del panel: el amigo cuyo
  // perfil se está viendo, o null si el modal está cerrado.
  const [viewingProfile, setViewingProfile] = useState<FriendUser | null>(null);
  const [data, setData] = useState<{
    friends: FriendEntry[];
    incoming: FriendEntry[];
    outgoing: FriendEntry[];
  }>({ friends: [], incoming: [], outgoing: [] });

  const refresh = useCallback(async (): Promise<void> => {
    if (!authToken) {
      setLoadState('error');
      return;
    }
    const res = await getFriends(authToken);
    if (res.ok) {
      setData({
        friends: res.friends,
        incoming: res.incoming,
        outgoing: res.outgoing,
      });
      setLoadState('ready');
    } else {
      setLoadState('error');
    }
  }, [authToken]);

  useEffect(() => {
    setLoadState('loading');
    void refresh();
  }, [refresh]);

  if (!authUser || !authToken) {
    // Salvaguarda: sin cuenta no hay Amigos.
    return (
      <Shell dialogRef={dialogRef} onClose={onClose}>
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-neutral-300">
            Inicia sesión para jugar con amigos.
          </p>
        </div>
      </Shell>
    );
  }

  // Conjunto de usernames ya vinculados (amigos, entrantes o salientes), para
  // que la búsqueda muestre el estado correcto del botón por resultado.
  const friendUsernames = new Set(
    data.friends.map((f) => f.user.username.toLowerCase())
  );
  const outgoingUsernames = new Set(
    data.outgoing.map((f) => f.user.username.toLowerCase())
  );
  const incomingByUsername = new Map(
    data.incoming.map((f) => [f.user.username.toLowerCase(), f] as const)
  );

  const hasPending = data.incoming.length > 0 || data.outgoing.length > 0;

  return (
    <Shell dialogRef={dialogRef} onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {/* Zona 1 — Buscar y agregar */}
        <SearchZone
          token={authToken}
          friendUsernames={friendUsernames}
          outgoingUsernames={outgoingUsernames}
          incomingByUsername={incomingByUsername}
          onMutated={refresh}
          pushToast={pushToast}
        />

        {loadState === 'loading' ? (
          <FriendsSkeleton />
        ) : loadState === 'error' ? (
          <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/[0.06] p-4 text-center">
            <p className="text-sm text-red-200">
              No pudimos cargar tus amigos. Revisa tu conexión.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadState('loading');
                void refresh();
              }}
              className="mt-3 min-h-[44px] w-full rounded-lg border border-white/12 bg-surface-3 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* Zona 2 — Solicitudes pendientes (solo si hay) */}
            {hasPending ? (
              <PendingZone
                token={authToken}
                incoming={data.incoming}
                outgoing={data.outgoing}
                onMutated={refresh}
                pushToast={pushToast}
              />
            ) : null}

            {/* Zona 3 — Mis amigos */}
            <FriendsZone
              token={authToken}
              friends={data.friends}
              onMutated={refresh}
              onViewProfile={setViewingProfile}
              pushToast={pushToast}
            />
          </>
        )}
      </div>

      {viewingProfile ? (
        <FriendProfileModal
          user={viewingProfile}
          onClose={() => setViewingProfile(null)}
        />
      ) : null}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Shell — overlay full-screen tipo sheet (anim-slide-up), header con cierre.
// ---------------------------------------------------------------------------

function Shell({
  dialogRef,
  onClose,
  children,
}: {
  dialogRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="friends-panel-title"
        onClick={(e) => e.stopPropagation()}
        className="anim-slide-up flex h-[92dvh] w-full max-w-md flex-col rounded-t-2xl border border-white/10 bg-neutral-900 shadow-2xl ring-1 ring-white/5 sm:h-[88dvh] sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/8 px-4 pb-3 pt-4">
          <h2
            id="friends-panel-title"
            className="font-display text-base font-semibold tracking-tight text-neutral-50"
          >
            Amigos
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar amigos"
            className="-mr-1 flex h-11 w-11 items-center justify-center rounded-lg text-neutral-400 transition-colors active:bg-white/10 active:text-neutral-100"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zona 1 — Buscar y agregar
// ---------------------------------------------------------------------------

type SearchState = 'idle' | 'searching' | 'done' | 'error';

function SearchZone({
  token,
  friendUsernames,
  outgoingUsernames,
  incomingByUsername,
  onMutated,
  pushToast,
}: {
  token: string;
  friendUsernames: Set<string>;
  outgoingUsernames: Set<string>;
  incomingByUsername: Map<string, FriendEntry>;
  onMutated: () => Promise<void>;
  pushToast: (kind: 'info' | 'error' | 'success', text: string) => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  // friendshipId pendientes de acción en una fila de resultado.
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const canSearch = trimmed.length >= 1 && state !== 'searching';

  async function runSearch(): Promise<void> {
    if (!canSearch) return;
    setState('searching');
    const res = await searchUsers(token, trimmed);
    if (res.ok) {
      setResults(res.users);
      setState('done');
    } else {
      setState('error');
    }
  }

  async function add(username: string): Promise<void> {
    if (busyUser) return;
    setBusyUser(username);
    const res = await requestFriend(token, username);
    setBusyUser(null);
    if (res.ok) {
      pushToast(
        'success',
        res.status === 'accepted'
          ? 'Ahora son amigos.'
          : 'Solicitud enviada.'
      );
      await onMutated();
    } else {
      pushToast('error', res.error);
    }
  }

  return (
    <section className="pt-4">
      <label
        htmlFor="friend-search"
        className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400"
      >
        Buscar por nombre de usuario
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="friend-search"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runSearch();
          }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="usuario"
          className="min-w-0 flex-1 rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400"
        />
        <button
          type="button"
          disabled={!canSearch}
          onClick={() => void runSearch()}
          className="min-h-[44px] flex-shrink-0 rounded-lg border border-white/12 bg-surface-3 px-4 text-sm font-semibold text-neutral-100 transition-all active:scale-[0.98] active:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === 'searching' ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {state === 'error' ? (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/[0.06] px-3 py-3 text-center">
          <p className="text-xs text-red-200">
            No pudimos buscar. Revisa tu conexión.
          </p>
          <button
            type="button"
            onClick={() => void runSearch()}
            className="mt-2 min-h-[44px] w-full rounded-lg border border-white/12 bg-surface-3 px-3 py-2 text-xs font-medium transition-colors active:bg-white/10"
          >
            Reintentar
          </button>
        </div>
      ) : state === 'done' && results.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-xs leading-relaxed text-neutral-400">
          No encontramos a nadie con ese usuario.
        </p>
      ) : results.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {results.map((u) => {
            const uname = u.username.toLowerCase();
            const isFriend = friendUsernames.has(uname);
            const isOutgoing = outgoingUsernames.has(uname);
            const incoming = incomingByUsername.get(uname);
            const busy = busyUser === u.username;
            return (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface-1 p-2.5"
              >
                <Avatar
                  seed={u.username}
                  name={u.displayName}
                  avatarUrl={u.avatarUrl}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-50">
                    {u.displayName}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    @{u.username}
                  </p>
                </div>
                {isFriend ? (
                  <span className="flex-shrink-0 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-xs font-medium text-neutral-400">
                    Amigos
                  </span>
                ) : incoming ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        if (busyUser) return;
                        setBusyUser(u.username);
                        const res = await acceptFriend(
                          token,
                          incoming.friendshipId
                        );
                        setBusyUser(null);
                        if (res.ok) {
                          pushToast('success', 'Ahora son amigos.');
                          await onMutated();
                        } else {
                          pushToast('error', res.error);
                        }
                      })();
                    }}
                    className="min-h-[44px] flex-shrink-0 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-neutral-950 shadow-cta transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {busy ? 'Aceptando…' : 'Te envió solicitud'}
                  </button>
                ) : isOutgoing ? (
                  <span className="flex-shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-xs font-medium text-amber-300">
                    Enviada
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void add(u.username)}
                    className="min-h-[44px] flex-shrink-0 rounded-lg bg-emerald-500 px-4 text-xs font-bold text-neutral-950 shadow-cta transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {busy ? 'Enviando…' : 'Agregar'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Zona 2 — Solicitudes pendientes
// ---------------------------------------------------------------------------

function PendingZone({
  token,
  incoming,
  outgoing,
  onMutated,
  pushToast,
}: {
  token: string;
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
  onMutated: () => Promise<void>;
  pushToast: (kind: 'info' | 'error' | 'success', text: string) => void;
}): JSX.Element {
  const [busyId, setBusyId] = useState<string | null>(null);
  const count = incoming.length + outgoing.length;

  async function accept(id: string): Promise<void> {
    if (busyId) return;
    setBusyId(id);
    const res = await acceptFriend(token, id);
    setBusyId(null);
    if (res.ok) {
      pushToast('success', 'Ahora son amigos.');
      await onMutated();
    } else {
      pushToast('error', res.error);
    }
  }

  async function reject(id: string, kind: 'incoming' | 'outgoing'): Promise<void> {
    if (busyId) return;
    setBusyId(id);
    const res = await removeFriend(token, id);
    setBusyId(null);
    if (res.ok) {
      pushToast(
        'info',
        kind === 'incoming' ? 'Solicitud rechazada.' : 'Solicitud cancelada.'
      );
      await onMutated();
    } else {
      pushToast('error', res.error);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/[0.03] p-3">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-300">
        Solicitudes
        <span className="nums rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-200">
          {count}
        </span>
      </h3>

      <ul className="mt-2.5 space-y-2">
        {incoming.map((f) => {
          const busy = busyId === f.friendshipId;
          return (
            <li
              key={f.friendshipId}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface-1 p-2.5"
            >
              <Avatar
                seed={f.user.username}
                name={f.user.displayName}
                avatarUrl={f.user.avatarUrl}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-50">
                  {f.user.displayName}
                </p>
                <p className="truncate text-xs text-amber-300/90">
                  Te envió solicitud
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void accept(f.friendshipId)}
                  className="min-h-[44px] rounded-lg bg-emerald-500 px-3 text-xs font-bold text-neutral-950 shadow-cta transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reject(f.friendshipId, 'incoming')}
                  className="min-h-[44px] rounded-lg border border-white/12 bg-surface-3 px-3 text-xs font-medium text-neutral-200 transition-colors active:bg-white/10 disabled:opacity-60"
                >
                  Rechazar
                </button>
              </div>
            </li>
          );
        })}

        {outgoing.map((f) => {
          const busy = busyId === f.friendshipId;
          return (
            <li
              key={f.friendshipId}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface-1 p-2.5"
            >
              <Avatar
                seed={f.user.username}
                name={f.user.displayName}
                avatarUrl={f.user.avatarUrl}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-50">
                  {f.user.displayName}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  Pendiente · enviada por ti
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void reject(f.friendshipId, 'outgoing')}
                className="min-h-[44px] flex-shrink-0 rounded-lg border border-white/12 bg-surface-3 px-3 text-xs font-medium text-neutral-200 transition-colors active:bg-white/10 disabled:opacity-60"
              >
                Cancelar
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Zona 3 — Mis amigos
// ---------------------------------------------------------------------------

function FriendsZone({
  token,
  friends,
  onMutated,
  onViewProfile,
  pushToast,
}: {
  token: string;
  friends: FriendEntry[];
  onMutated: () => Promise<void>;
  onViewProfile: (user: FriendUser) => void;
  pushToast: (kind: 'info' | 'error' | 'success', text: string) => void;
}): JSX.Element {
  const [confirm, setConfirm] = useState<FriendEntry | null>(null);
  const [removing, setRemoving] = useState(false);

  async function doRemove(): Promise<void> {
    if (!confirm || removing) return;
    setRemoving(true);
    const res = await removeFriend(token, confirm.friendshipId);
    setRemoving(false);
    if (res.ok) {
      pushToast('info', `Eliminaste a ${confirm.user.displayName}.`);
      setConfirm(null);
      await onMutated();
    } else {
      pushToast('error', res.error);
    }
  }

  if (friends.length === 0) {
    return (
      <section className="mt-5">
        <div className="rounded-2xl border border-dashed border-white/15 bg-surface-1 px-4 py-8 text-center">
          <h3 className="text-sm font-semibold text-neutral-100">
            Aún no tienes amigos aquí
          </h3>
          <p className="mx-auto mt-1.5 max-w-[18rem] text-xs leading-relaxed text-neutral-400">
            Busca por nombre de usuario y envíales una solicitud para
            invitarlos a tus partidas.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        Mis amigos
        <span className="nums ml-1.5 text-neutral-500">{friends.length}</span>
      </h3>
      <ul className="mt-2.5 space-y-2">
        {friends.map((f) => {
          const s = f.user.stats;
          const badgeCount = s.longestRoadBadges + s.largestArmyBadges;
          return (
            <li
              key={f.friendshipId}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface-1 p-2.5"
            >
              {/* Disparador del perfil: solo el área avatar+nombre+stats. Las
                  acciones (eliminar) quedan FUERA de este botón para no anidar
                  botones dentro de botones. Los BadgeChip son `role="img"`
                  (no interactivos), así que son seguros aquí dentro. */}
              <button
                type="button"
                onClick={() => onViewProfile(f.user)}
                aria-label={`Ver perfil de ${f.user.displayName}`}
                className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors active:bg-white/[0.06]"
              >
                <Avatar
                  seed={f.user.username}
                  name={f.user.displayName}
                  avatarUrl={f.user.avatarUrl}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-50">
                    {f.user.displayName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-400">
                    <span className="nums">{s.gamesPlayed}</span> partidas ·{' '}
                    <span className="nums">{s.wins}</span> victorias ·{' '}
                    <span className="nums">{badgeCount}</span> insignias
                  </p>
                  {badgeCount > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {s.longestRoadBadges > 0 ? (
                        <BadgeChip
                          variant="road"
                          label={`Camino más largo ×${s.longestRoadBadges}`}
                        />
                      ) : null}
                      {s.largestArmyBadges > 0 ? (
                        <BadgeChip
                          variant="army"
                          label={`Ejército más grande ×${s.largestArmyBadges}`}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setConfirm(f)}
                aria-label={`Eliminar a ${f.user.displayName} de tus amigos`}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors active:bg-red-500/10 active:text-red-300"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M5 7 H19 M9 7 V5 H15 V7 M7 7 L8 20 H16 L17 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>

      {confirm ? (
        <RemoveConfirm
          name={confirm.user.username}
          removing={removing}
          onCancel={() => {
            if (!removing) setConfirm(null);
          }}
          onConfirm={() => void doRemove()}
        />
      ) : null}
    </section>
  );
}

function RemoveConfirm({
  name,
  removing,
  onCancel,
  onConfirm,
}: {
  name: string;
  removing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, onCancel);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-friend-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <h2
          id="remove-friend-title"
          className="text-sm font-semibold tracking-tight text-neutral-50"
        >
          ¿Eliminar a @{name} de tus amigos?
        </h2>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={removing}
            className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={removing}
            className="min-h-[44px] flex-1 rounded-lg border border-red-500/40 bg-red-500/[0.08] px-3 py-2 text-sm font-bold text-red-300 transition-colors active:bg-red-500/[0.16] disabled:opacity-60"
          >
            {removing ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FriendsSkeleton(): JSX.Element {
  return (
    <div className="mt-5 animate-pulse space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface-1 p-2.5"
        >
          <div className="h-11 w-11 flex-shrink-0 rounded-full bg-white/10" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-28 rounded bg-white/10" />
            <div className="h-3 w-40 rounded bg-surface-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
