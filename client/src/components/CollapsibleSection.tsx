import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { getCollapsePref, setCollapsePref } from '../lib/persistence';

// Colapsable compartido con preferencia por dispositivo (Fase 3, brief §5).
//
// Reglas:
//  - La preferencia vive en localStorage bajo `ui.collapse.<sectionId>` y
//    sobrevive entre partidas. Si localStorage está bloqueado, degrada a
//    estado en memoria sin avisos.
//  - `forceOpen` (p. ej. fase de ladrón) abre la sección SIN escribir la
//    preferencia; al terminar el forzado vuelve al estado preferido.
//  - El header conserva un resumen útil en estado cerrado: "cerrado nunca
//    significa ciego".
//  - Affordance unificada: mismo chevron y mismo tratamiento en todas las
//    secciones. La mano propia y las acciones de turno NUNCA usan este
//    componente.

// Hook expuesto para secciones que necesitan conocer/controlar el estado
// (p. ej. el Log, que resetea su contador de "nuevas" al abrir).
export function useCollapsePref(
  sectionId: string,
  defaultCollapsed: boolean
): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(
    () => getCollapsePref(sectionId) ?? defaultCollapsed
  );
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      setCollapsePref(sectionId, next);
      return next;
    });
  }, [sectionId]);
  return [collapsed, toggle];
}

interface Props {
  id: string;
  title: string;
  defaultCollapsed: boolean;
  // Forzado temporal (no escribe preferencia). Mientras esté activo, la
  // sección queda abierta y el toggle se ignora.
  forceOpen?: boolean;
  // Resumen siempre visible en el header (p. ej. "12 fichas").
  summary?: ReactNode;
  // Resumen adicional solo en estado cerrado (p. ej. "· ladrón en 6 mineral").
  collapsedSummary?: ReactNode;
  // Badge junto al título (p. ej. "+3 nuevas" del log).
  titleBadge?: ReactNode;
  // Modo controlado (opcional): el padre es dueño del estado.
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  children: ReactNode;
  className?: string;
}

export function CollapsibleSection({
  id,
  title,
  defaultCollapsed,
  forceOpen = false,
  summary,
  collapsedSummary,
  titleBadge,
  collapsed: controlledCollapsed,
  onToggleCollapsed,
  children,
  className,
}: Props): JSX.Element {
  const [internalCollapsed, internalToggle] = useCollapsePref(
    id,
    defaultCollapsed
  );
  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;
  const open = !collapsed || forceOpen;
  const panelId = `collapse-panel-${id}`;

  function handleToggle() {
    if (forceOpen) return;
    if (isControlled) onToggleCollapsed?.();
    else internalToggle();
  }

  return (
    <section
      id={`section-${id}`}
      className={
        'mx-3 mt-3 overflow-hidden rounded-xl border border-white/10 bg-surface-1 shadow-soft' +
        (className ? ' ' + className : '')
      }
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-3 transition-colors active:bg-white/[0.04]"
      >
        <span className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
          {title}
          {titleBadge}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
          {summary}
          {!open ? collapsedSummary : null}
          <Chevron open={open} dimmed={forceOpen} />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-white/10">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function Chevron({
  open,
  dimmed,
}: {
  open: boolean;
  dimmed: boolean;
}): JSX.Element {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      aria-hidden
      className={
        'flex-shrink-0 transition-transform duration-200 ' +
        (open ? 'rotate-180 ' : '') +
        (dimmed ? 'opacity-30' : 'opacity-70')
      }
    >
      <path
        d="M6 9 L12 15 L18 9"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
