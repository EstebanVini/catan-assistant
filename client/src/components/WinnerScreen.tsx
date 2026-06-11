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

  // Vibración corta al montar: 120 ms si soy ganador, 60 ms si no
  // (acuse sutil de "se acabó"). Una sola vez por sesión de pantalla.
  useEffect(() => {
    if (!view || !view.me) return;
    if (view.state.status !== 'ended') return;
    if (vibratedRef.current) return;
    vibratedRef.current = true;
    safeVibrate(view.state.winnerId === view.me.id ? 120 : 60);
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
      {/* Accent bar superior. El color del ganador como un trazo fino que
          enmarca la pantalla — no toma el fondo. Pantalla sobria. */}
      <div
        aria-hidden
        className="h-1 w-full flex-shrink-0"
        style={{ backgroundColor: accent }}
      />

      {/* Hero: eyebrow + nombre display + subtítulo. Fondo neutro. El acento
          aparece sólo en la banda lateral del bloque "winner" debajo.
          Stagger inicial de hero (0 ms) sobre desglose (120 ms) y métricas
          (200 ms) — el motion engineer arma una llegada en cascada. */}
      <header className="anim-slide-up px-5 pt-7 pb-5 md:mx-auto md:w-full md:max-w-3xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-500">
          Fin de la partida
        </p>
        <div className="mt-3 flex items-center gap-3">
          {/* Barra lateral del color del ganador: scale-y desde 0 a 1 con
              origen arriba, 360 ms. Solo `transform`, sin afectar layout. */}
          <div
            aria-hidden
            className="anim-scale-y-top h-12 w-1 flex-shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <div className="flex flex-1 items-center gap-2.5">
            <ColorChip color={winner.color} size={28} />
            <h1
              id="winner-title"
              className="title-gold font-display text-[34px] font-bold leading-[1.05] tracking-tight"
            >
              {iWon ? `Ganaste, ${winner.name}` : `Ganó ${winner.name}`}
            </h1>
          </div>
        </div>
        <p className="nums mt-3 text-sm font-medium text-neutral-300">
          <span className="font-bold text-neutral-100">{total}</span>{' '}
          {total === 1 ? 'punto' : 'puntos'} ·{' '}
          <span className="font-bold text-neutral-100">{state.turnsPlayed}</span>{' '}
          {state.turnsPlayed === 1 ? 'turno' : 'turnos'}
        </p>
        {me ? (
          <p className="mt-1 text-[12px] font-medium text-neutral-400">
            {iWon
              ? 'Bien jugado.'
              : myTotal !== null
                ? `Quedaste con ${myTotal} ${
                    myTotal === 1 ? 'punto' : 'puntos'
                  }.`
                : 'Mejor suerte la próxima.'}
          </p>
        ) : null}
      </header>

      {/* Cuerpo scrolleable. El wrapper interno limita el ancho en md+ y en
          lg organiza desglose (izquierda) vs. métricas + dados (derecha);
          en móvil es un <div> neutro que no cambia el flujo. */}
      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-4">
        <div className="md:mx-auto md:max-w-3xl lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-3">
        {/* Bloque 2 — Desglose. Tabular-nums grandes a la derecha, total
            destacado con el color del ganador como acento. */}
        <section
          className="anim-slide-up rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card"
          style={{ animationDelay: '120ms' }}
        >
          <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            Desglose de puntos
          </h2>
          <ul className="mt-2 divide-y divide-white/[0.06]">
            <BreakdownRow
              icon={<DotIcon color="#86efac" />}
              label="Poblados"
              detail={`${vp.settlements} × 1`}
              value={settlementsPts}
            />
            <BreakdownRow
              icon={<DotIcon color="#fcd34d" />}
              label="Ciudades"
              detail={`${vp.cities} × 2`}
              value={citiesPts}
            />
            {vp.longestRoad ? (
              <BreakdownRow
                icon={<BadgeIcon variant="road" size={14} />}
                label="Camino más largo"
                detail="Insignia"
                value={longestRoadPts}
              />
            ) : null}
            {vp.largestArmy ? (
              <BreakdownRow
                icon={<BadgeIcon variant="army" size={14} />}
                label="Ejército más grande"
                detail="Insignia"
                value={largestArmyPts}
              />
            ) : null}
            {hiddenPts > 0 ? (
              <BreakdownRow
                icon={<DotIcon color="#fbbf24" />}
                label="Puntos de victoria ocultos"
                detail="Revelados al final"
                value={hiddenPts}
              />
            ) : null}
            <li className="mt-1 flex items-center justify-between pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Total
              </span>
              {/* Total grande con `anim-pulse-scale` único al montar para
                  marcar el cierre numérico. transform-origin centro. */}
              <span
                className="nums anim-pulse-scale inline-block text-[32px] font-bold leading-none tracking-tight"
                style={{ color: accent, transformOrigin: 'center' }}
              >
                {total}
              </span>
            </li>
          </ul>
        </section>

        {/* Bloque 3 — Resumen. Tres mini cards uniformes (turnos / robos /
            tiradas). El histograma queda dentro de su propia card debajo. */}
        <div className="min-w-0">
        <section
          className="anim-slide-up mt-3 grid grid-cols-3 gap-2 lg:mt-0"
          style={{ animationDelay: '200ms' }}
        >
          <MetricCard label="Turnos" value={state.turnsPlayed} />
          {topStealPlayer ? (
            <MetricCard
              label="Más robos"
              value={topStealPlayer.name}
              sub={`${topSteal!.n} ${topSteal!.n === 1 ? 'robo' : 'robos'}`}
            />
          ) : (
            <MetricCard label="Más robos" value="—" sub="Nadie robó" />
          )}
          <MetricCard
            label="Tiradas"
            value={Object.values(state.diceStats).reduce(
              (a, b) => a + (b ?? 0),
              0
            )}
          />
        </section>

        <section
          className="anim-slide-up mt-3 rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card"
          style={{ animationDelay: '260ms' }}
        >
          <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            Estadísticas de dados
          </h2>
          <p className="mb-3 mt-0.5 text-[10px] leading-snug text-neutral-500">
            Cuántas veces salió cada número durante la partida.
          </p>
          <DiceStats
            stats={state.diceStats}
            variant="expanded"
            lastRolledNumber={state.lastRolledNumber}
            animateOnMount
          />
        </section>
        </div>
        </div>

        {/* Aire al final para que el CTA sticky no tape la última fila */}
        <div className="h-24" aria-hidden />
      </div>

      {/* CTA sticky. Entrada con `anim-fade-in` retrasada 320 ms para
          que aterrice después del desglose y las métricas. */}
      <div
        className="anim-fade-in sticky bottom-0 border-t border-white/10 bg-neutral-950/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur md:flex md:justify-center"
        style={{ animationDelay: '320ms' }}
      >
        <button
          type="button"
          onClick={() => forgetSession()}
          className="min-h-[56px] w-full rounded-xl bg-emerald-500 px-3 py-3 text-base font-bold tracking-tight text-neutral-950 shadow-cta transition-all active:scale-[0.99] active:bg-emerald-400 md:max-w-md"
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
    <li className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
          {icon}
        </span>
        <div className="flex flex-col leading-tight">
          <span
            className={
              'text-sm font-semibold tracking-tight ' +
              (muted ? 'text-neutral-400' : 'text-neutral-100')
            }
          >
            {label}
          </span>
          <span className="mt-0.5 text-[10px] text-neutral-500">{detail}</span>
        </div>
      </div>
      <span
        className={
          'nums text-lg font-bold tracking-tight ' +
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
    <div className="rounded-xl border border-white/10 bg-surface-1 p-3 shadow-soft">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>
      <p
        className="nums mt-1.5 truncate text-[20px] font-bold leading-none tracking-tight text-neutral-50"
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-1 truncate text-[10px] text-neutral-400">{sub}</p>
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
