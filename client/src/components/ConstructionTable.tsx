import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Building, Hex, PortType, Resource, RESOURCES } from '../types';
import { RESOURCE_NAMES_LOWER } from '../lib/spanish';
import { ColorChip } from './ColorChip';
import { ResourceIcon } from './ResourceIcon';
import { CollapsibleSection } from './CollapsibleSection';
import { SpotPickerSheet } from './InitialBuildSetup';
import { useModalA11y } from '../lib/useModalA11y';
import { BuildingGlyph, DesertGlyph, RobberGlyph } from '../assets/icons';

// Tabla de construcción: SOLO mis poblados y ciudades, en dos listas. Cada
// entrada registra las fichas (número + recurso) que toca esa construcción.
//
// Los poblados/ciudades NO se agregan a mano: comprar un Poblado (en
// Construir) crea su slot aquí, y comprar una Ciudad convierte el poblado que
// el comprador eligió. En esta tabla solo se editan las fichas de cada
// construcción (y se puede quitar una registrada por error). El server deriva
// de aquí la producción y el recuento público de poblados/ciudades.
//
// Durante la fase del ladrón la sección se fuerza abierta y muestra la lista
// de fichas de TODA la mesa (derivada por el server) para que el jugador en
// turno elija a dónde moverlo; el resumen cerrado siempre dice dónde está.

type SheetState = { buildingId: string; spotIdx: number | null };

// Confirmación destructiva al quitar una construcción (brief §3): label legible
// ("Poblado 2"/"Ciudad 1") y `n` = nº de fichas registradas, para advertir la
// pérdida. Solo al confirmar se ejecuta el borrado real.
type RemoveTarget = { id: string; label: string; n: number };

const PORT_SHORT: Record<PortType, string> = {
  '3:1': 'Puerto 3:1',
  brick: 'Puerto Ladrillo',
  lumber: 'Puerto Madera',
  wool: 'Puerto Lana',
  grain: 'Puerto Trigo',
  ore: 'Puerto Mineral',
};

export function ConstructionTable(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const setBuildings = useStore((s) => s.setBuildings);
  const setPorts = useStore((s) => s.setPorts);
  const moveRobber = useStore((s) => s.moveRobber);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [portSheet, setPortSheet] = useState<string | null>(null); // buildingId
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  if (!view) return null;
  const { state, me } = view;

  const buildings = me?.buildings ?? [];
  const settlements = buildings.filter((b) => b.type === 'settlement');
  const cities = buildings.filter((b) => b.type === 'city');

  const isRobberPhase = state.phase === 'robber' && state.pendingRobberMove;
  const isMyTurn = !!me && state.turnOrder[state.currentTurnIndex] === me.id;

  // Cambio A: poblados comprados este turno cuyas fichas faltan por registrar.
  // El server libera el id en cuanto el poblado tiene `spots.length > 0`.
  const pendingIds = new Set(me?.pendingSettlementRegistration ?? []);
  const hasPending = pendingIds.size > 0;

  const robberHex = state.hexes.find((h) => h.robber) ?? null;
  const robberLabel = robberHex
    ? robberHex.number !== null && robberHex.resource
      ? `${robberHex.number} ${RESOURCE_NAMES_LOWER[robberHex.resource]}`
      : 'desierto'
    : null;

  function confirmSheet(number: number, resource: Resource, hexId: string): void {
    if (!sheet) return;
    setBuildings(
      buildings.map((b) => {
        if (b.id !== sheet.buildingId) return b;
        if (sheet.spotIdx === null) {
          return { ...b, spots: [...b.spots, { number, resource, hexId }] };
        }
        return {
          ...b,
          spots: b.spots.map((s, j) =>
            j === sheet.spotIdx ? { number, resource, hexId } : s
          ),
        };
      })
    );
    setSheet(null);
  }

  function removeSpot(buildingId: string, spotIdx: number): void {
    setBuildings(
      buildings.map((b) =>
        b.id === buildingId
          ? { ...b, spots: b.spots.filter((_, j) => j !== spotIdx) }
          : b
      )
    );
  }

  function removeBuilding(buildingId: string): void {
    setBuildings(buildings.filter((b) => b.id !== buildingId));
  }

  // El disparador "Quitar" no borra: abre el alertdialog con el contexto
  // (label + nº de fichas). El borrado real ocurre solo al confirmar.
  function requestRemove(buildingId: string, label: string): void {
    const b = buildings.find((x) => x.id === buildingId);
    setRemoveTarget({ id: buildingId, label, n: b?.spots.length ?? 0 });
  }

  function confirmPort(buildingId: string, port: PortType | null): void {
    const updated = buildings.map((b) => {
      if (b.id !== buildingId) return b;
      const newB = { ...b, port: port ?? undefined };
      // Si el nuevo puerto limita a 2 fichas y tenía 3, recortar.
      if (port && newB.spots.length > 2) {
        newB.spots = newB.spots.slice(0, 2);
      }
      return newB;
    });
    setBuildings(updated);
    // Sincronizar player.ports con todos los puertos de los edificios.
    const derivedPorts = updated.filter((b) => b.port).map((b) => b.port as PortType);
    setPorts(derivedPorts);
    setPortSheet(null);
  }

  const sheetBuilding = sheet
    ? buildings.find((b) => b.id === sheet.buildingId) ?? null
    : null;

  const portSheetBuilding = portSheet
    ? buildings.find((b) => b.id === portSheet) ?? null
    : null;

  return (
    <>
      <CollapsibleSection
        id="constructionTable"
        title="Tabla de construcción"
        defaultCollapsed
        forceOpen={isRobberPhase || hasPending}
        titleBadge={
          hasPending ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-200"
              role="status"
            >
              {pendingIds.size > 1
                ? `${pendingIds.size} por registrar`
                : 'Falta registrar'}
            </span>
          ) : null
        }
        summary={
          <span className="nums text-xs text-neutral-500">
            {settlements.length} {settlements.length === 1 ? 'poblado' : 'poblados'} ·{' '}
            {cities.length} {cities.length === 1 ? 'ciudad' : 'ciudades'}
          </span>
        }
        collapsedSummary={
          robberLabel ? (
            <span className="flex items-center gap-1 text-xs text-neutral-400">
              <RobberGlyph size={14} />
              ladrón en {robberLabel}
            </span>
          ) : null
        }
      >
        <div className="space-y-3 p-3">
          {isRobberPhase ? (
            <RobberHexList
              hexes={state.hexes}
              canMove={isMyTurn}
              onPick={(hexId) => moveRobber(hexId)}
            />
          ) : null}

          {me ? (
            <>
              <BuildingList
                title="Poblados"
                emptyCopy="Sin poblados. Se agregan comprándolos en Construir."
                buildings={settlements}
                pendingIds={pendingIds}
                onAddSpot={(id) => setSheet({ buildingId: id, spotIdx: null })}
                onEditSpot={(id, j) => setSheet({ buildingId: id, spotIdx: j })}
                onRemoveSpot={removeSpot}
                onRemove={requestRemove}
                onSetPort={(id) => setPortSheet(id)}
              />
              <BuildingList
                title="Ciudades"
                emptyCopy="Sin ciudades. Compra una en Construir y elige qué poblado sube."
                buildings={cities}
                pendingIds={pendingIds}
                onAddSpot={(id) => setSheet({ buildingId: id, spotIdx: null })}
                onEditSpot={(id, j) => setSheet({ buildingId: id, spotIdx: j })}
                onRemoveSpot={removeSpot}
                onRemove={requestRemove}
                onSetPort={(id) => setPortSheet(id)}
              />
              <p className="text-[11px] leading-snug text-neutral-500">
                Aquí solo ves tus construcciones y editas sus fichas. Los
                poblados y ciudades se agregan comprándolos en Construir; el
                recuento de cada jugador está en la lista de Jugadores.
              </p>
            </>
          ) : null}
        </div>
      </CollapsibleSection>

      {sheet ? (
        <SpotPickerSheet
          key={`${sheet.buildingId}-${sheet.spotIdx ?? 'new'}`}
          buildLabel={sheetBuilding?.type === 'city' ? 'Ciudad' : 'Poblado'}
          editing={sheet.spotIdx !== null}
          initialNumber={
            sheet.spotIdx !== null
              ? sheetBuilding?.spots[sheet.spotIdx]?.number ?? null
              : null
          }
          initialResource={
            sheet.spotIdx !== null
              ? sheetBuilding?.spots[sheet.spotIdx]?.resource ?? null
              : null
          }
          initialHexId={
            sheet.spotIdx !== null
              ? sheetBuilding?.spots[sheet.spotIdx]?.hexId ?? null
              : null
          }
          existingHexes={state.hexes}
          players={state.players}
          onClose={() => setSheet(null)}
          onConfirm={confirmSheet}
        />
      ) : null}

      {portSheetBuilding ? (
        <PortPickerSheet
          current={portSheetBuilding.port ?? null}
          buildLabel={portSheetBuilding.type === 'city' ? 'Ciudad' : 'Poblado'}
          onClose={() => setPortSheet(null)}
          onConfirm={(port) => confirmPort(portSheetBuilding.id, port)}
        />
      ) : null}

      {removeTarget ? (
        <RemoveBuildingConfirm
          target={removeTarget}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => {
            removeBuilding(removeTarget.id);
            setRemoveTarget(null);
          }}
        />
      ) : null}
    </>
  );
}

// Alertdialog rojo de confirmación al quitar un poblado/ciudad (brief §3).
// Mismo patrón que `KickConfirm` (LobbyScreen): foco inicial en "Cancelar"
// (acción segura por defecto), ESC = cancelar, focus trap vía useModalA11y.
function RemoveBuildingConfirm({
  target,
  onCancel,
  onConfirm,
}: {
  target: RemoveTarget;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, onCancel);
  const fichas =
    target.n > 0
      ? ` junto con sus ${target.n} ${target.n === 1 ? 'ficha registrada' : 'fichas registradas'}`
      : '';
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-building-title"
        aria-describedby="remove-building-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <h2
          id="remove-building-title"
          className="text-sm font-semibold tracking-tight text-neutral-50"
        >
          ¿Quitar {target.label}?
        </h2>
        <p
          id="remove-building-desc"
          className="mt-1.5 text-xs leading-relaxed text-neutral-400"
        >
          Se quitará de tu tabla{fichas}. Esta acción no se puede deshacer.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] flex-1 rounded-lg border border-red-500/40 bg-red-500/[0.08] px-3 py-2 text-sm font-bold text-red-300 transition-colors active:bg-red-500/[0.16]"
          >
            Sí, quitar
          </button>
        </div>
      </div>
    </div>
  );
}

function BuildingList({
  title,
  emptyCopy,
  buildings,
  pendingIds,
  onAddSpot,
  onEditSpot,
  onRemoveSpot,
  onRemove,
  onSetPort,
}: {
  title: string;
  emptyCopy: string;
  buildings: Building[];
  // Ids de poblados comprados este turno sin fichas registradas (Cambio A).
  pendingIds: Set<string>;
  onAddSpot: (buildingId: string) => void;
  onEditSpot: (buildingId: string, spotIdx: number) => void;
  onRemoveSpot: (buildingId: string, spotIdx: number) => void;
  onRemove: (buildingId: string, label: string) => void;
  onSetPort: (buildingId: string) => void;
}): JSX.Element {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
        <BuildingGlyph type={title === 'Ciudades' ? 'city' : 'settlement'} size={18} />
        {title}
      </p>
      {buildings.length === 0 ? (
        <p className="mt-1.5 rounded-md border border-dashed border-white/15 px-2.5 py-2.5 text-center text-[11px] text-neutral-400">
          {emptyCopy}
        </p>
      ) : (
        <ul className="mt-1.5 space-y-2">
          {buildings.map((b, i) => {
            const maxSpots = b.port ? 2 : 3;
            const label = `${title === 'Poblados' ? 'Poblado' : 'Ciudad'} ${i + 1}`;
            const isPending = pendingIds.has(b.id);
            return (
              <li
                key={b.id}
                className={
                  'rounded-xl border p-2.5 ' +
                  (isPending
                    ? 'border-amber-400/70 bg-amber-500/[0.07] ring-1 ring-amber-400/30'
                    : 'border-white/10 bg-neutral-900/50')
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-100">
                    {label}
                    {isPending ? (
                      <span
                        role="status"
                        aria-label={`${label}: falta registrar sus fichas`}
                        className="inline-flex items-center rounded-full border border-amber-400/60 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-amber-200"
                      >
                        Pendiente
                      </span>
                    ) : null}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemove(b.id, label)}
                    aria-label={`Quitar ${label}`}
                    className="min-h-[36px] rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 transition-colors active:bg-red-500/20"
                  >
                    Quitar
                  </button>
                </div>

                {/* Puerto badge */}
                <button
                  type="button"
                  onClick={() => onSetPort(b.id)}
                  className={
                    'mt-1.5 flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors active:bg-white/[0.08] ' +
                    (b.port
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                      : 'border-white/10 bg-surface-2 text-neutral-400')
                  }
                >
                  <span className="text-base leading-none">⚓</span>
                  <span className="text-[11px] font-medium">
                    {b.port ? PORT_SHORT[b.port] : 'Sin puerto'}
                  </span>
                  <span className="ml-auto text-[10px] opacity-60">editar</span>
                </button>

                {b.spots.length === 0 ? (
                  <p className="mt-1.5 rounded-md border border-dashed border-white/15 px-2.5 py-2 text-center text-[11px] text-neutral-400">
                    Sin fichas todavía
                  </p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {b.spots.map((s, j) => {
                      const hot = s.number === 6 || s.number === 8;
                      return (
                        <span
                          key={`${j}-${s.number}-${s.resource}`}
                          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-white/15 bg-surface-2 pr-1"
                        >
                          <button
                            type="button"
                            onClick={() => onEditSpot(b.id, j)}
                            aria-label={`Editar ficha ${s.number} ${RESOURCE_NAMES_LOWER[s.resource]}`}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-l-lg pl-1.5 pr-0.5 transition-colors active:bg-white/[0.08]"
                          >
                            <span
                              className={
                                'relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border ' +
                                (hot
                                  ? 'border-amber-400/80 bg-amber-500/20 text-amber-100'
                                  : 'border-white/15 bg-surface-3 text-neutral-100')
                              }
                            >
                              <span
                                className={
                                  'nums leading-none ' +
                                  (hot ? 'text-sm font-bold' : 'text-xs font-semibold')
                                }
                              >
                                {s.number}
                              </span>
                            </span>
                            <ResourceIcon resource={s.resource} size={24} />
                            <span className="text-xs text-neutral-100">
                              {RESOURCE_NAMES_LOWER[s.resource]}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveSpot(b.id, j)}
                            aria-label={`Quitar ficha ${s.number} ${RESOURCE_NAMES_LOWER[s.resource]}`}
                            className="flex h-11 w-11 items-center justify-center rounded-r-lg text-neutral-400 transition-colors active:bg-white/[0.08] active:text-neutral-100"
                          >
                            <svg width={12} height={12} viewBox="0 0 24 24" aria-hidden>
                              <path
                                d="M6 6 L18 18 M18 6 L6 18"
                                stroke="currentColor"
                                strokeWidth={2.4}
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {b.spots.length < maxSpots ? (
                  isPending ? (
                    // CTA primario del poblado pendiente: mismo destino que
                    // "+ Agregar ficha" (abre el SpotPicker) pero con peso de
                    // acción requerida (ámbar sólido).
                    <button
                      type="button"
                      onClick={() => onAddSpot(b.id)}
                      className="mt-2 min-h-[44px] w-full rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold tracking-tight text-neutral-950 shadow-cta-amber transition-all active:scale-[0.99] active:bg-amber-300"
                    >
                      Registrar fichas
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddSpot(b.id)}
                      className="mt-2 min-h-[44px] w-full rounded-lg border border-white/12 bg-surface-2 px-3 py-2 text-xs font-medium text-neutral-100 transition-colors active:bg-white/10"
                    >
                      + Agregar ficha
                      {b.port ? <span className="ml-1 text-[10px] text-neutral-400">(máx. 2 con puerto)</span> : null}
                    </button>
                  )
                ) : null}
                {isPending ? (
                  <p className="mt-1.5 text-[11px] leading-snug text-amber-200/80">
                    Registra las fichas (número + recurso) que toca este poblado
                    nuevo para poder terminar el turno. ¿No toca números? Registra
                    el desierto que sí toca para confirmarlo.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PortPickerSheet({
  current,
  buildLabel,
  onClose,
  onConfirm,
}: {
  current: PortType | null;
  buildLabel: string;
  onClose: () => void;
  onConfirm: (port: PortType | null) => void;
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl border-t border-white/10 bg-surface-1 p-4 pb-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-100">
            Puerto — {buildLabel}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors active:bg-white/10"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <p className="mb-3 text-[11px] text-neutral-400">
          Un poblado con puerto puede tener máximo 2 fichas de recursos. El tipo de puerto determina tu ratio de intercambio.
        </p>
        <div className="space-y-1.5">
          {/* Opción: sin puerto */}
          <button
            type="button"
            onClick={() => onConfirm(null)}
            className={
              'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors active:bg-white/[0.08] ' +
              (current === null
                ? 'border-neutral-500/60 bg-neutral-500/20 text-neutral-100'
                : 'border-white/10 bg-surface-2 text-neutral-300')
            }
          >
            <span className="text-lg leading-none">🚫</span>
            <span className="text-sm font-medium">Sin puerto</span>
            {current === null ? (
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                actual
              </span>
            ) : null}
          </button>

          {/* Opción: 3:1 */}
          <button
            type="button"
            onClick={() => onConfirm('3:1')}
            className={
              'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors active:bg-white/[0.08] ' +
              (current === '3:1'
                ? 'border-sky-500/60 bg-sky-500/20 text-sky-100'
                : 'border-white/10 bg-surface-2 text-neutral-300')
            }
          >
            <span className="text-lg leading-none">⚓</span>
            <div className="flex-1">
              <p className="text-sm font-medium">Puerto 3:1</p>
              <p className="text-[10px] text-neutral-400">Intercambia cualquier recurso 3:1</p>
            </div>
            {current === '3:1' ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-400">
                actual
              </span>
            ) : null}
          </button>

          {/* Opciones de recurso 2:1 */}
          <div className="grid grid-cols-2 gap-1.5">
            {RESOURCES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onConfirm(r)}
                className={
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors active:bg-white/[0.08] ' +
                  (current === r
                    ? 'border-sky-500/60 bg-sky-500/20 text-sky-100'
                    : 'border-white/10 bg-surface-2 text-neutral-300')
                }
              >
                <ResourceIcon resource={r} size={20} />
                <div>
                  <p className="text-xs font-medium">{RESOURCE_NAMES_LOWER[r]}</p>
                  <p className="text-[10px] text-neutral-400">2:1</p>
                </div>
                {current === r ? (
                  <span className="ml-auto text-[10px] text-sky-400">✓</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Lista de fichas de TODA la mesa para colocar el ladrón (derivada por el
// server desde las tablas de todos; incluye siempre el desierto).
function RobberHexList({
  hexes,
  canMove,
  onPick,
}: {
  hexes: Hex[];
  canMove: boolean;
  onPick: (hexId: string) => void;
}): JSX.Element {
  const view = useStore((s) => s.view);
  const players = view?.state.players ?? [];

  // Desambiguación (brief §5): cuando dos o más fichas comparten número+recurso,
  // hay que distinguirlas. Etiqueta de prioridad:
  //   1. Por dueños → "· de Ana" / "· de Ana y Beto" (lo más útil para robar).
  //   2. Si comparten dueños o no tienen, índice ordinal humano "(1)"/"(2)",
  //      estable por el orden del server.
  const dupKeyOf = (h: Hex): string | null =>
    h.number !== null && h.resource ? `${h.number}|${h.resource}` : null;

  const dupCounts = new Map<string, number>();
  for (const h of hexes) {
    const k = dupKeyOf(h);
    if (k) dupCounts.set(k, (dupCounts.get(k) ?? 0) + 1);
  }

  const ownerNames = (h: Hex): string[] => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const o of h.owners) {
      if (seen.has(o.playerId)) continue;
      seen.add(o.playerId);
      const p = players.find((x) => x.id === o.playerId);
      if (p) names.push(p.name);
    }
    return names;
  };

  const joinNames = (names: string[]): string =>
    names.length <= 1
      ? names[0] ?? ''
      : names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1];

  // Mapa hexId → sufijo desambiguador (texto plano, sin id técnico).
  const suffixes = new Map<string, string>();
  for (const [key, count] of dupCounts) {
    if (count < 2) continue;
    const group = hexes.filter((h) => dupKeyOf(h) === key);
    // Conteo de cada etiqueta-por-dueño para detectar empates.
    const labelCounts = new Map<string, number>();
    for (const h of group) {
      const label = joinNames(ownerNames(h));
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
    group.forEach((h, idx) => {
      const names = ownerNames(h);
      const ownerLabel = joinNames(names);
      // Usable solo si hay dueños y la etiqueta es única dentro del grupo.
      if (names.length > 0 && (labelCounts.get(ownerLabel) ?? 0) === 1) {
        suffixes.set(h.id, `de ${ownerLabel}`);
      } else {
        suffixes.set(h.id, `(${idx + 1})`);
      }
    });
  }

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/[0.05] p-2.5">
      <p className="text-xs font-semibold text-red-200">
        {canMove
          ? 'Elige la ficha a donde se mueve el ladrón.'
          : 'El jugador en turno está moviendo el ladrón.'}
      </p>
      <ul className="mt-2 space-y-1.5">
        {hexes.map((h) => {
          const isHot = h.number === 6 || h.number === 8;
          const tappable = canMove && !h.robber;
          const suffix = suffixes.get(h.id) ?? null;
          const baseName = h.resource
            ? RESOURCE_NAMES_LOWER[h.resource]
            : 'desierto';
          const ariaName =
            (h.number !== null ? `${h.number} ` : '') +
            baseName +
            (suffix ? ` ${suffix}` : '');
          return (
            <li key={h.id}>
              <button
                type="button"
                disabled={!tappable}
                onClick={() => onPick(h.id)}
                aria-label={
                  h.robber
                    ? `El ladrón ya está en ${ariaName}`
                    : `Mover ladrón a ${ariaName}`
                }
                className={
                  'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ' +
                  (h.robber
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-white/10 bg-neutral-900/40') +
                  (tappable ? ' active:bg-white/[0.08]' : ' cursor-default')
                }
              >
                <span
                  className={
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border ' +
                    (isHot
                      ? 'border-amber-400/80 bg-amber-500/20 text-amber-100'
                      : 'border-white/15 bg-surface-3 text-neutral-100')
                  }
                >
                  <span className={'nums leading-none ' + (isHot ? 'text-base font-bold' : 'text-sm font-semibold')}>
                    {h.number ?? '—'}
                  </span>
                </span>
                <span className="flex flex-1 items-center gap-2">
                  {h.resource ? (
                    <ResourceIcon resource={h.resource} size={28} />
                  ) : (
                    <DesertGlyph size={28} />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-baseline gap-1 truncate text-sm">
                      <span className="truncate">{baseName}</span>
                      {suffix ? (
                        <span className="flex-shrink-0 text-[11px] font-medium text-amber-200/90">
                          · {suffix}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      {h.owners.length === 0 ? (
                        <span className="text-[10px] text-neutral-400">
                          Sin poblados aquí
                        </span>
                      ) : (
                        h.owners.map((o, k) => {
                          const p = players.find((x) => x.id === o.playerId);
                          return (
                            <span
                              key={`${o.playerId}-${k}`}
                              className="inline-flex items-center gap-0.5 rounded bg-surface-3 px-1.5 py-0.5 text-[10px]"
                            >
                              <ColorChip color={p?.color ?? null} size={10} />
                              <span className="font-medium uppercase">
                                {o.type === 'city' ? 'C' : 'P'}
                              </span>
                            </span>
                          );
                        })
                      )}
                    </span>
                  </span>
                </span>
                {h.robber ? (
                  <span className="flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-200">
                    <RobberGlyph size={14} />
                    Ladrón
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
