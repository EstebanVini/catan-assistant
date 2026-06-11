import { useEffect } from 'react';
import { useStore } from '../store';

// Banner público prominente (Fase 3, brief §4). Distinto de los toasts:
//  - Full-width en la parte superior (bajo/encima del TopBar: puede cubrir el
//    contenido superior, nunca el corazón de la pantalla).
//  - 8 s de duración + botón de descarte. Si hay cola, cada notice se muestra
//    un mínimo de 2.5 s antes de avanzar al siguiente. Nunca dos superpuestos.
//  - Z-index por encima de cualquier modal (los modales usan z-40/z-50): la
//    transparencia no se negocia.
//  - Sin vibración: no exige acción de nadie.
export function NoticeBanner(): JSX.Element | null {
  const notices = useStore((s) => s.notices);
  const shiftNotice = useStore((s) => s.shiftNotice);
  const current = notices[0] ?? null;
  const queued = notices.length > 1;

  useEffect(() => {
    if (!current) return;
    // Con cola pendiente, avanzar a los 2.5 s; solo, 8 s completos.
    const ms = queued ? 2500 : 8000;
    const t = window.setTimeout(() => shiftNotice(), ms);
    return () => window.clearTimeout(t);
  }, [current?.id, queued, shiftNotice]);

  if (!current) return null;
  const warn = current.level === 'warn';

  return (
    <div
      role="status"
      aria-live="assertive"
      className={
        'anim-slide-down fixed inset-x-0 top-0 z-[95] border-b shadow-lg ' +
        (warn
          ? 'border-amber-400/50 bg-amber-500 text-neutral-950'
          : 'border-sky-400/50 bg-sky-600 text-white')
      }
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-3 py-2.5">
        <NoticeIcon warn={warn} />
        <p className="flex-1 text-[15px] font-semibold leading-snug">
          {current.text}
        </p>
        <button
          type="button"
          onClick={() => shiftNotice()}
          aria-label="Descartar aviso"
          className={
            'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-colors ' +
            (warn ? 'active:bg-black/10' : 'active:bg-white/15')
          }
        >
          <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
            <path
              d="M6 6 L18 18 M18 6 L6 18"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function NoticeIcon({ warn }: { warn: boolean }): JSX.Element {
  if (warn) {
    // Triángulo de advertencia.
    return (
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        aria-hidden
        className="flex-shrink-0"
      >
        <path
          d="M12 3.5 L22 20 L2 20 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <line
          x1="12"
          y1="9.5"
          x2="12"
          y2="14.5"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <circle cx="12" cy="17.2" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  // Círculo de información.
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      aria-hidden
      className="flex-shrink-0"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <line
        x1="12"
        y1="11"
        x2="12"
        y2="16.5"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.6" r="1.2" fill="currentColor" />
    </svg>
  );
}
