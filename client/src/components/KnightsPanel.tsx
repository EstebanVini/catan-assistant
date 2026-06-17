import { useRef, useState } from 'react';
import { useStore } from '../store';
import {
  Knight,
  KNIGHT_RANK_NAMES,
  MAX_KNIGHTS,
  Resource,
  knightDefenseStrength,
} from '../types';
import {
  KNIGHT_ACTION_DESCRIPTIONS,
  KNIGHT_ACTION_NAMES,
  KnightActionKind,
  RESOURCE_NAMES_LOWER,
  joinList,
} from '../lib/spanish';
import { KnightGlyph } from '../assets/icons';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// ─── Panel de Caballeros (Caballeros y Ciudades, §2.6) ────────────────────────
//
// Solo en modo C&K. Muestra MIS caballeros (de `state.players` cuyo id === me.id;
// los caballeros viven en PublicPlayer.knights, públicos: rango + activo) como
// una lista de fichas con rango (KNIGHT_RANK_NAMES + galones del KnightGlyph),
// estado (Activo/Inactivo) y mi fuerza de defensa total (knightDefenseStrength).
//
// Acciones (mismo criterio de turno que ActionGrid/CityCalendarPanel: `main` con
// el turno actual, o `specialBuild` con la cabeza de cola):
//  - Contratar caballero (1 lana + 1 mineral) → buildKnight(). Bloqueado en MAX.
//  - Por inactivo: Activar (1 trigo) → activateKnight(id).
//  - Por rango<3: Promover (1 lana + 1 mineral) → promoteKnight(id). Si rango===2
//    y mi Política < 3, deshabilitado (requiere Fortaleza).
//  - Por ACTIVO: menú de acción (Mover / Expulsar / Ahuyentar ladrón) →
//    knightAction(id, kind). Ahuyentar bloqueado si !robberActive.
//
// El server es la autoridad de costos/turno/Fortaleza; aquí mostramos los
// costos y deshabilitamos por anticipación con razones claras (toast al tacto,
// `title`/aria para teclado), igual que el resto de paneles.

// Costos de caballeros (espejo del server, para mostrar en la UI). El server
// valida y descuenta; estos mapas son solo para badges y razones de "te falta".
const KNIGHT_BUILD_COST: Partial<Record<Resource, number>> = { wool: 1, ore: 1 };
const KNIGHT_ACTIVATE_COST: Partial<Record<Resource, number>> = { grain: 1 };
const KNIGHT_PROMOTE_COST: Partial<Record<Resource, number>> = { wool: 1, ore: 1 };

const POLITICS_FORTRESS_LEVEL = 3; // Fortaleza = Política nivel 3 (promover a 3).

export function KnightsPanel(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const buildKnight = useStore((s) => s.buildKnight);
  const activateKnight = useStore((s) => s.activateKnight);
  const promoteKnight = useStore((s) => s.promoteKnight);
  const knightAction = useStore((s) => s.knightAction);
  const pushToast = useStore((s) => s.pushToast);

  // Caballero cuyo menú de acción está abierto (null = cerrado).
  const [actionFor, setActionFor] = useState<Knight | null>(null);

  if (!view || !view.me) return null;
  const { state, me } = view;
  if (!state.citiesKnights) return null;

  const myPublic = state.players.find((p) => p.id === me.id) ?? null;
  const myKnights: Knight[] = myPublic?.knights ?? [];
  const politics = myPublic?.improvements.politics ?? 0;
  const hasFortress = politics >= POLITICS_FORTRESS_LEVEL;
  const defense = knightDefenseStrength(myKnights);
  const activeCount = myKnights.filter((k) => k.active).length;

  const activeId = state.turnOrder[state.currentTurnIndex];
  const isMyTurn = activeId === me.id;
  const inMain = state.phase === 'main' && isMyTurn;
  const inSpecial =
    state.phase === 'specialBuild' && state.specialBuildQueue[0] === me.id;
  // Solo el jugador activo en su ventana de construcción puede gestionar
  // caballeros. Para los demás el panel es puramente informativo.
  const canAct = inMain || inSpecial;

  function canAfford(cost: Partial<Record<Resource, number>>): boolean {
    if (!me) return false;
    return (Object.entries(cost) as [Resource, number][]).every(
      ([r, n]) => me.hand[r] >= n
    );
  }

  function missingDetail(cost: Partial<Record<Resource, number>>): string {
    if (!me) return 'recursos';
    const parts: string[] = [];
    for (const [r, n] of Object.entries(cost) as [Resource, number][]) {
      const have = me.hand[r];
      if (have < n) parts.push(`${n - have} ${RESOURCE_NAMES_LOWER[r]}`);
    }
    return joinList(parts);
  }

  const atMax = myKnights.length >= MAX_KNIGHTS;

  // Razón por la que "Contratar caballero" no es accionable (orden de prioridad).
  const buildReason: string | null = !canAct
    ? 'Solo puedes contratar en tu turno.'
    : atMax
      ? `Ya tienes el máximo de ${MAX_KNIGHTS} caballeros.`
      : !canAfford(KNIGHT_BUILD_COST)
        ? `Te falta ${missingDetail(KNIGHT_BUILD_COST)} para contratar.`
        : null;
  const buildDisabled = buildReason !== null;

  // Razón de Activar (por caballero inactivo).
  function activateReason(): string | null {
    if (!canAct) return 'Solo puedes activar en tu turno.';
    if (!canAfford(KNIGHT_ACTIVATE_COST))
      return `Te falta ${missingDetail(KNIGHT_ACTIVATE_COST)} para activar.`;
    return null;
  }

  // Razón de Promover (por caballero rango<3).
  function promoteReason(k: Knight): string | null {
    if (!canAct) return 'Solo puedes promover en tu turno.';
    if (k.rank === 2 && !hasFortress)
      return 'Requiere Fortaleza (Política nivel 3).';
    if (!canAfford(KNIGHT_PROMOTE_COST))
      return `Te falta ${missingDetail(KNIGHT_PROMOTE_COST)} para promover.`;
    return null;
  }

  return (
    <div className="p-3">
      {/* Resumen: fuerza de defensa total + recuento de caballeros. */}
      <div className="flex items-center gap-3 rounded-xl border border-ck-steel/30 bg-surface-2 px-3 py-2.5">
        <KnightGlyph rank={3} active={defense > 0} size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            Fuerza de defensa
          </div>
          <div className="nums text-lg font-bold leading-tight text-ck-steel-light">
            {defense}
            <span className="ml-1.5 text-[11px] font-medium text-neutral-500">
              {activeCount} {activeCount === 1 ? 'activo' : 'activos'} ·{' '}
              {myKnights.length} {myKnights.length === 1 ? 'caballero' : 'caballeros'}
            </span>
          </div>
        </div>
      </div>

      {/* Aclaración del flujo: las acciones de caballero se resuelven en la mesa
          (registro asistido) y usar el caballero lo desactiva. */}
      <p className="mt-2 text-[10px] leading-snug text-neutral-500">
        Las acciones de un caballero activo se resuelven en la mesa; al usarlo
        queda inactivo hasta que lo vuelvas a activar.
      </p>

      {/* Contratar caballero. */}
      <div className="mt-3">
        <button
          type="button"
          aria-disabled={buildDisabled}
          title={buildReason ?? undefined}
          onClick={() => {
            if (buildDisabled) {
              if (buildReason) pushToast('info', buildReason);
              return;
            }
            buildKnight();
          }}
          className={
            'flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ' +
            (buildDisabled
              ? 'cursor-not-allowed border border-white/10 bg-surface-1 text-neutral-500'
              : 'border border-ck-steel/50 bg-ck-steel/15 text-neutral-50 active:scale-[0.98] active:bg-ck-steel/25')
          }
        >
          <span className="flex items-center gap-2">
            <KnightGlyph rank={1} active={false} size={24} />
            Contratar caballero
          </span>
          <CostBadge cost={KNIGHT_BUILD_COST} />
        </button>
        {canAct && buildDisabled && buildReason ? (
          <p className="mt-1 text-[10px] leading-tight text-neutral-500">
            {buildReason}
          </p>
        ) : null}
      </div>

      {/* Lista de mis caballeros. */}
      <div className="mt-3 space-y-2">
        {myKnights.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-surface-1 px-3 py-3 text-center text-[11px] text-neutral-400">
            Aún no tienes caballeros. Contrata uno (1 lana + 1 mineral); nace
            inactivo.
          </p>
        ) : (
          myKnights.map((k, i) => (
            <KnightRow
              key={k.id}
              knight={k}
              index={i}
              canAct={canAct}
              activateReason={activateReason()}
              promoteReason={promoteReason(k)}
              onActivate={() => activateKnight(k.id)}
              onPromote={() => promoteKnight(k.id)}
              onOpenActions={() => setActionFor(k)}
              onBlocked={(reason) => pushToast('info', reason)}
            />
          ))
        )}
      </div>

      {actionFor ? (
        <KnightActionModal
          knight={actionFor}
          index={myKnights.findIndex((x) => x.id === actionFor.id)}
          robberActive={state.robberActive}
          onClose={() => setActionFor(null)}
          onPick={(kind) => {
            knightAction(actionFor.id, kind);
            setActionFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

// Fila de un caballero: glifo (rango + estado), nombre de rango, estado y, según
// el caso, los botones Activar / Promover / Acción. Los botones solo son
// accionables para el jugador activo (canAct); para los demás la fila es
// informativa.
function KnightRow({
  knight,
  index,
  canAct,
  activateReason,
  promoteReason,
  onActivate,
  onPromote,
  onOpenActions,
  onBlocked,
}: {
  knight: Knight;
  index: number;
  canAct: boolean;
  activateReason: string | null;
  promoteReason: string | null;
  onActivate: () => void;
  onPromote: () => void;
  onOpenActions: () => void;
  onBlocked: (reason: string) => void;
}): JSX.Element {
  const canPromote = knight.rank < 3;
  const activateDisabled = activateReason !== null;
  const promoteDisabled = promoteReason !== null;

  return (
    <div
      className={
        'rounded-xl border bg-surface-2 p-2.5 transition-colors ' +
        (knight.active
          ? 'border-gold/45 shadow-[0_0_0_1px_rgba(217,169,62,0.14)]'
          : 'border-ck-steel/30')
      }
    >
      <div className="flex items-center gap-2.5">
        <KnightGlyph rank={knight.rank} active={knight.active} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold tracking-tight text-neutral-50">
              {KNIGHT_RANK_NAMES[knight.rank]}
            </span>
            <span className="text-[10px] font-medium text-neutral-500">
              Caballero {index + 1}
            </span>
          </div>
          <div className="mt-0.5">
            {knight.active ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/[0.12] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-gold-light">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
                Activo · fuerza {knight.rank}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-ck-steel/40 bg-ck-steel/[0.12] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ck-steel-light">
                <span className="h-1.5 w-1.5 rounded-full bg-ck-steel" aria-hidden />
                Inactivo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Acciones por caballero. Solo se renderizan accionables en mi turno;
          fuera de él, la fila queda informativa (sin botones). */}
      {canAct ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {!knight.active ? (
            <KnightActionButton
              label="Activar"
              cost={KNIGHT_ACTIVATE_COST}
              tone="activate"
              disabled={activateDisabled}
              reason={activateReason}
              onClick={onActivate}
              onBlocked={onBlocked}
            />
          ) : (
            <button
              type="button"
              onClick={onOpenActions}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-gold/45 bg-gold/[0.10] px-3 py-2 text-sm font-semibold text-gold-light transition-all active:scale-[0.98] active:bg-gold/[0.18]"
            >
              Acción del caballero
            </button>
          )}
          {canPromote ? (
            <KnightActionButton
              label="Promover"
              cost={KNIGHT_PROMOTE_COST}
              tone="promote"
              disabled={promoteDisabled}
              reason={promoteReason}
              onClick={onPromote}
              onBlocked={onBlocked}
            />
          ) : (
            <span className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-[11px] font-medium text-neutral-500">
              Rango máximo
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Botón de acción de caballero (Activar / Promover) con su costo y razón de
// bloqueo. Emula `disabled` con `aria-disabled` para capturar el tap y mostrar
// el toast (en móvil `title` no es accesible sin hover).
function KnightActionButton({
  label,
  cost,
  tone,
  disabled,
  reason,
  onClick,
  onBlocked,
}: {
  label: string;
  cost: Partial<Record<Resource, number>>;
  tone: 'activate' | 'promote';
  disabled: boolean;
  reason: string | null;
  onClick: () => void;
  onBlocked: (reason: string) => void;
}): JSX.Element {
  const enabledCls =
    tone === 'activate'
      ? 'border border-discipline-science/50 bg-discipline-science/15 text-neutral-50 active:scale-[0.98] active:bg-discipline-science/25'
      : 'border border-ck-steel/50 bg-ck-steel/15 text-neutral-50 active:scale-[0.98] active:bg-ck-steel/25';
  return (
    <button
      type="button"
      aria-disabled={disabled}
      title={reason ?? undefined}
      onClick={() => {
        if (disabled) {
          if (reason) onBlocked(reason);
          return;
        }
        onClick();
      }}
      className={
        'inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all ' +
        (disabled
          ? 'cursor-not-allowed border border-white/10 bg-surface-1 text-neutral-500'
          : enabledCls)
      }
    >
      <span>{label}</span>
      <CostBadge cost={cost} muted={disabled} />
    </button>
  );
}

// Badge de costo en recursos (espejo de BuildCostBadge, pero para un mapa de
// recursos arbitrario: caballeros no usan BUILD_COSTS).
function CostBadge({
  cost,
  muted = false,
}: {
  cost: Partial<Record<Resource, number>>;
  muted?: boolean;
}): JSX.Element {
  const entries = Object.entries(cost) as [Resource, number][];
  return (
    <span className="flex flex-shrink-0 items-center gap-1">
      {entries.map(([res, n]) => (
        <span
          key={res}
          className={
            'inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[11px] ' +
            (muted ? 'bg-black/15 text-neutral-500' : 'bg-black/25 text-neutral-200')
          }
        >
          <ResourceIcon resource={res} size={16} />
          <span className="nums font-bold">{n}</span>
        </span>
      ))}
    </span>
  );
}

// Modal de acción de un caballero ACTIVO: Mover / Expulsar / Ahuyentar ladrón.
// "Ahuyentar ladrón" se deshabilita si el ladrón aún no está en juego
// (!robberActive). Las acciones se resuelven en la mesa (registro asistido): la
// app las anuncia y el server desactiva el caballero.
function KnightActionModal({
  knight,
  index,
  robberActive,
  onClose,
  onPick,
}: {
  knight: Knight;
  index: number;
  robberActive: boolean;
  onClose: () => void;
  onPick: (kind: KnightActionKind) => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, onClose);

  const actions: KnightActionKind[] = ['move', 'displace', 'chaseRobber'];

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="knight-action-title"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <div className="flex items-center gap-3">
          <KnightGlyph rank={knight.rank} active size={48} />
          <div className="min-w-0 flex-1">
            <h2
              id="knight-action-title"
              className="text-base font-semibold tracking-tight text-neutral-50"
            >
              Acción del caballero
            </h2>
            <p className="mt-0.5 text-[11px] text-neutral-400">
              {KNIGHT_RANK_NAMES[knight.rank]} · Caballero {index + 1}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-snug text-neutral-400">
          Elige la acción a registrar. Se resuelve en la mesa y el caballero
          queda inactivo hasta que lo vuelvas a activar.
        </p>

        <div className="mt-3 space-y-2">
          {actions.map((kind) => {
            const blockedRobber = kind === 'chaseRobber' && !robberActive;
            const reason = blockedRobber
              ? 'El ladrón aún no está en juego.'
              : null;
            const disabled = reason !== null;
            return (
              <button
                key={kind}
                type="button"
                aria-disabled={disabled}
                title={reason ?? undefined}
                onClick={() => {
                  if (disabled) return;
                  onPick(kind);
                }}
                className={
                  'flex min-h-[60px] w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-all ' +
                  (disabled
                    ? 'cursor-not-allowed border-white/10 bg-surface-1 text-neutral-500'
                    : 'border-white/12 bg-surface-2 text-neutral-50 active:scale-[0.99] active:bg-white/[0.09]')
                }
              >
                <span className="text-sm font-semibold">
                  {KNIGHT_ACTION_NAMES[kind]}
                </span>
                <span
                  className={
                    'text-[11px] leading-snug ' +
                    (disabled ? 'text-neutral-600' : 'text-neutral-400')
                  }
                >
                  {reason ?? KNIGHT_ACTION_DESCRIPTIONS[kind]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-white/10 bg-surface-3 px-4 py-2 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
