import { useRef, useState } from 'react';
import { useStore } from '../store';
import { RESOURCES, Resource } from '../types';
import type { Hand } from '../types';
import { RESOURCE_NAMES } from '../lib/spanish';
import { ColorChip } from './ColorChip';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Modal forzado del DUEÑO del puerto: aparece cuando hay una solicitud activa
// (`activePortUse`) dirigida a mí. El solicitante quiere usar mi puerto a una
// proporción dada; yo decido si lo presto y, opcionalmente, cuánto le cobro.
//
// PROTOCOLO: el backend ejecuta el intercambio en cuanto apruebo (no hay
// re-confirmación del solicitante). Si dejo la comisión vacía, es gratis.
// Patrón de RobberFlow: diálogo obligatorio, no se cierra con ESC ni tap fuera.
export function PortIncomingModal(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const respondPort = useStore((s) => s.respondPort);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Comisión opcional que cobraré al solicitante (cartas de recurso).
  const [commission, setCommission] = useState<Partial<Record<Resource, number>>>(
    {}
  );
  // Modal principal: forzado, no se cierra con ESC ni con tap fuera.
  useModalA11y(dialogRef, () => {
    /* no-op: paso obligatorio */
  });

  if (!view || !view.me) return null;
  const { state, me } = view;
  const req = state.activePortUse;
  if (!req || req.ownerId !== me.id) return null;

  const requester =
    state.players.find((p) => p.id === req.requesterId) ?? null;
  const requesterName = requester?.name ?? 'Un jugador';

  // Paso 3 desde la óptica del dueño: ya fijé comisión y el backend espera que
  // el solicitante la confirme. Sin botones de acción; sólo informo y dejo
  // cancelar la solicitud. (Si la aprobé gratis, el backend ya ejecutó y el
  // request desapareció, así que aquí siempre hay comisión > 0.)
  if (req.status === 'awaitingRequester') {
    const commission = (req.commission ?? {}) as Hand;
    const commissionEntries = RESOURCES.map(
      (r) => [r, commission[r] ?? 0] as const
    ).filter(([, n]) => n > 0);
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
        <div
          ref={dialogRef}
          role="status"
          aria-live="polite"
          aria-labelledby="port-incoming-wait-title"
          className="anim-slide-up w-full max-w-sm rounded-2xl border border-amber-500/30 bg-neutral-900 p-4 shadow-2xl"
        >
          <h2
            id="port-incoming-wait-title"
            className="flex items-center gap-2 text-base font-semibold text-amber-100"
          >
            <span
              className="anim-breathe inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-300"
              aria-hidden
            />
            Esperando que {requesterName} confirme la comisión…
          </h2>
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-amber-200">
              Tu comisión
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
              {requesterName} debe aceptar pagar antes de que se haga el cambio.
            </p>
          </div>
        </div>
      </div>
    );
  }

  function adjust(r: Resource, delta: number) {
    setCommission((prev) => {
      const cur = prev[r] ?? 0;
      return { ...prev, [r]: Math.max(0, cur + delta) };
    });
  }

  const commissionTotal = (Object.values(commission) as number[]).reduce(
    (a, b) => a + b,
    0
  );

  // Sólo enviamos los recursos con cantidad > 0 como comisión (Partial<Hand>).
  function buildCommission(): Partial<Hand> {
    const out: Partial<Hand> = {};
    for (const r of RESOURCES) {
      const n = commission[r] ?? 0;
      if (n > 0) out[r] = n;
    }
    return out;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="port-incoming-title"
        aria-describedby="port-incoming-desc"
        className="anim-slide-up max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl"
      >
        <h2 id="port-incoming-title" className="text-base font-semibold">
          Te piden usar tu puerto
        </h2>
        <p
          id="port-incoming-desc"
          className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-neutral-300"
        >
          <span className="inline-flex items-center gap-1.5 font-medium text-neutral-100">
            {requester ? <ColorChip color={requester.color} size={14} /> : null}
            {requesterName}
          </span>
          quiere usar tu puerto {req.ratio}:1.
        </p>

        <div className="mt-3 rounded-lg border border-white/10 bg-surface-1 p-3">
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-200">
            Da {req.ratio}
            <ResourceIcon resource={req.give} size={18} />
            {RESOURCE_NAMES[req.give]}, recibe 1
            <ResourceIcon resource={req.receive} size={18} />
            {RESOURCE_NAMES[req.receive]}.
          </p>
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Comisión (opcional)
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            Cartas que {requesterName} te pagará por prestar tu puerto. Déjalo en
            cero para prestarlo gratis.
          </p>
          <div className="mt-1.5 space-y-1.5">
            {RESOURCES.map((r) => {
              const cur = commission[r] ?? 0;
              return (
                <div
                  key={r}
                  className="flex items-center gap-2 rounded-md border border-white/10 bg-neutral-950 p-1.5"
                >
                  <ResourceIcon resource={r} size={24} />
                  <span className="flex-1 text-xs">{RESOURCE_NAMES[r]}</span>
                  <button
                    type="button"
                    onClick={() => adjust(r, -1)}
                    disabled={cur === 0}
                    aria-label={`Quitar 1 ${RESOURCE_NAMES[r]} de la comisión`}
                    className="h-11 w-11 rounded-md border border-white/10 bg-surface-3 text-base disabled:opacity-40"
                  >
                    <span aria-hidden>−</span>
                  </button>
                  <span
                    className="nums w-6 text-center text-sm font-semibold"
                    aria-label={`${cur} ${RESOURCE_NAMES[r]}`}
                  >
                    {cur}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjust(r, +1)}
                    aria-label={`Agregar 1 ${RESOURCE_NAMES[r]} a la comisión`}
                    className="h-11 w-11 rounded-md border border-white/10 bg-surface-3 text-base"
                  >
                    <span aria-hidden>+</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => respondPort(true, buildCommission())}
            className="min-h-[48px] w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900"
          >
            {commissionTotal > 0 ? 'Aprobar y cobrar comisión' : 'Aprobar gratis'}
          </button>
          <button
            type="button"
            onClick={() => respondPort(false)}
            className="min-h-[48px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium text-neutral-200"
          >
            No prestar
          </button>
        </div>
      </div>
    </div>
  );
}
