import { useRef, useState } from 'react';
import { KNIGHT_RANK_NAMES, Knight } from '../types';
import { useModalA11y } from '../lib/useModalA11y';
import { KnightGlyph } from '../assets/icons';

// Picker del HERRERO (carta de progreso `smith`, §2.10). Promueve gratis hasta
// 2 de MIS caballeros (un rango cada uno). Solo se promueven los de rango 1
// (Básico → Fuerte) y 2 (Fuerte → Poderoso); los de rango 3 (Poderoso) ya están
// al máximo. Promover a rango 3 exige la Fortaleza (Política nivel 3): si no la
// tengo, esos caballeros se muestran deshabilitados con el motivo.
//
// El cliente no decide la lógica: al confirmar invoca `onConfirm(knightIds)` con
// 1 o 2 ids, y el dueño emite `playProgress({ card:'smith', knightIds })`.

const POLITICS_FORTRESS_LEVEL = 3; // Fortaleza = Política nivel 3 (promover a 3).
const MAX_PROMOTE = 2;

interface Props {
  // Mis caballeros (public.knights del jugador local).
  knights: Knight[];
  // Mi nivel de Política, para saber si tengo Fortaleza.
  politics: number;
  onConfirm: (knightIds: string[]) => void;
  onClose: () => void;
}

export function KnightPromotePickerModal({
  knights,
  politics,
  onConfirm,
  onClose,
}: Props): JSX.Element {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  const hasFortress = politics >= POLITICS_FORTRESS_LEVEL;
  // Solo rangos 1 y 2 se pueden promover (rango 3 ya es el máximo).
  const promotable = knights.filter((k) => k.rank < 3);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_PROMOTE
          ? [...prev, id]
          : prev
    );
  }

  function handleConfirm() {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    onConfirm(selected);
    window.setTimeout(() => onClose(), 200);
  }

  const atMax = selected.length >= MAX_PROMOTE;
  const confirmLabel =
    selected.length === 0
      ? 'Elige caballeros'
      : `Promover ${selected.length} ${selected.length === 1 ? 'caballero' : 'caballeros'}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="smith-picker-title"
        aria-describedby="smith-picker-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in flex max-h-[88vh] w-full max-w-sm flex-col rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <h2
          id="smith-picker-title"
          className="text-[17px] font-semibold tracking-tight text-neutral-50"
        >
          Herrero
        </h2>
        <p
          id="smith-picker-desc"
          className="mt-1 text-xs leading-relaxed text-neutral-400"
        >
          Promueve gratis hasta 2 de tus caballeros (un rango cada uno).
        </p>

        {/* Aviso de Fortaleza cuando hay caballeros Fuertes que no se pueden
            subir a Poderoso por falta de Política nivel 3. */}
        {!hasFortress && promotable.some((k) => k.rank === 2) ? (
          <p className="mt-2.5 rounded-lg border border-discipline-politics/40 bg-discipline-politics/[0.10] px-3 py-2 text-[11px] leading-snug text-neutral-200">
            Para promover un caballero Fuerte a Poderoso necesitas la Fortaleza
            (Política nivel 3).
          </p>
        ) : null}

        <div className="-mr-1 mt-3 flex-1 overflow-y-auto pr-1">
          {promotable.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-surface-2 px-3 py-4 text-center text-[12px] leading-snug text-neutral-300">
              No tienes caballeros que se puedan promover. Contrata o promueve
              caballeros desde el panel de Caballeros.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {promotable.map((k) => {
                const isSel = selected.includes(k.id);
                // Rango 2 (Fuerte → Poderoso) requiere Fortaleza.
                const blocked = k.rank === 2 && !hasFortress;
                // Tope alcanzado y este no está elegido: no se puede sumar más.
                const capped = !isSel && atMax;
                const disabled = blocked || capped || submitting;
                const targetName = KNIGHT_RANK_NAMES[(k.rank + 1) as 2 | 3];
                return (
                  <li key={k.id}>
                    <button
                      type="button"
                      aria-pressed={isSel}
                      disabled={disabled}
                      onClick={() => toggle(k.id)}
                      className={
                        'flex min-h-[56px] w-full items-center gap-2.5 rounded-xl border-2 px-2.5 py-2 text-left transition-colors active:scale-[0.99] ' +
                        (isSel
                          ? 'border-amber-400/70 bg-amber-400/[0.10] shadow-card'
                          : disabled
                            ? 'cursor-not-allowed border-white/[0.06] bg-surface-1 opacity-55'
                            : 'border-white/[0.10] bg-surface-2 active:bg-white/[0.06]')
                      }
                    >
                      <KnightGlyph rank={k.rank} active={k.active} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold tracking-tight text-neutral-50">
                          {KNIGHT_RANK_NAMES[k.rank]}
                          <span className="text-neutral-400">
                            {' → '}
                            {targetName}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-neutral-400">
                          {blocked
                            ? 'Requiere Fortaleza (Política nivel 3)'
                            : k.active
                              ? 'Activo'
                              : 'En reserva'}
                        </div>
                      </div>
                      <span
                        aria-hidden
                        className={
                          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 ' +
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
          {atMax ? (
            <p className="mt-2 text-center text-[10px] text-neutral-500">
              Máximo 2 caballeros por carta.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={selected.length === 0 || submitting}
          className={
            'mt-4 min-h-[56px] w-full flex-shrink-0 rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.97] ' +
            (selected.length > 0 && !submitting
              ? 'bg-amber-400 text-neutral-950 shadow-cta-amber active:bg-amber-300'
              : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500')
          }
        >
          {submitting ? 'Promoviendo…' : confirmLabel}
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
