import { useRef, useState } from 'react';
import { useStore } from '../store';
import { useModalA11y } from '../lib/useModalA11y';

// "Finalizar partida" — SOLO el anfitrión, con confirmación explícita.
// Termina la partida sin darle la victoria a nadie (no se guarda ganador ni
// stats). Vive al final del GameScreen, discreto: es una salida de emergencia,
// no una acción de juego.
export function EndGameButton(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const endGame = useStore((s) => s.endGame);
  const [confirming, setConfirming] = useState(false);
  if (!view || !view.me) return null;
  const { state, me } = view;
  if (state.status !== 'playing' || state.hostId !== me.id) return null;

  return (
    <div className="mx-3 mt-4">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-[48px] w-full rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200 transition-colors active:bg-red-500/20"
      >
        Finalizar partida
      </button>
      <p className="mt-1.5 text-center text-[10px] leading-snug text-neutral-500">
        Solo el anfitrión ve este botón. Termina la partida sin ganador.
      </p>
      {confirming ? (
        <ConfirmEndGame
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            endGame();
            setConfirming(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ConfirmEndGame({
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
        aria-labelledby="end-game-title"
        aria-describedby="end-game-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-xs rounded-2xl border border-red-500/30 bg-neutral-900 p-4 shadow-2xl"
      >
        <h3 id="end-game-title" className="text-base font-semibold text-neutral-50">
          ¿Finalizar la partida?
        </h3>
        <p id="end-game-desc" className="mt-2 text-sm leading-relaxed text-neutral-300">
          La partida se cierra para todos y <strong>nadie gana</strong>: no se
          guardará ganador ni estadísticas. Esta acción no se puede deshacer.
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
            Sí, finalizar
          </button>
        </div>
      </div>
    </div>
  );
}
