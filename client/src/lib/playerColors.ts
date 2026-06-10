import { PlayerColor } from '../types';

// Fuente única de los hex de jugadores. Estos espejan los tokens de
// `tailwind.config.js` (player.red, player.blue, ...). Cuando se ajusten ahí
// (por contraste o re-branding), actualizar también aquí.
//
// Se usan desde:
//   - ColorChip (cuerpo del chip dibujado con SVG-friendly inline style)
//   - TopBar (acento del bottom-border del header)
//   - PublicPlayersPanel (banda lateral del card de jugador)
//
// El motivo de duplicar a Tailwind es que estos colores se aplican como
// estilo inline (boxShadow / backgroundColor con variables), donde Tailwind
// no resuelve clases dinámicas. Tener un único objeto evita drift entre los
// tres consumidores.
export const PLAYER_HEX: Record<PlayerColor, string> = {
  red: '#d64545',
  blue: '#3b6dd1',
  white: '#ececec',
  orange: '#e58a3a',
  green: '#3fa05a',
  brown: '#9a6a4a',
};

// Color para jugadores sin asignación (chip gris). Coincide con surface.3.
export const PLAYER_HEX_NONE = '#3a3f47';

export function playerHex(color: PlayerColor | null | undefined): string {
  return color ? PLAYER_HEX[color] : PLAYER_HEX_NONE;
}
