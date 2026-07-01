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
import { CommodityGlyph, DisciplineGlyph, MetropolisGlyph } from '../assets/icons';

// ─── Calendario de la ciudad (Caballeros y Ciudades, brief §2.4/§2.5) ─────────
//
// Tres disciplinas (Comercio/amarillo↔tela, Política/azul↔moneda,
// Ciencia/verde↔papel) como tarjetas apiladas (móvil) / columnas (md+). Cada
// una muestra: nivel actual (0–5) con una mini-escala de 5 pasos donde 3/4/5
// están marcados como hitos (descritos en los tooltips de cada paso) y una
// única etiqueta visible "Metrópolis" alineada bajo el nivel 4, la habilidad de
// nivel 3 y si está desbloqueada, el indicador de metrópolis (propia o ajena) y
// el botón "Mejorar" con el costo del siguiente nivel.
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
    abilityChip: 'bg-discipline-trade/20 text-neutral-100',
    upgradeBtn:
      'border border-discipline-trade/50 bg-discipline-trade/15 text-neutral-50 active:scale-[0.98] active:bg-discipline-trade/25',
  },
  politics: {
    text: 'text-discipline-politics',
    fill: 'bg-discipline-politics',
    ringMilestone: 'ring-1 ring-inset ring-discipline-politics/40',
    cardBorder: 'border-discipline-politics/35',
    abilityBox: 'border-discipline-politics/40 bg-discipline-politics/10',
    abilityChip: 'bg-discipline-politics/20 text-neutral-100',
    upgradeBtn:
      'border border-discipline-politics/50 bg-discipline-politics/15 text-neutral-50 active:scale-[0.98] active:bg-discipline-politics/25',
  },
  science: {
    text: 'text-discipline-science',
    fill: 'bg-discipline-science',
    ringMilestone: 'ring-1 ring-inset ring-discipline-science/40',
    cardBorder: 'border-discipline-science/35',
    abilityBox: 'border-discipline-science/40 bg-discipline-science/10',
    abilityChip: 'bg-discipline-science/20 text-neutral-100',
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
            craneActive={!!me.craneDiscount}
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
  craneActive,
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
  // Grúa activa este turno: la próxima mejora de disciplina cuesta 1 menos
  // (piso en 0). El servidor aplica exactamente el mismo cálculo.
  craneActive: boolean;
  canAct: boolean;
  onUpgrade: () => void;
  onBlocked: (reason: string) => void;
}): JSX.Element {
  const cls = DISCIPLINE_CLASSES[discipline];
  const commodity = DISCIPLINE_COMMODITY[discipline];
  const atMax = level >= MAX_IMPROVEMENT_LEVEL;
  const nextLevel = level + 1;
  const cost = improvementUpgradeCost(nextLevel);
  // Costo efectivo con la Grúa: -1 mercancía, mínimo 0. Se usa para TODO lo
  // que el jugador ve/acciona (asequibilidad, botón, aria, textos), para que
  // coincida con lo que cobra el servidor.
  const effectiveCost = Math.max(0, cost - (craneActive ? 1 : 0));
  // La Grúa solo aplica si aún se puede mejorar (nivel < máximo) y hay
  // descuento real que mostrar.
  const craneApplies = craneActive && !atMax && effectiveCost < cost;
  const canAfford = commodityHave >= effectiveCost;
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
        ? `Te falta ${effectiveCost - commodityHave} ${COMMODITY_NAMES_LOWER[commodity]} para mejorar.`
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
      {/* Etiqueta del único hito con texto visible: "Metrópolis" (nivel 4).
          Es un grid de 5 columnas que ESPEJA la mini-escala (mismas columnas y
          `gap-1`), con la etiqueta fijada a la 4ª columna (`col-start-4`) para
          que quede exactamente bajo el 4º paso. Dorada al alcanzarse, apagada
          mientras no. */}
      <div className="mt-1 grid grid-cols-5 gap-1 text-[9px] font-medium uppercase tracking-[0.06em]">
        <span
          className={
            'col-start-4 whitespace-nowrap text-center ' +
            (level >= 4 ? 'text-gold' : 'text-neutral-500')
          }
        >
          Metrópolis
        </span>
      </div>

      {/* Habilidad de nivel 3. Desbloqueada (nivel ≥ 3) se REFUERZA como
          ACTIVA: caja con el tinte de la disciplina, anillo sutil y una
          insignia "Activa" con un punto de estado encendido; el beneficio se
          aclara un grado para que se lea de inmediato. Bloqueada queda inerte
          ("Nivel 3") en gris. */}
      <div
        className={
          'mt-2.5 rounded-lg border px-2.5 py-2 transition-colors ' +
          (abilityUnlocked
            ? cls.abilityBox + ' ' + cls.ringMilestone
            : 'border-white/10 bg-surface-1')
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
            role="status"
            aria-label={
              abilityUnlocked
                ? `${DISCIPLINE_LEVEL3_ABILITY[discipline]}: habilidad activa`
                : `${DISCIPLINE_LEVEL3_ABILITY[discipline]}: se desbloquea en el nivel 3`
            }
            className={
              'inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ' +
              (abilityUnlocked
                ? cls.abilityChip
                : 'bg-white/[0.06] text-neutral-500')
            }
          >
            {abilityUnlocked ? (
              <>
                <span
                  className={'h-1.5 w-1.5 flex-shrink-0 rounded-full ' + cls.fill}
                  aria-hidden
                />
                Activa
              </>
            ) : (
              'Nivel 3'
            )}
          </span>
        </div>
        <p
          className={
            'mt-1 text-[10px] leading-snug ' +
            (abilityUnlocked ? 'text-neutral-300' : 'text-neutral-400')
          }
        >
          {DISCIPLINE_LEVEL3_ABILITY_DESC[discipline]}
        </p>
      </div>

      {/* Indicador de metrópolis. */}
      {ownsMetropolis ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-gold/50 bg-gradient-to-b from-gold/[0.14] to-ck-crimson/[0.08] px-2.5 py-1.5">
          <MetropolisGlyph size={18} />
          <span className="text-[11px] font-semibold tracking-tight text-gold-light">
            Tu metrópolis de {DISCIPLINE_NAMES[discipline]}
          </span>
          <span className="ml-auto nums text-[10px] font-bold text-gold-light">
            4 PV
          </span>
        </div>
      ) : metropolisIsForeign ? (
        <div className="mt-2 flex items-center gap-1.5 px-0.5 text-[10px] text-neutral-400">
          <MetropolisGlyph size={14} className="opacity-60" />
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
          <>
            {/* Señal de la Grúa: costo original tachado + descuento aplicado.
                Chip discreto con el tinte de la disciplina; no rompe el ancho
                estrecho de la tarjeta en móvil (se apila sobre el botón). */}
            {craneApplies ? (
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={
                    'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ' +
                    cls.abilityBox +
                    ' ' +
                    cls.text
                  }
                >
                  <DisciplineGlyph discipline={discipline} size={11} />
                  Grúa −1
                </span>
                <span className="flex items-center gap-1 text-[10px] text-neutral-400">
                  <span className="nums line-through decoration-neutral-500">
                    {cost}
                  </span>
                  <span aria-hidden>→</span>
                  <span className={'nums font-bold ' + cls.text}>
                    {effectiveCost}
                  </span>
                  <CommodityGlyph commodity={commodity} size={13} />
                </span>
              </div>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              onClick={onUpgrade}
              title={reason ?? undefined}
              aria-label={
                disabled
                  ? `Mejorar ${DISCIPLINE_NAMES[discipline]} a nivel ${nextLevel}. ${reason}`
                  : craneApplies
                    ? `Mejorar ${DISCIPLINE_NAMES[discipline]} a nivel ${nextLevel} por ${effectiveCost} ${COMMODITY_NAMES_LOWER[commodity]} (Grúa: 1 menos)`
                    : `Mejorar ${DISCIPLINE_NAMES[discipline]} a nivel ${nextLevel} por ${effectiveCost} ${COMMODITY_NAMES_LOWER[commodity]}`
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
                {craneApplies ? (
                  <span className="nums text-[11px] font-medium text-neutral-500 line-through decoration-neutral-500">
                    {cost}
                  </span>
                ) : null}
                <span className="nums font-bold">{effectiveCost}</span>
                <CommodityGlyph commodity={commodity} size={18} />
              </span>
            </button>
          </>
        ) : (
          // Informativo para no-activos: muestra el costo del siguiente nivel
          // sin botón accionable (con el descuento de Grúa si aplica).
          <div
            className="flex min-h-[44px] w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-[11px] font-medium text-neutral-400"
            aria-label={
              craneApplies
                ? `Siguiente nivel ${nextLevel}: ${effectiveCost} ${COMMODITY_NAMES_LOWER[commodity]} (Grúa: 1 menos)`
                : `Siguiente nivel ${nextLevel}: ${effectiveCost} ${COMMODITY_NAMES_LOWER[commodity]}`
            }
          >
            <span>Siguiente: nivel {nextLevel}</span>
            <span className="flex items-center gap-1">
              {craneApplies ? (
                <span className="nums text-neutral-500 line-through decoration-neutral-500">
                  {cost}
                </span>
              ) : null}
              <span className="nums font-bold text-neutral-200">
                {effectiveCost}
              </span>
              <CommodityGlyph commodity={commodity} size={16} />
            </span>
            {craneApplies ? (
              <span className={'text-[9px] font-semibold uppercase tracking-[0.06em] ' + cls.text}>
                Grúa −1
              </span>
            ) : null}
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

