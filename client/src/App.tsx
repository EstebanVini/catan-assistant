import { useEffect } from 'react';
import { useStore, wireSocket } from './store';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { WinnerScreen } from './components/WinnerScreen';
import { NoticeBanner } from './components/NoticeBanner';
import { getMe } from './api';

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
