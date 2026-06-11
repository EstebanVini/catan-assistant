import { nanoid } from 'nanoid';
import { Building, Hand, Hex, Player, Resource, RESOURCES, emptyHand } from './state';

// Lógica pura de la tabla de construcción: validación del registro de cada
// jugador, derivación de los hexes de producción y reparto de recursos de
// inicio (1 carta por cada ficha que tocan los poblados registrados).

const VALID_NUMBERS = new Set([2, 3, 4, 5, 6, 8, 9, 10, 11, 12]);
const VALID_PORT_TYPES = new Set<string>(['3:1', 'brick', 'lumber', 'wool', 'grain', 'ore']);

// Validación laxa: cualquier edición de la tabla durante el lobby o la
// partida. No exige cantidades — los jugadores agregan poblados/ciudades a
// voluntad, incluso sin recursos (el tablero físico es la autoridad).
export function validateBuildings(buildings: Building[]): { ok: true } | { ok: false; reason: string } {
  if (!Array.isArray(buildings)) {
    return { ok: false, reason: 'Registro de construcciones inválido.' };
  }
  for (const b of buildings) {
    if (b.type !== 'settlement' && b.type !== 'city') {
      return { ok: false, reason: 'Tipo de construcción inválido.' };
    }
    if (b.port != null && !VALID_PORT_TYPES.has(b.port)) {
      return { ok: false, reason: 'Tipo de puerto inválido.' };
    }
    const maxSpots = b.port ? 2 : 3;
    if (!Array.isArray(b.spots) || b.spots.length > maxSpots) {
      return { ok: false, reason: `Una construcción con puerto toca entre 0 y 2 fichas.` };
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

// Validación estricta para INICIAR la partida: exactamente los 2 poblados de
// salida, cada uno con 1–3 fichas.
export function validateInitialBuildings(buildings: Building[]): { ok: true } | { ok: false; reason: string } {
  const base = validateBuildings(buildings);
  if (!base.ok) return base;
  if (buildings.length !== 2) {
    return { ok: false, reason: 'Registra exactamente tus 2 poblados iniciales.' };
  }
  if (buildings.some((b) => b.spots.length < 1)) {
    return { ok: false, reason: 'Cada poblado de salida toca entre 1 y 3 fichas (el desierto no se registra).' };
  }
  return { ok: true };
}

export function playerSetupComplete(player: Pick<Player, 'buildings'>): boolean {
  return validateInitialBuildings(player.buildings).ok;
}

function hexKey(number: number | null, resource: Resource | null): string {
  return number !== null && resource ? `${number}:${resource}` : 'desert';
}

// Deriva los hexes de producción desde las tablas de construcción de TODOS
// los jugadores. Une fichas por número+recurso, conserva los ids previos
// (identidad estable para la UI) y preserva la posición del ladrón; si su
// ficha desapareció (o nunca se colocó), queda en el desierto. Siempre existe
// exactamente un hex desierto para que el ladrón tenga a dónde volver.
export function rebuildHexes(
  players: Array<Pick<Player, 'id' | 'buildings'>>,
  prevHexes: Hex[]
): Hex[] {
  const prevById = new Map<string, Hex>();
  for (const h of prevHexes) prevById.set(hexKey(h.number, h.resource), h);
  const prevRobber = prevHexes.find((h) => h.robber);
  const robberKey = prevRobber ? hexKey(prevRobber.number, prevRobber.resource) : 'desert';

  const hexes: Hex[] = [];
  const byKey = new Map<string, Hex>();

  const desert: Hex = {
    id: prevById.get('desert')?.id ?? nanoid(8),
    number: null,
    resource: null,
    robber: false,
    owners: [],
  };
  byKey.set('desert', desert);

  const hexFor = (number: number, resource: Resource): Hex => {
    const key = hexKey(number, resource);
    let hex = byKey.get(key);
    if (!hex) {
      hex = {
        id: prevById.get(key)?.id ?? nanoid(8),
        number,
        resource,
        robber: false,
        owners: [],
      };
      byKey.set(key, hex);
      hexes.push(hex);
    }
    return hex;
  };

  for (const player of players) {
    for (const building of player.buildings) {
      for (const spot of building.spots) {
        const hex = hexFor(spot.number, spot.resource);
        // El mismo jugador puede tocar la misma ficha con 2 construcciones:
        // ambas producen. buildingId vincula las fichas de la misma
        // construcción (la UI puede agrupar sin inflar conteos).
        hex.owners.push({ playerId: player.id, type: building.type, buildingId: building.id });
      }
    }
  }

  // Ordenar por número para que la tabla salga legible; el desierto al final.
  hexes.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  hexes.push(desert);

  const robberHex = byKey.get(robberKey) ?? desert;
  robberHex.robber = true;
  return hexes;
}

export interface SetupResult {
  hexes: Hex[];
  // Recursos de inicio entregados a cada jugador (banco ilimitado: completos)
  grants: Record<string, Hand>;
  // Siempre vacío desde que el banco es ilimitado; se conserva por la firma.
  shortages: Array<{ playerId: string; resource: Resource; wanted: number; given: number }>;
}

// Toma los buildings de todos y devuelve los hexes derivados + el reparto de
// recursos de inicio: TODOS los poblados registrados dan 1 carta por cada
// ficha que tocan. El banco es ilimitado (su contador solo informa, piso en
// 0). El ladrón arranca en el desierto.
export function applyInitialSetup(
  players: Array<Pick<Player, 'id' | 'buildings'>>,
  bank: Hand
): SetupResult {
  const hexes = rebuildHexes(players, []);

  const grants: Record<string, Hand> = {};

  for (const player of players) {
    grants[player.id] = emptyHand();
    for (const building of player.buildings) {
      for (const spot of building.spots) {
        bank[spot.resource] = Math.max(0, bank[spot.resource] - 1);
        grants[player.id][spot.resource] += 1;
      }
    }
  }

  return { hexes, grants, shortages: [] };
}
