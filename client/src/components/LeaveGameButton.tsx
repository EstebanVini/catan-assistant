import { useRef, useState } from 'react';
import { useStore } from '../store';
import { useModalA11y } from '../lib/useModalA11y';

// "Salir de la partida" — disponible para TODOS los jugadores (no solo el
// anfitrión) mientras la partida está en curso. Devuelve los recursos y cartas
// del jugador al banco y lo quita del orden de turnos; la partida sigue para
// los demás. Vive junto a EndGameButton al final del GameScreen, discreto.
export function LeaveGameButton(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const leaveGame = useStore((s) => s.leaveGame);
  const [confirming, setConfirming] = useState(false);
  if (!view || !view.me || view.state.status !== 'playing') return null;

  return (
    <div className="mx-3 mt-4">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-[48px] w-full rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200 transition-colors active:bg-red-500/20"
      >
        Salir de la partida
      </button>
      <p className="mt-1.5 text-center text-[10px] leading-snug text-neutral-500">
        Devuelve tus cartas al banco y te quita del orden de turnos.
      </p>
      {confirming ? (
        <ConfirmLeaveGame
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            leaveGame();
            setConfirming(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ConfirmLeaveGame({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, onCancel);
  return (
    <div
      className="anim-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3"
      onClick={onCancel}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-game-title"
        aria-describedby="leave-game-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-xs rounded-2xl border border-red-500/30 bg-neutral-900 p-4 shadow-2xl"
      >
        <h3 id="leave-game-title" className="text-base font-semibold text-neutral-50">
          ¿Salir de la partida?
        </h3>
        <p id="leave-game-desc" className="mt-2 text-sm leading-relaxed text-neutral-300">
          Tus recursos y cartas de desarrollo volverán al banco y dejarás tu
          lugar en el orden de turnos. La partida sigue para los demás. Esta
          acción no se puede deshacer.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[48px] flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white transition-all active:scale-[0.99]"
          >
            Sí, salir
          </button>
        </div>
      </div>
    </div>
  );
}
