import { useEffect, useState } from 'react';

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
}

export function Avatar({
  seed,
  name,
  avatarUrl,
  size,
  className,
}: Props): JSX.Element {
  const [failed, setFailed] = useState(false);
  // Si cambia la URL, reintentar la carga.
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const dimension = { width: size, height: size };

  if (avatarUrl && !failed) {
    return (
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
    );
  }

  const hue = hashHue(seed);
  const initials = initialsOf(name);
  return (
    <span
      aria-hidden
      style={{
        ...dimension,
        backgroundColor: `hsl(${hue} 42% 36%)`,
        fontSize: Math.max(10, Math.round(size * 0.38)),
      }}
      className={
        'inline-flex flex-shrink-0 select-none items-center justify-center rounded-full border border-white/15 font-bold uppercase text-white' +
        (className ? ' ' + className : '')
      }
    >
      {initials}
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
