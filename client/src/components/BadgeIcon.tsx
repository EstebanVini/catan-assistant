// Iconos SVG para insignias transferibles (Ejército más grande / Camino más
// largo). Sin emojis: pictogramas neutros que evocan el concepto sin caer en
// estética medieval o caricaturesca.
//
// Variantes:
//  - `army`: dos espadas cruzadas. Rojo apagado (consistente con el "peso" de
//    transferencia descrito en el brief §2.1).
//  - `road`: camino sinuoso con dos líneas paralelas. Ámbar apagado.
//
// Tamaño configurable. El componente sólo renderiza el SVG; la cápsula
// (chip de fondo + borde) se decora desde fuera con `BadgeChip` para mantener
// reuso entre `PublicPlayersPanel` y la pantalla de ganador.

interface Props {
  variant: 'army' | 'road';
  size?: number;
  className?: string;
}

export function BadgeIcon({ variant, size = 16, className }: Props): JSX.Element {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className,
    'aria-hidden': true as const,
  };
  if (variant === 'army') {
    // Dos espadas cruzadas. Hoja con highlight central + cazoleta marcada.
    const blade = '#e2a3a3';
    const hilt = '#3a1a1a';
    return (
      <svg {...common}>
        {/* Espada 1 (diagonal NW→SE) */}
        <g transform="rotate(-45 12 12)">
          <rect x="11" y="2.5" width="2" height="13" fill={blade} stroke={hilt} strokeWidth="1" />
          <rect x="11.5" y="3" width="1" height="11" fill="#fff" fillOpacity="0.35" />
          <rect x="8.5" y="15" width="7" height="1.6" fill={hilt} />
          <rect x="11.4" y="16.5" width="1.2" height="3.5" fill={hilt} />
          <circle cx="12" cy="20.6" r="1.2" fill={hilt} />
        </g>
        {/* Espada 2 (diagonal NE→SW) */}
        <g transform="rotate(45 12 12)">
          <rect x="11" y="2.5" width="2" height="13" fill={blade} stroke={hilt} strokeWidth="1" />
          <rect x="11.5" y="3" width="1" height="11" fill="#fff" fillOpacity="0.35" />
          <rect x="8.5" y="15" width="7" height="1.6" fill={hilt} />
          <rect x="11.4" y="16.5" width="1.2" height="3.5" fill={hilt} />
          <circle cx="12" cy="20.6" r="1.2" fill={hilt} />
        </g>
      </svg>
    );
  }
  // Camino: dos líneas paralelas con curva suave.
  const path = '#f3c577';
  const edge = '#3a2a10';
  return (
    <svg {...common}>
      {/* Camino base (ribete oscuro) */}
      <path
        d="M3 19 C 7 19, 8 11, 12 11 S 17 19, 21 19"
        fill="none"
        stroke={edge}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Camino interior */}
      <path
        d="M3 19 C 7 19, 8 11, 12 11 S 17 19, 21 19"
        fill="none"
        stroke={path}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Líneas discontinuas centrales para sugerir "camino" sin ambigüedad */}
      <path
        d="M5 19 L 7 19 M 10 13.5 L 11 13 M 13 13 L 14 13.5 M 17 19 L 19 19"
        stroke={edge}
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

// Cápsula reutilizable: chip de fondo + borde tonal por variante. Acepta un
// label visible (opcional) y siempre incluye `aria-label` descriptivo para
// lectores de pantalla.
export function BadgeChip({
  variant,
  label,
  size = 14,
  className,
}: {
  variant: 'army' | 'road';
  label: string;
  size?: number;
  className?: string;
}): JSX.Element {
  const tone =
    variant === 'army'
      ? 'border-red-400/40 bg-red-500/12 text-red-100'
      : 'border-amber-400/40 bg-amber-500/12 text-amber-100';
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ' +
        tone +
        (className ? ' ' + className : '')
      }
    >
      <BadgeIcon variant={variant} size={size} />
      <span>{label}</span>
    </span>
  );
}
