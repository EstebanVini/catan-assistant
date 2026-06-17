import { useStore } from '../store';
import { PHASE_NAMES } from '../lib/spanish';
import { ColorChip } from './ColorChip';
import { PLAYER_HEX } from '../lib/playerColors';
import { totalVictoryPoints } from '../types';

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
  // Mi marcador, siempre a la vista: nombre, color y puntos actuales.
  const myPublic = me ? state.players.find((p) => p.id === me.id) ?? null : null;
  const myPts = myPublic ? totalVictoryPoints(myPublic.victoryPoints) : 0;
  return (
    <header
      className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/80"
      style={{
        boxShadow: `inset 0 -2px 0 0 ${accent}`,
      }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-2.5 md:max-w-none">
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
        <div className="flex min-w-0 flex-shrink items-center gap-1.5">
          {/* Fase A — Insignia discreta del modo Caballeros y Ciudades. Solo
              visible cuando el modo está activo, junto al indicador de fase. */}
          {state.citiesKnights ? (
            <span
              className="flex-shrink-0 rounded-md border border-amber-400/40 bg-amber-500/[0.12] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-200"
              aria-label="Modo Caballeros y Ciudades"
              title="Caballeros y Ciudades"
            >
              <span className="hidden sm:inline">Caballeros y Ciudades</span>
              <span className="sm:hidden" aria-hidden>
                C&amp;C
              </span>
            </span>
          ) : null}
          <div className="flex-shrink-0 rounded-md border border-white/10 bg-surface-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-200">
            {PHASE_NAMES[state.phase]}
          </div>
        </div>
        <div className="flex min-w-0 flex-shrink-0 items-center gap-2">
          <div className="flex min-w-0 flex-col items-end leading-tight">
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-neutral-50">
              <ColorChip color={myPublic?.color ?? null} size={14} />
              <span className="max-w-[96px] truncate">
                {myPublic?.name ?? 'Espectador'}
              </span>
            </span>
            <span
              className={
                'inline-flex items-center gap-1 text-[10px] font-medium ' +
                (connectionStatus === 'connected'
                  ? 'text-neutral-500'
                  : connectionStatus === 'connecting'
                    ? 'text-amber-300'
                    : 'text-red-400')
              }
            >
              {isBankManager ? 'Banco' : isHost ? 'Anfitrión' : 'Jugador'}
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
            </span>
          </div>
          {myPublic ? (
            <div
              className="flex flex-col items-center rounded-lg border border-white/10 bg-surface-2 px-2 py-1 leading-none"
              aria-label={`Llevas ${myPts} puntos`}
            >
              <span className="nums text-base font-bold text-neutral-50">
                {myPts}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                pts
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
