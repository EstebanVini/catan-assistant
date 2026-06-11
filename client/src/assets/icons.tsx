import { DevCardType, Resource } from '../types';

// ─── Íconos temáticos de Catán — MÓDULO ÚNICO de mapeo asset → recurso/carta ─
//
// Este es el ÚNICO lugar donde se decide qué dibujo representa cada recurso,
// carta de desarrollo, insignia y al ladrón. Los componentes (`ResourceIcon`,
// `BadgeIcon`, modales, tablas) importan de aquí y NUNCA conocen el asset.
// Para cambiar el set completo (p. ej. por arte de las cartas reales) basta
// con tocar este archivo.
//
// Estilo del set (uniforme en todos los glifos):
//  - viewBox 0 0 24 24, margen interno ~2 px.
//  - Máximo 2 tonos de relleno por ícono + trazo oscuro común (#1a130c).
//  - strokeWidth 1.5, esquinas redondeadas. Estilo ilustrado plano, digno a
//    14–32 px sobre superficies de madera oscura.
//  - Los tonos de recurso espejan los tokens `resource.*` de tailwind.config.
//
// Fallback emoji: si se prefiere modo alternativo (o un asset futuro basado
// en imágenes no carga), cada glifo acepta `fallback` y los mapas
// RESOURCE_EMOJI / DEV_CARD_EMOJI están exportados para usos de solo texto.

export const RESOURCE_EMOJI: Record<Resource, string> = {
  brick: '🧱',
  lumber: '🌲',
  wool: '🐑',
  grain: '🌾',
  ore: '⛰️',
};

export const DEV_CARD_EMOJI: Record<DevCardType, string> = {
  knight: '⚔️',
  vp: '🏆',
  monopoly: '💰',
  yearOfPlenty: '🎁',
  roadBuilding: '🛤️',
};

export const ROBBER_EMOJI = '🥷';

// Trazo común del set (nogal casi negro, cálido).
const STROKE = '#1a130c';
const SW = 1.5;

interface GlyphProps {
  size?: number;
  className?: string;
  // Modo alternativo: renderiza el emoji equivalente en lugar del SVG.
  fallback?: boolean;
}

function svgProps(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className,
    'aria-hidden': true as const,
  };
}

function EmojiGlyph({
  emoji,
  size,
  className,
}: {
  emoji: string;
  size: number;
  className?: string;
}): JSX.Element {
  return (
    <span
      aria-hidden
      className={className}
      style={{ fontSize: size * 0.85, lineHeight: 1, display: 'inline-block' }}
    >
      {emoji}
    </span>
  );
}

// ─── Recursos ────────────────────────────────────────────────────────────────

export function ResourceGlyph({
  resource,
  size = 20,
  className,
  fallback = false,
}: GlyphProps & { resource: Resource }): JSX.Element {
  if (fallback) {
    return (
      <EmojiGlyph emoji={RESOURCE_EMOJI[resource]} size={size} className={className} />
    );
  }
  const common = svgProps(size, className);
  switch (resource) {
    case 'brick': {
      // Muro de arcilla: dos hiladas de ladrillos en aparejo, terracota.
      const body = '#c4663f';
      const shade = '#9c4c2c';
      return (
        <svg {...common}>
          <rect x="2.5" y="5.5" width="19" height="13" rx="1.2" fill={body} stroke={STROKE} strokeWidth={SW} />
          {/* Hilada inferior en tono sombra para volumen (2º tono) */}
          <path d="M2.5 12 H21.5 V17.3 a1.2 1.2 0 0 1 -1.2 1.2 H3.7 a1.2 1.2 0 0 1 -1.2 -1.2 Z" fill={shade} />
          {/* Juntas */}
          <line x1="2.5" y1="12" x2="21.5" y2="12" stroke={STROKE} strokeWidth={SW} />
          <line x1="9" y1="5.5" x2="9" y2="12" stroke={STROKE} strokeWidth={SW} />
          <line x1="15.5" y1="5.5" x2="15.5" y2="12" stroke={STROKE} strokeWidth={SW} />
          <line x1="12.2" y1="12" x2="12.2" y2="18.5" stroke={STROKE} strokeWidth={SW} />
        </svg>
      );
    }
    case 'lumber': {
      // Pino de dos copas sobre tronco: bosque + madera.
      const leaf = '#3a8049';
      const trunk = '#7a5036';
      return (
        <svg {...common}>
          <rect x="10.6" y="16" width="2.8" height="5" rx="0.8" fill={trunk} stroke={STROKE} strokeWidth={SW} />
          {/* Copa inferior */}
          <path d="M12 7.5 L19 16.5 L5 16.5 Z" fill={leaf} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
          {/* Copa superior */}
          <path d="M12 2.5 L17.2 9.8 L6.8 9.8 Z" fill={leaf} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
        </svg>
      );
    }
    case 'wool': {
      // Oveja de perfil: cuerpo de lana, cabeza y patas oscuras.
      const fleece = '#e7ecdc';
      const dark = '#4a4038';
      return (
        <svg {...common}>
          {/* Patas */}
          <line x1="8.5" y1="16.5" x2="8.5" y2="20.5" stroke={dark} strokeWidth="2" strokeLinecap="round" />
          <line x1="14.5" y1="16.5" x2="14.5" y2="20.5" stroke={dark} strokeWidth="2" strokeLinecap="round" />
          {/* Cuerpo lanudo: óvalo + bultos */}
          <circle cx="7.5" cy="11.5" r="2.6" fill={fleece} stroke={STROKE} strokeWidth={SW} />
          <circle cx="15.5" cy="11.5" r="2.6" fill={fleece} stroke={STROKE} strokeWidth={SW} />
          <circle cx="11.5" cy="9.6" r="2.8" fill={fleece} stroke={STROKE} strokeWidth={SW} />
          <ellipse cx="11.5" cy="12.8" rx="5.6" ry="4" fill={fleece} stroke={STROKE} strokeWidth={SW} />
          {/* Cabeza */}
          <ellipse cx="18.4" cy="10.6" rx="2.5" ry="2.1" fill={dark} stroke={STROKE} strokeWidth={SW} />
          {/* Oreja */}
          <ellipse cx="17.2" cy="9" rx="1.2" ry="0.7" fill={dark} stroke={STROKE} strokeWidth="1" transform="rotate(-25 17.2 9)" />
          {/* Ojo */}
          <circle cx="18.9" cy="10.2" r="0.5" fill="#fff" />
        </svg>
      );
    }
    case 'grain': {
      // Espiga de trigo: granos a ambos lados del tallo + barbas.
      const grain = '#e6c453';
      return (
        <svg {...common}>
          {/* Tallo */}
          <path d="M12 5 V21" stroke="#8a6a20" strokeWidth="1.8" strokeLinecap="round" />
          {/* Barbas superiores */}
          <path d="M12 5.5 L9.5 2.5 M12 5.5 L12 2 M12 5.5 L14.5 2.5" stroke="#8a6a20" strokeWidth="1.1" strokeLinecap="round" />
          {/* Granos: 3 pares, elipses inclinadas */}
          <ellipse cx="9.3" cy="8.5" rx="2.6" ry="1.5" fill={grain} stroke={STROKE} strokeWidth={SW} transform="rotate(-38 9.3 8.5)" />
          <ellipse cx="14.7" cy="8.5" rx="2.6" ry="1.5" fill={grain} stroke={STROKE} strokeWidth={SW} transform="rotate(38 14.7 8.5)" />
          <ellipse cx="9.3" cy="12.5" rx="2.6" ry="1.5" fill={grain} stroke={STROKE} strokeWidth={SW} transform="rotate(-38 9.3 12.5)" />
          <ellipse cx="14.7" cy="12.5" rx="2.6" ry="1.5" fill={grain} stroke={STROKE} strokeWidth={SW} transform="rotate(38 14.7 12.5)" />
          <ellipse cx="9.3" cy="16.5" rx="2.6" ry="1.5" fill={grain} stroke={STROKE} strokeWidth={SW} transform="rotate(-38 9.3 16.5)" />
          <ellipse cx="14.7" cy="16.5" rx="2.6" ry="1.5" fill={grain} stroke={STROKE} strokeWidth={SW} transform="rotate(38 14.7 16.5)" />
        </svg>
      );
    }
    case 'ore': {
      // Montaña de pizarra con veta de mineral.
      const rock = '#6c7682';
      const shade = '#4d5560';
      return (
        <svg {...common}>
          {/* Pico trasero */}
          <path d="M3 19.5 L8.5 8.5 L13 16 Z" fill={shade} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
          {/* Pico principal */}
          <path d="M8 19.5 L15 5 L21.5 19.5 Z" fill={rock} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
          {/* Faceta sombreada del pico principal */}
          <path d="M15 5 L17.8 11.2 L15.5 19.5 L21.5 19.5 Z" fill={shade} opacity="0.55" />
          {/* Destellos de mineral */}
          <path d="M13.2 13.5 l0.9 0.9 l-0.9 0.9 l-0.9 -0.9 Z" fill="#dfe5ec" />
          <path d="M16.6 15.8 l0.7 0.7 l-0.7 0.7 l-0.7 -0.7 Z" fill="#dfe5ec" />
        </svg>
      );
    }
  }
}

// ─── Cartas de desarrollo ────────────────────────────────────────────────────

export function DevCardGlyph({
  card,
  size = 20,
  className,
  fallback = false,
}: GlyphProps & { card: DevCardType }): JSX.Element {
  if (fallback) {
    return (
      <EmojiGlyph emoji={DEV_CARD_EMOJI[card]} size={size} className={className} />
    );
  }
  const common = svgProps(size, className);
  switch (card) {
    case 'knight': {
      // Espada sobre escudo: el caballero.
      const shield = '#8a4a3a';
      const steel = '#cfd6df';
      return (
        <svg {...common}>
          <path
            d="M12 3 C 14.5 4.6, 17.2 5.2, 19 5.2 C 19 13.5, 16.5 18.3, 12 21 C 7.5 18.3, 5 13.5, 5 5.2 C 6.8 5.2, 9.5 4.6, 12 3 Z"
            fill={shield}
            stroke={STROKE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          {/* Hoja */}
          <path d="M12 5.5 L13.1 7 V14 H10.9 V7 Z" fill={steel} stroke={STROKE} strokeWidth="1.1" strokeLinejoin="round" />
          {/* Cruceta */}
          <rect x="9" y="13.6" width="6" height="1.7" rx="0.6" fill={steel} stroke={STROKE} strokeWidth="1.1" />
          {/* Empuñadura + pomo */}
          <rect x="11.2" y="15.3" width="1.6" height="2.6" fill={STROKE} />
          <circle cx="12" cy="18.6" r="1" fill={steel} stroke={STROKE} strokeWidth="1.1" />
        </svg>
      );
    }
    case 'vp': {
      // Trofeo con laurel implícito: punto de victoria. Dorado (insignia).
      const gold = '#d9a93e';
      const goldDeep = '#a87b22';
      return (
        <svg {...common}>
          {/* Copa */}
          <path
            d="M7.5 4 H16.5 V9.5 C16.5 12.5 14.5 14.5 12 14.5 C9.5 14.5 7.5 12.5 7.5 9.5 Z"
            fill={gold}
            stroke={STROKE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          {/* Asas */}
          <path d="M7.5 5.5 H4.5 C4.5 9 6 10.5 8 10.8 M16.5 5.5 H19.5 C19.5 9 18 10.5 16 10.8" fill="none" stroke={goldDeep} strokeWidth="1.6" strokeLinecap="round" />
          {/* Pie */}
          <path d="M10.8 14.5 L10.3 17.5 H13.7 L13.2 14.5 Z" fill={goldDeep} stroke={STROKE} strokeWidth="1.1" strokeLinejoin="round" />
          <rect x="8.3" y="17.5" width="7.4" height="2.6" rx="0.8" fill={gold} stroke={STROKE} strokeWidth={SW} />
          {/* Estrella grabada */}
          <path d="M12 6.4 l0.85 1.7 1.85 0.25 -1.35 1.3 0.33 1.85 -1.68 -0.9 -1.68 0.9 0.33 -1.85 -1.35 -1.3 1.85 -0.25 Z" fill={goldDeep} />
        </svg>
      );
    }
    case 'monopoly': {
      // Bolsa de monedas atada: el monopolio se queda con todo.
      const sack = '#9a7544';
      const tie = '#5e442a';
      return (
        <svg {...common}>
          {/* Cuello */}
          <path d="M9.5 6.5 L10.5 4 H13.5 L14.5 6.5 Z" fill={tie} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
          {/* Cuerpo de la bolsa */}
          <path
            d="M9.5 6.8 C 5.8 9.2, 4.5 12.6, 4.5 15.4 C 4.5 19 7.6 21 12 21 C 16.4 21 19.5 19 19.5 15.4 C 19.5 12.6 18.2 9.2 14.5 6.8 Z"
            fill={sack}
            stroke={STROKE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          {/* Atadura */}
          <rect x="8.8" y="6.1" width="6.4" height="1.6" rx="0.8" fill={tie} stroke={STROKE} strokeWidth="1" />
          {/* Símbolo de moneda grabado */}
          <circle cx="12" cy="14.4" r="3.1" fill="none" stroke={tie} strokeWidth="1.6" />
          <path d="M12 11.9 V16.9 M10.7 13.3 H13.3 M10.7 15.5 H13.3" stroke={tie} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    }
    case 'yearOfPlenty': {
      // Regalo de la abundancia: cofre/caja con lazo.
      const box = '#3f7d8c';
      const ribbon = '#e6c453';
      return (
        <svg {...common}>
          {/* Caja */}
          <rect x="4.5" y="9.5" width="15" height="11" rx="1.2" fill={box} stroke={STROKE} strokeWidth={SW} />
          {/* Tapa */}
          <rect x="3.5" y="6.5" width="17" height="4" rx="1" fill={box} stroke={STROKE} strokeWidth={SW} />
          {/* Cinta vertical */}
          <rect x="10.8" y="6.5" width="2.4" height="14" fill={ribbon} stroke={STROKE} strokeWidth="1" />
          {/* Moño */}
          <path d="M12 6.2 C 9.8 6.2, 8.2 5 8.6 3.6 C 9 2.4 10.8 2.6 12 4.6 C 13.2 2.6 15 2.4 15.4 3.6 C 15.8 5 14.2 6.2 12 6.2 Z" fill={ribbon} stroke={STROKE} strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      );
    }
    case 'roadBuilding': {
      // Camino que se interna hacia el horizonte, con dovelas.
      const road = '#a8866a';
      const edge = '#5e442a';
      return (
        <svg {...common}>
          {/* Calzada en perspectiva */}
          <path d="M9 3.5 H15 L20 20.5 H4 Z" fill={road} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
          {/* Bordes */}
          <path d="M9 3.5 L4 20.5 M15 3.5 L20 20.5" stroke={edge} strokeWidth="1.2" />
          {/* Dovelas centrales */}
          <path d="M12 5.5 V7.5 M12 10 V12.5 M12 15.5 V18.5" stroke={edge} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    }
  }
}

// ─── Ladrón ──────────────────────────────────────────────────────────────────

// Figura encapuchada: capa oscura + rostro en sombra. Se usa en la tabla de
// producción (ficha bloqueada) y el flujo del 7.
export function RobberGlyph({
  size = 20,
  className,
  fallback = false,
}: GlyphProps): JSX.Element {
  if (fallback) {
    return <EmojiGlyph emoji={ROBBER_EMOJI} size={size} className={className} />;
  }
  const cloak = '#3a3440';
  const shadow = '#211d26';
  return (
    <svg {...svgProps(size, className)}>
      {/* Capa */}
      <path
        d="M12 2.5 C 7.8 2.5, 5.5 6.2, 5.5 10.5 C 5.5 13.5, 4.8 16.8, 4 19 C 4 20.2, 7 21.5, 12 21.5 C 17 21.5, 20 20.2, 20 19 C 19.2 16.8, 18.5 13.5, 18.5 10.5 C 18.5 6.2, 16.2 2.5, 12 2.5 Z"
        fill={cloak}
        stroke={STROKE}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      {/* Capucha: hueco del rostro en sombra */}
      <ellipse cx="12" cy="9.3" rx="3.6" ry="4" fill={shadow} stroke={STROKE} strokeWidth="1.1" />
      {/* Ojos */}
      <circle cx="10.6" cy="9" r="0.7" fill="#e8dfcf" />
      <circle cx="13.4" cy="9" r="0.7" fill="#e8dfcf" />
      {/* Pliegue de la capa */}
      <path d="M12 14 V20.5" stroke={shadow} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Insignias (medalla/sello) ───────────────────────────────────────────────

// Insignias transferibles con aspecto de medalla: aro dorado dentado (sello)
// + glifo interior. El dorado aquí es legítimo: las insignias son uno de los
// tres usos reservados del dorado en el tema.
export function BadgeGlyph({
  variant,
  size = 16,
  className,
}: {
  variant: 'army' | 'road';
  size?: number;
  className?: string;
}): JSX.Element {
  const gold = '#d9a93e';
  const goldDeep = '#a87b22';
  // Borde dentado del sello: 12 puntas sobre el aro.
  const teeth: JSX.Element[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const x = 12 + Math.cos(a) * 10.4;
    const y = 12 + Math.sin(a) * 10.4;
    teeth.push(<circle key={i} cx={x} cy={y} r="1.4" fill={goldDeep} />);
  }
  return (
    <svg {...svgProps(size, className)}>
      {teeth}
      {/* Medalla */}
      <circle cx="12" cy="12" r="9.6" fill={gold} stroke={STROKE} strokeWidth={SW} />
      <circle cx="12" cy="12" r="7.4" fill="none" stroke={goldDeep} strokeWidth="1.1" />
      {variant === 'army' ? (
        // Espadas cruzadas grabadas en la medalla.
        <g stroke={STROKE} strokeWidth="1.6" strokeLinecap="round">
          <path d="M8 8 L16 16" />
          <path d="M16 8 L8 16" />
          <path d="M8.6 14.2 L9.8 15.4 M14.2 14.2 L15.4 15.4" strokeWidth="1.2" />
        </g>
      ) : (
        // Camino sinuoso grabado en la medalla.
        <g fill="none" strokeLinecap="round">
          <path d="M7 15.5 C 9 15.5, 9.5 9.5, 12 9.5 S 15 15.5, 17 15.5" stroke={STROKE} strokeWidth="2.6" />
          <path d="M7 15.5 C 9 15.5, 9.5 9.5, 12 9.5 S 15 15.5, 17 15.5" stroke={goldDeep} strokeWidth="1.1" strokeDasharray="1.6 1.9" />
        </g>
      )}
    </svg>
  );
}
