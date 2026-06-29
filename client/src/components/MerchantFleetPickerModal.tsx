import { useRef, useState } from 'react';
import { COMMODITIES, Commodity, RESOURCES, Resource } from '../types';
import { COMMODITY_NAMES, RESOURCE_NAMES } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { CommodityGlyph } from '../assets/icons';
import { useModalA11y } from '../lib/useModalA11y';

// Picker de la FLOTA MERCANTE (carta de progreso `merchantFleet`, §2.10).
// Concede durante este turno comercio 2:1 con el banco de UN solo tipo: un
// recurso (de 5) O una mercancía (de 3). Hay que elegir exactamente uno; no se
// combinan tipos.
//
// El cliente no decide la lógica: al confirmar invoca `onConfirm({ resource })`
// o `onConfirm({ commodity })`, y el dueño emite
// `playProgress({ card:'merchantFleet', resource })` o `{ …, commodity }`.

interface Props {
  onConfirm: (payload: { resource?: Resource; commodity?: Commodity }) => void;
  onClose: () => void;
}

type Selection =
  | { kind: 'resource'; value: Resource }
  | { kind: 'commodity'; value: Commodity };

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

const COMMODITY_TONE: Record<
  Commodity,
  { ring: string; bg: string; label: string }
> = {
  coin: {
    ring: 'border-commodity-coin',
    bg: 'bg-commodity-coin/[0.14]',
    label: 'text-commodity-coin',
  },
  paper: {
    ring: 'border-commodity-paper',
    bg: 'bg-commodity-paper/[0.14]',
    label: 'text-commodity-paper',
  },
  cloth: {
    ring: 'border-commodity-cloth',
    bg: 'bg-commodity-cloth/[0.12]',
    label: 'text-commodity-cloth',
  },
};

export function MerchantFleetPickerModal({
  onConfirm,
  onClose,
}: Props): JSX.Element {
  const [selected, setSelected] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  function handleConfirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setConfirmed(true);
    onConfirm(
      selected.kind === 'resource'
        ? { resource: selected.value }
        : { commodity: selected.value }
    );
    window.setTimeout(() => onClose(), 220);
  }

  const selectedName = selected
    ? selected.kind === 'resource'
      ? RESOURCE_NAMES[selected.value]
      : COMMODITY_NAMES[selected.value]
    : null;

  const confirmLabel = selectedName
    ? `Comerciar 2:1 ${selectedName}`
    : 'Elige un tipo';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="merchant-fleet-title"
        aria-describedby="merchant-fleet-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <h2
          id="merchant-fleet-title"
          className="text-[17px] font-semibold tracking-tight text-neutral-50"
        >
          Flota Mercante
        </h2>
        <p
          id="merchant-fleet-desc"
          className="mt-1 text-xs leading-relaxed text-neutral-400"
        >
          Elige UN tipo: un recurso o una mercancía. Lo comercias 2:1 con el banco
          hasta el final de tu turno. No se combinan tipos.
        </p>

        {/* Recursos (5) — bloque claramente separado del de mercancías. */}
        <div className="mt-4">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            Recursos
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {RESOURCES.map((r) => {
              const isSel =
                selected?.kind === 'resource' && selected.value === r;
              const dim = selected !== null && !isSel;
              const tone = RESOURCE_TONE[r];
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={isSel}
                  aria-label={`Comerciar 2:1 ${RESOURCE_NAMES[r]}`}
                  onClick={() => setSelected({ kind: 'resource', value: r })}
                  disabled={submitting}
                  className={
                    'group flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-1 py-2.5 transition-colors duration-[180ms] ease-out active:scale-[0.97] ' +
                    (isSel
                      ? `${tone.ring} ${tone.bg} shadow-card`
                      : dim
                        ? 'border-white/[0.06] bg-surface-1 opacity-55'
                        : 'border-white/[0.10] bg-surface-1 active:bg-white/[0.08]') +
                    (isSel && confirmed ? ' anim-pulse-scale' : '')
                  }
                >
                  <ResourceIcon resource={r} size={36} />
                  <span
                    className={
                      'text-[10px] font-semibold tracking-tight ' +
                      (isSel ? tone.label : 'text-neutral-200')
                    }
                  >
                    {RESOURCE_NAMES[r]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Separador con la disyuntiva explícita. */}
        <div className="my-3 flex items-center gap-2" aria-hidden>
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.10em] text-neutral-500">
            o
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {/* Mercancías (3). */}
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            Mercancías
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {COMMODITIES.map((c) => {
              const isSel =
                selected?.kind === 'commodity' && selected.value === c;
              const dim = selected !== null && !isSel;
              const tone = COMMODITY_TONE[c];
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={isSel}
                  aria-label={`Comerciar 2:1 ${COMMODITY_NAMES[c]}`}
                  onClick={() => setSelected({ kind: 'commodity', value: c })}
                  disabled={submitting}
                  className={
                    'group flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-1 py-2.5 transition-colors duration-[180ms] ease-out active:scale-[0.97] ' +
                    (isSel
                      ? `${tone.ring} ${tone.bg} shadow-card`
                      : dim
                        ? 'border-white/[0.06] bg-surface-1 opacity-55'
                        : 'border-white/[0.10] bg-surface-1 active:bg-white/[0.08]') +
                    (isSel && confirmed ? ' anim-pulse-scale' : '')
                  }
                >
                  <CommodityGlyph commodity={c} size={36} />
                  <span
                    className={
                      'text-[10px] font-semibold tracking-tight ' +
                      (isSel ? tone.label : 'text-neutral-200')
                    }
                  >
                    {COMMODITY_NAMES[c]}
                  </span>
                </button>
              );
            })}
          </div>
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
