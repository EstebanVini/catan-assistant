import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useModalA11y } from '../lib/useModalA11y';

// Modal de Construcción de caminos (brief Fase 2 §1.4).
// El más simple: sólo confirmación. El tablero es físico; la app sólo
// registra que se jugó la carta para que el server descuente la dev card y
// loguee el evento. No descuenta recursos.

interface Props {
  onClose: () => void;
}

export function RoadBuildingConfirmModal({ onClose }: Props): JSX.Element {
  const view = useStore((s) => s.view);
  const playDevCard = useStore((s) => s.playDevCard);
  const pushToast = useStore((s) => s.pushToast);
  const phase = view?.state.phase ?? null;
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  useEffect(() => {
    if (phase === 'discard') {
      pushToast('info', 'Se canceló Construcción de caminos. Descarta primero.');
      onClose();
    }
  }, [phase, onClose, pushToast]);

  function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    playDevCard('roadBuilding');
    window.setTimeout(() => onClose(), 60);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rb-title"
        aria-describedby="rb-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <h2
          id="rb-title"
          className="text-[17px] font-semibold tracking-tight text-neutral-50"
        >
          Construcción de caminos
        </h2>
        <p
          id="rb-desc"
          className="mt-2 text-sm leading-relaxed text-neutral-300"
        >
          Coloca 2 caminos en el tablero físico sin pagar recursos. Esta carta
          solo se confirma aquí.
        </p>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className={
            // Tap feedback más explícito: `active:scale-[0.97]` deja claro que
            // el toque registró. Touch target ≥56 px cumple Apple HIG.
            'mt-4 min-h-[56px] w-full rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.97] ' +
            (submitting
              ? 'cursor-not-allowed border border-white/10 bg-white/[0.04] text-neutral-500'
              : 'bg-emerald-500 text-neutral-950 shadow-cta active:bg-emerald-400')
          }
        >
          {submitting ? 'Registrando…' : 'Listo, coloqué los caminos'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="mt-2 min-h-[44px] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-neutral-200 transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
