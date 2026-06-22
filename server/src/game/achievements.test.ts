import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENTS,
  AchievementContext,
  newlyUnlocked,
  satisfiedAchievements,
  xpForGame,
  levelForXp,
  xpForLevel,
} from './achievements';
import { emptyGameStats, GameStats } from './state';

function gs(over: Partial<GameStats> = {}): GameStats {
  return { ...emptyGameStats(), ...over };
}

function ctx(over: Partial<AchievementContext> = {}): AchievementContext {
  return {
    won: false,
    finalVP: 0,
    opponentsVP: [],
    hasLongestRoad: false,
    hasLargestArmy: false,
    citiesAtEnd: 0,
    stealsThisGame: 0,
    careerTotalVP: 0,
    winStreakAfter: 0,
    ...over,
  };
}

describe('catálogo de logros', () => {
  it('tiene 19 logros con ids únicos y XP positivo', () => {
    expect(ACHIEVEMENTS).toHaveLength(19);
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(19);
    expect(ACHIEVEMENTS.every((a) => a.xp > 0)).toBe(true);
  });
});

describe('satisfiedAchievements', () => {
  it('logros por pico de recursos en mano', () => {
    expect(satisfiedAchievements(gs({ peakResource: { ...emptyGameStats().peakResource, grain: 15 } }), ctx())).toContain('hay_overload');
    expect(satisfiedAchievements(gs({ peakResource: { ...emptyGameStats().peakResource, ore: 15 } }), ctx())).toContain('stone_addict');
    expect(satisfiedAchievements(gs({ peakResource: { ...emptyGameStats().peakResource, grain: 14 } }), ctx())).not.toContain('hay_overload');
  });

  it('puntos en un turno: A mitad de camino (5) y Crack (6)', () => {
    expect(satisfiedAchievements(gs({ maxVpGainInTurn: 5 }), ctx())).toContain('halfway');
    expect(satisfiedAchievements(gs({ maxVpGainInTurn: 5 }), ctx())).not.toContain('crack');
    expect(satisfiedAchievements(gs({ maxVpGainInTurn: 6 }), ctx())).toEqual(
      expect.arrayContaining(['halfway', 'crack'])
    );
  });

  it('caminos, robos y compras dev por partida/turno', () => {
    expect(satisfiedAchievements(gs({ roadsBuilt: 15 }), ctx())).toContain('walker');
    expect(satisfiedAchievements(gs(), ctx({ stealsThisGame: 10 }))).toContain('you_know_it');
    expect(satisfiedAchievements(gs({ maxDevBoughtInTurn: 5 }), ctx())).toContain('developed');
  });

  it('pacifista y mala suerte', () => {
    expect(satisfiedAchievements(gs(), ctx({ stealsThisGame: 0 }))).toContain('pacifist');
    expect(satisfiedAchievements(gs(), ctx({ stealsThisGame: 1 }))).not.toContain('pacifist');
    expect(satisfiedAchievements(gs({ hadDryRound: true }), ctx())).toContain('bad_luck');
  });

  it('logros de carrera por PV acumulados', () => {
    expect(satisfiedAchievements(gs(), ctx({ careerTotalVP: 20 }))).toContain('amateur');
    expect(satisfiedAchievements(gs(), ctx({ careerTotalVP: 50 }))).toEqual(
      expect.arrayContaining(['amateur', 'casual'])
    );
    expect(satisfiedAchievements(gs(), ctx({ careerTotalVP: 200 }))).toEqual(
      expect.arrayContaining(['amateur', 'casual', 'pro'])
    );
  });

  it('logros de victoria condicionados a oponentes', () => {
    expect(satisfiedAchievements(gs(), ctx({ won: true, opponentsVP: [9, 4] }))).toContain('bellyflop');
    expect(satisfiedAchievements(gs(), ctx({ won: true, opponentsVP: [5, 3] }))).toContain('demolisher');
    expect(satisfiedAchievements(gs(), ctx({ won: true, opponentsVP: [6, 3] }))).not.toContain('demolisher');
    expect(satisfiedAchievements(gs(), ctx({ won: true, citiesAtEnd: 0 }))).toContain('villager');
    expect(satisfiedAchievements(gs(), ctx({ won: true, citiesAtEnd: 1 }))).not.toContain('villager');
  });

  it('insignias, racha y puertos', () => {
    expect(satisfiedAchievements(gs(), ctx({ hasLongestRoad: true, hasLargestArmy: true }))).toContain('decorated');
    expect(satisfiedAchievements(gs(), ctx({ winStreakAfter: 5 }))).toContain('streaker');
    expect(satisfiedAchievements(gs({ peakPorts: 4 }), ctx())).toContain('sea_trader');
    expect(satisfiedAchievements(gs(), ctx({ finalVP: 3 }))).toContain('loser');
    expect(satisfiedAchievements(gs(), ctx({ finalVP: 4 }))).not.toContain('loser');
  });
});

describe('newlyUnlocked', () => {
  it('excluye los ya desbloqueados', () => {
    const fresh = newlyUnlocked(gs(), ctx({ careerTotalVP: 50 }), ['amateur']);
    expect(fresh).toContain('casual');
    expect(fresh).not.toContain('amateur');
  });
});

describe('xpForGame', () => {
  it('victoria + insignias + PV + bonus de racha + logros', () => {
    // gana, 1 insignia, 8 PV, racha 3 (>=2 → +10), 1 logro nuevo de 25 XP
    const xp = xpForGame(
      { won: true, finalVP: 8, hasLongestRoad: true, hasLargestArmy: false, winStreakAfter: 3 },
      ['halfway']
    );
    expect(xp).toBe(10 + 5 + 8 + 10 + 25);
  });

  it('sin racha (1ª victoria) no da bonus de racha', () => {
    const xp = xpForGame(
      { won: true, finalVP: 10, hasLongestRoad: false, hasLargestArmy: false, winStreakAfter: 1 },
      []
    );
    expect(xp).toBe(10 + 10);
  });

  it('perder solo da XP por PV', () => {
    const xp = xpForGame(
      { won: false, finalVP: 4, hasLongestRoad: false, hasLargestArmy: false, winStreakAfter: 0 },
      []
    );
    expect(xp).toBe(4);
  });
});

describe('nivel', () => {
  it('levelForXp es 1 desde 0 y sube con la curva cuadrática', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(400)).toBe(3);
  });
  it('xpForLevel es inverso del umbral', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(400);
  });
});
