import { DevCardType, Resource } from '../types';
import brickUrl from './icons/ladrillo.png';
import lumberUrl from './icons/madera.png';
import woolUrl from './icons/obeja.png';
import grainUrl from './icons/paja.png';
import oreUrl from './icons/mineral.png';
import robberUrl from './icons/ladron.png';
import desertUrl from './icons/desierto.png';
import settlementUrl from './icons/poblado.png';
import cityUrl from './icons/ciudad.png';
import roadUrl from './icons/camino.png';
import knightUrl from './icons/caballero.png';
import vpUrl from './icons/punto_de_victoria.png';
import monopolyUrl from './icons/monopolio.png';
import yearOfPlentyUrl from './icons/ano_abundancia.png';
import roadBuildingUrl from './icons/construccion_carreteras.png';

// ─── Íconos temáticos de Catán — MÓDULO ÚNICO de mapeo asset → recurso/carta ─
//
// Este es el ÚNICO lugar donde se decide qué dibujo representa cada recurso,
// carta de desarrollo, insignia y al ladrón. Los componentes (`ResourceIcon`,
// `BadgeIcon`, modales, tablas) importan de aquí y NUNCA conocen el asset.
// Para cambiar el set completo (p. ej. por arte de las cartas reales) basta
// con tocar este archivo.
//
// Recursos, ladrón, desierto y construcciones usan el arte tipo medallón
// subido por Esteban (PNG 128px optimizados desde los originales de 2048px;
// los .svg subidos solo envolvían el mismo PNG embebido, por eso se eligió
// PNG). Las cartas de desarrollo y las insignias siguen siendo SVG del set
// plano hasta que haya arte propio.
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
export const FIRE_EMOJI = '🔥';

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

// Glifo de imagen (arte medallón): decorativo, el texto vecino lo nombra.
function ImgGlyph({
  src,
  size,
  className,
}: {
  src: string;
  size: number;
  className?: string;
}): JSX.Element {
  return (
    <img
      src={src}
      width={size}
      height={size}
      className={className}
      alt=""
      aria-hidden
      draggable={false}
      style={{ display: 'inline-block', objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

// ─── Recursos ────────────────────────────────────────────────────────────────

export const RESOURCE_ICON_URL: Record<Resource, string> = {
  brick: brickUrl,
  lumber: lumberUrl,
  wool: woolUrl,
  grain: grainUrl,
  ore: oreUrl,
};

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
  return <ImgGlyph src={RESOURCE_ICON_URL[resource]} size={size} className={className} />;
}

// ─── Construcciones y tablero ────────────────────────────────────────────────

export function BuildingGlyph({
  type,
  size = 20,
  className,
}: {
  type: 'settlement' | 'city';
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    <ImgGlyph src={type === 'city' ? cityUrl : settlementUrl} size={size} className={className} />
  );
}

export function RoadGlyph({ size = 20, className }: GlyphProps): JSX.Element {
  return <ImgGlyph src={roadUrl} size={size} className={className} />;
}

export function DesertGlyph({ size = 20, className }: GlyphProps): JSX.Element {
  return <ImgGlyph src={desertUrl} size={size} className={className} />;
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
  return <ImgGlyph src={DEV_CARD_ICON_URL[card]} size={size} className={className} />;
}

export const DEV_CARD_ICON_URL: Record<DevCardType, string> = {
  knight: knightUrl,
  vp: vpUrl,
  monopoly: monopolyUrl,
  yearOfPlenty: yearOfPlentyUrl,
  roadBuilding: roadBuildingUrl,
};

// ─── Ladrón ──────────────────────────────────────────────────────────────────

// Arte medallón del ladrón. Se usa en la Tabla de construcción (ficha
// bloqueada) y el flujo del 7.
export function RobberGlyph({
  size = 20,
  className,
  fallback = false,
}: GlyphProps): JSX.Element {
  if (fallback) {
    return <EmojiGlyph emoji={ROBBER_EMOJI} size={size} className={className} />;
  }
  return <ImgGlyph src={robberUrl} size={size} className={className} />;
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

// ─── Racha de victorias (llama) ──────────────────────────────────────────────

// Glifo de llama para la insignia de racha. Decorativo (`aria-hidden`): el
// significado lo lleva el `aria-label` del contenedor. Acento llama/dorado del
// tema. El visual-designer puede afinar gradiente/tonos; el motion-engineer la
// anima respetando `prefers-reduced-motion`.
export function FireGlyph({
  size = 16,
  className,
  fallback = false,
}: GlyphProps): JSX.Element {
  if (fallback) {
    return <EmojiGlyph emoji={FIRE_EMOJI} size={size} className={className} />;
  }
  return (
    <svg {...svgProps(size, className)}>
      {/* Llama exterior */}
      <path
        d="M12 2.5 C 14 6, 16.5 7.5, 16.5 11.5 C 16.5 16, 13.2 18.5, 12 21.5 C 10.8 18.5, 7.5 16, 7.5 11.5 C 7.5 8.8, 9.3 7.6, 10 5.5 C 10.6 7, 11.4 7.6, 12 9 C 12.2 6.6, 12 4.5, 12 2.5 Z"
        fill="#f59e0b"
        stroke="#b45309"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Llama interior (corazón) */}
      <path
        d="M12 11 C 13 12.6, 13.8 13.8, 13.8 15.4 C 13.8 17.4, 12.9 18.7, 12 20.2 C 11.1 18.7, 10.2 17.4, 10.2 15.4 C 10.2 14, 11 13, 12 11 Z"
        fill="#fde68a"
      />
    </svg>
  );
}
