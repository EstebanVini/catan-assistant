import { useEffect, useState } from 'react';
import { FireGlyph } from '../assets/icons';

// Avatar de usuario (Fase 3). Por defecto: avatar GENERADO determinístico por
// `seed` (iniciales + color de fondo derivado del hash) — nunca un "sin foto"
// gris. Si hay `avatarUrl` y la imagen falla en este dispositivo, cae al
// generado en silencio (brief §2).
interface Props {
  // Semilla determinística (username preferido; displayName como fallback).
  seed: string;
  // Nombre del que se toman las iniciales visibles.
  name: string;
  avatarUrl?: string | null;
  size: number;
  className?: string;
  // Racha de victorias activa (PublicPlayer.winStreak). Cuando es ≥ 1 se
  // superpone un medallón de fuego con el número en la esquina del avatar.
  // 0 / undefined → el avatar se renderiza exactamente igual que antes.
  streak?: number;
}

export function Avatar({
  seed,
  name,
  avatarUrl,
  size,
  className,
  streak,
}: Props): JSX.Element {
  const [failed, setFailed] = useState(false);
  // Si cambia la URL, reintentar la carga.
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const dimension = { width: size, height: size };

  const avatarEl =
    avatarUrl && !failed ? (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={dimension}
        className={
          'flex-shrink-0 rounded-full border border-white/15 object-cover' +
          (className ? ' ' + className : '')
        }
      />
    ) : (
      <span
        aria-hidden
        style={{
          ...dimension,
          backgroundColor: `hsl(${hashHue(seed)} 42% 36%)`,
          fontSize: Math.max(10, Math.round(size * 0.38)),
        }}
        className={
          'inline-flex flex-shrink-0 select-none items-center justify-center rounded-full border border-white/15 font-bold uppercase text-white' +
          (className ? ' ' + className : '')
        }
      >
        {initialsOf(name)}
      </span>
    );

  // Sin racha: el avatar sale tal cual (no rompemos usos existentes).
  if (!streak || streak < 1) return avatarEl;

  return (
    <span className="relative inline-flex flex-shrink-0">
      {avatarEl}
      <StreakBadge streak={streak} avatarSize={size} />
    </span>
  );
}

// Medallón de racha: pequeño sello cálido (lenguaje dorado/terracota de la
// llama) anclado en la esquina inferior derecha del avatar. El número va en
// `nums` para tabularse. El medallón crece con el avatar pero nunca baja de un
// tamaño legible. Entrada con `anim-scale-in` (sutil; degrada a fade corto bajo
// `prefers-reduced-motion`).
function StreakBadge({
  streak,
  avatarSize,
}: {
  streak: number;
  avatarSize: number;
}): JSX.Element {
  // Tamaño proporcional al avatar, con piso para que el número sea legible.
  const badge = Math.max(16, Math.round(avatarSize * 0.5));
  const fire = Math.max(10, Math.round(badge * 0.62));
  const fontSize = Math.max(9, Math.round(badge * 0.5));
  return (
    <span
      role="img"
      aria-label={`Racha de ${streak} victorias`}
      className="anim-scale-in absolute -bottom-1 -right-1 inline-flex items-center justify-center gap-px rounded-full border border-gold/60 bg-[#2a1c10] px-1 leading-none shadow-medal ring-1 ring-black/40"
      style={{ minWidth: badge, height: badge }}
    >
      <FireGlyph size={fire} />
      <span
        className="nums font-bold text-gold-light"
        style={{ fontSize }}
      >
        {streak}
      </span>
    </span>
  );
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  return h;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}
