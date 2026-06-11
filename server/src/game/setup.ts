import { nanoid } from 'nanoid';
import { Hand, Hex, InitialBuilding, Player, Resource, RESOURCES, emptyHand } from './state';

// Lógica pura de la colocación inicial: validación del registro de cada jugador,
// sembrado de la tabla de producción y reparto de recursos del 2º poblado.

const VALID_NUMBERS = new Set([2, 3, 4, 5, 6, 8, 9, 10, 11, 12]);

export function validateInitialBuildings(buildings: InitialBuilding[]): { ok: true } | { ok: false; reason: string } {
  if (!Array.isArray(buildings) || buildings.length !== 2) {
    return { ok: false, reason: 'Registra exactamente tus 2 poblados iniciales.' };
  }
  const granting = buildings.filter((b) => b.grantsStartingResources);
  if (granting.length !== 1) {
    return { ok: false, reason: 'Marca exactamente un poblado como tu 2º poblado (el que recibe recursos).' };
  }
  for (const b of buildings) {
    if (b.type !== 'settlement' && b.type !== 'city') {
      return { ok: false, reason: 'Tipo de construcción inválido.' };
    }
    if (!Array.isArray(b.spots) || b.spots.length < 1 || b.spots.length > 3) {
      return { ok: false, reason: 'Cada poblado toca entre 1 y 3 fichas (el desierto no se registra).' };
    }
    for (const spot of b.spots) {
      if (!VALID_NUMBERS.has(spot.number)) {
        return { ok: false, reason: 'Los números deben estar entre 2 y 12 (el 7 no existe en el tablero).' };
      }
      if (!RESOURCES.includes(spot.resource)) {
        return { ok: false, reason: 'Recurso inválido en una ficha.' };
      }
    }
  }
  return { ok: true };
}

export function playerSetupComplete(player: Pick<Player, 'initialBuildings'>): boolean {
  return validateInitialBuildings(player.initialBuildings).ok;
}

export interface SetupResult {
  hexes: Hex[];
  // Recursos de inicio efectivamente entregados a cada jugador (ya con banco limitado aplicado)
  grants: Record<string, Hand>;
  // Avisos de banco insuficiente durante el reparto inicial
  shortages: Array<{ playerId: string; resource: Resource; wanted: number; given: number }>;
}

// Toma los initialBuildings de todos y devuelve los hexes sembrados + el reparto
// de recursos de inicio. Muta `bank` descontando lo entregado.
export function applyInitialSetup(
  players: Array<Pick<Player, 'id' | 'initialBuildings'>>,
  bank: Hand
): SetupResult {
  const hexes: Hex[] = [];
  const byKey = new Map<string, Hex>(); // une fichas por number+resource

  const hexFor = (number: number, resource: Resource): Hex => {
    const key = `${number}:${resource}`;
    let hex = byKey.get(key);
    if (!hex) {
      hex = { id: nanoid(8), number, resource, robber: false, owners: [] };
      byKey.set(key, hex);
      hexes.push(hex);
    }
    return hex;
  };

  const grants: Record<string, Hand> = {};
  const shortages: SetupResult['shortages'] = [];

  for (const player of players) {
    grants[player.id] = emptyHand();
    for (const building of player.initialBuildings) {
      for (const spot of building.spots) {
        const hex = hexFor(spot.number, spot.resource);
        // El mismo jugador puede tocar la misma ficha con sus 2 poblados: ambos producen.
        // buildingId vincula las fichas del mismo poblado para no inflar los VP.
        hex.owners.push({ playerId: player.id, type: building.type, buildingId: building.id });
      }
      if (building.grantsStartingResources) {
        for (const spot of building.spots) {
          if (bank[spot.resource] >= 1) {
            bank[spot.resource] -= 1;
            grants[player.id][spot.resource] += 1;
          } else {
            shortages.push({ playerId: player.id, resource: spot.resource, wanted: 1, given: 0 });
          }
        }
      }
    }
  }

  // Ordenar por número para que la tabla de producción salga legible.
  hexes.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  return { hexes, grants, shortages };
}
