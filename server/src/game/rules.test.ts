import { describe, it, expect } from 'vitest';
import {
  BUILD_COSTS,
  canAfford,
  distributeForRoll,
  computePendingDiscards,
  shortfall,
  tradeWithBank,
  bestBankRatio,
  upgradeCityImprovement,
  publicVictoryPoints,
  buildProgressDecks,
  drawsProgressCard,
  resolveBarbarianAttack,
} from './rules';
import {
  GameState,
  emptyHand,
  fullBank,
  emptyDevCards,
  emptyCommodities,
  fullCommodityBank,
  emptyImprovements,
  emptyMetropolisOwners,
  emptyProgressDecks,
  knightDefenseStrength,
} from './state';

function makeState(): GameState {
  const p1 = {
    id: 'p1', sessionToken: 't1', name: 'A', color: 'red' as const, connected: true,
    hand: { brick: 1, lumber: 1, wool: 0, grain: 0, ore: 0 }, commodities: emptyCommodities(),
    improvements: emptyImprovements(), metropolises: [], buildings: [], progressCards: [],
    knights: [], defenderCards: 0,
    ports: [], devCards: emptyDevCards(), devCardsBoughtThisTurn: [], knightsPlayed: 0,
    victoryPoints: { settlements: 0, cities: 0, longestRoad: false, largestArmy: false, vpCards: 0 },
  };
  const p2 = {
    id: 'p2', sessionToken: 't2', name: 'B', color: 'blue' as const, connected: true,
    hand: emptyHand(), commodities: emptyCommodities(),
    improvements: emptyImprovements(), metropolises: [], buildings: [], progressCards: [],
    knights: [], defenderCards: 0,
    ports: [], devCards: emptyDevCards(), devCardsBoughtThisTurn: [], knightsPlayed: 0,
    victoryPoints: { settlements: 0, cities: 0, longestRoad: false, largestArmy: false, vpCards: 0 },
  };
  return {
    code: 'TEST', hostId: 'p1', bankManagerId: 'p1', status: 'playing', extension56: false,
    citiesKnights: false, barbarianStep: 0, barbarianAttacks: 0, robberActive: true,
    players: [p1, p2], turnOrder: ['p1', 'p2'], currentTurnIndex: 0, phase: 'roll',
    specialBuildQueue: [], hexes: [], bank: fullBank(false), commodityBank: fullCommodityBank(),
    metropolisOwners: emptyMetropolisOwners(), progressDecks: emptyProgressDecks(),
    lastRedDie: null, lastEventDie: null, pendingProgressDiscard: {}, pendingBarbarianLoss: [],
    devDeck: [], diceStats: {2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0},
    log: [], pendingDiscards: {}, pendingRobberMove: false, pendingRobberSteal: false,
  };
}

describe('canAfford / shortfall', () => {
  it('detecta cuando alcanza para Camino', () => {
    expect(canAfford({ brick: 1, lumber: 1, wool: 0, grain: 0, ore: 0 }, BUILD_COSTS.road)).toBe(true);
  });
  it('detecta cuando NO alcanza para Poblado', () => {
    const hand = { brick: 1, lumber: 1, wool: 0, grain: 0, ore: 0 };
    expect(canAfford(hand, BUILD_COSTS.settlement)).toBe(false);
    expect(shortfall(hand, BUILD_COSTS.settlement)).toEqual({ wool: 1, grain: 1 });
  });
});

describe('distributeForRoll', () => {
  it('reparte 1 carta por settlement y 2 por city', () => {
    const s = makeState();
    s.hexes = [
      { id: 'h1', number: 8, resource: 'grain', robber: false, owners: [
        { playerId: 'p1', type: 'settlement' },
        { playerId: 'p2', type: 'city' },
      ]},
    ];
    distributeForRoll(s, 8);
    expect(s.players[0].hand.grain).toBe(1);
    expect(s.players[1].hand.grain).toBe(2);
  });

  it('no reparte si el ladrón está en el hex', () => {
    const s = makeState();
    s.hexes = [{ id: 'h1', number: 8, resource: 'grain', robber: true, owners: [{ playerId: 'p1', type: 'settlement' }] }];
    distributeForRoll(s, 8);
    expect(s.players[0].hand.grain).toBe(0);
  });

  it('banco ilimitado: reparte completo aunque el contador esté en 0', () => {
    const s = makeState();
    s.bank.wool = 0;
    s.hexes = [
      { id: 'h1', number: 5, resource: 'wool', robber: false, owners: [{ playerId: 'p1', type: 'settlement' }] },
      { id: 'h2', number: 5, resource: 'wool', robber: false, owners: [{ playerId: 'p2', type: 'city' }] },
    ];
    const r = distributeForRoll(s, 5);
    expect(s.players[0].hand.wool).toBe(1);
    expect(s.players[1].hand.wool).toBe(2);
    expect(r.shortages).toEqual([]);
    expect(r.partials).toEqual([]);
    // El contador informativo nunca baja de 0.
    expect(s.bank.wool).toBe(0);
  });
});

describe('distributeForRoll — mercancías (Caballeros y Ciudades)', () => {
  it('una ciudad sobre montaña produce 1 mineral + 1 moneda', () => {
    const s = makeState();
    s.citiesKnights = true;
    s.hexes = [
      { id: 'h1', number: 8, resource: 'ore', robber: false, owners: [{ playerId: 'p1', type: 'city' }] },
    ];
    const r = distributeForRoll(s, 8);
    expect(s.players[0].hand.ore).toBe(1);
    expect(s.players[0].commodities.coin).toBe(1);
    expect(r.perPlayerCommodities['p1']).toEqual({ coin: 1 });
  });

  it('un poblado sobre bosque produce 1 madera y NINGUNA mercancía', () => {
    const s = makeState();
    s.citiesKnights = true;
    // p2 arranca con la mano vacía (p1 ya trae 1 madera en makeState).
    s.hexes = [
      { id: 'h1', number: 6, resource: 'lumber', robber: false, owners: [{ playerId: 'p2', type: 'settlement' }] },
    ];
    distributeForRoll(s, 6);
    expect(s.players[1].hand.lumber).toBe(1);
    expect(s.players[1].commodities.paper).toBe(0);
  });

  it('una ciudad sobre trigo produce 2 trigo y ninguna mercancía (no hay mercancía de grain)', () => {
    const s = makeState();
    s.citiesKnights = true;
    s.hexes = [
      { id: 'h1', number: 9, resource: 'grain', robber: false, owners: [{ playerId: 'p1', type: 'city' }] },
    ];
    distributeForRoll(s, 9);
    expect(s.players[0].hand.grain).toBe(2);
    expect(s.players[0].commodities).toEqual(emptyCommodities());
  });

  it('en el modo base una ciudad sobre pastura da 2 lana (sin mercancías)', () => {
    const s = makeState(); // citiesKnights = false
    s.hexes = [
      { id: 'h1', number: 4, resource: 'wool', robber: false, owners: [{ playerId: 'p2', type: 'city' }] },
    ];
    const r = distributeForRoll(s, 4);
    expect(s.players[1].hand.wool).toBe(2);
    expect(s.players[1].commodities.cloth).toBe(0);
    expect(r.perPlayerCommodities).toEqual({});
  });
});

describe('upgradeCityImprovement — mejoras de ciudad y metrópolis', () => {
  it('cobra la mercancía correcta y sube de nivel (Ciencia ← papel)', () => {
    const s = makeState();
    s.citiesKnights = true;
    s.players[0].commodities.paper = 3;
    const r = upgradeCityImprovement(s, s.players[0], 'science');
    expect(r.ok).toBe(true);
    expect(r.level).toBe(1);
    expect(s.players[0].improvements.science).toBe(1);
    expect(s.players[0].commodities.paper).toBe(2); // nivel 1 cuesta 1
  });

  it('rechaza si no alcanza la mercancía', () => {
    const s = makeState();
    s.citiesKnights = true;
    s.players[0].improvements.trade = 2; // siguiente es nivel 3 (cuesta 3 tela)
    s.players[0].commodities.cloth = 2;
    const r = upgradeCityImprovement(s, s.players[0], 'trade');
    expect(r.ok).toBe(false);
    expect(s.players[0].improvements.trade).toBe(2);
  });

  it('nivel 3 desbloquea la habilidad de la disciplina', () => {
    const s = makeState();
    s.citiesKnights = true;
    s.players[0].improvements.politics = 2;
    s.players[0].commodities.coin = 3;
    const r = upgradeCityImprovement(s, s.players[0], 'politics');
    expect(r.ok).toBe(true);
    expect(r.abilityUnlocked).toBe('fortress');
  });

  it('nivel 4 reclama la metrópolis (requiere una ciudad) y vale +2 PV', () => {
    const s = makeState();
    s.citiesKnights = true;
    const p = s.players[0];
    p.improvements.science = 3;
    p.commodities.paper = 4;
    p.buildings = [{ id: 'c1', type: 'city', spots: [] }];
    p.victoryPoints.cities = 1; // la ciudad que hospeda la metrópolis
    const before = publicVictoryPoints(p); // 2 (1 ciudad)
    const r = upgradeCityImprovement(s, p, 'science');
    expect(r.ok).toBe(true);
    expect(r.gainedMetropolis).toBe(true);
    expect(s.metropolisOwners.science).toBe('p1');
    expect(p.metropolises).toEqual(['science']);
    expect(publicVictoryPoints(p)).toBe(before + 2); // metrópolis: +2 sobre ciudad
  });

  it('nivel 5 arrebata la metrópolis al dueño anterior', () => {
    const s = makeState();
    s.citiesKnights = true;
    // p2 ya tiene la metrópolis de Comercio (llegó a nivel 4).
    s.players[1].improvements.trade = 4;
    s.players[1].metropolises = ['trade'];
    s.metropolisOwners.trade = 'p2';
    // p1 sube de 4 a 5 y la arrebata.
    const p = s.players[0];
    p.improvements.trade = 4;
    p.commodities.cloth = 5;
    p.buildings = [{ id: 'c1', type: 'city', spots: [] }];
    const r = upgradeCityImprovement(s, p, 'trade');
    expect(r.ok).toBe(true);
    expect(r.stoleMetropolisFrom).toBe('p2');
    expect(s.metropolisOwners.trade).toBe('p1');
    expect(s.players[1].metropolises).toEqual([]);
    expect(p.metropolises).toEqual(['trade']);
  });
});

describe('cartas de progreso (calendario)', () => {
  it('drawsProgressCard: roba si nivel >= dado rojo (nivel 0 nunca)', () => {
    expect(drawsProgressCard(0, 1)).toBe(false); // nivel 0 nunca roba
    expect(drawsProgressCard(1, 1)).toBe(true);  // nivel 1, rojo 1 → roba
    expect(drawsProgressCard(1, 2)).toBe(false); // nivel 1, rojo 2 → no
    expect(drawsProgressCard(3, 3)).toBe(true);
    expect(drawsProgressCard(5, 6)).toBe(false); // nivel 5 nunca roba con rojo 6
    expect(drawsProgressCard(5, 5)).toBe(true);
  });

  it('buildProgressDecks: 18 cartas por disciplina (54 total) y barajadas', () => {
    const decks = buildProgressDecks();
    expect(decks.science).toHaveLength(18);
    expect(decks.politics).toHaveLength(18);
    expect(decks.trade).toHaveLength(18);
    // El mazo de comercio tiene 6 Mercaderes y 4 Monopolio de recurso.
    expect(decks.trade.filter((c) => c === 'merchant')).toHaveLength(6);
    expect(decks.trade.filter((c) => c === 'resourceMonopoly')).toHaveLength(4);
  });
});

describe('knightDefenseStrength', () => {
  it('suma solo el rango de los caballeros ACTIVOS', () => {
    expect(
      knightDefenseStrength([
        { id: 'a', rank: 1, active: true },
        { id: 'b', rank: 2, active: false }, // inactivo: no suma
        { id: 'c', rank: 3, active: true },
      ])
    ).toBe(4);
    expect(knightDefenseStrength([])).toBe(0);
  });
});

describe('resolveBarbarianAttack', () => {
  it('defensa >= ataque: el mayor defensor recibe Defensor de Catán (+1 PV)', () => {
    const s = makeState();
    s.citiesKnights = true;
    s.players[0].buildings = [{ id: 'c1', type: 'city', spots: [] }]; // 1 ciudad → ataque 1
    s.players[0].knights = [{ id: 'k1', rank: 2, active: true }]; // defensa 2
    const r = resolveBarbarianAttack(s);
    expect(r.attack).toBe(1);
    expect(r.defense).toBe(2);
    expect(r.defended).toBe(true);
    expect(r.uniqueDefender).toBe('p1');
    expect(s.players[0].defenderCards).toBe(1);
    // tras el ataque: caballeros desactivados, pista en 0, ladrón activo.
    expect(s.players[0].knights[0].active).toBe(false);
    expect(s.barbarianStep).toBe(0);
    expect(s.barbarianAttacks).toBe(1);
    expect(s.robberActive).toBe(true);
  });

  it('defensa < ataque: el de menor defensa con ciudad pierde una (pendiente)', () => {
    const s = makeState();
    s.citiesKnights = true;
    // p1: 2 ciudades, sin caballeros (defensa 0). p2: 1 ciudad, 1 caballero activo.
    s.players[0].buildings = [
      { id: 'c1', type: 'city', spots: [] },
      { id: 'c2', type: 'city', spots: [] },
    ];
    s.players[1].buildings = [{ id: 'c3', type: 'city', spots: [] }];
    s.players[1].knights = [{ id: 'k1', rank: 1, active: true }];
    const r = resolveBarbarianAttack(s); // ataque 3, defensa 1 → saqueo
    expect(r.defended).toBe(false);
    expect(r.losers).toEqual(['p1']); // p1 tiene la menor defensa (0) y ciudades
    expect(s.pendingBarbarianLoss).toEqual(['p1']);
  });
});

describe('computePendingDiscards', () => {
  it('quien tiene >7 cartas descarta floor(n/2)', () => {
    const s = makeState();
    s.players[0].hand = { brick: 3, lumber: 3, wool: 2, grain: 0, ore: 0 }; // 8 cartas
    s.players[1].hand = { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 7 }; // 7 cartas, no descarta
    const pending = computePendingDiscards(s);
    expect(pending).toEqual({ p1: 4 });
  });
});

describe('bestBankRatio', () => {
  it('4:1 sin puertos', () => {
    const s = makeState();
    expect(bestBankRatio(s.players[0], 'wool')).toBe(4);
  });
  it('3:1 con puerto genérico', () => {
    const s = makeState();
    s.players[0].ports = ['3:1'];
    expect(bestBankRatio(s.players[0], 'wool')).toBe(3);
  });
  it('2:1 con puerto específico', () => {
    const s = makeState();
    s.players[0].ports = ['wool'];
    expect(bestBankRatio(s.players[0], 'wool')).toBe(2);
  });
});

describe('tradeWithBank', () => {
  it('rechaza si no alcanza la proporción', () => {
    const s = makeState();
    s.players[0].hand.wool = 3;
    const r = tradeWithBank(s, s.players[0], 'wool', 'brick');
    expect(r.ok).toBe(false);
  });
  it('acepta 4:1 y mueve recursos', () => {
    const s = makeState();
    s.players[0].hand.wool = 4;
    const r = tradeWithBank(s, s.players[0], 'wool', 'brick');
    expect(r.ok).toBe(true);
    expect(r.ratio).toBe(4);
    expect(s.players[0].hand.wool).toBe(0);
    expect(s.players[0].hand.brick).toBe(2); // tenía 1 inicial
  });
  it('banco ilimitado: entrega aunque el contador del recurso esté en 0', () => {
    const s = makeState();
    s.players[0].hand.wool = 4;
    s.bank.brick = 0;
    const r = tradeWithBank(s, s.players[0], 'wool', 'brick');
    expect(r.ok).toBe(true);
    expect(s.players[0].hand.brick).toBe(2);
    expect(s.bank.brick).toBe(0);
  });
});
