import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { TopBar } from '../components/TopBar';
import { ContextBanner } from '../components/ContextBanner';
import { HandView } from '../components/HandView';
import { ActionGrid } from '../components/ActionGrid';
import { BankPanel } from '../components/BankPanel';
import { ProductionTable } from '../components/ProductionTable';
import { PublicPlayersPanel } from '../components/PublicPlayersPanel';
import { Log } from '../components/Log';
import { DiscardModal } from '../components/DiscardModal';
import { RobberFlow } from '../components/RobberFlow';
import { TradeIncomingModal } from '../components/TradeIncomingModal';
import { SpecialBuildBanner } from '../components/SpecialBuildBanner';
import { MonopolyPickerModal } from '../components/MonopolyPickerModal';
import { YearOfPlentyPickerModal } from '../components/YearOfPlentyPickerModal';
import { RoadBuildingConfirmModal } from '../components/RoadBuildingConfirmModal';
import { DiceStats } from '../components/DiceStats';
import { handTotal, totalVictoryPoints } from '../types';
import { DEV_CARD_NAMES, hiddenVPCopy } from '../lib/spanish';
import { safeVibrate } from '../lib/motion';
import { useModalA11y } from '../lib/useModalA11y';

// Tipo discriminado para el sub-flujo activo del modal "Jugar dev".
type DevSubFlow =
  | { kind: 'none' }
  | { kind: 'list' }
  | { kind: 'monopoly' }
  | { kind: 'yop' }
  | { kind: 'roadBuilding' };

export function GameScreen(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const playDevCard = useStore((s) => s.playDevCard);
  const pushToast = useStore((s) => s.pushToast);
  const showDisconnectedBanner = useStore((s) => s.showDisconnectedBanner);
  const [devSub, setDevSub] = useState<DevSubFlow>({ kind: 'none' });
  const [statsOpen, setStatsOpen] = useState(false);

  // Vibración + toast al iniciar mi turno (cambio de turno con activeId == me.id).
  const prevTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!view || !view.me) return;
    const activeId = view.state.turnOrder[view.state.currentTurnIndex];
    if (
      activeId === view.me.id &&
      prevTurnRef.current !== null &&
      prevTurnRef.current !== activeId
    ) {
      pushToast('success', 'Es tu turno. Tira el dado.');
      // Pulso háptico de 200 ms para anunciar el inicio de turno aunque la
      // pantalla esté guardada. `safeVibrate` respeta `prefers-reduced-motion`.
      safeVibrate(200);
    }
    prevTurnRef.current = activeId;
  }, [view, pushToast]);

  // Vibración corta (100 ms) la primera vez que aparece "Declarar victoria".
  const wasDeclarableRef = useRef(false);
  useEffect(() => {
    if (!view || !view.me) {
      wasDeclarableRef.current = false;
      return;
    }
    const { state, me } = view;
    const myPublic = state.players.find((p) => p.id === me.id);
    const myVP = myPublic ? totalVictoryPoints(myPublic.victoryPoints) : 0;
    const canDeclareNow =
      state.turnOrder[state.currentTurnIndex] === me.id &&
      state.phase === 'main' &&
      state.status === 'playing' &&
      myVP >= 10;
    if (canDeclareNow && !wasDeclarableRef.current) {
      wasDeclarableRef.current = true;
      pushToast('success', 'Puedes declarar victoria.');
      safeVibrate(100);
    } else if (!canDeclareNow) {
      wasDeclarableRef.current = false;
    }
  }, [view, pushToast]);

  // Punto de extensión para Fase 3 (brief §6.2): aquí iría el hook de Web
  // Notifications (`useTurnNotification`) para avisar al usuario cuando es su
  // turno y la pestaña está oculta. Decisión Fase 2: no implementar.

  if (!view || !view.me) return null;
  const { state } = view;

  // Cuando la partida termina, la App enruta directamente a `<WinnerScreen />`
  // (ver `App.tsx`). Si por alguna razón se llega aquí con `status === 'ended'`,
  // dejamos que GameScreen renderice un overlay defensivo.
  return (
    <main className="mx-auto min-h-[100dvh] max-w-md pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      {showDisconnectedBanner ? (
        <div
          role="status"
          aria-live="polite"
          className="anim-slide-down sticky top-0 z-40 flex items-center justify-center gap-1.5 bg-red-700 px-3 py-1.5 text-center text-xs font-semibold tracking-wide text-white"
        >
          <span
            className="anim-breathe inline-block h-1.5 w-1.5 rounded-full bg-red-200"
            aria-hidden
          />
          Sin conexión. Reintentando…
        </div>
      ) : null}
      <TopBar />
      {/* En specialBuild usamos el banner dedicado (con cola + skip).
          En cualquier otra fase, el ContextBanner clásico. */}
      {state.phase === 'specialBuild' ? (
        <SpecialBuildBanner />
      ) : (
        <ContextBanner />
      )}
      <HandView />
      <ActionGrid onPlayDev={() => setDevSub({ kind: 'list' })} />
      <BankPanel />
      <ProductionTable />
      <PublicPlayersPanel />
      <DiceStatsCollapsible
        stats={state.diceStats}
        lastNumber={state.lastRolledNumber}
        open={statsOpen}
        onToggle={() => setStatsOpen((v) => !v)}
      />
      <Log />
      <DiscardModal />
      <RobberFlow />
      <TradeIncomingModal />

      {devSub.kind === 'list' ? (
        <PlayDevModal
          onClose={() => setDevSub({ kind: 'none' })}
          onPickKnight={() => {
            playDevCard('knight');
            setDevSub({ kind: 'none' });
          }}
          onPickMonopoly={() => setDevSub({ kind: 'monopoly' })}
          onPickYoP={() => setDevSub({ kind: 'yop' })}
          onPickRoadBuilding={() => setDevSub({ kind: 'roadBuilding' })}
        />
      ) : null}
      {devSub.kind === 'monopoly' ? (
        <MonopolyPickerModal onClose={() => setDevSub({ kind: 'none' })} />
      ) : null}
      {devSub.kind === 'yop' ? (
        <YearOfPlentyPickerModal onClose={() => setDevSub({ kind: 'none' })} />
      ) : null}
      {devSub.kind === 'roadBuilding' ? (
        <RoadBuildingConfirmModal onClose={() => setDevSub({ kind: 'none' })} />
      ) : null}
    </main>
  );
}

// Sección colapsable del histograma de dados — visible para todos (brief §5.3).
// Cerrada por defecto para no introducir ruido. Dentro de `BankPanel` el
// histograma sigue expandido por su uso operativo.
function DiceStatsCollapsible({
  stats,
  lastNumber,
  open,
  onToggle,
}: {
  stats: Record<number, number>;
  lastNumber: number | null;
  open: boolean;
  onToggle: () => void;
}): JSX.Element {
  const total = Object.values(stats).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] shadow-soft">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="dice-stats-panel"
        className="flex w-full items-center justify-between rounded-t-xl px-3 py-3 transition-colors active:bg-white/[0.04]"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-300">
          Estadísticas de dados
        </span>
        <span className="flex items-center gap-2 text-[11px] text-neutral-400">
          <span className="nums">
            {total} {total === 1 ? 'tirada' : 'tiradas'}
          </span>
          <span aria-hidden>{open ? '−' : '+'}</span>
        </span>
      </button>
      {open ? (
        <div
          id="dice-stats-panel"
          className="border-t border-white/10 px-3 pb-3 pt-2"
        >
          {total === 0 ? (
            <p className="text-center text-[11px] text-neutral-400">
              Aún no hay tiradas.
            </p>
          ) : (
            <DiceStats
              stats={stats}
              variant="default"
              lastRolledNumber={lastNumber}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}

// Modal "Jugar carta de desarrollo" — Fase 2 §1: cuatro cartas jugables.
//  - Caballero: dispara flujo del 7 directo (sin sub-modal).
//  - Monopolio / YoP / RoadBuilding: abren sub-modal dedicado.
//  - Punto de victoria: NO aparece en la lista; sólo la sección informativa.
//
// Reglas de disabled (un solo lugar):
//  - `available <= 0`  → no se muestra la fila (omisión, no "gris vacío").
//  - `available > 0` pero `compradaEsteTurno > 0` → fila visible y
//    deshabilitada con razón "Comprada este turno — no se puede jugar
//    todavía.".
//  - Si jugó cualquier carta este turno → subnota global + todas deshabilitadas.
//  - YoP adicional: deshabilitada si banco totalmente vacío.
function PlayDevModal({
  onClose,
  onPickKnight,
  onPickMonopoly,
  onPickYoP,
  onPickRoadBuilding,
}: {
  onClose: () => void;
  onPickKnight: () => void;
  onPickMonopoly: () => void;
  onPickYoP: () => void;
  onPickRoadBuilding: () => void;
}): JSX.Element {
  const view = useStore((s) => s.view)!;
  const me = view.me!;
  const state = view.state;
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  // Cuántas "nuevas" (compradas este turno) hay de cada tipo: esas no son
  // jugables todavía.
  function newCount(card: 'knight' | 'monopoly' | 'yearOfPlenty' | 'roadBuilding'): number {
    return me.devCardsBoughtThisTurn.filter((c) => c === card).length;
  }

  function playable(card: 'knight' | 'monopoly' | 'yearOfPlenty' | 'roadBuilding'): number {
    return me.devCards[card] - newCount(card);
  }

  const playableKnight = playable('knight');
  const playableMono = playable('monopoly');
  const playableYoP = playable('yearOfPlenty');
  const playableRB = playable('roadBuilding');

  const hiddenVP = me.devCards.vp;
  const bankTotal = handTotal(state.bank);

  // No hay forma directa de saber "ya jugué una carta este turno" desde el
  // estado público; el server rechazaría la jugada. Aquí mostramos las
  // razones por carta y dejamos que el server sea autoridad.

  // Lista de items a mostrar (sólo las que tengo `available > 0` o que tengo
  // alguna copia disponible aunque sea "nueva", para mostrar la razón).
  type Row = {
    card: 'knight' | 'monopoly' | 'yearOfPlenty' | 'roadBuilding';
    title: string;
    subtitle: string;
    available: number;
    newCount: number;
    extraReason: string | null;
    onPick: () => void;
  };

  const rows: Row[] = [];

  if (me.devCards.knight > 0) {
    rows.push({
      card: 'knight',
      title: DEV_CARD_NAMES.knight,
      subtitle: 'Mueve el ladrón y roba 1 carta.',
      available: playableKnight,
      newCount: newCount('knight'),
      extraReason: null,
      onPick: onPickKnight,
    });
  }
  if (me.devCards.monopoly > 0) {
    rows.push({
      card: 'monopoly',
      title: DEV_CARD_NAMES.monopoly,
      subtitle: 'Toma todas las cartas de 1 recurso de los demás.',
      available: playableMono,
      newCount: newCount('monopoly'),
      extraReason: null,
      onPick: onPickMonopoly,
    });
  }
  if (me.devCards.yearOfPlenty > 0) {
    rows.push({
      card: 'yearOfPlenty',
      title: DEV_CARD_NAMES.yearOfPlenty,
      subtitle: 'Toma 2 cartas del banco.',
      available: playableYoP,
      newCount: newCount('yearOfPlenty'),
      extraReason:
        bankTotal === 0
          ? 'El banco no tiene recursos para esta carta.'
          : null,
      onPick: onPickYoP,
    });
  }
  if (me.devCards.roadBuilding > 0) {
    rows.push({
      card: 'roadBuilding',
      title: DEV_CARD_NAMES.roadBuilding,
      subtitle: 'Coloca 2 caminos sin pagar recursos.',
      available: playableRB,
      newCount: newCount('roadBuilding'),
      extraReason: null,
      onPick: onPickRoadBuilding,
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
        aria-labelledby="dev-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <h2
          id="dev-modal-title"
          className="text-base font-semibold tracking-tight text-neutral-50"
        >
          Jugar carta de desarrollo
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-400">
          No puedes jugar una carta comprada este turno.
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-xs text-neutral-300">
            No tienes cartas de desarrollo jugables.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {rows.map((row) => {
              const blockedByNew = row.available <= 0 && row.newCount > 0;
              const reason: string | null = row.extraReason
                ? row.extraReason
                : blockedByNew
                  ? 'Comprada este turno — no se puede jugar todavía.'
                  : null;
              const disabled = row.available <= 0 || row.extraReason !== null;
              return (
                <button
                  key={row.card}
                  type="button"
                  disabled={disabled}
                  title={reason ?? undefined}
                  onClick={row.onPick}
                  className={
                    'flex min-h-[56px] w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ' +
                    (disabled
                      ? 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-50'
                      : 'border-white/12 bg-white/[0.05] active:bg-white/[0.09]')
                  }
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="text-sm font-semibold text-neutral-50">
                      {row.title}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-neutral-400">
                      {row.subtitle}
                    </div>
                    {reason ? (
                      <div className="mt-1 text-[10px] leading-tight text-amber-300">
                        {reason}
                      </div>
                    ) : null}
                  </div>
                  <span className="nums flex-shrink-0 text-base font-bold text-neutral-50">
                    ×{me.devCards[row.card]}
                    {row.newCount > 0 ? (
                      <span className="ml-1 text-[10px] font-medium text-amber-300">
                        ({row.newCount}{' '}
                        {row.newCount === 1 ? 'nueva' : 'nuevas'})
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {hiddenVP > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/[0.08] px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-200">
              Puntos de victoria ocultos
            </p>
            <p className="mt-1 text-xs leading-snug text-amber-100">
              {hiddenVPCopy(hiddenVP)}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

