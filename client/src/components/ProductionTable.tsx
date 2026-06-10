import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Hex, RESOURCES, Resource } from '../types';
import { RESOURCE_NAMES } from '../lib/spanish';
import { ColorChip } from './ColorChip';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Lista editable de hexes. No mapa.
export function ProductionTable(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const moveRobber = useStore((s) => s.moveRobber);
  const [collapsed, setCollapsed] = useState(true);
  const [editHexId, setEditHexId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  if (!view) return null;
  const { state, me } = view;

  const isRobberPhase = state.phase === 'robber' && state.pendingRobberMove;
  const isMyTurn = !!me && state.turnOrder[state.currentTurnIndex] === me.id;
  // Forzar abierto durante fase de ladrón.
  const open = !collapsed || isRobberPhase;

  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] shadow-soft">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={open}
        aria-controls="production-list"
        className="flex w-full items-center justify-between px-3 py-3 transition-colors active:bg-white/[0.04]"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
          Tabla de producción
        </span>
        <span className="nums text-xs text-neutral-500">
          {state.hexes.length} fichas {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div id="production-list" className="border-t border-white/10 p-3">
          <ul className="space-y-2">
            {state.hexes.length === 0 ? (
              <li className="rounded-md border border-dashed border-white/10 px-3 py-3 text-center text-xs text-neutral-400">
                Toca "Agregar ficha" para registrar los hexágonos del tablero.
              </li>
            ) : null}
            {state.hexes.map((h) => (
              <HexRow
                key={h.id}
                hex={h}
                onEdit={() => setEditHexId(h.id)}
                onTapForRobber={
                  isRobberPhase && isMyTurn
                    ? () => moveRobber(h.id)
                    : undefined
                }
              />
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-3 min-h-[44px] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm transition-colors active:bg-white/10"
          >
            Agregar ficha
          </button>
        </div>
      ) : null}
      {editHexId ? (
        <EditHexModal
          hexId={editHexId}
          onClose={() => setEditHexId(null)}
        />
      ) : null}
      {creating ? (
        <EditHexModal hexId={null} onClose={() => setCreating(false)} />
      ) : null}
    </section>
  );
}

function HexRow({
  hex,
  onEdit,
  onTapForRobber,
}: {
  hex: Hex;
  onEdit: () => void;
  onTapForRobber?: () => void;
}): JSX.Element {
  const view = useStore((s) => s.view);
  const state = view!.state;
  const isHot = hex.number === 6 || hex.number === 8;
  const numberLabel = hex.number ?? '—';
  return (
    <li
      className={
        'flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ' +
        (hex.robber
          ? 'border-red-500/50 bg-red-500/10'
          : 'border-white/10 bg-neutral-900/40') +
        (onTapForRobber ? ' cursor-pointer active:bg-white/[0.08]' : '')
      }
      onClick={onTapForRobber}
    >
      <div
        className={
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border ' +
          (isHot
            ? 'border-amber-400/80 bg-amber-500/20 text-amber-100 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]'
            : 'border-white/15 bg-white/[0.06] text-neutral-100')
        }
      >
        <span className={'nums leading-none ' + (isHot ? 'text-base font-bold' : 'text-sm font-semibold')}>
          {numberLabel}
        </span>
      </div>
      <div className="flex flex-1 items-center gap-2">
        {hex.resource ? (
          <ResourceIcon resource={hex.resource} size={20} />
        ) : (
          <span className="inline-block h-5 w-5 rounded-full border border-dashed border-white/30" />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm">
            {hex.resource ? RESOURCE_NAMES[hex.resource] : 'Desierto'}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {hex.owners.length === 0 ? (
              <span className="text-[10px] text-neutral-400">Sin poblados aquí</span>
            ) : (
              hex.owners.map((o) => {
                const p = state.players.find((x) => x.id === o.playerId);
                return (
                  <span
                    key={o.playerId}
                    className="inline-flex items-center gap-0.5 rounded bg-white/5 px-1.5 py-0.5 text-[10px]"
                  >
                    <ColorChip color={p?.color ?? null} size={10} />
                    <span className="font-medium uppercase">
                      {o.type === 'city' ? 'C' : 'P'}
                    </span>
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>
      {hex.robber ? (
        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-200">
          Ladrón
        </span>
      ) : null}
      {!onTapForRobber ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="min-h-[44px] rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs"
        >
          Editar
        </button>
      ) : null}
    </li>
  );
}

function EditHexModal({
  hexId,
  onClose,
}: {
  hexId: string | null;
  onClose: () => void;
}): JSX.Element {
  const view = useStore((s) => s.view)!;
  const upsertHex = useStore((s) => s.upsertHex);
  const removeHex = useStore((s) => s.removeHex);
  const addOwner = useStore((s) => s.addHexOwner);
  const removeOwner = useStore((s) => s.removeHexOwner);
  const existing = hexId ? view.state.hexes.find((h) => h.id === hexId) : null;
  const [number, setNumber] = useState<number | null>(existing?.number ?? null);
  const [resource, setResource] = useState<Resource | null>(
    existing?.resource ?? null
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  function save() {
    if (existing) {
      upsertHex({ ...existing, number, resource });
    } else {
      const id = 'hex-' + Math.random().toString(36).slice(2, 8);
      upsertHex({
        id,
        number,
        resource,
        robber: resource === null && number === null,
        owners: [],
      });
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-hex-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-xl"
      >
        <h3 id="edit-hex-title" className="text-base font-semibold">
          {existing ? 'Editar ficha' : 'Agregar ficha'}
        </h3>

        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Número
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumber(n)}
                className={
                  'min-h-[40px] min-w-[40px] rounded-md border px-2 py-1 text-sm ' +
                  (number === n
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-neutral-100')
                }
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNumber(null)}
              className={
                'min-h-[40px] rounded-md border px-2 py-1 text-sm ' +
                (number === null
                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                  : 'border-white/10 bg-white/5 text-neutral-100')
              }
            >
              Desierto
            </button>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Recurso
          </p>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {RESOURCES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResource(r)}
                className={
                  'flex min-h-[44px] items-center gap-2 rounded-md border px-2 py-1 text-sm ' +
                  (resource === r
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-neutral-100')
                }
              >
                <ResourceIcon resource={r} size={18} />
                {RESOURCE_NAMES[r]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setResource(null)}
              className={
                'min-h-[44px] rounded-md border px-2 py-1 text-sm ' +
                (resource === null
                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                  : 'border-white/10 bg-white/5 text-neutral-100')
              }
            >
              Ninguno
            </button>
          </div>
        </div>

        {existing ? (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Dueños
            </p>
            <ul className="mt-1 space-y-1.5">
              {existing.owners.map((o) => {
                const p = view.state.players.find(
                  (x) => x.id === o.playerId
                );
                return (
                  <li
                    key={o.playerId}
                    className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5"
                  >
                    <span className="flex items-center gap-1.5 text-sm">
                      <ColorChip color={p?.color ?? null} size={14} />
                      {p?.name ?? 'Jugador'}{' '}
                      <span className="text-[10px] text-neutral-400">
                        ({o.type === 'city' ? 'Ciudad' : 'Poblado'})
                      </span>
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          addOwner(
                            existing.id,
                            o.playerId,
                            o.type === 'city' ? 'settlement' : 'city'
                          )
                        }
                        className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs"
                      >
                        {o.type === 'city' ? 'Bajar a poblado' : 'Subir a ciudad'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeOwner(existing.id, o.playerId)}
                        className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200"
                      >
                        Quitar dueño
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2">
              <p className="text-[11px] text-neutral-400">Agregar dueño:</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {view.state.players
                  .filter(
                    (p) =>
                      !existing.owners.some((o) => o.playerId === p.id)
                  )
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addOwner(existing.id, p.id, 'settlement')}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs"
                    >
                      <ColorChip color={p.color} size={12} />
                      {p.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          {existing ? (
            <button
              type="button"
              onClick={() => {
                removeHex(existing.id);
                onClose();
              }}
              className="min-h-[44px] rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              Eliminar ficha
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            className="min-h-[44px] flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
