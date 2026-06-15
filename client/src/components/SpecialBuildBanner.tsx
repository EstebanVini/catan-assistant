import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { ColorChip } from './ColorChip';
import { playerHex } from '../lib/playerColors';
import { safeVibrate } from '../lib/motion';
import type { PlayerColor } from '../types';

// Banner + cola visual + control "Saltar" para fase de Construcción Especial
// (brief Fase 2 §4.2-§4.5).
//
// Reglas clave:
//  - Sólo se renderiza si `phase === 'specialBuild'`.
//  - "Saltar a X" sólo visible para host o bank manager.
//  - "Saltar" aparece tras 30 s ininterrumpidos del mismo jugador #0, o
//    inmediatamente si el jugador #0 está desconectado.
//  - Confirmación inline (no modal pesado) para no presionar al usuario.

const SKIP_DELAY_MS = 30_000;

export function SpecialBuildBanner(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const specialBuildSkip = useStore((s) => s.specialBuildSkip);
  const [now, setNow] = useState(() => Date.now());
  const [confirmSkip, setConfirmSkip] = useState(false);
  // Timestamp en el que el jugador #0 actual tomó turno (cliente local).
  // Cambia cuando cambia el id de la cabeza de la cola.
  const queueHeadRef = useRef<{ id: string | null; since: number }>({
    id: null,
    since: Date.now(),
  });
  // `headPulseKey` se incrementa al cambiar la cabeza de la cola. Sirve para
  // remountar el QueueItem #0 y disparar un `anim-pulse-scale` único cuando
  // la cola avanza (brief Fase 2 §9).
  const [headPulseKey, setHeadPulseKey] = useState(0);
  const myIdRef = useRef<string | null>(null);
  const lastHeadIdRef = useRef<string | null>(null);

  // Refresca `now` cada 5 s para evaluar el umbral de 30 s.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(t);
  }, []);

  const headId =
    view && view.state.phase === 'specialBuild'
      ? (view.state.specialBuildQueue[0] ?? null)
      : null;

  // Reset del timestamp local cuando cambia el head, y cierre de la
  // confirmación pendiente. En useEffect para no mutar estado durante render.
  // Además: dispara `headPulseKey` (pulso visual del nuevo head) y vibración
  // corta (80 ms) si el nuevo head soy yo, una sola vez por cambio.
  useEffect(() => {
    if (queueHeadRef.current.id !== headId) {
      const prevHeadId = queueHeadRef.current.id;
      queueHeadRef.current = { id: headId, since: Date.now() };
      setConfirmSkip(false);
      // Sólo pulsar si ya había un head anterior distinto: en la primera
      // entrada a `specialBuild` el banner ya tiene su propia entrada.
      if (prevHeadId !== null && headId !== null && prevHeadId !== headId) {
        setHeadPulseKey((k) => k + 1);
      }
      lastHeadIdRef.current = headId;
      // Vibración si me convertí en el nuevo head (no dispara en el primer
      // render del banner cuando aún no había head registrado).
      if (
        prevHeadId !== null &&
        headId !== null &&
        myIdRef.current === headId
      ) {
        safeVibrate(80);
      }
    }
  }, [headId]);

  if (!view || !view.me) return null;
  const { state, me } = view;
  myIdRef.current = me.id;
  if (state.phase !== 'specialBuild') return null;

  const queue = state.specialBuildQueue
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  if (queue.length === 0) return null;

  const head = queue[0];
  const isMyTurn = head.id === me.id;
  const canSkip = me.id === state.hostId || me.id === state.bankManagerId;

  // Recordatorio pasivo: si compré un poblado aquí y aún no registro sus fichas,
  // no podré pasar (el aviso fuerte vive junto a "Listo, paso" en ActionGrid).
  const hasPendingRegistration =
    isMyTurn && (me.pendingSettlementRegistration?.length ?? 0) > 0;

  const elapsedHead = now - queueHeadRef.current.since;
  const showSkip =
    canSkip && (!head.connected || elapsedHead >= SKIP_DELAY_MS);

  // La cola de construcción especial tiene UN solo jugador (el opuesto al que
  // acaba de jugar). No hay "siguiente" ni "después": para quien no es el
  // constructor el mensaje es pasivo, sin sugerir que podrá construir.
  let headerText: string;
  let subtitleText: string | null;
  if (isMyTurn) {
    headerText = 'Construcción especial — es tu turno';
    subtitleText =
      'Construye o compra una carta de desarrollo. No puedes intercambiar ni jugar cartas ahora.';
  } else {
    headerText = `Construcción especial — turno de ${head.name}`;
    subtitleText = `Solo ${head.name} construye en esta fase. Tú no participas.`;
  }

  return (
    <section
      role="status"
      aria-live="polite"
      className="anim-slide-down mx-3 mt-2 rounded-lg border border-sky-400/25 bg-sky-500/[0.06] px-3 py-2 text-sky-50"
    >
      {/* Banner principal: icono + header + subtítulo.
          Icono pequeño a la izquierda, texto compacto. Sin dot redundante:
          el icono ya marca la fase. */}
      <div className="flex items-start gap-2 leading-snug">
        <ConstructionIcon className="mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold tracking-tight text-sky-50">
            {headerText}
          </p>
          {subtitleText ? (
            <p className="mt-0.5 text-[11px] leading-snug text-sky-100/80">
              {subtitleText}
            </p>
          ) : null}
          {hasPendingRegistration ? (
            <p className="mt-1 text-[11px] font-medium leading-snug text-amber-200">
              Antes de pasar, registra las fichas del poblado que construiste.
            </p>
          ) : null}
        </div>
      </div>

      {/* Constructor único: un solo chip, sin flechas ni "siguientes" (la cola
          de construcción especial tiene un único jugador). */}
      <div className="mt-2 flex items-center gap-1.5">
        <QueueItem
          key={`head-${head.id}-${headPulseKey}`}
          player={head}
          state="head"
          isMe={head.id === me.id}
          pulse={headPulseKey > 0}
        />
      </div>

      {/* Control de salto */}
      {showSkip ? (
        <div className="anim-fade-in mt-2 flex items-center justify-end">
          {!confirmSkip ? (
            <button
              type="button"
              onClick={() => setConfirmSkip(true)}
              className="min-h-[40px] rounded-md border border-white/15 bg-surface-3 px-3 py-2 text-xs font-medium text-sky-50 transition-colors active:bg-white/[0.10]"
            >
              {!head.connected
                ? `${head.name} está desconectado. Saltar su turno.`
                : `Saltar a ${head.name}`}
            </button>
          ) : (
            <div className="flex w-full items-center justify-end gap-1.5">
              <span className="mr-auto text-xs text-sky-100">
                Saltar este turno: {head.name}
              </span>
              <button
                type="button"
                onClick={() => setConfirmSkip(false)}
                className="min-h-[36px] rounded-md border border-white/10 bg-surface-3 px-3 py-1.5 text-xs text-neutral-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  specialBuildSkip(head.id);
                  setConfirmSkip(false);
                }}
                className="min-h-[36px] rounded-md bg-amber-400 px-3 py-1.5 text-xs font-bold text-neutral-950 shadow-cta-amber active:bg-amber-300"
              >
                Confirmar saltar
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function QueueItem({
  player,
  state,
  isMe,
  pulse = false,
}: {
  player: {
    id: string;
    name: string;
    color: PlayerColor | null;
    connected: boolean;
  };
  state: 'head' | 'next' | 'later';
  isMe: boolean;
  // Si true y state === 'head', el item entra con `anim-pulse-scale` una vez
  // para señalar que la cola avanzó.
  pulse?: boolean;
}): JSX.Element {
  const truncated =
    player.name.length > 16 ? player.name.slice(0, 14) + '…' : player.name;
  const opacity =
    state === 'head' ? 'opacity-100' : state === 'next' ? 'opacity-100' : 'opacity-55';
  const ring =
    state === 'head'
      ? 'border border-sky-300/70 shadow-soft'
      : state === 'next'
        ? 'border border-sky-300/30'
        : 'border border-white/10';
  const padding = state === 'head' ? 'px-2 py-1' : 'px-1.5 py-0.5';
  const fontSize = state === 'head' ? 'text-[12px]' : 'text-[11px]';
  return (
    <span
      className={
        'inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-neutral-900/60 ' +
        opacity +
        ' ' +
        ring +
        ' ' +
        padding +
        // Pulso único cuando la cola avanza y este item pasa a ser la cabeza
        // (comportamiento documentado del prop `pulse`).
        (pulse && state === 'head' ? ' anim-pulse-scale' : '')
      }
      style={{
        boxShadow:
          state === 'head'
            ? `inset 3px 0 0 0 ${playerHex(player.color)}`
            : undefined,
      }}
      title={player.name + (!player.connected ? ' (desconectado)' : '')}
    >
      {isMe && state === 'head' ? (
        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200">
          Tú →
        </span>
      ) : null}
      <ColorChip color={player.color} size={10} />
      <span className={'truncate font-medium text-neutral-100 ' + fontSize}>
        {truncated}
      </span>
      {!player.connected ? (
        <span className="rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-wide text-neutral-300">
          Desc.
        </span>
      ) : null}
    </span>
  );
}

function ConstructionIcon({ className }: { className?: string }): JSX.Element {
  // Cono de construcción con franjas blancas. Sin emoji.
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      {/* Base */}
      <rect x="3" y="19.5" width="18" height="2" rx="0.5" fill="#fbbf24" />
      {/* Cono */}
      <path
        d="M12 4 L17 19.5 L7 19.5 Z"
        fill="#fb923c"
        stroke="#7c2d12"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Franjas */}
      <rect x="8.7" y="11" width="6.6" height="1.6" fill="#fef3c7" />
      <rect x="9.6" y="14.5" width="4.8" height="1.6" fill="#fef3c7" />
    </svg>
  );
}
