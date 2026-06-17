import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import {
  COMMODITIES,
  Commodity,
  RESOURCES,
  Resource,
  commodityTotal,
  devCardsTotal,
  handTotal,
} from '../types';
import { COMMODITY_NAMES, DEV_CARD_NAMES, RESOURCE_NAMES } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { CommodityGlyph } from '../assets/icons';

// La mano propia. Sólo se modifica por el sistema (sin +/-).
export function HandView(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const me = view?.me ?? null;
  const cities = !!view?.state.citiesKnights;
  const prevHandRef = useRef<Record<Resource, number> | null>(null);
  const [deltas, setDeltas] = useState<Partial<Record<Resource, number>>>({});

  // Mercancías (C&K): mismo patrón de deltas que la mano, en su propio estado
  // para que recursos y mercancías se animen de forma independiente.
  const prevCommoditiesRef = useRef<Record<Commodity, number> | null>(null);
  const [commodityDeltas, setCommodityDeltas] = useState<
    Partial<Record<Commodity, number>>
  >({});

  useEffect(() => {
    if (!me) return;
    const prev = prevHandRef.current;
    if (prev) {
      const next: Partial<Record<Resource, number>> = {};
      let any = false;
      for (const r of RESOURCES) {
        const d = me.hand[r] - prev[r];
        if (d !== 0) {
          next[r] = d;
          any = true;
        }
      }
      if (any) {
        setDeltas(next);
        const t = window.setTimeout(() => setDeltas({}), 1400);
        return () => window.clearTimeout(t);
      }
    }
    prevHandRef.current = { ...me.hand };
  }, [me]);

  // Actualizar el ref cuando los deltas se borran (para que el siguiente cambio compare con la mano actual).
  useEffect(() => {
    if (me && Object.keys(deltas).length === 0) {
      prevHandRef.current = { ...me.hand };
    }
  }, [me, deltas]);

  // Deltas de mercancías (mismo mecanismo que la mano). Solo relevante en C&K,
  // pero el hook corre siempre (reglas de hooks); fuera de C&K nunca cambia.
  useEffect(() => {
    if (!me) return;
    const prev = prevCommoditiesRef.current;
    if (prev) {
      const next: Partial<Record<Commodity, number>> = {};
      let any = false;
      for (const c of COMMODITIES) {
        const d = me.commodities[c] - prev[c];
        if (d !== 0) {
          next[c] = d;
          any = true;
        }
      }
      if (any) {
        setCommodityDeltas(next);
        const t = window.setTimeout(() => setCommodityDeltas({}), 1400);
        return () => window.clearTimeout(t);
      }
    }
    prevCommoditiesRef.current = { ...me.commodities };
  }, [me]);

  useEffect(() => {
    if (me && Object.keys(commodityDeltas).length === 0) {
      prevCommoditiesRef.current = { ...me.commodities };
    }
  }, [me, commodityDeltas]);

  if (!me) return null;
  const total = handTotal(me.hand);
  const devTotal = devCardsTotal(me.devCards);
  const commodityTotalN = commodityTotal(me.commodities);

  return (
    <section className="mx-3 mt-3 rounded-xl border border-white/10 bg-surface-2 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3 shadow-card">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
          Tu mano
        </h2>
        <span className="text-[11px] text-neutral-400">
          Total{' '}
          <span className="nums ml-0.5 text-base font-bold text-neutral-50">
            {total}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {RESOURCES.map((r) => {
          const n = me.hand[r];
          const delta = deltas[r];
          const zero = n === 0;
          return (
            <div
              key={r}
              className={
                'relative flex flex-col items-center rounded-lg border bg-neutral-900/70 px-1 py-2 ' +
                (zero ? 'border-white/5 ' : 'border-white/15 ') +
                // Pulso corto del chip cuando cambia el conteo.
                (delta !== undefined ? 'anim-pulse-scale ' : '')
              }
              // `key` con el id de cambio fuerza el reinicio de la animación
              // cuando llega un nuevo delta sobre el mismo recurso.
              title={RESOURCE_NAMES[r]}
            >
              <ResourceIcon resource={r} size={32} />
              <span
                className={
                  'nums mt-1.5 text-[28px] font-bold leading-none tracking-tight ' +
                  (zero ? 'text-neutral-500' : 'text-neutral-50')
                }
              >
                {n}
              </span>
              {delta !== undefined ? (
                <span
                  className={
                    'nums pointer-events-none absolute -right-1.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-soft ' +
                    (delta > 0
                      ? 'bg-emerald-400 text-neutral-950 anim-delta-up '
                      : 'bg-red-500 text-white anim-delta-down ')
                  }
                >
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {cities ? (
        // Mercancías (Caballeros y Ciudades). Sección separada y claramente
        // distinta de los recursos: encabezado propio, borde dorado heráldico
        // y glifos con anillo (CommodityGlyph). Una mercancía NO es un recurso.
        <div className="mt-3 rounded-lg border border-commodity-coin/30 bg-commodity-coin/[0.05] p-2.5">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-commodity-coin">
              Mercancías
            </h3>
            <span className="text-[11px] text-neutral-400">
              Total{' '}
              <span className="nums ml-0.5 text-base font-bold text-neutral-50">
                {commodityTotalN}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {COMMODITIES.map((c) => {
              const n = me.commodities[c];
              const delta = commodityDeltas[c];
              const zero = n === 0;
              return (
                <div
                  key={c}
                  className={
                    'relative flex flex-col items-center rounded-lg border bg-neutral-900/70 px-1 py-2 ' +
                    (zero ? 'border-commodity-coin/15 ' : 'border-commodity-coin/40 ') +
                    (delta !== undefined ? 'anim-pulse-scale ' : '')
                  }
                  title={COMMODITY_NAMES[c]}
                >
                  <CommodityGlyph commodity={c} size={32} />
                  <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                    {COMMODITY_NAMES[c]}
                  </span>
                  <span
                    className={
                      'nums mt-0.5 text-[26px] font-bold leading-none tracking-tight ' +
                      (zero ? 'text-neutral-500' : 'text-neutral-50')
                    }
                  >
                    {n}
                  </span>
                  {delta !== undefined ? (
                    <span
                      className={
                        'nums pointer-events-none absolute -right-1.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-soft ' +
                        (delta > 0
                          ? 'bg-emerald-400 text-neutral-950 anim-delta-up '
                          : 'bg-red-500 text-white anim-delta-down ')
                      }
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {devTotal > 0 ? (
        <div className="mt-3 border-t border-white/5 pt-2.5">
          <h3 className="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
            Cartas de desarrollo
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(me.devCards) as ['knight' | 'vp' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly', number][])
              .filter(([, n]) => n > 0)
              .map(([card, n]) => {
                const bought = me.devCardsBoughtThisTurn.filter(
                  (c) => c === card
                ).length;
                return (
                  <span
                    key={card}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-surface-3 px-2 py-1 text-xs text-neutral-200"
                  >
                    {DEV_CARD_NAMES[card]}
                    <span className="nums font-bold text-neutral-50">×{n}</span>
                    {bought > 0 ? (
                      <span className="nums text-[10px] font-medium text-amber-300">
                        ({bought} nueva)
                      </span>
                    ) : null}
                  </span>
                );
              })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
