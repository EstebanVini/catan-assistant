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
  Commodity,
  COMMODITIES,
  CommodityHand,
  RESOURCE_COMMODITY,
  Discipline,
  DISCIPLINE_COMMODITY,
  MAX_IMPROVEMENT_LEVEL,
  improvementUpgradeCost,
  ProgressCardType,
  ProgressDecks,
  PROGRESS_DECK_COUNTS,
  TradeItemKind,
  emptyProgressDecks,
  knightDefenseStrength,
  handLimitForSeven,
  commodityTotal,
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
    drainBank(bank, res, n);
  }
}

// El banco es ILIMITADO (decisión de mesa): nunca bloquea una entrega. El
// contador es solo informativo y tiene piso en 0 para no mostrar negativos.
export function drainBank(bank: Hand, res: Resource, n: number): void {
  bank[res] = Math.max(0, bank[res] - n);
}

// Banco de mercancías: mismo criterio que el de recursos (ilimitado, piso 0).
export function drainCommodityBank(bank: CommodityHand, c: Commodity, n: number): void {
  bank[c] = Math.max(0, bank[c] - n);
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

// === Mazos de cartas de progreso (Caballeros y Ciudades) ===
export function buildProgressDecks(): ProgressDecks {
  const decks = emptyProgressDecks();
  (Object.keys(PROGRESS_DECK_COUNTS) as Discipline[]).forEach((disc) => {
    const counts = PROGRESS_DECK_COUNTS[disc];
    const deck: ProgressCardType[] = [];
    (Object.entries(counts) as [ProgressCardType, number][]).forEach(([card, n]) => {
      for (let i = 0; i < n; i++) deck.push(card);
    });
    decks[disc] = shuffle(deck);
  });
  return decks;
}

// Roba la carta superior del mazo de la disciplina `disc`. Si el mazo está
// vacío, RECICLA la pila de descarte (cartas ya jugadas/descartadas) rebarajándola
// dentro del mazo: así las cartas de progreso no se "acaban". Devuelve null solo
// si tampoco hay descartes que reciclar.
export function drawProgressCard(
  decks: ProgressDecks,
  discards: ProgressDecks,
  disc: Discipline
): ProgressCardType | null {
  if (decks[disc].length === 0) {
    if (discards[disc].length === 0) return null;
    decks[disc] = shuffle(discards[disc]);
    discards[disc] = [];
  }
  return decks[disc].pop() ?? null;
}

// ¿El jugador roba carta de la disciplina `disc` con este dado rojo? Regla del
// calendario: roba si su nivel de mejora ≥ valor del dado rojo (1-6). Nivel 0
// nunca roba; nivel 5 roba con rojo 1-5 (nunca con 6).
export function drawsProgressCard(level: number, redDie: number): boolean {
  return level >= 1 && redDie >= 1 && redDie <= level;
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
// Devuelve un mapa { playerId -> recursos recibidos } y muta bank + hands.
// El banco es ilimitado: todos reciben su demanda completa, siempre.
// `shortages`/`partials` se conservan en la firma (siempre vacíos) para no
// romper a los consumidores.
export interface DistributionResult {
  perPlayer: Record<string, Partial<Hand>>;
  // Mercancías recibidas por jugador (solo Caballeros y Ciudades; vacío en base).
  perPlayerCommodities: Record<string, Partial<CommodityHand>>;
  shortages: Resource[];
  partials: Array<{ playerId: string; resource: Resource; given: number; wanted: number }>;
}

export function distributeForRoll(state: GameState, number: number): DistributionResult {
  const perPlayer: Record<string, Partial<Hand>> = {};
  const perPlayerCommodities: Record<string, Partial<CommodityHand>> = {};

  for (const hex of state.hexes) {
    if (hex.number !== number) continue;
    if (hex.robber) continue;
    if (!hex.resource) continue;
    const resource = hex.resource;
    // En Caballeros y Ciudades una CIUDAD sobre bosque/pastura/montaña produce
    // 1 recurso + 1 mercancía (en vez de 2 recursos); sobre trigo/ladrillo
    // produce 2 recursos (no hay mercancía asociada). Los poblados y todo el
    // modo base se comportan igual que siempre.
    const commodity = state.citiesKnights ? RESOURCE_COMMODITY[resource] : undefined;
    for (const owner of hex.owners) {
      const player = state.players.find((p) => p.id === owner.playerId);
      if (!player) continue;
      if (owner.type === 'city' && commodity) {
        // Ciudad sobre montaña/bosque/pastura en C&K: 1 recurso + 1 mercancía.
        player.hand[resource] += 1;
        drainBank(state.bank, resource, 1);
        perPlayer[owner.playerId] = perPlayer[owner.playerId] ?? {};
        perPlayer[owner.playerId][resource] = (perPlayer[owner.playerId][resource] ?? 0) + 1;
        player.commodities[commodity] += 1;
        drainCommodityBank(state.commodityBank, commodity, 1);
        perPlayerCommodities[owner.playerId] = perPlayerCommodities[owner.playerId] ?? {};
        perPlayerCommodities[owner.playerId][commodity] =
          (perPlayerCommodities[owner.playerId][commodity] ?? 0) + 1;
      } else {
        // Poblado (1) o ciudad sobre trigo/ladrillo o cualquier ciudad del base (2).
        const n = owner.type === 'city' ? 2 : 1;
        player.hand[resource] += n;
        drainBank(state.bank, resource, n);
        perPlayer[owner.playerId] = perPlayer[owner.playerId] ?? {};
        perPlayer[owner.playerId][resource] = (perPlayer[owner.playerId][resource] ?? 0) + n;
      }
    }
  }

  return { perPlayer, perPlayerCommodities, shortages: [], partials: [] };
}

// === Acueducto (Ciencia nivel 3, Caballeros y Ciudades) ===
// Tras una tirada de producción, los jugadores con Ciencia ≥3 que NO recibieron
// ningún recurso/mercancía pueden tomar 1 recurso del banco a su elección. Esto
// incluye el 7 (que bloquea la producción): en ese caso `receivedAny` está
// vacío, así que todos los de Ciencia ≥3 son beneficiarios.
export function aqueductBeneficiaries(
  players: Array<Pick<Player, 'id' | 'improvements'>>,
  receivedAny: Set<string>
): string[] {
  return players
    .filter((p) => p.improvements.science >= 3 && !receivedAny.has(p.id))
    .map((p) => p.id);
}

// === Cálculo de descartes tras 7 ===
// Base: descarta si tienes >7 cartas (recursos). En Caballeros y Ciudades el
// total incluye mercancías y el límite es 7 + 2·muros (los muros protegen tu
// mano de los bárbaros del 7).
export function computePendingDiscards(state: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of state.players) {
    const total = state.citiesKnights
      ? handTotal(p.hand) + commodityTotal(p.commodities)
      : handTotal(p.hand);
    const limit = handLimitForSeven(p.walls, state.citiesKnights);
    if (total > limit) out[p.id] = Math.floor(total / 2);
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

// Roba hasta `n` cartas al azar de la mano de la víctima incluyendo MERCANCÍAS
// (recursos + mercancías; las cartas de progreso no se roban así). Usado por
// Maestro Mercader (Caballeros y Ciudades). Devuelve cuántas robó.
export function stealRandomMixed(victim: Player, thief: Player, n: number): number {
  let stolen = 0;
  for (let k = 0; k < n; k++) {
    const pool: Array<{ kind: TradeItemKind; type: Resource | Commodity }> = [];
    for (const r of RESOURCES) for (let i = 0; i < victim.hand[r]; i++) pool.push({ kind: 'resource', type: r });
    for (const c of COMMODITIES) for (let i = 0; i < victim.commodities[c]; i++) pool.push({ kind: 'commodity', type: c });
    if (pool.length === 0) break;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick.kind === 'resource') {
      victim.hand[pick.type as Resource] -= 1;
      thief.hand[pick.type as Resource] += 1;
    } else {
      victim.commodities[pick.type as Commodity] -= 1;
      thief.commodities[pick.type as Commodity] += 1;
    }
    stolen += 1;
  }
  return stolen;
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
  // Banco ilimitado: nunca se queda sin el recurso a entregar.
  player.hand[give] -= ratio;
  state.bank[give] += ratio;
  player.hand[receive] += 1;
  drainBank(state.bank, receive, 1);
  return { ok: true, ratio };
}

// Proporción del banco para DAR `give` (recurso o mercancía) en Caballeros y
// Ciudades, con todos los modificadores de la expansión:
//  - Flota Mercante (carta): 2:1 del tipo elegido este turno (recurso o mercancía).
//  - Comerciante (Mercader): 2:1 del recurso donde está, si lo controlas.
//  - Guilda / Casa de Comercio (Comercio nivel 3): 2:1 para MERCANCÍAS.
//  - Puertos: 2:1 del recurso del puerto; 3:1 con puerto genérico (también
//    aplica a mercancías). Por defecto 4:1.
export function bankTradeRatioCK(
  state: Pick<GameState, 'merchant'>,
  player: Player,
  giveKind: TradeItemKind,
  give: Resource | Commodity
): number {
  const mf = player.merchantFleet;
  if (mf && mf.kind === giveKind && mf.type === give) return 2;
  if (giveKind === 'resource') {
    const r = give as Resource;
    if (state.merchant && state.merchant.ownerId === player.id && state.merchant.resource === r) return 2;
    if (player.ports.includes(r as PortType)) return 2;
    if (player.ports.includes('3:1')) return 3;
    return 4;
  }
  // Mercancía: la Guilda (Comercio nivel 3) cambia 2 mercancías del mismo tipo
  // por 1 recurso o 1 mercancía distinta (2:1). Los puertos 2:1 de recurso NO
  // aplican a mercancías; el genérico 3:1 sí.
  if (player.improvements.trade >= 3) return 2;
  if (player.ports.includes('3:1')) return 3;
  return 4;
}

export interface BankTradeResult {
  ok: boolean;
  ratio?: number;
  reason?: string;
}

// Intercambio con el banco/puertos en C&K: da `ratio` de un ítem (recurso o
// mercancía) y recibe 1 de otro. Generaliza tradeWithBank con los modificadores
// de la expansión. El banco de recursos/mercancías es ilimitado (informativo).
export function tradeWithBankCK(
  state: GameState,
  player: Player,
  giveKind: TradeItemKind,
  give: Resource | Commodity,
  receiveKind: TradeItemKind,
  receive: Resource | Commodity
): BankTradeResult {
  if (giveKind === receiveKind && give === receive) {
    return { ok: false, reason: 'No puedes intercambiar el mismo tipo de carta.' };
  }
  const ratio = bankTradeRatioCK(state, player, giveKind, give);
  const have = giveKind === 'resource' ? player.hand[give as Resource] : player.commodities[give as Commodity];
  if (have < ratio) {
    return { ok: false, reason: `Necesitas ${ratio} para esta proporción.` };
  }
  if (giveKind === 'resource') {
    player.hand[give as Resource] -= ratio;
    state.bank[give as Resource] += ratio;
  } else {
    player.commodities[give as Commodity] -= ratio;
    state.commodityBank[give as Commodity] = Math.min(12, state.commodityBank[give as Commodity] + ratio);
  }
  if (receiveKind === 'resource') {
    player.hand[receive as Resource] += 1;
    drainBank(state.bank, receive as Resource, 1);
  } else {
    player.commodities[receive as Commodity] += 1;
    drainCommodityBank(state.commodityBank, receive as Commodity, 1);
  }
  return { ok: true, ratio };
}

// === Validación de oferta de trade entre jugadores ===
// `give`/`receive` son recursos; `giveC`/`receiveC` son mercancías (C&K). Las
// cartas de progreso NO se comercian.
export function validateTradeOffer(
  from: Player,
  to: Player,
  give: Partial<Hand>,
  receive: Partial<Hand>,
  // Regla extra: permite ofertas desiguales (un lado en 0). Aun así se exige
  // que la oferta tenga AL MENOS una carta en algún lado.
  allowUnequal = false,
  giveC: Partial<CommodityHand> = {},
  receiveC: Partial<CommodityHand> = {}
): { ok: boolean; reason?: string } {
  const sum = (o: Partial<Record<string, number>>) =>
    Object.values(o).reduce<number>((a, b) => a + (b ?? 0), 0);
  const giveTotal = sum(give) + sum(giveC);
  const recvTotal = sum(receive) + sum(receiveC);
  if (allowUnequal) {
    if (giveTotal === 0 && recvTotal === 0) return { ok: false, reason: 'La oferta no tiene cartas.' };
  } else if (giveTotal === 0 || recvTotal === 0) {
    return { ok: false, reason: 'Oferta vacía.' };
  }
  for (const [res, n] of Object.entries(give) as [Resource, number][]) {
    if (from.hand[res] < n) return { ok: false, reason: `${from.name} ya no tiene esos recursos.` };
  }
  for (const [c, n] of Object.entries(giveC) as [Commodity, number][]) {
    if (from.commodities[c] < n) return { ok: false, reason: `${from.name} ya no tiene esas mercancías.` };
  }
  for (const [res, n] of Object.entries(receive) as [Resource, number][]) {
    if (to.hand[res] < n) return { ok: false, reason: `${to.name} ya no tiene esos recursos.` };
  }
  for (const [c, n] of Object.entries(receiveC) as [Commodity, number][]) {
    if (to.commodities[c] < n) return { ok: false, reason: `${to.name} ya no tiene esas mercancías.` };
  }
  return { ok: true };
}

export function executeTrade(
  from: Player,
  to: Player,
  give: Partial<Hand>,
  receive: Partial<Hand>,
  giveC: Partial<CommodityHand> = {},
  receiveC: Partial<CommodityHand> = {}
): void {
  for (const [res, n] of Object.entries(give) as [Resource, number][]) {
    from.hand[res] -= n;
    to.hand[res] += n;
  }
  for (const [c, n] of Object.entries(giveC) as [Commodity, number][]) {
    from.commodities[c] -= n;
    to.commodities[c] += n;
  }
  for (const [res, n] of Object.entries(receive) as [Resource, number][]) {
    to.hand[res] -= n;
    from.hand[res] += n;
  }
  for (const [c, n] of Object.entries(receiveC) as [Commodity, number][]) {
    to.commodities[c] -= n;
    from.commodities[c] += n;
  }
}

// === Mejoras de ciudad (Caballeros y Ciudades) ===
export interface CityUpgradeResult {
  ok: boolean;
  reason?: string;
  discipline?: Discipline;
  level?: number;
  abilityUnlocked?: 'tradingHouse' | 'fortress' | 'aqueduct'; // nivel 3
  gainedMetropolis?: boolean;
  stoleMetropolisFrom?: string; // playerId al que se le arrebató
  metropolisBlocked?: boolean; // llegó a nivel 4+ pero la metrópolis está blindada (dueño en nivel 5)
}

const LEVEL3_ABILITY: Record<Discipline, 'tradingHouse' | 'fortress' | 'aqueduct'> = {
  trade: 'tradingHouse',
  politics: 'fortress',
  science: 'aqueduct',
};

// Sube UN nivel la disciplina indicada para `player`. Pura sobre el estado
// (muta player y state); el handler hace I/O (log/notice/broadcast). En el
// asistente no hay geometría de tablero: la metrópolis se hospeda en cualquier
// ciudad del jugador (debe tener al menos una).
export function upgradeCityImprovement(
  state: GameState,
  player: Player,
  discipline: Discipline,
  // Descuento en mercancía (carta de progreso "Grúa": 1 menos). Piso en 0.
  discount = 0
): CityUpgradeResult {
  const current = player.improvements[discipline];
  const target = current + 1;
  if (target > MAX_IMPROVEMENT_LEVEL) {
    return { ok: false, reason: 'Esa disciplina ya está al nivel máximo.' };
  }
  const cost = Math.max(0, improvementUpgradeCost(target) - discount);
  const commodity = DISCIPLINE_COMMODITY[discipline];
  if (player.commodities[commodity] < cost) {
    return {
      ok: false,
      reason: `Necesitas ${cost} ${commodity === 'coin' ? 'moneda' : commodity === 'paper' ? 'papel' : 'tela'} para el nivel ${target}.`,
    };
  }
  const hasCity = player.buildings.some((b) => b.type === 'city');
  const owner = state.metropolisOwners[discipline];
  // Reglas de metrópolis (decisión de mesa, cambios.txt):
  //  - Se reclama al llegar a nivel 4 si está libre.
  //  - Se ARREBATA al llegar a nivel 4 (o más) si la tiene OTRO jugador que
  //    aún NO la ha blindado, es decir que sigue por DEBAJO del nivel máximo
  //    (5). Empate en nivel 4 → el último en llegar se la lleva.
  //  - Un dueño en nivel 5 la tiene BLINDADA: nadie se la puede quitar.
  const ownerLevel =
    owner !== null && owner !== player.id
      ? (state.players.find((p) => p.id === owner)?.improvements[discipline] ?? 0)
      : 0;
  const willClaim = target >= 4 && owner === null;
  const willSteal =
    target >= 4 &&
    owner !== null &&
    owner !== player.id &&
    ownerLevel < MAX_IMPROVEMENT_LEVEL &&
    target >= ownerLevel;
  // Llegar a nivel 4+ con la metrópolis ya blindada (dueño en nivel 5): la
  // mejora ocurre, pero no la obtienes (se informa al jugador).
  const blockedByLock =
    target >= 4 && owner !== null && owner !== player.id && ownerLevel >= MAX_IMPROVEMENT_LEVEL;
  if ((willClaim || willSteal) && !hasCity) {
    return { ok: false, reason: 'Necesitas una ciudad para convertirla en metrópolis.' };
  }

  // Cobrar la mercancía (banco ilimitado informativo).
  player.commodities[commodity] -= cost;
  state.commodityBank[commodity] = Math.min(12, state.commodityBank[commodity] + cost);
  player.improvements[discipline] = target;

  const result: CityUpgradeResult = { ok: true, discipline, level: target };
  if (target === 3) result.abilityUnlocked = LEVEL3_ABILITY[discipline];

  if (willClaim) {
    state.metropolisOwners[discipline] = player.id;
    if (!player.metropolises.includes(discipline)) player.metropolises.push(discipline);
    result.gainedMetropolis = true;
  } else if (willSteal) {
    const prev = state.players.find((p) => p.id === owner);
    if (prev) prev.metropolises = prev.metropolises.filter((d) => d !== discipline);
    state.metropolisOwners[discipline] = player.id;
    if (!player.metropolises.includes(discipline)) player.metropolises.push(discipline);
    result.gainedMetropolis = true;
    result.stoleMetropolisFrom = owner ?? undefined;
  } else if (blockedByLock) {
    result.metropolisBlocked = true;
  }
  return result;
}

// === Puntos de victoria ===
export function recomputeVictoryPoints(state: GameState): void {
  // La tabla de construcción de cada jugador es la fuente de verdad: cada
  // entrada es UNA construcción física, sin importar cuántas fichas toque.
  for (const p of state.players) {
    p.victoryPoints.settlements = p.buildings.filter((b) => b.type === 'settlement').length;
    p.victoryPoints.cities = p.buildings.filter((b) => b.type === 'city').length;
  }
}

export function publicVictoryPoints(p: Player): number {
  return (
    p.victoryPoints.settlements +
    2 * p.victoryPoints.cities +
    // Cada metrópolis suma +2 sobre la ciudad que la hospeda (ciudad 2 → 4 PV).
    2 * (p.metropolises?.length ?? 0) +
    // Cada carta "Defensor de Catán" vale +1 PV.
    (p.defenderCards ?? 0) +
    (p.victoryPoints.longestRoad ? 2 : 0) +
    (p.victoryPoints.largestArmy ? 2 : 0) +
    p.victoryPoints.vpCards
  );
}

// Todo el marcador es público: las cartas de Punto de victoria solo cuentan
// una vez USADAS (mientras están en la mano son una carta de desarrollo más).
export function totalVictoryPoints(p: Player): number {
  return publicVictoryPoints(p);
}

// +1 PV si el jugador CONTROLA el comerciante (carta de progreso "Mercader").
// Solo C&K; en el base no hay comerciante (state.merchant null/ausente).
export function merchantVP(state: Pick<GameState, 'merchant'>, playerId: string): number {
  return state.merchant?.ownerId === playerId ? 1 : 0;
}

// PV TOTALES de un jugador INCLUYENDO el comerciante. Úsalo en todo lo que
// decida ganar o el marcador (checkVictory, declareWin, gameStats, persistencia).
export function playerVP(state: Pick<GameState, 'merchant'>, p: Player): number {
  return publicVictoryPoints(p) + merchantVP(state, p.id);
}

// === Resolución del ataque bárbaro (Caballeros y Ciudades) ===
export interface BarbarianResult {
  attack: number; // fuerza bárbara = total de ciudades+metrópolis
  defense: number; // fuerza de defensa = suma de caballeros activos de todos
  defended: boolean;
  topDefenders: string[]; // mayor aporte individual de defensa (>0)
  uniqueDefender: string | null; // único top → recibe Defensor de Catán
  tieRewardDraws: Array<{ playerId: string; card: ProgressCardType; discipline: Discipline }>;
  losers: string[]; // pillaje: deben degradar una ciudad (eligen cuál)
}

// Calcula y APLICA el resultado del ataque: otorga Defensor de Catán (o cartas
// de progreso en empate), marca a los perdedores que deben degradar una ciudad,
// desactiva TODOS los caballeros, cuenta el ataque (activa el ladrón en el
// primero) y reinicia la pista. La degradación de ciudad la hace cada perdedor
// después (barbarian:downgradeCity), por eso aquí solo se marcan.
export function resolveBarbarianAttack(state: GameState): BarbarianResult {
  recomputeVictoryPoints(state); // ciudades al día

  const contrib = state.players.map((p) => ({
    id: p.id,
    defense: knightDefenseStrength(p.knights),
    cities: p.victoryPoints.cities,
    spareCities: p.victoryPoints.cities - p.metropolises.length, // ciudades no-metrópolis
  }));
  const attack = contrib.reduce((s, c) => s + c.cities, 0);
  const defense = contrib.reduce((s, c) => s + c.defense, 0);
  const defended = defense >= attack;

  const result: BarbarianResult = {
    attack, defense, defended, topDefenders: [], uniqueDefender: null,
    tieRewardDraws: [], losers: [],
  };

  if (defended) {
    const maxDef = Math.max(0, ...contrib.map((c) => c.defense));
    if (maxDef > 0) {
      const top = contrib.filter((c) => c.defense === maxDef).map((c) => c.id);
      result.topDefenders = top;
      if (top.length === 1) {
        const winner = state.players.find((p) => p.id === top[0]);
        if (winner) winner.defenderCards += 1;
        result.uniqueDefender = top[0];
      } else {
        // Empate: cada top roba 1 carta de progreso (disciplina al azar con
        // mazo o pila de descarte reciclable).
        for (const id of top) {
          const p = state.players.find((pp) => pp.id === id);
          if (!p) continue;
          const avail = (['trade', 'politics', 'science'] as Discipline[]).filter(
            (d) => state.progressDecks[d].length > 0 || state.progressDiscards[d].length > 0
          );
          if (avail.length === 0) continue;
          const disc = avail[Math.floor(Math.random() * avail.length)];
          const card = drawProgressCard(state.progressDecks, state.progressDiscards, disc);
          if (!card) continue;
          p.progressCards.push(card);
          if (!state.extraRules.unlimitedProgressCards && p.progressCards.length > 4) {
            state.pendingProgressDiscard[p.id] = p.progressCards.length - 4;
          }
          result.tieRewardDraws.push({ playerId: id, card, discipline: disc });
        }
      }
    }
  } else {
    // Pillaje: los de MENOR defensa (sobre TODOS) que tengan una ciudad
    // no-metrópolis pierden una ciudad. Quien no tenga ciudad está a salvo.
    const minDef = Math.min(...contrib.map((c) => c.defense));
    const losers = contrib
      .filter((c) => c.defense === minDef && c.spareCities > 0)
      .map((c) => c.id);
    result.losers = losers;
    state.pendingBarbarianLoss = losers;
  }

  // Desactivar todos los caballeros y reiniciar la pista.
  for (const p of state.players) for (const k of p.knights) k.active = false;
  state.barbarianAttacks += 1;
  if (state.barbarianAttacks === 1) state.robberActive = true;
  state.barbarianStep = 0;

  return result;
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
