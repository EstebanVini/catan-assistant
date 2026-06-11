import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Building, RESOURCES, Resource } from '../types';
import { RESOURCE_NAMES, RESOURCE_NAMES_LOWER } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { useModalA11y } from '../lib/useModalA11y';
import { safeVibrate } from '../lib/motion';

// Registro de construcciones iniciales en el Lobby (Fase 3, brief §3).
//
// Decisiones estructurales (ya tomadas por el ux-architect):
//  - Dos cards FIJAS (la regla es exactamente 2 poblados; sin grados de
//    libertad inexistentes).
//  - TODOS los poblados reparten recursos al iniciar (1 carta por ficha
//    tocada), así que ya no se marca cuál es "el 2º poblado".
//  - El picker omite el 7 (y el desierto) en lugar de deshabilitarlos.
//  - Autosave: cada mutación emite `player:setBuildings` completo — el server
//    acepta estados parciales (0–3 fichas) y marca `setupComplete` solo
//    cuando ambos poblados tienen 1–3 fichas. El progreso "N/M listos" deriva
//    SIEMPRE del estado del servidor (`setupComplete`).
//  - `type: 'city'` existe en el modelo pero esta UI no lo expone (durante la
//    partida la Tabla de construcción sí maneja ciudades).

const PICKER_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

function defaultBuilds(): Building[] {
  return [
    { id: 'b1', type: 'settlement', spots: [] },
    { id: 'b2', type: 'settlement', spots: [] },
  ];
}

type SheetState = {
  buildIdx: 0 | 1;
  // null = agregar nueva ficha; número = índice de la ficha en edición.
  spotIdx: number | null;
};

export function InitialBuildSetup(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const setBuildings = useStore((s) => s.setBuildings);
  const pushToast = useStore((s) => s.pushToast);

  const [builds, setBuilds] = useState<Building[]>(() => {
    const server = useStore.getState().view?.me?.buildings;
    return server && server.length === 2 ? server : defaultBuilds();
  });
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // Pop sutil del chip recién agregado/editado.
  const [popKey, setPopKey] = useState<string | null>(null);

  // Guard de hidratación: no adoptar el eco del servidor encima de una
  // mutación local reciente (autosave en vuelo).
  const lastMutationAtRef = useRef(0);
  // Reintento automático al reconectar (brief §3, estados).
  const pendingEmitRef = useRef<Building[] | null>(null);

  const me = view?.me ?? null;
  const myPublic =
    view?.state.players.find((p) => p.id === me?.id) ?? null;
  const serverComplete = !!myPublic?.setupComplete;

  // Hidratar desde el servidor (reconexión / primer state:update).
  const serverSerialized = JSON.stringify(me?.buildings ?? null);
  useEffect(() => {
    const server = me?.buildings;
    if (!server || server.length !== 2) return;
    if (Date.now() - lastMutationAtRef.current < 1500) return;
    setBuilds((local) =>
      JSON.stringify(local) === JSON.stringify(server) ? local : server
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSerialized]);

  // Vibración corta + tick animado al COMPLETAR el registro (transición del
  // estado del servidor, no del local).
  const prevCompleteRef = useRef(serverComplete);
  useEffect(() => {
    if (serverComplete && !prevCompleteRef.current) {
      safeVibrate(50);
    }
    prevCompleteRef.current = serverComplete;
  }, [serverComplete]);

  // Reintento del autosave pendiente al reconectar.
  useEffect(() => {
    if (connectionStatus === 'connected' && pendingEmitRef.current) {
      const pending = pendingEmitRef.current;
      pendingEmitRef.current = null;
      setBuildings(pending);
    }
  }, [connectionStatus, setBuildings]);

  if (!view || !me) return null;

  function commit(next: Building[]): void {
    lastMutationAtRef.current = Date.now();
    setBuilds(next);
    // El server acepta estados parciales (0–3 fichas): se sincroniza siempre,
    // así el contador "N/M listos" del anfitrión baja si alguien vacía una card.
    if (connectionStatus !== 'connected') {
      pendingEmitRef.current = next;
      pushToast('info', 'Sin conexión. Se guardará al reconectar.');
      return;
    }
    setBuildings(next);
  }

  function removeSpot(buildIdx: 0 | 1, spotIdx: number): void {
    const next = builds.map((b, i) =>
      i === buildIdx
        ? { ...b, spots: b.spots.filter((_, j) => j !== spotIdx) }
        : b
    );
    commit(next);
  }

  function confirmSpot(
    buildIdx: 0 | 1,
    spotIdx: number | null,
    number: number,
    resource: Resource
  ): void {
    const next = builds.map((b, i) => {
      if (i !== buildIdx) return b;
      if (spotIdx === null) {
        return { ...b, spots: [...b.spots, { number, resource }] };
      }
      return {
        ...b,
        spots: b.spots.map((s, j) =>
          j === spotIdx ? { number, resource } : s
        ),
      };
    });
    commit(next);
    setPopKey(
      `${buildIdx}-${spotIdx === null ? next[buildIdx].spots.length - 1 : spotIdx}-${Date.now()}`
    );
    setSheet(null);
  }

  const localComplete = builds.every((b) => b.spots.length >= 1);
  const missing = builds
    .map((b, i) => (b.spots.length === 0 ? `fichas del Poblado ${i + 1}` : null))
    .filter((m): m is string => m !== null);

  return (
    <section
      id="initial-build-setup"
      className={
        'mx-4 mt-4 rounded-2xl border p-3 shadow-soft transition-colors ' +
        (serverComplete
          ? 'border-white/10 bg-surface-1'
          : 'border-amber-500/40 bg-amber-500/[0.03]')
      }
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
          Tus poblados de salida
        </h2>
        {serverComplete ? (
          <span aria-hidden>
            <CheckIcon size={18} animated />
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-neutral-400">
        Mira el tablero y registra las fichas con número que tocan tus 2
        poblados. Al iniciar recibes 1 carta por cada ficha registrada.
      </p>

      <div className="mt-3 space-y-2.5">
        {builds.map((b, rawIdx) => {
          const idx = rawIdx as 0 | 1;
          return (
            <div
              key={b.id}
              className="rounded-xl border border-white/10 bg-neutral-900/50 p-2.5"
            >
              <p className="text-xs font-semibold text-neutral-100">
                Poblado {idx + 1}
              </p>
              {b.spots.length === 0 ? (
                <p className="mt-1.5 rounded-md border border-dashed border-white/15 px-2.5 py-2.5 text-center text-[11px] text-neutral-400">
                  Sin fichas todavía
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {b.spots.map((s, j) => {
                    const hot = s.number === 6 || s.number === 8;
                    const isPopped =
                      popKey !== null && popKey.startsWith(`${idx}-${j}-`);
                    return (
                      <span
                        key={`${j}-${s.number}-${s.resource}` + (isPopped ? popKey : '')}
                        className={
                          'inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-white/15 bg-surface-2 pr-1 ' +
                          (isPopped ? 'anim-pulse-scale' : '')
                        }
                      >
                        <button
                          type="button"
                          onClick={() => setSheet({ buildIdx: idx, spotIdx: j })}
                          aria-label={`Editar ficha ${s.number} ${RESOURCE_NAMES_LOWER[s.resource]}`}
                          className="flex min-h-[44px] items-center gap-1.5 rounded-l-lg pl-1.5 pr-0.5 transition-colors active:bg-white/[0.08]"
                        >
                          <span
                            className={
                              'relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border ' +
                              (hot
                                ? 'border-amber-400/80 bg-amber-500/20 text-amber-100'
                                : 'border-white/15 bg-surface-3 text-neutral-100')
                            }
                          >
                            <span className={'nums leading-none ' + (hot ? 'text-sm font-bold' : 'text-xs font-semibold')}>
                              {s.number}
                            </span>
                            {hot ? (
                              <span
                                className="absolute bottom-[3px] h-1 w-1 rounded-full bg-red-500"
                                aria-hidden
                              />
                            ) : null}
                          </span>
                          <ResourceIcon resource={s.resource} size={24} />
                          <span className="text-xs text-neutral-100">
                            {RESOURCE_NAMES_LOWER[s.resource]}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSpot(idx, j)}
                          aria-label={`Quitar ficha ${s.number} ${RESOURCE_NAMES_LOWER[s.resource]}`}
                          className="flex h-11 w-11 items-center justify-center rounded-r-lg text-neutral-400 transition-colors active:bg-white/[0.08] active:text-neutral-100"
                        >
                          <svg width={12} height={12} viewBox="0 0 24 24" aria-hidden>
                            <path
                              d="M6 6 L18 18 M18 6 L6 18"
                              stroke="currentColor"
                              strokeWidth={2.4}
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {b.spots.length < 3 ? (
                <button
                  type="button"
                  onClick={() => setSheet({ buildIdx: idx, spotIdx: null })}
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-white/12 bg-surface-2 px-3 py-2 text-xs font-medium text-neutral-100 transition-colors active:bg-white/10"
                >
                  + Agregar ficha
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <p
        className={
          'mt-2.5 flex items-center gap-1.5 text-[11px] font-medium ' +
          (serverComplete ? 'text-emerald-300' : 'text-amber-300')
        }
        role="status"
      >
        {serverComplete ? (
          <>
            <CheckIcon size={13} animated />
            Registro completo
          </>
        ) : localComplete ? (
          'Guardando registro…'
        ) : (
          `Te falta: ${missing.join(' y ')}`
        )}
      </p>

      {sheet ? (
        <SpotPickerSheet
          key={`${sheet.buildIdx}-${sheet.spotIdx ?? 'new'}`}
          buildLabel={`Poblado ${sheet.buildIdx + 1}`}
          editing={sheet.spotIdx !== null}
          initialNumber={
            sheet.spotIdx !== null
              ? builds[sheet.buildIdx].spots[sheet.spotIdx]?.number ?? null
              : null
          }
          initialResource={
            sheet.spotIdx !== null
              ? builds[sheet.buildIdx].spots[sheet.spotIdx]?.resource ?? null
              : null
          }
          onClose={() => setSheet(null)}
          onConfirm={(n, r) => confirmSpot(sheet.buildIdx, sheet.spotIdx, n, r)}
        />
      ) : null}
    </section>
  );
}

// Bottom-sheet del picker de ficha: número (2–12 sin 7, el desierto no se
// registra) + recurso, ambos pasos visibles a la vez (sin wizard). Lo reusa
// la Tabla de construcción durante la partida.
export function SpotPickerSheet({
  buildLabel,
  editing,
  initialNumber,
  initialResource,
  onClose,
  onConfirm,
}: {
  buildLabel: string;
  editing: boolean;
  initialNumber: number | null;
  initialResource: Resource | null;
  onClose: () => void;
  onConfirm: (n: number, r: Resource) => void;
}): JSX.Element {
  const [number, setNumber] = useState<number | null>(initialNumber);
  const [resource, setResource] = useState<Resource | null>(initialResource);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  const ready = number !== null && resource !== null;
  const ctaLabel = !ready
    ? 'Elige número y recurso'
    : editing
      ? 'Guardar cambios'
      : `Agregar ficha ${number} · ${RESOURCE_NAMES_LOWER[resource]}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spot-picker-title"
        onClick={(e) => e.stopPropagation()}
        className="anim-slide-up w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3
              id="spot-picker-title"
              className="text-base font-semibold tracking-tight text-neutral-50"
            >
              Ficha que toca tu poblado
            </h3>
            <p className="mt-0.5 text-[11px] text-neutral-400">
              {buildLabel} · El desierto y el mar no se registran.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-surface-3 text-neutral-300 transition-colors active:bg-white/10"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
          Número
        </p>
        <div className="mt-1.5 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Número de la ficha">
          {PICKER_NUMBERS.map((n) => {
            const hot = n === 6 || n === 8;
            const selected = number === n;
            const dimOthers = number !== null && !selected;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setNumber(n)}
                className={
                  'relative flex h-14 w-full flex-col items-center justify-center rounded-lg border transition-all active:scale-[0.97] ' +
                  (selected
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-50 shadow-soft'
                    : 'border-white/10 bg-surface-2 text-neutral-100') +
                  (dimOthers ? ' opacity-60' : '')
                }
              >
                <span
                  className={
                    'nums leading-none ' +
                    (hot ? 'text-lg font-bold text-red-300' : 'text-base font-semibold')
                  }
                >
                  {n}
                </span>
                {hot ? (
                  <span
                    className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
          Recurso
        </p>
        <div className="mt-1.5 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Recurso de la ficha">
          {RESOURCES.map((r) => {
            const selected = resource === r;
            const dimOthers = resource !== null && !selected;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setResource(r)}
                className={
                  'flex h-16 w-full flex-col items-center justify-center gap-1 rounded-lg border transition-all active:scale-[0.97] ' +
                  (selected
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-50 shadow-soft'
                    : 'border-white/10 bg-surface-2 text-neutral-100') +
                  (dimOthers ? ' opacity-60' : '')
                }
              >
                <ResourceIcon resource={r} size={34} />
                <span className="text-[10px] leading-none">
                  {RESOURCE_NAMES[r]}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            if (number !== null && resource !== null) onConfirm(number, resource);
          }}
          className={
            'mt-4 min-h-[52px] w-full rounded-xl px-3 py-2.5 text-sm font-bold tracking-tight transition-all active:scale-[0.99] ' +
            (ready
              ? 'bg-emerald-500 text-neutral-950 shadow-cta active:bg-emerald-400'
              : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-400')
          }
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

// `animated`: pop con micro-rebote del badge + tick que se dibuja con
// stroke-dashoffset (clases anim-check-* en index.css; en reduced-motion cae
// a un fade corto con el tick ya dibujado). Úsalo solo cuando el check
// confirma algo que ACABA de pasar; los checks estáticos (listas, badges
// persistentes) lo omiten.
export function CheckIcon({
  size = 16,
  animated = false,
}: {
  size?: number;
  animated?: boolean;
}): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={animated ? 'anim-check-pop' : undefined}
    >
      <circle cx="12" cy="12" r="10" fill="#10b981" />
      <path
        d="M7.5 12.5 L10.5 15.5 L16.5 9"
        fill="none"
        stroke="#0f1115"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? 'anim-check-draw' : undefined}
      />
    </svg>
  );
}
