import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { NumericKeypad } from './NumericKeypad';
import { DiceInputCK } from './DiceInputCK';
import { useModalA11y } from '../lib/useModalA11y';
import { DiceStats } from './DiceStats';
import { GiveCardModal } from './GiveCardModal';

// Panel del encargado del banco: teclado 2-12, undo, último número, mini
// histograma. El histograma standalone (con probabilidades) se abre en un
// modal expandido al tappear "Ver estadísticas".
//
// Cambios Fase 2:
//  - `lastRolledNumber` se lee del estado autoritativo (server) en lugar de
//    parsear el log (qa-auditor reportó la fragilidad del regex).
//  - El histograma compact se delega a `<DiceStats variant="compact" />`.
//  - Botón "Ver estadísticas" abre `<DiceStats variant="expanded" />` en un
//    modal accesible.
export function BankPanel(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const rollNumber = useStore((s) => s.rollNumber);
  const undo = useStore((s) => s.undo);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [giveCardOpen, setGiveCardOpen] = useState(false);
  // Tracking de la última tirada para animar la entrada del número grande y
  // pulsar el panel cuando entra una nueva.
  const prevLastNumberRef = useRef<number | null>(null);
  const [panelPulseKey, setPanelPulseKey] = useState(0);
  const [lastNumKey, setLastNumKey] = useState(0);

  const lastNumber = view?.state.lastRolledNumber ?? null;

  useEffect(() => {
    if (lastNumber === null) {
      prevLastNumberRef.current = null;
      return;
    }
    if (prevLastNumberRef.current === null) {
      // baseline: no animar el valor inicial.
      prevLastNumberRef.current = lastNumber;
      return;
    }
    if (lastNumber !== prevLastNumberRef.current) {
      prevLastNumberRef.current = lastNumber;
      setPanelPulseKey((k) => k + 1);
      setLastNumKey((k) => k + 1);
    }
  }, [lastNumber]);

  if (!view || !view.me) return null;
  const { state, me } = view;
  if (state.bankManagerId !== me.id) return null;
  if (state.status !== 'playing') return null;

  const canEnter = state.phase === 'roll';
  const totalRolls = Object.values(state.diceStats).reduce(
    (a, b) => a + (b ?? 0),
    0
  );

  return (
    <section className="mx-3 mt-3 rounded-xl border border-amber-500/30 bg-surface-1 bg-gradient-to-b from-amber-500/[0.09] to-amber-500/[0.03] p-3 shadow-card">
      {/* Wrapper con `key` para reiniciar el pulso del header al llegar nueva
          tirada, sin remontar el panel completo (preservamos state interno). */}
      <div
        key={'bp-header-' + panelPulseKey}
        className={
          'mb-2 flex items-baseline justify-between ' +
          (panelPulseKey > 0 ? 'anim-pulse-scale' : '')
        }
      >
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-200">
          Panel del banco
        </h2>
        {lastNumber !== null ? (
          <span className="text-[11px] text-neutral-300">
            Última tirada{' '}
            <span
              // `key` con lastNumKey reinicia el slide-up cada vez que cambia.
              key={'ln-' + lastNumKey}
              className="anim-slide-up nums ml-0.5 inline-block text-base font-bold text-neutral-50"
            >
              {lastNumber}
            </span>
          </span>
        ) : null}
      </div>
      {/* En Caballeros y Ciudades la tirada son 3 dados (rojo + amarillo +
          evento): se usa `DiceInputCK` en lugar del teclado de un solo número.
          En el modo base se conserva el `NumericKeypad` de siempre. */}
      {state.citiesKnights ? (
        <DiceInputCK />
      ) : (
        <>
          <NumericKeypad onPress={rollNumber} disabled={!canEnter} />
          {!canEnter ? (
            <p className="mt-2 text-[11px] text-neutral-400">
              Solo puedes ingresar el dado en la fase Tirar.
            </p>
          ) : null}
        </>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setConfirmUndo(true)}
          className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium transition-all active:scale-[0.98] active:bg-white/10"
        >
          Deshacer última acción
        </button>
      </div>
      {/* Entrega manual del banco (Fase 3): disponible en cualquier fase,
          incluso fuera del turno. Herramienta de corrección — estilo
          secundario. Siempre pública (notice a toda la mesa). */}
      <button
        type="button"
        onClick={() => setGiveCardOpen(true)}
        className="mt-2 min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium transition-all active:scale-[0.98] active:bg-white/10"
      >
        Entregar carta
      </button>
      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <h3 className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
            Estadísticas de dados
          </h3>
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="rounded-md border border-white/10 bg-surface-3 px-2 py-1 text-[10px] font-medium text-neutral-200 transition-colors active:bg-white/10"
          >
            Ver estadísticas
          </button>
        </div>
        <DiceStats
          stats={state.diceStats}
          variant="compact"
          lastRolledNumber={lastNumber}
        />
      </div>
      {confirmUndo ? (
        <ConfirmUndoDialog
          onCancel={() => setConfirmUndo(false)}
          onConfirm={() => {
            undo();
            setConfirmUndo(false);
          }}
        />
      ) : null}
      {statsOpen ? (
        <ExpandedStatsDialog
          stats={state.diceStats}
          lastNumber={lastNumber}
          total={totalRolls}
          onClose={() => setStatsOpen(false)}
        />
      ) : null}
      {giveCardOpen ? (
        <GiveCardModal onClose={() => setGiveCardOpen(false)} />
      ) : null}
    </section>
  );
}

function ConfirmUndoDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onCancel);
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="undo-confirm-title"
        aria-describedby="undo-confirm-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <h3
          id="undo-confirm-title"
          className="text-base font-semibold tracking-tight text-neutral-50"
        >
          Deshacer última acción
        </h3>
        <p
          id="undo-confirm-desc"
          className="mt-1 text-sm leading-relaxed text-neutral-300"
        >
          Esto deshace la última jugada que cambió manos o banco.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-neutral-950 shadow-cta-amber"
          >
            Sí, deshacer
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpandedStatsDialog({
  stats,
  lastNumber,
  total,
  onClose,
}: {
  stats: Record<number, number>;
  lastNumber: number | null;
  total: number;
  onClose: () => void;
}): JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-title"
        aria-describedby="stats-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-md rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3
            id="stats-title"
            className="text-[19px] font-semibold tracking-tight text-neutral-50"
          >
            Estadísticas de dados
          </h3>
          <span className="nums text-[11px] font-medium text-neutral-400">
            {total} {total === 1 ? 'tirada' : 'tiradas'}
          </span>
        </div>
        <p
          id="stats-desc"
          className="mt-1 text-[12px] leading-snug text-neutral-400"
        >
          Cuántas veces salió cada número durante la partida.
        </p>
        <div className="mt-4 flex justify-center">
          <DiceStats
            stats={stats}
            variant="expanded"
            lastRolledNumber={lastNumber}
            animateOnMount
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors active:bg-white/[0.08]"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
