import { useState } from 'react';
import { useStore } from '../store';
import { Building, Hex, Resource } from '../types';
import { RESOURCE_NAMES_LOWER } from '../lib/spanish';
import { ColorChip } from './ColorChip';
import { ResourceIcon } from './ResourceIcon';
import { CollapsibleSection } from './CollapsibleSection';
import { SpotPickerSheet } from './InitialBuildSetup';

// Tabla de construcción: SOLO mis poblados y ciudades, en dos listas. Cada
// entrada registra las fichas (número + recurso) que toca esa construcción.
// Cualquier jugador edita la suya a voluntad, en cualquier momento y SIN
// requerir recursos — el tablero físico es la autoridad; el server deriva de
// aquí la producción y el recuento público de poblados/ciudades.
//
// Durante la fase del ladrón la sección se fuerza abierta y muestra la lista
// de fichas de TODA la mesa (derivada por el server) para que el jugador en
// turno elija a dónde moverlo; el resumen cerrado siempre dice dónde está.

type SheetState =
  | { kind: 'newBuilding'; type: Building['type'] }
  | { kind: 'spot'; buildingId: string; spotIdx: number | null };

function newBuildingId(): string {
  return 'bld-' + Math.random().toString(36).slice(2, 10);
}

export function ConstructionTable(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const setBuildings = useStore((s) => s.setBuildings);
  const moveRobber = useStore((s) => s.moveRobber);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  if (!view) return null;
  const { state, me } = view;

  const buildings = me?.buildings ?? [];
  const settlements = buildings.filter((b) => b.type === 'settlement');
  const cities = buildings.filter((b) => b.type === 'city');

  const isRobberPhase = state.phase === 'robber' && state.pendingRobberMove;
  const isMyTurn = !!me && state.turnOrder[state.currentTurnIndex] === me.id;

  const robberHex = state.hexes.find((h) => h.robber) ?? null;
  const robberLabel = robberHex
    ? robberHex.number !== null && robberHex.resource
      ? `${robberHex.number} ${RESOURCE_NAMES_LOWER[robberHex.resource]}`
      : 'desierto'
    : null;

  function confirmSheet(number: number, resource: Resource): void {
    if (!sheet) return;
    if (sheet.kind === 'newBuilding') {
      setBuildings([
        ...buildings,
        { id: newBuildingId(), type: sheet.type, spots: [{ number, resource }] },
      ]);
    } else {
      setBuildings(
        buildings.map((b) => {
          if (b.id !== sheet.buildingId) return b;
          if (sheet.spotIdx === null) {
            return { ...b, spots: [...b.spots, { number, resource }] };
          }
          return {
            ...b,
            spots: b.spots.map((s, j) =>
              j === sheet.spotIdx ? { number, resource } : s
            ),
          };
        })
      );
    }
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

  function toggleType(buildingId: string): void {
    setBuildings(
      buildings.map((b) =>
        b.id === buildingId
          ? { ...b, type: b.type === 'city' ? 'settlement' : 'city' }
          : b
      )
    );
  }

  function removeBuilding(buildingId: string): void {
    setBuildings(buildings.filter((b) => b.id !== buildingId));
  }

  const sheetBuilding =
    sheet?.kind === 'spot'
      ? buildings.find((b) => b.id === sheet.buildingId) ?? null
      : null;

  return (
    <>
      <CollapsibleSection
        id="constructionTable"
        title="Tabla de construcción"
        defaultCollapsed
        forceOpen={isRobberPhase}
        summary={
          <span className="nums text-xs text-neutral-500">
            {settlements.length} {settlements.length === 1 ? 'poblado' : 'poblados'} ·{' '}
            {cities.length} {cities.length === 1 ? 'ciudad' : 'ciudades'}
          </span>
        }
        collapsedSummary={
          robberLabel ? (
            <span className="flex items-center gap-1 text-xs text-neutral-400">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-red-500"
                aria-hidden
              />
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
                addLabel="+ Agregar poblado"
                emptyCopy="Sin poblados registrados."
                buildings={settlements}
                toggleLabel="Subir a ciudad"
                onAdd={() => setSheet({ kind: 'newBuilding', type: 'settlement' })}
                onAddSpot={(id) => setSheet({ kind: 'spot', buildingId: id, spotIdx: null })}
                onEditSpot={(id, j) => setSheet({ kind: 'spot', buildingId: id, spotIdx: j })}
                onRemoveSpot={removeSpot}
                onToggleType={toggleType}
                onRemove={removeBuilding}
              />
              <BuildingList
                title="Ciudades"
                addLabel="+ Agregar ciudad"
                emptyCopy="Sin ciudades registradas."
                buildings={cities}
                toggleLabel="Bajar a poblado"
                onAdd={() => setSheet({ kind: 'newBuilding', type: 'city' })}
                onAddSpot={(id) => setSheet({ kind: 'spot', buildingId: id, spotIdx: null })}
                onEditSpot={(id, j) => setSheet({ kind: 'spot', buildingId: id, spotIdx: j })}
                onRemoveSpot={removeSpot}
                onToggleType={toggleType}
                onRemove={removeBuilding}
              />
              <p className="text-[11px] leading-snug text-neutral-500">
                Aquí solo ves tus construcciones. El recuento de cada jugador
                está en la lista de Jugadores.
              </p>
            </>
          ) : null}
        </div>
      </CollapsibleSection>

      {sheet ? (
        <SpotPickerSheet
          key={
            sheet.kind === 'newBuilding'
              ? `new-${sheet.type}`
              : `${sheet.buildingId}-${sheet.spotIdx ?? 'new'}`
          }
          buildLabel={
            sheet.kind === 'newBuilding'
              ? sheet.type === 'city'
                ? 'Ciudad nueva'
                : 'Poblado nuevo'
              : sheetBuilding?.type === 'city'
                ? 'Ciudad'
                : 'Poblado'
          }
          editing={sheet.kind === 'spot' && sheet.spotIdx !== null}
          initialNumber={
            sheet.kind === 'spot' && sheet.spotIdx !== null
              ? sheetBuilding?.spots[sheet.spotIdx]?.number ?? null
              : null
          }
          initialResource={
            sheet.kind === 'spot' && sheet.spotIdx !== null
              ? sheetBuilding?.spots[sheet.spotIdx]?.resource ?? null
              : null
          }
          onClose={() => setSheet(null)}
          onConfirm={confirmSheet}
        />
      ) : null}
    </>
  );
}

function BuildingList({
  title,
  addLabel,
  emptyCopy,
  buildings,
  toggleLabel,
  onAdd,
  onAddSpot,
  onEditSpot,
  onRemoveSpot,
  onToggleType,
  onRemove,
}: {
  title: string;
  addLabel: string;
  emptyCopy: string;
  buildings: Building[];
  toggleLabel: string;
  onAdd: () => void;
  onAddSpot: (buildingId: string) => void;
  onEditSpot: (buildingId: string, spotIdx: number) => void;
  onRemoveSpot: (buildingId: string, spotIdx: number) => void;
  onToggleType: (buildingId: string) => void;
  onRemove: (buildingId: string) => void;
}): JSX.Element {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
        {title}
      </p>
      {buildings.length === 0 ? (
        <p className="mt-1.5 rounded-md border border-dashed border-white/15 px-2.5 py-2.5 text-center text-[11px] text-neutral-400">
          {emptyCopy}
        </p>
      ) : (
        <ul className="mt-1.5 space-y-2">
          {buildings.map((b, i) => (
            <li
              key={b.id}
              className="rounded-xl border border-white/10 bg-neutral-900/50 p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-neutral-100">
                  {title === 'Poblados' ? 'Poblado' : 'Ciudad'} {i + 1}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleType(b.id)}
                    className="min-h-[36px] rounded-md border border-white/10 bg-surface-3 px-2 py-1 text-[11px] text-neutral-200 transition-colors active:bg-white/10"
                  >
                    {toggleLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(b.id)}
                    className="min-h-[36px] rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 transition-colors active:bg-red-500/20"
                  >
                    Quitar
                  </button>
                </div>
              </div>
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
                          <ResourceIcon resource={s.resource} size={18} />
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
              {b.spots.length < 3 ? (
                <button
                  type="button"
                  onClick={() => onAddSpot(b.id)}
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-white/12 bg-surface-2 px-3 py-2 text-xs font-medium text-neutral-100 transition-colors active:bg-white/10"
                >
                  + Agregar ficha
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm transition-colors active:bg-white/10"
      >
        {addLabel}
      </button>
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
          return (
            <li key={h.id}>
              <button
                type="button"
                disabled={!tappable}
                onClick={() => onPick(h.id)}
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
                    <ResourceIcon resource={h.resource} size={20} />
                  ) : (
                    <span className="inline-block h-5 w-5 rounded-full border border-dashed border-white/30" />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">
                      {h.resource ? RESOURCE_NAMES_LOWER[h.resource] : 'desierto'}
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
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-200">
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
