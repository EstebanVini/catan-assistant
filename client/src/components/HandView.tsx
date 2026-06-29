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
import { getCollapsePref, setCollapsePref } from '../lib/persistence';

// Toggles de privacidad (Cambios C+D): cada sección de la mano se puede ocultar
// para no filtrar información a quien mire la pantalla. La preferencia se
// guarda por dispositivo (`hand.resources` y `hand.dev`); el "Total" siempre
// queda visible para el dueño. Al togglear, la zona hace un cross-fade corto
// (`anim-reveal`, solo opacity/transform) que se siente como destapar/tapar, y
// el ícono ojo pulsa (`anim-pulse-scale`); ambos quedan desactivados bajo
// prefers-reduced-motion, donde el cambio vuelve a ser instantáneo.

// Íconos ojo / ojo-tachado en SVG inline (sin librerías). Decorativos: el
// significado lo da el aria-label del botón que los contiene.
function EyeIcon({ size = 20 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.8} />
    </svg>
  );
}

function EyeOffIcon({ size = 20 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M9.6 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.9 3.7M6.4 6.4A18 18 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 3.6-.7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.6 10.6a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

// Botón ojo reutilizable: touch target ≥44×44, solo ícono, aria-pressed y
// aria-label dinámico (la acción que ejecutará el toque).
function EyeToggle({
  hidden,
  onToggle,
  labelShow,
  labelHide,
  ringClass = 'focus-visible:ring-white/40',
}: {
  hidden: boolean;
  onToggle: () => void;
  labelShow: string; // acción cuando está oculto (revelar)
  labelHide: string; // acción cuando está visible (ocultar)
  ringClass?: string;
}): JSX.Element {
  // Micro-feedback: el ícono pulsa al togglear. `pulsed` se activa en el primer
  // toque para que el pulso sea respuesta al gesto y no dispare en el montaje.
  const [pulsed, setPulsed] = useState(false);

  function handleClick(): void {
    setPulsed(true);
    onToggle();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={hidden}
      aria-label={hidden ? labelShow : labelHide}
      className={
        'flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 hover:bg-white/[0.06] hover:text-neutral-100 active:bg-white/10 active:text-neutral-100 ' +
        // Estado activo (oculto) = ícono más presente (neutral-200) para
        // señalar "está ocultando ahora"; inactivo (visible) = calmado
        // (neutral-400). Sin dorado: reservado a marca/victoria/insignias.
        (hidden ? 'text-neutral-200 ' : 'text-neutral-400 ') +
        ringClass
      }
    >
      {/*
        Wrapper `inline-flex` (para que `transform` aplique al ícono, no a un
        inline) con `key` que cambia con el estado: fuerza el reinicio de
        `anim-pulse-scale` en cada toque. El SVG sigue siendo aria-hidden; el
        significado lo da el aria-label del botón. Bajo prefers-reduced-motion
        el pulso queda desactivado (anim-pulse-scale → animation: none).
      */}
      <span
        key={hidden ? 'off' : 'on'}
        className={'inline-flex ' + (pulsed ? 'anim-pulse-scale' : '')}
      >
        {hidden ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
      </span>
    </button>
  );
}

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

  // Toggles de privacidad. Pref inicial leída de localStorage (null ⇒ visible
  // por defecto). El toggle de recursos también enmascara las mercancías.
  const [resourcesHidden, setResourcesHidden] = useState<boolean>(
    () => getCollapsePref('hand.resources') ?? false
  );
  const [devHidden, setDevHidden] = useState<boolean>(
    () => getCollapsePref('hand.dev') ?? false
  );

  // ¿Ya tocó el usuario cada toggle en esta sesión? El cross-fade de
  // revelar/ocultar solo se aplica tras el primer toque, para que sea feedback
  // del gesto y no un fundido en la carga inicial (donde el estado guardado en
  // localStorage debe aparecer ya asentado). El toggle de recursos también
  // gobierna la máscara de mercancías, así que comparten el mismo flag.
  const [resourcesToggled, setResourcesToggled] = useState(false);
  const [devToggled, setDevToggled] = useState(false);

  function toggleResources(): void {
    setResourcesToggled(true);
    setResourcesHidden((prev) => {
      const next = !prev;
      setCollapsePref('hand.resources', next);
      return next;
    });
  }

  function toggleDev(): void {
    setDevToggled(true);
    setDevHidden((prev) => {
      const next = !prev;
      setCollapsePref('hand.dev', next);
      return next;
    });
  }

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
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
          Tu mano
        </h2>
        <div className="flex items-center gap-0.5">
          <span className="text-[11px] text-neutral-400">
            Total{' '}
            <span className="nums ml-0.5 text-base font-bold text-neutral-50">
              {total}
            </span>
          </span>
          <EyeToggle
            hidden={resourcesHidden}
            onToggle={toggleResources}
            labelShow="Mostrar recursos"
            labelHide="Ocultar recursos"
          />
        </div>
      </div>
      {resourcesHidden ? (
        // Estado oculto de recursos: ícono atenuado + token de máscara "•" del
        // mismo tamaño tipográfico, sin deltas (revelarían info). Toda la zona
        // es tappable para revelar, además del botón ojo del header.
        <button
          type="button"
          onClick={toggleResources}
          aria-label="Recursos ocultos, toca para mostrar"
          className={
            'block w-full rounded-lg text-left focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ' +
            (resourcesToggled ? 'anim-reveal' : '')
          }
        >
          <span className="grid grid-cols-5 gap-1.5" aria-hidden>
            {RESOURCES.map((r) => (
              <span
                key={r}
                className="relative flex flex-col items-center rounded-lg border border-white/10 bg-neutral-950/60 px-1 py-2"
              >
                <span className="opacity-40">
                  <ResourceIcon resource={r} size={32} />
                </span>
                <span className="nums mt-1.5 select-none text-[28px] font-bold leading-none tracking-tight text-neutral-500">
                  •
                </span>
              </span>
            ))}
          </span>
          <span className="mt-2 block text-center text-[11px] text-neutral-300" aria-hidden>
            <span className="font-semibold uppercase tracking-[0.12em] text-neutral-300">
              Oculto
            </span>
            {' — toca para mostrar'}
          </span>
        </button>
      ) : (
        <div
          className={
            'grid grid-cols-5 gap-1.5 ' + (resourcesToggled ? 'anim-reveal' : '')
          }
        >
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
      )}
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
          {resourcesHidden ? (
            // El toggle de recursos también enmascara las mercancías (mismo
            // tratamiento): ícono atenuado + "•", sin deltas, tappable. El
            // "Total" de mercancías queda visible en el encabezado de arriba.
            <button
              type="button"
              onClick={toggleResources}
              aria-label="Mercancías ocultas, toca para mostrar recursos y mercancías"
              className={
                'block w-full rounded-lg text-left focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-commodity-coin/50 ' +
                (resourcesToggled ? 'anim-reveal' : '')
              }
            >
              <span className="grid grid-cols-3 gap-1.5" aria-hidden>
                {COMMODITIES.map((c) => (
                  <span
                    key={c}
                    className="relative flex flex-col items-center rounded-lg border border-commodity-coin/20 bg-neutral-950/60 px-1 py-2"
                  >
                    <span className="opacity-40">
                      <CommodityGlyph commodity={c} size={32} />
                    </span>
                    <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                      {COMMODITY_NAMES[c]}
                    </span>
                    <span className="nums mt-0.5 select-none text-[26px] font-bold leading-none tracking-tight text-neutral-500">
                      •
                    </span>
                  </span>
                ))}
              </span>
              <span className="mt-2 block text-center text-[11px] text-neutral-300" aria-hidden>
                <span className="font-semibold uppercase tracking-[0.12em] text-neutral-300">
                  Oculto
                </span>
                {' — toca para mostrar'}
              </span>
            </button>
          ) : (
            <div
              className={
                'grid grid-cols-3 gap-1.5 ' +
                (resourcesToggled ? 'anim-reveal' : '')
              }
            >
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
          )}
        </div>
      ) : null}
      {devTotal > 0 ? (
        <div className="mt-3 border-t border-white/5 pt-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
              Cartas de desarrollo
            </h3>
            <div className="flex items-center gap-0.5">
              {/* El "Total" sigue visible aun oculto: no revela nombres ni ×n. */}
              <span className="text-[11px] text-neutral-400">
                Total{' '}
                <span className="nums ml-0.5 text-sm font-bold text-neutral-50">
                  {devTotal}
                </span>
              </span>
              <EyeToggle
                hidden={devHidden}
                onToggle={toggleDev}
                labelShow="Mostrar cartas de desarrollo"
                labelHide="Ocultar cartas de desarrollo"
              />
            </div>
          </div>
          {devHidden ? (
            // Una sola tira enmascarada (patrón de puntos), no un placeholder
            // por tipo: así no se filtra cuántos tipos distintos hay. Tappable
            // para revelar, además del botón ojo.
            <button
              type="button"
              onClick={toggleDev}
              aria-label="Cartas de desarrollo ocultas, toca para mostrar"
              className={
                'block w-full rounded-lg text-left focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ' +
                (devToggled ? 'anim-reveal' : '')
              }
            >
              <span
                className="flex items-center justify-center rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-3"
                aria-hidden
              >
                <span className="nums select-none text-lg leading-none tracking-[0.4em] text-neutral-500">
                  •••••••
                </span>
              </span>
              <span className="mt-1.5 block text-center text-[11px] text-neutral-300" aria-hidden>
                <span className="font-semibold uppercase tracking-[0.12em] text-neutral-300">
                  Oculto
                </span>
                {' — toca para mostrar'}
              </span>
            </button>
          ) : (
            <div
              className={
                'flex flex-wrap gap-1.5 ' + (devToggled ? 'anim-reveal' : '')
              }
            >
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
          )}
        </div>
      ) : null}
    </section>
  );
}
