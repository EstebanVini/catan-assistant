import { Resource } from '../types';
import { ResourceGlyph } from '../assets/icons';

interface Props {
  resource: Resource;
  size?: number;
  className?: string;
}

// Wrapper de compatibilidad: el dibujo real vive en `assets/icons.tsx`
// (módulo ÚNICO de mapeo recurso → asset, con fallback emoji). Mantiene la
// firma pública original para no tocar a los consumidores.
export function ResourceIcon({ resource, size = 20, className }: Props): JSX.Element {
  return <ResourceGlyph resource={resource} size={size} className={className} />;
}
