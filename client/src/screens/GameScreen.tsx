import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { TopBar } from '../components/TopBar';
import { ContextBanner } from '../components/ContextBanner';
import { HandView } from '../components/HandView';
import { ActionGrid } from '../components/ActionGrid';
import { BankPanel } from '../components/BankPanel';
import { ConstructionTable } from '../components/ConstructionTable';
import { PublicPlayersPanel } from '../components/PublicPlayersPanel';
import { Log } from '../components/Log';
import { DiscardModal } from '../components/DiscardModal';
import { RobberFlow } from '../components/RobberFlow';
import { PortIncomingModal } from '../components/PortIncomingModal';
import { TradeIncomingModal } from '../components/TradeIncomingModal';
import { SpecialBuildBanner } from '../components/SpecialBuildBanner';
import { MonopolyPickerModal } from '../components/MonopolyPickerModal';
import { YearOfPlentyPickerModal } from '../components/YearOfPlentyPickerModal';
import { RoadBuildingConfirmModal } from '../components/RoadBuildingConfirmModal';
import { DiceStats } from '../components/DiceStats';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { DevCardType, totalVictoryPoints } from '../types';
import { DEV_CARD_NAMES, vpCardsCopy } from '../lib/spanish';
import { DevCardGlyph } from '../assets/icons';
import { DevCardPreview } from '../components/DevCardPreview';
import { DevCardsPanel } from '../components/DevCardsPanel';
import { EndGameButton } from '../components/EndGameButton';
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
      // Pulso háptico (150 ms) sólo la primera vez que el CTA aparece en
      // este turno; el flag se resetea cuando deja de ser declarable.
      safeVibrate(150);
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
    <main className="mx-auto min-h-[100dvh] max-w-md pb-[max(env(safe-area-inset-bottom),0.5rem)] md:max-w-3xl lg:max-w-7xl">
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
      {/* Layout responsivo (sólo md+/lg+; en móvil estos wrappers son <div>
          neutros que no cambian el flujo en columna):
           - md (tablet): 2 columnas — izquierda: banners + mano + acciones y
             debajo jugadores + dados + log; derecha: banco + construcción
             (row-span-2 para que la columna izquierda fluya sin huecos).
           - lg (laptop/desktop): 3 columnas — (1) banners + mano + acciones,
             (2) banco + construcción, (3) jugadores + dados + log.
          Los componentes internos conservan sus mx-3/mt-3 propios: el canal
          visual entre columnas queda en 24px, igual al ritmo móvil. */}
      <div className="md:grid md:grid-cols-2 md:items-start lg:grid-cols-3">
        <div className="min-w-0">
          {/* En specialBuild usamos el banner dedicado (con cola + skip).
              En cualquier otra fase, el ContextBanner clásico. */}
          {state.phase === 'specialBuild' ? (
            <SpecialBuildBanner />
          ) : (
            <ContextBanner />
          )}
          <HandView />
          <ActionGrid onPlayDev={() => setDevSub({ kind: 'list' })} />
        </div>
        <div className="min-w-0 md:row-span-2 lg:row-span-1">
          <BankPanel />
          <ConstructionTable />
          <DevCardsPanel />
        </div>
        <div className="min-w-0">
          <PublicPlayersPanel />
          <DiceStatsCollapsible
            stats={state.diceStats}
            lastNumber={state.lastRolledNumber}
          />
          <Log />
          <EndGameButton />
        </div>
      </div>
      <DiscardModal />
      <RobberFlow />
      <PortIncomingModal />
      <TradeIncomingModal />

      {devSub.kind === 'list' ? (
        <PlayDevModal
          onClose={() => setDevSub({ kind: 'none' })}
          onPickKnight={() => {
            playDevCard('knight');
            setDevSub({ kind: 'none' });
          }}
          onPickVP={() => {
            playDevCard('vp');
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
// Fase 3: preferencia persistente por dispositivo (`ui.collapse.diceStats`,
// default colapsada — ya decidido en Fase 2). Dentro de `BankPanel` el
// histograma sigue expandido por su uso operativo.
function DiceStatsCollapsible({
  stats,
  lastNumber,
}: {
  stats: Record<number, number>;
  lastNumber: number | null;
}): JSX.Element {
  const total = Object.values(stats).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <CollapsibleSection
      id="diceStats"
      title="Estadísticas de dados"
      defaultCollapsed
      summary={
        <span className="nums text-[11px] text-neutral-400">
          {total} {total === 1 ? 'tirada' : 'tiradas'}
        </span>
      }
    >
      <div className="px-3 pb-3 pt-2">
        {total === 0 ? (
          <p className="anim-fade-in text-center text-[11px] text-neutral-400">
            Aún no hay tiradas.
          </p>
        ) : (
          // `animateOnMount` activa el stagger de 30 ms por barra cada vez
          // que se abre la sección (el contenido se re-monta al abrir).
          <DiceStats
            stats={stats}
            variant="default"
            lastRolledNumber={lastNumber}
            animateOnMount
          />
        )}
      </div>
    </CollapsibleSection>
  );
}

// Modal "Jugar carta de desarrollo" — Fase 2 §1, revisado:
//  - Tocar una fila abre el PREVIEW de la carta (arte grande + descripción)
//    y desde ahí se confirma con "Jugar carta" — nadie juega una carta sin
//    poder leer antes qué hace.
//  - Caballero: al confirmar dispara el flujo del 7 directo (sin sub-modal).
//  - Monopolio / YoP / RoadBuilding: al confirmar abren su sub-modal.
//  - Punto de victoria: jugable — al usarla suma +1 público al marcador
//    (hasta entonces no cuenta para nadie).
//
// Reglas de disabled (un solo lugar):
//  - `available <= 0`  → no se muestra la fila (omisión, no "gris vacío").
//  - `available > 0` pero `compradaEsteTurno > 0` → fila visible; el preview
//    se abre igual (leer siempre se puede) con el CTA deshabilitado y la
//    razón "Comprada este turno".
//  - YoP adicional: deshabilitada si banco totalmente vacío.
type DevRow = {
  card: DevCardType;
  title: string;
  subtitle: string;
  available: number;
  newCount: number;
  onPick: () => void;
};

function PlayDevModal({
  onClose,
  onPickKnight,
  onPickVP,
  onPickMonopoly,
  onPickYoP,
  onPickRoadBuilding,
}: {
  onClose: () => void;
  onPickKnight: () => void;
  onPickVP: () => void;
  onPickMonopoly: () => void;
  onPickYoP: () => void;
  onPickRoadBuilding: () => void;
}): JSX.Element {
  const view = useStore((s) => s.view)!;
  const me = view.me!;
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);
  // Carta en preview (null = lista). El preview es un overlay encima de la
  // lista; cerrar el preview regresa a la lista.
  const [preview, setPreview] = useState<DevRow | null>(null);

  // Cuántas "nuevas" (compradas este turno) hay de cada tipo: esas no son
  // jugables todavía. (Las de Punto de victoria nunca entran a esa lista:
  // pueden usarse el mismo turno.)
  function newCount(card: DevCardType): number {
    return me.devCardsBoughtThisTurn.filter((c) => c === card).length;
  }

  function playable(card: DevCardType): number {
    return me.devCards[card] - newCount(card);
  }

  // No hay forma directa de saber "ya jugué una carta este turno" desde el
  // estado público; el server rechazaría la jugada. Aquí mostramos las
  // razones por carta y dejamos que el server sea autoridad. (El banco es
  // ilimitado: Año de la abundancia ya no se bloquea por banco vacío.)
  const rows: DevRow[] = [];

  if (me.devCards.knight > 0) {
    rows.push({
      card: 'knight',
      title: DEV_CARD_NAMES.knight,
      subtitle: 'Mueve el ladrón y roba 1 carta.',
      available: playable('knight'),
      newCount: newCount('knight'),
      onPick: onPickKnight,
    });
  }
  if (me.devCards.vp > 0) {
    rows.push({
      card: 'vp',
      title: DEV_CARD_NAMES.vp,
      subtitle: 'Úsala para sumar +1 punto a tu marcador.',
      available: me.devCards.vp,
      newCount: 0,
      onPick: onPickVP,
    });
  }
  if (me.devCards.monopoly > 0) {
    rows.push({
      card: 'monopoly',
      title: DEV_CARD_NAMES.monopoly,
      subtitle: 'Toma todas las cartas de 1 recurso de los demás.',
      available: playable('monopoly'),
      newCount: newCount('monopoly'),
      onPick: onPickMonopoly,
    });
  }
  if (me.devCards.yearOfPlenty > 0) {
    rows.push({
      card: 'yearOfPlenty',
      title: DEV_CARD_NAMES.yearOfPlenty,
      subtitle: 'Toma 2 cartas del banco.',
      available: playable('yearOfPlenty'),
      newCount: newCount('yearOfPlenty'),
      onPick: onPickYoP,
    });
  }
  if (me.devCards.roadBuilding > 0) {
    rows.push({
      card: 'roadBuilding',
      title: DEV_CARD_NAMES.roadBuilding,
      subtitle: 'Coloca 2 caminos sin pagar recursos.',
      available: playable('roadBuilding'),
      newCount: newCount('roadBuilding'),
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
          Toca una carta para ver qué hace antes de jugarla.
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-md border border-white/10 bg-surface-1 px-3 py-3 text-center text-xs text-neutral-300">
            No tienes cartas de desarrollo.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {rows.map((row) => (
              <button
                key={row.card}
                type="button"
                onClick={() => setPreview(row)}
                className="flex min-h-[60px] w-full items-center justify-between gap-2 rounded-lg border border-white/12 bg-surface-2 px-3 py-2 text-left transition-colors active:bg-white/[0.09]"
              >
                <DevCardGlyph card={row.card} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-50">
                    {row.title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-neutral-400">
                    {row.subtitle}
                  </div>
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
            ))}
          </div>
        )}

        {me.devCards.vp > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/[0.08] px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-200">
              Cartas de Punto de victoria
            </p>
            <p className="mt-1 text-xs leading-snug text-amber-100">
              {vpCardsCopy(me.devCards.vp)}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-white/10 bg-surface-3 px-4 py-2 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
      {preview ? (
        <DevCardPreview
          card={preview.card}
          count={me.devCards[preview.card]}
          reason={
            preview.available <= 0 && preview.newCount > 0
              ? 'Comprada este turno — no se puede jugar todavía.'
              : null
          }
          playLabel={
            preview.card === 'vp' ? 'Usar punto de victoria' : 'Jugar carta'
          }
          onClose={() => setPreview(null)}
          onPlay={() => {
            setPreview(null);
            preview.onPick();
          }}
        />
      ) : null}
    </div>
  );
}

