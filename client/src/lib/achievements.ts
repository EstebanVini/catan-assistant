// Espejo cliente del catálogo de logros del servidor
// (server/src/game/achievements.ts). Mantener ambos en sincronía: ids, nombres,
// descripciones y XP. Solo lectura para la UI (perfil propio y de amigos).

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  xp: number;
  kind: 'career' | 'game';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'hay_overload', name: 'El más pajero', description: 'Acumula 15 cartas de trigo (paja) en tu mano.', xp: 15, kind: 'game' },
  { id: 'halfway', name: 'A mitad de camino', description: 'Haz 5 puntos en un solo turno.', xp: 25, kind: 'game' },
  { id: 'walker', name: 'El caminante', description: 'Construye 15 caminos en una sola partida.', xp: 15, kind: 'game' },
  { id: 'you_know_it', name: '¡YA SE LA SABEN!', description: 'Roba 10 recursos de tus oponentes en una partida.', xp: 15, kind: 'game' },
  { id: 'loser', name: 'Perdedor', description: 'Termina una partida con 3 puntos de victoria o menos.', xp: 15, kind: 'game' },
  { id: 'bad_luck', name: 'Mala suerte', description: 'Completa una ronda completa sin recibir un solo recurso.', xp: 15, kind: 'game' },
  { id: 'pacifist', name: 'Pacifista', description: 'Termina la partida sin robar ni un solo recurso.', xp: 15, kind: 'game' },
  { id: 'amateur', name: 'Amateur', description: 'Acumula 20 puntos de victoria.', xp: 20, kind: 'career' },
  { id: 'casual', name: 'Jugador casual', description: 'Acumula 50 puntos de victoria.', xp: 50, kind: 'career' },
  { id: 'pro', name: 'Profesional', description: 'Acumula 200 puntos de victoria.', xp: 200, kind: 'career' },
  { id: 'decorated', name: 'Condecorado', description: 'Consigue ambas insignias en una partida (camino más largo y ejército más grande).', xp: 15, kind: 'game' },
  { id: 'bellyflop', name: 'Panzazo', description: 'Gana una partida mientras alguno de tus oponentes tenga 9 puntos de victoria.', xp: 15, kind: 'game' },
  { id: 'stone_addict', name: 'Adicto a la piedra', description: 'Acumula 15 minerales (piedras) en tu mano.', xp: 15, kind: 'game' },
  { id: 'sea_trader', name: 'Comerciante marítimo', description: 'Obtén 4 puertos en una sola partida.', xp: 25, kind: 'game' },
  { id: 'crack', name: '¡Crack!', description: 'Consigue 6 puntos de victoria en un solo turno.', xp: 40, kind: 'game' },
  { id: 'developed', name: 'Desarrollado', description: 'Compra 5 cartas de desarrollo en un solo turno.', xp: 15, kind: 'game' },
  { id: 'demolisher', name: 'Victoria demoledora', description: 'Gana una partida sin que ninguno de tus oponentes llegue a 6 puntos o más.', xp: 25, kind: 'game' },
  { id: 'streaker', name: 'Enrachado', description: 'Acumula una racha de 5 victorias seguidas.', xp: 50, kind: 'career' },
  { id: 'villager', name: 'Pueblerino', description: 'Gana una partida sin construir una ciudad.', xp: 40, kind: 'game' },
  { id: 'tu_hermana', name: 'Tu hermana (11/10)', description: 'Gana una partida con 11 puntos de victoria.', xp: 50, kind: 'game' },
];

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a])
);

// Nivel derivado de la XP total (espejo de levelForXp del servidor).
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

// XP total acumulada necesaria para alcanzar `level`.
export function xpForLevel(level: number): number {
  const l = Math.max(1, level);
  return (l - 1) * (l - 1) * 100;
}

// Progreso dentro del nivel actual: { level, into, span, toNext, pct }.
export function levelProgress(xp: number): {
  level: number;
  into: number; // XP dentro del nivel actual
  span: number; // XP total del nivel actual
  toNext: number; // XP que falta para el siguiente nivel
  pct: number; // 0..1 del nivel actual
} {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - base;
  const into = xp - base;
  return { level, into, span, toNext: next - xp, pct: span > 0 ? into / span : 0 };
}
