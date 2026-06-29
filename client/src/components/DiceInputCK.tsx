import { useState } from 'react';
import { useStore } from '../store';
import { Discipline, EventDie } from '../types';
import { EVENT_DIE_NAMES } from '../lib/spanish';
import { BarbarianShipGlyph, DisciplineGlyph } from '../assets/icons';

// ─── Input de 3 dados del encargado del banco (Caballeros y Ciudades, §2.2) ────
//
// En modo C&K la tirada son TRES dados, no un número:
//  - Dado rojo (1–6) y dado amarillo (1–6): la PRODUCCIÓN es su suma (2–12),
//    igual que el número del base.
//  - Dado de evento (6 caras → 4 opciones lógicas): barco bárbaro o una de las
//    tres puertas de color (Comercio/Política/Ciencia).
// El bank manager registra los tres y el server distribuye producción +
// mercancías, avanza el bárbaro o reparte cartas de progreso por el calendario
// (cada jugador roba si el dado ROJO ≤ su nivel en la disciplina de la puerta).
//
// El dado rojo es doblemente relevante: además de sumar a la producción, decide
// quién roba cartas de progreso. Por eso el helper lo explicita.
//
// Patrón de color por disciplina: clases LITERALES (el JIT de Tailwind no
// detecta `bg-discipline-${d}`), igual que CityCalendarPanel / CityCalendarPanel.

interface DieSelectorClasses {
  selected: string;
  ring: string;
}

const RED_DIE_CLASSES: DieSelectorClasses = {
  selected:
    'border-ck-crimson/70 bg-ck-crimson/25 text-neutral-50 shadow-soft',
  ring: 'ring-ck-crimson/50',
};

const YELLOW_DIE_CLASSES: DieSelectorClasses = {
  selected:
    'border-discipline-trade/70 bg-discipline-trade/25 text-neutral-50 shadow-soft',
  ring: 'ring-discipline-trade/50',
};

function DieRow({
  label,
  helper,
  value,
  onPick,
  classes,
  disabled,
  idPrefix,
}: {
  label: string;
  helper?: string;
  value: number | null;
  onPick: (n: number) => void;
  classes: DieSelectorClasses;
  disabled: boolean;
  idPrefix: string;
}): JSX.Element {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold tracking-tight text-neutral-100">
          {label}
        </span>
        {helper ? (
          <span className="text-[10px] leading-tight text-neutral-400">
            {helper}
          </span>
        ) : null}
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-6 gap-1.5"
      >
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${label}: ${n}`}
              id={`${idPrefix}-${n}`}
              disabled={disabled}
              onClick={() => onPick(n)}
              className={
                'nums flex h-11 items-center justify-center rounded-lg border text-lg font-bold tabular-nums transition-all ' +
                'disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.95] ' +
                (active
                  ? classes.selected + ' ring-2 ' + classes.ring
                  : 'border-white/12 bg-surface-3 text-neutral-200 active:bg-white/[0.12]')
              }
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Caras del dado de evento, en el orden de presentación. El bárbaro primero
// (3 caras del dado físico), luego las tres puertas de color.
const EVENT_FACES: EventDie[] = ['barbarian', 'trade', 'politics', 'science'];

// Clases del borde/fondo de cada opción de evento cuando está seleccionada.
// Literales por disciplina + carmesí para el bárbaro.
const EVENT_SELECTED_CLASSES: Record<EventDie, string> = {
  barbarian:
    'border-ck-crimson/70 bg-ck-crimson/20 ring-2 ring-ck-crimson/50',
  trade:
    'border-discipline-trade/70 bg-discipline-trade/15 ring-2 ring-discipline-trade/50',
  politics:
    'border-discipline-politics/70 bg-discipline-politics/15 ring-2 ring-discipline-politics/50',
  science:
    'border-discipline-science/70 bg-discipline-science/15 ring-2 ring-discipline-science/50',
};

function EventFace({
  face,
  selected,
  disabled,
  onPick,
}: {
  face: EventDie;
  selected: boolean;
  disabled: boolean;
  onPick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={EVENT_DIE_NAMES[face]}
      disabled={disabled}
      onClick={onPick}
      className={
        'flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center transition-all ' +
        'disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.97] ' +
        (selected
          ? EVENT_SELECTED_CLASSES[face]
          : 'border-white/12 bg-surface-3 active:bg-white/[0.10]')
      }
    >
      {face === 'barbarian' ? (
        <BarbarianShipGlyph size={26} />
      ) : (
        <DisciplineGlyph discipline={face as Discipline} size={26} />
      )}
      <span className="text-[10px] font-medium leading-tight text-neutral-200">
        {EVENT_DIE_NAMES[face]}
      </span>
    </button>
  );
}

export function DiceInputCK(): JSX.Element {
  const rollCK = useStore((s) => s.rollCK);
  const phase = useStore((s) => s.view?.state.phase);
  const [red, setRed] = useState<number | null>(null);
  const [yellow, setYellow] = useState<number | null>(null);
  const [event, setEvent] = useState<EventDie | null>(null);

  const canEnter = phase === 'roll';
  const production = red !== null && yellow !== null ? red + yellow : null;
  const complete = red !== null && yellow !== null && event !== null;
  const canSubmit = canEnter && complete;

  function handleSubmit() {
    if (red === null || yellow === null || event === null) return;
    rollCK(red + yellow, red, event);
    // Limpiamos la selección tras registrar: la próxima tirada parte de cero.
    setRed(null);
    setYellow(null);
    setEvent(null);
  }

  return (
    <div className="space-y-3">
      <DieRow
        label="Dado rojo"
        helper="1–6 · reparte cartas"
        value={red}
        onPick={(n) => setRed(n)}
        classes={RED_DIE_CLASSES}
        disabled={!canEnter}
        idPrefix="ck-red"
      />
      <DieRow
        label="Dado amarillo"
        helper="1–6"
        value={yellow}
        onPick={(n) => setYellow(n)}
        classes={YELLOW_DIE_CLASSES}
        disabled={!canEnter}
        idPrefix="ck-yellow"
      />

      {/* Producción calculada (rojo + amarillo). Espejo del "número" del base. */}
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-surface-2 px-3 py-2">
        <span className="text-[12px] font-medium text-neutral-300">
          Producción
        </span>
        <span
          className="nums text-2xl font-bold tabular-nums text-neutral-50"
          aria-live="polite"
        >
          {production ?? '—'}
        </span>
      </div>

      {/* Dado de evento: 4 opciones. */}
      <div>
        <span className="mb-1.5 block text-[12px] font-semibold tracking-tight text-neutral-100">
          Dado de evento
        </span>
        <div
          role="radiogroup"
          aria-label="Dado de evento"
          className="grid grid-cols-2 gap-2"
        >
          {EVENT_FACES.map((face) => (
            <EventFace
              key={face}
              face={face}
              selected={event === face}
              disabled={!canEnter}
              onPick={() => setEvent(face)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={
          'min-h-[48px] w-full rounded-xl px-3 py-2.5 text-sm font-bold tracking-tight transition-all ' +
          (canSubmit
            ? 'bg-ck-crimson text-neutral-50 shadow-soft active:scale-[0.98] active:bg-ck-crimson-deep'
            : 'cursor-not-allowed border border-white/10 bg-surface-1 text-neutral-500')
        }
      >
        Registrar tirada
      </button>

      {!canEnter ? (
        <p className="text-[11px] text-neutral-400">
          Solo puedes ingresar la tirada en la fase Tirar.
        </p>
      ) : !complete ? (
        <p className="text-[11px] text-neutral-400">
          Elige los dos dados de producción y el dado de evento.
        </p>
      ) : null}

      <p className="text-[11px] leading-snug text-neutral-400">
        El <span className="font-semibold text-red-300">dado rojo</span>{' '}
        decide quién roba cartas de progreso: con una puerta de color, cada
        jugador roba si el dado rojo es menor o igual a su nivel en esa
        disciplina (calendario de la ciudad).
      </p>
    </div>
  );
}
