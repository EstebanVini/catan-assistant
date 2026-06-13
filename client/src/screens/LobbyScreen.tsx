import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import {
  BASE_COLORS,
  EXTENSION_COLORS,
  FriendEntry,
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
import { getFriends } from '../api';

export function LobbyScreen(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const pushToast = useStore((s) => s.pushToast);
  const setColor = useStore((s) => s.setColor);
  const setExtension = useStore((s) => s.setExtension56);
  const setBankManager = useStore((s) => s.setBankManager);
  const setTurnOrder = useStore((s) => s.setTurnOrder);
  const rollOrderByDice = useStore((s) => s.rollOrderByDice);
  const startGame = useStore((s) => s.startGame);
  const leaveRoom = useStore((s) => s.leaveRoom);
  const setPorts = useStore((s) => s.setPorts);
  const toasts = useStore((s) => s.toasts);
  const setSeedResources = useStore((s) => s.setSeedResources);
  const setExtraRules = useStore((s) => s.setExtraRules);
  const kickPlayer = useStore((s) => s.kickPlayer);
  const authUser = useStore((s) => s.authUser);
  const authToken = useStore((s) => s.authToken);
  const inviteFriend = useStore((s) => s.inviteFriend);
  const getOnlineFriendIds = useStore((s) => s.getOnlineFriendIds);
  const [portsOpen, setPortsOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Confirmación de expulsión: jugador objetivo (id + nombre) o null.
  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(
    null
  );
  const [inviteOpen, setInviteOpen] = useState(false);

  // §4 — Bug de layout: la barra fija inferior crece según el rol (anfitrión
  // tiene CTA + cancelar, y dos botones cuando confirmLeave). Su altura real
  // supera el `pb-28` estático y tapaba "Controles del anfitrión". Medimos la
  // barra con un ResizeObserver y aplicamos su alto real como padding-bottom
  // del <main> (sumando el safe-area en el propio padding de la barra).
  const actionBarRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(112);
  useLayoutEffect(() => {
    const node = actionBarRef.current;
    if (!node) return;
    const measure = () => setBarHeight(node.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

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
  // §3 — Modo "Repartir recursos de inicio" (default true). Cuando está OFF se
  // inicia sin fichas y el registro de poblados deja de ser obligatorio, por lo
  // que ocultamos el contador "N/M listos" y mostramos una línea informativa.
  const seedOn = state.seedInitialResources;
  // §6 — Reglas extra (ambas default false).
  const extraRules = state.extraRules;
  const activeExtraRules = [
    extraRules.unequalTrades ? 'Intercambios desiguales' : null,
    extraRules.sharedPorts ? 'Usar puertos ajenos' : null,
  ].filter((r): r is string => r !== null);
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
    <main
      className="mx-auto min-h-[100dvh] max-w-md md:max-w-3xl lg:max-w-4xl"
      style={{ paddingBottom: `${barHeight + 24}px` }}
    >
      {/* md+: dos columnas — izquierda: código de sala + jugadores/orden;
          derecha: color, registro de poblados de salida y controles del
          anfitrión. En móvil estos wrappers son <div> neutros (mismo flujo).
          El canal central queda en 32px gracias a los px-4/mx-4 internos. */}
      <div className="md:grid md:grid-cols-2 md:items-start">
        <div className="min-w-0">
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
          {/* §1 (lobby) — Invitar amigos. Solo con sesión de cuenta. */}
          {authUser ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-semibold text-neutral-100 transition-colors active:bg-white/10"
            >
              <UsersIcon size={16} />
              Invitar amigos
            </button>
          ) : (
            <p className="mt-3 text-[11px] text-neutral-500">
              Inicia sesión con una cuenta para invitar a tus amigos.
            </p>
          )}
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
                  <div className="flex items-center gap-1">
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
                    {/* §2 — Expulsar: solo en filas de OTROS jugadores (ni la
                        propia ni la del anfitrión). Neutro que vira a rojo al
                        tocar; confirma antes de expulsar. */}
                    {!isMe && p.id !== state.hostId ? (
                      <button
                        type="button"
                        onClick={() => setKickTarget({ id: p.id, name: p.name })}
                        className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-surface-3 text-neutral-500 transition-colors active:border-red-500/40 active:bg-red-500/[0.12] active:text-red-300"
                        aria-label={`Expulsar a ${p.name} de la sala`}
                      >
                        <CloseIcon size={16} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

        </div>

        <div className="min-w-0">
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
        <section
          id="host-controls"
          className="mx-4 mt-4 rounded-2xl border border-white/10 bg-surface-1 p-3 shadow-soft [scroll-margin-bottom:120px]"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
              Controles del anfitrión
            </h2>
            {/* §3 — Progreso de registros: solo cuando se reparten recursos
                (modo con fichas). Sin recursos no hay meta que cumplir. */}
            {seedOn ? (
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
            ) : null}
          </div>
          {/* §3 — Toggle "Repartir recursos de inicio" (default ON). */}
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 bg-neutral-950/80 px-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-neutral-100">
                Repartir recursos de inicio
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-neutral-400">
                {seedOn
                  ? 'Cada jugador registra sus poblados y recibe sus cartas al iniciar.'
                  : 'Se inicia sin fichas: nadie recibe recursos y registrar tus poblados es opcional.'}
              </span>
            </span>
            <input
              type="checkbox"
              checked={seedOn}
              onChange={(e) => setSeedResources(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-emerald-500"
            />
          </label>
          <button
            type="button"
            onClick={() => rollOrderByDice()}
            className="mt-3 min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm"
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

      {/* §6 — Reglas extra: dos toggles independientes (default OFF), solo
          anfitrión. Los no-anfitriones ven el estado más abajo. */}
      {isHost ? (
        <section className="mx-4 mt-4 rounded-2xl border border-white/10 bg-surface-1 p-3 shadow-soft">
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
            Reglas extra
          </h2>
          <div className="mt-2 space-y-2">
            <ExtraRuleToggle
              title="Intercambios desiguales"
              help="Permite regalar cartas o pedir sin dar nada a cambio."
              checked={extraRules.unequalTrades}
              onChange={(v) => setExtraRules({ unequalTrades: v })}
            />
            <ExtraRuleToggle
              title="Usar puertos ajenos"
              help="Permite usar el puerto de otro jugador con su permiso (con comisión opcional)."
              checked={extraRules.sharedPorts}
              onChange={(v) => setExtraRules({ sharedPorts: v })}
            />
          </div>
        </section>
      ) : null}

      {/* Estado informativo para no-anfitriones (§3 y §6): modos de solo
          lectura que sí afectan su partida. */}
      {!isHost ? (
        <section className="mx-4 mt-4 rounded-2xl border border-white/10 bg-surface-1 p-3 shadow-soft">
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
            Reglas de la partida
          </h2>
          <p className="mt-2 text-xs text-neutral-400">
            Recursos de inicio:{' '}
            <span className="font-semibold text-neutral-100">
              {seedOn ? 'Sí' : 'No'}
            </span>
          </p>
          {!seedOn ? (
            <p className="mt-1 text-[11px] leading-snug text-sky-200">
              Se inicia sin fichas: no recibirás recursos y registrar tus
              poblados es opcional.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-neutral-400">
            Reglas extra:{' '}
            <span className="font-semibold text-neutral-100">
              {activeExtraRules.length > 0
                ? joinList(activeExtraRules)
                : 'ninguna'}
            </span>
          </p>
        </section>
      ) : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-neutral-950/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md space-y-2">
          {isHost ? (
            <>
              <button
                type="button"
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
              {confirmLeave ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(false)}
                    className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium text-neutral-300"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => leaveRoom()}
                    className="min-h-[44px] flex-1 rounded-lg border border-red-500/40 bg-red-500/[0.08] px-3 py-2 text-sm font-semibold text-red-300 active:bg-red-500/[0.14]"
                  >
                    Sí, cancelar sala
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-xs font-medium text-neutral-400 active:text-neutral-200"
                >
                  Cancelar sala
                </button>
              )}
            </>
          ) : (
            <>
              {!mySetupComplete ? (
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
              <button
                type="button"
                onClick={() => leaveRoom()}
                className="min-h-[44px] w-full rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-xs font-medium text-neutral-400 active:text-neutral-200"
              >
                Salir de la sala
              </button>
            </>
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

      {/* §2 — Confirmación de expulsión (alertdialog rojo). */}
      {kickTarget ? (
        <KickConfirm
          name={kickTarget.name}
          onCancel={() => setKickTarget(null)}
          onConfirm={() => {
            kickPlayer(kickTarget.id);
            setKickTarget(null);
          }}
        />
      ) : null}

      {/* §1 (lobby) — Bottom-sheet de invitar amigos. */}
      {inviteOpen && authUser && authToken ? (
        <InviteFriendsSheet
          token={authToken}
          code={state.code}
          inRoomIds={state.players.map((p) => p.id)}
          onClose={() => setInviteOpen(false)}
          onCopyCode={copyCode}
          inviteFriend={inviteFriend}
          getOnlineFriendIds={getOnlineFriendIds}
          pushToast={pushToast}
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

// ---------------------------------------------------------------------------
// Iconos primitivos (sin emoji). Stroke con currentColor para heredar tono.
// ---------------------------------------------------------------------------

function CloseIcon({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6 6 L18 18 M18 6 L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function UsersIcon({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M9 11 a3.5 3.5 0 1 0 0-7 a3.5 3.5 0 0 0 0 7 Z M2.5 19 a6.5 6.5 0 0 1 13 0 M16 4.5 a3.2 3.2 0 0 1 0 6.2 M17 13.2 a6.3 6.3 0 0 1 4.5 5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// §6 — Fila-toggle de regla extra (mismo patrón que "Extensión 5–6").
// ---------------------------------------------------------------------------

function ExtraRuleToggle({
  title,
  help,
  checked,
  onChange,
}: {
  title: string;
  help: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 bg-neutral-950/80 px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-neutral-100">
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-neutral-400">
          {help}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-emerald-500"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// §2 — Confirmación de expulsión (alertdialog rojo, patrón ConfirmEmptySteal).
// ---------------------------------------------------------------------------

function KickConfirm({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, onCancel);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="kick-title"
        aria-describedby="kick-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <h2
          id="kick-title"
          className="text-sm font-semibold tracking-tight text-neutral-50"
        >
          ¿Expulsar a {name}?
        </h2>
        <p id="kick-desc" className="mt-1.5 text-xs leading-relaxed text-neutral-400">
          Volverá a la pantalla de inicio y tendrás que invitarlo de nuevo para
          que regrese.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] flex-1 rounded-lg border border-red-500/40 bg-red-500/[0.08] px-3 py-2 text-sm font-bold text-red-300 transition-colors active:bg-red-500/[0.16]"
          >
            Sí, expulsar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §1 (lobby) — Bottom-sheet "Invitar amigos a la sala".
// Carga amigos con getFriends, marca en línea con getOnlineFriendIds y lista
// solo a los conectados (oculta offline para reducir ruido, brief §1). Cada
// amigo libre tiene "Invitar"; tras invitar pasa a "Invitado" (sin spam). Los
// que ya están en la sala se muestran atenuados con "En la sala".
// ---------------------------------------------------------------------------

type InviteLoadState = 'loading' | 'ready' | 'error';

function InviteFriendsSheet({
  token,
  code,
  inRoomIds,
  onClose,
  onCopyCode,
  inviteFriend,
  getOnlineFriendIds,
  pushToast,
}: {
  token: string;
  code: string;
  inRoomIds: string[];
  onClose: () => void;
  onCopyCode: () => void;
  inviteFriend: (friendUserId: string) => Promise<{ ok?: boolean; error?: string }>;
  getOnlineFriendIds: () => Promise<string[]>;
  pushToast: (kind: 'info' | 'error' | 'success', text: string) => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, onClose);

  const [loadState, setLoadState] = useState<InviteLoadState>('loading');
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  // Estado por amigo durante/tras la invitación: 'busy' mientras espera el ack,
  // 'invited' cuando el server confirmó (deshabilita para no spamear).
  const [rowState, setRowState] = useState<Record<string, 'busy' | 'invited'>>(
    {}
  );

  const inRoom = new Set(inRoomIds);

  useEffect(() => {
    let alive = true;
    setLoadState('loading');
    void (async () => {
      const [res, online] = await Promise.all([
        getFriends(token),
        getOnlineFriendIds().catch(() => [] as string[]),
      ]);
      if (!alive) return;
      if (res.ok) {
        setFriends(res.friends);
        setOnlineIds(new Set(online));
        setLoadState('ready');
      } else {
        setLoadState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, getOnlineFriendIds]);

  async function invite(userId: string): Promise<void> {
    if (rowState[userId]) return;
    setRowState((prev) => ({ ...prev, [userId]: 'busy' }));
    const res = await inviteFriend(userId);
    if (res.ok) {
      setRowState((prev) => ({ ...prev, [userId]: 'invited' }));
      pushToast('success', 'Invitación enviada.');
    } else {
      setRowState((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      pushToast('error', res.error ?? 'No pudimos enviar la invitación.');
    }
  }

  // Solo amigos conectados; los offline se ocultan (brief §1, reducir ruido).
  const online = friends.filter((f) => onlineIds.has(f.user.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-sheet-title"
        aria-describedby="invite-sheet-sub"
        onClick={(e) => e.stopPropagation()}
        className="anim-slide-up flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-2xl border border-white/10 bg-neutral-900 shadow-2xl ring-1 ring-white/5 sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/8 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <h2
              id="invite-sheet-title"
              className="font-display text-base font-semibold tracking-tight text-neutral-50"
            >
              Invitar amigos a la sala
            </h2>
            <p id="invite-sheet-sub" className="mt-0.5 text-xs text-neutral-400">
              Código:{' '}
              <span className="nums font-semibold tracking-[0.12em] text-neutral-200">
                {code}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar invitar amigos"
            className="-mr-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors active:bg-white/10 active:text-neutral-100"
          >
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
          {loadState === 'loading' ? (
            <div className="animate-pulse space-y-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface-1 p-2.5"
                >
                  <div className="h-10 w-10 flex-shrink-0 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-28 rounded bg-white/10" />
                    <div className="h-3 w-20 rounded bg-surface-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : loadState === 'error' ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/[0.06] p-4 text-center">
              <p className="text-sm text-red-200">
                No pudimos cargar tus amigos. Revisa tu conexión.
              </p>
            </div>
          ) : online.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-surface-1 px-4 py-8 text-center">
              <p className="mx-auto max-w-[18rem] text-xs leading-relaxed text-neutral-400">
                Ninguno de tus amigos está conectado ahora. Comparte el código.
              </p>
              <button
                type="button"
                onClick={onCopyCode}
                className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-white/12 bg-surface-3 px-4 text-sm font-semibold text-neutral-100 transition-colors active:bg-white/10"
              >
                Copiar código
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {online.map((f) => {
                const u = f.user;
                const already = inRoom.has(u.id);
                const rs = rowState[u.id];
                return (
                  <li
                    key={f.friendshipId}
                    className={
                      'flex items-center gap-3 rounded-xl border border-white/10 bg-surface-1 p-2.5 ' +
                      (already ? 'opacity-60' : '')
                    }
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar
                        seed={u.username}
                        name={u.displayName}
                        avatarUrl={u.avatarUrl}
                        size={40}
                      />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-900 bg-emerald-400"
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-50">
                        {u.displayName}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        @{u.username}
                      </p>
                    </div>
                    {already ? (
                      <span className="flex-shrink-0 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-xs font-medium text-neutral-400">
                        En la sala
                      </span>
                    ) : rs === 'invited' ? (
                      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.10] px-3 py-2 text-xs font-semibold text-emerald-300">
                        <CheckIcon size={13} />
                        Invitado
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={rs === 'busy'}
                        onClick={() => void invite(u.id)}
                        aria-label={`Invitar a ${u.displayName} a la sala`}
                        className="min-h-[44px] flex-shrink-0 rounded-lg bg-emerald-500 px-4 text-xs font-bold text-neutral-950 shadow-cta transition-all active:scale-[0.98] disabled:opacity-60"
                      >
                        {rs === 'busy' ? 'Invitando…' : 'Invitar'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
