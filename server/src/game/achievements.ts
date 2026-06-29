import { GameStats } from './state';

// === Catálogo de logros (cambios.txt) ===
// id estable (no se traduce) · nombre y descripción en español para la UI · XP
// que otorga al desbloquearse (una sola vez). El cliente espeja este catálogo
// en client/src/lib/achievements.ts.
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  xp: number;
  // 'career' = depende de stats acumuladas (PV totales); 'game' = depende de lo
  // ocurrido en una partida/turno. Solo informativo (para agrupar en la UI).
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
  { id: 'developed', name: 'Desarrollado', description: 'Compra 5 cartas de desarrollo en un solo turno.', xp: 40, kind: 'game' },
  { id: 'demolisher', name: 'Victoria demoledora', description: 'Gana una partida sin que ninguno de tus oponentes llegue a 6 puntos o más.', xp: 40, kind: 'game' },
  { id: 'streaker', name: 'Enrachado', description: 'Acumula una racha de 5 victorias seguidas.', xp: 50, kind: 'career' },
  { id: 'villager', name: 'Pueblerino', description: 'Gana una partida sin construir una ciudad.', xp: 40, kind: 'game' },
  { id: 'tu_hermana', name: 'Tu hermana (11/10)', description: 'Gana una partida con 11 puntos de victoria.', xp: 50, kind: 'game' },
];

export const ACHIEVEMENT_XP: Record<string, number> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a.xp])
);

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a])
);

// Logros que se pueden desbloquear EN VIVO (mitad de partida), porque su
// condición es monótona/positiva durante el juego. El resto (PV finales bajos,
// pacifista, PV de carrera, racha, y los condicionados a ganar) solo se resuelve
// al terminar la partida.
export const MIDGAME_ACHIEVEMENT_IDS = new Set<string>([
  'hay_overload',
  'halfway',
  'crack',
  'walker',
  'you_know_it',
  'stone_addict',
  'sea_trader',
  'developed',
  'decorated',
  'bad_luck',
]);

// Contexto de fin de partida para evaluar los logros de un jugador.
export interface AchievementContext {
  won: boolean;
  finalVP: number;
  opponentsVP: number[]; // PV de los demás jugadores al terminar
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
  citiesAtEnd: number;
  stealsThisGame: number;
  careerTotalVP: number; // PV acumulados DESPUÉS de sumar esta partida
  winStreakAfter: number; // racha de victorias DESPUÉS de esta partida
}

// Devuelve los ids de logros que el jugador cumple según su partida + carrera.
// (Incluye los ya desbloqueados; el llamador resta los previos.)
export function satisfiedAchievements(gs: GameStats, ctx: AchievementContext): string[] {
  const out: string[] = [];
  const ok = (id: string, cond: boolean) => {
    if (cond) out.push(id);
  };
  ok('hay_overload', gs.peakResource.grain >= 15);
  ok('halfway', gs.maxVpGainInTurn >= 5);
  ok('walker', gs.roadsBuilt >= 15);
  ok('you_know_it', ctx.stealsThisGame >= 10);
  ok('loser', ctx.finalVP <= 3);
  ok('bad_luck', gs.hadDryRound);
  ok('pacifist', ctx.stealsThisGame === 0);
  ok('amateur', ctx.careerTotalVP >= 20);
  ok('casual', ctx.careerTotalVP >= 50);
  ok('pro', ctx.careerTotalVP >= 200);
  ok('decorated', ctx.hasLongestRoad && ctx.hasLargestArmy);
  ok('bellyflop', ctx.won && ctx.opponentsVP.some((v) => v >= 9));
  ok('stone_addict', gs.peakResource.ore >= 15);
  ok('sea_trader', gs.peakPorts >= 4);
  ok('crack', gs.maxVpGainInTurn >= 6);
  ok('developed', gs.maxDevBoughtInTurn >= 5);
  ok('demolisher', ctx.won && ctx.opponentsVP.every((v) => v < 6));
  ok('streaker', ctx.winStreakAfter >= 5);
  ok('villager', ctx.won && ctx.citiesAtEnd === 0);
  ok('tu_hermana', ctx.won && ctx.finalVP >= 11);
  return out;
}

// Logros desbloqueables EN VIVO que el jugador ya cumple ahora mismo. Reusa
// `satisfiedAchievements` (única fuente de verdad) con un contexto de mitad de
// partida e intersecta con el conjunto permitido en vivo: así los logros de
// fin de partida (loser/pacifist/carrera/racha/condicionados a ganar) nunca se
// disparan antes de tiempo, aunque su condición parezca cumplirse.
export interface MidGameContext {
  hasLongestRoad: boolean;
  hasLargestArmy: boolean;
  stealsThisGame: number;
}
export function midGameSatisfied(gs: GameStats, ctx: MidGameContext): string[] {
  const full: AchievementContext = {
    won: false,
    finalVP: 0,
    opponentsVP: [],
    hasLongestRoad: ctx.hasLongestRoad,
    hasLargestArmy: ctx.hasLargestArmy,
    citiesAtEnd: 0,
    stealsThisGame: ctx.stealsThisGame,
    careerTotalVP: 0,
    winStreakAfter: 0,
  };
  return satisfiedAchievements(gs, full).filter((id) => MIDGAME_ACHIEVEMENT_IDS.has(id));
}

// Logros recién desbloqueados (los que cumple y no tenía antes).
export function newlyUnlocked(
  gs: GameStats,
  ctx: AchievementContext,
  already: Iterable<string>
): string[] {
  const have = new Set(already);
  return satisfiedAchievements(gs, ctx).filter((id) => !have.has(id));
}

// === Reglas de XP (cambios.txt §3.1 de docs/logrosandxp.md) ===
// Partida ganada +10 · cada insignia +5 · 1 XP por PV · +10 por victoria que
// suma a la racha (a partir de la 2ª consecutiva) · + XP de los logros nuevos.
export function xpForGame(
  ctx: Pick<AchievementContext, 'won' | 'finalVP' | 'hasLongestRoad' | 'hasLargestArmy' | 'winStreakAfter'>,
  newAchievementIds: string[]
): number {
  let xp = 0;
  if (ctx.won) xp += 10;
  if (ctx.hasLongestRoad) xp += 5;
  if (ctx.hasLargestArmy) xp += 5;
  xp += Math.max(0, ctx.finalVP);
  if (ctx.won && ctx.winStreakAfter >= 2) xp += 10;
  for (const id of newAchievementIds) xp += ACHIEVEMENT_XP[id] ?? 0;
  return xp;
}

// Nivel derivado de la XP total (curva suave). Nivel 1 desde 0 XP.
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

// XP total necesaria para alcanzar `level` (inverso de levelForXp).
export function xpForLevel(level: number): number {
  const l = Math.max(1, level);
  return (l - 1) * (l - 1) * 100;
}
