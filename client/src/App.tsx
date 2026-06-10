import { useEffect } from 'react';
import { useStore, wireSocket } from './store';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { WinnerScreen } from './components/WinnerScreen';

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
  const dismissToast = useStore((s) => s.dismissToast);
  const forgetSession = useStore((s) => s.forgetSession);
  const pushToast = useStore((s) => s.pushToast);

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

  // Determinar pantalla.
  let screen: JSX.Element | null;
  if (session && !initialSyncReceived && !reconnectFailed) {
    // Espera silenciosa de la primera actualización tras reconectar.
    screen = <SyncingScreen />;
  } else if (!view || !view.me) {
    screen = <HomeScreen />;
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
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-2 z-[100] flex flex-col items-center gap-1 px-3"
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

