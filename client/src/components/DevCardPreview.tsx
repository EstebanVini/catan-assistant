import { useRef } from 'react';
import { DevCardType } from '../types';
import { DEV_CARD_DESCRIPTIONS, DEV_CARD_NAMES } from '../lib/spanish';
import { DevCardGlyph } from '../assets/icons';
import { useModalA11y } from '../lib/useModalA11y';

// Preview de una carta de desarrollo: arte grande + descripción canónica.
// Compartido por el modal "Jugar carta de desarrollo" (con CTA de jugar) y la
// sección "Cartas de desarrollo" (solo lectura, sin onPlay).
export function DevCardPreview({
  card,
  count,
  reason,
  playLabel,
  onClose,
  onPlay,
}: {
  card: DevCardType;
  count: number;
  // Razón por la que NO se puede jugar (deshabilita el CTA); null = jugable.
  reason?: string | null;
  playLabel?: string;
  onClose: () => void;
  // Sin onPlay el preview es solo de lectura (no muestra CTA de jugar).
  onPlay?: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, onClose);
  const canPlay = !!onPlay && !reason;
  return (
    <div
      className="anim-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-preview-title"
        aria-describedby="dev-preview-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-xs rounded-2xl border border-white/10 bg-neutral-900 p-4 text-center shadow-2xl ring-1 ring-white/5"
      >
        <div className="flex justify-center">
          <DevCardGlyph card={card} size={128} />
        </div>
        <h3
          id="dev-preview-title"
          className="mt-3 text-lg font-semibold tracking-tight text-neutral-50"
        >
          {DEV_CARD_NAMES[card]}
          <span className="nums ml-2 text-sm font-bold text-neutral-400">
            ×{count}
          </span>
        </h3>
        <p
          id="dev-preview-desc"
          className="mt-2 text-sm leading-relaxed text-neutral-300"
        >
          {DEV_CARD_DESCRIPTIONS[card]}
        </p>
        {reason ? (
          <p className="mt-2 text-xs font-medium text-amber-300">{reason}</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm"
          >
            {onPlay ? 'Volver' : 'Cerrar'}
          </button>
          {onPlay ? (
            <button
              type="button"
              disabled={!canPlay}
              onClick={onPlay}
              className={
                'min-h-[48px] flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ' +
                (canPlay
                  ? 'bg-emerald-500 text-neutral-950 shadow-cta active:scale-[0.99] active:bg-emerald-400'
                  : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500')
              }
            >
              {playLabel ?? 'Jugar carta'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
