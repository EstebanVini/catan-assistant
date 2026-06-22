import { useRef } from 'react';
import type { FriendUser } from '../types';
import { Avatar } from './Avatar';
import { BadgeChip } from './BadgeIcon';
import { ColorChip } from './ColorChip';
import { AchievementsPanel } from './AchievementsPanel';
import { useModalA11y } from '../lib/useModalA11y';
import { COLOR_NAMES } from '../lib/spanish';
import { FireGlyph } from '../assets/icons';

// Perfil completo de un amigo (Fase 4, F4). Modal de SOLO LECTURA abierto desde
// la lista de amigos: muestra identidad + estadísticas completas + XP/logros.
//
// Reutiliza el lenguaje visual de la pantalla de Perfil (StatsCard) y el
// componente compartido `AchievementsPanel`, para que el perfil de un amigo se
// lea igual que el propio. No hay acciones sobre el amigo aquí (eliminar vive
// en la lista); este modal solo presenta.
//
// Accesibilidad: `useModalA11y` aporta focus trap, cierre con ESC, foco inicial
// y restauración del foco al disparador. El overlay cierra al tocar fuera.
// Las animaciones (`anim-slide-up`, barra de XP) degradan con la regla global
// de `prefers-reduced-motion` en index.css.

export function FriendProfileModal({
  user,
  onClose,
}: {
  user: FriendUser;
  onClose: () => void;
}): JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  const s = user.stats;
  const winPct =
    s.gamesPlayed > 0 ? Math.round((s.wins / s.gamesPlayed) * 100) : null;
  const hasBadges = s.longestRoadBadges > 0 || s.largestArmyBadges > 0;
  // Tolera `undefined` (usuarios viejos) como 0, igual que el perfil propio.
  const currentStreak = s.currentWinStreak ?? 0;
  const longestStreak = s.longestWinStreak ?? 0;
  const color = user.color ?? null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-profile-title"
        onClick={(e) => e.stopPropagation()}
        className="anim-slide-up flex h-[92dvh] w-full max-w-md flex-col rounded-t-2xl border border-white/10 bg-neutral-900 shadow-2xl ring-1 ring-white/5 sm:h-auto sm:max-h-[88dvh] sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/8 px-4 pb-3 pt-4">
          <h2
            id="friend-profile-title"
            className="font-display text-base font-semibold tracking-tight text-neutral-50"
          >
            Perfil
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar perfil"
            className="-mr-1 flex h-11 w-11 items-center justify-center rounded-lg text-neutral-400 transition-colors active:bg-white/10 active:text-neutral-100"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          {/* Encabezado — identidad */}
          <section className="mt-4 flex items-center gap-3.5 rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card">
            <Avatar
              seed={user.username}
              name={user.displayName}
              avatarUrl={user.avatarUrl ?? undefined}
              size={64}
              streak={currentStreak}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold tracking-tight text-neutral-50">
                {user.displayName}
              </p>
              <p className="truncate text-xs text-neutral-500">
                @{user.username}
              </p>
              {color ? (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-300">
                  <ColorChip color={color} size={14} />
                  {COLOR_NAMES[color]}
                </p>
              ) : null}
            </div>
          </section>

          {/* Estadísticas — mismo lenguaje visual que StatsCard del Perfil */}
          <section className="mt-4 rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card">
            <h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
              Estadísticas
            </h3>
            {s.gamesPlayed === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-xs leading-relaxed text-neutral-400">
                {user.displayName} aún no termina ninguna partida. Sus
                resultados aparecerán aquí.
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="nums text-count text-neutral-50">
                      {s.gamesPlayed}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-400">
                      Partidas
                    </p>
                  </div>
                  <div>
                    <p className="nums text-count text-emerald-300">{s.wins}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-400">
                      Victorias
                    </p>
                  </div>
                  <div>
                    <p className="nums text-count text-neutral-300">
                      {s.losses}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-400">
                      Derrotas
                    </p>
                  </div>
                </div>

                {/* Rachas: actual + máxima en una sola fila (mismo acento de
                    fuego/dorado que la insignia de racha) para vincularlas
                    visualmente sin competir con las métricas de arriba. */}
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-gold/20 bg-gold/[0.05] px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-300">
                      <FireGlyph size={15} />
                      Racha actual
                    </p>
                    <p className="nums text-count leading-none text-gold-light">
                      {currentStreak}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-gold/20 bg-gold/[0.05] px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-300">
                      <FireGlyph size={15} />
                      Racha máxima
                    </p>
                    <p className="nums text-count leading-none text-gold-light">
                      {longestStreak}
                    </p>
                  </div>
                </div>

                {winPct !== null ? (
                  <p className="mt-2.5 text-center text-xs text-neutral-400">
                    <span className="nums font-semibold text-neutral-100">
                      {winPct}%
                    </span>{' '}
                    de victorias
                  </p>
                ) : null}

                {hasBadges ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
                    {s.longestRoadBadges > 0 ? (
                      <BadgeChip
                        variant="road"
                        label={`Camino más largo ×${s.longestRoadBadges}`}
                      />
                    ) : null}
                    {s.largestArmyBadges > 0 ? (
                      <BadgeChip
                        variant="army"
                        label={`Ejército más grande ×${s.largestArmyBadges}`}
                      />
                    ) : null}
                  </div>
                ) : null}

                <p className="mt-3 text-xs text-neutral-400">
                  Puntos de victoria acumulados:{' '}
                  <span className="nums font-semibold text-neutral-100">
                    {s.totalVictoryPoints}
                  </span>
                </p>
              </>
            )}
          </section>

          {/* XP, nivel y logros — componente compartido (solo lectura) */}
          <AchievementsPanel
            xp={s.xp ?? 0}
            achievements={s.achievements ?? []}
            title="Logros"
          />

          {/* Cierre — acción única de este modal de solo lectura */}
          <button
            type="button"
            onClick={onClose}
            className="mb-1 mt-4 min-h-[44px] w-full rounded-lg border border-white/12 bg-surface-3 px-3 py-2.5 text-sm font-semibold text-neutral-100 transition-all active:scale-[0.99] active:bg-white/10"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
