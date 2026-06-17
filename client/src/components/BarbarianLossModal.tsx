import { useRef } from 'react';
import { useStore } from '../store';
import { Building } from '../types';
import { RESOURCE_NAMES_LOWER } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';

// Modal forzado de RESOLUCIÓN DEL ATAQUE BÁRBARO (Caballeros y Ciudades, §2.7).
//
// Se abre automáticamente cuando `state.pendingBarbarianLoss` incluye a este
// jugador: los bárbaros saquearon (la defensa de la isla no alcanzó) y el
// jugador menos defendido debe DEGRADAR una de sus ciudades a poblado.
//
// El combate ya lo resolvió el servidor; aquí solo elegimos qué ciudad pierde
// rango. Es OBLIGATORIO: no se cierra con ESC ni con backdrop tap. El servidor
// valida que el jugador esté en `pendingBarbarianLoss` y que no degrade una
// metrópolis (no sabemos cuál de las ciudades públicas es la metrópolis, así
// que el copy advierte que esas no se pueden perder; el server rechaza el
// intento si se elige una metrópolis).
//
// Estética de saqueo SOBRIA (carmesí/acero), coherente con `BarbarianTrack`.
// Mobile-first: bottom sheet en móvil, centrado en pantallas grandes; áreas
// táctiles ≥44px.
export function BarbarianLossModal(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const downgradeCity = useStore((s) => s.downgradeCity);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Sin onClose efectivo: la degradación es obligatoria. Pasamos un no-op para
  // que el hook siga atrapando el foco sin permitir cerrar.
  useModalA11y(dialogRef, () => {
    /* no-op: degradación obligatoria */
  });

  if (!view || !view.me) return null;
  const { state, me } = view;
  if (!state.citiesKnights) return null;
  if (!state.pendingBarbarianLoss.includes(me.id)) return null;

  const cities: Building[] = (me.buildings ?? []).filter(
    (b) => b.type === 'city'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="barbarian-loss-title"
        aria-describedby="barbarian-loss-desc"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ck-crimson/50 bg-neutral-900 p-4 shadow-2xl ring-1 ring-ck-crimson/10"
      >
        <div className="flex items-center gap-2">
          <SackGlyph size={22} />
          <h2
            id="barbarian-loss-title"
            className="text-lg font-bold tracking-tight text-red-200"
          >
            Saqueo bárbaro
          </h2>
        </div>
        <p
          id="barbarian-loss-desc"
          className="mt-1.5 text-sm leading-relaxed text-neutral-300"
        >
          La defensa de la isla no alcanzó y los bárbaros desembarcaron. Eras de
          los menos defendidos: debes{' '}
          <span className="font-semibold text-neutral-50">
            degradar una de tus ciudades a poblado
          </span>
          .
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-400">
          Tus metrópolis no se pueden perder: si eliges una, no se aplicará.
          Selecciona una ciudad ordinaria.
        </p>

        {cities.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-sm text-neutral-400">
            No tienes ciudades registradas en tu tabla de construcción. Registra
            tus ciudades para poder degradar una.
          </div>
        ) : (
          <ul className="mt-3 space-y-2" aria-label="Tus ciudades">
            {cities.map((city, idx) => (
              <li
                key={city.id}
                className="rounded-xl border border-white/12 bg-neutral-950 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
                    <CityGlyph size={18} />
                    Ciudad {idx + 1}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {city.spots.length === 0
                      ? 'Sin fichas'
                      : `${city.spots.length} ${
                          city.spots.length === 1 ? 'ficha' : 'fichas'
                        }`}
                    {city.port ? ' · con puerto' : ''}
                  </span>
                </div>

                {city.spots.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {city.spots.map((s, j) => {
                      const hot = s.number === 6 || s.number === 8;
                      return (
                        <span
                          key={`${city.id}-${j}-${s.number}-${s.resource}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-surface-2 py-1 pl-1 pr-2"
                          aria-label={`Ficha ${s.number} de ${RESOURCE_NAMES_LOWER[s.resource]}`}
                        >
                          <span
                            className={
                              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border ' +
                              (hot
                                ? 'border-amber-400/80 bg-amber-500/20 text-amber-100'
                                : 'border-white/15 bg-surface-3 text-neutral-100')
                            }
                          >
                            <span
                              className={
                                'nums leading-none ' +
                                (hot
                                  ? 'text-sm font-bold'
                                  : 'text-xs font-semibold')
                              }
                            >
                              {s.number}
                            </span>
                          </span>
                          <ResourceIcon resource={s.resource} size={20} />
                          <span className="text-xs text-neutral-200">
                            {RESOURCE_NAMES_LOWER[s.resource]}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-neutral-500">
                    Esta ciudad no tiene fichas registradas.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => downgradeCity(city.id)}
                  className="mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-ck-crimson/50 bg-ck-crimson/15 px-3 py-2 text-sm font-bold text-red-200 transition-colors active:bg-ck-crimson/25"
                >
                  Degradar esta ciudad
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Glifo de saco de saqueo (carmesí/acero): atado arriba, abultado abajo.
// Decorativo: el texto vecino lo nombra.
function SackGlyph({ size = 20 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="flex-shrink-0"
    >
      <path
        d="M9 4 H15 L14 7 C 17.5 8.5, 19 12.5, 19 15.5 C 19 19, 16 21, 12 21 C 8 21, 5 19, 5 15.5 C 5 12.5, 6.5 8.5, 10 7 Z"
        fill="#7a322d"
        stroke="#1a130c"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M9 4 H15"
        stroke="#1a130c"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.5 7 H15.5"
        stroke="#bf4a40"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Glifo de ciudad (torre con almenas) en acero, para identificar cada ciudad.
// Decorativo: el texto vecino la nombra.
function CityGlyph({ size = 18 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="flex-shrink-0"
    >
      <path
        d="M4 21 V12 L8 12 V9 L12 6 L16 9 V12 H20 V21 Z"
        fill="#8b919b"
        stroke="#1a130c"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <rect x="7" y="15" width="2.4" height="3.2" fill="#1a130c" opacity="0.55" />
      <rect x="14.6" y="15" width="2.4" height="3.2" fill="#1a130c" opacity="0.55" />
    </svg>
  );
}
