import { useState } from 'react';
import { useStore } from '../store';
import { DevCardType, devCardsTotal } from '../types';
import { DEV_CARD_NAMES, vpCardsCopy } from '../lib/spanish';
import { DevCardGlyph } from '../assets/icons';
import { CollapsibleSection } from './CollapsibleSection';
import { DevCardPreview } from './DevCardPreview';

const CARD_ORDER: DevCardType[] = [
  'knight',
  'vp',
  'monopoly',
  'yearOfPlenty',
  'roadBuilding',
];

// Sección "Cartas de desarrollo": qué cartas tengo, con preview de solo
// lectura (arte grande + descripción) al tocar una. Jugarlas sigue siendo
// desde "Jugar carta de desarrollo" en las acciones de turno.
export function DevCardsPanel(): JSX.Element | null {
  const view = useStore((s) => s.view);
  const [preview, setPreview] = useState<DevCardType | null>(null);
  if (!view || !view.me) return null;
  const me = view.me;
  const total = devCardsTotal(me.devCards);
  const owned = CARD_ORDER.filter((c) => me.devCards[c] > 0);

  return (
    <>
      <CollapsibleSection
        id="devCards"
        title="Cartas de desarrollo"
        defaultCollapsed={false}
        summary={
          <span className="nums text-xs text-neutral-500">
            {total} {total === 1 ? 'carta' : 'cartas'}
          </span>
        }
      >
        <div className="p-3">
          {owned.length === 0 ? (
            <p className="rounded-md border border-dashed border-white/15 px-2.5 py-2.5 text-center text-[11px] text-neutral-400">
              No tienes cartas de desarrollo. Se compran en Construir.
            </p>
          ) : (
            <ul className="space-y-2">
              {owned.map((c) => {
                const isNew = me.devCardsBoughtThisTurn.includes(c);
                return (
                  <li key={c}>
                    <button
                      type="button"
                      onClick={() => setPreview(c)}
                      className="flex min-h-[56px] w-full items-center gap-2.5 rounded-lg border border-white/12 bg-surface-2 px-3 py-2 text-left transition-colors active:bg-white/[0.09]"
                    >
                      <DevCardGlyph card={c} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-neutral-50">
                          {DEV_CARD_NAMES[c]}
                        </span>
                        <span className="block text-[11px] text-neutral-400">
                          Toca para ver qué hace
                        </span>
                      </span>
                      <span className="nums flex-shrink-0 text-base font-bold text-neutral-50">
                        ×{me.devCards[c]}
                        {isNew ? (
                          <span className="ml-1 text-[10px] font-medium text-amber-300">
                            (nueva)
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {me.devCards.vp > 0 ? (
            <p className="mt-2 text-[11px] leading-snug text-amber-200/90">
              {vpCardsCopy(me.devCards.vp)}
            </p>
          ) : null}
        </div>
      </CollapsibleSection>
      {preview ? (
        <DevCardPreview
          card={preview}
          count={me.devCards[preview]}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
