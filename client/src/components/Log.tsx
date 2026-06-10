import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { ColorChip } from './ColorChip';

// Log invertido (más reciente arriba), colapsable. Badge si hay nuevas.
export function Log(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const [collapsed, setCollapsed] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const lastSeenLenRef = useRef<number | null>(null);

  // Conjunto de IDs de entradas que acaban de llegar para animar su entrada
  // con `anim-slide-down`. Las entradas se "asientan" tras 600 ms.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!view) return;
    const len = view.state.log.length;
    if (lastSeenLenRef.current === null) {
      // Primera medición: tomar el log actual como baseline.
      lastSeenLenRef.current = len;
      for (const e of view.state.log) knownIdsRef.current.add(e.id);
      return;
    }
    if (collapsed) {
      if (len > lastSeenLenRef.current) {
        setNewCount(len - lastSeenLenRef.current);
      }
    } else {
      lastSeenLenRef.current = len;
      setNewCount(0);
    }

    // Detectar entradas nuevas para animarlas (sólo si el log está abierto;
    // si está colapsado no hay nada que animar y al abrirlo se pintarán
    // estables, que es lo correcto).
    const known = knownIdsRef.current;
    const incoming: string[] = [];
    for (const e of view.state.log) {
      if (!known.has(e.id)) {
        known.add(e.id);
        incoming.push(e.id);
      }
    }
    if (incoming.length > 0 && !collapsed) {
      setFreshIds((prev) => {
        const next = new Set(prev);
        for (const id of incoming) next.add(id);
        return next;
      });
      const t = window.setTimeout(() => {
        setFreshIds((prev) => {
          if (prev.size === 0) return prev;
          const next = new Set(prev);
          for (const id of incoming) next.delete(id);
          return next;
        });
      }, 600);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [view, collapsed]);

  if (!view) return null;
  const { state } = view;
  const reversed = [...state.log].reverse();

  return (
    <section className="mx-3 mb-6 mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] shadow-soft">
      <button
        type="button"
        onClick={() => {
          if (collapsed) {
            lastSeenLenRef.current = state.log.length;
            setNewCount(0);
          }
          setCollapsed((c) => !c);
        }}
        aria-expanded={!collapsed}
        aria-controls="log-list"
        className="flex w-full items-center justify-between px-3 py-3 transition-colors active:bg-white/[0.04]"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
          Registro
          {newCount > 0 && collapsed ? (
            <span className="anim-badge-pulse nums rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-bold text-neutral-950">
              +{newCount} {newCount === 1 ? 'nueva' : 'nuevas'}
            </span>
          ) : null}
        </span>
        <span className="nums text-xs text-neutral-500">
          {state.log.length} {collapsed ? '+' : '−'}
        </span>
      </button>
      {!collapsed ? (
        <ul
          id="log-list"
          aria-live="polite"
          className="max-h-[280px] space-y-2 overflow-y-auto border-t border-white/10 px-3 py-2.5"
        >
          {reversed.length === 0 ? (
            <li className="py-3 text-center text-xs leading-relaxed text-neutral-400">
              Aún no pasa nada. Cuando alguien tire el dado o construya, lo verás aquí.
            </li>
          ) : null}
          {reversed.map((entry) => {
            const player = entry.playerId
              ? state.players.find((p) => p.id === entry.playerId)
              : null;
            const fresh = freshIds.has(entry.id);
            return (
              <li
                key={entry.id}
                className={
                  'flex items-start gap-2 text-[13px] leading-snug ' +
                  (fresh ? 'anim-slide-down' : '')
                }
              >
                <span className="mt-[3px] flex-shrink-0">
                  {player ? (
                    <ColorChip color={player.color} size={12} />
                  ) : (
                    <span className="inline-block h-3 w-3 rounded-full border border-white/15 bg-neutral-700" />
                  )}
                </span>
                <span className="flex-1 text-neutral-200">{entry.text}</span>
                <span className="nums flex-shrink-0 text-[10px] text-neutral-500">
                  {formatRelTime(entry.ts)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function formatRelTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  return `${Math.floor(diffSec / 3600)}h`;
}
