import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Hand, Resource, Commodity, CommodityHand } from '../types';
import {
  RESOURCE_NAMES,
  RESOURCE_NAMES_LOWER,
  COMMODITY_NAMES,
  COMMODITY_NAMES_LOWER,
  joinList,
} from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { CommodityGlyph } from '../assets/icons';
import { safeVibrate } from '../lib/motion';
import { useModalA11y } from '../lib/useModalA11y';

// Un ítem comerciado en una oferta: recurso o mercancía (Caballeros y Ciudades).
// El emisor puede ofrecer/pedir ambos; aquí se renderizan en una sola lista.
type TradeChip =
  | { kind: 'resource'; key: Resource; n: number }
  | { kind: 'commodity'; key: Commodity; n: number };

// Combina recursos + mercancías de un lado de la oferta en chips, filtrando 0.
function buildChips(res?: Partial<Hand>, com?: Partial<CommodityHand>): TradeChip[] {
  const out: TradeChip[] = [];
  for (const [r, n] of Object.entries(res ?? {}) as [Resource, number][]) {
    if (n > 0) out.push({ kind: 'resource', key: r, n });
  }
  for (const [c, n] of Object.entries(com ?? {}) as [Commodity, number][]) {
    if (n > 0) out.push({ kind: 'commodity', key: c, n });
  }
  return out;
}

function chipKeyStr(chip: TradeChip): string {
  return `${chip.kind}-${chip.key}`;
}
function chipName(chip: TradeChip): string {
  return chip.kind === 'resource'
    ? RESOURCE_NAMES[chip.key]
    : COMMODITY_NAMES[chip.key];
}
function chipNameLower(chip: TradeChip): string {
  return chip.kind === 'resource'
    ? RESOURCE_NAMES_LOWER[chip.key]
    : COMMODITY_NAMES_LOWER[chip.key];
}

function ChipGlyph({ chip, size }: { chip: TradeChip; size: number }): JSX.Element {
  return chip.kind === 'resource' ? (
    <ResourceIcon resource={chip.key} size={size} />
  ) : (
    <CommodityGlyph commodity={chip.key} size={size} />
  );
}

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

  // Recursos + mercancías ofrecidos / pedidos. Fuera de C&K las mercancías
  // vienen vacías y la lista es idéntica a la de antes (solo recursos).
  const giveChips = buildChips(trade.give, trade.giveCommodities);
  const receiveChips = buildChips(trade.receive, trade.receiveCommodities);

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
        giveChips={giveChips}
        receiveChips={receiveChips}
        onCancel={() => cancel()}
      />
    );
  }

  return (
    <ReceiverDialog
      fromName={from.name}
      giveChips={giveChips}
      receiveChips={receiveChips}
      hand={me.hand}
      commodities={me.commodities}
      onAccept={() => respond(true)}
      onReject={() => respond(false)}
    />
  );
}

// Ítems del lado `receive` que el receptor NO puede cubrir con su mano (recursos
// + mercancías), con el faltante exacto. Se recalcula en cada render desde la
// mano, así el botón se habilita/deshabilita en vivo cuando cambian las cartas.
function missingChips(
  receiveChips: TradeChip[],
  hand: Hand,
  commodities: CommodityHand
): { chip: TradeChip; missing: number }[] {
  const out: { chip: TradeChip; missing: number }[] = [];
  for (const chip of receiveChips) {
    const have =
      chip.kind === 'resource'
        ? (hand[chip.key] ?? 0)
        : (commodities[chip.key] ?? 0);
    if (have < chip.n) out.push({ chip, missing: chip.n - have });
  }
  return out;
}

function SenderPanel({
  toName,
  rejectedCount,
  eligibleCount,
  giveChips,
  receiveChips,
  onCancel,
}: {
  toName: string | null;
  rejectedCount: number;
  eligibleCount: number;
  giveChips: TradeChip[];
  receiveChips: TradeChip[];
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
          <ChipLine label="Doy" chips={giveChips} />
          <ChipLine label="Recibo" chips={receiveChips} />
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
  giveChips,
  receiveChips,
  hand,
  commodities,
  onAccept,
  onReject,
}: {
  fromName: string;
  giveChips: TradeChip[];
  receiveChips: TradeChip[];
  hand: Hand;
  commodities: CommodityHand;
  onAccept: () => void;
  onReject: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  // ESC equivale a rechazar la oferta. Cumple SC 2.1.1 sin pérdida de
  // intencionalidad: rechazar es la opción "menos comprometedora".
  useModalA11y(ref, onReject);

  // Quien acepta entrega el lado `receive` de la oferta. Se recalcula en cada
  // render desde la mano: si el receptor pierde/gana cartas con el modal
  // abierto, el botón "Aceptar" se habilita/deshabilita en vivo.
  const missing = missingChips(receiveChips, hand, commodities);
  const canAfford = missing.length === 0;
  const missingText = joinList(
    missing.map(({ chip, missing: n }) => `${n} ${chipNameLower(chip)}`)
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
            <ChipList chips={giveChips} />
          </div>
          <div className="rounded-lg border border-white/10 bg-surface-3 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">
              Te pide
            </p>
            <ChipList chips={receiveChips} hand={hand} commodities={commodities} />
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
            No puedes aceptar: te {missing.length === 1 ? 'falta' : 'faltan'}{' '}
            {missingText
              ? <>{missingText} de lo que te pide.</>
              : <>cartas de lo que te pide.</>}
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

function ChipLine({
  label,
  chips,
}: {
  label: string;
  chips: TradeChip[];
}): JSX.Element {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-neutral-400">{label}:</span>
      {chips.length === 0 ? (
        <span className="text-neutral-500">nada</span>
      ) : (
        chips.map((chip) => (
          <span
            key={chipKeyStr(chip)}
            className="inline-flex items-center gap-0.5 rounded-md bg-surface-3 px-1 py-0.5"
          >
            <ChipGlyph chip={chip} size={16} />
            <span className="font-semibold">{chip.n}</span>
          </span>
        ))
      )}
    </div>
  );
}

function ChipList({
  chips,
  hand,
  commodities,
}: {
  chips: TradeChip[];
  // Si se pasan `hand`/`commodities`, los ítems que el receptor no puede cubrir
  // se marcan en rojo con el faltante. Sin ellos (lado "Te da") son neutros.
  hand?: Hand;
  commodities?: CommodityHand;
}): JSX.Element {
  const checking = hand !== undefined || commodities !== undefined;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {chips.length === 0 ? (
        <span className="text-xs text-neutral-500">nada</span>
      ) : (
        chips.map((chip) => {
          const have =
            chip.kind === 'resource'
              ? (hand?.[chip.key] ?? 0)
              : (commodities?.[chip.key] ?? 0);
          const short = checking ? Math.max(0, chip.n - have) : 0;
          return (
            <span
              key={chipKeyStr(chip)}
              className={
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ' +
                (short > 0
                  ? 'border border-red-500/40 bg-red-500/[0.08] text-red-200'
                  : 'bg-neutral-950')
              }
            >
              <ChipGlyph chip={chip} size={20} />
              <span className="font-semibold">{chip.n}</span>
              <span
                className={
                  'text-[10px] ' + (short > 0 ? 'text-red-300' : 'text-neutral-400')
                }
              >
                {chipName(chip)}
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
