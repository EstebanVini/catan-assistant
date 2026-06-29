import {
  Commodity,
  DevCardType,
  Discipline,
  PROGRESS_CARD_DISCIPLINE,
  ProgressCardType,
  Resource,
} from '../types';
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
// Arte DEFINITIVO de Caballeros y Ciudades (Esteban): medallones completos con
// su propio marco de cobre/madera y el color/rango ya integrado en el dibujo.
// Por eso se renderizan DIRECTO (como `ResourceGlyph`/`ImgGlyph`), sin los
// tratamientos CSS (anillos, galones) que envolvían el arte reciclado anterior.
import coinUrl from './icons/moneda.png';
import paperUrl from './icons/papel.png';
import clothUrl from './icons/tela.png';
import tradeUrl from './icons/comercio.png';
import politicsUrl from './icons/politica.png';
import scienceUrl from './icons/ciencia.png';
import knight1Url from './icons/caballero_nivel1.png';
import knight2Url from './icons/caballero_nivel2.png';
import knight3Url from './icons/caballero_nivel3.png';
import merchantUrl from './icons/comerciante.png';
import metropolisUrl from './icons/metropolis.png';
import wallUrl from './icons/muralla.png';
import barbarianShipUrl from './icons/barco_barbaro.png';
import barbarianAttackUrl from './icons/barbaros_atacan.png';
import defenderUrl from './icons/defensor_catan_1vp.png';

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

// Mercancías de Caballeros y Ciudades (commodities). Solo se muestran cuando
// el modo C&K está activo. Reciclan temporalmente arte de recursos (ver
// missing-icons.md §1) PERO el componente las distingue con un marco/anillo
// dorado heráldico para que NUNCA se confundan con un recurso: una mercancía
// no es un recurso.
export const COMMODITY_EMOJI: Record<Commodity, string> = {
  coin: '🪙',
  paper: '📜',
  cloth: '🧶',
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

// ─── Mercancías (commodities) ─────────────────────────────────────────────────
//
// Arte DEFINITIVO de Esteban: moneda.png / papel.png / tela.png. Cada medallón
// ya trae su propio marco de cobre y la mercancía integrada con su color, así
// que se renderiza DIRECTO —igual que `ResourceGlyph`— sin el anillo dorado
// heráldico ni el sello que antes envolvían el arte reciclado (serían un doble
// marco). El propio dibujo del medallón es lo que la separa de un recurso.

export const COMMODITY_ICON_URL: Record<Commodity, string> = {
  coin: coinUrl,
  paper: paperUrl,
  cloth: clothUrl,
};

export function CommodityGlyph({
  commodity,
  size = 20,
  className,
  fallback = false,
}: GlyphProps & { commodity: Commodity }): JSX.Element {
  if (fallback) {
    return (
      <EmojiGlyph
        emoji={COMMODITY_EMOJI[commodity]}
        size={size}
        className={className}
      />
    );
  }
  return (
    <ImgGlyph src={COMMODITY_ICON_URL[commodity]} size={size} className={className} />
  );
}

// ─── Disciplinas de mejora de ciudad (calendario C&K) ─────────────────────────
//
// Arte DEFINITIVO de Esteban: comercio.png / politica.png / ciencia.png. Cada
// medallón trae su propio marco y el símbolo de la disciplina (balanza dorada,
// sello político, ciencia) ya integrado con su color, así que se renderiza
// DIRECTO —igual que `ResourceGlyph`— sin el anillo de color CSS que antes
// envolvía el arte reciclado (sería un doble marco). El propio medallón
// identifica la disciplina.

export const DISCIPLINE_ICON_URL: Record<Discipline, string> = {
  trade: tradeUrl, // Comercio
  politics: politicsUrl, // Política
  science: scienceUrl, // Ciencia
};

// Color del anillo por disciplina (espejo de --discipline-* / tailwind
// `discipline.*`). `DisciplineGlyph` ya NO lo usa (su arte trae el color), pero
// `ProgressCardGlyph` SÍ: las 25 cartas de progreso siguen con arte reciclado de
// dev cards y se distinguen por el anillo del color de su disciplina. Por eso la
// constante se conserva.
const DISCIPLINE_RING: Record<Discipline, string> = {
  trade: '#d9a93e', // amarillo/dorado
  politics: '#5b86d6', // azul
  science: '#52a866', // verde
};

export function DisciplineGlyph({
  discipline,
  size = 20,
  className,
}: GlyphProps & { discipline: Discipline }): JSX.Element {
  return (
    <ImgGlyph src={DISCIPLINE_ICON_URL[discipline]} size={size} className={className} />
  );
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

// ─── Cartas de progreso (Caballeros y Ciudades, §2.10) ────────────────────────
//
// Arte RECICLADO (no hay arte propio de las 25 cartas todavía): cada carta de
// progreso se dibuja con el medallón de la carta de desarrollo del base que
// mejor evoca su efecto, envuelto en el MISMO anillo del color de su disciplina
// que usa `DisciplineGlyph` (Comercio amarillo, Política azul, Ciencia verde).
// El anillo de color es el distintivo: una carta de progreso se lee por su
// disciplina, no por el arte interior. El nombre vecino (PROGRESS_CARD_NAMES) la
// identifica con precisión. Cuando llegue arte propio basta cambiar
// `PROGRESS_CARD_ART` (o sustituir por URLs definitivas por carta).
//
// Mapeo arte interior por carta (criterio: el dev card cuyo significado se
// acerca más al efecto del §2.10; el resto cae a un default por disciplina):
//  - roadBuildingP → roadBuilding (literalmente "coloca 2 caminos").
//  - resourceMonopoly / tradeMonopoly → monopoly (toma cartas de los rivales).
//  - printer / constitution → vp (cartas permanentes de +1 PV).
//  - warlord / smith / deserter / intrigue / saboteur / bishop → knight
//    (efectos militares / de caballeros).
//  - default por disciplina: ciencia→yearOfPlenty (ganancia del banco),
//    comercio→monopoly (ventaja comercial), política→knight (poder militar).
const PROGRESS_DISCIPLINE_DEFAULT_ART: Record<Discipline, DevCardType> = {
  science: 'yearOfPlenty',
  trade: 'monopoly',
  politics: 'knight',
};

const PROGRESS_CARD_ART: Partial<Record<ProgressCardType, DevCardType>> = {
  roadBuildingP: 'roadBuilding',
  resourceMonopoly: 'monopoly',
  tradeMonopoly: 'monopoly',
  printer: 'vp',
  constitution: 'vp',
  warlord: 'knight',
  smith: 'knight',
  deserter: 'knight',
  intrigue: 'knight',
  saboteur: 'knight',
  bishop: 'knight',
};

export function progressCardArt(card: ProgressCardType): DevCardType {
  return (
    PROGRESS_CARD_ART[card] ??
    PROGRESS_DISCIPLINE_DEFAULT_ART[PROGRESS_CARD_DISCIPLINE[card]]
  );
}

export function ProgressCardGlyph({
  card,
  size = 20,
  className,
}: GlyphProps & { card: ProgressCardType }): JSX.Element {
  // Medallón de dev card reciclado + anillo del color de la disciplina (mismo
  // lenguaje que `DisciplineGlyph`). El arte ocupa ~74% del área para dejar ver
  // el aro completo.
  const discipline = PROGRESS_CARD_DISCIPLINE[card];
  const inner = Math.round(size * 0.74);
  const ring = DISCIPLINE_RING[discipline];
  return (
    <span
      aria-hidden
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '9999px',
        background: `radial-gradient(closest-side, ${ring}22, ${ring}0d 70%, transparent)`,
        border: `1.5px solid ${ring}`,
        boxShadow: `inset 0 0 0 1px ${STROKE}33, 0 0 0 1px ${STROKE}22`,
      }}
    >
      <img
        src={DEV_CARD_ICON_URL[progressCardArt(card)]}
        width={inner}
        height={inner}
        alt=""
        aria-hidden
        draggable={false}
        style={{ display: 'block', objectFit: 'contain' }}
      />
    </span>
  );
}

// ─── Caballeros (Caballeros y Ciudades, §2.6) ─────────────────────────────────
//
// Arte DEFINITIVO de Esteban POR RANGO: caballero_nivel1/2/3.png. Cada medallón
// trae su propio marco Y el rango integrado en el dibujo (galones + penacho), así
// que se renderiza DIRECTO, sin galones CSS ni anillo de color (serían un doble
// marco). El ESTADO activo/inactivo NO está en el arte, así que se resuelve en
// CSS SIN un borde que compita con el marco del medallón:
//  - ACTIVO   → opacidad plena + un glow dorado cálido sutil (`drop-shadow`, que
//    sigue la silueta del medallón, sin borde duro): el caballero "en pie".
//  - INACTIVO → atenuado (opacity 0.5) + desaturado (grayscale 0.7): "en reserva".
// El nombre/etiqueta vecina (KNIGHT_RANK_NAMES + "Activo/Inactivo") lo precisa.

export const KNIGHT_ICON_URL: Record<1 | 2 | 3, string> = {
  1: knight1Url,
  2: knight2Url,
  3: knight3Url,
};

export function KnightGlyph({
  rank,
  active,
  size = 28,
  className,
}: {
  rank: 1 | 2 | 3;
  active: boolean;
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    <img
      src={KNIGHT_ICON_URL[rank]}
      width={size}
      height={size}
      className={className}
      alt=""
      aria-hidden
      draggable={false}
      style={{
        display: 'inline-block',
        objectFit: 'contain',
        flexShrink: 0,
        // Estado (no está en el arte): activo a plena opacidad con un glow
        // dorado cálido y sutil; inactivo atenuado y desaturado ("en reserva").
        opacity: active ? 1 : 0.5,
        filter: active
          ? 'drop-shadow(0 0 2px rgba(217,169,62,0.55))'
          : 'grayscale(0.7)',
      }}
    />
  );
}

// ─── Comerciante, metrópolis, muro, bárbaros y Defensor (C&K) ─────────────────
//
// Arte DEFINITIVO de Esteban (medallones completos con su marco propio): se
// renderizan DIRECTO como `ImgGlyph`. Decorativos (`aria-hidden`); el texto
// vecino los nombra. Las cartas de progreso NO entran aquí (su arte aún no
// existe; siguen con arte reciclado en `ProgressCardGlyph`).

// Ficha/insignia del comerciante (Mercader): 2:1 + 1 PV a quien lo controla.
export function MerchantGlyph({ size = 20, className }: GlyphProps): JSX.Element {
  return <ImgGlyph src={merchantUrl} size={size} className={className} />;
}

// Metrópolis (ciudad mejorada a 4 PV).
export function MetropolisGlyph({ size = 20, className }: GlyphProps): JSX.Element {
  return <ImgGlyph src={metropolisUrl} size={size} className={className} />;
}

// Barco bárbaro (avance hacia Catán / dado de evento).
export function BarbarianShipGlyph({ size = 20, className }: GlyphProps): JSX.Element {
  return <ImgGlyph src={barbarianShipUrl} size={size} className={className} />;
}

// Ataque/saqueo bárbaro (resolución del ataque).
export function BarbarianAttackGlyph({ size = 20, className }: GlyphProps): JSX.Element {
  return <ImgGlyph src={barbarianAttackUrl} size={size} className={className} />;
}

// Defensor de Catán (+1 PV).
export function DefenderGlyph({ size = 20, className }: GlyphProps): JSX.Element {
  return <ImgGlyph src={defenderUrl} size={size} className={className} />;
}

// Muro de ciudad (muralla.png). `filled` = muro construido (opacidad plena);
// hueco = aún por construir → atenuado y desaturado para leerse "vacío".
export function WallGlyph({
  filled,
  size = 20,
  className,
}: {
  filled: boolean;
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    <img
      src={wallUrl}
      width={size}
      height={size}
      className={className}
      alt=""
      aria-hidden
      draggable={false}
      style={{
        display: 'inline-block',
        objectFit: 'contain',
        flexShrink: 0,
        opacity: filled ? 1 : 0.3,
        filter: filled ? 'none' : 'grayscale(0.85)',
      }}
    />
  );
}

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
// significado lo lleva el `aria-label` del contenedor.
//
// Paleta del TEMA (no el amber genérico de Tailwind): la llama va de la base
// terracota (--resource-brick #c4663f) por el cuerpo dorado (--gold #d9a93e /
// --gold-light #ecc35f) hasta un corazón claro (#fff3d6, derivado de ink-light).
// Así el fuego pertenece al lenguaje de medalla/sello Catán (mismo dorado de
// las insignias) en lugar de leerse como un ámbar de framework. El gradiente
// vertical (base más caliente, punta más luminosa) da volumen de brasa.
// El motion-engineer la anima respetando `prefers-reduced-motion`.
//
// `gradId` es único por instancia (varios FireGlyph conviven en la pantalla de
// perfil: insignia + estadística) para que los <defs> no colisionen.
let fireGradSeq = 0;
export function FireGlyph({
  size = 16,
  className,
  fallback = false,
}: GlyphProps): JSX.Element {
  if (fallback) {
    return <EmojiGlyph emoji={FIRE_EMOJI} size={size} className={className} />;
  }
  const gradId = `fireGrad-${(fireGradSeq = (fireGradSeq + 1) % 100000)}`;
  const coreId = `fireCore-${gradId}`;
  return (
    <svg {...svgProps(size, className)}>
      <defs>
        {/* Cuerpo: terracota en la base → dorado → dorado claro en la punta. */}
        <linearGradient id={gradId} x1="12" y1="22" x2="12" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b8552f" />
          <stop offset="0.42" stopColor="#d9a93e" />
          <stop offset="1" stopColor="#ecc35f" />
        </linearGradient>
        {/* Corazón: dorado claro → casi blanco cálido (brasa interior). */}
        <linearGradient id={coreId} x1="12" y1="20.2" x2="12" y2="10.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ecc35f" />
          <stop offset="1" stopColor="#fff3d6" />
        </linearGradient>
      </defs>
      {/* Llama exterior. Borde nogal cálido (mismo STROKE del set) para que
          el glifo recorte limpio sobre el acento dorado del medallón. */}
      <path
        d="M12 2 C 13.2 5.4, 16.6 7, 16.6 11.6 C 16.6 16.2, 13.4 18.8, 12 22 C 10.6 18.8, 7.4 16.4, 7.4 11.8 C 7.4 8.9, 9.2 7.4, 10 5.2 C 10.6 6.9, 11.4 7.6, 11.9 9.1 C 12.2 6.5, 12.1 4.2, 12 2 Z"
        fill={`url(#${gradId})`}
        stroke="#6e3b1d"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* Llama interior (corazón de brasa). */}
      <path
        d="M12 10.6 C 13 12.4, 13.8 13.6, 13.8 15.5 C 13.8 17.6, 12.9 18.9, 12 20.4 C 11.1 18.9, 10.2 17.6, 10.2 15.5 C 10.2 14, 11 12.8, 12 10.6 Z"
        fill={`url(#${coreId})`}
      />
    </svg>
  );
}
