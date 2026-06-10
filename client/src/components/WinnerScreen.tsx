import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { PublicPlayer } from '../types';
import { ColorChip } from './ColorChip';
import { BadgeIcon } from './BadgeIcon';
import { DiceStats } from './DiceStats';
import { playerHex } from '../lib/playerColors';
import { safeVibrate } from '../lib/motion';

// Overlay full-screen de fin de partida (brief Fase 2 §3).
// Sobrio, no festivo: color del ganador como acento + desglose claro +
// 3 métricas + CTA "Volver al inicio".
//
// Privacidad: las VP ocultas del ganador llegan reveladas desde el server
// (`buildView` con `revealHidden = winnerId === player.id`). Las de los
// perdedores siguen en 0 — no se revelan.

export function WinnerScreen(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const forgetSession = useStore((s) => s.forgetSession);
  const vibratedRef = useRef(false);

  // Vibración corta sólo al dueño del dispositivo si él ganó. Una sola vez.
  useEffect(() => {
    if (!view || !view.me) return;
    if (view.state.status !== 'ended') return;
    if (view.state.winnerId !== view.me.id) return;
    if (vibratedRef.current) return;
    vibratedRef.current = true;
    safeVibrate(150);
  }, [view]);

  if (!view) return null;
  const { state, me } = view;
  if (state.status !== 'ended') return null;
  const winner = state.players.find((p) => p.id === state.winnerId);
  if (!winner) {
    // Estado degradado: ganador no encontrado. Mostrar mínimo viable.
    return (
      <ErrorPartial onBack={forgetSession} />
    );
  }

  const iWon = !!me && me.id === winner.id;
  const myTotal = me
    ? computeTotal(state.players.find((p) => p.id === me.id) ?? winner)
    : null;
  const accent = playerHex(winner.color);

  // Desglose del ganador.
  const vp = winner.victoryPoints;
  const settlementsPts = vp.settlements;
  const citiesPts = vp.cities * 2;
  const longestRoadPts = vp.longestRoad ? 2 : 0;
  const largestArmyPts = vp.largestArmy ? 2 : 0;
  const hiddenPts = vp.hiddenVP;
  const total =
    settlementsPts + citiesPts + longestRoadPts + largestArmyPts + hiddenPts;

  // MVP de robos: jugador con más robos exitosos. Si nadie robó, ocultar.
  const stealsEntries = Object.entries(state.stealsByPlayer ?? {}) as [
    string,
    number,
  ][];
  const topSteal = stealsEntries.reduce<{ id: string; n: number } | null>(
    (acc, [id, n]) => (n > (acc?.n ?? 0) ? { id, n } : acc),
    null
  );
  const topStealPlayer =
    topSteal !== null
      ? state.players.find((p) => p.id === topSteal.id) ?? null
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="winner-title"
      className="anim-fade-in fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-neutral-950"
    >
      {/* Banda superior con color del ganador (~25% de la pantalla) */}
      <div
        className="anim-scale-in relative px-5 pt-8 pb-6"
        style={{
          background: `linear-gradient(180deg, ${accent} 0%, ${accent}cc 35%, rgba(15,17,21,0) 100%)`,
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-950/85">
          Fin de la partida
        </p>
        <div className="mt-2 flex items-center gap-3">
          <ColorChip color={winner.color} size={36} />
          <h1
            id="winner-title"
            className="text-[40px] font-bold leading-none tracking-tight text-neutral-950"
          >
            {iWon ? `Ganaste, ${winner.name}` : `Ganó ${winner.name}`}
          </h1>
        </div>
        <p className="nums mt-2 text-sm font-semibold text-neutral-950/85">
          {total} {total === 1 ? 'punto' : 'puntos'} · {state.turnsPlayed}{' '}
          {state.turnsPlayed === 1 ? 'turno' : 'turnos'}
        </p>
        {me ? (
          <p className="mt-2 text-[12px] font-medium text-neutral-950/75">
            {iWon
              ? 'Bien jugado.'
              : myTotal !== null
                ? `Mejor suerte la próxima. Quedaste con ${myTotal} ${
                    myTotal === 1 ? 'punto' : 'puntos'
                  }.`
                : 'Mejor suerte la próxima.'}
          </p>
        ) : null}
      </div>

      {/* Cuerpo scrolleable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Bloque 2 — Desglose */}
        <section
          className="anim-slide-up rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-card"
          style={{ animationDelay: '120ms' }}
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
            Desglose
          </h2>
          <ul className="mt-2 divide-y divide-white/5">
            <BreakdownRow
              icon={<DotIcon color="#86efac" />}
              label="Poblados"
              detail={`${vp.settlements} (${settlementsPts} ${settlementsPts === 1 ? 'pt' : 'pts'})`}
              value={settlementsPts}
            />
            <BreakdownRow
              icon={<DotIcon color="#fcd34d" />}
              label="Ciudades"
              detail={`${vp.cities} (${vp.cities} × 2 = ${citiesPts} ${citiesPts === 1 ? 'pt' : 'pts'})`}
              value={citiesPts}
            />
            {vp.longestRoad ? (
              <BreakdownRow
                icon={<BadgeIcon variant="road" size={14} />}
                label="Camino más largo"
                detail="2 pts"
                value={longestRoadPts}
              />
            ) : null}
            {vp.largestArmy ? (
              <BreakdownRow
                icon={<BadgeIcon variant="army" size={14} />}
                label="Ejército más grande"
                detail="2 pts"
                value={largestArmyPts}
              />
            ) : null}
            {hiddenPts > 0 ? (
              <BreakdownRow
                icon={<DotIcon color="#fbbf24" />}
                label="Cartas de victoria ocultas"
                detail={`${hiddenPts} ${hiddenPts === 1 ? 'pt' : 'pts'}`}
                value={hiddenPts}
              />
            ) : null}
            <li className="flex items-center justify-between py-2">
              <span className="text-sm font-bold uppercase tracking-wide text-neutral-100">
                Total
              </span>
              <span
                className="nums text-2xl font-bold tracking-tight"
                style={{ color: accent }}
              >
                {total}
              </span>
            </li>
          </ul>
        </section>

        {/* Bloque 3 — Resumen */}
        <section
          className="anim-slide-up mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-card"
          style={{ animationDelay: '220ms' }}
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
            Resumen de la partida
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <MetricCard
              label="Turnos jugados"
              value={state.turnsPlayed}
            />
            {topStealPlayer ? (
              <MetricCard
                label="Más robos"
                value={topStealPlayer.name}
                sub={`${topSteal!.n} ${topSteal!.n === 1 ? 'robo' : 'robos'}`}
              />
            ) : (
              <MetricCard label="Más robos" value="—" sub="Nadie robó este partido" />
            )}
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
              Estadísticas de dados
            </p>
            <p className="mb-2 mt-0.5 text-[10px] text-neutral-500">
              Cuántas veces salió cada número durante la partida.
            </p>
            <DiceStats
              stats={state.diceStats}
              variant="expanded"
              lastRolledNumber={state.lastRolledNumber}
              animateOnMount
            />
          </div>
        </section>

        {/* Aire al final para que el CTA sticky no tape la última fila */}
        <div className="h-24" aria-hidden />
      </div>

      {/* CTA sticky */}
      <div className="sticky bottom-0 border-t border-white/10 bg-neutral-950/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
        <button
          type="button"
          onClick={() => forgetSession()}
          className="min-h-[56px] w-full rounded-xl bg-emerald-500 px-3 py-3 text-base font-bold tracking-tight text-neutral-950 shadow-cta transition-all active:scale-[0.99] active:bg-emerald-400"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

function computeTotal(p: PublicPlayer): number {
  return (
    p.victoryPoints.settlements +
    p.victoryPoints.cities * 2 +
    (p.victoryPoints.longestRoad ? 2 : 0) +
    (p.victoryPoints.largestArmy ? 2 : 0) +
    p.victoryPoints.hiddenVP
  );
}

function BreakdownRow({
  icon,
  label,
  detail,
  value,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  value: number;
  muted?: boolean;
}): JSX.Element {
  return (
    <li className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
          {icon}
        </span>
        <div className="flex flex-col leading-tight">
          <span
            className={
              'text-sm font-semibold ' +
              (muted ? 'text-neutral-400' : 'text-neutral-100')
            }
          >
            {label}
          </span>
          <span className="text-[10px] text-neutral-500">{detail}</span>
        </div>
      </div>
      <span
        className={
          'nums text-base font-bold tracking-tight ' +
          (muted ? 'text-neutral-500' : 'text-neutral-50')
        }
      >
        {value}
      </span>
    </li>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
        {label}
      </p>
      <p className="nums mt-1 text-lg font-bold tracking-tight text-neutral-50">
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[11px] text-neutral-400">{sub}</p>
      ) : null}
    </div>
  );
}

function DotIcon({ color }: { color: string }): JSX.Element {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function ErrorPartial({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col items-center justify-center bg-neutral-950 px-4 text-center"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
        Fin de la partida
      </p>
      <p className="mt-2 text-sm text-neutral-200">
        No pudimos cargar el detalle del ganador. Vuelve al inicio para empezar
        otra partida.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 min-h-[56px] w-full max-w-xs rounded-xl bg-emerald-500 px-3 py-3 text-base font-bold text-neutral-950 shadow-cta"
      >
        Volver al inicio
      </button>
    </div>
  );
}
