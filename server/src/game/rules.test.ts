import { describe, it, expect } from 'vitest';
import {
  BUILD_COSTS,
  canAfford,
  distributeForRoll,
  computePendingDiscards,
  shortfall,
  tradeWithBank,
  bestBankRatio,
} from './rules';
import { GameState, emptyHand, fullBank, emptyDevCards } from './state';

function makeState(): GameState {
  const p1 = {
    id: 'p1', sessionToken: 't1', name: 'A', color: 'red' as const, connected: true,
    hand: { brick: 1, lumber: 1, wool: 0, grain: 0, ore: 0 },
    ports: [], devCards: emptyDevCards(), devCardsBoughtThisTurn: [], knightsPlayed: 0,
    victoryPoints: { settlements: 0, cities: 0, longestRoad: false, largestArmy: false, hiddenVP: 0 },
  };
  const p2 = {
    id: 'p2', sessionToken: 't2', name: 'B', color: 'blue' as const, connected: true,
    hand: emptyHand(), ports: [], devCards: emptyDevCards(), devCardsBoughtThisTurn: [], knightsPlayed: 0,
    victoryPoints: { settlements: 0, cities: 0, longestRoad: false, largestArmy: false, hiddenVP: 0 },
  };
  return {
    code: 'TEST', hostId: 'p1', bankManagerId: 'p1', status: 'playing', extension56: false,
    players: [p1, p2], turnOrder: ['p1', 'p2'], currentTurnIndex: 0, phase: 'roll',
    specialBuildQueue: [], hexes: [], bank: fullBank(false),
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

  it('si el banco no tiene suficiente para varios, nadie de ellos recibe', () => {
    const s = makeState();
    s.bank.wool = 1;
    s.hexes = [
      { id: 'h1', number: 5, resource: 'wool', robber: false, owners: [{ playerId: 'p1', type: 'settlement' }] },
      { id: 'h2', number: 5, resource: 'wool', robber: false, owners: [{ playerId: 'p2', type: 'settlement' }] },
    ];
    const r = distributeForRoll(s, 5);
    expect(s.players[0].hand.wool).toBe(0);
    expect(s.players[1].hand.wool).toBe(0);
    expect(r.shortages).toContain('wool');
  });

  it('si solo un jugador esperaba el recurso y no alcanza, recibe lo que quede', () => {
    const s = makeState();
    s.bank.wool = 1;
    s.hexes = [
      { id: 'h1', number: 5, resource: 'wool', robber: false, owners: [
        { playerId: 'p1', type: 'city' }, // pide 2
      ] },
    ];
    const r = distributeForRoll(s, 5);
    expect(s.players[0].hand.wool).toBe(1);
    expect(r.partials.length).toBe(1);
    expect(r.partials[0]).toEqual({ playerId: 'p1', resource: 'wool', given: 1, wanted: 2 });
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
});
