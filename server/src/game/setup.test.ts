import { describe, it, expect } from 'vitest';
import { applyInitialSetup, rebuildHexes, validateBuildings, validateInitialBuildings } from './setup';
import { Building, GameState, fullBank } from './state';
import { recomputeVictoryPoints } from './rules';

function building(spots: Array<[number, string]>, type: Building['type'] = 'settlement'): Building {
  return {
    id: Math.random().toString(36).slice(2, 10),
    type,
    spots: spots.map(([number, resource]) => ({ number, resource: resource as Building['spots'][0]['resource'] })),
  };
}

describe('validateInitialBuildings (gating de game:start)', () => {
  it('acepta exactamente 2 poblados con 1–3 fichas', () => {
    const r = validateInitialBuildings([building([[6, 'ore']]), building([[9, 'wool']])]);
    expect(r.ok).toBe(true);
  });

  it('rechaza si no son exactamente 2 poblados', () => {
    expect(validateInitialBuildings([building([[6, 'ore']])]).ok).toBe(false);
    expect(
      validateInitialBuildings([building([[6, 'ore']]), building([[8, 'grain']]), building([[9, 'wool']])]).ok
    ).toBe(false);
  });

  it('rechaza el número 7 y números fuera de rango', () => {
    expect(validateInitialBuildings([building([[7, 'ore']]), building([[9, 'wool']])]).ok).toBe(false);
    expect(validateInitialBuildings([building([[13, 'ore']]), building([[9, 'wool']])]).ok).toBe(false);
  });

  it('rechaza poblados de salida con 0 o más de 3 fichas', () => {
    expect(validateInitialBuildings([building([]), building([[9, 'wool']])]).ok).toBe(false);
    expect(
      validateInitialBuildings([
        building([[2, 'ore'], [3, 'wool'], [4, 'grain'], [5, 'brick']]),
        building([[9, 'wool']]),
      ]).ok
    ).toBe(false);
  });
});

describe('validateBuildings (edición libre de la tabla)', () => {
  it('acepta cualquier cantidad de construcciones, incluso con 0 fichas', () => {
    expect(validateBuildings([]).ok).toBe(true);
    expect(validateBuildings([building([])]).ok).toBe(true);
    expect(
      validateBuildings([building([[6, 'ore']]), building([[8, 'grain']], 'city'), building([[9, 'wool']])]).ok
    ).toBe(true);
  });

  it('rechaza fichas inválidas y tipos desconocidos', () => {
    expect(validateBuildings([building([[7, 'ore']])]).ok).toBe(false);
    expect(validateBuildings([{ ...building([[6, 'ore']]), type: 'castle' as Building['type'] }]).ok).toBe(false);
  });
});

describe('applyInitialSetup', () => {
  it('siembra hexes uniendo por número+recurso y reparte recursos de TODOS los poblados', () => {
    const bank = fullBank(false);
    const result = applyInitialSetup(
      [
        { id: 'p1', buildings: [building([[6, 'ore'], [9, 'wool']]), building([[4, 'grain']])] },
        { id: 'p2', buildings: [building([[6, 'ore']]), building([[9, 'wool'], [10, 'brick']])] },
      ],
      bank
    );
    // 6:ore se une (p1 y p2 comparten ficha); 9:wool también
    const oreHex = result.hexes.find((h) => h.number === 6 && h.resource === 'ore')!;
    expect(oreHex.owners.map((o) => o.playerId).sort()).toEqual(['p1', 'p2']);
    const woolHex = result.hexes.find((h) => h.number === 9 && h.resource === 'wool')!;
    expect(woolHex.owners).toHaveLength(2);
    // Ambos poblados reparten: 1 carta por ficha tocada
    expect(result.grants.p1).toMatchObject({ ore: 1, wool: 1, grain: 1, brick: 0 });
    expect(result.grants.p2).toMatchObject({ ore: 1, wool: 1, brick: 1, grain: 0 });
    // El banco se descuenta
    expect(bank.ore).toBe(17);
    expect(bank.wool).toBe(17);
    expect(bank.grain).toBe(18);
    expect(bank.brick).toBe(18);
  });

  it('mismo número con recursos distintos produce hexes separados', () => {
    const bank = fullBank(true);
    const result = applyInitialSetup(
      [
        { id: 'p1', buildings: [building([[8, 'ore']]), building([[8, 'grain']])] },
        { id: 'p2', buildings: [building([[5, 'wool']]), building([[11, 'brick']])] },
      ],
      bank
    );
    expect(result.hexes.filter((h) => h.number === 8)).toHaveLength(2);
  });

  it('incluye un desierto con el ladrón al iniciar', () => {
    const bank = fullBank(false);
    const result = applyInitialSetup(
      [{ id: 'p1', buildings: [building([[6, 'ore']]), building([[4, 'grain']])] }],
      bank
    );
    const desert = result.hexes.find((h) => h.number === null && h.resource === null);
    expect(desert).toBeDefined();
    expect(desert!.robber).toBe(true);
    expect(result.hexes.filter((h) => h.robber)).toHaveLength(1);
  });

  it('banco ilimitado: el reparto inicial es completo aunque el contador esté en 0', () => {
    const bank = fullBank(false);
    bank.grain = 0;
    const result = applyInitialSetup(
      [{ id: 'p1', buildings: [building([[6, 'ore']]), building([[4, 'grain'], [5, 'wool']])] }],
      bank
    );
    expect(result.grants.p1.grain).toBe(1);
    expect(result.grants.p1.wool).toBe(1);
    expect(result.shortages).toEqual([]);
    expect(bank.grain).toBe(0);
  });
});

describe('rebuildHexes', () => {
  it('preserva la posición del ladrón y los ids de los hexes al editar la tabla', () => {
    const players = [{ id: 'p1', buildings: [building([[6, 'ore']]), building([[4, 'grain']])] }];
    const first = rebuildHexes(players, []);
    const oreHex = first.find((h) => h.number === 6)!;
    oreHex.robber = true;
    first.find((h) => h.number === null)!.robber = false;

    const next = rebuildHexes(
      [{ id: 'p1', buildings: [...players[0].buildings, building([[9, 'wool']], 'city')] }],
      first
    );
    const nextOre = next.find((h) => h.number === 6)!;
    expect(nextOre.id).toBe(oreHex.id);
    expect(nextOre.robber).toBe(true);
    expect(next.filter((h) => h.robber)).toHaveLength(1);
    expect(next.find((h) => h.number === 9)!.owners[0].type).toBe('city');
  });

  it('si la ficha del ladrón desaparece, el ladrón vuelve al desierto', () => {
    const players = [{ id: 'p1', buildings: [building([[6, 'ore']])] }];
    const first = rebuildHexes(players, []);
    first.find((h) => h.number === 6)!.robber = true;
    first.find((h) => h.number === null)!.robber = false;

    const next = rebuildHexes([{ id: 'p1', buildings: [building([[4, 'grain']])] }], first);
    const desert = next.find((h) => h.number === null)!;
    expect(desert.robber).toBe(true);
    expect(next.filter((h) => h.robber)).toHaveLength(1);
  });
});

describe('recomputeVictoryPoints', () => {
  it('cuenta poblados y ciudades desde la tabla de cada jugador', () => {
    const state = {
      hexes: [],
      players: [
        {
          id: 'p1',
          // Un poblado que toca 3 fichas sigue valiendo 1, y la ciudad 1.
          buildings: [building([[4, 'grain'], [5, 'wool'], [10, 'brick']]), building([[6, 'ore']], 'city')],
          victoryPoints: { settlements: 0, cities: 0, longestRoad: false, largestArmy: false, vpCards: 0 },
        },
      ],
    } as unknown as GameState;
    recomputeVictoryPoints(state);
    expect(state.players[0].victoryPoints.settlements).toBe(1);
    expect(state.players[0].victoryPoints.cities).toBe(1);
  });
});
