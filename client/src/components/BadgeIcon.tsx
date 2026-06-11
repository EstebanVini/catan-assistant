// Iconos SVG para insignias transferibles (Ejército más grande / Camino más
// largo). Sin emojis: pictogramas neutros que evocan el concepto sin caer en
// estética medieval o caricaturesca.
//
// Trazo consistente con `ResourceIcon`: stroke #0f1115, strokeWidth 1.5.
// Color de tonos suaves para que la insignia comunique posesión sin competir
// con el CTA verde primario.
//
// Variantes:
//  - `army`: dos espadas cruzadas. Tono ámbar suave (es una distinción).
//  - `road`: camino sinuoso con dos líneas paralelas. Tono esmeralda apagado.
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
  const stroke = '#0f1115';
  const sw = 1.5;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className,
    'aria-hidden': true as const,
  };
  if (variant === 'army') {
    // Espadas cruzadas estilizadas. Hojas en ámbar cálido, empuñaduras en
    // tono carbón. Construidas con primitivas simples para mantener legibilidad
    // en 14–22 px.
    const blade = '#f3c577';
    const hilt = '#5a3a14';
    return (
      <svg {...common}>
        {/* Espada 1 (NW→SE) */}
        <g transform="rotate(-45 12 12)">
          <rect
            x="11"
            y="3"
            width="2"
            height="12"
            fill={blade}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* Brillo central de la hoja */}
          <rect x="11.4" y="3.5" width="0.8" height="10.5" fill="#fff" fillOpacity="0.35" />
          {/* Cazoleta */}
          <rect x="9" y="15" width="6" height="1.6" fill={hilt} stroke={stroke} strokeWidth={sw} />
          {/* Empuñadura */}
          <rect x="11.4" y="16.6" width="1.2" height="3.4" fill={hilt} />
          {/* Pomo */}
          <circle cx="12" cy="20.6" r="1.1" fill={hilt} stroke={stroke} strokeWidth={sw} />
        </g>
        {/* Espada 2 (NE→SW) */}
        <g transform="rotate(45 12 12)">
          <rect
            x="11"
            y="3"
            width="2"
            height="12"
            fill={blade}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <rect x="11.4" y="3.5" width="0.8" height="10.5" fill="#fff" fillOpacity="0.35" />
          <rect x="9" y="15" width="6" height="1.6" fill={hilt} stroke={stroke} strokeWidth={sw} />
          <rect x="11.4" y="16.6" width="1.2" height="3.4" fill={hilt} />
          <circle cx="12" cy="20.6" r="1.1" fill={hilt} stroke={stroke} strokeWidth={sw} />
        </g>
      </svg>
    );
  }
  // Camino: cinta sinuosa con dos bordes paralelos y marcas centrales.
  const path = '#a7d7b6';
  const edge = '#1f4a30';
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
      {/* Líneas discontinuas centrales */}
      <path
        d="M5 19 L 7 19 M 10 13.5 L 11 13 M 13 13 L 14 13.5 M 17 19 L 19 19"
        stroke={edge}
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Highlight sutil en la cima */}
      <path
        d="M10.5 11.5 L 13.5 11.5"
        stroke="#fff"
        strokeOpacity="0.45"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Cápsula reutilizable: chip de fondo + borde tonal por variante. Acepta un
// label visible (opcional) y siempre incluye `aria-label` descriptivo para
// lectores de pantalla.
//
// Paleta de tonos: ámbar suave para army (distinción) y esmeralda apagado
// para road. Ninguno compite con el CTA verde primario (que usa emerald-500
// saturado); ambos quedan a baja saturación.
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
      ? 'border-amber-400/35 bg-amber-500/[0.10] text-amber-100'
      : 'border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-100';
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
