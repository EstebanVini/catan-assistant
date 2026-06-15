import { useRef } from 'react';
import { useStore } from '../store';
import { RESOURCES, Resource } from '../types';
import type { Hand } from '../types';
import { RESOURCE_NAMES } from '../lib/spanish';
import { ColorChip } from './ColorChip';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Paso 3 del flujo de puerto ajeno (#8): el DUEÑO aprobó con comisión > 0 y el
// backend dejó la solicitud en `status === 'awaitingRequester'`. El SOLICITANTE
// debe confirmar o rechazar el cobro antes de que el backend ejecute el cambio.
//
// Modal bloqueante (patrón RobberFlow / PortIncomingModal): no se cierra con tap
// fuera; ESC equivale a rechazar (la salida menos comprometedora). Si la comisión
// es vacía el backend ejecuta directo y este modal nunca se monta.
export function PortFeeConfirmModal(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const confirmPort = useStore((s) => s.confirmPort);
  const dialogRef = useRef<HTMLDivElement>(null);
  // ESC = rechazar la comisión (no ejecuta el cambio).
  useModalA11y(dialogRef, () => confirmPort(false));

  if (!view || !view.me) return null;
  const { state, me } = view;
  const req = state.activePortUse;
  // Sólo el solicitante, y sólo cuando el dueño ya fijó comisión y espera mi
  // confirmación. Si el request desaparece o cambia de estado, el modal se cierra.
  if (
    !req ||
    req.requesterId !== me.id ||
    req.status !== 'awaitingRequester'
  ) {
    return null;
  }

  const owner = state.players.find((p) => p.id === req.ownerId) ?? null;
  const ownerName = owner?.name ?? 'El dueño';

  // Comisión: sólo recursos con cantidad > 0, en orden canónico.
  const commission: Hand = (req.commission ?? {}) as Hand;
  const commissionEntries = RESOURCES.map((r) => [r, commission[r] ?? 0] as const).filter(
    ([, n]) => n > 0
  );

  // ¿Me alcanza para el cambio (ratio de `give`) MÁS la comisión? Si el recurso
  // que doy también aparece en la comisión, ambos costos se suman.
  const need: Partial<Record<Resource, number>> = {};
  need[req.give] = (need[req.give] ?? 0) + req.ratio;
  for (const [r, n] of commissionEntries) {
    need[r] = (need[r] ?? 0) + n;
  }
  const missing = (Object.entries(need) as [Resource, number][]).filter(
    ([r, n]) => (me.hand[r] ?? 0) < n
  );
  const canAfford = missing.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="port-fee-title"
        aria-describedby="port-fee-desc"
        className="anim-slide-up max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl"
      >
        <h2 id="port-fee-title" className="text-base font-semibold">
          <span className="inline-flex items-center gap-1.5">
            {owner ? <ColorChip color={owner.color} size={14} /> : null}
            {ownerName}
          </span>{' '}
          aprobó tu uso del puerto
        </h2>
        <p id="port-fee-desc" className="mt-1 text-xs text-neutral-400">
          Confirma los términos antes de pagar. Aún no se ha hecho ningún cambio.
        </p>

        <div className="mt-3 rounded-lg border border-white/10 bg-surface-1 p-3">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">
            El cambio
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-neutral-200">
            Das {req.ratio}
            <ResourceIcon resource={req.give} size={18} />
            {RESOURCE_NAMES[req.give]}, recibes 1
            <ResourceIcon resource={req.receive} size={18} />
            {RESOURCE_NAMES[req.receive]}.
          </p>
        </div>

        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-[11px] uppercase tracking-wide text-amber-200">
            Comisión del puerto
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {commissionEntries.map(([r, n]) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-md bg-neutral-950 px-2 py-1 text-xs text-amber-100"
              >
                <ResourceIcon resource={r} size={18} />
                <span className="nums font-semibold">{n}</span>
                <span className="text-[10px] text-amber-200/80">
                  {RESOURCE_NAMES[r]}
                </span>
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-amber-200/80">
            Pagas la comisión a {ownerName} además de las cartas del cambio.
          </p>
        </div>

        {!canAfford ? (
          <p
            id="port-fee-cant-afford"
            className="mt-2 rounded-md border border-red-500/30 bg-red-500/[0.08] px-2.5 py-2 text-xs text-red-300"
            role="status"
          >
            No te alcanza para el cambio más la comisión.
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {canAfford ? (
            <button
              type="button"
              onClick={() => confirmPort(true)}
              className="min-h-[48px] w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900"
            >
              Confirmar y pagar
            </button>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-describedby="port-fee-cant-afford"
              className="min-h-[48px] w-full cursor-not-allowed rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm font-semibold text-neutral-500"
            >
              Confirmar y pagar
            </button>
          )}
          <button
            type="button"
            onClick={() => confirmPort(false)}
            className="min-h-[48px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium text-neutral-200"
          >
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}
