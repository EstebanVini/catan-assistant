import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { BUILD_COSTS, Building, BuildType, Resource, playerVictoryPoints, victoryTarget } from '../types';
import { buildTypeLabel, RESOURCE_NAMES_LOWER, joinList } from '../lib/spanish';
import { BuildCostBadge } from './BuildCostBadge';
import { useCollapsePref } from './CollapsibleSection';
import { TradeModal } from './TradeModal';
import { useModalA11y } from '../lib/useModalA11y';
import { BuildingGlyph, RoadGlyph, DevCardGlyph } from '../assets/icons';

interface Props {
  onPlayDev: () => void;
}

export function ActionGrid({ onPlayDev }: Props): JSX.Element | null {
  const view = useStore((s) => s.view);
  const build = useStore((s) => s.build);
  const endTurn = useStore((s) => s.endTurn);
  const specialBuildDone = useStore((s) => s.specialBuildDone);
  const declareWin = useStore((s) => s.declareWin);
  const pushToast = useStore((s) => s.pushToast);
  const [tradeOpen, setTradeOpen] = useState(false);
  // Las "recetas" (costos de construcción) se pueden esconder; preferencia
  // por dispositivo, mismo mecanismo que los colapsables (`ui.collapse.*`).
  const [recipesHidden, toggleRecipes] = useCollapsePref('buildRecipes', false);
  // Compra pendiente de confirmar. Toda compra pasa por aquí; la ciudad
  // además exige elegir qué poblado se convierte.
  const [purchase, setPurchase] = useState<BuildType | null>(null);
  // Detecta transición "antes no podía declarar → ahora sí" para añadir un
  // pulso único al CTA (encima del `anim-slide-down` de entrada). El flag
  // se resetea cuando el CTA deja de ser elegible, así un nuevo subir-de-VP
  // en otro turno vuelve a disparar el efecto.
  const wasDeclarableRef = useRef(false);
  const [declarePulseKey, setDeclarePulseKey] = useState(0);

  // Cálculos derivados (necesarios para el efecto; se replican abajo cuando
  // ya sabemos que `view.me` existe). Mantenemos la lógica simple para no
  // duplicar lecturas costosas.
  const canDeclareForEffect = (() => {
    if (!view || !view.me) return false;
    const s = view.state;
    const meId = view.me.id;
    const activeId = s.turnOrder[s.currentTurnIndex];
    if (activeId !== meId || s.phase !== 'main' || s.status !== 'playing')
      return false;
    const mp = s.players.find((p) => p.id === meId);
    if (!mp) return false;
    return playerVictoryPoints(mp) >= victoryTarget(s);
  })();

  useEffect(() => {
    if (canDeclareForEffect && !wasDeclarableRef.current) {
      wasDeclarableRef.current = true;
      // Nuevo `key` para forzar re-mount del CTA y disparar pulse-scale.
      setDeclarePulseKey((k) => k + 1);
    } else if (!canDeclareForEffect) {
      wasDeclarableRef.current = false;
    }
  }, [canDeclareForEffect]);

  if (!view || !view.me) return null;
  const { state, me } = view;

  const activeId = state.turnOrder[state.currentTurnIndex];
  const active = state.players.find((p) => p.id === activeId);
  const isMyTurn = activeId === me.id;
  const inMain = state.phase === 'main' && isMyTurn;
  const inSpecial =
    state.phase === 'specialBuild' && state.specialBuildQueue[0] === me.id;
  const myPublic = state.players.find((p) => p.id === me.id);
  const myVP = myPublic ? playerVictoryPoints(myPublic) : 0;
  const canDeclare = inMain && myVP >= victoryTarget(state);

  // Cambio A: poblados comprados este turno sin fichas registradas. El servidor
  // rechaza terminar el turno / pasar en construcción especial mientras esto no
  // esté vacío; lo anticipamos deshabilitando el botón y guiando al registro.
  const pendingCount = me.pendingSettlementRegistration?.length ?? 0;
  const hasPendingRegistration = pendingCount > 0;
  const pendingReason =
    pendingCount > 1
      ? `Registra las fichas de tus ${pendingCount} poblados nuevos antes de terminar el turno.`
      : 'Registra las fichas del poblado que construiste antes de terminar el turno.';

  // Abre la Tabla de construcción (forzada abierta mientras haya pendientes) y
  // la trae a la vista: ruta de un toque desde el botón bloqueado al registro.
  function revealConstructionTable(): void {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('section-constructionTable');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const canActWhy = (): string | null => {
    if (state.status !== 'playing') return 'La partida aún no empieza.';
    if (state.phase === 'discard') return 'Hay que descartar primero.';
    if (state.phase === 'robber') return 'Hay que mover el ladrón primero.';
    if (state.phase === 'roll') return 'Espera a que el banco tire el dado.';
    if (!inMain && !inSpecial) {
      if (state.phase === 'main' && !isMyTurn) return 'No es tu turno.';
      if (state.phase === 'specialBuild')
        return 'No es tu turno en construcción especial.';
    }
    return null;
  };

  const baseDisabled = canActWhy();
  const allowTrades = inMain; // En specialBuild no se puede intercambiar.
  const allowDevPlay = inMain; // En specialBuild no se puede jugar dev.

  // Caballeros y Ciudades: la primera Ciudad es gratis (ciudad inicial).
  const freeCity = !!me?.freeCityAvailable;

  function canAfford(type: BuildType): boolean {
    if (!me) return false;
    if (type === 'city' && freeCity) return true; // ciudad inicial gratuita
    const cost = BUILD_COSTS[type];
    return (Object.entries(cost) as [Resource, number][]).every(
      ([r, n]) => me.hand[r] >= n
    );
  }

  function missingDetail(type: BuildType): string {
    if (!me) return 'recursos';
    const cost = BUILD_COSTS[type];
    const parts: string[] = [];
    for (const [r, n] of Object.entries(cost) as [Resource, number][]) {
      const have = me.hand[r];
      if (have < n) parts.push(`${n - have} ${RESOURCE_NAMES_LOWER[r]}`);
    }
    return joinList(parts);
  }

  const mySettlements: Building[] = (me.buildings ?? []).filter(
    (b) => b.type === 'settlement'
  );

  function buildReason(type: BuildType): string | null {
    if (baseDisabled) return baseDisabled;
    if (!canAfford(type)) return `Te falta: ${missingDetail(type)}.`;
    if (type === 'city' && mySettlements.length === 0)
      return 'No tienes poblados para convertir en ciudad.';
    return null;
  }

  const tradeReason = !allowTrades
    ? state.phase === 'specialBuild'
      ? 'No puedes intercambiar en construcción especial.'
      : (baseDisabled ?? 'No es tu turno.')
    : null;
  const devReason = !allowDevPlay
    ? state.phase === 'specialBuild'
      ? 'No puedes jugar cartas en construcción especial.'
      : (baseDisabled ?? 'No es tu turno.')
    : null;

  return (
    <section className="mx-3 mt-3">
      {!inMain && !inSpecial ? (
        <div className="mb-2 rounded-md border border-white/10 bg-surface-1 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">
          {state.phase === 'main' && active
            ? `No es tu turno · ${active.name}`
            : 'No es tu turno todavía'}
        </div>
      ) : null}
      <div className="mb-1 flex items-center justify-end">
        <button
          type="button"
          onClick={toggleRecipes}
          aria-pressed={recipesHidden}
          className="min-h-[36px] rounded-md px-2 py-1 text-[11px] font-medium text-neutral-400 transition-colors active:bg-white/[0.06] active:text-neutral-200"
        >
          {recipesHidden ? 'Mostrar recetas' : 'Ocultar recetas'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['road', 'settlement', 'city', 'devcard'] as BuildType[]).map((t) => {
          const reason = buildReason(t);
          const isDisabled = reason !== null;
          return (
            <button
              key={t}
              type="button"
              disabled={isDisabled}
              onClick={() => setPurchase(t)}
              title={reason ?? undefined}
              className={
                'group min-h-[88px] rounded-xl border p-3 text-left transition-all ' +
                (isDisabled
                  ? 'cursor-not-allowed border-white/[0.06] bg-surface-1 opacity-70'
                  : 'border-white/12 bg-surface-2 bg-gradient-to-b from-white/[0.07] to-white/[0.03] shadow-wood active:scale-[0.98] active:bg-white/[0.09]')
              }
            >
              <div
                className={
                  'text-sm font-semibold tracking-tight ' +
                  (isDisabled ? 'text-neutral-400' : 'text-neutral-50')
                }
              >
                {buildTypeLabel(t)}
              </div>
              {!recipesHidden ? (
                <div className="mt-2">
                  {t === 'city' && freeCity ? (
                    <span className="inline-flex items-center rounded-md border border-gold/40 bg-gold/[0.12] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-gold-light">
                      Gratis · ciudad inicial
                    </span>
                  ) : (
                    <BuildCostBadge type={t} />
                  )}
                </div>
              ) : null}
              {reason ? (
                <div className="mt-1.5 text-[10px] leading-tight text-neutral-500">
                  {reason}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <DisabledAwareButton
          label="Intercambiar"
          disabled={!allowTrades}
          reason={tradeReason}
          onClick={() => setTradeOpen(true)}
          onDisabledClick={() => {
            if (tradeReason) pushToast('info', tradeReason);
          }}
        />
        <DisabledAwareButton
          label="Jugar carta de desarrollo"
          disabled={!allowDevPlay}
          reason={devReason}
          onClick={onPlayDev}
          onDisabledClick={() => {
            if (devReason) pushToast('info', devReason);
          }}
        />
      </div>
      {/* En construcción especial, si no puedo pagar nada, recordatorio
          breve para que sepa que "Listo, paso" es la salida natural. */}
      {inSpecial &&
      !canAfford('road') &&
      !canAfford('settlement') &&
      !canAfford('city') &&
      !canAfford('devcard') ? (
        <p className="mt-2 text-center text-[11px] text-neutral-400">
          No alcanza para construir nada. Pulsa "Listo, paso".
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        {/* CTA "Declarar victoria" sobre "Terminar turno" cuando aplica
            (brief Fase 2 §2.4). Se añade, no reemplaza. */}
        {canDeclare ? (
          // `key` ligado al `declarePulseKey` para que el primer mount tras
          // pasar a declarable reinicie las animaciones. Combinamos
          // `anim-slide-down` (entrada) con `anim-pulse-scale` (acuse único)
          // — ambos se cancelan correctamente en reduced-motion.
          <button
            key={`declare-${declarePulseKey}`}
            type="button"
            onClick={() => declareWin()}
            className="nums anim-slide-down anim-pulse-scale min-h-[60px] w-full rounded-xl bg-amber-400 px-3 py-3 text-[17px] font-bold tracking-tight text-neutral-950 shadow-cta-amber ring-1 ring-amber-300/60 transition-all active:scale-[0.99] active:bg-amber-300"
          >
            Declarar victoria con {myVP} puntos
          </button>
        ) : null}
        {inSpecial ? (
          // "Listo, paso": bloqueado si hay un poblado nuevo sin registrar
          // (el server rechaza `specialBuild:done`). Tap bloqueado → toast +
          // revelar la Tabla de construcción.
          <button
            type="button"
            aria-disabled={hasPendingRegistration}
            title={hasPendingRegistration ? pendingReason : undefined}
            onClick={() => {
              if (hasPendingRegistration) {
                pushToast('info', pendingReason);
                revealConstructionTable();
                return;
              }
              specialBuildDone();
            }}
            className={
              'min-h-[56px] w-full rounded-xl px-3 py-2 text-base font-bold tracking-tight transition-all ' +
              (hasPendingRegistration
                ? 'cursor-not-allowed border border-amber-400/30 bg-surface-2 text-neutral-500'
                : 'bg-emerald-500 text-neutral-950 shadow-cta active:scale-[0.99] active:bg-emerald-400')
            }
          >
            Listo, paso
          </button>
        ) : (
          <button
            type="button"
            aria-disabled={!inMain || hasPendingRegistration}
            disabled={!inMain && !hasPendingRegistration}
            title={
              hasPendingRegistration
                ? pendingReason
                : inMain
                  ? undefined
                  : (baseDisabled ?? 'No es tu turno.')
            }
            onClick={() => {
              if (!inMain) return;
              if (hasPendingRegistration) {
                pushToast('info', pendingReason);
                revealConstructionTable();
                return;
              }
              endTurn();
            }}
            className={
              'min-h-[56px] w-full rounded-xl px-3 py-2 text-base font-bold tracking-tight transition-all ' +
              (inMain && !hasPendingRegistration
                ? 'bg-emerald-500 text-neutral-950 shadow-cta active:scale-[0.99] active:bg-emerald-400'
                : inMain && hasPendingRegistration
                  ? 'cursor-not-allowed border border-amber-400/30 bg-surface-2 text-neutral-500'
                  : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500')
            }
          >
            Terminar turno
          </button>
        )}
        {/* Aviso ámbar siempre visible cuando hay registro pendiente, en mi
            turno (main o construcción especial). No depende de tocar el botón. */}
        {hasPendingRegistration && (inMain || inSpecial) ? (
          <button
            type="button"
            onClick={revealConstructionTable}
            className="flex w-full items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/[0.08] px-3 py-2 text-left transition-colors active:bg-amber-500/[0.14]"
          >
            <PendingWarnIcon />
            <span className="flex-1 text-[12px] font-medium leading-snug text-amber-200">
              {pendingCount > 1
                ? `Te faltan ${pendingCount} poblados por registrar. Toca para registrar sus fichas.`
                : 'Registra las fichas de tu poblado nuevo para terminar el turno. Toca para registrarlas.'}
            </span>
          </button>
        ) : null}
      </div>
      {tradeOpen ? <TradeModal onClose={() => setTradeOpen(false)} /> : null}
      {purchase ? (
        <PurchaseConfirmModal
          type={purchase}
          free={purchase === 'city' && freeCity}
          settlements={mySettlements}
          onClose={() => setPurchase(null)}
          onConfirm={(settlementId) => {
            build(purchase, settlementId);
            setPurchase(null);
          }}
        />
      ) : null}
    </section>
  );
}

// Confirmación de compra: toda compra con recursos pide un "¿Seguro?" con el
// costo a la vista. La Ciudad además exige elegir qué poblado se convierte —
// la Tabla de construcción se actualiza sola al confirmar.
function PurchaseConfirmModal({
  type,
  free = false,
  settlements,
  onClose,
  onConfirm,
}: {
  type: BuildType;
  free?: boolean;
  settlements: Building[];
  onClose: () => void;
  onConfirm: (settlementId?: string) => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(ref, onClose);
  const [settlementId, setSettlementId] = useState<string | null>(null);
  const needsSettlement = type === 'city';
  const ready = !needsSettlement || settlementId !== null;

  const icon =
    type === 'road' ? (
      <RoadGlyph size={56} />
    ) : type === 'devcard' ? (
      <DevCardGlyph card="knight" size={56} />
    ) : (
      <BuildingGlyph type={type} size={56} />
    );

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-title"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="min-w-0 flex-1">
            <h2
              id="purchase-title"
              className="text-base font-semibold tracking-tight text-neutral-50"
            >
              {free ? 'Establecer ciudad inicial' : `Comprar ${buildTypeLabel(type).toLowerCase()}`}
            </h2>
            <div className="mt-1.5">
              {free ? (
                <span className="inline-flex items-center rounded-md border border-gold/40 bg-gold/[0.12] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-gold-light">
                  Gratis · ciudad inicial
                </span>
              ) : (
                <BuildCostBadge type={type} />
              )}
            </div>
          </div>
        </div>

        {needsSettlement ? (
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
              ¿Qué poblado se convierte en ciudad?
            </p>
            <div className="mt-1.5 space-y-1.5">
              {settlements.map((b, i) => {
                const selected = settlementId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSettlementId(b.id)}
                    className={
                      'flex min-h-[48px] w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all active:scale-[0.99] ' +
                      (selected
                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-50'
                        : 'border-white/10 bg-surface-2 text-neutral-100')
                    }
                  >
                    <BuildingGlyph type="settlement" size={24} />
                    <span className="flex-1 text-sm font-medium">
                      Poblado {i + 1}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {b.spots.length === 0
                        ? 'sin fichas'
                        : b.spots
                            .map((s) => `${s.number} ${RESOURCE_NAMES_LOWER[s.resource]}`)
                            .join(' · ')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-[11px] leading-snug text-neutral-400">
          {type === 'settlement'
            ? 'Al confirmar se descuentan los recursos y aparece el poblado en tu Tabla de construcción para registrar sus fichas.'
            : type === 'city'
              ? 'Al confirmar se descuentan los recursos y el poblado elegido sube a ciudad en tu Tabla de construcción.'
              : type === 'devcard'
                ? 'Al confirmar se descuentan los recursos y recibes la carta superior del mazo.'
                : 'Al confirmar se descuentan los recursos.'}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => onConfirm(settlementId ?? undefined)}
            className={
              'min-h-[48px] flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ' +
              (ready
                ? 'bg-emerald-500 text-neutral-950 shadow-cta active:scale-[0.99] active:bg-emerald-400'
                : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500')
            }
          >
            {ready ? 'Confirmar compra' : 'Elige un poblado'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Triángulo de aviso (acción requerida, no error destructivo). Decorativo: el
// texto vecino lleva el significado.
function PendingWarnIcon(): JSX.Element {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      aria-hidden
      className="mt-0.5 flex-shrink-0 text-amber-300"
    >
      <path
        d="M12 3.5 L21.5 20 H2.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path
        d="M12 9.5 V14"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" />
    </svg>
  );
}

// Botón que muestra toast al tappear cuando está deshabilitado. En móvil el
// atributo `title` no es accesible sin hover; el toast cubre ese gap.
function DisabledAwareButton({
  label,
  disabled,
  reason,
  onClick,
  onDisabledClick,
}: {
  label: string;
  disabled: boolean;
  reason: string | null;
  onClick: () => void;
  onDisabledClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      // No usamos `disabled` para poder capturar el tap y dar feedback. En
      // su lugar emulamos disabled con `aria-disabled` + estilos y bloqueo
      // del onClick útil.
      aria-disabled={disabled}
      title={reason ?? undefined}
      onClick={() => (disabled ? onDisabledClick() : onClick())}
      className={
        'min-h-[52px] rounded-xl border px-3 py-2 text-sm font-medium transition-all ' +
        (!disabled
          ? 'border-white/12 bg-surface-2 text-neutral-100 active:scale-[0.98] active:bg-white/[0.09]'
          : 'cursor-not-allowed border-white/[0.06] bg-surface-1 text-neutral-500')
      }
    >
      {label}
    </button>
  );
}
