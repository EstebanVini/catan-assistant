import { BUILD_COSTS, BuildType, Resource } from '../types';
import { ResourceIcon } from './ResourceIcon';

interface Props {
  type: BuildType;
}

export function BuildCostBadge({ type }: Props): JSX.Element {
  const cost = BUILD_COSTS[type];
  const entries = Object.entries(cost) as [Resource, number][];
  return (
    <div className="flex flex-wrap items-center gap-1">
      {entries.map(([res, n]) => (
        <span
          key={res}
          className="inline-flex items-center gap-1 rounded-md bg-black/25 px-1.5 py-0.5 text-[11px] text-neutral-200"
        >
          <ResourceIcon resource={res} size={20} />
          <span className="nums font-bold text-neutral-50">{n}</span>
        </span>
      ))}
    </div>
  );
}
