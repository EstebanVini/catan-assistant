import { useRef, useState } from 'react';
import { useStore } from '../store';
import {
  Commodity,
  DISCIPLINES,
  Discipline,
  PROGRESS_CARD_DISCIPLINE,
  PROGRESS_HAND_LIMIT,
  PROGRESS_NEEDS_COMMODITY,
  PROGRESS_NEEDS_KNIGHTS,
  PROGRESS_NEEDS_SETTLEMENT,
  PROGRESS_NEEDS_TARGET,
  PROGRESS_NEEDS_TYPE,
  ProgressCardType,
  Resource,
  isProgressAutomated,
  playerVictoryPoints,
} from '../types';
import {
  DISCIPLINE_NAMES,
  PROGRESS_CARD_NAMES,
  PROGRESS_CARD_DESCRIPTIONS,
} from '../lib/spanish';
import { ProgressCardGlyph } from '../assets/icons';
import { useModalA11y } from '../lib/useModalA11y';
import { ResourceMonopolyPickerModal } from './ResourceMonopolyPickerModal';
import { CommodityMonopolyPickerModal } from './CommodityMonopolyPickerModal';
import { MerchantPlacementPickerModal } from './MerchantPlacementPickerModal';
import { MerchantFleetPickerModal } from './MerchantFleetPickerModal';
import { OpponentTargetPickerModal } from './OpponentTargetPickerModal';
import { SettlementUpgradePickerModal } from './SettlementUpgradePickerModal';
import { KnightPromotePickerModal } from './KnightPromotePickerModal';

// ─── Mano de cartas de progreso (Caballeros y Ciudades, §2.10) ────────────────
//
// Vista PRIVADA del dueño: lista mis `me.progressCards` agrupadas por disciplina
// (color), con nombre en español, descripción breve y un contador "X / 4".
//
// Fase C3 — JUGABILIDAD bajo la filosofía de "registro asistido" (§13.2): el
// cliente NO decide la lógica de ninguna carta, solo emite `progress:play`. El
// servidor resuelve lo que puede automatizar (PROGRESS_AUTOMATED) y, para el
// resto, retira la carta de la mano y avisa a la mesa — los jugadores la
// resuelven físicamente. Por eso cada carta lleva un badge "Automática" / "En
// mesa" para fijar expectativas antes de jugarla.
//
// Flujo del botón "Jugar" (solo en MI turno, fase 'main'):
//   - resourceMonopoly  → picker de RECURSO   → playProgress({ card, resource })
//   - tradeMonopoly     → picker de MERCANCÍA  → playProgress({ card, commodity })
//   - resto             → diálogo de confirmación → playProgress({ card })
//
// Excedente: si `state.pendingProgressDiscard[me.id] > 0` el jugador robó por
// encima del límite de 4 y debe SOLTAR cartas hasta cumplir ese número. En ese
// caso mostramos un aviso prominente y un botón "Descartar" por carta. Mientras
// hay excedente NO se permite jugar (primero hay que regularizar la mano).
//
// Clases por disciplina como cadenas LITERALES (el JIT de Tailwind no detecta
// `text-discipline-${d}`), igual que CityCalendarPanel.

interface DisciplineClasses {
  text: string;
  cardBorder: string;
  headerDot: string;
}

const DISCIPLINE_CLASSES: Record<Discipline, DisciplineClasses> = {
  trade: {
    text: 'text-discipline-trade',
    cardBorder: 'border-discipline-trade/35',
    headerDot: 'bg-discipline-trade',
  },
  politics: {
    text: 'text-discipline-politics',
    cardBorder: 'border-discipline-politics/35',
    headerDot: 'bg-discipline-politics',
  },
  science: {
    text: 'text-discipline-science',
    cardBorder: 'border-discipline-science/35',
    headerDot: 'bg-discipline-science',
  },
};

// Una carta es "automática" si el servidor la resuelve por completo; el resto se
// resuelve en la mesa. `isProgressAutomated` (espejo de `types.ts`) es la fuente
// de verdad: ahora muchas más cartas se automatizan.
function isAutomated(card: ProgressCardType): boolean {
  return isProgressAutomated(card);
}

// Qué picker abre cada carta al jugarse. `merchant` comparte la lista
// PROGRESS_NEEDS_RESOURCE con `resourceMonopoly`, pero su picker (y su copy) es
// propio, así que lo resolvemos antes que el resto.
type PickerKind =
  | 'resourceMonopoly'
  | 'merchant'
  | 'commodity'
  | 'type'
  | 'target'
  | 'settlement'
  | 'knights'
  | 'confirm';

function pickerKindFor(card: ProgressCardType): PickerKind {
  if (card === 'merchant') return 'merchant';
  if (card === 'resourceMonopoly') return 'resourceMonopoly';
  if (PROGRESS_NEEDS_COMMODITY.includes(card)) return 'commodity';
  if (PROGRESS_NEEDS_TYPE.includes(card)) return 'type';
  if (PROGRESS_NEEDS_TARGET.includes(card)) return 'target';
  if (PROGRESS_NEEDS_SETTLEMENT.includes(card)) return 'settlement';
  if (PROGRESS_NEEDS_KNIGHTS.includes(card)) return 'knights';
  return 'confirm';
}

export function ProgressHand(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const discardProgress = useStore((s) => s.discardProgress);
  const playProgress = useStore((s) => s.playProgress);

  // Carta para la que hay un picker / confirmación abierta. El picker de
  // recurso/mercancía se elige según el tipo; el resto pasa por confirmación.
  const [activeCard, setActiveCard] = useState<ProgressCardType | null>(null);

  if (!view || !view.me) return null;
  const { state, me } = view;
  if (!state.citiesKnights) return null;

  const cards = me.progressCards;
  const count = cards.length;
  // F1 — Regla extra "Cartas de progreso ilimitadas": no hay límite de mano.
  // El servidor nunca fija `pendingProgressDiscard` en este modo, pero además
  // anclamos el excedente a `!unlimited` para que ningún copy de límite (el
  // aviso rojo, el contador "/ 4") se muestre aunque llegara un valor residual.
  const unlimited = state.extraRules.unlimitedProgressCards;
  const mustDiscard = state.pendingProgressDiscard[me.id] ?? 0;
  const overLimit = mustDiscard > 0 && !unlimited;

  // Mismo criterio de "mi turno en fase principal" que ActionGrid. Mientras hay
  // excedente bloqueamos el juego: primero hay que descartar hasta el límite.
  const activeId = state.turnOrder[state.currentTurnIndex];
  const isMyTurn = activeId === me.id;
  const canPlay = isMyTurn && state.phase === 'main' && !overLimit;

  // Datos públicos del jugador local (caballeros + niveles de mejora) y de los
  // rivales, para alimentar los pickers de objetivo / caballeros.
  const myPublic = state.players.find((p) => p.id === me.id) ?? null;
  const myKnights = myPublic?.knights ?? [];
  const myPolitics = myPublic?.improvements.politics ?? 0;
  const myVictoryPoints = myPublic
    ? playerVictoryPoints(myPublic, state.merchant?.ownerId)
    : 0;
  const opponents = state.players.filter((p) => p.id !== me.id);
  const mySettlements = (me.buildings ?? []).filter(
    (b) => b.type === 'settlement'
  );
  // Comerciante actual en mesa (recurso + nombre del dueño), si existe.
  const currentMerchant = state.merchant
    ? {
        resource: state.merchant.resource,
        ownerName:
          state.players.find((p) => p.id === state.merchant!.ownerId)?.name ??
          null,
      }
    : null;

  // Agrupamos por disciplina, en el orden canónico (Comercio, Política,
  // Ciencia). Dentro de cada grupo conservamos el orden de llegada.
  const grouped: Record<Discipline, ProgressCardType[]> = {
    trade: [],
    politics: [],
    science: [],
  };
  for (const card of cards) {
    grouped[PROGRESS_CARD_DISCIPLINE[card]].push(card);
  }

  function closeModal() {
    setActiveCard(null);
  }

  // Handlers de confirmación de cada flujo. Cada picker/confirmación emite el
  // `progress:play` correspondiente; el cierre del modal lo dispara el propio
  // picker (optimista) o el padre.
  function handlePlayResource(resource: Resource) {
    if (!activeCard) return;
    playProgress({ card: activeCard, resource });
  }
  function handlePlayCommodity(commodity: Commodity) {
    if (!activeCard) return;
    playProgress({ card: activeCard, commodity });
  }
  // Flota Mercante: el picker manda `resource` O `commodity` (uno solo).
  function handlePlayType(payload: {
    resource?: Resource;
    commodity?: Commodity;
  }) {
    if (!activeCard) return;
    playProgress({ card: activeCard, ...payload });
  }
  // Espía / Maestro Mercader / Desertor: oponente y, opcional, caballero.
  function handlePlayTarget(payload: {
    targetPlayerId: string;
    knightIds?: string[];
  }) {
    if (!activeCard) return;
    playProgress({ card: activeCard, ...payload });
  }
  // Medicina: poblado propio a convertir en ciudad.
  function handlePlaySettlement(settlementId: string) {
    if (!activeCard) return;
    playProgress({ card: activeCard, settlementId });
  }
  // Herrero: caballeros propios a promover.
  function handlePlayKnights(knightIds: string[]) {
    if (!activeCard) return;
    playProgress({ card: activeCard, knightIds });
  }
  function handlePlaySimple() {
    if (!activeCard) return;
    playProgress({ card: activeCard });
    closeModal();
  }

  return (
    <div className="p-3">
      {/* Contador. En modo normal "X / 4" (carmesí si hay excedente). En modo
          ilimitado (F1) mostramos solo el número con una etiqueta sutil
          "sin límite", sin implicar un tope que no existe. */}
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] leading-tight text-neutral-400">
          Las robas con el calendario. No se pueden comerciar.
        </span>
        {unlimited ? (
          <span
            className="nums flex-shrink-0 text-sm font-bold tabular-nums text-neutral-100"
            aria-label={`${count} ${
              count === 1 ? 'carta' : 'cartas'
            } de progreso, sin límite de mano`}
          >
            {count}
            <span className="ml-1 align-baseline text-[10px] font-medium uppercase tracking-[0.04em] text-neutral-500">
              sin límite
            </span>
          </span>
        ) : (
          <span
            className={
              'nums flex-shrink-0 text-sm font-bold tabular-nums ' +
              (overLimit ? 'text-red-300' : 'text-neutral-100')
            }
            aria-label={`${count} de ${PROGRESS_HAND_LIMIT} cartas de progreso`}
          >
            {count}
            <span className="text-[11px] font-medium text-neutral-500">
              {' / '}
              {PROGRESS_HAND_LIMIT}
            </span>
          </span>
        )}
      </div>

      {/* Aviso prominente de excedente (>4). */}
      {overLimit ? (
        <div
          role="alert"
          className="mb-2.5 rounded-lg border border-ck-crimson/50 bg-ck-crimson/[0.12] px-3 py-2"
        >
          <p className="text-[12px] font-semibold tracking-tight text-red-300">
            Tienes más de {PROGRESS_HAND_LIMIT} cartas de progreso
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-300">
            Debes descartar {mustDiscard}{' '}
            {mustDiscard === 1 ? 'carta' : 'cartas'} hasta quedarte con{' '}
            {PROGRESS_HAND_LIMIT}. Toca «Descartar» en la carta que prefieras
            soltar.
          </p>
        </div>
      ) : null}

      {count === 0 ? (
        <p className="rounded-lg border border-white/10 bg-surface-1 px-3 py-3 text-center text-[11px] text-neutral-400">
          Aún no tienes cartas de progreso. Sube tus disciplinas para robarlas
          cuando salga una puerta de color.
        </p>
      ) : (
        <div className="space-y-3">
          {DISCIPLINES.map((discipline) => {
            const group = grouped[discipline];
            if (group.length === 0) return null;
            const cls = DISCIPLINE_CLASSES[discipline];
            return (
              <div key={discipline}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className={
                      'h-2 w-2 flex-shrink-0 rounded-full ring-1 ring-inset ring-black/30 ' +
                      cls.headerDot
                    }
                    aria-hidden
                  />
                  <span
                    className={
                      'text-[10px] font-semibold uppercase tracking-[0.08em] ' +
                      cls.text
                    }
                  >
                    {DISCIPLINE_NAMES[discipline]}
                  </span>
                  <span className="nums text-[10px] font-medium text-neutral-500">
                    ({group.length})
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {group.map((card, idx) => (
                    <ProgressCardRow
                      // Una disciplina puede traer cartas repetidas; el índice
                      // dentro del grupo desambigua el key.
                      key={`${card}-${idx}`}
                      card={card}
                      borderClass={cls.cardBorder}
                      // Solo permitimos descartar cuando hay excedente.
                      onDiscard={
                        overLimit ? () => discardProgress(card) : undefined
                      }
                      // El botón "Jugar" solo se ofrece en mi turno (fase
                      // principal, sin excedente pendiente).
                      onPlay={canPlay ? () => setActiveCard(card) : undefined}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Flujo de juego: picker o confirmación según el tipo de carta. Un solo
          `pickerKindFor` decide cuál se monta para evitar condiciones cruzadas. */}
      {activeCard
        ? (() => {
            switch (pickerKindFor(activeCard)) {
              case 'resourceMonopoly':
                return (
                  <ResourceMonopolyPickerModal
                    onConfirm={handlePlayResource}
                    onClose={closeModal}
                  />
                );
              case 'merchant':
                return (
                  <MerchantPlacementPickerModal
                    currentMerchant={currentMerchant}
                    onConfirm={handlePlayResource}
                    onClose={closeModal}
                  />
                );
              case 'commodity':
                return (
                  <CommodityMonopolyPickerModal
                    onConfirm={handlePlayCommodity}
                    onClose={closeModal}
                  />
                );
              case 'type':
                return (
                  <MerchantFleetPickerModal
                    onConfirm={handlePlayType}
                    onClose={closeModal}
                  />
                );
              case 'target':
                return (
                  <OpponentTargetPickerModal
                    card={activeCard as 'spy' | 'masterMerchant' | 'deserter'}
                    opponents={opponents}
                    myVictoryPoints={myVictoryPoints}
                    merchantOwnerId={state.merchant?.ownerId}
                    onConfirm={handlePlayTarget}
                    onClose={closeModal}
                  />
                );
              case 'settlement':
                return (
                  <SettlementUpgradePickerModal
                    settlements={mySettlements}
                    onConfirm={handlePlaySettlement}
                    onClose={closeModal}
                  />
                );
              case 'knights':
                return (
                  <KnightPromotePickerModal
                    knights={myKnights}
                    politics={myPolitics}
                    onConfirm={handlePlayKnights}
                    onClose={closeModal}
                  />
                );
              case 'confirm':
              default:
                return (
                  <PlayConfirmModal
                    card={activeCard}
                    onConfirm={handlePlaySimple}
                    onClose={closeModal}
                  />
                );
            }
          })()
        : null}
    </div>
  );
}

function ProgressCardRow({
  card,
  borderClass,
  onDiscard,
  onPlay,
}: {
  card: ProgressCardType;
  borderClass: string;
  onDiscard?: () => void;
  onPlay?: () => void;
}): JSX.Element {
  const automated = isAutomated(card);
  return (
    <li
      className={
        'flex items-center gap-2.5 rounded-lg border bg-surface-2 px-2.5 py-2 ' +
        borderClass
      }
    >
      <ProgressCardGlyph card={card} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold tracking-tight text-neutral-50">
            {PROGRESS_CARD_NAMES[card]}
          </span>
          {/* Badge "Automática" / "En mesa": fija la expectativa de cómo se
              resuelve la carta antes de jugarla (registro asistido, §13.2). */}
          <AutomationBadge automated={automated} />
        </div>
        <div className="mt-0.5 text-[10px] leading-snug text-neutral-400">
          {PROGRESS_CARD_DESCRIPTIONS[card]}
        </div>
      </div>
      {/* Durante el excedente el botón de descarte tiene prioridad: jugar queda
          deshabilitado hasta regularizar la mano. */}
      {onDiscard ? (
        <button
          type="button"
          onClick={onDiscard}
          aria-label={`Descartar ${PROGRESS_CARD_NAMES[card]}`}
          className="min-h-[44px] flex-shrink-0 rounded-lg border border-ck-crimson/50 bg-ck-crimson/15 px-3 py-2 text-xs font-semibold text-red-200 transition-all active:scale-[0.97] active:bg-ck-crimson/25"
        >
          Descartar
        </button>
      ) : onPlay ? (
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Jugar ${PROGRESS_CARD_NAMES[card]}`}
          className="min-h-[44px] flex-shrink-0 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-neutral-950 shadow-cta-amber transition-all active:scale-[0.97] active:bg-amber-300"
        >
          Jugar
        </button>
      ) : null}
    </li>
  );
}

function AutomationBadge({ automated }: { automated: boolean }): JSX.Element {
  if (automated) {
    return (
      <span className="flex-shrink-0 rounded-full border border-discipline-science/45 bg-discipline-science/[0.14] px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.04em] text-discipline-science">
        Automática
      </span>
    );
  }
  return (
    <span className="flex-shrink-0 rounded-full border border-ck-steel/45 bg-ck-steel/[0.14] px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.04em] text-ck-steel-light">
      En mesa
    </span>
  );
}

// Diálogo de confirmación para cartas SIN picker. Para las "en mesa" (no
// automatizadas) el cuerpo deja claro que la app solo registra la jugada y que
// la resolución ocurre físicamente en la mesa.
function PlayConfirmModal({
  card,
  onConfirm,
  onClose,
}: {
  card: ProgressCardType;
  onConfirm: () => void;
  onClose: () => void;
}): JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);
  const [submitting, setSubmitting] = useState(false);
  const automated = isAutomated(card);

  function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    onConfirm();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="play-progress-title"
        aria-describedby="play-progress-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <div className="flex items-start gap-3">
          <ProgressCardGlyph card={card} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2
                id="play-progress-title"
                className="text-[16px] font-semibold tracking-tight text-neutral-50"
              >
                {PROGRESS_CARD_NAMES[card]}
              </h2>
              <AutomationBadge automated={automated} />
            </div>
            <p
              id="play-progress-desc"
              className="mt-1 text-xs leading-relaxed text-neutral-400"
            >
              {PROGRESS_CARD_DESCRIPTIONS[card]}
            </p>
          </div>
        </div>

        {/* Aviso clave para cartas de "registro en mesa": la app no resuelve la
            carta, solo la registra. */}
        {!automated ? (
          <p className="mt-3 rounded-lg border border-ck-steel/40 bg-ck-steel/[0.10] px-3 py-2 text-[11px] leading-snug text-neutral-200">
            Esta carta se resuelve en la mesa: la app solo la registra (la retira
            de tu mano y avisa a todos).
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-discipline-science/40 bg-discipline-science/[0.10] px-3 py-2 text-[11px] leading-snug text-neutral-200">
            La app aplica el efecto automáticamente al confirmar.
          </p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className={
            'mt-4 min-h-[56px] w-full rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.97] ' +
            (submitting
              ? 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500'
              : 'bg-amber-400 text-neutral-950 shadow-cta-amber active:bg-amber-300')
          }
        >
          {submitting ? 'Registrando…' : `Jugar ${PROGRESS_CARD_NAMES[card]}`}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="mt-3 min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium text-neutral-200 transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
