import { useRef } from 'react';
import { PortType, RESOURCES } from '../types';
import { RESOURCE_NAMES_LOWER } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Bottom-sheet para asignar el puerto de UN poblado/ciudad (base y C&K).
//
// Vive en su propio módulo para poder reusarse tanto en la Tabla de
// construcción (partida) como en el registro de salida del Lobby
// (InitialBuildSetup) sin crear un import circular: ConstructionTable importa
// SpotPickerSheet de InitialBuildSetup, así que InitialBuildSetup no puede
// importar de ConstructionTable.

export const PORT_SHORT: Record<PortType, string> = {
  '3:1': 'Puerto 3:1',
  brick: 'Puerto Ladrillo',
  lumber: 'Puerto Madera',
  wool: 'Puerto Lana',
  grain: 'Puerto Trigo',
  ore: 'Puerto Mineral',
};

export function PortPickerSheet({
  current,
  buildLabel,
  onClose,
  onConfirm,
}: {
  current: PortType | null;
  buildLabel: string;
  onClose: () => void;
  onConfirm: (port: PortType | null) => void;
}): JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="port-picker-title"
        className="rounded-t-2xl border-t border-white/10 bg-surface-1 p-4 pb-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p id="port-picker-title" className="text-sm font-semibold text-neutral-100">
            Puerto — {buildLabel}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors active:bg-white/10"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <p className="mb-3 text-[11px] text-neutral-400">
          Una construcción con puerto toca máximo 2 fichas. El tipo de puerto determina tu ratio de intercambio.
        </p>
        <div className="space-y-1.5">
          {/* Opción: sin puerto */}
          <button
            type="button"
            onClick={() => onConfirm(null)}
            className={
              'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors active:bg-white/[0.08] ' +
              (current === null
                ? 'border-neutral-500/60 bg-neutral-500/20 text-neutral-100'
                : 'border-white/10 bg-surface-2 text-neutral-300')
            }
          >
            <span className="text-lg leading-none">🚫</span>
            <span className="text-sm font-medium">Sin puerto</span>
            {current === null ? (
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                actual
              </span>
            ) : null}
          </button>

          {/* Opción: 3:1 */}
          <button
            type="button"
            onClick={() => onConfirm('3:1')}
            className={
              'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors active:bg-white/[0.08] ' +
              (current === '3:1'
                ? 'border-sky-500/60 bg-sky-500/20 text-sky-100'
                : 'border-white/10 bg-surface-2 text-neutral-300')
            }
          >
            <span className="text-lg leading-none">⚓</span>
            <div className="flex-1">
              <p className="text-sm font-medium">Puerto 3:1</p>
              <p className="text-[10px] text-neutral-400">Intercambia cualquier recurso 3:1</p>
            </div>
            {current === '3:1' ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-400">
                actual
              </span>
            ) : null}
          </button>

          {/* Opciones de recurso 2:1 */}
          <div className="grid grid-cols-2 gap-1.5">
            {RESOURCES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onConfirm(r)}
                className={
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors active:bg-white/[0.08] ' +
                  (current === r
                    ? 'border-sky-500/60 bg-sky-500/20 text-sky-100'
                    : 'border-white/10 bg-surface-2 text-neutral-300')
                }
              >
                <ResourceIcon resource={r} size={20} />
                <div>
                  <p className="text-xs font-medium">{RESOURCE_NAMES_LOWER[r]}</p>
                  <p className="text-[10px] text-neutral-400">2:1</p>
                </div>
                {current === r ? (
                  <span className="ml-auto text-[10px] text-sky-400">✓</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
