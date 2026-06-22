import { useRef, useState } from 'react';
import { RESOURCES, Resource } from '../types';
import { RESOURCE_NAMES } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Picker de RECURSO para la carta de progreso "Monopolio de Recurso"
// (resourceMonopoly, §2.10). Mismo patrón visual que MonopolyPickerModal (la
// carta de desarrollo Monopolio), pero genérico: en vez de cablear
// `playDevCard('monopoly', …)`, delega la acción en `onConfirm(resource)`. Así
// el dueño emite `playProgress({ card, resource })`.
//
// Selección obligatoria + confirmación explícita: un tap accidental no debe
// disparar una carta que define la partida.

interface Props {
  onConfirm: (resource: Resource) => void;
  onClose: () => void;
}

// Color del recurso para el ring/borde del chip elegido (espejo del modal de
// Monopolio de desarrollo): comunica de un vistazo qué fue tappeado.
const RESOURCE_TONE: Record<
  Resource,
  { ring: string; bg: string; label: string }
> = {
  brick: {
    ring: 'border-resource-brick',
    bg: 'bg-resource-brick/[0.10]',
    label: 'text-resource-brick',
  },
  lumber: {
    ring: 'border-resource-lumber',
    bg: 'bg-resource-lumber/[0.12]',
    label: 'text-resource-lumber',
  },
  wool: {
    ring: 'border-resource-wool',
    bg: 'bg-resource-wool/[0.10]',
    label: 'text-resource-wool',
  },
  grain: {
    ring: 'border-resource-grain',
    bg: 'bg-resource-grain/[0.12]',
    label: 'text-resource-grain',
  },
  ore: {
    ring: 'border-resource-ore',
    bg: 'bg-resource-ore/[0.18]',
    label: 'text-neutral-100',
  },
};

export function ResourceMonopolyPickerModal({
  onConfirm,
  onClose,
}: Props): JSX.Element {
  const [selected, setSelected] = useState<Resource | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  function handleConfirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setConfirmed(true);
    onConfirm(selected);
    window.setTimeout(() => onClose(), 220);
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
        aria-labelledby="resource-monopoly-title"
        aria-describedby="resource-monopoly-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <h2
          id="resource-monopoly-title"
          className="text-[17px] font-semibold tracking-tight text-neutral-50"
        >
          Monopolio de Recurso
        </h2>
        <p
          id="resource-monopoly-desc"
          className="mt-1 text-xs leading-relaxed text-neutral-400"
        >
          Elige un recurso. Cada jugador te entrega hasta 2 de ese recurso.
        </p>

        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {RESOURCES.map((r) => {
            const isSel = selected === r;
            const dim = selected !== null && !isSel;
            const tone = RESOURCE_TONE[r];
            return (
              <button
                key={r}
                type="button"
                aria-pressed={isSel}
                aria-label={`Elegir ${RESOURCE_NAMES[r]}`}
                onClick={() => setSelected(r)}
                disabled={submitting}
                className={
                  'group flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-1 py-2.5 transition-colors duration-[180ms] ease-out active:scale-[0.97] ' +
                  (isSel
                    ? `${tone.ring} ${tone.bg} shadow-card`
                    : dim
                      ? 'border-white/[0.06] bg-surface-1 opacity-55'
                      : 'border-white/[0.10] bg-surface-1 active:bg-white/[0.08]') +
                  (isSel && confirmed ? ' anim-pulse-scale' : '')
                }
              >
                <ResourceIcon resource={r} size={40} />
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
            'nums mt-4 min-h-[56px] w-full rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.97] ' +
            (selected && !submitting
              ? 'bg-amber-400 text-neutral-950 shadow-cta-amber active:bg-amber-300'
              : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500')
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
          className="mt-3 min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium text-neutral-200 transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
