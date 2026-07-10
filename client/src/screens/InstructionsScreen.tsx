import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useStore } from '../store';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { prefersReducedMotion } from '../lib/motion';
import {
  INSTRUCTIONS,
  INSTRUCTIONS_BACK,
  INSTRUCTIONS_ENTRY,
  INSTRUCTIONS_LEAD,
  INSTRUCTIONS_TOC_TITLE,
} from './instructionsContent';
import type {
  IllustratedBlock,
  InstructionImage,
  InstructionSection,
} from './instructionsContent';

// Pantalla "Cómo jugar" (instructivo de uso de la app).
//
// El contenido y el copy son 100% del módulo `instructionsContent.ts` (dominio
// del ux-writer): aquí solo se renderiza y se cablea la navegación. Objetivos:
//  - Cambio de ruta accesible: al montar, el foco viaja al <h1> (no es modal).
//  - Índice tocable con anchor-scroll (targets ≥44px) que respeta el header
//    sticky vía `scroll-margin-top`.
//  - Secciones colapsables: colapsado NO monta hijos → las imágenes de
//    secciones cerradas no se descargan hasta abrirlas.
//  - Imágenes con espacio reservado (cero CLS): cada contenedor fija su
//    `aspect-ratio` con las dimensiones reales del archivo, placeholder
//    `bg-surface-2` mientras carga, `loading="lazy"` + `decoding="async"`.
//  - Motion gateado por `prefers-reduced-motion` (el scroll suave del índice
//    cae a instantáneo; el resto de animaciones ya lo gestiona index.css).

// Dimensiones intrínsecas reales de cada archivo (px). Se usan para fijar el
// aspect-ratio del contenedor y reservar el hueco antes de que la imagen
// cargue, evitando saltos de layout (CLS). Fuente de verdad: los archivos en
// `public/instructions/`.
const IMAGE_DIMS: Record<string, { w: number; h: number }> = {
  '/instructions/ladrillo6.png': { w: 404, h: 410 },
  '/instructions/lana5.png': { w: 404, h: 410 },
  '/instructions/lana8.png': { w: 404, h: 410 },
  '/instructions/madera9.png': { w: 404, h: 410 },
  '/instructions/madera10.png': { w: 404, h: 410 },
  '/instructions/poblado_3fichas_recursos.jpg': { w: 828, h: 1100 },
  '/instructions/poblado_3_recursos.png': { w: 402, h: 189 },
  '/instructions/poblado_puerto_1ficha.jpg': { w: 828, h: 1100 },
  '/instructions/puerto_mineral.png': { w: 576, h: 395 },
  '/instructions/poblado_app_1recurso_puerto.png': { w: 402, h: 191 },
  '/instructions/poblado_app_2recursos_puerto.png': { w: 404, h: 146 },
  '/instructions/poblado_puerto_2fichas.jpg': { w: 828, h: 1100 },
  '/instructions/poblado_app_desierto.png': { w: 386, h: 184 },
  '/instructions/poblado_desierto.jpg': { w: 828, h: 1100 },
  '/instructions/2poblados_ficha_compartida.jpg': { w: 828, h: 1100 },
  '/instructions/ficha_recurso_compartida_app.png': { w: 393, h: 612 },
  '/instructions/ficha_recursos_NO_compartida.png': { w: 395, h: 614 },
  // Capturas del walkthrough de la app (verticales, ~480px de ancho). Se usan
  // como `figures` sueltas que ilustran las secciones de texto.
  '/instructions/01-home-guest.jpg': { w: 480, h: 767 },
  '/instructions/08-lobby-host.jpg': { w: 480, h: 713 },
  '/instructions/09-lobby-player-color.jpg': { w: 480, h: 770 },
  '/instructions/15-lobby-host-controls.jpg': { w: 480, h: 716 },
  '/instructions/17-game-roll-phase.jpg': { w: 480, h: 716 },
  '/instructions/18-game-production.jpg': { w: 480, h: 738 },
  '/instructions/19-game-turn-main.jpg': { w: 480, h: 738 },
  '/instructions/24-game-buy-settlement.jpg': { w: 480, h: 738 },
  '/instructions/27-game-hand-hidden.jpg': { w: 480, h: 738 },
  '/instructions/28-card-knight.jpg': { w: 480, h: 738 },
  '/instructions/30-game-bank-give-card.jpg': { w: 480, h: 738 },
  '/instructions/34-game-trade-bank.jpg': { w: 480, h: 738 },
  '/instructions/35-game-trade-players.jpg': { w: 480, h: 738 },
  '/instructions/42-game-construction-table.jpg': { w: 480, h: 702 },
  '/instructions/44-game-discard-seven.jpg': { w: 480, h: 702 },
  '/instructions/46-game-robber-pick-hex.jpg': { w: 441, h: 773 },
  '/instructions/50-game-play-card-menu.jpg': { w: 480, h: 715 },
  '/instructions/52-game-players-badges.jpg': { w: 480, h: 715 },
  '/instructions/56-game-ended.jpg': { w: 480, h: 699 },
};

function dimsFor(src: string): { w: number; h: number } {
  // Fallback conservador 3:4 (mismo ratio que las fotos del tablero) si algún
  // src no estuviera mapeado: reserva algo de espacio en vez de nada.
  return IMAGE_DIMS[src] ?? { w: 3, h: 4 };
}

// ─── Scroll-reveal one-shot ──────────────────────────────────────────────────
// Revela cada bloque ilustrado al entrar al viewport (fade + leve translateY),
// una sola vez, con un escalonado suave entre sus etapas (foto → conector →
// app → resultado). Intensidad baja: es una guía de LECTURA, el movimiento solo
// aporta jerarquía y feedback de "aquí llega este bloque".
//
// Contrato de seguridad (ver `.reveal` en index.css): el estado oculto SOLO se
// aplica cuando el JS confirma soporte de IntersectionObserver y que el usuario
// NO pidió reduced-motion. En cualquier otro caso el contenido queda visible de
// inmediato — nada "atrapado" invisible.

const REVEAL_STEP_MS = 55; // paso del escalonado entre etapas de un bloque
const REVEAL_MAX_STEPS = 6; // tope: los bloques largos no arrastran el revelado

function useRevealOnEnter<T extends HTMLElement>(): {
  ref: RefObject<T>;
  animate: boolean;
  visible: boolean;
} {
  const ref = useRef<T>(null);
  // Decidido una sola vez al montar: sin animación si el usuario pidió
  // reduced-motion o el navegador no expone IntersectionObserver.
  const [animate] = useState(
    () =>
      !prefersReducedMotion() &&
      typeof window !== 'undefined' &&
      typeof window.IntersectionObserver === 'function'
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!animate) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          io.disconnect(); // one-shot: no re-anima al re-scrollear
        }
      },
      // Dispara cuando el bloque ya entró un poco al viewport (margen inferior
      // negativo), nunca antes: así el revelado no se adelanta al lazy-load de
      // las imágenes.
      { rootMargin: '0px 0px -8% 0px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [animate]);

  return { ref, animate, visible };
}

// Props de revelado para una etapa: mezcla la clase base con `.reveal`, fija el
// estado hidden/shown y el retraso del escalonado (topado). Con `animate` en
// falso devuelve solo la clase base → la etapa queda visible, sin transición.
function revealAttrs(
  base: string,
  animate: boolean,
  visible: boolean,
  order: number
): {
  className: string;
  style?: CSSProperties;
  'data-reveal'?: 'hidden' | 'shown';
} {
  if (!animate) return { className: base };
  const delay = Math.min(order, REVEAL_MAX_STEPS) * REVEAL_STEP_MS;
  return {
    className: base ? base + ' reveal' : 'reveal',
    style: { '--reveal-delay': `${delay}ms` } as CSSProperties,
    'data-reveal': visible ? 'shown' : 'hidden',
  };
}

export function InstructionsScreen(): JSX.Element {
  const setHomeView = useStore((s) => s.setHomeView);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  // Alto del header sticky: alimenta el `scroll-margin-top` de las secciones
  // para que el anchor-scroll del índice no las deje ocultas bajo la barra.
  const [headerOffset, setHeaderOffset] = useState(96);
  // Estado de apertura de las secciones (modo controlado de CollapsibleSection).
  // Por defecto solo la sección con `defaultOpen` (registrar-poblados) queda
  // abierta; el índice puede abrir cualquier otra al saltar a ella.
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(INSTRUCTIONS.filter((s) => s.defaultOpen).map((s) => s.id))
  );
  function toggleSection(id: string): void {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Cambio de ruta: al montar, mover el foco al título como haría un router al
  // navegar (no es un modal, no atrapa el foco). `preventScroll` evita que el
  // navegador salte por poner el foco en un elemento fuera de vista.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  // Medir el header sticky (su alto cambia con el ancho por el reflujo del
  // texto). El offset de scroll deja además un pequeño respiro de 12px.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderOffset(el.offsetHeight + 12);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function scrollToSection(id: string) {
    // Un índice lleva al CONTENIDO, no a un header colapsado: abre la sección
    // destino antes de saltar. `block: 'start'` apunta al borde superior de la
    // sección (no se mueve al expandirse), así el salto no espera al re-render.
    setOpenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    const reduce = prefersReducedMotion();
    el.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'start',
    });
    // Micro-feedback de destino: un realce breve confirma a dónde saltó el
    // índice. Escala mínima anclada arriba (`block: 'start'` deja el borde
    // superior a la vista, así que el origen top mantiene quieta la zona
    // visible incluso en secciones altas). Solo transform, one-shot vía WAAPI;
    // se omite con reduced-motion o si el navegador no expone Element.animate.
    if (reduce || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'scale(1)', transformOrigin: 'top center' },
        { transform: 'scale(1.008)', transformOrigin: 'top center', offset: 0.45 },
        { transform: 'scale(1)', transformOrigin: 'top center' },
      ],
      { duration: 420, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }
    );
  }

  // Expone el alto del header como custom property para el `scroll-mt-[var(...)]`
  // de cada sección (la propiedad hereda a todo el subárbol).
  const rootStyle = {
    '--instr-hdr': `${headerOffset}px`,
  } as CSSProperties;

  return (
    <main
      style={rootStyle}
      className="mx-auto min-h-[100dvh] max-w-md px-4 pb-[max(env(safe-area-inset-bottom),2rem)]"
    >
      <header
        ref={headerRef}
        className="sticky top-0 z-30 -mx-4 border-b border-white/[0.12] bg-surface/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] shadow-[0_10px_24px_-16px_rgba(0,0,0,0.8)] backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => setHomeView('home')}
          className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 pr-2 text-sm font-medium text-neutral-300 transition-colors active:text-neutral-100"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
            <path
              d="M14 6 L8 12 L14 18"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {INSTRUCTIONS_BACK}
        </button>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="title-gold mt-1 font-display text-[26px] font-bold leading-tight tracking-tight outline-none"
        >
          {INSTRUCTIONS_ENTRY.title}
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-300">
          {INSTRUCTIONS_LEAD}
        </p>
      </header>

      <div className="anim-fade-in">
        <TableOfContents sections={INSTRUCTIONS} onJump={scrollToSection} />

        <div className="mt-3">
          {INSTRUCTIONS.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              collapsed={!openIds.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function TableOfContents({
  sections,
  onJump,
}: {
  sections: InstructionSection[];
  onJump: (id: string) => void;
}): JSX.Element {
  return (
    <nav
      aria-label={INSTRUCTIONS_TOC_TITLE}
      className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-surface-1 shadow-card"
    >
      <h2 className="border-b border-white/10 px-4 py-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
        {INSTRUCTIONS_TOC_TITLE}
      </h2>
      <ol className="divide-y divide-white/5">
        {sections.map((section, i) => (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => onJump(section.id)}
              className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-white/[0.05]"
            >
              <span
                aria-hidden
                className="nums flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-3 text-[11px] font-semibold text-neutral-300"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-neutral-100">
                {section.title}
              </span>
              <span aria-hidden className="flex-shrink-0 text-neutral-500">
                <svg width={16} height={16} viewBox="0 0 24 24">
                  <path
                    d="M9 6 L15 12 L9 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SectionCard({
  section,
  collapsed,
  onToggle,
}: {
  section: InstructionSection;
  collapsed: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <CollapsibleSection
      id={section.id}
      title={section.title}
      defaultCollapsed={!section.defaultOpen}
      collapsed={collapsed}
      onToggleCollapsed={onToggle}
      // `!mx-0`: la card ya vive dentro del gutter `px-4` del <main>, así que
      // anulamos el `mx-3` propio del componente para alinear al borde.
      // `scroll-mt`: compensa el header sticky en el anchor-scroll del índice.
      className="!mx-0 scroll-mt-[var(--instr-hdr)]"
    >
      <div className="px-4 py-4">
        <div className="space-y-3">
          {section.body.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-neutral-300">
              {paragraph}
            </p>
          ))}
        </div>

        {section.blocks && section.blocks.length > 0 ? (
          <div className="mt-5 space-y-5">
            {section.blocks.map((block) => (
              <IllustratedBlockView key={block.id} block={block} />
            ))}
          </div>
        ) : null}

        {section.figures && section.figures.length > 0 ? (
          <SectionFigures figures={section.figures} />
        ) : null}
      </div>
    </CollapsibleSection>
  );
}

// ─── Capturas sueltas de sección ─────────────────────────────────────────────
// Capturas de la app (kind 'app', verticales) que ilustran una sección de texto,
// sin la coreografía "foto → app → resultado" de los bloques. Se apilan bajo los
// párrafos con el mismo tratamiento visual que las capturas `app` (marco
// `ring-1`/`rounded`, `object-contain`), acotadas a un ancho cómodo para que no
// dominen la lectura en móvil.
//
// El contenedor se auto-observa (`useRevealOnEnter`): al entrar al viewport, las
// figuras se revelan con el mismo fade-in escalonado que los bloques. Con
// reduced-motion o sin IntersectionObserver quedan visibles de inmediato
// (contrato de `useRevealOnEnter` + `revealAttrs`).
function SectionFigures({
  figures,
}: {
  figures: InstructionImage[];
}): JSX.Element {
  const { ref, animate, visible } = useRevealOnEnter<HTMLDivElement>();
  return (
    <div ref={ref} className="mt-5 space-y-5">
      {figures.map((figure, i) => (
        <div key={figure.src} {...revealAttrs('', animate, visible, i)}>
          <AppFigure image={figure} className="mx-auto w-full max-w-[15rem]" />
        </div>
      ))}
    </div>
  );
}

// ─── Bloque ilustrado ────────────────────────────────────────────────────────
// Reproduce el patrón del PDF apilado en vertical: título, lead opcional, las
// imágenes en orden (con un conector entre etapas) y la leyenda del bloque al
// final.

type ImageGroup =
  | { kind: 'tiles'; images: InstructionImage[] }
  | { kind: 'pair'; images: [InstructionImage, InstructionImage] }
  | { kind: 'single'; image: InstructionImage };

// Agrupa las imágenes de un bloque:
//  - Si TODAS son fichas (`tile`), se muestran juntas en una fila (alternativas
//    lado a lado, sin conectores). Caso: "anatomía de una ficha".
//  - Dos imágenes `app` consecutivas con caption forman un par 2-up comparativo
//    (caso "¿es la misma ficha o una nueva?").
//  - El resto son etapas sueltas apiladas con conector.
function groupImages(images: InstructionImage[]): ImageGroup[] {
  if (images.length > 1 && images.every((im) => im.kind === 'tile')) {
    return [{ kind: 'tiles', images }];
  }
  const groups: ImageGroup[] = [];
  for (let i = 0; i < images.length; i += 1) {
    const current = images[i];
    const next = images[i + 1];
    if (
      current.kind === 'app' &&
      current.caption &&
      next &&
      next.kind === 'app' &&
      next.caption
    ) {
      groups.push({ kind: 'pair', images: [current, next] });
      i += 1;
    } else {
      groups.push({ kind: 'single', image: current });
    }
  }
  return groups;
}

function IllustratedBlockView({
  block,
}: {
  block: IllustratedBlock;
}): JSX.Element {
  const groups = groupImages(block.images);
  const titleId = `block-${block.id}`;
  // El bloque se auto-observa: al entrar al viewport, sus etapas se revelan en
  // cascada. La card (borde/fondo) NO se anima como bloque: queda como marco
  // estable y solo su contenido escalona, evitando opacidades anidadas.
  const { ref, animate, visible } = useRevealOnEnter<HTMLElement>();

  // Orden del escalonado, de arriba hacia abajo. Se incrementa en el mismo
  // orden en que se construye el JSX: título → (lead) → etapas/conectores →
  // leyenda. La evaluación de los hijos es de izquierda a derecha, así que el
  // contador refleja el orden visual real.
  let order = 0;

  return (
    <section
      ref={ref}
      aria-labelledby={titleId}
      className="rounded-xl border border-white/10 bg-surface-2 p-3.5 shadow-soft"
    >
      <h3
        id={titleId}
        {...revealAttrs(
          'font-display text-[15px] font-semibold tracking-tight text-neutral-100',
          animate,
          visible,
          order++
        )}
      >
        {block.title}
      </h3>
      {block.lead ? (
        <p
          {...revealAttrs(
            'mt-1 text-[13px] leading-relaxed text-neutral-400',
            animate,
            visible,
            order++
          )}
        >
          {block.lead}
        </p>
      ) : null}

      <div className="mt-3">
        {groups.map((group, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <div {...revealAttrs('', animate, visible, order++)}>
                <Connector />
              </div>
            ) : null}
            <div {...revealAttrs('', animate, visible, order++)}>
              <GroupView group={group} />
            </div>
          </Fragment>
        ))}
      </div>

      <p
        {...revealAttrs(
          'mt-3 text-sm leading-relaxed text-neutral-300',
          animate,
          visible,
          order++
        )}
      >
        {block.caption}
      </p>
    </section>
  );
}

function GroupView({ group }: { group: ImageGroup }): JSX.Element {
  if (group.kind === 'tiles') {
    return (
      <div className="flex flex-wrap justify-center gap-2.5">
        {group.images.map((image) => (
          <TileFigure key={image.src} image={image} inRow />
        ))}
      </div>
    );
  }
  if (group.kind === 'pair') {
    // Par comparativo: 2 columnas que colapsan a 1 bajo ~360px.
    return (
      <div className="grid grid-cols-2 gap-2.5 max-[360px]:grid-cols-1">
        {group.images.map((image) => (
          <AppFigure key={image.src} image={image} />
        ))}
      </div>
    );
  }
  return <SingleFigure image={group.image} />;
}

function SingleFigure({ image }: { image: InstructionImage }): JSX.Element {
  switch (image.kind) {
    case 'board':
      return <BoardFigure image={image} />;
    case 'result':
      return <ResultFigure image={image} />;
    case 'tile':
      return <TileFigure image={image} />;
    case 'app':
    default:
      return <AppFigure image={image} />;
  }
}

// Conector entre etapas: chevron hacia abajo sobre una línea-espina vertical.
// La espina hace legible el "y esto se convierte en → esto" entre las etapas
// apiladas (foto → app → resultado); el badge, elevado en surface-3, se lee
// como el eslabón. Puramente decorativo (aria-hidden) y estático (nada que
// degradar bajo reduced-motion).
function Connector(): JSX.Element {
  return (
    <div className="relative flex justify-center py-2" aria-hidden>
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10" />
      <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-neutral-300 shadow-soft ring-1 ring-white/10">
        <svg width={16} height={16} viewBox="0 0 24 24">
          <path
            d="M6 9 L12 15 L18 9"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}

// Micro-leyenda bajo una imagen concreta.
function MicroCaption({ text }: { text?: string }): JSX.Element | null {
  if (!text) return null;
  return (
    <figcaption className="mt-1.5 text-center text-[11px] leading-snug text-neutral-400">
      {text}
    </figcaption>
  );
}

// Imagen base con hueco reservado (aspect-ratio) y placeholder mientras carga.
function ReservedImage({
  image,
  className,
  imgClassName = 'object-cover',
}: {
  image: InstructionImage;
  className?: string;
  imgClassName?: string;
}): JSX.Element {
  const { w, h } = dimsFor(image.src);
  return (
    <div
      className={
        'overflow-hidden bg-surface-2 ' + (className ? className : 'rounded-lg')
      }
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      <img
        src={image.src}
        alt={image.alt}
        width={w}
        height={h}
        loading="lazy"
        decoding="async"
        className={'h-full w-full ' + imgClassName}
      />
    </div>
  );
}

// Foto del tablero físico (vertical ~3:4). Se limita el ancho para que no
// domine la columna; queda centrada como una foto.
function BoardFigure({ image }: { image: InstructionImage }): JSX.Element {
  return (
    <figure className="mx-auto w-full max-w-[13rem]">
      <ReservedImage
        image={image}
        className="rounded-xl shadow-[0_8px_20px_-8px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
      />
      <MicroCaption text={image.caption} />
    </figure>
  );
}

// Captura de la app (pantalla intermedia). No se recorta la UI. `className`
// controla el ancho del marco: por defecto el de las etapas de bloque
// (`max-w-[17rem]`); las capturas sueltas de sección lo acotan un poco más para
// que no dominen la lectura.
function AppFigure({
  image,
  className = 'mx-auto w-full max-w-[17rem]',
}: {
  image: InstructionImage;
  className?: string;
}): JSX.Element {
  return (
    <figure className={className}>
      <ReservedImage
        image={image}
        className="rounded-lg ring-1 ring-white/10"
        imgClassName="object-contain"
      />
      <MicroCaption text={image.caption} />
    </figure>
  );
}

// Tarjeta "Resultado": realce emerald sutil. Las capturas de resultado son
// anchas y bajas, así que ocupan todo el ancho disponible.
function ResultFigure({ image }: { image: InstructionImage }): JSX.Element {
  return (
    <figure className="w-full">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-2">
        <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          <svg width={11} height={11} viewBox="0 0 24 24" aria-hidden>
            <path
              d="M5 12.5 L10 17.5 L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Resultado
        </span>
        <ReservedImage
          image={image}
          className="rounded-md ring-1 ring-white/10"
          imgClassName="object-contain"
        />
      </div>
      <MicroCaption text={image.caption} />
    </figure>
  );
}

// Ficha (cuadrada ~404x410). Pequeña: en fila cuando son alternativas, o
// centrada y chica cuando es una etapa suelta.
function TileFigure({
  image,
  inRow = false,
}: {
  image: InstructionImage;
  inRow?: boolean;
}): JSX.Element {
  return (
    <figure
      className={
        inRow
          ? 'w-[28%] min-w-[84px] max-w-[110px]'
          : 'mx-auto w-full max-w-[7.5rem]'
      }
    >
      <ReservedImage
        image={image}
        className="rounded-lg ring-1 ring-white/10"
        imgClassName="object-contain"
      />
      <MicroCaption text={image.caption} />
    </figure>
  );
}
