import { useEffect, useRef, useState } from 'react';

// Histograma de tiradas 2–12. Variante extraída del antiguo `BankPanel` y
// generalizada según el brief Fase 2 §5.
//
// Variantes:
//  - `compact`:  altura barra 28px (uso interno en `BankPanel`).
//  - `default`:  altura barra 40px (uso standalone colapsable en `GameScreen`).
//  - `expanded`: altura barra 56px + etiqueta de probabilidad teórica
//                (uso en pantalla de ganador y modal de estadísticas).
//
// Reglas visuales:
//  - El 7 se pinta rojo apagado (no confundir con números normales).
//  - Los hot numbers 6 y 8 reciben más saturación + un dot superior en
//    `default`/`expanded` para que el ojo los encuentre primero.
//  - La barra del último número salido recibe un anillo y un pulso corto.
//  - Conteo encima (oculto si 0) con `.nums` para tabular-nums consistente.
//  - Probabilidad teórica en gris muy tenue debajo del número (solo expanded).

interface Props {
  stats: Record<number, number>;
  variant?: 'compact' | 'default' | 'expanded';
  lastRolledNumber?: number | null;
  // Si true (sólo `expanded`), las barras se animan en entrada con stagger.
  animateOnMount?: boolean;
}

const NUMBERS: number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Probabilidad teórica de cada número con 2 dados de 6 caras (en %).
const PROBABILITY: Record<number, number> = {
  2: 3,
  3: 6,
  4: 8,
  5: 11,
  6: 14,
  7: 17,
  8: 14,
  9: 11,
  10: 8,
  11: 6,
  12: 3,
};

// Los hot numbers (6 y 8) son los más probables con dos dados (sin contar 7).
// Reciben tono más saturado y un dot superior en variantes != compact.
const HOT_NUMBERS = new Set<number>([6, 8]);

export function DiceStats({
  stats,
  variant = 'default',
  lastRolledNumber = null,
  animateOnMount = false,
}: Props): JSX.Element {
  // Altura de la barra según variante.
  const maxHeight = variant === 'expanded' ? 56 : variant === 'compact' ? 28 : 40;
  const counts = NUMBERS.map((n) => stats[n] ?? 0);
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);

  // Pulso de la barra del último número. Cambia el `key` cuando cambia
  // `lastRolledNumber` para reiniciar la animación.
  const prevLastRef = useRef<number | null>(lastRolledNumber);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (lastRolledNumber !== null && lastRolledNumber !== prevLastRef.current) {
      prevLastRef.current = lastRolledNumber;
      setPulseKey((k) => k + 1);
    } else if (lastRolledNumber === null) {
      prevLastRef.current = null;
    }
  }, [lastRolledNumber]);

  return (
    <div
      role="figure"
      aria-label={`Histograma de tiradas: ${total} tiradas hasta ahora.`}
      className="w-full"
    >
      <div className="grid grid-cols-11 gap-1">
        {NUMBERS.map((n, idx) => {
          const count = stats[n] ?? 0;
          const h = count > 0 ? Math.max(2, Math.round((count / max) * maxHeight)) : 0;
          const isSeven = n === 7;
          const isHot = HOT_NUMBERS.has(n);
          const isLast = lastRolledNumber === n;
          // Saturación: 7 rojo apagado; hot numbers ámbar fuerte; el resto
          // ámbar suave para crear jerarquía sin gritar.
          const barColor = isSeven
            ? 'bg-red-400/85'
            : isHot
              ? 'bg-amber-300'
              : 'bg-amber-400/60';
          const lastRing = isLast
            ? ' ring-2 ring-amber-200 ring-offset-1 ring-offset-neutral-950'
            : '';
          // Stagger: cuando se pide `animateOnMount` (default o expanded),
          // las barras entran en cascada con 30 ms entre cada una. La altura
          // final viene del style; sólo animamos `transform` (`anim-slide-up`)
          // con `transform-origin: bottom` para que parezca que "crecen".
          const staggerStyle =
            animateOnMount && variant !== 'compact'
              ? { animationDelay: `${idx * 30}ms` }
              : undefined;
          const showHotDot = isHot && variant !== 'compact';
          return (
            <div
              key={n}
              className="flex flex-col items-center gap-0.5"
              style={{ minWidth: 0 }}
            >
              {/* Conteo encima de la barra (oculto si 0). */}
              <span
                className={
                  'nums text-[10px] font-semibold leading-none ' +
                  (count > 0 ? 'text-neutral-100' : 'text-transparent')
                }
                aria-hidden={count === 0}
                title={`Veces que salió el ${n}: ${count}`}
              >
                {count > 0 ? count : '0'}
              </span>
              {/* Contenedor de la barra: alinea desde abajo. */}
              <div
                className="relative flex w-full items-end justify-center"
                style={{ height: maxHeight + 2 }}
              >
                {/* Dot de hot number (6/8). Marcador discreto encima del tope.
                    `anim-breathe` muy sutil para señalizar que son los
                    números "buenos" sin convertirse en ruido. Solo `transform`
                    + `opacity`; reduced-motion lo desactiva. */}
                {showHotDot ? (
                  <span
                    aria-hidden
                    className="anim-breathe absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-200"
                  />
                ) : null}
                <div
                  key={isLast ? 'last-' + pulseKey : 'bar-' + n}
                  className={
                    'w-full origin-bottom rounded-sm ' +
                    barColor +
                    lastRing +
                    (isLast && pulseKey > 0 ? ' anim-pulse-scale' : '') +
                    (animateOnMount && variant !== 'compact'
                      ? ' anim-bar-grow'
                      : '')
                  }
                  style={{
                    height: `${h}px`,
                    ...(staggerStyle ?? {}),
                  }}
                  title={`${n}: ${count}`}
                />
              </div>
              {/* Número del dado debajo. */}
              <span
                className={
                  'nums text-[10px] font-medium ' +
                  (isHot && variant !== 'compact'
                    ? 'text-amber-200'
                    : 'text-neutral-400')
                }
              >
                {n}
              </span>
              {/* Probabilidad teórica sólo en `expanded`. Tono muy tenue. */}
              {variant === 'expanded' ? (
                <span
                  className="nums text-[9px] font-medium leading-none text-neutral-600"
                  title={`Probabilidad teórica del ${n}: ${PROBABILITY[n]}%`}
                  aria-label={`Probabilidad teórica del ${n}: ${PROBABILITY[n]}%`}
                >
                  {PROBABILITY[n]}%
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
