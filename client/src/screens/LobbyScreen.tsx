import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import {
  BASE_COLORS,
  EXTENSION_COLORS,
  PlayerColor,
  PortType,
  PublicPlayer,
  RESOURCES,
} from '../types';
import { ColorChip } from '../components/ColorChip';
import { COLOR_NAMES, RESOURCE_NAMES, joinList } from '../lib/spanish';
import { useModalA11y } from '../lib/useModalA11y';
import { InitialBuildSetup, CheckIcon } from '../components/InitialBuildSetup';
import { Avatar } from '../components/Avatar';

export function LobbyScreen(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const pushToast = useStore((s) => s.pushToast);
  const setColor = useStore((s) => s.setColor);
  const setExtension = useStore((s) => s.setExtension56);
  const setBankManager = useStore((s) => s.setBankManager);
  const setTurnOrder = useStore((s) => s.setTurnOrder);
  const rollOrderByDice = useStore((s) => s.rollOrderByDice);
  const startGame = useStore((s) => s.startGame);
  const setPorts = useStore((s) => s.setPorts);
  const toasts = useStore((s) => s.toasts);
  const [portsOpen, setPortsOpen] = useState(false);

  // Snap-back de conflicto de color: si el servidor responde con un error
  // dentro de ~700 ms después de que el usuario tapeó un color, ese chip
  // hace un shake-x. Memoizamos el último color tapeado y su timestamp.
  const lastColorAttemptRef = useRef<{ color: PlayerColor; t: number } | null>(
    null
  );
  const lastErrorToastIdRef = useRef<number | null>(null);
  const [shakeColor, setShakeColor] = useState<PlayerColor | null>(null);

  // Etiqueta "Nuevo" sobre los chips verde/café cuando se activa la extensión.
  // Mostramos durante 4 s tras la activación. Se memoiza el último valor de
  // `extension56` para detectar la transición false→true.
  const prevExt56Ref = useRef<boolean | null>(null);
  const [showNewExtChips, setShowNewExtChips] = useState(false);
  useEffect(() => {
    const ext = view?.state.extension56 ?? false;
    if (prevExt56Ref.current === null) {
      prevExt56Ref.current = ext;
      return;
    }
    if (!prevExt56Ref.current && ext) {
      setShowNewExtChips(true);
      const t = window.setTimeout(() => setShowNewExtChips(false), 4000);
      prevExt56Ref.current = ext;
      return () => window.clearTimeout(t);
    }
    prevExt56Ref.current = ext;
    return undefined;
  }, [view?.state.extension56]);

  useEffect(() => {
    // Buscar un nuevo toast de error que sea posterior al último visto.
    const lastError = [...toasts].reverse().find((t) => t.kind === 'error');
    if (!lastError) return;
    if (lastErrorToastIdRef.current === lastError.id) return;
    lastErrorToastIdRef.current = lastError.id;
    const attempt = lastColorAttemptRef.current;
    if (attempt && Date.now() - attempt.t < 700) {
      setShakeColor(attempt.color);
      const timer = window.setTimeout(() => setShakeColor(null), 360);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [toasts]);

  if (!view || !view.me) return null;
  const { state, me } = view;
  const isHost = state.hostId === me.id;
  const ordered = state.turnOrder
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is PublicPlayer => !!p);

  const colorsAvailable: PlayerColor[] = state.extension56
    ? [...BASE_COLORS, ...EXTENSION_COLORS]
    : BASE_COLORS;

  const playersWithColor = state.players.filter((p) => p.color);
  // Fase 3: el registro de poblados de salida es condición de inicio. El
  // progreso "N/M listos" deriva SIEMPRE del estado del servidor.
  const setupReady = state.players.filter((p) => p.setupComplete);
  const allSetupComplete = state.players.every((p) => p.setupComplete);
  const mySetupComplete = !!state.players.find((p) => p.id === me.id)
    ?.setupComplete;
  const setupMissingNames = state.players
    .filter((p) => !p.setupComplete)
    .map((p) => p.name);
  const canStart =
    isHost &&
    playersWithColor.length >= 3 &&
    state.players.every((p) => p.color) &&
    allSetupComplete;
  const startReason = !isHost
    ? 'Solo el anfitrión puede iniciar la partida.'
    : playersWithColor.length < 3
      ? 'Faltan jugadores. Mínimo 3 con color elegido.'
      : state.players.some((p) => !p.color)
        ? 'Falta que todos elijan color.'
        : !allSetupComplete
          ? `Faltan registros de salida (${setupReady.length}/${state.players.length} listos)`
          : null;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(state.code);
      pushToast('success', 'Código copiado al portapapeles.');
    } catch {
      pushToast('error', `No pudimos copiar. Cópialo a mano: ${state.code}`);
    }
  }

  function moveInOrder(playerId: string, direction: -1 | 1) {
    if (!isHost) return;
    const next = [...state.turnOrder];
    const idx = next.indexOf(playerId);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= next.length) return;
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    setTurnOrder(next);
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-md pb-28">
      <header className="px-4 pt-6">
        <h1 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
          Sala de espera
        </h1>
        <div className="mt-2 rounded-2xl border border-white/10 bg-surface-2 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-4 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
            Código de partida
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="title-gold font-display text-[34px] font-bold leading-none tracking-[0.18em]">
              {state.code}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="min-h-[44px] rounded-lg border border-white/12 bg-surface-3 px-3 py-2 text-xs font-semibold text-neutral-100 transition-colors active:bg-white/10"
            >
              Copiar
            </button>
          </div>
          {isHost ? (
            (() => {
              const extColorsTaken = state.players.some(
                (p) =>
                  p.color === 'green' || p.color === 'brown'
              );
              const tooManyPlayers = state.players.length > 4;
              const disableOff =
                state.extension56 && (extColorsTaken || tooManyPlayers);
              const offTip = extColorsTaken
                ? 'Hay jugadores con color verde o café. Cambia sus colores primero.'
                : tooManyPlayers
                  ? 'Hay más de 4 jugadores. Reduce el grupo a 4 antes de desactivar.'
                  : undefined;
              return (
                <label
                  className="mt-4 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 bg-neutral-950/80 px-3 py-2.5"
                  title={
                    state.extension56 && disableOff ? offTip : undefined
                  }
                >
                  <span className="text-sm font-medium text-neutral-100">
                    Extensión 5–6 jugadores
                  </span>
                  <input
                    type="checkbox"
                    checked={state.extension56}
                    onChange={(e) => setExtension(e.target.checked)}
                    aria-describedby={
                      state.extension56 && disableOff
                        ? 'ext-disable-tip'
                        : undefined
                    }
                    className="h-5 w-5 accent-emerald-500"
                  />
                  {state.extension56 && disableOff && offTip ? (
                    <span id="ext-disable-tip" className="sr-only">
                      {offTip}
                    </span>
                  ) : null}
                </label>
              );
            })()
          ) : (
            <p className="mt-3 text-xs text-neutral-400">
              Modo:{' '}
              <span className="font-semibold text-neutral-100">
                {state.extension56 ? 'Extensión 5–6' : 'Base 3–4'}
              </span>
            </p>
          )}
          <p className="mt-3 text-[11px] text-neutral-500">
            Banco:{' '}
            <span className="nums font-semibold text-neutral-300">
              {state.extension56 ? 24 : 19}
            </span>{' '}
            cartas por recurso
          </p>
        </div>
      </header>

      <section className="mx-4 mt-4 rounded-2xl border border-white/10 bg-surface-1 p-3 shadow-soft">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
          Jugadores ({state.players.length}/{state.extension56 ? 6 : 4})
        </h2>
        <ul className="mt-2 space-y-1.5">
          {ordered.map((p, idx) => {
            const isMe = p.id === me.id;
            return (
              <li
                key={p.id}
                className={
                  'flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ' +
                  (isMe
                    ? 'border-emerald-500/45 bg-emerald-500/[0.08]'
                    : 'border-white/10 bg-neutral-900/50')
                }
              >
                <span className="nums w-5 text-center text-xs font-semibold text-neutral-500">
                  {idx + 1}
                </span>
                <ColorChip color={p.color} size={22} />
                {p.avatarUrl ? (
                  <Avatar
                    seed={p.name}
                    name={p.name}
                    avatarUrl={p.avatarUrl}
                    size={24}
                  />
                ) : null}
                <div className="flex-1">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-50">
                    {p.name}
                    {isMe ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                        Tú
                      </span>
                    ) : null}
                    {p.setupComplete ? (
                      // Check verde de registro inicial completo. Los
                      // pendientes no llevan marca (no han hecho nada malo).
                      <span
                        className="anim-scale-in inline-flex"
                        role="img"
                        aria-label="Registro de salida completo"
                      >
                        <CheckIcon size={14} />
                      </span>
                    ) : null}
                  </span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {p.id === state.hostId ? (
                      <Tag>Anfitrión</Tag>
                    ) : null}
                    {p.id === state.bankManagerId ? <Tag>Banco</Tag> : null}
                    {!p.connected ? <Tag tone="muted">Desconectado</Tag> : null}
                  </div>
                </div>
                {isHost ? (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveInOrder(p.id, -1)}
                      disabled={idx === 0}
                      className="h-11 w-11 rounded-md border border-white/10 bg-surface-3 text-base disabled:opacity-40"
                      aria-label={`Subir a ${p.name} en el orden de turno`}
                    >
                      <span aria-hidden>↑</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveInOrder(p.id, 1)}
                      disabled={idx === ordered.length - 1}
                      className="h-11 w-11 rounded-md border border-white/10 bg-surface-3 text-base disabled:opacity-40"
                      aria-label={`Bajar a ${p.name} en el orden de turno`}
                    >
                      <span aria-hidden>↓</span>
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-4 mt-4 rounded-2xl border border-white/10 bg-surface-1 p-3 shadow-soft">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
          Tu color
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {colorsAvailable.map((c) => {
            const taken = state.players.find((p) => p.color === c);
            const isMine = taken?.id === me.id;
            const isTakenByOther = !!taken && !isMine;
            const isExtensionColor = c === 'green' || c === 'brown';
            const showNewBadge =
              isExtensionColor && state.extension56 && showNewExtChips;
            return (
              <button
                key={c}
                type="button"
                disabled={isTakenByOther}
                aria-pressed={isMine}
                aria-label={
                  isTakenByOther
                    ? `Color ${COLOR_NAMES[c]} (lo tiene ${taken!.name})`
                    : isMine
                      ? `Color ${COLOR_NAMES[c]} (tu color actual)`
                      : `Elegir color ${COLOR_NAMES[c]}`
                }
                onClick={() => {
                  // Memo del intento para snap-back si el server rechaza.
                  lastColorAttemptRef.current = { color: c, t: Date.now() };
                  setColor(c);
                }}
                className={
                  'relative inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] ' +
                  (isMine
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-50 shadow-soft'
                    : isTakenByOther
                      ? 'cursor-not-allowed border-white/[0.06] bg-surface-1 text-neutral-500 line-through'
                      : 'border-white/12 bg-surface-2 text-neutral-100 active:bg-white/10') +
                  (shakeColor === c ? ' anim-shake' : '')
                }
              >
                <ColorChip color={c} size={18} />
                <span>{COLOR_NAMES[c]}</span>
                {isTakenByOther ? (
                  <span className="text-[10px] text-neutral-500">
                    ({taken!.name})
                  </span>
                ) : null}
                {showNewBadge ? (
                  <span
                    className="anim-fade-in absolute -right-1.5 -top-1.5 rounded-md bg-amber-400 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-950 shadow-soft"
                    aria-hidden
                  >
                    Nuevo
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setPortsOpen(true)}
          className="mt-3 min-h-[40px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-xs"
        >
          Mis puertos ({me.ports.length})
        </button>
      </section>

      {/* Fase 3: la tarea principal del lobby una vez elegido el color. */}
      <InitialBuildSetup />

      {isHost ? (
        <section className="mx-4 mt-4 rounded-2xl border border-white/10 bg-surface-1 p-3 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
              Controles del anfitrión
            </h2>
            {/* Progreso de registros de salida — pulsa cuando sube. */}
            <span
              key={'setup-progress-' + setupReady.length}
              className={
                'nums rounded-full border px-2 py-0.5 text-[11px] font-semibold ' +
                (allSetupComplete
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-200') +
                (setupReady.length > 0 ? ' anim-pulse-scale' : '')
              }
            >
              {setupReady.length}/{state.players.length} listos
            </span>
          </div>
          <button
            type="button"
            onClick={() => rollOrderByDice()}
            className="mt-2 min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm"
          >
            Sortear orden con dados
          </button>
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">
              Encargado del banco
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {state.players.map((p) => {
                const selected = state.bankManagerId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBankManager(p.id)}
                    className={
                      'inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs ' +
                      (selected
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 bg-surface-3')
                    }
                  >
                    <ColorChip color={p.color} size={12} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-neutral-950/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          {isHost ? (
            <button
              type="button"
              // Cuando lo único pendiente son registros de salida, el botón
              // sigue tapeable: el tap responde con los nombres que faltan
              // (el host puede gritárselos a la mesa — es presencial).
              disabled={!canStart && allSetupComplete}
              aria-disabled={!canStart}
              title={startReason ?? undefined}
              onClick={() => {
                if (canStart) {
                  startGame();
                  return;
                }
                if (!allSetupComplete && setupMissingNames.length > 0) {
                  pushToast('info', `Faltan: ${joinList(setupMissingNames)}.`);
                }
              }}
              className={
                'min-h-[56px] w-full rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.99] ' +
                (canStart
                  ? 'bg-emerald-500 text-neutral-950 shadow-cta active:bg-emerald-400'
                  : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-400')
              }
            >
              {startReason ?? 'Iniciar partida'}
            </button>
          ) : !mySetupComplete ? (
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById('initial-build-setup')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="min-h-[56px] w-full rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-3 py-3 text-center text-sm font-semibold text-amber-200 transition-all active:scale-[0.99] active:bg-amber-500/[0.14]"
            >
              Te falta registrar tus poblados ↓
            </button>
          ) : (
            <div className="rounded-xl border border-white/10 bg-surface-2 py-3.5 text-center text-sm font-medium text-neutral-300">
              Espera a que el anfitrión inicie la partida.
            </div>
          )}
        </div>
      </div>

      {portsOpen ? (
        <PortsModal
          ports={me.ports}
          onClose={() => setPortsOpen(false)}
          onSubmit={(p) => {
            setPorts(p);
            setPortsOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

function Tag({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'muted';
}): JSX.Element {
  const cls =
    tone === 'muted'
      ? 'bg-surface-3 text-neutral-400 border-white/10'
      : 'bg-sky-500/15 text-sky-200 border-sky-500/30';
  return (
    <span
      className={
        'inline-block rounded-full border px-1.5 py-0.5 text-[10px] leading-none ' +
        cls
      }
    >
      {children}
    </span>
  );
}

function PortsModal({
  ports,
  onClose,
  onSubmit,
}: {
  ports: PortType[];
  onClose: () => void;
  onSubmit: (p: PortType[]) => void;
}): JSX.Element {
  const [selected, setSelected] = useState<Set<PortType>>(new Set(ports));
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);
  function toggle(p: PortType) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
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
        aria-labelledby="ports-modal-title"
        aria-describedby="ports-modal-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl"
      >
        <h3 id="ports-modal-title" className="text-base font-semibold">
          Mis puertos
        </h3>
        <p id="ports-modal-desc" className="mt-1 text-xs text-neutral-400">
          Marca los puertos que tienes en el tablero. Te dan mejor proporción al
          intercambiar.
        </p>
        <div className="mt-3 space-y-2">
          <PortRow
            label="Puerto 3:1 (cualquier recurso)"
            checked={selected.has('3:1')}
            onChange={() => toggle('3:1')}
          />
          {RESOURCES.map((r) => (
            <PortRow
              key={r}
              label={`Puerto 2:1 ${RESOURCE_NAMES[r]}`}
              checked={selected.has(r)}
              onChange={() => toggle(r)}
            />
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSubmit(Array.from(selected))}
            className="min-h-[44px] flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-900"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function PortRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-surface-3 px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 accent-emerald-500"
      />
    </label>
  );
}
