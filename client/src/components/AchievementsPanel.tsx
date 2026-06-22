import { useMemo, useState } from 'react';
import { ACHIEVEMENTS, levelProgress } from '../lib/achievements';

// Panel de Logros + XP. Reutilizable: el perfil propio y el de un amigo lo
// renderizan con los mismos props (solo lectura).
//
//  - Cabecera de XP: nivel actual, XP total y barra de progreso al siguiente
//    nivel. La barra se anima con `transform: scaleX` (origen izquierda), nunca
//    con propiedades de layout; en `prefers-reduced-motion` la transición queda
//    neutralizada por la regla global de index.css.
//  - Dorado RESERVADO (titulos/marca/insignias): aqui se usa para los logros
//    DESBLOQUEADOS, que son la "moneda" lograda. Los bloqueados van en gris.
//  - Toggle "Ocultar logros no conseguidos": estado local, default false.
//
// El catalogo (ACHIEVEMENTS, 19) y el modelo de niveles viven en
// `lib/achievements.ts` (espejo del servidor); aqui solo presentamos.

const TOTAL = ACHIEVEMENTS.length;

function MedalGlyph({ size = 18 }: { size?: number }): JSX.Element {
  // Sello/medalla Catan: aro dorado con cinta. Decorativo (aria-hidden lo pone
  // el contenedor del item via aria-label).
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M8.5 3 L12 8 L15.5 3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={12} cy={14.5} r={5.5} fill="none" stroke="currentColor" strokeWidth={1.6} />
      <path
        d="M12 12 L12.95 13.95 L15.1 14.25 L13.55 15.75 L13.9 17.9 L12 16.9 L10.1 17.9 L10.45 15.75 L8.9 14.25 L11.05 13.95 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

function LockGlyph({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect
        x={5}
        y={10.5}
        width={14}
        height={9}
        rx={2}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <path
        d="M8 10.5 V8 a4 4 0 0 1 8 0 V10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function AchievementRow({
  name,
  description,
  xp,
  unlocked,
}: {
  name: string;
  description: string;
  xp: number;
  unlocked: boolean;
}): JSX.Element {
  const stateWord = unlocked ? 'desbloqueado' : 'bloqueado';
  return (
    <li
      aria-label={`${name}: ${stateWord}. ${description} ${unlocked ? 'Conseguido' : 'Otorga'} ${xp} XP.`}
      className={
        'flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors ' +
        (unlocked
          ? 'border-gold/35 bg-gold/[0.06] shadow-soft'
          : 'border-white/8 bg-surface-2/60')
      }
    >
      <span
        aria-hidden
        className={
          'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ' +
          (unlocked
            ? 'border border-gold/55 bg-gradient-to-b from-[#3a2417] to-[#241509] text-gold-light shadow-medal'
            : 'border border-white/10 bg-neutral-950/50 text-neutral-600')
        }
      >
        {unlocked ? <MedalGlyph size={18} /> : <LockGlyph size={16} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={
              'truncate text-sm font-bold tracking-tight ' +
              (unlocked ? 'text-neutral-50' : 'text-neutral-400')
            }
          >
            {name}
          </p>
          <span
            className={
              'nums flex-shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-none ' +
              (unlocked
                ? 'border-gold/45 bg-gold/15 text-gold-light'
                : 'border-white/10 bg-neutral-950/40 text-neutral-500')
            }
          >
            +{xp} XP
          </span>
        </div>
        <p
          className={
            'mt-1 text-xs leading-snug ' +
            (unlocked ? 'text-neutral-300' : 'text-neutral-500')
          }
        >
          {description}
        </p>
        {!unlocked ? (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            <LockGlyph size={11} /> Bloqueado
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function AchievementsPanel({
  xp,
  achievements,
  title = 'Logros',
}: {
  xp: number;
  achievements: string[];
  title?: string;
}): JSX.Element {
  const [hideLocked, setHideLocked] = useState(false);

  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;
  const unlockedSet = useMemo(() => new Set(achievements), [achievements]);
  const { level, toNext, pct } = levelProgress(safeXp);

  // Desbloqueados primero (conservando el orden del catalogo dentro de cada
  // grupo); bloqueados despues. Estable y sin mutar ACHIEVEMENTS.
  const ordered = useMemo(() => {
    const unlocked = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id));
    const locked = ACHIEVEMENTS.filter((a) => !unlockedSet.has(a.id));
    return { unlocked, locked };
  }, [unlockedSet]);

  const unlockedCount = ordered.unlocked.length;
  const barPct = Math.max(0, Math.min(1, pct));
  const visible = hideLocked
    ? ordered.unlocked
    : [...ordered.unlocked, ...ordered.locked];

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
          {title}
        </h2>
        <span className="nums text-[11px] font-semibold text-neutral-400">
          {unlockedCount}/{TOTAL} logros
        </span>
      </div>

      {/* Cabecera de XP / nivel */}
      <div className="mt-3 rounded-xl border border-gold/25 bg-gold/[0.05] p-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-full border border-gold/55 bg-gradient-to-b from-[#3a2417] to-[#241509] shadow-medal"
            >
              <span className="text-[8px] font-semibold uppercase leading-none tracking-[0.06em] text-gold/80">
                Nv
              </span>
              <span className="nums text-base font-bold leading-none text-gold-light [text-shadow:0_1px_0_rgba(0,0,0,0.55)]">
                {level}
              </span>
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                Nivel {level}
              </p>
              <p className="nums text-sm font-bold leading-tight text-neutral-50">
                {safeXp} XP
              </p>
            </div>
          </div>
        </div>

        {/* Barra de progreso: scaleX (origen izquierda) sobre una pista fija.
            Solo transform → respeta la guia de motion y reduced-motion global. */}
        <div className="mt-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(barPct * 100)}
            aria-label={`Progreso del nivel ${level}: ${Math.round(barPct * 100)}%`}
            className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-neutral-950/60"
          >
            <div
              className="h-full origin-left rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-light transition-transform duration-500 ease-out"
              style={{ transform: `scaleX(${barPct})` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-400">
            {toNext > 0 ? (
              <>
                Faltan{' '}
                <span className="nums font-semibold text-gold-light">{toNext} XP</span>{' '}
                para el nivel {level + 1}
              </>
            ) : (
              'Nivel máximo alcanzado'
            )}
          </p>
        </div>
      </div>

      {/* Toggle: ocultar logros no conseguidos */}
      <button
        type="button"
        aria-pressed={hideLocked}
        onClick={() => setHideLocked((v) => !v)}
        className={
          'mt-3 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border px-3 transition-colors ' +
          (hideLocked
            ? 'border-gold/45 bg-gold/10 text-neutral-100'
            : 'border-white/10 bg-surface-2 text-neutral-300 active:bg-white/[0.06]')
        }
      >
        <span className="text-xs font-semibold">Ocultar logros no conseguidos</span>
        <span
          aria-hidden
          className={
            'relative inline-flex h-6 w-10 flex-shrink-0 items-center rounded-full border transition-colors ' +
            (hideLocked
              ? 'border-gold/55 bg-gold/40'
              : 'border-white/15 bg-neutral-950/70')
          }
        >
          <span
            className={
              'absolute h-4 w-4 rounded-full bg-neutral-100 shadow-soft transition-transform duration-200 ease-out ' +
              (hideLocked ? 'translate-x-[1.25rem]' : 'translate-x-[0.2rem]')
            }
          />
        </span>
      </button>

      {/* Lista de logros */}
      <ul className="mt-3 flex flex-col gap-2">
        {visible.map((a) => (
          <AchievementRow
            key={a.id}
            name={a.name}
            description={a.description}
            xp={a.xp}
            unlocked={unlockedSet.has(a.id)}
          />
        ))}
      </ul>

      {hideLocked && unlockedCount === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-xs leading-relaxed text-neutral-400">
          Aún no desbloqueas ningún logro. Desactiva el filtro para ver todos los
          que puedes conseguir.
        </p>
      ) : null}
    </section>
  );
}
