import { useStore } from '../store';
import { knightDefenseStrength } from '../types';

// ─── Pista del barco bárbaro (Caballeros y Ciudades, §2.2 / §2.7) ─────────────
//
// Indicador PÚBLICO (visible para todos en C&K) del avance del barco bárbaro
// hacia Catán: 7 pasos (0–7). Cada puerta de evento «barco» avanza un paso; al
// llegar a Catán (paso 7) se resuelve el ataque y la pista vuelve a empezar.
//
// En esta fase es INFORMATIVO: la resolución del ataque (Defensor de Catán,
// activación del ladrón, etc.) llega en la Fase D. Aquí solo reflejamos
// `state.barbarianStep` (0–7) y el número de ataques ya ocurridos
// (`state.barbarianAttacks`).
//
// Estética de tensión SOBRIA (carmesí/acero, sin estridencia): el paso actual
// se resalta; los pasos ya recorridos se tiñen de carmesí tenue; los pendientes
// quedan en acero apagado. Sin animaciones agresivas.

const TOTAL_STEPS = 7;

export function BarbarianTrack(): JSX.Element | null {
  const view = useStore((s) => s.view);
  if (!view) return null;
  const { state } = view;
  if (!state.citiesKnights) return null;

  // Acotamos defensivamente al rango 0–7 por si el server envía un transitorio.
  const step = Math.max(0, Math.min(TOTAL_STEPS, state.barbarianStep));
  const attacks = state.barbarianAttacks;
  const atGates = step >= TOTAL_STEPS;

  // Fuerzas que se enfrentarían en el PRÓXIMO ataque (informativo/anticipatorio).
  //  - Defensa de la isla = Σ fuerza de defensa (caballeros ACTIVOS) de todos.
  //  - Ataque bárbaro     = Σ ciudades+metrópolis (`victoryPoints.cities`) de todos.
  // El servidor resuelve el combate de verdad al llegar al paso 7; aquí solo
  // anticipamos el desenlace para que el equipo decida si conviene activar más
  // caballeros antes de que el barco toque puerto.
  const defense = state.players.reduce(
    (sum, p) => sum + knightDefenseStrength(p.knights),
    0
  );
  const attack = state.players.reduce(
    (sum, p) => sum + p.victoryPoints.cities,
    0
  );
  const defended = defense >= attack;

  return (
    <section
      className="mx-3 mt-3 rounded-xl border border-ck-steel/25 bg-surface-1 bg-gradient-to-b from-ck-crimson/[0.06] to-transparent p-3 shadow-soft"
      aria-label="Avance del barco bárbaro"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-ck-steel-light">
          <BarbarianShipMark size={16} />
          Barco bárbaro
        </h2>
        <span className="text-[11px] text-neutral-400">
          {atGates ? (
            <span className="font-semibold text-red-300">¡A las puertas!</span>
          ) : (
            <>
              Paso{' '}
              <span className="nums font-bold text-neutral-100">{step}</span>
              <span className="text-neutral-500"> / {TOTAL_STEPS}</span>
            </>
          )}
        </span>
      </div>

      {/* Pista de 7 pasos. El paso `i` está "recorrido" cuando i <= step. El
          paso actual (== step, con step >= 1) lleva un realce. */}
      <ol
        className="flex items-center gap-1"
        role="img"
        aria-label={`El barco bárbaro está en el paso ${step} de ${TOTAL_STEPS}`}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const idx = i + 1;
          const reached = idx <= step;
          const isCurrent = idx === step && step >= 1;
          return (
            <li
              key={idx}
              title={`Paso ${idx} de ${TOTAL_STEPS}`}
              className={
                'relative h-2.5 flex-1 rounded-full transition-colors ' +
                (reached
                  ? isCurrent
                    ? 'bg-ck-crimson shadow-[0_0_0_1px_rgba(191,74,64,0.35)]'
                    : 'bg-ck-crimson/55'
                  : 'bg-ck-steel/20') +
                (isCurrent ? ' ring-2 ring-ck-crimson/40' : '')
              }
            />
          );
        })}
      </ol>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-neutral-500">
          Catán
        </span>
        <span className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.06em] text-neutral-500">
          Avanza
          <BarbarianShipMark size={11} muted />
        </span>
      </div>

      {/* Fuerzas enfrentadas (informativo): defensa de la isla vs ataque
          bárbaro. Verde si la defensa actual bastaría; carmesí si la isla
          quedaría en riesgo cuando el barco llegue a puerto. */}
      <div
        className={
          'mt-3 rounded-lg border p-2.5 ' +
          (defended
            ? 'border-emerald-500/35 bg-emerald-500/[0.08]'
            : 'border-ck-crimson/40 bg-ck-crimson/[0.08]')
        }
        role="group"
        aria-label={
          defended
            ? `Isla defendida: defensa ${defense}, ataque ${attack}.`
            : `Isla en riesgo: defensa ${defense}, ataque ${attack}.`
        }
      >
        <div className="flex items-center justify-between gap-2">
          <StrengthStat
            label="Defensa"
            value={defense}
            tone="steel"
            hint="Caballeros activos de toda la isla"
          />
          <span aria-hidden className="text-neutral-600">
            vs
          </span>
          <StrengthStat
            label="Ataque"
            value={attack}
            tone="crimson"
            hint="Ciudades y metrópolis de toda la isla"
            alignEnd
          />
        </div>
        <p
          className={
            'mt-2 flex items-center gap-1.5 text-[11px] font-semibold ' +
            (defended ? 'text-emerald-300' : 'text-red-300')
          }
        >
          <span
            aria-hidden
            className={
              'h-1.5 w-1.5 flex-shrink-0 rounded-full ' +
              (defended ? 'bg-emerald-400' : 'bg-ck-crimson')
            }
          />
          {defended ? 'Defendida' : 'En riesgo'}
          <span className="font-normal text-neutral-400">
            {defended
              ? ' — la defensa actual bastaría.'
              : ' — falta defensa para el próximo ataque.'}
          </span>
        </p>
      </div>

      {attacks > 0 ? (
        <p className="mt-2 text-[11px] leading-snug text-neutral-400">
          <span className="nums font-semibold text-red-300">{attacks}</span>{' '}
          {attacks === 1 ? 'ataque ocurrido' : 'ataques ocurridos'} en esta
          partida.
        </p>
      ) : null}
    </section>
  );
}

// Una cifra de fuerza (defensa o ataque) con su etiqueta y una pista breve.
// `tone` fija el color del número; el resto queda neutro para no competir con
// el veredicto (Defendida / En riesgo) de abajo.
function StrengthStat({
  label,
  value,
  tone,
  hint,
  alignEnd = false,
}: {
  label: string;
  value: number;
  tone: 'steel' | 'crimson';
  hint: string;
  alignEnd?: boolean;
}): JSX.Element {
  const numColor = tone === 'steel' ? 'text-ck-steel-light' : 'text-red-300';
  return (
    <div className={'min-w-0 flex-1 ' + (alignEnd ? 'text-right' : '')}>
      <div
        className={
          'flex items-baseline gap-1.5 ' +
          (alignEnd ? 'justify-end' : '')
        }
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
          {label}
        </span>
        <span className={'nums text-lg font-bold leading-none ' + numColor}>
          {value}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[9px] leading-tight text-neutral-500">
        {hint}
      </p>
    </div>
  );
}

// Marca del barco bárbaro: vela oscura sobre casco, en acero/carmesí (coherente
// con el lenguaje sobrio C&K). Decorativa: el texto vecino la nombra.
function BarbarianShipMark({
  size = 16,
  muted = false,
}: {
  size?: number;
  muted?: boolean;
}): JSX.Element {
  const hull = muted ? '#6b7078' : '#8b919b';
  const sail = muted ? '#7a322d' : '#bf4a40';
  const stroke = '#1a130c';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="flex-shrink-0"
    >
      {/* Mástil */}
      <rect x="11.4" y="3" width="1.2" height="13" fill={stroke} />
      {/* Vela */}
      <path
        d="M12.6 4 C 17 5.2, 17.5 10, 16.8 13 L 12.6 13 Z"
        fill={sail}
        stroke={stroke}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Casco */}
      <path
        d="M4 16 H20 L18 20.5 C 17.6 21.3, 16.9 21.6, 16 21.6 H8 C 7.1 21.6, 6.4 21.3, 6 20.5 Z"
        fill={hull}
        stroke={stroke}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}
