import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { RESOURCES, COMMODITIES, Resource, Commodity, PortType, Hand } from '../types';
import type { PublicPlayer, PortUseRequest, CommodityHand, TradeItemKind } from '../types';
import { RESOURCE_NAMES, RESOURCE_NAMES_LOWER, COMMODITY_NAMES, portLabel } from '../lib/spanish';
import { ColorChip } from './ColorChip';
import { ResourceIcon } from './ResourceIcon';
import { CommodityGlyph } from '../assets/icons';
import { useModalA11y } from '../lib/useModalA11y';

// Modal de intercambio. Tabs: Banco / Puertos | Jugadores | Puerto de otro.
type TradeTab = 'bank' | 'players' | 'sharedPort';

// Un ítem comerciable con el banco: un recurso o, en Caballeros y Ciudades, una
// mercancía (moneda / papel / tela). El `kind` viaja al servidor en tradeBank.
type BankItem = { kind: TradeItemKind; item: Resource | Commodity };

export function TradeModal({ onClose }: { onClose: () => void }): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);
  const view = useStore((s) => s.view);
  const tradeBank = useStore((s) => s.tradeBank);
  const offerTrade = useStore((s) => s.offerTrade);
  const cancelTrade = useStore((s) => s.cancelTrade);
  const requestPort = useStore((s) => s.requestPort);
  const cancelPort = useStore((s) => s.cancelPort);
  const pushToast = useStore((s) => s.pushToast);
  const [tab, setTab] = useState<TradeTab>('bank');

  if (!view || !view.me) return null;
  const { state, me } = view;
  const ports = new Set(me.ports);

  const unequalAllowed = state.extraRules.unequalTrades;
  const sharedPortsAllowed = state.extraRules.sharedPorts;
  const citiesKnights = state.citiesKnights;
  // Las mejoras de ciudad viven en el jugador público (no en `me`). El nivel de
  // Comercio determina la Guilda (nivel 3 → 2:1 de mercancías).
  const miTrade =
    state.players.find((p) => p.id === me.id)?.improvements.trade ?? 0;

  // Proporción de banco/puertos para un ítem (recurso o mercancía). Espejo de
  // `bankTradeRatioCK` del servidor; el servidor revalida. Devuelve también el
  // motivo de un 2:1/3:1 (puerto / Guilda / comerciante / Flota Mercante).
  function bankRatioInfo(
    kind: TradeItemKind,
    item: Resource | Commodity
  ): { ratio: number; reason: string | null } {
    const mf = me.merchantFleet;
    if (mf && mf.kind === kind && mf.type === item)
      return { ratio: 2, reason: 'Flota Mercante' };
    if (kind === 'resource') {
      const r = item as Resource;
      if (
        state.merchant &&
        state.merchant.ownerId === me.id &&
        state.merchant.resource === r
      )
        return { ratio: 2, reason: `comerciante de ${RESOURCE_NAMES_LOWER[r]}` };
      if (ports.has(r)) return { ratio: 2, reason: `puerto 2:1 de ${RESOURCE_NAMES[r]}` };
      if (ports.has('3:1')) return { ratio: 3, reason: 'puerto 3:1' };
      return { ratio: 4, reason: null };
    }
    // Mercancía: la Guilda (Comercio nivel 3) da 2:1; el puerto 3:1 genérico
    // también aplica. Los puertos 2:1 de recurso NO cuentan para mercancías.
    if (miTrade >= 3) return { ratio: 2, reason: 'Guilda (Comercio nivel 3)' };
    if (ports.has('3:1')) return { ratio: 3, reason: 'puerto 3:1' };
    return { ratio: 4, reason: null };
  }

  function itemHave(b: BankItem): number {
    return b.kind === 'resource'
      ? me.hand[b.item as Resource]
      : me.commodities[b.item as Commodity];
  }
  function itemName(b: BankItem): string {
    return b.kind === 'resource'
      ? RESOURCE_NAMES[b.item as Resource]
      : COMMODITY_NAMES[b.item as Commodity];
  }
  function sameItem(a: BankItem, b: BankItem): boolean {
    return a.kind === b.kind && a.item === b.item;
  }

  // Estado del tab Banco
  const [bankGive, setBankGive] = useState<BankItem | null>(null);
  const [bankReceive, setBankReceive] = useState<BankItem | null>(null);

  // Estado del tab Jugadores
  const [give, setGive] = useState<Partial<Record<Resource, number>>>({});
  const [receive, setReceive] = useState<Partial<Record<Resource, number>>>({});
  // Mercancías ofrecidas/pedidas (solo C&K). Estados separados de los recursos.
  const [giveC, setGiveC] = useState<Partial<Record<Commodity, number>>>({});
  const [receiveC, setReceiveC] = useState<Partial<Record<Commodity, number>>>({});
  const [toId, setToId] = useState<string | null>(null);

  // Estado del tab "Puerto de otro"
  const [portOwnerId, setPortOwnerId] = useState<string | null>(null);
  const [portGive, setPortGive] = useState<Resource | null>(null);
  const [portReceive, setPortReceive] = useState<Resource | null>(null);

  const others = useMemo(
    () => state.players.filter((p) => p.id !== me.id),
    [state.players, me.id]
  );

  // Dueños (otros jugadores) que tienen al menos un puerto: únicos candidatos
  // para "usar su puerto".
  const portOwners = useMemo(
    () => others.filter((p) => p.ports.length > 0),
    [others]
  );

  const hasActiveOffer = !!state.activeTrade && state.activeTrade.fromId === me.id;

  // Solicitud de puerto en curso enviada por mí (esperando aprobación).
  const myPortRequest =
    state.activePortUse && state.activePortUse.requesterId === me.id
      ? state.activePortUse
      : null;

  function submitBank() {
    if (!bankGive || !bankReceive) return;
    if (sameItem(bankGive, bankReceive)) {
      pushToast(
        'error',
        bankGive.kind === 'commodity'
          ? 'Elige dos mercancías distintas.'
          : 'Elige dos recursos distintos.'
      );
      return;
    }
    const { ratio } = bankRatioInfo(bankGive.kind, bankGive.item);
    if (itemHave(bankGive) < ratio) {
      pushToast('error', `Te faltan ${ratio} ${itemName(bankGive)} para esa proporción.`);
      return;
    }
    // El banco de mercancías no se expone en la vista pública (sin tope que
    // mostrar); el servidor lo valida. Para recursos sí avisamos si se agotó.
    if (
      bankReceive.kind === 'resource' &&
      state.bank[bankReceive.item as Resource] < 1
    ) {
      pushToast('error', `El banco se quedó sin ${RESOURCE_NAMES[bankReceive.item as Resource]}.`);
      return;
    }
    tradeBank(bankGive.item, bankReceive.item, bankGive.kind, bankReceive.kind);
    onClose();
  }

  const sumCounts = (o: Partial<Record<string, number>>) =>
    (Object.values(o) as number[]).reduce((a, b) => a + b, 0);
  // El conteo de "oferta vacía / ambos lados" suma recursos + mercancías.
  const giveTotal = sumCounts(give) + sumCounts(giveC);
  const receiveTotal = sumCounts(receive) + sumCounts(receiveC);

  function submitOffer() {
    if (unequalAllowed) {
      // Con la regla activa basta con que UN lado tenga cartas: regalar
      // (recibo 0) o pedir sin dar (doy 0) son ofertas válidas.
      if (giveTotal === 0 && receiveTotal === 0) {
        pushToast('error', 'Tu oferta no tiene ninguna carta.');
        return;
      }
    } else if (giveTotal === 0 || receiveTotal === 0) {
      pushToast('error', 'Tu oferta necesita cartas en ambos lados.');
      return;
    }
    offerTrade(toId, give, receive, giveC, receiveC);
    onClose();
  }

  // Proporción del DUEÑO para el recurso que doy: 2 si tiene puerto de ESE
  // recurso, 3 si tiene puerto '3:1'. Si no aplica, null (no debería ocurrir
  // porque sólo listamos dueños con puerto, pero el recurso elegido podría no
  // estar cubierto por sus puertos).
  function ownerRatio(ownerPorts: PortType[], give: Resource): number | null {
    const set = new Set<PortType>(ownerPorts);
    if (set.has(give)) return 2;
    if (set.has('3:1')) return 3;
    return null;
  }

  const portOwner = portOwners.find((p) => p.id === portOwnerId) ?? null;
  const portRatio =
    portOwner && portGive ? ownerRatio(portOwner.ports, portGive) : null;

  function submitPortRequest() {
    if (!portOwnerId || !portGive || !portReceive) return;
    if (portGive === portReceive) {
      pushToast('error', 'Elige dos recursos distintos.');
      return;
    }
    if (portRatio === null) {
      pushToast('error', 'Ese jugador no tiene un puerto para ese recurso.');
      return;
    }
    if (me!.hand[portGive] < portRatio) {
      pushToast(
        'error',
        `Te faltan ${portRatio} ${RESOURCE_NAMES[portGive]} para esa proporción.`
      );
      return;
    }
    requestPort(portOwnerId, portGive, portReceive);
  }

  function adjustGive(r: Resource, delta: number) {
    setGive((prev) => {
      const cur = prev[r] ?? 0;
      const max = me!.hand[r];
      return { ...prev, [r]: Math.max(0, Math.min(max, cur + delta)) };
    });
  }

  function adjustReceive(r: Resource, delta: number) {
    setReceive((prev) => {
      const cur = prev[r] ?? 0;
      return { ...prev, [r]: Math.max(0, cur + delta) };
    });
  }

  function adjustGiveC(c: Commodity, delta: number) {
    setGiveC((prev) => {
      const cur = prev[c] ?? 0;
      const max = me!.commodities[c];
      return { ...prev, [c]: Math.max(0, Math.min(max, cur + delta)) };
    });
  }

  function adjustReceiveC(c: Commodity, delta: number) {
    setReceiveC((prev) => {
      const cur = prev[c] ?? 0;
      // Tope del banco de mercancías por tipo (Caballeros y Ciudades): 12.
      return { ...prev, [c]: Math.max(0, Math.min(12, cur + delta)) };
    });
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
        aria-labelledby="trade-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="trade-modal-title" className="text-base font-semibold">
            Intercambiar
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-300"
          >
            Cerrar
          </button>
        </div>
        <div className="mt-3 flex gap-1 rounded-lg bg-neutral-950 p-1">
          <TabButton active={tab === 'bank'} onClick={() => setTab('bank')}>
            Banco / Puertos
          </TabButton>
          <TabButton active={tab === 'players'} onClick={() => setTab('players')}>
            Jugadores
          </TabButton>
          {sharedPortsAllowed ? (
            <TabButton
              active={tab === 'sharedPort'}
              onClick={() => setTab('sharedPort')}
            >
              Puerto de otro
            </TabButton>
          ) : null}
        </div>

        {tab === 'bank' ? (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Doy
              </p>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {RESOURCES.map((r) => {
                  const have = me.hand[r];
                  const selected =
                    bankGive?.kind === 'resource' && bankGive.item === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBankGive({ kind: 'resource', item: r })}
                      aria-pressed={selected}
                      aria-label={`Doy ${RESOURCE_NAMES[r]} (tengo ${have})`}
                      className={
                        'flex min-h-[44px] flex-col items-center rounded-md border px-1 py-2 ' +
                        (selected
                          ? 'border-emerald-400 bg-emerald-500/10'
                          : 'border-white/10 bg-surface-3')
                      }
                    >
                      <ResourceIcon resource={r} size={24} />
                      <span className="nums mt-1 text-xs font-semibold">
                        {have}
                      </span>
                    </button>
                  );
                })}
              </div>
              {citiesKnights ? (
                <BankCommodityRow
                  mode="give"
                  commodities={me.commodities}
                  selected={bankGive}
                  onSelect={setBankGive}
                />
              ) : null}
              {bankGive ? (
                <BankRatioNote info={bankRatioInfo(bankGive.kind, bankGive.item)} />
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Recibo
              </p>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {RESOURCES.map((r) => {
                  const inBank = state.bank[r];
                  const selected =
                    bankReceive?.kind === 'resource' && bankReceive.item === r;
                  const disabled = inBank < 1;
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={disabled}
                      onClick={() => setBankReceive({ kind: 'resource', item: r })}
                      aria-pressed={selected}
                      aria-label={`Recibo ${RESOURCE_NAMES[r]} (banco tiene ${inBank})`}
                      className={
                        'flex min-h-[44px] flex-col items-center rounded-md border px-1 py-2 ' +
                        (selected
                          ? 'border-emerald-400 bg-emerald-500/10'
                          : 'border-white/10 bg-surface-3') +
                        (disabled ? ' opacity-40' : '')
                      }
                    >
                      <ResourceIcon resource={r} size={24} />
                      <span className="nums mt-1 text-[10px] text-neutral-400">
                        banco {inBank}
                      </span>
                    </button>
                  );
                })}
              </div>
              {citiesKnights ? (
                <BankCommodityRow
                  mode="receive"
                  commodities={me.commodities}
                  selected={bankReceive}
                  onSelect={setBankReceive}
                />
              ) : null}
            </div>
            <button
              type="button"
              disabled={
                !bankGive ||
                !bankReceive ||
                sameItem(bankGive, bankReceive) ||
                itemHave(bankGive) <
                  bankRatioInfo(bankGive.kind, bankGive.item).ratio ||
                (bankReceive.kind === 'resource' &&
                  state.bank[bankReceive.item as Resource] < 1)
              }
              onClick={submitBank}
              className="min-h-[48px] w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirmar intercambio
            </button>
          </div>
        ) : tab === 'players' ? (
          <div className="mt-3 space-y-3">
            {hasActiveOffer ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                Ya tienes una oferta enviada. Si envías otra, la anterior se cancela.
                <button
                  type="button"
                  onClick={() => cancelTrade()}
                  className="ml-2 rounded border border-amber-500/40 px-1.5 py-0.5"
                >
                  Cancelar la actual
                </button>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Doy
              </p>
              <ResourceSteppers
                value={give}
                onChange={adjustGive}
                maxFn={(r) => me.hand[r]}
              />
              {citiesKnights ? (
                <CommoditySteppers
                  value={giveC}
                  onChange={adjustGiveC}
                  maxFn={(c) => me.commodities[c]}
                />
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Recibo
              </p>
              <ResourceSteppers
                value={receive}
                onChange={adjustReceive}
                maxFn={() => 19}
              />
              {citiesKnights ? (
                <CommoditySteppers
                  value={receiveC}
                  onChange={adjustReceiveC}
                  maxFn={() => 12}
                />
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Para
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setToId(null)}
                  className={
                    'rounded-md border px-2 py-1.5 text-xs ' +
                    (toId === null
                      ? 'border-emerald-400 bg-emerald-500/10'
                      : 'border-white/10 bg-surface-3')
                  }
                >
                  A todos
                </button>
                {others.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setToId(p.id)}
                    className={
                      'inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs ' +
                      (toId === p.id
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 bg-surface-3')
                    }
                  >
                    <ColorChip color={p.color} size={10} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            {unequalAllowed && giveTotal > 0 && receiveTotal === 0 ? (
              <p
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200"
                role="status"
              >
                Estás regalando cartas.
              </p>
            ) : null}
            {unequalAllowed && receiveTotal > 0 && giveTotal === 0 ? (
              <p
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200"
                role="status"
              >
                Estás pidiendo sin dar nada a cambio.
              </p>
            ) : null}
            <button
              type="button"
              onClick={submitOffer}
              className="min-h-[48px] w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900"
            >
              Enviar oferta
            </button>
          </div>
        ) : (
          <SharedPortTab
            myPortRequest={myPortRequest}
            ownerName={
              myPortRequest
                ? (state.players.find((p) => p.id === myPortRequest.ownerId)
                    ?.name ?? 'el dueño')
                : ''
            }
            portOwners={portOwners}
            portOwner={portOwner}
            portOwnerId={portOwnerId}
            setPortOwnerId={(id) => {
              setPortOwnerId(id);
              setPortGive(null);
              setPortReceive(null);
            }}
            portGive={portGive}
            setPortGive={setPortGive}
            portReceive={portReceive}
            setPortReceive={setPortReceive}
            portRatio={portRatio}
            myHand={me.hand}
            ownerRatio={ownerRatio}
            onRequest={submitPortRequest}
            onCancel={() => cancelPort()}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
        (active
          ? 'bg-white/10 text-neutral-100'
          : 'text-neutral-400 active:bg-white/5')
      }
    >
      {children}
    </button>
  );
}

function ResourceSteppers({
  value,
  onChange,
  maxFn,
}: {
  value: Partial<Record<Resource, number>>;
  onChange: (r: Resource, delta: number) => void;
  maxFn: (r: Resource) => number;
}): JSX.Element {
  return (
    <div className="mt-1.5 space-y-1.5">
      {RESOURCES.map((r) => {
        const cur = value[r] ?? 0;
        const max = maxFn(r);
        return (
          <div
            key={r}
            className="flex items-center gap-2 rounded-md border border-white/10 bg-neutral-950 p-1.5"
          >
            <ResourceIcon resource={r} size={24} />
            <span className="flex-1 text-xs">{RESOURCE_NAMES[r]}</span>
            <span className="text-[10px] text-neutral-500">máx {max}</span>
            <button
              type="button"
              onClick={() => onChange(r, -1)}
              disabled={cur === 0}
              aria-label={`Quitar 1 ${RESOURCE_NAMES[r]}`}
              className="h-11 w-11 rounded-md border border-white/10 bg-surface-3 text-base disabled:opacity-40"
            >
              <span aria-hidden>−</span>
            </button>
            <span
              className="w-6 text-center text-sm font-semibold nums"
              aria-label={`${cur} ${RESOURCE_NAMES[r]}`}
            >
              {cur}
            </span>
            <button
              type="button"
              onClick={() => onChange(r, +1)}
              disabled={cur >= max}
              aria-label={`Agregar 1 ${RESOURCE_NAMES[r]}`}
              className="h-11 w-11 rounded-md border border-white/10 bg-surface-3 text-base disabled:opacity-40"
            >
              <span aria-hidden>+</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Nota de proporción del banco/puertos. Refleja `bankRatioInfo` (espejo de
// `bankTradeRatioCK` del servidor) y, cuando es 2:1/3:1, dice por qué.
function BankRatioNote({
  info,
}: {
  info: { ratio: number; reason: string | null };
}): JSX.Element {
  return (
    <p className="mt-1.5 text-[11px] text-neutral-400">
      Proporción {info.ratio}:1{info.reason ? ` (${info.reason})` : ''}
    </p>
  );
}

// Fila de mercancías (moneda / papel / tela) para el tab Banco / Puertos en
// Caballeros y Ciudades. Se muestra debajo de los 5 recursos, con anillo dorado
// heráldico (`CommodityGlyph`) y nombre, porque el arte de mercancía se recicla
// del de un recurso: el nombre evita confundir cuál es cuál. La selección es
// mutuamente exclusiva con la fila de recursos (mismo estado `BankItem`).
function BankCommodityRow({
  mode,
  commodities,
  selected,
  onSelect,
}: {
  mode: 'give' | 'receive';
  commodities: CommodityHand;
  selected: BankItem | null;
  onSelect: (item: BankItem) => void;
}): JSX.Element {
  return (
    <div className="mt-2 rounded-lg border border-commodity-coin/20 bg-commodity-coin/[0.04] p-1.5">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-commodity-coin/90">
        Mercancías
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {COMMODITIES.map((c) => {
          const isSel = selected?.kind === 'commodity' && selected.item === c;
          const have = commodities[c];
          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelect({ kind: 'commodity', item: c })}
              aria-pressed={isSel}
              aria-label={
                mode === 'give'
                  ? `Doy ${COMMODITY_NAMES[c]} (tengo ${have})`
                  : `Recibo ${COMMODITY_NAMES[c]}`
              }
              className={
                'flex min-h-[44px] flex-col items-center rounded-md border px-1 py-2 ' +
                (isSel
                  ? 'border-commodity-coin bg-commodity-coin/15'
                  : 'border-commodity-coin/25 bg-surface-3')
              }
            >
              <CommodityGlyph commodity={c} size={22} />
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-neutral-400">
                {COMMODITY_NAMES[c]}
              </span>
              {mode === 'give' ? (
                <span className="nums text-xs font-semibold">{have}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Steppers de mercancías para el tab Jugadores (Caballeros y Ciudades). Mismo
// patrón que `ResourceSteppers` pero con `CommodityGlyph` y acento dorado, bajo
// su propio encabezado para separarlas de los recursos.
function CommoditySteppers({
  value,
  onChange,
  maxFn,
}: {
  value: Partial<Record<Commodity, number>>;
  onChange: (c: Commodity, delta: number) => void;
  maxFn: (c: Commodity) => number;
}): JSX.Element {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-commodity-coin/90">
        Mercancías
      </p>
      <div className="space-y-1.5">
        {COMMODITIES.map((c) => {
          const cur = value[c] ?? 0;
          const max = maxFn(c);
          return (
            <div
              key={c}
              className="flex items-center gap-2 rounded-md border border-commodity-coin/25 bg-neutral-950 p-1.5"
            >
              <CommodityGlyph commodity={c} size={24} />
              <span className="flex-1 text-xs">{COMMODITY_NAMES[c]}</span>
              <span className="text-[10px] text-neutral-500">máx {max}</span>
              <button
                type="button"
                onClick={() => onChange(c, -1)}
                disabled={cur === 0}
                aria-label={`Quitar 1 ${COMMODITY_NAMES[c]}`}
                className="h-11 w-11 rounded-md border border-white/10 bg-surface-3 text-base disabled:opacity-40"
              >
                <span aria-hidden>−</span>
              </button>
              <span
                className="w-6 text-center text-sm font-semibold nums"
                aria-label={`${cur} ${COMMODITY_NAMES[c]}`}
              >
                {cur}
              </span>
              <button
                type="button"
                onClick={() => onChange(c, +1)}
                disabled={cur >= max}
                aria-label={`Agregar 1 ${COMMODITY_NAMES[c]}`}
                className="h-11 w-11 rounded-md border border-white/10 bg-surface-3 text-base disabled:opacity-40"
              >
                <span aria-hidden>+</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tab "Puerto de otro": el solicitante elige un dueño con puerto, el recurso que
// da y el que recibe, y pide permiso para usar su puerto (flujo de 3 pasos):
// solicitante pide → dueño aprueba y fija comisión → si hay comisión, el
// solicitante la confirma antes de pagar; si es gratis, el backend ejecuta
// directo. Aquí sólo enviamos la solicitud y mostramos el estado de espera.
function SharedPortTab({
  myPortRequest,
  ownerName,
  portOwners,
  portOwner,
  portOwnerId,
  setPortOwnerId,
  portGive,
  setPortGive,
  portReceive,
  setPortReceive,
  portRatio,
  myHand,
  ownerRatio,
  onRequest,
  onCancel,
}: {
  myPortRequest: PortUseRequest | null;
  ownerName: string;
  portOwners: PublicPlayer[];
  portOwner: PublicPlayer | null;
  portOwnerId: string | null;
  setPortOwnerId: (id: string | null) => void;
  portGive: Resource | null;
  setPortGive: (r: Resource) => void;
  portReceive: Resource | null;
  setPortReceive: (r: Resource) => void;
  portRatio: number | null;
  myHand: Hand;
  ownerRatio: (ownerPorts: PortType[], give: Resource) => number | null;
  onRequest: () => void;
  onCancel: () => void;
}): JSX.Element {
  // Estado de espera: ya envié una solicitud. Dos sub-estados (flujo de 3 pasos):
  //  - 'awaitingOwner':     el dueño aún no responde. Puedo cancelar.
  //  - 'awaitingRequester': el dueño fijó comisión y debo confirmarla; el modal
  //                         `PortFeeConfirmModal` aparece encima de este panel.
  if (myPortRequest) {
    const awaitingOwner = myPortRequest.status === 'awaitingOwner';
    return (
      <div className="mt-3 space-y-3">
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"
          role="status"
          aria-live="polite"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-amber-100">
            <span
              className="anim-breathe inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-300"
              aria-hidden
            />
            {awaitingOwner
              ? `Esperando que ${ownerName} responda…`
              : 'Confirma la comisión'}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-200/90">
            Das {myPortRequest.ratio} <ResourceIcon
              resource={myPortRequest.give}
              size={16}
            />
            {RESOURCE_NAMES[myPortRequest.give]}, recibes 1{' '}
            <ResourceIcon resource={myPortRequest.receive} size={16} />
            {RESOURCE_NAMES[myPortRequest.receive]}.
          </p>
          <p className="mt-1 text-[11px] text-amber-200/70">
            {awaitingOwner
              ? `${ownerName} puede aprobarlo gratis o pedirte una comisión que tú confirmas antes de pagar.`
              : `${ownerName} fijó una comisión. Revísala en la ventana de confirmación.`}
          </p>
        </div>
        {awaitingOwner ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium text-neutral-200"
          >
            Cancelar solicitud
          </button>
        ) : null}
      </div>
    );
  }

  // Sin dueños con puerto: empty state.
  if (portOwners.length === 0) {
    return (
      <div className="mt-3">
        <p className="rounded-lg border border-white/10 bg-surface-1 px-3 py-3 text-center text-xs text-neutral-300">
          Ningún otro jugador tiene puertos registrados.
        </p>
      </div>
    );
  }

  const ratioOk = portRatio !== null;
  const giveOk = portGive !== null && portRatio !== null && myHand[portGive] >= portRatio;
  const canRequest =
    !!portOwnerId &&
    !!portGive &&
    !!portReceive &&
    portGive !== portReceive &&
    ratioOk &&
    giveOk;

  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Dueño del puerto
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {portOwners.map((p) => {
            const selected = portOwnerId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPortOwnerId(p.id)}
                aria-pressed={selected}
                className={
                  'inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ' +
                  (selected
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-white/10 bg-surface-3')
                }
              >
                <ColorChip color={p.color} size={12} />
                <span className="font-medium">{p.name}</span>
                <span className="text-[10px] text-neutral-400">
                  {p.ports.map((port) => portLabel(port).replace('Puerto ', '')).join(' · ')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {portOwner ? (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Doy
            </p>
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
              {RESOURCES.map((r) => {
                const have = myHand[r];
                const selected = portGive === r;
                const r2 = ownerRatio(portOwner.ports, r);
                const disabled = r2 === null;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={disabled}
                    onClick={() => setPortGive(r)}
                    aria-pressed={selected}
                    aria-label={`Doy ${RESOURCE_NAMES[r]} (tengo ${have})`}
                    className={
                      'flex min-h-[44px] flex-col items-center rounded-md border px-1 py-2 ' +
                      (selected
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 bg-surface-3') +
                      (disabled ? ' opacity-40' : '')
                    }
                  >
                    <ResourceIcon resource={r} size={24} />
                    <span className="nums mt-1 text-xs font-semibold">{have}</span>
                  </button>
                );
              })}
            </div>
            {portGive ? (
              portRatio !== null ? (
                <p className="mt-1 text-[11px] text-neutral-400">
                  Proporción del dueño {portRatio}:1
                  {portRatio === 2
                    ? ` (su puerto 2:1 de ${RESOURCE_NAMES[portGive]})`
                    : ' (su puerto 3:1)'}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-amber-300">
                  {portOwner.name} no tiene un puerto para {RESOURCE_NAMES[portGive]}.
                </p>
              )
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Recibo
            </p>
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
              {RESOURCES.map((r) => {
                const selected = portReceive === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPortReceive(r)}
                    aria-pressed={selected}
                    aria-label={`Recibo ${RESOURCE_NAMES[r]}`}
                    className={
                      'flex min-h-[44px] flex-col items-center rounded-md border px-1 py-2 ' +
                      (selected
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 bg-surface-3')
                    }
                  >
                    <ResourceIcon resource={r} size={24} />
                  </button>
                );
              })}
            </div>
          </div>

          <p className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-2 text-xs text-sky-200">
            {portOwner.name} puede aprobarlo gratis o pedirte una comisión. Si
            la pide, tú la confirmas antes de pagar.
          </p>
        </>
      ) : (
        <p className="rounded-md border border-white/10 bg-surface-1 px-3 py-3 text-center text-xs text-neutral-400">
          Elige un dueño para armar el intercambio.
        </p>
      )}

      <button
        type="button"
        disabled={!canRequest}
        onClick={onRequest}
        className="min-h-[48px] w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {portOwner ? `Pedir usar el puerto de ${portOwner.name}` : 'Pedir usar su puerto'}
      </button>
    </div>
  );
}
