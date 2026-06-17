import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { Discipline, Knight, PublicPlayer, knightDefenseStrength } from '../types';
import { ColorChip } from './ColorChip';
import { DISCIPLINE_NAMES, portLabel } from '../lib/spanish';
import { playerHex } from '../lib/playerColors';
import { BadgeChip, BadgeIcon } from './BadgeIcon';
import { KnightGlyph } from '../assets/icons';
import { CollapsibleSection } from './CollapsibleSection';

// Estado público por jugador. Manos ajenas nunca se muestran (privacidad).
//
// Fase 3: colapsable persistente (`ui.collapse.publicPlayers`, default
// EXPANDIDO: es el marcador de la partida). Cerrado muestra "N jugadores ·
// va X" — cerrado nunca significa ciego.
export function PublicPlayersPanel(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const setLongestRoad = useStore((s) => s.setLongestRoad);
  const [editingLongest, setEditingLongest] = useState(false);
  // Flash de confirmación inline tras asignar el Camino más largo.
  // Texto efímero (≈1 s) en lugar de toast global para mantener el foco
  // visual sobre la cards de jugadores.
  const [longestFlash, setLongestFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!longestFlash) return;
    const t = window.setTimeout(() => setLongestFlash(null), 1100);
    return () => window.clearTimeout(t);
  }, [longestFlash]);

  // Tracking de cardCount por jugador para disparar un `pulse-scale` cuando
  // cambia (sin mostrar +/-, privacidad). `pulseTick` se incrementa por
  // jugador en cada cambio: usado en el `key` para forzar el re-mount del
  // card y reiniciar la animación CSS.
  //
  // Stagger Monopolio: cuando varios `cardCount` cambian en el mismo
  // `state:update` (caso típico de Monopolio, Año de la abundancia o
  // descartes simultáneos), aplicamos `animationDelay` por jugador siguiendo
  // el `turnOrder`. Así el barrido visual se siente — no es un pulso
  // simultáneo plano. Para cambios individuales, el delay queda en 0.
  //
  // Nota: el panel no recibe explícitamente "es un evento múltiple" — lo
  // detectamos contando cuántos jugadores cambiaron en el mismo tick.
  const prevCardCountsRef = useRef<Map<string, number>>(new Map());
  const [pulseTick, setPulseTick] = useState<Map<string, number>>(new Map());
  const [pulseDelay, setPulseDelay] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!view) return;
    const prev = prevCardCountsRef.current;
    const nextTicks = new Map(pulseTick);
    const nextDelays = new Map(pulseDelay);
    // Recolectamos los IDs que cambiaron en este tick, en orden de turno
    // para que el stagger coincida con la rotación visual de las cards.
    const changedIds: string[] = [];
    const turnOrder = view.state.turnOrder;
    for (const id of turnOrder) {
      const p = view.state.players.find((x) => x.id === id);
      if (!p) continue;
      const before = prev.get(p.id);
      if (before !== undefined && before !== p.cardCount) {
        changedIds.push(p.id);
      }
    }
    // Sincronizamos el snapshot completo (incluye no cambiados).
    for (const p of view.state.players) {
      prev.set(p.id, p.cardCount);
    }
    if (changedIds.length === 0) return;
    // Stagger 80 ms por índice — sólo si hay >1 cambios. Un sólo cambio se
    // siente más natural sin retraso.
    changedIds.forEach((id, idx) => {
      nextTicks.set(id, (nextTicks.get(id) ?? 0) + 1);
      nextDelays.set(id, changedIds.length > 1 ? idx * 80 : 0);
    });
    setPulseTick(nextTicks);
    setPulseDelay(nextDelays);
    // Solo nos interesa cuando cambia la lista de players o sus cardCounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.state.players]);

  // Tracking de insignias para animar la transferencia: cuando un jugador
  // gana (transición false→true) la insignia, su `BadgeChip` entra con
  // `anim-fade-in` + `anim-pulse-scale` corto. Cuando pierde la insignia,
  // simplemente desaparece (no se renderiza). El badgeTick se incrementa por
  // jugador+variant en cada gain — usado en el `key` para reiniciar la
  // animación CSS y disparar el "entry pulse" justo en el nuevo dueño.
  const prevBadgesRef = useRef<Map<string, { army: boolean; road: boolean }>>(
    new Map()
  );
  const [badgeTick, setBadgeTick] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!view) return;
    const prev = prevBadgesRef.current;
    const nextTicks = new Map(badgeTick);
    let changed = false;
    for (const p of view.state.players) {
      const cur = {
        army: !!p.victoryPoints.largestArmy,
        road: !!p.victoryPoints.longestRoad,
      };
      const before = prev.get(p.id);
      if (before) {
        if (!before.army && cur.army) {
          nextTicks.set(`${p.id}:army`, (nextTicks.get(`${p.id}:army`) ?? 0) + 1);
          changed = true;
        }
        if (!before.road && cur.road) {
          nextTicks.set(`${p.id}:road`, (nextTicks.get(`${p.id}:road`) ?? 0) + 1);
          changed = true;
        }
      }
      prev.set(p.id, cur);
    }
    if (changed) setBadgeTick(nextTicks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.state.players]);

  if (!view) return null;
  const { state, me } = view;

  const ordered = state.turnOrder
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is PublicPlayer => !!p);
  const canEditLongest = !!me && (me.id === state.bankManagerId || me.id === state.hostId);
  const activeId = state.turnOrder[state.currentTurnIndex];
  const activePlayer = state.players.find((p) => p.id === activeId) ?? null;

  return (
    <CollapsibleSection
      id="publicPlayers"
      title="Jugadores"
      defaultCollapsed={false}
      collapsedSummary={
        <span className="text-xs text-neutral-400">
          {ordered.length} jugadores
          {activePlayer ? ` · va ${activePlayer.name}` : ''}
        </span>
      }
    >
      <div className="space-y-2 p-3">
          {ordered.map((p) => {
            const isActive = p.id === activeId;
            // Marcador 100% público: vpCards son cartas de Punto de victoria
            // ya usadas; las que siguen en mano no cuentan para nadie.
            const vpVisible =
              p.victoryPoints.settlements +
              p.victoryPoints.cities * 2 +
              (p.victoryPoints.longestRoad ? 2 : 0) +
              (p.victoryPoints.largestArmy ? 2 : 0) +
              p.victoryPoints.vpCards;
            // El tick > 0 indica que hubo al menos un cambio: aplicamos la
            // clase de pulso. El `key` con tick fuerza re-mount cada cambio
            // para que la animación CSS se reinicie. La animación corre
            // una sola vez (320 ms) y luego queda estable. El `delay`
            // proviene del barrido de Monopolio / YoP (80 ms × índice de
            // turno entre los jugadores que cambiaron en este tick).
            const tick = pulseTick.get(p.id) ?? 0;
            const delay = pulseDelay.get(p.id) ?? 0;
            const armyTick = badgeTick.get(`${p.id}:army`) ?? 0;
            const roadTick = badgeTick.get(`${p.id}:road`) ?? 0;
            return (
              <div
                key={p.id + ':' + tick}
                className={
                  'flex items-stretch gap-0 overflow-hidden rounded-lg border bg-neutral-900/50 transition-colors ' +
                  (isActive
                    ? 'border-emerald-500/45 shadow-[0_0_0_1px_rgba(16,185,129,0.15)] '
                    : 'border-white/10 ') +
                  (tick > 0 ? 'anim-pulse-scale' : '')
                }
                style={
                  tick > 0 && delay > 0
                    ? { animationDelay: `${delay}ms` }
                    : undefined
                }
              >
                <div
                  className={(isActive ? 'w-2 ' : 'w-1.5 ') + 'self-stretch'}
                  style={{
                    backgroundColor: playerHex(p.color),
                    boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.25)',
                  }}
                />
                <div className="flex-1 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-neutral-100">
                      {p.name}
                    </span>
                    {p.id === state.hostId ? (
                      <Badge>Anfitrión</Badge>
                    ) : null}
                    {p.id === state.bankManagerId ? (
                      <Badge>Banco</Badge>
                    ) : null}
                    {!p.connected ? (
                      <Badge tone="muted">Desconectado</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
                    <span>
                      Mano:{' '}
                      <span className="nums font-semibold text-neutral-100">
                        {p.cardCount}
                      </span>
                    </span>
                    <Sep />
                    {/* Conteo público de mercancías (C&K): igual que la mano,
                        solo el total — el detalle por tipo es privado. */}
                    {state.citiesKnights ? (
                      <>
                        <span className="text-commodity-coin">
                          Mercancías:{' '}
                          <span className="nums font-semibold text-commodity-coin">
                            {p.commodityCount}
                          </span>
                        </span>
                        <Sep />
                        {/* Conteo público de cartas de progreso (C&K): solo el
                            total — el detalle es privado, igual que la mano. */}
                        <span>
                          Progreso:{' '}
                          <span className="nums font-semibold text-neutral-100">
                            {p.progressCardsCount}
                          </span>
                        </span>
                        <Sep />
                      </>
                    ) : null}
                    {/* Recuento público de la Tabla de construcción de cada
                        jugador (las fichas concretas solo las ve su dueño). */}
                    <span>
                      Poblados:{' '}
                      <span className="nums font-semibold text-neutral-100">
                        {p.victoryPoints.settlements}
                      </span>
                    </span>
                    <Sep />
                    <span>
                      Ciudades:{' '}
                      <span className="nums font-semibold text-neutral-100">
                        {p.victoryPoints.cities}
                      </span>
                    </span>
                    <Sep />
                    <span>
                      Desarrollo:{' '}
                      <span className="nums font-semibold text-neutral-100">
                        {p.devCardsCount}
                      </span>
                    </span>
                    <Sep />
                    <span>
                      Caballeros:{' '}
                      <span className="nums font-semibold text-neutral-100">
                        {p.knightsPlayed}
                      </span>
                    </span>
                    <Sep />
                    <span>
                      Puntos:{' '}
                      <span className="nums font-semibold text-neutral-100">
                        {vpVisible}
                      </span>
                    </span>
                  </div>
                  {p.victoryPoints.largestArmy || p.victoryPoints.longestRoad ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {p.victoryPoints.largestArmy ? (
                        // Entry combinado: `anim-fade-in` (200 ms) +
                        // `anim-pulse-scale` (260 ms) corto para marcar que
                        // este jugador ACABA de recibir la insignia. El
                        // `key` con `armyTick` reinicia las animaciones cada
                        // transferencia. Cuando la insignia desaparece de un
                        // jugador, el nodo deja de renderizarse (fade out
                        // implícito del DOM). Reduced-motion: `anim-fade-in`
                        // cae a 120 ms y `anim-pulse-scale` se desactiva.
                        <span
                          key={`army-${armyTick}`}
                          className={
                            armyTick > 0
                              ? 'inline-flex anim-fade-in anim-pulse-scale'
                              : 'inline-flex'
                          }
                        >
                          <BadgeChip
                            variant="army"
                            label={`Ejército más grande (2 pts)`}
                          />
                        </span>
                      ) : null}
                      {p.victoryPoints.longestRoad ? (
                        <span
                          key={`road-${roadTick}`}
                          className={
                            roadTick > 0
                              ? 'inline-flex anim-fade-in anim-pulse-scale'
                              : 'inline-flex'
                          }
                        >
                          <BadgeChip
                            variant="road"
                            label={`Camino más largo (2 pts)`}
                          />
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {/* Metrópolis (C&K): un marcador heráldico dorado por
                      disciplina que el jugador posee, con su color funcional.
                      Solo se renderiza en modo C&K y si tiene alguna. */}
                  {state.citiesKnights && p.metropolises.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {p.metropolises.map((d) => (
                        <MetropolisChip key={d} discipline={d} />
                      ))}
                    </div>
                  ) : null}
                  {/* Caballeros (C&K): recuento total + fuerza de defensa
                      pública (suma del rango de los ACTIVOS), distinguiendo
                      activos/inactivos. Los caballeros viven en `p.knights`
                      (públicos: rango + activo). Solo en C&K. */}
                  {state.citiesKnights ? (
                    <KnightsSummary knights={p.knights} />
                  ) : null}
                  {p.ports.length > 0 ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {p.ports.map((port) => (
                        <Badge key={port} tone="muted">
                          {portLabel(port)}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <ColorChip color={p.color} size={18} className="mr-2" />
              </div>
            );
          })}
          {canEditLongest ? (
            <div className="mt-2">
              {longestFlash ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="anim-fade-in rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-100"
                >
                  {longestFlash}
                </div>
              ) : !editingLongest ? (
                <button
                  type="button"
                  onClick={() => setEditingLongest(true)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-xs font-medium text-neutral-200 transition-colors active:bg-white/[0.10]"
                >
                  <BadgeIcon variant="road" size={14} />
                  {(() => {
                    const holder = ordered.find(
                      (p) => p.victoryPoints.longestRoad
                    );
                    return holder
                      ? `Cambiar Camino más largo (actual: ${holder.name})`
                      : 'Asignar Camino más largo';
                  })()}
                </button>
              ) : (
                <div className="rounded-lg border border-white/10 bg-surface-1 p-2.5 shadow-soft">
                  <p className="mb-1 text-[11px] font-semibold tracking-tight text-neutral-100">
                    Camino más largo
                  </p>
                  <p className="mb-2 text-[10px] text-neutral-400">
                    Elige al nuevo titular o déjalo sin dueño.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setLongestRoad(null);
                        setEditingLongest(false);
                        setLongestFlash('Camino más largo: sin dueño.');
                      }}
                      className="min-h-[36px] rounded-md border border-white/10 bg-surface-3 px-2 py-1.5 text-xs"
                    >
                      Sin dueño
                    </button>
                    {ordered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setLongestRoad(p.id);
                          setEditingLongest(false);
                          setLongestFlash(`Camino más largo: ${p.name}.`);
                        }}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-white/10 bg-surface-3 px-2 py-1.5 text-xs"
                      >
                        <ColorChip color={p.color} size={10} />
                        {p.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditingLongest(false)}
                      className="ml-auto min-h-[36px] rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-xs text-neutral-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
      </div>
    </CollapsibleSection>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'muted' | 'warn';
}): JSX.Element {
  const cls =
    tone === 'muted'
      ? 'bg-surface-3 text-neutral-300 border-white/10'
      : tone === 'warn'
        ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
        : 'bg-sky-500/15 text-sky-200 border-sky-500/30';
  return (
    <span
      className={
        'inline-block rounded-full border px-1.5 py-0.5 text-[10px] leading-none ' +
        cls
      }
    >
      {children}
    </span>
  );
}

function Sep(): JSX.Element {
  return <span className="text-neutral-700" aria-hidden>·</span>;
}

// Chip de metrópolis (C&K): aro dorado heráldico (las metrópolis son uno de los
// usos legítimos del dorado, como las insignias) con un punto del color
// funcional de la disciplina y su nombre. Clases por disciplina como cadenas
// literales (el JIT de Tailwind no detecta `text-discipline-${d}`).
const DISCIPLINE_CHIP_TEXT: Record<Discipline, string> = {
  trade: 'text-discipline-trade',
  politics: 'text-discipline-politics',
  science: 'text-discipline-science',
};
const DISCIPLINE_CHIP_DOT: Record<Discipline, string> = {
  trade: 'bg-discipline-trade',
  politics: 'bg-discipline-politics',
  science: 'bg-discipline-science',
};

// Resumen público de caballeros de un jugador (C&K): chip con la fuerza de
// defensa (suma de rango de los activos) y el desglose activos/inactivos. El
// acero (--ck-steel) lo separa del lenguaje dorado de las insignias/metrópolis.
function KnightsSummary({ knights }: { knights: Knight[] }): JSX.Element | null {
  if (knights.length === 0) return null;
  const defense = knightDefenseStrength(knights);
  const active = knights.filter((k) => k.active).length;
  const inactive = knights.length - active;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <span
        className="inline-flex items-center gap-1 rounded-full border border-ck-steel/40 bg-ck-steel/[0.12] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-ck-steel-light"
        aria-label={`Caballeros: ${knights.length} (${active} activos, ${inactive} inactivos). Fuerza de defensa ${defense}.`}
        title={`Fuerza de defensa ${defense} · ${active} activos · ${inactive} inactivos`}
      >
        <KnightGlyph rank={3} active={defense > 0} size={14} />
        <span>
          Caballeros{' '}
          <span className="nums text-neutral-100">{knights.length}</span>
        </span>
        <span aria-hidden className="text-ck-steel/60">|</span>
        <span>
          Defensa <span className="nums text-ck-steel-light">{defense}</span>
        </span>
      </span>
      <span className="text-[10px] leading-none text-neutral-500">
        <span className="nums text-gold-light">{active}</span> act ·{' '}
        <span className="nums text-neutral-300">{inactive}</span> inact
      </span>
    </div>
  );
}

function MetropolisChip({ discipline }: { discipline: Discipline }): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/[0.10] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-gold-light"
      aria-label={`Metrópolis de ${DISCIPLINE_NAMES[discipline]} (4 puntos)`}
      title={`Metrópolis de ${DISCIPLINE_NAMES[discipline]} · 4 PV`}
    >
      <span
        className={
          'h-2 w-2 flex-shrink-0 rounded-full ring-1 ring-inset ring-black/30 ' +
          DISCIPLINE_CHIP_DOT[discipline]
        }
        aria-hidden
      />
      <span className={DISCIPLINE_CHIP_TEXT[discipline]}>
        Metrópolis · {DISCIPLINE_NAMES[discipline]}
      </span>
    </span>
  );
}
