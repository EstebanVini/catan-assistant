import { useRef, useState } from 'react';
import {
  KNIGHT_RANK_NAMES,
  Knight,
  PublicPlayer,
  playerVictoryPoints,
} from '../types';
import { useModalA11y } from '../lib/useModalA11y';
import { Avatar } from './Avatar';
import { ColorChip } from './ColorChip';
import { KnightGlyph } from '../assets/icons';

// Picker de OPONENTE para las cartas que apuntan a un rival (§2.10):
//  - spy (Espía): solo rivales con cartas de progreso (`progressCardsCount > 0`).
//  - masterMerchant (Maestro Mercader): solo rivales con MÁS puntos que tú.
//  - deserter (Desertor): rivales con al menos un caballero; además dejas elegir
//    (opcional) cuál caballero quitar. Si no eliges, el servidor quita el primero.
//
// El cliente no decide la lógica: al confirmar invoca
// `onConfirm({ targetPlayerId, knightIds? })` y el dueño emite
// `playProgress({ card, targetPlayerId, knightIds? })`.

type TargetCard = 'spy' | 'masterMerchant' | 'deserter';

interface Props {
  card: TargetCard;
  // Oponentes (state.players sin el jugador local).
  opponents: PublicPlayer[];
  // Mis PV totales (para habilitar oponentes en Maestro Mercader).
  myVictoryPoints: number;
  // Dueño del comerciante, para contar bien los PV públicos de cada rival.
  merchantOwnerId?: string | null;
  onConfirm: (payload: { targetPlayerId: string; knightIds?: string[] }) => void;
  onClose: () => void;
}

const CARD_COPY: Record<
  TargetCard,
  { title: string; desc: string; cta: (name: string) => string }
> = {
  spy: {
    title: 'Espía',
    desc: 'Elige un rival con cartas de progreso: le robas 1 al azar. Las cartas de punto de victoria no se pueden robar.',
    cta: (name) => `Espiar a ${name}`,
  },
  masterMerchant: {
    title: 'Maestro Mercader',
    desc: 'Elige un rival con más puntos que tú: ves su mano y le robas 2 cartas (recursos o mercancías).',
    cta: (name) => `Robar a ${name}`,
  },
  deserter: {
    title: 'Desertor',
    desc: 'Elige un rival: retira uno de sus caballeros y tú colocas uno gratis del mismo rango.',
    cta: (name) => `Sobornar a ${name}`,
  },
};

// Razón por la que un oponente no es elegible para esta carta (badge gris).
function ineligibleReason(card: TargetCard): string {
  switch (card) {
    case 'spy':
      return 'Sin cartas de progreso';
    case 'masterMerchant':
      return 'No te supera en puntos';
    case 'deserter':
      return 'Sin caballeros';
  }
}

export function OpponentTargetPickerModal({
  card,
  opponents,
  myVictoryPoints,
  merchantOwnerId,
  onConfirm,
  onClose,
}: Props): JSX.Element {
  const [targetId, setTargetId] = useState<string | null>(null);
  // Caballero del rival a retirar (solo Desertor). null = el servidor quita el
  // primero.
  const [knightId, setKnightId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  const copy = CARD_COPY[card];

  function isEligible(p: PublicPlayer): boolean {
    switch (card) {
      case 'spy':
        return p.progressCardsCount > 0;
      case 'masterMerchant':
        return playerVictoryPoints(p, merchantOwnerId) > myVictoryPoints;
      case 'deserter':
        return p.knights.length > 0;
    }
  }

  const target = opponents.find((p) => p.id === targetId) ?? null;
  const anyEligible = opponents.some(isEligible);

  function selectTarget(id: string) {
    setTargetId(id);
    // Cambiar de objetivo limpia el caballero elegido (es de ese rival).
    setKnightId(null);
  }

  function handleConfirm() {
    if (!targetId || submitting) return;
    setSubmitting(true);
    onConfirm({
      targetPlayerId: targetId,
      knightIds: card === 'deserter' && knightId ? [knightId] : undefined,
    });
    window.setTimeout(() => onClose(), 200);
  }

  const targetName = target?.name ?? '';
  const confirmLabel = target ? copy.cta(targetName) : 'Elige un rival';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="target-picker-title"
        aria-describedby="target-picker-desc"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in flex max-h-[88vh] w-full max-w-sm flex-col rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card ring-1 ring-white/5"
      >
        <h2
          id="target-picker-title"
          className="text-[17px] font-semibold tracking-tight text-neutral-50"
        >
          {copy.title}
        </h2>
        <p
          id="target-picker-desc"
          className="mt-1 text-xs leading-relaxed text-neutral-400"
        >
          {copy.desc}
        </p>

        <div className="-mr-1 mt-3 flex-1 overflow-y-auto pr-1">
          {opponents.length === 0 || !anyEligible ? (
            <p className="rounded-lg border border-white/10 bg-surface-2 px-3 py-4 text-center text-[12px] leading-snug text-neutral-300">
              No hay ningún rival válido para esta carta ahora mismo.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {opponents.map((p) => {
                const eligible = isEligible(p);
                const isSel = targetId === p.id;
                const vp = playerVictoryPoints(p, merchantOwnerId);
                // Métrica relevante según la carta.
                const stat =
                  card === 'spy'
                    ? `${p.progressCardsCount} ${p.progressCardsCount === 1 ? 'carta de progreso' : 'cartas de progreso'}`
                    : card === 'deserter'
                      ? `${p.knights.length} ${p.knights.length === 1 ? 'caballero' : 'caballeros'}`
                      : `${vp} ${vp === 1 ? 'punto' : 'puntos'}`;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={isSel}
                      disabled={!eligible || submitting}
                      onClick={() => selectTarget(p.id)}
                      className={
                        'flex min-h-[56px] w-full items-center gap-2.5 rounded-xl border-2 px-2.5 py-2 text-left transition-colors active:scale-[0.99] ' +
                        (isSel
                          ? 'border-amber-400/70 bg-amber-400/[0.10] shadow-card'
                          : eligible
                            ? 'border-white/[0.10] bg-surface-2 active:bg-white/[0.06]'
                            : 'cursor-not-allowed border-white/[0.06] bg-surface-1 opacity-55')
                      }
                    >
                      <Avatar
                        seed={p.name}
                        name={p.name}
                        avatarUrl={p.avatarUrl}
                        size={36}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <ColorChip color={p.color} size={12} />
                          <span className="truncate text-[13px] font-semibold tracking-tight text-neutral-50">
                            {p.name}
                          </span>
                        </div>
                        <div className="nums mt-0.5 text-[11px] text-neutral-400">
                          {stat}
                        </div>
                      </div>
                      {eligible ? (
                        <span
                          aria-hidden
                          className={
                            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ' +
                            (isSel
                              ? 'border-amber-400 bg-amber-400'
                              : 'border-white/25 bg-transparent')
                          }
                        >
                          {isSel ? (
                            <svg width={11} height={11} viewBox="0 0 24 24">
                              <path
                                d="M5 13 L10 18 L19 6"
                                fill="none"
                                stroke="#0a0a0a"
                                strokeWidth={3}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : null}
                        </span>
                      ) : (
                        <span className="flex-shrink-0 rounded-full border border-white/15 bg-surface-3 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.03em] text-neutral-400">
                          {ineligibleReason(card)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Sub-paso de Desertor: cuál caballero del rival quitar (opcional). */}
          {card === 'deserter' && target ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-surface-2 p-2.5">
              <div className="text-[11px] font-semibold tracking-tight text-neutral-100">
                ¿Cuál caballero de {target.name} se retira?
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-neutral-400">
                Opcional. Si no eliges, se quita el primero. Tú colocas uno gratis
                del mismo rango.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={knightId === null}
                  onClick={() => setKnightId(null)}
                  disabled={submitting}
                  className={
                    'min-h-[44px] rounded-lg border-2 px-3 py-2 text-[11px] font-semibold tracking-tight transition-colors active:scale-[0.97] ' +
                    (knightId === null
                      ? 'border-amber-400/70 bg-amber-400/[0.10] text-amber-200'
                      : 'border-white/[0.10] bg-surface-3 text-neutral-300 active:bg-white/[0.06]')
                  }
                >
                  El primero
                </button>
                {target.knights.map((k: Knight) => {
                  const isSel = knightId === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      aria-pressed={isSel}
                      aria-label={`Quitar caballero ${KNIGHT_RANK_NAMES[k.rank]} ${k.active ? 'activo' : 'inactivo'}`}
                      onClick={() => setKnightId(k.id)}
                      disabled={submitting}
                      className={
                        'flex min-h-[44px] items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 transition-colors active:scale-[0.97] ' +
                        (isSel
                          ? 'border-amber-400/70 bg-amber-400/[0.10]'
                          : 'border-white/[0.10] bg-surface-3 active:bg-white/[0.06]')
                      }
                    >
                      <KnightGlyph rank={k.rank} active={k.active} size={26} />
                      <span className="text-[11px] font-semibold tracking-tight text-neutral-100">
                        {KNIGHT_RANK_NAMES[k.rank]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!targetId || submitting}
          className={
            'mt-4 min-h-[56px] w-full flex-shrink-0 rounded-xl px-3 py-3 text-base font-bold tracking-tight transition-all active:scale-[0.97] ' +
            (targetId && !submitting
              ? 'bg-amber-400 text-neutral-950 shadow-cta-amber active:bg-amber-300'
              : 'cursor-not-allowed border border-white/10 bg-surface-2 text-neutral-500')
          }
        >
          {submitting ? 'Aplicando…' : confirmLabel}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="mt-3 min-h-[44px] w-full flex-shrink-0 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium text-neutral-200 transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
