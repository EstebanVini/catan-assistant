import { useRef, useState } from 'react';
import { COMMODITIES, Commodity } from '../types';
import { COMMODITY_NAMES } from '../lib/spanish';
import { CommodityGlyph } from '../assets/icons';
import { useModalA11y } from '../lib/useModalA11y';

// Picker de MERCANCÍA para la carta de progreso "Monopolio de Comercio"
// (tradeMonopoly, §2.10). Clon del MonopolyPickerModal de recursos, adaptado a
// las tres mercancías (Moneda / Papel / Tela) con `CommodityGlyph`.
//
// El cliente NO decide la lógica: al confirmar solo invoca `onConfirm(commodity)`,
// que el dueño usa para emitir `playProgress({ card, commodity })`. La selección
// es obligatoria + confirmación explícita: un tap accidental no debe disparar
// una carta que define la partida.

interface Props {
  onConfirm: (commodity: Commodity) => void;
  onClose: () => void;
}

// Tono cromático por mercancía para el ring/borde del chip elegido: comunica de
// un vistazo qué fue tappeado sin romper la identidad de pergamino cálido.
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

export function CommodityMonopolyPickerModal({
  onConfirm,
  onClose,
}: Props): JSX.Element {
  const [selected, setSelected] = useState<Commodity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // `confirmed` enciende un pulso sobre el chip elegido al confirmar, como
  // acuse visual inmediato antes de cerrar (no depende de la respuesta del
  // server).
  const [confirmed, setConfirmed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  function handleConfirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setConfirmed(true);
    onConfirm(selected);
    // Cierre optimista con un respiro (~220 ms) para que el pulso del chip sea
    // visible antes de desmontar el modal.
    window.setTimeout(() => onClose(), 220);
  }

  const confirmLabel = selected
    ? `Confirmar Monopolio sobre ${COMMODITY_NAMES[selected]}`
    : 'Elige una mercancía';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="commodity-monopoly-title"
        aria-describedby="commodity-monopoly-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <h2
          id="commodity-monopoly-title"
          className="text-[17px] font-semibold tracking-tight text-neutral-50"
        >
          Monopolio de Comercio
        </h2>
        <p
          id="commodity-monopoly-desc"
          className="mt-1 text-xs leading-relaxed text-neutral-400"
        >
          Elige una mercancía. Cada jugador te entrega hasta 2 de esa mercancía.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {COMMODITIES.map((c) => {
            const isSel = selected === c;
            const dim = selected !== null && !isSel;
            const tone = COMMODITY_TONE[c];
            return (
              <button
                key={c}
                type="button"
                aria-pressed={isSel}
                aria-label={`Elegir ${COMMODITY_NAMES[c]}`}
                onClick={() => setSelected(c)}
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
                <CommodityGlyph commodity={c} size={40} />
                <span
                  className={
                    'text-[11px] font-semibold tracking-tight ' +
                    (isSel ? tone.label : 'text-neutral-200')
                  }
                >
                  {COMMODITY_NAMES[c]}
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
