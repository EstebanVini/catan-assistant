import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { RESOURCES, Resource } from '../types';
import { RESOURCE_NAMES } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Modal de Monopolio (brief Fase 2 §1.2).
// Selección obligatoria + confirmación: tap accidental podría definir la
// partida, por eso no se envía hasta confirmar.
//
// Cierra automáticamente si el estado pasa a `discard` (caso extremo §8.11):
// el descarte tiene prioridad.

interface Props {
  onClose: () => void;
}

export function MonopolyPickerModal({ onClose }: Props): JSX.Element {
  const view = useStore((s) => s.view);
  const playDevCard = useStore((s) => s.playDevCard);
  const pushToast = useStore((s) => s.pushToast);
  const phase = view?.state.phase ?? null;

  const [selected, setSelected] = useState<Resource | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  // Cierre automático si entramos a fase de descarte (otro jugador tiró 7
  // en paralelo). El brief §8.11 marca el descarte como prioritario.
  useEffect(() => {
    if (phase === 'discard') {
      pushToast('info', 'Se canceló el Monopolio. Descarta primero.');
      onClose();
    }
  }, [phase, onClose, pushToast]);

  function handleConfirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    playDevCard('monopoly', { resource: selected });
    // El cierre lo dispara el state:update siguiente o el onClose padre;
    // hacemos un cierre optimista para no dejar el modal trabado si el
    // server responde con error (en cuyo caso veremos el toast y se cerrará).
    window.setTimeout(() => onClose(), 60);
  }

  const confirmLabel = selected
    ? `Confirmar Monopolio sobre ${RESOURCE_NAMES[selected]}`
    : 'Elige un recurso';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="monopoly-title"
        aria-describedby="monopoly-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <h2
          id="monopoly-title"
          className="text-base font-semibold tracking-tight text-neutral-50"
        >
          Monopolio
        </h2>
        <p
          id="monopoly-desc"
          className="mt-1 text-xs leading-relaxed text-neutral-400"
        >
          Elige un recurso. Los demás te entregan todas sus cartas de ese
          recurso.
        </p>

        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {RESOURCES.map((r) => {
            const isSel = selected === r;
            const dim = selected !== null && !isSel;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={isSel}
                aria-label={`Elegir ${RESOURCE_NAMES[r]}`}
                onClick={() => setSelected(r)}
                disabled={submitting}
                className={
                  'group flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 transition-all active:scale-[0.97] ' +
                  (isSel
                    ? 'border-emerald-400 bg-emerald-500/[0.08] shadow-soft'
                    : dim
                      ? 'border-white/[0.06] bg-white/[0.02] opacity-60'
                      : 'border-white/12 bg-white/[0.04] active:bg-white/[0.08]')
                }
              >
                <ResourceIcon resource={r} size={32} />
                <span
                  className={
                    'text-[11px] font-semibold tracking-tight ' +
                    (isSel ? 'text-emerald-100' : 'text-neutral-200')
                  }
                >
                  {RESOURCE_NAMES[r]}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selected || submitting}
          className={
            'nums mt-4 min-h-[56px] w-full rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.99] ' +
            (selected && !submitting
              ? 'bg-amber-400 text-neutral-950 shadow-cta-amber active:bg-amber-300'
              : 'cursor-not-allowed border border-white/10 bg-white/[0.04] text-neutral-500')
          }
        >
          {submitting ? 'Aplicando…' : confirmLabel}
        </button>
        {selected ? (
          <p className="mt-1 text-center text-[11px] text-neutral-400">
            Esta acción no se puede deshacer.
          </p>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="mt-3 min-h-[44px] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-neutral-200 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
