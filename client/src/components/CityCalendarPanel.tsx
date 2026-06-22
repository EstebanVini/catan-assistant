import { useStore } from '../store';
import {
  DISCIPLINES,
  DISCIPLINE_COMMODITY,
  DISCIPLINE_LEVEL3_ABILITY,
  Discipline,
  MAX_IMPROVEMENT_LEVEL,
  PublicPlayer,
  improvementUpgradeCost,
} from '../types';
import {
  COMMODITY_NAMES,
  COMMODITY_NAMES_LOWER,
  DISCIPLINE_NAMES,
  DISCIPLINE_LEVEL3_ABILITY_DESC,
} from '../lib/spanish';
import { CommodityGlyph, DisciplineGlyph } from '../assets/icons';

// ─── Calendario de la ciudad (Caballeros y Ciudades, brief §2.4/§2.5) ─────────
//
// Tres disciplinas (Comercio/amarillo↔tela, Política/azul↔moneda,
// Ciencia/verde↔papel) como tarjetas apiladas (móvil) / columnas (md+). Cada
// una muestra: nivel actual (0–5) con una mini-escala de 5 pasos donde 3/4/5
// están marcados (habilidad / metrópolis / arrebatar), la habilidad de nivel 3
// y si está desbloqueada, el indicador de metrópolis (propia o ajena) y el
// botón "Mejorar" con el costo del siguiente nivel.
//
// El botón solo es accionable para el jugador activo en su turno (mismo
// criterio que ActionGrid: `main` con el turno actual, o `specialBuild` con la
// cabeza de cola). Para los demás el panel es puramente informativo.

// Etiqueta corta de cada hito del calendario, para los tooltips de la escala.
const STEP_MEANING: Record<number, (d: Discipline) => string> = {
  3: (d) => `Nivel 3 — ${DISCIPLINE_LEVEL3_ABILITY[d]}`,
  4: () => 'Nivel 4 — habilita la metrópolis',
  5: () => 'Nivel 5 — puedes arrebatar la metrópolis',
};

// Clases Tailwind por disciplina como cadenas LITERALES. El JIT de Tailwind no
// detecta clases construidas dinámicamente (`bg-discipline-${d}`), así que cada
// utilidad usada vive aquí completa por disciplina. Cambiar el set de utilidades
// = tocar solo este mapa.
interface DisciplineClasses {
  text: string; // texto en el color de la disciplina
  fill: string; // relleno sólido (pasos llenos de la escala)
  ringMilestone: string; // anillo de hito en pasos vacíos
  cardBorder: string; // borde de la tarjeta (sin metrópolis)
  abilityBox: string; // caja de habilidad desbloqueada
  abilityChip: string; // chip "Activa"
  upgradeBtn: string; // botón Mejorar habilitado
}

const DISCIPLINE_CLASSES: Record<Discipline, DisciplineClasses> = {
  trade: {
    text: 'text-discipline-trade',
    fill: 'bg-discipline-trade',
    ringMilestone: 'ring-1 ring-inset ring-discipline-trade/40',
    cardBorder: 'border-discipline-trade/35',
    abilityBox: 'border-discipline-trade/40 bg-discipline-trade/10',
    abilityChip: 'bg-discipline-trade/20 text-discipline-trade',
    upgradeBtn:
      'border border-discipline-trade/50 bg-discipline-trade/15 text-neutral-50 active:scale-[0.98] active:bg-discipline-trade/25',
  },
  politics: {
    text: 'text-discipline-politics',
    fill: 'bg-discipline-politics',
    ringMilestone: 'ring-1 ring-inset ring-discipline-politics/40',
    cardBorder: 'border-discipline-politics/35',
    abilityBox: 'border-discipline-politics/40 bg-discipline-politics/10',
    abilityChip: 'bg-discipline-politics/20 text-discipline-politics',
    upgradeBtn:
      'border border-discipline-politics/50 bg-discipline-politics/15 text-neutral-50 active:scale-[0.98] active:bg-discipline-politics/25',
  },
  science: {
    text: 'text-discipline-science',
    fill: 'bg-discipline-science',
    ringMilestone: 'ring-1 ring-inset ring-discipline-science/40',
    cardBorder: 'border-discipline-science/35',
    abilityBox: 'border-discipline-science/40 bg-discipline-science/10',
    abilityChip: 'bg-discipline-science/20 text-discipline-science',
    upgradeBtn:
      'border border-discipline-science/50 bg-discipline-science/15 text-neutral-50 active:scale-[0.98] active:bg-discipline-science/25',
  },
};

export function CityCalendarPanel(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const upgradeCity = useStore((s) => s.upgradeCity);
  const pushToast = useStore((s) => s.pushToast);

  if (!view || !view.me) return null;
  const { state, me } = view;
  if (!state.citiesKnights) return null;

  const myPublic = state.players.find((p) => p.id === me.id) ?? null;

  const activeId = state.turnOrder[state.currentTurnIndex];
  const isMyTurn = activeId === me.id;
  const inMain = state.phase === 'main' && isMyTurn;
  const inSpecial =
    state.phase === 'specialBuild' && state.specialBuildQueue[0] === me.id;
  // Solo el jugador activo en su ventana de construcción puede mejorar.
  const canAct = inMain || inSpecial;

  // `ck-calendar` define el contexto de container query (ver index.css): el
  // grid interno se apila por defecto y solo pasa a 3 columnas cuando ESTE
  // contenedor —no el viewport— es lo bastante ancho. Evita el amontonamiento
  // en la columna estrecha del layout de escritorio.
  return (
    <div className="ck-calendar p-3">
      <div className="ck-calendar-grid">
        {DISCIPLINES.map((discipline) => (
          <DisciplineCard
            key={discipline}
            discipline={discipline}
            level={myPublic?.improvements[discipline] ?? 0}
            ownsMetropolis={!!myPublic?.metropolises.includes(discipline)}
            metropolisOwnerId={state.metropolisOwners[discipline]}
            ownerName={ownerName(state.players, state.metropolisOwners[discipline])}
            myId={me.id}
            commodityHave={me.commodities[DISCIPLINE_COMMODITY[discipline]]}
            canAct={canAct}
            onUpgrade={() => upgradeCity(discipline)}
            onBlocked={(reason) => pushToast('info', reason)}
          />
        ))}
      </div>
    </div>
  );
}

function ownerName(
  players: PublicPlayer[],
  ownerId: string | null
): string | null {
  if (!ownerId) return null;
  return players.find((p) => p.id === ownerId)?.name ?? null;
}

function DisciplineCard({
  discipline,
  level,
  ownsMetropolis,
  metropolisOwnerId,
  ownerName: metropolisOwnerName,
  myId,
  commodityHave,
  canAct,
  onUpgrade,
  onBlocked,
}: {
  discipline: Discipline;
  level: number;
  ownsMetropolis: boolean;
  metropolisOwnerId: string | null;
  ownerName: string | null;
  myId: string;
  commodityHave: number;
  canAct: boolean;
  onUpgrade: () => void;
  onBlocked: (reason: string) => void;
}): JSX.Element {
  const cls = DISCIPLINE_CLASSES[discipline];
  const commodity = DISCIPLINE_COMMODITY[discipline];
  const atMax = level >= MAX_IMPROVEMENT_LEVEL;
  const nextLevel = level + 1;
  const cost = improvementUpgradeCost(nextLevel);
  const canAfford = commodityHave >= cost;
  const abilityUnlocked = level >= 3;

  // Metrópolis ajena: la tiene otro jugador (no yo) en esta disciplina.
  const metropolisIsForeign =
    !!metropolisOwnerId && metropolisOwnerId !== myId;

  // Razón por la que el botón no es accionable (para texto/aria/toast). El
  // orden refleja la prioridad de la explicación al jugador.
  const reason: string | null = atMax
    ? 'Ya alcanzaste el nivel máximo.'
    : !canAct
      ? 'Solo puedes mejorar en tu turno.'
      : !canAfford
        ? `Te falta ${cost - commodityHave} ${COMMODITY_NAMES_LOWER[commodity]} para mejorar.`
        : null;

  const disabled = reason !== null;

  return (
    <div
      className={
        'relative flex flex-col rounded-xl border bg-surface-2 p-3 transition-colors ' +
        (ownsMetropolis
          ? 'border-gold/60 shadow-[0_0_0_1px_rgba(217,169,62,0.18)]'
          : cls.cardBorder)
      }
    >
      {/* Encabezado: glifo + nombre + nivel actual. */}
      <div className="flex items-center gap-2">
        <DisciplineGlyph discipline={discipline} size={28} />
        <div className="min-w-0 flex-1">
          <div
            className={
              'truncate text-sm font-semibold tracking-tight ' + cls.text
            }
          >
            {DISCIPLINE_NAMES[discipline]}
          </div>
          <div className="text-[10px] leading-tight text-neutral-400">
            Mercancía: {COMMODITY_NAMES[commodity]}
          </div>
        </div>
        <span
          className="nums flex-shrink-0 text-base font-bold text-neutral-50"
          aria-label={`Nivel ${level} de ${MAX_IMPROVEMENT_LEVEL}`}
        >
          {level}
          <span className="text-[11px] font-medium text-neutral-500">
            /{MAX_IMPROVEMENT_LEVEL}
          </span>
        </span>
      </div>

      {/* Mini-escala de 5 pasos: 3/4/5 marcados como hitos. */}
      <div
        className="mt-2.5 flex items-center gap-1"
        role="img"
        aria-label={`Nivel ${level} de ${MAX_IMPROVEMENT_LEVEL}`}
      >
        {Array.from({ length: MAX_IMPROVEMENT_LEVEL }, (_, i) => {
          const step = i + 1;
          const filled = step <= level;
          const milestone = step >= 3;
          const title =
            step in STEP_MEANING ? STEP_MEANING[step](discipline) : `Nivel ${step}`;
          return (
            <span
              key={step}
              title={title}
              className={
                'h-2 flex-1 rounded-full transition-colors ' +
                (filled ? cls.fill : 'bg-white/[0.08]') +
                (milestone && !filled ? ' ' + cls.ringMilestone : '')
              }
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] font-medium uppercase tracking-[0.06em] text-neutral-500">
        <span className={level >= 3 ? cls.text : ''}>Habilidad</span>
        <span className={level >= 4 ? 'text-gold' : ''}>Metrópolis</span>
        <span className={level >= 5 ? 'text-gold' : ''}>Arrebatar</span>
      </div>

      {/* Habilidad de nivel 3. */}
      <div
        className={
          'mt-2.5 rounded-lg border px-2.5 py-2 ' +
          (abilityUnlocked ? cls.abilityBox : 'border-white/10 bg-surface-1')
        }
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={
              'text-[11px] font-semibold tracking-tight ' +
              (abilityUnlocked ? cls.text : 'text-neutral-300')
            }
          >
            {DISCIPLINE_LEVEL3_ABILITY[discipline]}
          </span>
          <span
            className={
              'flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ' +
              (abilityUnlocked
                ? cls.abilityChip
                : 'bg-white/[0.06] text-neutral-500')
            }
          >
            {abilityUnlocked ? 'Activa' : 'Nivel 3'}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-neutral-400">
          {DISCIPLINE_LEVEL3_ABILITY_DESC[discipline]}
        </p>
      </div>

      {/* Indicador de metrópolis. */}
      {ownsMetropolis ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-gold/50 bg-gradient-to-b from-gold/[0.14] to-ck-crimson/[0.08] px-2.5 py-1.5">
          <MetropolisMark size={16} />
          <span className="text-[11px] font-semibold tracking-tight text-gold-light">
            Tu metrópolis de {DISCIPLINE_NAMES[discipline]}
          </span>
          <span className="ml-auto nums text-[10px] font-bold text-gold-light">
            4 PV
          </span>
        </div>
      ) : metropolisIsForeign ? (
        <div className="mt-2 flex items-center gap-1.5 px-0.5 text-[10px] text-neutral-400">
          <MetropolisMark size={12} muted />
          <span>
            Metrópolis de{' '}
            <span className="font-semibold text-neutral-300">
              {metropolisOwnerName ?? 'otro jugador'}
            </span>
          </span>
        </div>
      ) : null}

      {/* Botón "Mejorar". Solo accionable para el jugador activo en su turno;
          para los demás el panel es informativo (botón inerte con la razón). */}
      <div className="mt-2.5">
        {atMax ? (
          <div className="rounded-lg border border-gold/30 bg-gold/[0.08] px-3 py-2 text-center text-[11px] font-medium text-gold-light">
            Nivel máximo alcanzado
          </div>
        ) : canAct ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onUpgrade}
            title={reason ?? undefined}
            aria-label={
              disabled
                ? `Mejorar ${DISCIPLINE_NAMES[discipline]} a nivel ${nextLevel}. ${reason}`
                : `Mejorar ${DISCIPLINE_NAMES[discipline]} a nivel ${nextLevel} por ${cost} ${COMMODITY_NAMES_LOWER[commodity]}`
            }
            className={
              'flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all ' +
              (disabled
                ? 'cursor-not-allowed border border-white/10 bg-surface-1 text-neutral-500'
                : cls.upgradeBtn)
            }
          >
            <span>Mejorar a {nextLevel}</span>
            <span className="flex items-center gap-1">
              <span className="nums font-bold">{cost}</span>
              <CommodityGlyph commodity={commodity} size={18} />
            </span>
          </button>
        ) : (
          // Informativo para no-activos: muestra el costo del siguiente nivel
          // sin botón accionable.
          <div
            className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-[11px] font-medium text-neutral-400"
            aria-label={`Siguiente nivel ${nextLevel}: ${cost} ${COMMODITY_NAMES_LOWER[commodity]}`}
          >
            <span>Siguiente: nivel {nextLevel}</span>
            <span className="flex items-center gap-1">
              <span className="nums font-bold text-neutral-200">{cost}</span>
              <CommodityGlyph commodity={commodity} size={16} />
            </span>
          </div>
        )}
        {/* En mi turno, si el botón está bloqueado por mercancía, deja claro
            por qué bajo el botón (no solo en el title/aria, inaccesibles al
            tacto). */}
        {canAct && disabled && reason ? (
          <button
            type="button"
            onClick={() => onBlocked(reason)}
            className="mt-1 w-full text-left text-[10px] leading-tight text-neutral-500"
          >
            {reason}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Marca heráldica de metrópolis: torre almenada sobre escudo, en dorado/carmesí
// (coherente con el lenguaje de medalla del set; arte definitivo pendiente,
// missing-icons.md §4). Decorativa: el texto vecino la nombra.
function MetropolisMark({
  size = 16,
  muted = false,
}: {
  size?: number;
  muted?: boolean;
}): JSX.Element {
  const gold = muted ? '#8b919b' : '#d9a93e';
  const crimson = muted ? '#5e1d1a' : '#bf4a40';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="flex-shrink-0"
    >
      {/* Escudo */}
      <path
        d="M12 2.5 L20 5 V11 C20 16.5 16.4 19.8 12 21.5 C7.6 19.8 4 16.5 4 11 V5 Z"
        fill={crimson}
        stroke={gold}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Torre almenada */}
      <g fill={gold}>
        <rect x="8" y="9.5" width="8" height="6" rx="0.4" />
        <rect x="8" y="8" width="1.6" height="2" />
        <rect x="11.2" y="8" width="1.6" height="2" />
        <rect x="14.4" y="8" width="1.6" height="2" />
      </g>
      {/* Portón */}
      <path
        d="M11 15.5 V12.6 A1 1 0 0 1 13 12.6 V15.5 Z"
        fill={crimson}
      />
    </svg>
  );
}
