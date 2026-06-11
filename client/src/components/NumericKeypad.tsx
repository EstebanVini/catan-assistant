interface Props {
  onPress: (n: number) => void;
  disabled?: boolean;
}

// Teclado del banco: solo 2-12 (sin 1).
const NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function NumericKeypad({ onPress, disabled }: Props): JSX.Element {
  return (
    <div className="grid grid-cols-4 gap-2">
      {NUMBERS.map((n) => {
        const isSeven = n === 7;
        const isHot = n === 6 || n === 8;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onPress(n)}
            aria-label={`Ingresar dado: ${n}`}
            className={
              'nums h-16 rounded-xl border text-2xl font-bold tracking-tight transition-all ' +
              'disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.97] ' +
              (isSeven
                ? 'border-red-500/45 bg-red-500/15 text-red-200 shadow-soft active:bg-red-500/25'
                : isHot
                  ? 'border-amber-500/45 bg-amber-500/15 text-amber-100 shadow-soft active:bg-amber-500/25'
                  : 'border-white/12 bg-surface-3 text-neutral-50 shadow-soft active:bg-white/[0.12]')
            }
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
