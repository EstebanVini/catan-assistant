import { describe, it, expect } from 'vitest';
import { applyInitialSetup, validateInitialBuildings } from './setup';
import { GameState, InitialBuilding, fullBank } from './state';
import { recomputeVictoryPoints } from './rules';

function building(spots: Array<[number, string]>, grants = false): InitialBuilding {
  return {
    id: Math.random().toString(36).slice(2, 10),
    type: 'settlement',
    spots: spots.map(([number, resource]) => ({ number, resource: resource as InitialBuilding['spots'][0]['resource'] })),
    grantsStartingResources: grants,
  };
}

describe('validateInitialBuildings', () => {
  it('acepta 2 poblados con exactamente uno marcado', () => {
    const r = validateInitialBuildings([building([[6, 'ore']]), building([[9, 'wool']], true)]);
    expect(r.ok).toBe(true);
  });

  it('rechaza si no son exactamente 2 poblados', () => {
    expect(validateInitialBuildings([building([[6, 'ore']], true)]).ok).toBe(false);
    expect(
      validateInitialBuildings([building([[6, 'ore']]), building([[8, 'grain']]), building([[9, 'wool']], true)]).ok
    ).toBe(false);
  });

  it('rechaza 0 o 2 poblados marcados como segundo', () => {
    expect(validateInitialBuildings([building([[6, 'ore']]), building([[9, 'wool']])]).ok).toBe(false);
    expect(validateInitialBuildings([building([[6, 'ore']], true), building([[9, 'wool']], true)]).ok).toBe(false);
  });

  it('rechaza el número 7 y números fuera de rango', () => {
    expect(validateInitialBuildings([building([[7, 'ore']]), building([[9, 'wool']], true)]).ok).toBe(false);
    expect(validateInitialBuildings([building([[13, 'ore']]), building([[9, 'wool']], true)]).ok).toBe(false);
  });

  it('rechaza poblados con 0 o más de 3 fichas', () => {
    expect(validateInitialBuildings([building([]), building([[9, 'wool']], true)]).ok).toBe(false);
    expect(
      validateInitialBuildings([
        building([[2, 'ore'], [3, 'wool'], [4, 'grain'], [5, 'brick']]),
        building([[9, 'wool']], true),
      ]).ok
    ).toBe(false);
  });
});

describe('applyInitialSetup', () => {
  it('siembra hexes uniendo por número+recurso y reparte recursos del 2º poblado', () => {
    const bank = fullBank(false);
    const result = applyInitialSetup(
      [
        { id: 'p1', initialBuildings: [building([[6, 'ore'], [9, 'wool']]), building([[4, 'grain']], true)] },
        { id: 'p2', initialBuildings: [building([[6, 'ore']]), building([[9, 'wool'], [10, 'brick']], true)] },
      ],
      bank
    );
    // 6:ore se une (p1 y p2 comparten ficha); 9:wool también
    const oreHex = result.hexes.find((h) => h.number === 6 && h.resource === 'ore')!;
    expect(oreHex.owners.map((o) => o.playerId).sort()).toEqual(['p1', 'p2']);
    const woolHex = result.hexes.find((h) => h.number === 9 && h.resource === 'wool')!;
    expect(woolHex.owners).toHaveLength(2);
    // Solo el 2º poblado reparte: p1 recibe 1 grain; p2 recibe 1 wool + 1 brick
    expect(result.grants.p1).toMatchObject({ grain: 1, ore: 0, wool: 0 });
    expect(result.grants.p2).toMatchObject({ wool: 1, brick: 1, grain: 0 });
    // El banco se descuenta
    expect(bank.grain).toBe(18);
    expect(bank.wool).toBe(18);
    expect(bank.brick).toBe(18);
    expect(bank.ore).toBe(19);
  });

  it('mismo número con recursos distintos produce hexes separados', () => {
    const bank = fullBank(true);
    const result = applyInitialSetup(
      [
        { id: 'p1', initialBuildings: [building([[8, 'ore']]), building([[8, 'grain']], true)] },
        { id: 'p2', initialBuildings: [building([[5, 'wool']]), building([[11, 'brick']], true)] },
      ],
      bank
    );
    expect(result.hexes.filter((h) => h.number === 8)).toHaveLength(2);
  });

  it('un poblado que toca varias fichas cuenta como UN solo poblado en los VP', () => {
    const bank = fullBank(false);
    const setup = applyInitialSetup(
      [
        // 2º poblado toca 3 fichas: produce en las 3 pero vale 1 VP
        { id: 'p1', initialBuildings: [building([[6, 'ore']]), building([[4, 'grain'], [5, 'wool'], [10, 'brick']], true)] },
      ],
      bank
    );
    const state = {
      hexes: setup.hexes,
      players: [
        {
          id: 'p1',
          victoryPoints: { settlements: 0, cities: 0, longestRoad: false, largestArmy: false, hiddenVP: 0 },
        },
      ],
    } as unknown as GameState;
    recomputeVictoryPoints(state);
    expect(state.players[0].victoryPoints.settlements).toBe(2); // 2 poblados, no 4 fichas
  });

  it('respeta el banco limitado en el reparto inicial', () => {
    const bank = fullBank(false);
    bank.grain = 0;
    const result = applyInitialSetup(
      [{ id: 'p1', initialBuildings: [building([[6, 'ore']]), building([[4, 'grain'], [5, 'wool']], true)] }],
      bank
    );
    expect(result.grants.p1.grain).toBe(0);
    expect(result.grants.p1.wool).toBe(1);
    expect(result.shortages).toEqual([{ playerId: 'p1', resource: 'grain', wanted: 1, given: 0 }]);
  });
});
