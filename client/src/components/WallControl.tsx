import { useStore } from '../store';
import { MAX_WALLS, Resource, handLimitForSeven } from '../types';
import { RESOURCE_NAMES_LOWER, joinList } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { WallGlyph } from '../assets/icons';

// ─── Control de Muros de ciudad (Caballeros y Ciudades, §2.9) ─────────────────
//
// Solo en modo C&K. Cada muro de ciudad sube en +2 el límite de mano del 7:
// con `walls` muros descartas solo si tienes más de `handLimitForSeven(walls,
// true)` cartas (recursos + mercancías). Hasta MAX_WALLS (3) muros, es decir
// un límite máximo de 13.
//
// Muestra mis muros actuales (X / 3, buscando mi PublicPlayer por `me.id`) y el
// límite de mano resultante, explicando que los muros me protegen de descartar
// con el 7. El botón "Construir muro" (2 ladrillos → `buildWall()`) sigue el
// mismo criterio de turno que KnightsPanel / CityCalendarPanel (fase `main` con
// el turno actual, o `specialBuild` con la cabeza de cola). El server es la
// autoridad de costo/turno/máximo; aquí deshabilitamos por anticipación con
// razones claras (toast al tacto, `title`/aria para teclado).

// Costo de un muro (espejo del server, solo para el badge y la razón de "te
// falta"). El server valida y descuenta.
const WALL_BUILD_COST: Partial<Record<Resource, number>> = { brick: 2 };

export function WallControl(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const buildWall = useStore((s) => s.buildWall);
  const pushToast = useStore((s) => s.pushToast);

  if (!view || !view.me) return null;
  const { state, me } = view;
  if (!state.citiesKnights) return null;

  const myPublic = state.players.find((p) => p.id === me.id) ?? null;
  const walls = myPublic?.walls ?? 0;
  const handLimit = handLimitForSeven(walls, true);

  const activeId = state.turnOrder[state.currentTurnIndex];
  const isMyTurn = activeId === me.id;
  const inMain = state.phase === 'main' && isMyTurn;
  const inSpecial =
    state.phase === 'specialBuild' && state.specialBuildQueue[0] === me.id;
  // Solo el jugador activo en su ventana de construcción puede construir muros.
  // Para los demás el control es puramente informativo.
  const canAct = inMain || inSpecial;

  const atMax = walls >= MAX_WALLS;

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

  // Razón por la que "Construir muro" no es accionable (orden de prioridad).
  const buildReason: string | null = !canAct
    ? 'Solo puedes construir muros en tu turno.'
    : atMax
      ? `Ya tienes el máximo de ${MAX_WALLS} muros.`
      : !canAfford(WALL_BUILD_COST)
        ? `Te falta ${missingDetail(WALL_BUILD_COST)} para construir un muro.`
        : null;
  const buildDisabled = buildReason !== null;

  return (
    <div className="p-3">
      {/* Resumen: muros actuales + límite de mano del 7 resultante. */}
      <div className="flex items-center gap-3 rounded-xl border border-ck-steel/30 bg-surface-2 px-3 py-2.5">
        <WallGlyph filled={walls > 0} size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            Muros de ciudad
          </div>
          <div className="nums text-lg font-bold leading-tight text-ck-steel-light">
            {walls}
            <span className="text-neutral-500"> / {MAX_WALLS}</span>
            <span className="ml-1.5 text-[11px] font-medium text-neutral-500">
              límite con el 7:{' '}
              <span className="nums text-neutral-200">{handLimit}</span>{' '}
              {handLimit === 1 ? 'carta' : 'cartas'}
            </span>
          </div>
        </div>
      </div>

      {/* Visualización de los 3 huecos de muro: rellenos por muro construido. */}
      <div
        className="mt-2 flex items-center gap-1.5"
        role="img"
        aria-label={`${walls} de ${MAX_WALLS} muros construidos`}
      >
        {Array.from({ length: MAX_WALLS }, (_, i) => (
          <span
            key={i}
            className={
              'flex h-6 flex-1 items-center justify-center rounded-md border transition-colors ' +
              (i < walls
                ? 'border-ck-steel/55 bg-ck-steel/[0.18]'
                : 'border-white/10 bg-surface-1')
            }
          >
            <WallGlyph filled={i < walls} size={16} />
          </span>
        ))}
      </div>

      {/* Aclaración: para qué sirven los muros. */}
      <p className="mt-2 text-[10px] leading-snug text-neutral-500">
        Cada muro sube en +2 tu límite de mano: con un 7 descartas solo si tienes
        más de {handLimit} {handLimit === 1 ? 'carta' : 'cartas'} (recursos y
        mercancías).
      </p>

      {/* Construir muro. */}
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
            buildWall();
          }}
          className={
            'flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ' +
            (buildDisabled
              ? 'cursor-not-allowed border border-white/10 bg-surface-1 text-neutral-500'
              : 'border border-ck-steel/50 bg-ck-steel/15 text-neutral-50 active:scale-[0.98] active:bg-ck-steel/25')
          }
        >
          <span className="flex items-center gap-2">
            <WallGlyph filled={!buildDisabled} size={24} />
            Construir muro
          </span>
          <WallCostBadge cost={WALL_BUILD_COST} muted={buildDisabled} />
        </button>
        {canAct && buildDisabled && buildReason ? (
          <p className="mt-1 text-[10px] leading-tight text-neutral-500">
            {buildReason}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Badge de costo en recursos del muro (mismo lenguaje que el CostBadge de
// KnightsPanel: los muros no usan BUILD_COSTS).
function WallCostBadge({
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
