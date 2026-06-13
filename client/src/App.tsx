import { useEffect, useState } from 'react';
import { useStore, wireSocket } from './store';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { WinnerScreen } from './components/WinnerScreen';
import { NoticeBanner } from './components/NoticeBanner';
import { getMe } from './api';
import type { GameInvite } from './types';

// Cablear el socket lo antes posible (a nivel de módulo), para no perder eventos.
wireSocket();

export function App(): JSX.Element {
  const view = useStore((s) => s.view);
  const session = useStore((s) => s.session);
  const initialSyncReceived = useStore((s) => s.initialSyncReceived);
  const reconnectFailed = useStore((s) => s.reconnectFailed);
  const attemptedReconnect = useStore((s) => s.attemptedReconnect);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const toasts = useStore((s) => s.toasts);
  const noticeVisible = useStore((s) => s.notices.length > 0);
  const dismissToast = useStore((s) => s.dismissToast);
  const forgetSession = useStore((s) => s.forgetSession);
  const pushToast = useStore((s) => s.pushToast);
  const authToken = useStore((s) => s.authToken);
  const authUser = useStore((s) => s.authUser);
  const guestMode = useStore((s) => s.guestMode);
  const homeView = useStore((s) => s.homeView);
  const showLogin = useStore((s) => s.showLogin);
  const invites = useStore((s) => s.invites);
  const dismissInvite = useStore((s) => s.dismissInvite);
  const joinGame = useStore((s) => s.joinGame);

  // Reconexión silenciosa al cargar: si hay sesión guardada y aún no se intentó.
  useEffect(() => {
    if (!session) return;
    if (attemptedReconnect) return;
    if (connectionStatus !== 'connected') return;
    void useStore.getState().reconnectGame();
  }, [session, attemptedReconnect, connectionStatus]);

  // Manejar sesión obsoleta (servidor reiniciado).
  useEffect(() => {
    if (reconnectFailed && session) {
      pushToast(
        'error',
        'Tu partida guardada ya no existe. Empieza una nueva.'
      );
      const t = window.setTimeout(() => forgetSession(), 1200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [reconnectFailed, session, forgetSession, pushToast]);

  // Validación del JWT en segundo plano (brief §1): si el token expiró o es
  // inválido (401), limpiar y avisar — se mostrará el Login. Si falla por red,
  // Home funciona en modo degradado con el usuario cacheado.
  useEffect(() => {
    const token = useStore.getState().authToken;
    if (!token) return;
    let cancelled = false;
    void getMe(token).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        useStore.getState().updateAuthUser(res.user);
      } else if (res.status === 401) {
        useStore.getState().clearAuthSession();
        useStore
          .getState()
          .pushToast('error', 'Tu sesión expiró. Vuelve a entrar.');
      }
      // Red caída / 503: modo degradado silencioso, el cache manda.
    });
    return () => {
      cancelled = true;
    };
    // Solo al montar: la validación es del arranque de la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dos pestañas: detectar login/logout hechos en otra pestaña vía el evento
  // `storage` y refrescar el header sin forzar recarga (brief §1).
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (
        e.key === null ||
        e.key === 'auth.token' ||
        e.key === 'auth.user' ||
        e.key === 'guestMode'
      ) {
        useStore.getState().refreshAuthFromStorage();
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Determinar pantalla. Precedencia de entrada (brief §1):
  //   1. Login pedido explícitamente (invitado que quiere cuenta).
  //   2. Sesión de sala activa — la partida en curso manda.
  //   3. JWT válido → Home logueado (o Perfil).
  //   4. Modo invitado elegido previamente → Home.
  //   5. Nada → Login.
  let screen: JSX.Element | null;
  if (showLogin) {
    screen = <LoginScreen />;
  } else if (session && !initialSyncReceived && !reconnectFailed) {
    // Espera silenciosa de la primera actualización tras reconectar.
    screen = <SyncingScreen />;
  } else if (!view || !view.me) {
    if (session || authToken || guestMode) {
      screen =
        homeView === 'profile' && authUser ? <ProfileScreen /> : <HomeScreen />;
    } else {
      screen = <LoginScreen />;
    }
  } else if (view.state.status === 'lobby') {
    screen = <LobbyScreen />;
  } else if (view.state.status === 'ended') {
    // Pantalla completa de ganador. `WinnerScreen` ya cubre todo el viewport
    // (overlay full-screen), por eso no necesita un wrapper de `main`.
    screen = <WinnerScreen />;
  } else {
    screen = <GameScreen />;
  }

  return (
    <>
      {screen}
      {/* Notice público: full-width arriba, por encima de cualquier modal. */}
      <NoticeBanner />
      {/* Invitaciones de amigos a una sala (socket `friends:invited`). Aviso
          accionable persistente, no un toast efímero. Se ubica bajo el notice
          público para no taparlo. */}
      {invites.length > 0 ? (
        <div
          className={
            'pointer-events-none fixed inset-x-0 z-[95] flex flex-col items-center gap-2 px-3 transition-[top] duration-200 ' +
            (noticeVisible ? 'top-[4.75rem]' : 'top-2')
          }
        >
          {invites.map((invite) => (
            <InviteCard
              key={invite.code}
              invite={invite}
              alreadyInRoom={session !== null}
              onJoin={async () => {
                const res = await joinGame(invite.code);
                if (res.error) {
                  pushToast('error', res.error);
                } else {
                  dismissInvite(invite.code);
                }
              }}
              onDismiss={() => dismissInvite(invite.code)}
            />
          ))}
        </div>
      ) : null}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className={
          // Con un notice activo (banner full-width en top-0, ~64px de alto),
          // la pila de toasts baja para no taparlo: el notice es transparencia
          // pública y no se negocia (brief §4).
          'pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-1 px-3 transition-[top] duration-200 ' +
          (noticeVisible ? 'top-[4.75rem]' : 'top-2')
        }
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismissToast(t.id)}
            className={
              'anim-slide-down pointer-events-auto w-full max-w-xs rounded-lg border px-3 py-2 text-left text-sm shadow-lg transition-opacity active:scale-[0.98] ' +
              (t.kind === 'error'
                ? 'border-red-500/40 bg-red-600 text-white'
                : t.kind === 'success'
                  ? 'border-emerald-500/40 bg-emerald-600 text-neutral-900'
                  : 'border-white/10 bg-neutral-900 text-neutral-100')
            }
          >
            {t.text}
          </button>
        ))}
      </div>
    </>
  );
}

function InviteCard({
  invite,
  alreadyInRoom,
  onJoin,
  onDismiss,
}: {
  invite: GameInvite;
  alreadyInRoom: boolean;
  onJoin: () => Promise<void>;
  onDismiss: () => void;
}): JSX.Element {
  const [joining, setJoining] = useState(false);
  return (
    <div
      role="alert"
      className="anim-slide-down pointer-events-auto w-full max-w-sm rounded-xl border border-sky-500/40 bg-neutral-900 p-3 shadow-lg ring-1 ring-sky-500/10"
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300"
        >
          <svg width={18} height={18} viewBox="0 0 24 24">
            <path
              d="M4 6 H20 V18 H4 Z M4 7 L12 13 L20 7"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-neutral-100">
            <span className="font-semibold text-neutral-50">
              {invite.fromName}
            </span>{' '}
            te invitó a una partida
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">
            Código{' '}
            <span className="font-mono font-semibold tracking-wider text-neutral-200">
              {invite.code}
            </span>
            {alreadyInRoom ? ' · saldrás de tu sala actual' : ''}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          disabled={joining}
          onClick={() => {
            setJoining(true);
            void onJoin().finally(() => setJoining(false));
          }}
          className="min-h-[44px] flex-1 rounded-lg bg-emerald-500 px-3 text-sm font-bold text-neutral-950 shadow-cta transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {joining ? 'Entrando…' : 'Unirme'}
        </button>
        <button
          type="button"
          disabled={joining}
          onClick={onDismiss}
          className="min-h-[44px] flex-1 rounded-lg border border-white/12 bg-surface-3 px-3 text-sm font-medium text-neutral-200 transition-colors active:bg-white/10 disabled:opacity-60"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

function SyncingScreen(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] text-center">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
        aria-hidden
      />
      <p className="mt-3 text-sm text-neutral-300">Sincronizando…</p>
    </main>
  );
}
