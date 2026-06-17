import { useRef, useState } from 'react';
import { useStore } from '../store';
import { COMMODITIES, Commodity, RESOURCES, Resource } from '../types';
import { COMMODITY_NAMES, RESOURCE_NAMES } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { CommodityGlyph } from '../assets/icons';
import { useModalA11y } from '../lib/useModalA11y';

// Modal forzado: aparece automáticamente cuando hay pendingDiscards[me.id] > 0.
// No se puede cerrar con ESC ni con backdrop tap: es obligatorio descartar.
//
// En modo base solo se eligen recursos (2º argumento de submitDiscard queda
// `undefined`). En Caballeros y Ciudades (state.citiesKnights) el conteo del 7
// incluye recursos + mercancías, así que el modal también deja elegir cuántas
// de cada mercancía descartar; el total (recursos + mercancías) debe igualar
// `pendingDiscards[me.id]`.
export function DiscardModal(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const submitDiscard = useStore((s) => s.submitDiscard);
  const [picks, setPicks] = useState<Partial<Record<Resource, number>>>({});
  const [commodityPicks, setCommodityPicks] = useState<
    Partial<Record<Commodity, number>>
  >({});
  const dialogRef = useRef<HTMLDivElement>(null);
  // Sin onClose efectivo: el modal es forzado. Pasamos un no-op para que el
  // hook siga atrapando el foco y aplicando focus trap, sin permitir cerrar.
  useModalA11y(dialogRef, () => {
    /* no-op: descarte obligatorio */
  });

  if (!view || !view.me) return null;
  const { state, me } = view;
  if (state.phase !== 'discard') return null;
  const required = state.pendingDiscards[me.id] ?? 0;
  if (required === 0) return null;

  const withCommodities = state.citiesKnights;

  const resourceTotal = (Object.values(picks) as number[]).reduce(
    (a, b) => a + b,
    0
  );
  const commodityTotal = (Object.values(commodityPicks) as number[]).reduce(
    (a, b) => a + b,
    0
  );
  const total = resourceTotal + commodityTotal;
  const canConfirm = total === required;

  function adjust(r: Resource, delta: number) {
    setPicks((prev) => {
      const cur = prev[r] ?? 0;
      const next = Math.max(0, Math.min(me!.hand[r], cur + delta));
      return { ...prev, [r]: next };
    });
  }

  function adjustCommodity(c: Commodity, delta: number) {
    setCommodityPicks((prev) => {
      const cur = prev[c] ?? 0;
      const next = Math.max(0, Math.min(me!.commodities[c], cur + delta));
      return { ...prev, [c]: next };
    });
  }

  function confirm() {
    // En base, el 2º argumento queda `undefined` (comportamiento idéntico al
    // actual). En C&K enviamos también las mercancías elegidas.
    submitDiscard(picks, withCommodities ? commodityPicks : undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-modal-title"
        aria-describedby="discard-modal-desc"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-red-500/45 bg-neutral-900 p-4 shadow-2xl ring-1 ring-red-500/10"
      >
        <h2
          id="discard-modal-title"
          className="text-lg font-bold tracking-tight text-red-200"
        >
          Te toca descartar
        </h2>
        <p
          id="discard-modal-desc"
          className="mt-1 text-sm leading-relaxed text-neutral-300"
        >
          Salió un 7. Descarta exactamente{' '}
          <span className="nums font-bold text-neutral-50">{required}</span>{' '}
          {required === 1 ? 'carta' : 'cartas'}
          {withCommodities ? ' entre recursos y mercancías' : ''}.
        </p>

        <div className="mt-3 space-y-2">
          {RESOURCES.map((r) => {
            const have = me.hand[r];
            const picked = picks[r] ?? 0;
            const empty = have === 0;
            return (
              <DiscardRow
                key={r}
                name={RESOURCE_NAMES[r]}
                glyph={<ResourceIcon resource={r} size={30} />}
                have={have}
                picked={picked}
                empty={empty}
                atLimit={total >= required}
                onDec={() => adjust(r, -1)}
                onInc={() => adjust(r, +1)}
              />
            );
          })}
        </div>

        {/* Mercancías (Caballeros y Ciudades): cuentan para el mismo total del
            7. Solo en C&K. El glifo dorado heráldico las distingue de los
            recursos. */}
        {withCommodities ? (
          <>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                Mercancías
              </span>
              <span className="h-px flex-1 bg-white/10" aria-hidden />
            </div>
            <div className="mt-2 space-y-2">
              {COMMODITIES.map((c) => {
                const have = me.commodities[c];
                const picked = commodityPicks[c] ?? 0;
                const empty = have === 0;
                return (
                  <DiscardRow
                    key={c}
                    name={COMMODITY_NAMES[c]}
                    glyph={<CommodityGlyph commodity={c} size={30} />}
                    have={have}
                    picked={picked}
                    empty={empty}
                    atLimit={total >= required}
                    onDec={() => adjustCommodity(c, -1)}
                    onInc={() => adjustCommodity(c, +1)}
                  />
                );
              })}
            </div>
          </>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-neutral-300">
            Elegiste{' '}
            <span
              className={
                'nums font-bold ' +
                (canConfirm ? 'text-emerald-300' : 'text-amber-300')
              }
            >
              {total} de {required}
            </span>
          </span>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={confirm}
            className="min-h-[48px] rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-neutral-950 shadow-cta transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            Confirmar descarte
          </button>
        </div>
      </div>
    </div>
  );
}

// Fila de descarte reutilizable (recurso o mercancía): glifo + nombre + cuántas
// tengo, con los botones −/+ (touch ≥44px) y el contador. `atLimit` bloquea el
// + cuando ya se alcanzó el total requerido; `picked >= have` impide exceder lo
// que tengo de ese tipo.
function DiscardRow({
  name,
  glyph,
  have,
  picked,
  empty,
  atLimit,
  onDec,
  onInc,
}: {
  name: string;
  glyph: JSX.Element;
  have: number;
  picked: number;
  empty: boolean;
  atLimit: boolean;
  onDec: () => void;
  onInc: () => void;
}): JSX.Element {
  return (
    <div
      className={
        'flex items-center gap-2 rounded-lg border bg-neutral-950 p-2 transition-opacity ' +
        (empty ? 'border-white/5 opacity-60' : 'border-white/12')
      }
    >
      {glyph}
      <div className="flex-1">
        <div className="text-sm font-semibold text-neutral-100">{name}</div>
        <div className="text-[11px] text-neutral-400">
          En mano:{' '}
          <span className="nums font-semibold text-neutral-200">{have}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDec}
        disabled={picked === 0}
        aria-label={`Quitar 1 ${name} del descarte`}
        className="h-11 w-11 rounded-md border border-white/12 bg-surface-3 text-xl font-medium transition-colors active:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span aria-hidden>−</span>
      </button>
      <span
        className="nums w-8 text-center text-xl font-bold text-neutral-50"
        aria-label={`${picked} ${name} elegidas para descartar`}
      >
        {picked}
      </span>
      <button
        type="button"
        onClick={onInc}
        disabled={picked >= have || atLimit}
        aria-label={`Agregar 1 ${name} al descarte`}
        className="h-11 w-11 rounded-md border border-white/12 bg-surface-3 text-xl font-medium transition-colors active:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span aria-hidden>+</span>
      </button>
    </div>
  );
}
