import { Resource } from '../types';

interface Props {
  resource: Resource;
  size?: number;
  className?: string;
}

// Iconos SVG por recurso. Sin emojis.
// Trazo común: stroke #0f1115, strokeWidth 1.5, líneas internas con opacidad
// reducida para profundidad. Cada icono respeta el viewBox 0 0 24 24 y un
// margen interno de ~2px para verse balanceado a tamaños 14–28.
export function ResourceIcon({ resource, size = 20, className }: Props): JSX.Element {
  const stroke = '#0f1115';
  const sw = 1.5;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className,
    'aria-hidden': true as const,
  };
  switch (resource) {
    case 'brick':
      return (
        <svg {...common}>
          {/* Cuerpo del ladrillo */}
          <rect
            x="2.5"
            y="6"
            width="19"
            height="12"
            rx="1.5"
            fill="#c4663f"
            stroke={stroke}
            strokeWidth={sw}
          />
          {/* Patrón aparejado */}
          <line x1="2.5" y1="12" x2="21.5" y2="12" stroke={stroke} strokeWidth={sw} />
          <line x1="9" y1="6" x2="9" y2="12" stroke={stroke} strokeWidth={sw} />
          <line x1="15" y1="12" x2="15" y2="18" stroke={stroke} strokeWidth={sw} />
          {/* Highlight superior para profundidad */}
          <line
            x1="3.5"
            y1="7.5"
            x2="20.5"
            y2="7.5"
            stroke="#fff"
            strokeOpacity="0.18"
            strokeWidth="1"
          />
        </svg>
      );
    case 'lumber':
      return (
        <svg {...common}>
          {/* Pino estilizado */}
          <path
            d="M12 2.5 L20 20 L4 20 Z"
            fill="#3a8049"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* Vetas internas */}
          <path
            d="M12 9 L17 19"
            stroke={stroke}
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <path
            d="M12 13 L15 19"
            stroke={stroke}
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* Highlight izquierdo */}
          <path
            d="M12 4 L6.5 18"
            stroke="#fff"
            strokeOpacity="0.18"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'wool':
      return (
        <svg {...common}>
          {/* Nube de lana, tres círculos */}
          <circle cx="9" cy="14" r="4.2" fill="#dfe6d5" stroke={stroke} strokeWidth={sw} />
          <circle cx="15" cy="14" r="4.2" fill="#dfe6d5" stroke={stroke} strokeWidth={sw} />
          <circle cx="12" cy="9.5" r="4.2" fill="#dfe6d5" stroke={stroke} strokeWidth={sw} />
          {/* Highlights internos para textura */}
          <circle cx="11" cy="8.5" r="1" fill="#fff" fillOpacity="0.5" />
          <circle cx="8" cy="13" r="0.9" fill="#fff" fillOpacity="0.4" />
        </svg>
      );
    case 'grain':
      return (
        <svg {...common}>
          {/* Tallo central */}
          <path
            d="M12 3 V21"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {/* Espigas (4 pares) */}
          <path
            d="M12 6.5 C 9 6.5, 8 7.5, 8 9.5 C 10 9.5, 12 8.5, 12 6.5 Z"
            fill="#ecc857"
            stroke={stroke}
            strokeWidth={sw}
          />
          <path
            d="M12 6.5 C 15 6.5, 16 7.5, 16 9.5 C 14 9.5, 12 8.5, 12 6.5 Z"
            fill="#ecc857"
            stroke={stroke}
            strokeWidth={sw}
          />
          <path
            d="M12 11.5 C 9 11.5, 8 12.5, 8 14.5 C 10 14.5, 12 13.5, 12 11.5 Z"
            fill="#ecc857"
            stroke={stroke}
            strokeWidth={sw}
          />
          <path
            d="M12 11.5 C 15 11.5, 16 12.5, 16 14.5 C 14 14.5, 12 13.5, 12 11.5 Z"
            fill="#ecc857"
            stroke={stroke}
            strokeWidth={sw}
          />
        </svg>
      );
    case 'ore':
      return (
        <svg {...common}>
          {/* Cristal facetado */}
          <path
            d="M5 14 L9 5.5 L15 5.5 L19 14 L14 20 L10 20 Z"
            fill="#6c7682"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* Facetas internas */}
          <path
            d="M9 5.5 L12 14 L19 14"
            fill="none"
            stroke={stroke}
            strokeOpacity="0.55"
            strokeWidth="1"
          />
          <path
            d="M15 5.5 L12 14 L10 20"
            fill="none"
            stroke={stroke}
            strokeOpacity="0.55"
            strokeWidth="1"
          />
          {/* Highlight de la faceta superior izquierda */}
          <path
            d="M9 5.5 L12 14"
            stroke="#fff"
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
