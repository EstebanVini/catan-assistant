import { useRef, useState } from 'react';
import { useStore } from '../store';
import { RESOURCES, Resource } from '../types';
import { RESOURCE_NAMES } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Modal del ACUEDUCTO (Ciencia nivel 3, Caballeros y Ciudades §2.4).
//
// Se abre automáticamente cuando `state.pendingAqueductPick` incluye a este
// jugador: al tirar el dado NO produjo ningún recurso, así que el Acueducto le
// concede tomar 1 recurso a su elección del banco. Es un BENEFICIO, no una
// penalización — el copy y el tono (verde de Ciencia) lo dejan claro.
//
// La elección resuelve un estado pendiente del servidor: un solo toque sobre un
// recurso lo reclama (emite `aqueduct:pick`) y el servidor retira al jugador de
// `pendingAqueductPick`, con lo que el modal se desmonta solo. Por eso NO hay
// cierre por ESC ni por backdrop (no-op onClose): no existe "cancelar" —
// renunciar al recurso dejaría el estado a medias. El foco queda atrapado.
//
// Mobile-first: bottom sheet en móvil, centrado en pantallas grandes; cada
// recurso es un botón de ≥80px de alto (área táctil ≥44px holgada).
export function AqueductPickModal(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const aqueductPick = useStore((s) => s.aqueductPick);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Sin onClose efectivo: la elección es obligatoria (resuelve el estado
  // pendiente). El hook sigue atrapando el foco sin permitir cerrar.
  useModalA11y(dialogRef, () => {
    /* no-op: elección obligatoria */
  });

  if (!view || !view.me) return null;
  const { state, me } = view;
  if (!state.citiesKnights) return null;
  if (!state.pendingAqueductPick?.includes(me.id)) return null;

  const bank = state.bank;

  function pick(resource: Resource) {
    if (submitting) return;
    setSubmitting(true);
    aqueductPick(resource);
    // El servidor retira al jugador de `pendingAqueductPick`; el modal se
    // desmonta solo en el próximo `state:update`. `submitting` evita doble
    // emisión si el toque se repite antes de que llegue la actualización.
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="aqueduct-title"
        aria-describedby="aqueduct-desc"
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-discipline-science/40 bg-surface-1 p-4 shadow-card ring-1 ring-discipline-science/10"
      >
        <div className="flex items-center gap-2">
          <AqueductGlyph size={22} />
          <h2
            id="aqueduct-title"
            className="text-[17px] font-semibold tracking-tight text-neutral-50"
          >
            Acueducto
          </h2>
        </div>
        <p
          id="aqueduct-desc"
          className="mt-1.5 text-sm leading-relaxed text-neutral-300"
        >
          No recibiste recursos al tirar. Toma{' '}
          <span className="font-semibold text-neutral-50">1 del banco</span> a tu
          elección.
        </p>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-discipline-science">
          Beneficio de Ciencia nivel 3.
        </p>

        <div
          className="mt-3 grid grid-cols-5 gap-1.5"
          role="group"
          aria-label="Recursos del banco"
        >
          {RESOURCES.map((r) => {
            const stock = bank?.[r] ?? 0;
            const tone = AQUEDUCT_TONE[r];
            return (
              <button
                key={r}
                type="button"
                disabled={submitting}
                onClick={() => pick(r)}
                aria-label={`Tomar ${RESOURCE_NAMES[r]} del banco. ${stock} en banco.`}
                className={
                  // Cada recurso lleva su tinte funcional (border + bg
                  // literales para la JIT de Tailwind). `active:scale-[0.97]`
                  // como tap feedback; alto ≥80px.
                  'flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-lg border-2 px-1 py-1.5 transition-colors duration-[180ms] ease-out ' +
                  (submitting
                    ? 'cursor-not-allowed border-white/[0.06] bg-surface-1 opacity-55'
                    : `${tone.border} ${tone.bg} active:scale-[0.97] active:bg-white/[0.08]`)
                }
              >
                <ResourceIcon resource={r} size={32} />
                <span className={'text-[11px] font-semibold ' + tone.label}>
                  {RESOURCE_NAMES[r]}
                </span>
                <span className="nums text-[9px] font-medium text-neutral-500">
                  {stock}
                </span>
              </button>
            );
          })}
        </div>

        <p
          className="mt-3 text-center text-[11px] font-medium text-neutral-400"
          aria-live="polite"
        >
          {submitting ? 'Tomando…' : 'Toca un recurso para reclamarlo.'}
        </p>
      </div>
    </div>
  );
}

// Tonos por recurso, replicados aquí para evitar re-importes. Clases LITERALES
// para que la JIT de Tailwind las detecte (mismo set que el selector de Año de
// la abundancia, para mantener un lenguaje visual coherente entre tomas del
// banco).
const AQUEDUCT_TONE: Record<
  Resource,
  { border: string; bg: string; label: string }
> = {
  brick:  { border: 'border-resource-brick',  bg: 'bg-resource-brick/[0.10]',  label: 'text-resource-brick' },
  lumber: { border: 'border-resource-lumber', bg: 'bg-resource-lumber/[0.12]', label: 'text-resource-lumber' },
  wool:   { border: 'border-resource-wool',   bg: 'bg-resource-wool/[0.10]',   label: 'text-resource-wool' },
  grain:  { border: 'border-resource-grain',  bg: 'bg-resource-grain/[0.12]',  label: 'text-resource-grain' },
  ore:    { border: 'border-resource-ore',    bg: 'bg-resource-ore/[0.18]',    label: 'text-neutral-100' },
};

// Glifo de acueducto (arquería romana) en verde de Ciencia. Decorativo: el
// título vecino lo nombra. SVG inline, sin arte nuevo (missing-icons.md).
function AqueductGlyph({ size = 22 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="flex-shrink-0"
    >
      {/* Cornisa superior por donde corre el agua. */}
      <rect
        x="2"
        y="5"
        width="20"
        height="2.4"
        rx="0.4"
        fill="#52a866"
        stroke="#1a130c"
        strokeWidth="0.7"
      />
      {/* Pilares de la arquería. */}
      <g fill="#52a866" stroke="#1a130c" strokeWidth="0.7">
        <rect x="3" y="7.4" width="2.2" height="12" />
        <rect x="10.9" y="7.4" width="2.2" height="12" />
        <rect x="18.8" y="7.4" width="2.2" height="12" />
      </g>
      {/* Arcos entre pilares. */}
      <g fill="none" stroke="#1a130c" strokeWidth="1" opacity="0.55">
        <path d="M5.2 19.4 V14 A2.85 2.85 0 0 1 10.9 14 V19.4" />
        <path d="M13.1 19.4 V14 A2.85 2.85 0 0 1 18.8 14 V19.4" />
      </g>
      {/* Hilo de agua sobre la cornisa. */}
      <path
        d="M3 4.2 H21"
        stroke="#7fc594"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
