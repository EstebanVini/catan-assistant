import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { BUILD_COSTS, BuildType, Resource, totalVictoryPoints } from '../types';
import { buildTypeLabel, RESOURCE_NAMES_LOWER, joinList } from '../lib/spanish';
import { BuildCostBadge } from './BuildCostBadge';
import { TradeModal } from './TradeModal';

interface Props {
  onPlayDev: () => void;
}

export function ActionGrid({ onPlayDev }: Props): JSX.Element | null {
  const view = useStore((s) => s.view);
  const build = useStore((s) => s.build);
  const endTurn = useStore((s) => s.endTurn);
  const specialBuildDone = useStore((s) => s.specialBuildDone);
  const declareWin = useStore((s) => s.declareWin);
  const pushToast = useStore((s) => s.pushToast);
  const [tradeOpen, setTradeOpen] = useState(false);
  // Detecta transición "antes no podía declarar → ahora sí" para añadir un
  // pulso único al CTA (encima del `anim-slide-down` de entrada). El flag
  // se resetea cuando el CTA deja de ser elegible, así un nuevo subir-de-VP
  // en otro turno vuelve a disparar el efecto.
  const wasDeclarableRef = useRef(false);
  const [declarePulseKey, setDeclarePulseKey] = useState(0);

  // Cálculos derivados (necesarios para el efecto; se replican abajo cuando
  // ya sabemos que `view.me` existe). Mantenemos la lógica simple para no
  // duplicar lecturas costosas.
  const canDeclareForEffect = (() => {
    if (!view || !view.me) return false;
    const s = view.state;
    const meId = view.me.id;
    const activeId = s.turnOrder[s.currentTurnIndex];
    if (activeId !== meId || s.phase !== 'main' || s.status !== 'playing')
      return false;
    const mp = s.players.find((p) => p.id === meId);
    if (!mp) return false;
    return totalVictoryPoints(mp.victoryPoints) >= 10;
  })();

  useEffect(() => {
    if (canDeclareForEffect && !wasDeclarableRef.current) {
      wasDeclarableRef.current = true;
      // Nuevo `key` para forzar re-mount del CTA y disparar pulse-scale.
      setDeclarePulseKey((k) => k + 1);
    } else if (!canDeclareForEffect) {
      wasDeclarableRef.current = false;
    }
  }, [canDeclareForEffect]);

  if (!view || !view.me) return null;
  const { state, me } = view;

  const activeId = state.turnOrder[state.currentTurnIndex];
  const active = state.players.find((p) => p.id === activeId);
  const isMyTurn = activeId === me.id;
  const inMain = state.phase === 'main' && isMyTurn;
  const inSpecial =
    state.phase === 'specialBuild' && state.specialBuildQueue[0] === me.id;
  const myPublic = state.players.find((p) => p.id === me.id);
  const myVP = myPublic ? totalVictoryPoints(myPublic.victoryPoints) : 0;
  const canDeclare = inMain && myVP >= 10;

  const canActWhy = (): string | null => {
    if (state.status !== 'playing') return 'La partida aún no empieza.';
    if (state.phase === 'discard') return 'Hay que descartar primero.';
    if (state.phase === 'robber') return 'Hay que mover el ladrón primero.';
    if (state.phase === 'roll') return 'Espera a que el banco tire el dado.';
    if (!inMain && !inSpecial) {
      if (state.phase === 'main' && !isMyTurn) return 'No es tu turno.';
      if (state.phase === 'specialBuild')
        return 'No es tu turno en construcción especial.';
    }
    return null;
  };

  const baseDisabled = canActWhy();
  const allowTrades = inMain; // En specialBuild no se puede intercambiar.
  const allowDevPlay = inMain; // En specialBuild no se puede jugar dev.

  function canAfford(type: BuildType): boolean {
    if (!me) return false;
    const cost = BUILD_COSTS[type];
    return (Object.entries(cost) as [Resource, number][]).every(
      ([r, n]) => me.hand[r] >= n
    );
  }

  function missingDetail(type: BuildType): string {
    if (!me) return 'recursos';
    const cost = BUILD_COSTS[type];
    const parts: string[] = [];
    for (const [r, n] of Object.entries(cost) as [Resource, number][]) {
      const have = me.hand[r];
      if (have < n) parts.push(`${n - have} ${RESOURCE_NAMES_LOWER[r]}`);
    }
    return joinList(parts);
  }

  function buildReason(type: BuildType): string | null {
    if (baseDisabled) return baseDisabled;
    if (!canAfford(type)) return `Te falta: ${missingDetail(type)}.`;
    return null;
  }

  const tradeReason = !allowTrades
    ? state.phase === 'specialBuild'
      ? 'No puedes intercambiar en construcción especial.'
      : (baseDisabled ?? 'No es tu turno.')
    : null;
  const devReason = !allowDevPlay
    ? state.phase === 'specialBuild'
      ? 'No puedes jugar cartas en construcción especial.'
      : (baseDisabled ?? 'No es tu turno.')
    : null;

  return (
    <section className="mx-3 mt-3">
      {!inMain && !inSpecial ? (
        <div className="mb-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">
          {state.phase === 'main' && active
            ? `No es tu turno · ${active.name}`
            : 'No es tu turno todavía'}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {(['road', 'settlement', 'city', 'devcard'] as BuildType[]).map((t) => {
          const reason = buildReason(t);
          const isDisabled = reason !== null;
          return (
            <button
              key={t}
              type="button"
              disabled={isDisabled}
              onClick={() => build(t)}
              title={reason ?? undefined}
              className={
                'group min-h-[88px] rounded-xl border p-3 text-left transition-all ' +
                (isDisabled
                  ? 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-70'
                  : 'border-white/12 bg-gradient-to-b from-white/[0.07] to-white/[0.03] shadow-soft active:scale-[0.98] active:bg-white/[0.09]')
              }
            >
              <div
                className={
                  'text-sm font-semibold tracking-tight ' +
                  (isDisabled ? 'text-neutral-400' : 'text-neutral-50')
                }
              >
                {buildTypeLabel(t)}
              </div>
              <div className="mt-2">
                <BuildCostBadge type={t} />
              </div>
              {reason ? (
                <div className="mt-1.5 text-[10px] leading-tight text-neutral-500">
                  {reason}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <DisabledAwareButton
          label="Intercambiar"
          disabled={!allowTrades}
          reason={tradeReason}
          onClick={() => setTradeOpen(true)}
          onDisabledClick={() => {
            if (tradeReason) pushToast('info', tradeReason);
          }}
        />
        <DisabledAwareButton
          label="Jugar carta de desarrollo"
          disabled={!allowDevPlay}
          reason={devReason}
          onClick={onPlayDev}
          onDisabledClick={() => {
            if (devReason) pushToast('info', devReason);
          }}
        />
      </div>
      {/* En construcción especial, si no puedo pagar nada, recordatorio
          breve para que sepa que "Listo, paso" es la salida natural. */}
      {inSpecial &&
      !canAfford('road') &&
      !canAfford('settlement') &&
      !canAfford('city') &&
      !canAfford('devcard') ? (
        <p className="mt-2 text-center text-[11px] text-neutral-400">
          No alcanza para construir nada. Pulsa "Listo, paso".
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        {/* CTA "Declarar victoria" sobre "Terminar turno" cuando aplica
            (brief Fase 2 §2.4). Se añade, no reemplaza. */}
        {canDeclare ? (
          // `key` ligado al `declarePulseKey` para que el primer mount tras
          // pasar a declarable reinicie las animaciones. Combinamos
          // `anim-slide-down` (entrada) con `anim-pulse-scale` (acuse único)
          // — ambos se cancelan correctamente en reduced-motion.
          <button
            key={`declare-${declarePulseKey}`}
            type="button"
            onClick={() => declareWin()}
            className="nums anim-slide-down anim-pulse-scale min-h-[60px] w-full rounded-xl bg-amber-400 px-3 py-3 text-[17px] font-bold tracking-tight text-neutral-950 shadow-cta-amber ring-1 ring-amber-300/60 transition-all active:scale-[0.99] active:bg-amber-300"
          >
            Declarar victoria con {myVP} puntos
          </button>
        ) : null}
        {inSpecial ? (
          <button
            type="button"
            onClick={specialBuildDone}
            className="min-h-[56px] w-full rounded-xl bg-emerald-500 px-3 py-2 text-base font-bold tracking-tight text-neutral-950 shadow-cta transition-all active:scale-[0.99] active:bg-emerald-400"
          >
            Listo, paso
          </button>
        ) : (
          <button
            type="button"
            disabled={!inMain}
            title={inMain ? undefined : (baseDisabled ?? 'No es tu turno.')}
            onClick={endTurn}
            className={
              'min-h-[56px] w-full rounded-xl px-3 py-2 text-base font-bold tracking-tight transition-all ' +
              (inMain
                ? 'bg-emerald-500 text-neutral-950 shadow-cta active:scale-[0.99] active:bg-emerald-400'
                : 'cursor-not-allowed border border-white/10 bg-white/[0.04] text-neutral-500')
            }
          >
            Terminar turno
          </button>
        )}
      </div>
      {tradeOpen ? <TradeModal onClose={() => setTradeOpen(false)} /> : null}
    </section>
  );
}

// Botón que muestra toast al tappear cuando está deshabilitado. En móvil el
// atributo `title` no es accesible sin hover; el toast cubre ese gap.
function DisabledAwareButton({
  label,
  disabled,
  reason,
  onClick,
  onDisabledClick,
}: {
  label: string;
  disabled: boolean;
  reason: string | null;
  onClick: () => void;
  onDisabledClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      // No usamos `disabled` para poder capturar el tap y dar feedback. En
      // su lugar emulamos disabled con `aria-disabled` + estilos y bloqueo
      // del onClick útil.
      aria-disabled={disabled}
      title={reason ?? undefined}
      onClick={() => (disabled ? onDisabledClick() : onClick())}
      className={
        'min-h-[52px] rounded-xl border px-3 py-2 text-sm font-medium transition-all ' +
        (!disabled
          ? 'border-white/12 bg-white/[0.05] text-neutral-100 active:scale-[0.98] active:bg-white/[0.09]'
          : 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-neutral-500')
      }
    >
      {label}
    </button>
  );
}
