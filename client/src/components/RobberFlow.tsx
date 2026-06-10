import { useRef, useState } from 'react';
import { useStore } from '../store';
import { ColorChip } from './ColorChip';
import { useModalA11y } from '../lib/useModalA11y';

// Modal de robo tras mover el ladrón. Aparece sólo cuando pendingRobberSteal y soy activo.
export function RobberFlow(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const stealFrom = useStore((s) => s.stealFrom);
  const [confirming, setConfirming] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Modal principal: forzado, no se cierra con ESC ni con tap fuera.
  useModalA11y(dialogRef, () => {
    /* no-op: paso obligatorio */
  });
  if (!view || !view.me) return null;
  const { state, me } = view;
  if (state.phase !== 'robber' || !state.pendingRobberSteal) return null;
  const activeId = state.turnOrder[state.currentTurnIndex];
  if (activeId !== me.id) return null;
  const robberHex = state.hexes.find((h) => h.robber);
  if (!robberHex) return null;
  const candidates = robberHex.owners
    .filter((o) => o.playerId !== me.id)
    .map((o) => state.players.find((p) => p.id === o.playerId))
    .filter((p): p is NonNullable<typeof p> => !!p);

  // De-duplicar (un jugador puede tener poblado y ciudad en el mismo hex)
  const unique = Array.from(
    new Map(candidates.map((p) => [p.id, p])).values()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="robber-modal-title"
        aria-describedby="robber-modal-desc"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl"
      >
        <h2 id="robber-modal-title" className="text-base font-semibold">
          Robar carta
        </h2>
        <p id="robber-modal-desc" className="mt-1 text-sm text-neutral-300">
          Elige a quién robarle 1 carta de esa ficha.
        </p>
        <div className="mt-3 space-y-1.5">
          {unique.length === 0 ? (
            <p className="text-xs text-neutral-400">
              Nadie tiene poblado o ciudad aquí.
            </p>
          ) : (
            unique.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (p.cardCount === 0) setConfirming(p.id);
                  else stealFrom(p.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors active:bg-white/10"
              >
                <ColorChip color={p.color} size={16} />
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                <span className="text-xs text-neutral-400">
                  {p.cardCount} {p.cardCount === 1 ? 'carta' : 'cartas'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
      {confirming ? (
        <ConfirmEmptySteal
          targetName={
            state.players.find((p) => p.id === confirming)?.name ?? 'Ese jugador'
          }
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            stealFrom(confirming);
            setConfirming(null);
          }}
        />
      ) : null}
    </div>
  );
}

// Sub-componente para que `useModalA11y` se monte/desmonte con el diálogo.
function ConfirmEmptySteal({
  targetName,
  onCancel,
  onConfirm,
}: {
  targetName: string;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, onCancel);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="robber-confirm-title"
        aria-describedby="robber-confirm-desc"
        className="w-full max-w-xs rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl"
      >
        <h3 id="robber-confirm-title" className="text-sm font-semibold">
          No tiene cartas
        </h3>
        <p id="robber-confirm-desc" className="mt-1 text-xs text-neutral-300">
          {targetName} no tiene cartas para robar. ¿Continuar de todos modos?
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900"
          >
            Continuar igual
          </button>
        </div>
      </div>
    </div>
  );
}
