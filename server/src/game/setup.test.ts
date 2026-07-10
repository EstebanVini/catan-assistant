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

describe('tope de fichas por puerto (bug del lobby "Mis puertos")', () => {
  // Un poblado sobre un puerto ocupa un borde costero: toca 1–2 hexes de tierra,
  // nunca 3. La regla la impone validateBuildings (maxSpots = port ? 2 : 3) y la
  // UI del lobby debe reflejarla; aquí fijamos la conducta pura.
  function withPort(b: Building, port: Building['port']): Building {
    return { ...b, port };
  }

  it('un poblado con puerto acepta 0, 1 o 2 fichas', () => {
    expect(validateBuildings([withPort(building([]), '3:1')]).ok).toBe(true);
    expect(validateBuildings([withPort(building([[6, 'ore']]), 'brick')]).ok).toBe(true);
    expect(validateBuildings([withPort(building([[6, 'ore'], [9, 'wool']]), 'brick')]).ok).toBe(true);
  });

  it('un poblado con puerto RECHAZA 3 fichas; sin puerto sí las acepta', () => {
    const conPuerto = withPort(building([[6, 'ore'], [9, 'wool'], [4, 'grain']]), '3:1');
    expect(validateBuildings([conPuerto]).ok).toBe(false);
    // Sin puerto, 3 fichas es válido (control).
    expect(validateBuildings([building([[6, 'ore'], [9, 'wool'], [4, 'grain']])]).ok).toBe(true);
  });

  it('acepta los puertos válidos (3:1 y cada recurso 2:1) y rechaza uno inválido', () => {
    for (const port of ['3:1', 'brick', 'lumber', 'wool', 'grain', 'ore'] as const) {
      expect(validateBuildings([withPort(building([[6, 'ore']]), port)]).ok).toBe(true);
    }
    expect(
      validateBuildings([withPort(building([[6, 'ore']]), 'diamond' as Building['port'])]).ok
    ).toBe(false);
  });

  it('validateInitialBuildings: un poblado de salida con puerto acepta 2 fichas pero no 3', () => {
    expect(
      validateInitialBuildings([
        withPort(building([[6, 'ore'], [9, 'wool']]), 'brick'),
        building([[4, 'grain']]),
      ]).ok
    ).toBe(true);
    expect(
      validateInitialBuildings([
        withPort(building([[6, 'ore'], [9, 'wool'], [4, 'grain']]), 'brick'),
        building([[5, 'lumber']]),
      ]).ok
    ).toBe(false);
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

  it('Caballeros y Ciudades: la ciudad de salida reparte mercancías por ficha de ore/lumber/wool', () => {
    const bank = fullBank(false);
    // p1: poblado (no da mercancía) + ciudad sobre ore(→coin), lumber(→paper),
    // wool(→cloth) y grain (sin mercancía).
    const result = applyInitialSetup(
      [
        {
          id: 'p1',
          buildings: [
            building([[6, 'brick']]),
            building([[8, 'ore'], [9, 'lumber'], [10, 'wool'], [4, 'grain']], 'city'),
          ],
        },
      ],
      bank,
      true,
      1,
      true // citiesKnights
    );
    // Recursos: 1 por ficha (sin cambio respecto al base).
    expect(result.grants.p1).toMatchObject({ brick: 1, ore: 1, lumber: 1, wool: 1, grain: 1 });
    // Mercancías: solo de las fichas de la CIUDAD sobre ore/lumber/wool.
    expect(result.commodityGrants.p1).toEqual({ coin: 1, paper: 1, cloth: 1 });
  });

  it('Caballeros y Ciudades: un POBLADO no reparte mercancías', () => {
    const bank = fullBank(false);
    const result = applyInitialSetup(
      [{ id: 'p1', buildings: [building([[8, 'ore'], [9, 'wool']]), building([[4, 'grain']], 'city')] }],
      bank,
      true,
      1,
      true
    );
    // El poblado sobre ore/wool no da mercancía; la ciudad sobre grain tampoco.
    expect(result.commodityGrants.p1).toEqual({ coin: 0, paper: 0, cloth: 0 });
  });

  it('modo base: nunca reparte mercancías aunque haya ciudades', () => {
    const bank = fullBank(false);
    const result = applyInitialSetup(
      [{ id: 'p1', buildings: [building([[8, 'ore']]), building([[9, 'wool']], 'city')] }],
      bank,
      true,
      1,
      false // base
    );
    expect(result.commodityGrants.p1).toEqual({ coin: 0, paper: 0, cloth: 0 });
  });
});

describe('agrupación por hexId (desambiguación del ladrón)', () => {
  // Helper: construcción cuyas fichas llevan un hexId explícito.
  function buildingWithHex(
    spots: Array<[number, string, string]>,
    type: Building['type'] = 'settlement'
  ): Building {
    return {
      id: Math.random().toString(36).slice(2, 10),
      type,
      spots: spots.map(([number, resource, hexId]) => ({
        number,
        resource: resource as Building['spots'][0]['resource'],
        hexId,
      })),
    };
  }

  it('dos fichas con el mismo número+recurso pero hexId distinto son hexes separados', () => {
    const hexes = rebuildHexes(
      [
        {
          id: 'p1',
          buildings: [
            buildingWithHex([[8, 'grain', 'hexA']]),
            buildingWithHex([[8, 'grain', 'hexB']]),
          ],
        },
      ],
      []
    );
    const eights = hexes.filter((h) => h.number === 8 && h.resource === 'grain');
    expect(eights).toHaveLength(2);
    expect(eights.map((h) => h.id).sort()).toEqual(['hexA', 'hexB']);
  });

  it('fichas de jugadores distintos con el mismo hexId comparten un solo hex', () => {
    const hexes = rebuildHexes(
      [
        { id: 'p1', buildings: [buildingWithHex([[8, 'grain', 'shared']])] },
        { id: 'p2', buildings: [buildingWithHex([[8, 'grain', 'shared']])] },
      ],
      []
    );
    const shared = hexes.filter((h) => h.number === 8 && h.resource === 'grain');
    expect(shared).toHaveLength(1);
    expect(shared[0].id).toBe('shared');
    expect(shared[0].owners.map((o) => o.playerId).sort()).toEqual(['p1', 'p2']);
  });

  it('preserva el ladrón por id cuando hay fichas duplicadas', () => {
    const players = [
      {
        id: 'p1',
        buildings: [
          buildingWithHex([[8, 'grain', 'hexA']]),
          buildingWithHex([[8, 'grain', 'hexB']]),
        ],
      },
    ];
    const first = rebuildHexes(players, []);
    first.find((h) => h.id === 'hexB')!.robber = true;
    first.find((h) => h.number === null)!.robber = false;
    const next = rebuildHexes(players, first);
    expect(next.find((h) => h.id === 'hexB')!.robber).toBe(true);
    expect(next.find((h) => h.id === 'hexA')!.robber).toBe(false);
    expect(next.filter((h) => h.robber)).toHaveLength(1);
  });
});

describe('applyInitialSetup sin recursos (modo "iniciar sin fichas")', () => {
  it('deriva hexes pero no reparte recursos cuando seedResources es false', () => {
    const bank = fullBank(false);
    const result = applyInitialSetup(
      [{ id: 'p1', buildings: [building([[6, 'ore']]), building([[4, 'grain']])] }],
      bank,
      false
    );
    expect(result.grants.p1).toMatchObject({ ore: 0, grain: 0, wool: 0, brick: 0, lumber: 0 });
    expect(bank.ore).toBe(19);
    expect(bank.grain).toBe(19);
    // Los hexes sí se derivan de lo registrado.
    expect(result.hexes.find((h) => h.number === 6 && h.resource === 'ore')).toBeDefined();
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

  it('base: exactamente 1 desierto; extensión 5–6: exactamente 2 desiertos', () => {
    const players = [{ id: 'p1', buildings: [building([[6, 'ore']]), building([[4, 'grain']])] }];
    const base = rebuildHexes(players, []);
    expect(base.filter((h) => h.number === null && h.resource === null)).toHaveLength(1);

    const ext = rebuildHexes(players, [], 2);
    const deserts = ext.filter((h) => h.number === null && h.resource === null);
    expect(deserts).toHaveLength(2);
    // Un solo ladrón, en un desierto, al derivar de cero.
    expect(ext.filter((h) => h.robber)).toHaveLength(1);
    expect(deserts.some((d) => d.robber)).toBe(true);
  });

  it('extensión 5–6: preserva los ids de ambos desiertos y la posición del ladrón en el 2º', () => {
    const players = [{ id: 'p1', buildings: [building([[6, 'ore']])] }];
    const first = rebuildHexes(players, [], 2);
    const deserts = first.filter((h) => h.number === null && h.resource === null);
    expect(deserts).toHaveLength(2);
    // Mover el ladrón al 2º desierto.
    for (const h of first) h.robber = false;
    deserts[1].robber = true;

    const next = rebuildHexes(players, first, 2);
    const nextDeserts = next.filter((h) => h.number === null && h.resource === null);
    expect(nextDeserts.map((d) => d.id)).toEqual(deserts.map((d) => d.id));
    expect(next.filter((h) => h.robber)).toHaveLength(1);
    expect(next.find((h) => h.id === deserts[1].id)!.robber).toBe(true);
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
