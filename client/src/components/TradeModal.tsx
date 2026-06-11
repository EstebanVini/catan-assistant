import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { RESOURCES, Resource } from '../types';
import { RESOURCE_NAMES } from '../lib/spanish';
import { ColorChip } from './ColorChip';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Modal de intercambio. Tabs: Banco | Jugadores.
export function TradeModal({ onClose }: { onClose: () => void }): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);
  const view = useStore((s) => s.view);
  const tradeBank = useStore((s) => s.tradeBank);
  const offerTrade = useStore((s) => s.offerTrade);
  const cancelTrade = useStore((s) => s.cancelTrade);
  const pushToast = useStore((s) => s.pushToast);
  const [tab, setTab] = useState<'bank' | 'players'>('bank');

  if (!view || !view.me) return null;
  const { state, me } = view;
  const ports = new Set(me.ports);

  // Lógica de proporción local para mostrar (servidor también valida)
  function ratio(give: Resource): number {
    if (ports.has(give)) return 2;
    if (ports.has('3:1')) return 3;
    return 4;
  }

  // Estado del tab Banco
  const [bankGive, setBankGive] = useState<Resource | null>(null);
  const [bankReceive, setBankReceive] = useState<Resource | null>(null);

  // Estado del tab Jugadores
  const [give, setGive] = useState<Partial<Record<Resource, number>>>({});
  const [receive, setReceive] = useState<Partial<Record<Resource, number>>>({});
  const [toId, setToId] = useState<string | null>(null);

  const others = useMemo(
    () => state.players.filter((p) => p.id !== me.id),
    [state.players, me.id]
  );

  const hasActiveOffer = !!state.activeTrade && state.activeTrade.fromId === me.id;

  function submitBank() {
    if (!bankGive || !bankReceive) return;
    if (bankGive === bankReceive) {
      pushToast('error', 'Elige dos recursos distintos.');
      return;
    }
    const r = ratio(bankGive);
    if (me!.hand[bankGive] < r) {
      pushToast('error', `Te faltan ${r} ${RESOURCE_NAMES[bankGive]} para esa proporción.`);
      return;
    }
    if (state.bank[bankReceive] < 1) {
      pushToast('error', `El banco se quedó sin ${RESOURCE_NAMES[bankReceive]}.`);
      return;
    }
    tradeBank(bankGive, bankReceive);
    onClose();
  }

  function submitOffer() {
    const giveTotal = (Object.values(give) as number[]).reduce((a, b) => a + b, 0);
    const receiveTotal = (Object.values(receive) as number[]).reduce(
      (a, b) => a + b,
      0
    );
    if (giveTotal === 0 || receiveTotal === 0) {
      pushToast('error', 'Tu oferta necesita cartas en ambos lados.');
      return;
    }
    offerTrade(toId, give, receive);
    onClose();
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
                  const selected = bankGive === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBankGive(r)}
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
              {bankGive ? (
                <p className="mt-1 text-[11px] text-neutral-400">
                  Proporción {ratio(bankGive)}:1
                  {ratio(bankGive) === 2
                    ? ` (puerto 2:1 de ${RESOURCE_NAMES[bankGive]})`
                    : ratio(bankGive) === 3
                      ? ' (puerto 3:1)'
                      : ''}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Recibo
              </p>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {RESOURCES.map((r) => {
                  const inBank = state.bank[r];
                  const selected = bankReceive === r;
                  const disabled = inBank < 1;
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={disabled}
                      onClick={() => setBankReceive(r)}
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
            </div>
            <button
              type="button"
              disabled={
                !bankGive ||
                !bankReceive ||
                bankGive === bankReceive ||
                me.hand[bankGive] < ratio(bankGive) ||
                state.bank[bankReceive] < 1
              }
              onClick={submitBank}
              className="min-h-[48px] w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirmar intercambio
            </button>
          </div>
        ) : (
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
            <button
              type="button"
              onClick={submitOffer}
              className="min-h-[48px] w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900"
            >
              Enviar oferta
            </button>
          </div>
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
