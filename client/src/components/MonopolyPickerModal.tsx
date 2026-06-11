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
  // `confirmed` se enciende al tappear "Confirmar" para disparar un breve
  // glow / pulse sobre el chip elegido antes de cerrar el modal. No depende
  // de la respuesta del server: es feedback inmediato del tap.
  const [confirmed, setConfirmed] = useState(false);
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
    setConfirmed(true);
    playDevCard('monopoly', { resource: selected });
    // El cierre lo dispara el state:update siguiente o el onClose padre;
    // hacemos un cierre optimista pero dejamos ~200 ms para que el pulso
    // del chip seleccionado sea visible antes de desmontar el modal.
    window.setTimeout(() => onClose(), 220);
  }

  const confirmLabel = selected
    ? `Confirmar Monopolio sobre ${RESOURCE_NAMES[selected]}`
    : 'Elige un recurso';

  // Color del recurso para el ring/borde de seleccionado: comunica de un
  // vistazo qué fue tappeado sin abandonar la identidad cromática.
  const resourceTone: Record<typeof RESOURCES[number], { ring: string; bg: string; label: string }> = {
    brick:  { ring: 'border-resource-brick',  bg: 'bg-resource-brick/[0.10]',  label: 'text-resource-brick' },
    lumber: { ring: 'border-resource-lumber', bg: 'bg-resource-lumber/[0.12]', label: 'text-resource-lumber' },
    wool:   { ring: 'border-resource-wool',   bg: 'bg-resource-wool/[0.10]',   label: 'text-resource-wool' },
    grain:  { ring: 'border-resource-grain',  bg: 'bg-resource-grain/[0.12]',  label: 'text-resource-grain' },
    ore:    { ring: 'border-resource-ore',    bg: 'bg-resource-ore/[0.18]',    label: 'text-neutral-100' },
  };

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
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <h2
          id="monopoly-title"
          className="text-[17px] font-semibold tracking-tight text-neutral-50"
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

        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {RESOURCES.map((r) => {
            const isSel = selected === r;
            const dim = selected !== null && !isSel;
            const tone = resourceTone[r];
            return (
              <button
                key={r}
                type="button"
                aria-pressed={isSel}
                aria-label={`Elegir ${RESOURCE_NAMES[r]}`}
                onClick={() => setSelected(r)}
                disabled={submitting}
                className={
                  // `transition-colors duration-180` para que el cambio de
                  // border + bg al seleccionar/atenuar sea suave (no abrupto).
                  // `active:scale-[0.97]` para tap feedback (touch target
                  // 96 px ≫ 44 px). En el chip elegido al confirmar se
                  // dispara `anim-pulse-scale` como acuse visual.
                  'group flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-1 py-2.5 transition-colors duration-[180ms] ease-out active:scale-[0.97] ' +
                  (isSel
                    ? `${tone.ring} ${tone.bg} shadow-card`
                    : dim
                      ? 'border-white/[0.06] bg-white/[0.02] opacity-55'
                      : 'border-white/[0.10] bg-white/[0.035] active:bg-white/[0.08]') +
                  (isSel && confirmed ? ' anim-pulse-scale' : '')
                }
              >
                <ResourceIcon resource={r} size={34} />
                <span
                  className={
                    'text-[11px] font-semibold tracking-tight ' +
                    (isSel ? tone.label : 'text-neutral-200')
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
            // Tap feedback explícito (97 % scale): la acción es definitiva,
            // queremos que el botón "responda" claramente al toque.
            'nums mt-4 min-h-[56px] w-full rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.97] ' +
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
          className="mt-3 min-h-[44px] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-neutral-200 transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
