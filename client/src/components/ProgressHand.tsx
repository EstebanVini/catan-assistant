import { useStore } from '../store';
import {
  DISCIPLINES,
  Discipline,
  PROGRESS_CARD_DISCIPLINE,
  PROGRESS_HAND_LIMIT,
  ProgressCardType,
} from '../types';
import {
  DISCIPLINE_NAMES,
  PROGRESS_CARD_NAMES,
  PROGRESS_CARD_DESCRIPTIONS,
} from '../lib/spanish';
import { ProgressCardGlyph } from '../assets/icons';

// ─── Mano de cartas de progreso (Caballeros y Ciudades, §2.10) ────────────────
//
// Vista PRIVADA del dueño: lista mis `me.progressCards` agrupadas por disciplina
// (color), con nombre en español, descripción breve y un contador "X / 4".
//
// IMPORTANTE: las cartas NO son jugables todavía. En esta fase (C2) solo se
// roban y se sostienen — la jugabilidad llega en la Fase C3.
//   // TODO Fase C3: jugar carta
//
// Excedente: si `state.pendingProgressDiscard[me.id] > 0` el jugador robó por
// encima del límite de 4 y debe SOLTAR cartas hasta cumplir ese número. En ese
// caso mostramos un aviso prominente y un botón "Descartar" por carta
// (`discardProgress(card)`).
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

export function ProgressHand(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const discardProgress = useStore((s) => s.discardProgress);

  if (!view || !view.me) return null;
  const { state, me } = view;
  if (!state.citiesKnights) return null;

  const cards = me.progressCards;
  const count = cards.length;
  const mustDiscard = state.pendingProgressDiscard[me.id] ?? 0;
  const overLimit = mustDiscard > 0;

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

  return (
    <div className="p-3">
      {/* Contador X / 4. Cuando hay excedente, lo marcamos en carmesí. */}
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] leading-tight text-neutral-400">
          Las robas con el calendario. No se pueden comerciar.
        </span>
        <span
          className={
            'nums flex-shrink-0 text-sm font-bold tabular-nums ' +
            (overLimit ? 'text-ck-crimson' : 'text-neutral-100')
          }
          aria-label={`${count} de ${PROGRESS_HAND_LIMIT} cartas de progreso`}
        >
          {count}
          <span className="text-[11px] font-medium text-neutral-500">
            {' / '}
            {PROGRESS_HAND_LIMIT}
          </span>
        </span>
      </div>

      {/* Aviso prominente de excedente (>4). */}
      {overLimit ? (
        <div
          role="alert"
          className="mb-2.5 rounded-lg border border-ck-crimson/50 bg-ck-crimson/[0.12] px-3 py-2"
        >
          <p className="text-[12px] font-semibold tracking-tight text-ck-crimson">
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
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProgressCardRow({
  card,
  borderClass,
  onDiscard,
}: {
  card: ProgressCardType;
  borderClass: string;
  onDiscard?: () => void;
}): JSX.Element {
  return (
    <li
      className={
        'flex items-center gap-2.5 rounded-lg border bg-surface-2 px-2.5 py-2 ' +
        borderClass
      }
    >
      <ProgressCardGlyph card={card} size={34} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold tracking-tight text-neutral-50">
          {PROGRESS_CARD_NAMES[card]}
        </div>
        <div className="mt-0.5 text-[10px] leading-snug text-neutral-400">
          {PROGRESS_CARD_DESCRIPTIONS[card]}
        </div>
      </div>
      {/* TODO Fase C3: jugar carta — aquí irá el botón "Jugar" con su flujo de
          parámetros (espejo del modal de cartas de desarrollo). Por ahora las
          cartas solo se sostienen; el único botón posible es descartar el
          excedente (>4). */}
      {onDiscard ? (
        <button
          type="button"
          onClick={onDiscard}
          aria-label={`Descartar ${PROGRESS_CARD_NAMES[card]}`}
          className="min-h-[44px] flex-shrink-0 rounded-lg border border-ck-crimson/50 bg-ck-crimson/15 px-3 py-2 text-xs font-semibold text-ck-crimson transition-all active:scale-[0.97] active:bg-ck-crimson/25"
        >
          Descartar
        </button>
      ) : null}
    </li>
  );
}
