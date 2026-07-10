import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { Building, Hex, PlayerColor, PortType, RESOURCES, Resource } from '../types';
import { RESOURCE_NAMES, RESOURCE_NAMES_LOWER } from '../lib/spanish';
import { ResourceIcon } from './ResourceIcon';
import { ColorChip } from './ColorChip';
import { PortPickerSheet, PORT_SHORT } from './PortPickerSheet';
import { BuildingGlyph } from '../assets/icons';
import { useModalA11y } from '../lib/useModalA11y';
import { safeVibrate } from '../lib/motion';

// Genera un id de ficha física. No hay nanoid en el cliente; crypto.randomUUID
// existe en navegadores modernos sobre HTTPS/localhost, con respaldo simple.
export function newHexId(): string {
  return crypto.randomUUID?.() ?? String(Date.now()) + Math.random();
}

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
  // Índice de la card cuyo puerto se está editando (bottom-sheet), o null.
  const [portSheet, setPortSheet] = useState<0 | 1 | null>(null);
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

  // Modo sin-recursos (brief §2): cuando el anfitrión apaga el reparto inicial,
  // cada jugador empieza con sus 2 poblados colocados pero NO recibe cartas.
  // El copy no debe prometer "1 carta por ficha" en ese caso.
  const seedOn = !!view?.state.seedInitialResources;

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

  // Caballeros y Ciudades (BUG #2): en C&K cada jugador empieza con 1 poblado +
  // 1 ciudad (el server sube automáticamente el 2º registro a ciudad al iniciar
  // la partida). Por eso, en C&K, la 1ª card es el POBLADO de salida y la 2ª la
  // CIUDAD de salida. En base, ambas son poblados idénticos ("Poblado 1/2").
  const citiesKnights = !!view.state.citiesKnights;

  // Rótulo, tipo de construcción (para el ícono) y sustantivo de cada card,
  // según su índice y el modo de la partida.
  function cardMeta(idx: 0 | 1): {
    label: string;
    type: 'settlement' | 'city';
    noun: string;
  } {
    if (citiesKnights) {
      return idx === 0
        ? { label: 'Poblado de salida', type: 'settlement', noun: 'poblado' }
        : { label: 'Ciudad de salida', type: 'city', noun: 'ciudad' };
    }
    return { label: `Poblado ${idx + 1}`, type: 'settlement', noun: 'poblado' };
  }

  // Texto del estado "Te falta: …" por card (lee distinto en C&K).
  function missingLabel(idx: 0 | 1): string {
    if (citiesKnights) {
      return idx === 0
        ? 'fichas de tu poblado de salida'
        : 'fichas de tu ciudad de salida';
    }
    return `fichas del Poblado ${idx + 1}`;
  }

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
    resource: Resource,
    hexId: string
  ): void {
    const next = builds.map((b, i) => {
      if (i !== buildIdx) return b;
      if (spotIdx === null) {
        return { ...b, spots: [...b.spots, { number, resource, hexId }] };
      }
      return {
        ...b,
        spots: b.spots.map((s, j) =>
          j === spotIdx ? { number, resource, hexId } : s
        ),
      };
    });
    commit(next);
    setPopKey(
      `${buildIdx}-${spotIdx === null ? next[buildIdx].spots.length - 1 : spotIdx}-${Date.now()}`
    );
    setSheet(null);
  }

  // Asigna (o quita) el puerto de una card de salida. Un poblado/ciudad con
  // puerto toca máximo 2 fichas, así que al asignar uno recortamos la 3ª ficha
  // si existía y avisamos. Quitar el puerto (port = null) reabre la 3ª ficha
  // sin tocar las que ya haya. El server deriva player.ports desde estos
  // edificios (`player:setBuildings`); NO se sincroniza aparte.
  function confirmPort(buildIdx: 0 | 1, port: PortType | null): void {
    let trimmed = false;
    const next = builds.map((b, i) => {
      if (i !== buildIdx) return b;
      const newB: Building = { ...b, port: port ?? undefined };
      if (port && newB.spots.length > 2) {
        newB.spots = newB.spots.slice(0, 2);
        trimmed = true;
      }
      return newB;
    });
    commit(next);
    if (trimmed) {
      pushToast(
        'info',
        `Tu ${cardMeta(buildIdx).noun} con puerto toca máximo 2 fichas. Quitamos la última que registraste.`
      );
    }
    setPortSheet(null);
  }

  const localComplete = builds.every((b) => b.spots.length >= 1);
  const missing = builds
    .map((b, i) => (b.spots.length === 0 ? missingLabel(i as 0 | 1) : null))
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
          {citiesKnights ? 'Tu poblado y tu ciudad de salida' : 'Tus poblados de salida'}
        </h2>
        {serverComplete ? (
          <span aria-hidden>
            <CheckIcon size={18} animated />
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-neutral-400">
        {seedOn ? (
          citiesKnights ? (
            <>
              Registra las fichas con número que tocan tu poblado y tu ciudad de
              salida. La 2ª colocación es una ciudad: produce 1 recurso por ficha
              y, además, 1 mercancía en cada bosque, pastura o montaña.
            </>
          ) : (
            <>
              Mira el tablero y registra las fichas con número que tocan tus 2
              poblados. Al iniciar recibes 1 carta por cada ficha registrada.
            </>
          )
        ) : citiesKnights ? (
          <>
            En este modo empiezas sin recursos: registrar las fichas de tu
            poblado y tu ciudad de salida es opcional y solo sirve para ver tu
            producción.
          </>
        ) : (
          <>
            En este modo empiezas sin recursos: registrar las fichas de tus 2
            poblados es opcional y solo sirve para ver tu producción.
          </>
        )}
      </p>

      <div className="mt-3 space-y-2.5">
        {builds.map((b, rawIdx) => {
          const idx = rawIdx as 0 | 1;
          const meta = cardMeta(idx);
          // Un poblado/ciudad con puerto toca máximo 2 fichas; sin puerto, 3.
          const maxSpots = b.port ? 2 : 3;
          return (
            <div
              key={b.id}
              className="rounded-xl border border-white/10 bg-neutral-900/50 p-2.5"
            >
              <div className="flex items-center gap-1.5">
                {citiesKnights ? (
                  <BuildingGlyph type={meta.type} size={20} />
                ) : null}
                <p className="text-xs font-semibold text-neutral-100">
                  {meta.label}
                </p>
              </div>

              {/* Puerto por construcción (mismo patrón que la Tabla de
                  construcción en partida). Si esta card tiene puerto solo
                  puede tocar 2 fichas. */}
              <button
                type="button"
                onClick={() => setPortSheet(idx)}
                aria-label={`Puerto de ${meta.label}: ${b.port ? PORT_SHORT[b.port] : 'sin puerto'}. Editar`}
                className={
                  'mt-1.5 flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors active:bg-white/[0.08] ' +
                  (b.port
                    ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                    : 'border-white/10 bg-surface-2 text-neutral-400')
                }
              >
                <span aria-hidden className="text-base leading-none">⚓</span>
                <span className="text-[11px] font-medium">
                  {b.port ? PORT_SHORT[b.port] : 'Sin puerto'}
                </span>
                <span className="ml-auto text-[10px] opacity-60">editar</span>
              </button>

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
              {b.spots.length < maxSpots ? (
                <button
                  type="button"
                  onClick={() => setSheet({ buildIdx: idx, spotIdx: null })}
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-white/12 bg-surface-2 px-3 py-2 text-xs font-medium text-neutral-100 transition-colors active:bg-white/10"
                >
                  + Agregar ficha
                  {b.port ? (
                    <span className="ml-1 text-[10px] text-neutral-400">
                      (máx. 2 con puerto)
                    </span>
                  ) : null}
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
          buildLabel={cardMeta(sheet.buildIdx).label}
          targetNoun={cardMeta(sheet.buildIdx).noun}
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
          initialHexId={
            sheet.spotIdx !== null
              ? builds[sheet.buildIdx].spots[sheet.spotIdx]?.hexId ?? null
              : null
          }
          existingHexes={view.state.hexes}
          players={view.state.players}
          onClose={() => setSheet(null)}
          onConfirm={(n, r, h) =>
            confirmSpot(sheet.buildIdx, sheet.spotIdx, n, r, h)
          }
        />
      ) : null}

      {portSheet !== null ? (
        <PortPickerSheet
          current={builds[portSheet]?.port ?? null}
          buildLabel={cardMeta(portSheet).label}
          onClose={() => setPortSheet(null)}
          onConfirm={(port) => confirmPort(portSheet, port)}
        />
      ) : null}
    </section>
  );
}

// Decisión de identidad de la ficha física (brief §5): agrupar con una ficha
// ya en juego (reusa su hexId) o crear una nueva.
type IdentityDecision =
  | { kind: 'existing'; hexId: string }
  | { kind: 'new' }
  | null;

// Bottom-sheet del picker de ficha: número (2–12 sin 7, el desierto no se
// registra) + recurso, ambos pasos visibles a la vez (sin wizard). Lo reusa
// la Tabla de construcción durante la partida.
//
// Brief §5: tras elegir número+recurso, si ya hay ≥1 ficha física en la mesa
// con ese mismo número+recurso, se revela un tercer bloque in-place para
// desambiguar (agrupar con una existente vs. crear una nueva). Sin colisión,
// cero fricción: se crea hexId nuevo y se confirma directo.
export function SpotPickerSheet({
  buildLabel,
  targetNoun = 'poblado',
  editing,
  initialNumber,
  initialResource,
  initialHexId = null,
  existingHexes,
  players,
  onClose,
  onConfirm,
}: {
  buildLabel: string;
  // Sustantivo de la construcción que recibe la ficha ("poblado" | "ciudad").
  // En C&K la 2ª colocación es una ciudad; en base siempre es un poblado.
  targetNoun?: string;
  editing: boolean;
  initialNumber: number | null;
  initialResource: Resource | null;
  initialHexId?: string | null;
  existingHexes: Hex[];
  players: { id: string; color: PlayerColor | null }[];
  onClose: () => void;
  onConfirm: (n: number, r: Resource, hexId: string) => void;
}): JSX.Element {
  const [number, setNumber] = useState<number | null>(initialNumber);
  const [resource, setResource] = useState<Resource | null>(initialResource);
  // Decisión de identidad: se reinicia cada vez que cambia número/recurso.
  const [decision, setDecision] = useState<IdentityDecision>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  // Fichas físicas ya en juego que coinciden en número+recurso (no desierto),
  // excluyendo la ficha que estoy editando (su propia identidad no es una
  // "coincidencia" con la que agrupar).
  const matches = useMemo<Hex[]>(() => {
    if (number === null || resource === null) return [];
    return existingHexes.filter(
      (h) =>
        h.number === number &&
        h.resource === resource &&
        (initialHexId == null || h.id !== initialHexId)
    );
  }, [existingHexes, number, resource, initialHexId]);

  // ¿Conservo la identidad actual? Solo al editar y si número+recurso no
  // cambiaron respecto al estado original de la ficha.
  const keepsOriginal =
    editing &&
    initialHexId != null &&
    number === initialNumber &&
    resource === initialResource;

  // El bloque de desambiguación se muestra cuando hay coincidencias y el
  // usuario no está simplemente conservando la ficha que ya tenía.
  const needsDecision =
    number !== null && resource !== null && matches.length > 0 && !keepsOriginal;

  const ready = number !== null && resource !== null;
  const decided = !needsDecision || decision !== null;

  // hexId con el que se confirmará, según la decisión / contexto.
  function resolveHexId(): string {
    if (needsDecision) {
      if (decision?.kind === 'existing') return decision.hexId;
      return newHexId(); // 'new' (o por seguridad si quedara null)
    }
    // Sin decisión: conservar identidad al editar, o crear nueva al agregar.
    if (keepsOriginal && initialHexId != null) return initialHexId;
    return newHexId();
  }

  const ctaLabel = !ready
    ? 'Elige número y recurso'
    : !decided
      ? 'Elige si es la misma ficha o una nueva'
      : editing
        ? 'Guardar cambios'
        : `Agregar ficha ${number} · ${RESOURCE_NAMES_LOWER[resource!]}`;

  // Etiqueta de dueños de una ficha coincidente, para reconocerla.
  function ownersLabel(h: Hex): JSX.Element {
    if (h.owners.length === 0) {
      return <span className="text-[10px] text-neutral-400">Sin poblados aún</span>;
    }
    return (
      <>
        {h.owners.map((o, k) => {
          const p = players.find((x) => x.id === o.playerId);
          return (
            <span
              key={`${o.playerId}-${k}`}
              className="inline-flex items-center gap-0.5 rounded bg-surface-3 px-1.5 py-0.5 text-[10px]"
            >
              <ColorChip color={p?.color ?? null} size={10} />
              <span className="font-medium uppercase">
                {o.type === 'city' ? 'C' : 'P'}
              </span>
            </span>
          );
        })}
      </>
    );
  }

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
              Ficha que toca tu {targetNoun}
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
                onClick={() => {
                  setNumber(n);
                  setDecision(null);
                }}
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
                onClick={() => {
                  setResource(r);
                  setDecision(null);
                }}
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

        {needsDecision ? (
          <div className="anim-slide-up mt-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.05] p-2.5">
            <p className="text-xs font-semibold text-amber-100">
              Ya hay una ficha{' '}
              <span className="nums">{number}</span>{' '}
              {RESOURCE_NAMES_LOWER[resource!]} en juego. ¿Es la misma?
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">
              Mira quién la toca para reconocerla, o crea una ficha nueva si es
              otra distinta del tablero.
            </p>
            <ul
              className="mt-2 space-y-1.5"
              role="radiogroup"
              aria-label="¿Es la misma ficha que ya está en juego, o una nueva?"
            >
              {matches.map((h) => {
                const isHot = h.number === 6 || h.number === 8;
                const selected =
                  decision?.kind === 'existing' && decision.hexId === h.id;
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Es la misma ficha ${number} ${RESOURCE_NAMES_LOWER[resource!]} que ya está en juego`}
                      onClick={() =>
                        setDecision({ kind: 'existing', hexId: h.id })
                      }
                      className={
                        'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors active:bg-white/[0.08] ' +
                        (selected
                          ? 'border-emerald-400 bg-emerald-500/15'
                          : 'border-white/10 bg-neutral-900/40')
                      }
                    >
                      <span
                        className={
                          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border ' +
                          (isHot
                            ? 'border-amber-400/80 bg-amber-500/20 text-amber-100'
                            : 'border-white/15 bg-surface-3 text-neutral-100')
                        }
                      >
                        <span
                          className={
                            'nums leading-none ' +
                            (isHot ? 'text-sm font-bold' : 'text-xs font-semibold')
                          }
                        >
                          {h.number}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[11px] font-medium text-neutral-200">
                          La tocan:
                        </span>
                        <span className="flex flex-wrap items-center gap-1">
                          {ownersLabel(h)}
                        </span>
                      </span>
                      {selected ? (
                        <CheckIcon size={16} />
                      ) : (
                        <span className="h-4 w-4 flex-shrink-0 rounded-full border border-white/20" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  role="radio"
                  aria-checked={decision?.kind === 'new'}
                  onClick={() => setDecision({ kind: 'new' })}
                  className={
                    'flex w-full items-center gap-2 rounded-lg border border-dashed px-2.5 py-2.5 text-left transition-colors active:bg-white/[0.08] ' +
                    (decision?.kind === 'new'
                      ? 'border-emerald-400 bg-emerald-500/15'
                      : 'border-white/20 bg-surface-2')
                  }
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-surface-3 text-neutral-100">
                    <span className="text-lg leading-none">+</span>
                  </span>
                  <span className="flex-1 text-xs font-medium text-neutral-100">
                    Es una ficha nueva (otra distinta en el tablero)
                  </span>
                  {decision?.kind === 'new' ? (
                    <CheckIcon size={16} />
                  ) : (
                    <span className="h-4 w-4 flex-shrink-0 rounded-full border border-white/20" aria-hidden />
                  )}
                </button>
              </li>
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!ready || !decided}
          onClick={() => {
            if (number !== null && resource !== null && decided) {
              onConfirm(number, resource, resolveHexId());
            }
          }}
          className={
            'mt-4 min-h-[52px] w-full rounded-xl px-3 py-2.5 text-sm font-bold tracking-tight transition-all active:scale-[0.99] ' +
            (ready && decided
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
