import { useRef, useState } from 'react';
import { Building } from '../types';
import { RESOURCE_NAMES_LOWER } from '../lib/spanish';
import { BuildingGlyph } from '../assets/icons';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Picker de MEDICINA (carta de progreso `medicine`, §2.10). Convierte uno de
// MIS poblados en ciudad pagando 2 mineral + 1 trigo (la carta ahorra 1 mineral
// y 1 trigo respecto al costo normal de ciudad). Listamos los poblados con sus
// fichas para que el jugador identifique cuál mejora — dos poblados pueden tener
// el mismo número/recurso, así que se muestran todas sus fichas.
//
// El cliente no decide la lógica: al confirmar invoca `onConfirm(settlementId)`
// y el dueño emite `playProgress({ card:'medicine', settlementId })`.

interface Props {
  // Solo poblados (ya filtrados por el padre: buildings.type === 'settlement').
  settlements: Building[];
  onConfirm: (settlementId: string) => void;
  onClose: () => void;
}

export function SettlementUpgradePickerModal({
  settlements,
  onConfirm,
  onClose,
}: Props): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  function handleConfirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    onConfirm(selected);
    window.setTimeout(() => onClose(), 200);
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
        aria-labelledby="medicine-picker-title"
        aria-describedby="medicine-picker-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in flex max-h-[88vh] w-full max-w-sm flex-col rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <h2
          id="medicine-picker-title"
          className="text-[17px] font-semibold tracking-tight text-neutral-50"
        >
          Medicina
        </h2>
        <p
          id="medicine-picker-desc"
          className="mt-1 text-xs leading-relaxed text-neutral-400"
        >
          Elige un poblado para mejorarlo a ciudad.
        </p>

        {/* Costo con descuento de Medicina (2 mineral + 1 trigo). */}
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-discipline-science/35 bg-discipline-science/[0.10] px-3 py-2">
          <span className="text-[11px] font-medium text-neutral-200">Costo:</span>
          <span className="flex items-center gap-1">
            <ResourceIcon resource="ore" size={20} />
            <span className="nums text-[12px] font-semibold text-neutral-100">
              2
            </span>
          </span>
          <span className="flex items-center gap-1">
            <ResourceIcon resource="grain" size={20} />
            <span className="nums text-[12px] font-semibold text-neutral-100">
              1
            </span>
          </span>
          <span className="ml-auto text-[10px] text-neutral-400">
            (ahorras 1 mineral y 1 trigo)
          </span>
        </div>

        <div className="-mr-1 mt-3 flex-1 overflow-y-auto pr-1">
          {settlements.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-surface-2 px-3 py-4 text-center text-[12px] leading-snug text-neutral-300">
              No tienes poblados para mejorar. Registra tus poblados en la tabla
              de construcción primero.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {settlements.map((b, idx) => {
                const isSel = selected === b.id;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      aria-pressed={isSel}
                      onClick={() => setSelected(b.id)}
                      disabled={submitting}
                      className={
                        'flex min-h-[56px] w-full items-center gap-2.5 rounded-xl border-2 px-2.5 py-2 text-left transition-colors active:scale-[0.99] ' +
                        (isSel
                          ? 'border-amber-400/70 bg-amber-400/[0.10] shadow-card'
                          : 'border-white/[0.10] bg-surface-2 active:bg-white/[0.06]')
                      }
                    >
                      <BuildingGlyph type="settlement" size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold tracking-tight text-neutral-50">
                          Poblado {idx + 1}
                        </div>
                        {b.spots.length === 0 ? (
                          <div className="mt-0.5 text-[10px] text-neutral-500">
                            Sin fichas registradas
                          </div>
                        ) : (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {b.spots.map((s, j) => (
                              <span
                                key={`${j}-${s.number}-${s.resource}`}
                                className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-surface-3 px-1.5 py-0.5"
                              >
                                <span className="nums text-[10px] font-semibold text-neutral-100">
                                  {s.number}
                                </span>
                                <ResourceIcon resource={s.resource} size={16} />
                                <span className="text-[10px] text-neutral-300">
                                  {RESOURCE_NAMES_LOWER[s.resource]}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span
                        aria-hidden
                        className={
                          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ' +
                          (isSel
                            ? 'border-amber-400 bg-amber-400'
                            : 'border-white/25 bg-transparent')
                        }
                      >
                        {isSel ? (
                          <svg width={11} height={11} viewBox="0 0 24 24">
                            <path
                              d="M5 13 L10 18 L19 6"
                              fill="none"
                              stroke="#0a0a0a"
                              strokeWidth={3}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selected || submitting}
          className={
            'mt-4 min-h-[56px] w-full flex-shrink-0 rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.97] ' +
            (selected && !submitting
              ? 'bg-amber-400 text-neutral-950 shadow-cta-amber active:bg-amber-300'
              : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500')
          }
        >
          {submitting ? 'Mejorando…' : 'Mejorar a ciudad'}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="mt-3 min-h-[44px] w-full flex-shrink-0 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium text-neutral-200 transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
