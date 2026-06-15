import { PlayerColor } from '../types';
import { PLAYER_HEX, PLAYER_HEX_NONE } from '../lib/playerColors';

interface Props {
  color: PlayerColor | null;
  size?: number;
  ring?: boolean;
  className?: string;
}

// Bordes por color para reforzar diferenciación sobre dark. El "blanco" sube
// a 0.55 para que su borde se distinga del fondo claro del chip.
const BORDER: Record<PlayerColor, string> = {
  red: 'rgba(0,0,0,0.45)',
  blue: 'rgba(0,0,0,0.45)',
  white: 'rgba(0,0,0,0.55)',
  orange: 'rgba(0,0,0,0.45)',
  green: 'rgba(0,0,0,0.45)',
  brown: 'rgba(0,0,0,0.45)',
  purple: 'rgba(0,0,0,0.45)',
};

export function ColorChip({ color, size = 18, ring = false, className }: Props): JSX.Element {
  const bg = color ? PLAYER_HEX[color] : PLAYER_HEX_NONE;
  const border = color ? BORDER[color] : 'rgba(0,0,0,0.5)';
  // Sombra interior sutil para sensación tridimensional consistente entre colores.
  const innerShadow =
    color === 'white'
      ? 'inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -1px 1px rgba(0,0,0,0.18)'
      : 'inset 0 1px 1px rgba(255,255,255,0.18), inset 0 -1px 1px rgba(0,0,0,0.25)';
  return (
    <span
      className={
        'inline-block rounded-full border ' +
        (ring ? 'ring-2 ring-white/70 ring-offset-1 ring-offset-neutral-950 ' : '') +
        (className ?? '')
      }
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        borderColor: border,
        boxShadow: innerShadow,
      }}
      aria-hidden
    />
  );
}
