import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Hand, Resource } from '../types';
import { RESOURCE_NAMES, RESOURCE_NAMES_LOWER, joinList } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { safeVibrate } from '../lib/motion';
import { useModalA11y } from '../lib/useModalA11y';

// Modal bloqueante para el receptor de una oferta. El emisor también lo ve, pero como "en espera".
export function TradeIncomingModal(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const respond = useStore((s) => s.respondTrade);
  const cancel = useStore((s) => s.cancelTrade);
  // Vibración corta al recibir una nueva oferta. Memoiza el id del trade
  // activo para sólo disparar en la transición (no en re-renders).
  const prevTradeIdRef = useRef<string | null>(null);
  const meId = view?.me?.id ?? null;
  const trade = view?.state.activeTrade ?? null;
  const tradeId = trade?.id ?? null;
  const isReceiverForVibration =
    !!trade &&
    !!meId &&
    trade.fromId !== meId &&
    (trade.toId === meId || trade.toId === null);

  useEffect(() => {
    if (tradeId && tradeId !== prevTradeIdRef.current) {
      if (isReceiverForVibration) safeVibrate(80);
      prevTradeIdRef.current = tradeId;
    } else if (!tradeId) {
      prevTradeIdRef.current = null;
    }
  }, [tradeId, isReceiverForVibration]);

  if (!view || !view.me) return null;
  const { state, me } = view;
  if (!trade) return null;
  const from = state.players.find((p) => p.id === trade.fromId);
  if (!from) return null;
  const iAmSender = trade.fromId === me.id;
  const iAmReceiver = trade.toId === me.id || (trade.toId === null && trade.fromId !== me.id);

  if (!iAmSender && !iAmReceiver) return null;
  // El rechazo es individual: a quien ya rechazó se le oculta la oferta; el
  // resto la sigue viendo hasta aceptar o rechazar (el server la retira
  // cuando todos los elegibles rechazaron).
  const rejectedBy = trade.rejectedBy ?? [];
  if (iAmReceiver && rejectedBy.includes(me.id)) return null;

  const giveEntries = (Object.entries(trade.give) as [Resource, number][]).filter(
    ([, n]) => n > 0
  );
  const receiveEntries = (Object.entries(trade.receive) as [Resource, number][]).filter(
    ([, n]) => n > 0
  );

  if (iAmSender) {
    const eligibleCount = trade.toId ? 1 : state.players.length - 1;
    return (
      <SenderPanel
        toName={
          trade.toId
            ? (state.players.find((p) => p.id === trade.toId)?.name ?? '...')
            : null
        }
        rejectedCount={rejectedBy.length}
        eligibleCount={eligibleCount}
        giveEntries={giveEntries}
        receiveEntries={receiveEntries}
        onCancel={() => cancel()}
      />
    );
  }

  return (
    <ReceiverDialog
      fromName={from.name}
      giveEntries={giveEntries}
      receiveEntries={receiveEntries}
      hand={me.hand}
      onAccept={() => respond(true)}
      onReject={() => respond(false)}
    />
  );
}

// Recursos de `receive` que el receptor NO puede cubrir con su mano, con el
// faltante exacto. Se recalcula en cada render desde `hand`, así el botón se
// habilita/deshabilita en vivo cuando cambian las cartas.
function missingResources(
  receiveEntries: [Resource, number][],
  hand: Hand
): { r: Resource; missing: number }[] {
  const out: { r: Resource; missing: number }[] = [];
  for (const [r, n] of receiveEntries) {
    const have = hand[r] ?? 0;
    if (have < n) out.push({ r, missing: n - have });
  }
  return out;
}

function SenderPanel({
  toName,
  rejectedCount,
  eligibleCount,
  giveEntries,
  receiveEntries,
  onCancel,
}: {
  toName: string | null;
  rejectedCount: number;
  eligibleCount: number;
  giveEntries: [Resource, number][];
  receiveEntries: [Resource, number][];
  onCancel: () => void;
}): JSX.Element {
  // Es un panel sticky, no un modal: no atrapa foco. Pero es un live region
  // para que lectores de pantalla anuncien el cambio de estado de la oferta.
  return (
    <div
      role="status"
      aria-live="polite"
      className="anim-slide-up fixed inset-x-3 bottom-3 z-30 mx-auto max-w-md rounded-2xl border border-white/10 bg-neutral-900/95 p-3 shadow-xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
            {toName ? `Esperando a ${toName}` : 'Esperando respuesta'}
          </p>
          {rejectedCount > 0 ? (
            <p className="mt-0.5 text-[11px] text-neutral-400">
              {rejectedCount} de {eligibleCount}{' '}
              {rejectedCount === 1 ? 'rechazó' : 'rechazaron'} la oferta.
            </p>
          ) : null}
          <ResourceLine label="Doy" entries={giveEntries} />
          <ResourceLine label="Recibo" entries={receiveEntries} />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-white/10 bg-surface-3 px-2 py-1 text-xs"
        >
          Cancelar oferta
        </button>
      </div>
    </div>
  );
}

function ReceiverDialog({
  fromName,
  giveEntries,
  receiveEntries,
  hand,
  onAccept,
  onReject,
}: {
  fromName: string;
  giveEntries: [Resource, number][];
  receiveEntries: [Resource, number][];
  hand: Hand;
  onAccept: () => void;
  onReject: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  // ESC equivale a rechazar la oferta. Cumple SC 2.1.1 sin pérdida de
  // intencionalidad: rechazar es la opción "menos comprometedora".
  useModalA11y(ref, onReject);

  // Quien acepta entrega el lado `receive` de la oferta. Se recalcula en cada
  // render desde `hand`: si el receptor pierde/gana cartas con el modal abierto,
  // el botón "Aceptar" se habilita/deshabilita en vivo.
  const missing = missingResources(receiveEntries, hand);
  const canAfford = missing.length === 0;
  const missingText = joinList(
    missing.map(({ r, missing: n }) => `${n} ${RESOURCE_NAMES_LOWER[r]}`)
  );

  return (
    <div className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-in-title"
        className="anim-scale-in w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl"
      >
        <h2 id="trade-in-title" className="text-base font-semibold">
          {fromName} te ofrece un intercambio
        </h2>
        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-white/10 bg-surface-3 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">
              Te da
            </p>
            <ChipList entries={giveEntries} />
          </div>
          <div className="rounded-lg border border-white/10 bg-surface-3 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">
              Te pide
            </p>
            <ChipList entries={receiveEntries} hand={hand} />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-neutral-400">
          Al aceptar entregas lo que te pide y recibes lo que te da.
        </p>
        {!canAfford ? (
          <p
            id="trade-in-cant-afford"
            className="mt-2 rounded-md border border-red-500/30 bg-red-500/[0.08] px-2.5 py-2 text-xs text-red-300"
            role="status"
          >
            No tienes las cartas necesarias.
            {missingText ? <> Te {missing.length === 1 ? 'falta' : 'faltan'} {missingText}.</> : null}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onReject}
            className="min-h-[48px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium"
          >
            Rechazar
          </button>
          {canAfford ? (
            <button
              type="button"
              onClick={onAccept}
              className="min-h-[48px] flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900"
            >
              Aceptar intercambio
            </button>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-describedby="trade-in-cant-afford"
              className="min-h-[48px] flex-1 cursor-not-allowed rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm font-semibold text-neutral-500"
            >
              Aceptar intercambio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceLine({
  label,
  entries,
}: {
  label: string;
  entries: [Resource, number][];
}): JSX.Element {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-xs">
      <span className="text-neutral-400">{label}:</span>
      {entries.length === 0 ? (
        <span className="text-neutral-500">nada</span>
      ) : (
        entries.map(([r, n]) => (
          <span
            key={r}
            className="inline-flex items-center gap-0.5 rounded-md bg-surface-3 px-1 py-0.5"
          >
            <ResourceIcon resource={r} size={16} />
            <span className="font-semibold">{n}</span>
          </span>
        ))
      )}
    </div>
  );
}

function ChipList({
  entries,
  hand,
}: {
  entries: [keyof Hand, number][];
  // Si se pasa `hand`, los recursos que el receptor no puede cubrir se marcan
  // en rojo con el faltante. Sin `hand` (lado "Te da") los chips son neutros.
  hand?: Hand;
}): JSX.Element {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {entries.length === 0 ? (
        <span className="text-xs text-neutral-500">nada</span>
      ) : (
        entries.map(([r, n]) => {
          const short = hand ? Math.max(0, n - (hand[r as Resource] ?? 0)) : 0;
          return (
            <span
              key={r}
              className={
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ' +
                (short > 0
                  ? 'border border-red-500/40 bg-red-500/[0.08] text-red-200'
                  : 'bg-neutral-950')
              }
            >
              <ResourceIcon resource={r} size={20} />
              <span className="font-semibold">{n}</span>
              <span
                className={
                  'text-[10px] ' + (short > 0 ? 'text-red-300' : 'text-neutral-400')
                }
              >
                {RESOURCE_NAMES[r as Resource]}
              </span>
              {short > 0 ? (
                <span className="text-[10px] font-medium text-red-300">
                  (te {short === 1 ? 'falta' : 'faltan'} {short})
                </span>
              ) : null}
            </span>
          );
        })
      )}
    </div>
  );
}
