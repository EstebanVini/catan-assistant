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

  // Si el banco está completamente vacío, el modal ni siquiera debería abrir
  // (lo evita el modal padre §1.3). Defensa adicional aquí:
  const bankTotal = RESOURCES.reduce((a, r) => a + bank[r], 0);

  // Helper: ¿está disponible este recurso para el selector `slot`, dado el
  // estado del otro selector?
  function availableFor(slot: 1 | 2, res: Resource): { ok: boolean; reason?: string } {
    const stock = bank[res];
    if (stock <= 0) return { ok: false, reason: 'Agotado en el banco' };
    const other = slot === 1 ? r2 : r1;
    if (other === res && stock < 2) {
      return { ok: false, reason: 'Sin stock para 2' };
    }
    return { ok: true };
  }

  // ¿Es viable el caso "banco corto a 1"? Sólo si hay exactamente 1 carta total.
  const onlyOneCardInBank = bankTotal === 1;

  // Recurso del único disponible (si banco corto).
  const lastResource: Resource | null = onlyOneCardInBank
    ? (RESOURCES.find((r) => bank[r] === 1) ?? null)
    : null;

  // Si hay banco corto y el usuario eligió el único disponible, permitimos
  // confirmar con sólo 1.
  const canConfirmShort = onlyOneCardInBank && r1 !== null && r2 === null;

  const ready = r1 !== null && r2 !== null;
  const canConfirm = ready || canConfirmShort;

  function handleConfirm() {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    const picks: Resource[] = ready
      ? [r1 as Resource, r2 as Resource]
      : [r1 as Resource];
    playDevCard('yearOfPlenty', { resources: picks });
    window.setTimeout(() => onClose(), 60);
  }

  const progress = (r1 !== null ? 1 : 0) + (r2 !== null ? 1 : 0);
  const confirmLabel = ready
    ? `Tomar ${RESOURCE_NAMES[r1 as Resource]} y ${RESOURCE_NAMES[r2 as Resource]} del banco`
    : canConfirmShort
      ? `Tomar 1 carta de ${RESOURCE_NAMES[r1 as Resource]}`
      : onlyOneCardInBank
        ? 'Elige el recurso disponible'
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
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <h2
          id="yop-title"
          className="text-base font-semibold tracking-tight text-neutral-50"
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

        {onlyOneCardInBank && lastResource ? (
          <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] font-medium leading-snug text-amber-100">
            Solo queda 1 carta en el banco ({RESOURCE_NAMES[lastResource]}).
            Tomarás 1 en lugar de 2.
          </p>
        ) : null}

        <SelectorRow
          label="Recurso 1"
          selected={r1}
          onPick={setR1}
          availableFor={(res) => availableFor(1, res)}
          bank={bank}
        />
        <SelectorRow
          label="Recurso 2"
          selected={r2}
          onPick={setR2}
          availableFor={(res) => availableFor(2, res)}
          bank={bank}
        />

        <p
          className="mt-3 text-center text-[11px] font-medium text-neutral-300"
          aria-live="polite"
        >
          Has elegido{' '}
          <span className="nums font-bold text-neutral-50">
            {progress}/{onlyOneCardInBank ? 1 : 2}
          </span>
        </p>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || submitting}
          className={
            'nums mt-3 min-h-[56px] w-full rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.99] ' +
            (canConfirm && !submitting
              ? 'bg-emerald-500 text-neutral-950 shadow-cta active:bg-emerald-400'
              : 'cursor-not-allowed border border-white/10 bg-white/[0.04] text-neutral-500')
          }
        >
          {submitting ? 'Tomando…' : confirmLabel}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="mt-2 min-h-[44px] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-neutral-200 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

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
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
        {label}
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {RESOURCES.map((r) => {
          const avail = availableFor(r);
          const isSel = selected === r;
          const stock = bank[r];
          const disabled = !avail.ok && !isSel;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={isSel}
              aria-label={`${label}: ${RESOURCE_NAMES[r]}. ${stock} en banco.${disabled && avail.reason ? ' ' + avail.reason : ''}`}
              disabled={disabled}
              onClick={() => onPick(r)}
              className={
                'flex min-h-[72px] flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-1 py-1 transition-all ' +
                (isSel
                  ? 'border-emerald-400 bg-emerald-500/[0.10]'
                  : disabled
                    ? 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-50'
                    : 'border-white/12 bg-white/[0.04] active:scale-[0.97] active:bg-white/[0.08]')
              }
            >
              <ResourceIcon resource={r} size={24} />
              <span className="nums text-[10px] font-semibold text-neutral-300">
                {stock}
              </span>
              {disabled && avail.reason ? (
                <span className="text-[9px] leading-none text-neutral-500">
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
