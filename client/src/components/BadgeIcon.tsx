import { BadgeGlyph } from '../assets/icons';

// Insignias transferibles (Ejército más grande / Camino más largo).
//
// Wrapper de compatibilidad: el dibujo vive en `assets/icons.tsx` (módulo
// único de assets). Tema Catán: las insignias son MEDALLAS doradas con borde
// de sello — el dorado está reservado para títulos, código de sala e
// insignias, así que aquí es legítimo. La diferenciación entre variantes la
// da el glifo grabado (espadas cruzadas vs camino sinuoso).

interface Props {
  variant: 'army' | 'road';
  size?: number;
  className?: string;
}

export function BadgeIcon({ variant, size = 16, className }: Props): JSX.Element {
  return <BadgeGlyph variant={variant} size={size} className={className} />;
}

// Cápsula reutilizable: chip con aspecto de medalla/sello (aro interior
// dorado + relieve, ver shadow-medal en tailwind.config). Acepta un label
// visible y siempre incluye `aria-label` descriptivo para lectores de
// pantalla. Reuso entre `PublicPlayersPanel`, Perfil y pantalla de ganador.
export function BadgeChip({
  variant,
  label,
  size = 14,
  className,
}: {
  variant: 'army' | 'road';
  label: string;
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={
        'inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/[0.12] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-gold-light shadow-medal ' +
        (className ? ' ' + className : '')
      }
    >
      <BadgeIcon variant={variant} size={size} />
      <span>{label}</span>
    </span>
  );
}
