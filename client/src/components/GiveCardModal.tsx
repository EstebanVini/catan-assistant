import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { RESOURCES, Resource } from '../types';
import { RESOURCE_NAMES, RESOURCE_NAMES_LOWER } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { ColorChip } from './ColorChip';
import { useModalA11y } from '../lib/useModalA11y';

// Modal "Entregar carta del banco" (Fase 3, brief §4). Tres decisiones en una
// pantalla, sin wizard: jugador → carta → CTA con el resumen exacto.
//
//  - Una carta por operación; el modal queda abierto tras confirmar (estado
//    `success`) para entregas consecutivas al mismo jugador.
//  - El bank manager puede entregarse a sí mismo (la transparencia del notice
//    es la defensa real).
//  - Recurso con banco en 0: seleccionable (atenuado); el CTA pasa por una
//    confirmación inline de forzado que reenvía con `force: true`.
//  - Dev card: la carta superior del mazo (no se elige el tipo). Sin forzado.
//  - Los errores del servidor llegan por el evento 'error' (toast); aquí se
//    correlacionan por ventana temporal (mismo patrón que el snap-back de
//    color del Lobby). Si el server sugiere forzar, se muestra el flujo de
//    forzado en lugar del estado `ready`.

type CardSelection = { kind: 'resource'; resource: Resource } | { kind: 'dev' };

type Mode = 'idle' | 'submitting' | 'forcing' | 'success';

export function GiveCardModal({ onClose }: { onClose: () => void }): JSX.Element | null {
  const view = useStore((s) => s.view);
  const giveCard = useStore((s) => s.giveCard);
  const toasts = useStore((s) => s.toasts);

  const [targetId, setTargetId] = useState<string | null>(null);
  const [selection, setSelection] = useState<CardSelection | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [forceMessage, setForceMessage] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  // Correlación con errores del server (vía toasts): timestamp del último
  // submit; un error que llega dentro de la ventana se interpreta como
  // rechazo de ESTA entrega.
  const submitAtRef = useRef<number>(0);
  const successTimerRef = useRef<number | null>(null);
  const lastErrorToastIdRef = useRef<number | null>(null);

  useEffect(() => {
    const lastError = [...toasts].reverse().find((t) => t.kind === 'error');
    if (!lastError) return;
    if (lastErrorToastIdRef.current === lastError.id) return;
    lastErrorToastIdRef.current = lastError.id;
    if (mode !== 'submitting') return;
    if (Date.now() - submitAtRef.current > 2000) return;
    // Rechazado: cancelar el timer optimista de éxito.
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    if (
      selection?.kind === 'resource' &&
      /forzar|forz|no tiene|sin .*banco|banco/i.test(lastError.text)
    ) {
      setForceMessage(lastError.text);
      setMode('forcing');
    } else {
      setMode('idle');
    }
  }, [toasts, mode, selection]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  if (!view || !view.me) return null;
  const { state } = view;
  const target = targetId
    ? state.players.find((p) => p.id === targetId) ?? null
    : null;

  const stockOf = (r: Resource): number => state.bank[r];
  const selectedStockZero =
    selection?.kind === 'resource' && stockOf(selection.resource) === 0;

  const ready = target !== null && selection !== null;

  function summaryLabel(): string {
    if (!target || !selection) {
      if (!target && !selection) return 'Elige jugador y carta';
      if (!target) return 'Elige al jugador';
      return 'Elige la carta';
    }
    if (selection.kind === 'dev') {
      return `Entregar 1 carta de desarrollo a ${target.name}`;
    }
    return `Entregar 1 ${RESOURCE_NAMES_LOWER[selection.resource]} a ${target.name}`;
  }

  function emit(force: boolean): void {
    if (!target || !selection) return;
    submitAtRef.current = Date.now();
    setMode('submitting');
    giveCard({
      targetPlayerId: target.id,
      kind: selection.kind,
      resource: selection.kind === 'resource' ? selection.resource : undefined,
      force: force || undefined,
    });
    // Sin ack del servidor: éxito optimista si no llega 'error' en 900 ms.
    successTimerRef.current = window.setTimeout(() => {
      successTimerRef.current = null;
      setMode('success');
      setDelivered(true);
      // Selección de carta reseteada; jugador conservado (entregas
      // consecutivas al mismo jugador).
      setSelection(null);
      setForceMessage(null);
    }, 900);
  }

  function submit(): void {
    if (!ready || mode === 'submitting') return;
    if (selectedStockZero && selection?.kind === 'resource') {
      // Banco en 0: confirmación explícita ANTES de emitir.
      setForceMessage(
        `El banco no tiene ${RESOURCE_NAMES_LOWER[selection.resource]}. ¿Entregar de todas formas? Quedará registrado.`
      );
      setMode('forcing');
      return;
    }
    emit(false);
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
        aria-labelledby="give-card-title"
        onClick={(e) => e.stopPropagation()}
        className={
          'anim-scale-in max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-2xl border p-4 shadow-2xl ring-1 ring-white/5 transition-colors ' +
          (mode === 'success'
            ? 'border-emerald-500/50 bg-neutral-900'
            : 'border-white/10 bg-neutral-900')
        }
      >
        <h2
          id="give-card-title"
          className="text-base font-semibold tracking-tight text-neutral-50"
        >
          Entregar carta del banco
        </h2>

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
          ¿A quién?
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {state.players.map((p) => {
            const selected = targetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setTargetId(p.id);
                  if (mode === 'forcing') setMode('idle');
                }}
                className={
                  'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] ' +
                  (selected
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-50'
                    : 'border-white/10 bg-surface-2 text-neutral-100')
                }
              >
                <ColorChip color={p.color} size={14} />
                {p.name}
                {p.id === view.me!.id ? (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                    Tú
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
          ¿Qué carta?
        </p>
        <p className="mt-1 text-[10px] text-neutral-500">Recursos (stock del banco)</p>
        <div className="mt-1 grid grid-cols-5 gap-1.5">
          {RESOURCES.map((r) => {
            const stock = stockOf(r);
            const selected =
              selection?.kind === 'resource' && selection.resource === r;
            const empty = stock === 0;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={selected}
                aria-label={`${RESOURCE_NAMES[r]}, ${stock} en el banco${empty ? ' (requiere forzar)' : ''}`}
                onClick={() => {
                  setSelection({ kind: 'resource', resource: r });
                  setForceMessage(null);
                  if (mode === 'forcing' || mode === 'success') setMode('idle');
                }}
                className={
                  'flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-lg border transition-all active:scale-[0.97] ' +
                  (selected
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-50'
                    : 'border-white/10 bg-surface-2 text-neutral-100') +
                  (empty && !selected ? ' opacity-45' : '')
                }
              >
                <ResourceIcon resource={r} size={22} />
                <span className="nums text-[11px] font-semibold leading-none">
                  {stock}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-pressed={selection?.kind === 'dev'}
          onClick={() => {
            setSelection({ kind: 'dev' });
            setForceMessage(null);
            if (mode === 'forcing' || mode === 'success') setMode('idle');
          }}
          className={
            'mt-1.5 flex min-h-[48px] w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-all active:scale-[0.99] ' +
            (selection?.kind === 'dev'
              ? 'border-emerald-400 bg-emerald-500/15 text-emerald-50'
              : 'border-white/10 bg-surface-2 text-neutral-100')
          }
        >
          <span className="text-sm font-medium">Carta de desarrollo</span>
          <span className="text-[10px] text-neutral-400">
            al azar, de la cima del mazo ·{' '}
            <span className="nums font-semibold text-neutral-200">
              Mazo: {view.state.devDeckCount}
            </span>
          </span>
        </button>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-2.5 py-2">
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            aria-hidden
            className="mt-0.5 flex-shrink-0 text-amber-300"
          >
            <path
              d="M12 3.5 L22 20 L2 20 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <line x1="12" y1="9.5" x2="12" y2="14.5" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
            <circle cx="12" cy="17.2" r="1.2" fill="currentColor" />
          </svg>
          <p className="text-[11px] leading-snug text-amber-100">
            Todos los jugadores verán esta entrega.
          </p>
        </div>

        {mode === 'forcing' && forceMessage ? (
          <div className="anim-fade-in mt-3 rounded-lg border border-red-500/40 bg-red-500/[0.08] p-2.5">
            <p className="text-xs leading-snug text-red-100">{forceMessage}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('idle');
                  setForceMessage(null);
                }}
                className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-xs font-medium"
              >
                No, cancelar
              </button>
              <button
                type="button"
                onClick={() => emit(true)}
                className="min-h-[44px] flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white"
              >
                Forzar entrega sin banco
              </button>
            </div>
          </div>
        ) : null}

        {mode === 'success' ? (
          <p
            role="status"
            className="anim-fade-in mt-3 flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-xs font-medium text-emerald-100"
          >
            Carta entregada. Toda la mesa quedó avisada.
          </p>
        ) : null}

        {mode !== 'forcing' ? (
          <button
            type="button"
            disabled={!ready || mode === 'submitting'}
            onClick={submit}
            className={
              'mt-3 min-h-[52px] w-full rounded-xl px-3 py-2.5 text-sm font-bold tracking-tight transition-all active:scale-[0.99] ' +
              (ready && mode !== 'submitting'
                ? 'bg-emerald-500 text-neutral-950 shadow-cta active:bg-emerald-400'
                : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-400')
            }
          >
            {mode === 'submitting' ? 'Entregando…' : summaryLabel()}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-2 min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors active:bg-white/10"
        >
          {delivered ? 'Cerrar' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}
