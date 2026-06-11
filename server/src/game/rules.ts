import {
  DevCardCounts,
  DevCardType,
  GameState,
  Hand,
  Hex,
  Player,
  PortType,
  RESOURCES,
  Resource,
  emptyHand,
  fullBank,
  handTotal,
  devCardsTotal,
} from './state';

// === Costos de construcción ===
export const BUILD_COSTS: Record<'road' | 'settlement' | 'city' | 'devcard', Partial<Hand>> = {
  road: { lumber: 1, brick: 1 },
  settlement: { lumber: 1, brick: 1, wool: 1, grain: 1 },
  city: { grain: 2, ore: 3 },
  devcard: { wool: 1, grain: 1, ore: 1 },
};

export function canAfford(hand: Hand, cost: Partial<Hand>): boolean {
  return (Object.entries(cost) as [Resource, number][]).every(([res, n]) => hand[res] >= n);
}

export function shortfall(hand: Hand, cost: Partial<Hand>): Partial<Hand> {
  const out: Partial<Hand> = {};
  for (const [res, n] of Object.entries(cost) as [Resource, number][]) {
    if (hand[res] < n) out[res] = n - hand[res];
  }
  return out;
}

export function payToBank(hand: Hand, bank: Hand, cost: Partial<Hand>): void {
  for (const [res, n] of Object.entries(cost) as [Resource, number][]) {
    hand[res] -= n;
    bank[res] += n;
  }
}

export function takeFromBank(hand: Hand, bank: Hand, take: Partial<Hand>): void {
  for (const [res, n] of Object.entries(take) as [Resource, number][]) {
    hand[res] += n;
    bank[res] -= n;
  }
}

// === Mazo de cartas de desarrollo ===
export function buildDevDeck(extension56: boolean): DevCardType[] {
  const counts: Record<DevCardType, number> = extension56
    ? { knight: 20, vp: 5, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3 }
    : { knight: 14, vp: 5, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2 };
  const deck: DevCardType[] = [];
  (Object.entries(counts) as [DevCardType, number][]).forEach(([type, n]) => {
    for (let i = 0; i < n; i++) deck.push(type);
  });
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// === Distribución por tirada ===
// Devuelve un mapa { playerId -> recursos recibidos } y mutate bank + hands.
export interface DistributionResult {
  perPlayer: Record<string, Partial<Hand>>;
  shortages: Resource[]; // recursos donde no alcanzó para todos y nadie recibió
  partials: Array<{ playerId: string; resource: Resource; given: number; wanted: number }>;
}

export function distributeForRoll(state: GameState, number: number): DistributionResult {
  const perPlayer: Record<string, Partial<Hand>> = {};
  const shortages: Resource[] = [];
  const partials: DistributionResult['partials'] = [];

  // 1. Calcular demanda por recurso, agrupada
  // Map<Resource, Map<playerId, count>>
  const demand: Map<Resource, Map<string, number>> = new Map();
  for (const hex of state.hexes) {
    if (hex.number !== number) continue;
    if (hex.robber) continue;
    if (!hex.resource) continue;
    for (const owner of hex.owners) {
      const add = owner.type === 'city' ? 2 : 1;
      if (!demand.has(hex.resource)) demand.set(hex.resource, new Map());
      const m = demand.get(hex.resource)!;
      m.set(owner.playerId, (m.get(owner.playerId) ?? 0) + add);
    }
  }

  // 2. Aplicar regla del banco limitado por recurso
  for (const [res, perPlayerDemand] of demand.entries()) {
    const total = Array.from(perPlayerDemand.values()).reduce((a, b) => a + b, 0);
    const available = state.bank[res];

    if (total <= available) {
      // Todo cabe
      for (const [pid, n] of perPlayerDemand.entries()) {
        perPlayer[pid] = perPlayer[pid] ?? {};
        perPlayer[pid][res] = (perPlayer[pid][res] ?? 0) + n;
      }
      state.bank[res] -= total;
      for (const pid of perPlayerDemand.keys()) {
        const player = state.players.find((p) => p.id === pid)!;
        player.hand[res] += perPlayerDemand.get(pid)!;
      }
    } else if (perPlayerDemand.size === 1) {
      // Solo un jugador, recibe lo que quede
      const [pid, wanted] = Array.from(perPlayerDemand.entries())[0];
      const given = available;
      if (given > 0) {
        perPlayer[pid] = perPlayer[pid] ?? {};
        perPlayer[pid][res] = (perPlayer[pid][res] ?? 0) + given;
        const player = state.players.find((p) => p.id === pid)!;
        player.hand[res] += given;
        state.bank[res] -= given;
        if (given < wanted) partials.push({ playerId: pid, resource: res, given, wanted });
      }
    } else {
      // Varios y no alcanza → nadie recibe
      shortages.push(res);
    }
  }

  return { perPlayer, shortages, partials };
}

// === Cálculo de descartes tras 7 ===
export function computePendingDiscards(state: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of state.players) {
    const total = handTotal(p.hand);
    if (total > 7) out[p.id] = Math.floor(total / 2);
  }
  return out;
}

// === Robo aleatorio ===
export function stealRandomResource(victim: Player, thief: Player): Resource | null {
  const pool: Resource[] = [];
  for (const r of RESOURCES) {
    for (let i = 0; i < victim.hand[r]; i++) pool.push(r);
  }
  if (pool.length === 0) return null;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  victim.hand[picked] -= 1;
  thief.hand[picked] += 1;
  return picked;
}

// === Intercambio con banco / puertos ===
export function bestBankRatio(player: Player, give: Resource): number {
  if (player.ports.includes(give as PortType)) return 2;
  if (player.ports.includes('3:1')) return 3;
  return 4;
}

export interface BankTradeResult {
  ok: boolean;
  ratio?: number;
  reason?: string;
}

export function tradeWithBank(
  state: GameState,
  player: Player,
  give: Resource,
  receive: Resource
): BankTradeResult {
  if (give === receive) return { ok: false, reason: 'No puedes intercambiar el mismo recurso.' };
  const ratio = bestBankRatio(player, give);
  if (player.hand[give] < ratio) {
    return { ok: false, reason: `Necesitas ${ratio} ${give} para esta proporción.` };
  }
  if (state.bank[receive] < 1) {
    return { ok: false, reason: `El banco no tiene ${receive}.` };
  }
  player.hand[give] -= ratio;
  state.bank[give] += ratio;
  player.hand[receive] += 1;
  state.bank[receive] -= 1;
  return { ok: true, ratio };
}

// === Validación de oferta de trade entre jugadores ===
export function validateTradeOffer(
  from: Player,
  to: Player,
  give: Partial<Hand>,
  receive: Partial<Hand>
): { ok: boolean; reason?: string } {
  const giveTotal = Object.values(give).reduce((a, b) => a + (b ?? 0), 0);
  const recvTotal = Object.values(receive).reduce((a, b) => a + (b ?? 0), 0);
  if (giveTotal === 0 || recvTotal === 0) return { ok: false, reason: 'Oferta vacía.' };
  for (const [res, n] of Object.entries(give) as [Resource, number][]) {
    if (from.hand[res] < n) return { ok: false, reason: `${from.name} ya no tiene esos recursos.` };
  }
  for (const [res, n] of Object.entries(receive) as [Resource, number][]) {
    if (to.hand[res] < n) return { ok: false, reason: `${to.name} ya no tiene esos recursos.` };
  }
  return { ok: true };
}

export function executeTrade(from: Player, to: Player, give: Partial<Hand>, receive: Partial<Hand>): void {
  for (const [res, n] of Object.entries(give) as [Resource, number][]) {
    from.hand[res] -= n;
    to.hand[res] += n;
  }
  for (const [res, n] of Object.entries(receive) as [Resource, number][]) {
    to.hand[res] -= n;
    from.hand[res] += n;
  }
}

// === Puntos de victoria ===
export function recomputeVictoryPoints(state: GameState): void {
  // Una construcción física toca 1..3 fichas: las entradas con el mismo
  // playerId+buildingId son la MISMA construcción y cuentan una sola vez
  // (si alguna entrada es city, la construcción cuenta como city).
  // Las entradas sin buildingId (ediciones manuales de la tabla) cuentan 1 cada una.
  const settlementsByPlayer: Record<string, number> = {};
  const citiesByPlayer: Record<string, number> = {};
  const buildings = new Map<string, { playerId: string; type: 'settlement' | 'city' }>();
  let manualSeq = 0;
  for (const hex of state.hexes) {
    for (const o of hex.owners) {
      const key = o.buildingId ? `${o.playerId}:${o.buildingId}` : `manual-${manualSeq++}`;
      const prev = buildings.get(key);
      if (!prev) buildings.set(key, { playerId: o.playerId, type: o.type });
      else if (prev.type === 'settlement' && o.type === 'city') prev.type = 'city';
    }
  }
  for (const b of buildings.values()) {
    if (b.type === 'settlement') settlementsByPlayer[b.playerId] = (settlementsByPlayer[b.playerId] ?? 0) + 1;
    else citiesByPlayer[b.playerId] = (citiesByPlayer[b.playerId] ?? 0) + 1;
  }
  for (const p of state.players) {
    p.victoryPoints.settlements = settlementsByPlayer[p.id] ?? 0;
    p.victoryPoints.cities = citiesByPlayer[p.id] ?? 0;
  }
}

export function publicVictoryPoints(p: Player): number {
  return (
    p.victoryPoints.settlements +
    2 * p.victoryPoints.cities +
    (p.victoryPoints.longestRoad ? 2 : 0) +
    (p.victoryPoints.largestArmy ? 2 : 0)
  );
}

export function totalVictoryPoints(p: Player): number {
  return publicVictoryPoints(p) + p.victoryPoints.hiddenVP;
}

// === Ejército más grande ===
export function recomputeLargestArmy(state: GameState, previousHolderId: string | null): string | null {
  let best: Player | null = null;
  for (const p of state.players) {
    if (p.knightsPlayed < 3) continue;
    if (!best || p.knightsPlayed > best.knightsPlayed) best = p;
  }
  if (!best) return previousHolderId;
  if (previousHolderId) {
    const prev = state.players.find((p) => p.id === previousHolderId);
    if (prev && prev.knightsPlayed >= best.knightsPlayed) {
      // Empate o el actual sigue siendo el mayor: conserva
      return previousHolderId;
    }
  }
  // Limpiar el flag previo y asignar al nuevo
  for (const p of state.players) p.victoryPoints.largestArmy = false;
  best.victoryPoints.largestArmy = true;
  return best.id;
}

// === Helpers ===
export function activePlayer(state: GameState): Player | undefined {
  const id = state.turnOrder[state.currentTurnIndex];
  return state.players.find((p) => p.id === id);
}

export function findPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function newBank(extension56: boolean): Hand {
  return fullBank(extension56);
}

export function newEmptyHand(): Hand {
  return emptyHand();
}

export function devCardCountsAfterPlay(d: DevCardCounts): number {
  return devCardsTotal(d);
}
