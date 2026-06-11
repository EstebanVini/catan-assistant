import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { RESOURCES, Resource } from '../types';
import { RESOURCE_NAMES } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Modal de Año de la abundancia (brief Fase 2 §1.3).
// Dos selectores apilados. Permite repetir recurso si hay ≥2 en banco.
// Tolerancia "banco corto": si tras elegir uno el banco queda en 0 en todos
// los demás Y no se puede tomar 2 del mismo, se permite confirmar con 1.

interface Props {
  onClose: () => void;
}

export function YearOfPlentyPickerModal({ onClose }: Props): JSX.Element | null {
  const view = useStore((s) => s.view);
  const playDevCard = useStore((s) => s.playDevCard);
  const pushToast = useStore((s) => s.pushToast);
  const phase = view?.state.phase ?? null;
  const bank = view?.state.bank;

  const [r1, setR1] = useState<Resource | null>(null);
  const [r2, setR2] = useState<Resource | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  // Cierre automático si se entra a fase de descarte.
  useEffect(() => {
    if (phase === 'discard') {
      pushToast('info', 'Se canceló Año de la abundancia. Descarta primero.');
      onClose();
    }
  }, [phase, onClose, pushToast]);

  if (!bank) return null;

  // El banco es ILIMITADO: cualquier recurso está disponible siempre (incluso
  // 2 del mismo). El stock que se muestra es solo informativo.
  function availableFor(): { ok: boolean; reason?: string } {
    return { ok: true };
  }

  const ready = r1 !== null && r2 !== null;
  const canConfirm = ready;

  function handleConfirm() {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    playDevCard('yearOfPlenty', { resources: [r1 as Resource, r2 as Resource] });
    window.setTimeout(() => onClose(), 60);
  }

  const progress = (r1 !== null ? 1 : 0) + (r2 !== null ? 1 : 0);
  const confirmLabel = ready
    ? `Tomar ${RESOURCE_NAMES[r1 as Resource]} y ${RESOURCE_NAMES[r2 as Resource]} del banco`
    : 'Elige 2 recursos';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="yop-title"
        aria-describedby="yop-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <h2
          id="yop-title"
          className="text-[17px] font-semibold tracking-tight text-neutral-50"
        >
          Año de la abundancia
        </h2>
        <p
          id="yop-desc"
          className="mt-1 text-xs leading-relaxed text-neutral-400"
        >
          Toma 2 cartas del banco. Pueden ser del mismo recurso si hay
          suficiente.
        </p>

        <SelectorRow
          label="Recurso 1"
          selected={r1}
          onPick={setR1}
          availableFor={() => availableFor()}
          bank={bank}
        />
        <SelectorRow
          label="Recurso 2"
          selected={r2}
          onPick={setR2}
          availableFor={() => availableFor()}
          bank={bank}
        />

        <p
          className="mt-3 text-center text-[11px] font-medium text-neutral-300"
          aria-live="polite"
        >
          Has elegido{' '}
          <span className="nums font-bold text-neutral-50">{progress}/2</span>
        </p>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || submitting}
          className={
            // Tap feedback consistente con los selectores (97 % scale).
            'nums mt-3 min-h-[56px] w-full rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.97] ' +
            (canConfirm && !submitting
              ? 'bg-emerald-500 text-neutral-950 shadow-cta active:bg-emerald-400'
              : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500')
          }
        >
          {submitting ? 'Tomando…' : confirmLabel}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="mt-2 min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium text-neutral-200 transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Tonos por recurso, replicados aquí para evitar re-importes. Las clases son
// literales para que la JIT de Tailwind las detecte.
const YOP_TONE: Record<
  Resource,
  { border: string; bg: string; label: string }
> = {
  brick:  { border: 'border-resource-brick',  bg: 'bg-resource-brick/[0.10]',  label: 'text-resource-brick' },
  lumber: { border: 'border-resource-lumber', bg: 'bg-resource-lumber/[0.12]', label: 'text-resource-lumber' },
  wool:   { border: 'border-resource-wool',   bg: 'bg-resource-wool/[0.10]',   label: 'text-resource-wool' },
  grain:  { border: 'border-resource-grain',  bg: 'bg-resource-grain/[0.12]',  label: 'text-resource-grain' },
  ore:    { border: 'border-resource-ore',    bg: 'bg-resource-ore/[0.18]',    label: 'text-neutral-100' },
};

function SelectorRow({
  label,
  selected,
  onPick,
  availableFor,
  bank,
}: {
  label: string;
  selected: Resource | null;
  onPick: (r: Resource) => void;
  availableFor: (r: Resource) => { ok: boolean; reason?: string };
  bank: Record<Resource, number>;
}): JSX.Element {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
        {label}
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {RESOURCES.map((r) => {
          const avail = availableFor(r);
          const isSel = selected === r;
          const stock = bank[r];
          const disabled = !avail.ok && !isSel;
          const tone = YOP_TONE[r];
          return (
            <button
              key={r}
              type="button"
              aria-pressed={isSel}
              aria-label={`${label}: ${RESOURCE_NAMES[r]}. ${stock} en banco.${disabled && avail.reason ? ' ' + avail.reason : ''}`}
              disabled={disabled}
              onClick={() => onPick(r)}
              className={
                // Cambios de border/bg con `transition-colors duration-180`
                // para que la selección no sea abrupta. `active:scale-[0.97]`
                // como tap feedback (target ≥80 px alto).
                'flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-lg border-2 px-1 py-1.5 transition-colors duration-[180ms] ease-out ' +
                (isSel
                  ? `${tone.border} ${tone.bg} shadow-soft`
                  : disabled
                    ? 'cursor-not-allowed border-white/[0.06] bg-surface-1 opacity-55'
                    : 'border-white/[0.10] bg-surface-1 active:scale-[0.97] active:bg-white/[0.08]')
              }
            >
              <ResourceIcon resource={r} size={32} />
              <span
                className={
                  'nums text-[10px] font-semibold ' +
                  (isSel ? tone.label : 'text-neutral-300')
                }
              >
                {stock}
              </span>
              {disabled && avail.reason ? (
                <span className="text-[9px] leading-tight text-neutral-500">
                  {avail.reason}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
