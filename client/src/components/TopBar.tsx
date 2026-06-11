import { useStore } from '../store';
import { PHASE_NAMES } from '../lib/spanish';
import { ColorChip } from './ColorChip';
import { PLAYER_HEX } from '../lib/playerColors';

export function TopBar(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const connectionStatus = useStore((s) => s.connectionStatus);
  if (!view) return null;
  const { state, me } = view;
  const activeId = state.turnOrder[state.currentTurnIndex];
  const active = state.players.find((p) => p.id === activeId);
  const isMyTurn = !!me && active?.id === me.id;
  const isBankManager = !!me && state.bankManagerId === me.id;
  const isHost = !!me && state.hostId === me.id;
  const accent = active?.color ? PLAYER_HEX[active.color] : 'rgba(255,255,255,0.12)';
  return (
    <header
      className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/80"
      style={{
        boxShadow: `inset 0 -2px 0 0 ${accent}`,
      }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <ColorChip color={active?.color ?? null} size={22} ring={isMyTurn} />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight text-neutral-50">
              {active?.name ?? '—'}
            </span>
            {isMyTurn ? (
              <span className="mt-0.5 inline-flex w-fit items-center rounded-sm bg-emerald-400/15 px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                Tu turno
              </span>
            ) : (
              <span className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                Turno
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 rounded-md border border-white/10 bg-surface-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-200">
          {PHASE_NAMES[state.phase]}
        </div>
        <div className="flex min-w-0 flex-col items-end leading-tight">
          <span className="text-[11px] font-medium text-neutral-300">
            {isBankManager ? 'Banco' : isHost ? 'Anfitrión' : 'Jugador'}
          </span>
          <span
            className={
              'inline-flex items-center gap-1 text-[10px] font-medium ' +
              (connectionStatus === 'connected'
                ? 'text-emerald-300'
                : connectionStatus === 'connecting'
                  ? 'text-amber-300'
                  : 'text-red-400')
            }
          >
            <span
              className={
                'inline-block h-1.5 w-1.5 rounded-full ' +
                (connectionStatus === 'connected'
                  ? 'bg-emerald-400'
                  : connectionStatus === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-red-500')
              }
              aria-hidden
            />
            {connectionStatus === 'connected'
              ? 'Conectado'
              : connectionStatus === 'connecting'
                ? 'Conectando'
                : 'Sin conexión'}
          </span>
        </div>
      </div>
    </header>
  );
}
