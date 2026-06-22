import { nanoid } from 'nanoid';
import { Building, BuildingSpot, Hand, Hex, Player, Resource, RESOURCES, emptyHand } from './state';

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

// Clave de agrupación de una ficha: si trae `hexId` explícito, es la ficha
// física a la que pertenece (permite distinguir dos fichas con el mismo
// número+recurso, y agrupar fichas de jugadores distintos en la misma ficha).
// Sin `hexId` (registros antiguos) se agrupa por número+recurso, como antes.
function spotKey(spot: BuildingSpot): string {
  return spot.hexId ?? `nr:${spot.number}:${spot.resource}`;
}

// Deriva los hexes de producción desde las tablas de construcción de TODOS
// los jugadores. Agrupa fichas por su identidad física (`hexId`, o
// número+recurso si falta), conserva los ids previos (identidad estable para
// la UI) y preserva la posición del ladrón por id; si su ficha desapareció (o
// nunca se colocó), queda en el primer desierto. `desertCount` controla cuántos
// hexes desierto existen (1 en el base, 2 en la extensión 5–6, como el tablero
// físico): el ladrón siempre tiene a dónde volver y hay fichas vacías para
// estacionarlo sin robar.
export function rebuildHexes(
  players: Array<Pick<Player, 'id' | 'buildings'>>,
  prevHexes: Hex[],
  desertCount = 1
): Hex[] {
  // Reusar el id previo de una ficha "legacy" (sin hexId) por número+recurso
  // para que el ladrón colocado sobre ella sobreviva a un rebuild.
  const prevByLegacyKey = new Map<string, string>();
  for (const h of prevHexes) {
    if (h.number !== null && h.resource) {
      const k = `nr:${h.number}:${h.resource}`;
      if (!prevByLegacyKey.has(k)) prevByLegacyKey.set(k, h.id);
    }
  }
  // Conservar los ids de los desiertos previos por posición (identidad estable
  // para la UI y para que el ladrón sobreviva al rebuild).
  const prevDesertIds = prevHexes
    .filter((h) => h.number === null && h.resource === null)
    .map((h) => h.id);
  const prevRobberId = prevHexes.find((h) => h.robber)?.id ?? null;

  const hexes: Hex[] = [];
  const byKey = new Map<string, Hex>();

  const count = Math.max(1, desertCount);
  const deserts: Hex[] = Array.from({ length: count }, (_, i) => ({
    id: prevDesertIds[i] ?? nanoid(8),
    number: null,
    resource: null,
    robber: false,
    owners: [],
  }));

  const hexForSpot = (spot: BuildingSpot): Hex => {
    const key = spotKey(spot);
    let hex = byKey.get(key);
    if (!hex) {
      hex = {
        id: spot.hexId ?? prevByLegacyKey.get(key) ?? nanoid(8),
        number: spot.number,
        resource: spot.resource,
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
        const hex = hexForSpot(spot);
        // El mismo jugador puede tocar la misma ficha con 2 construcciones:
        // ambas producen. buildingId vincula las fichas de la misma
        // construcción (la UI puede agrupar sin inflar conteos).
        hex.owners.push({ playerId: player.id, type: building.type, buildingId: building.id });
      }
    }
  }

  // Ordenar por número para que la tabla salga legible; los desiertos al final.
  hexes.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  hexes.push(...deserts);

  const robberHex = hexes.find((h) => h.id === prevRobberId) ?? deserts[0];
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
//
// Si `seedResources` es false (modo "iniciar sin fichas"), no se reparte
// nada: las manos quedan vacías. Los hexes igual se derivan de lo que se haya
// registrado (puede no haber ninguno).
export function applyInitialSetup(
  players: Array<Pick<Player, 'id' | 'buildings'>>,
  bank: Hand,
  seedResources = true,
  desertCount = 1
): SetupResult {
  const hexes = rebuildHexes(players, [], desertCount);

  const grants: Record<string, Hand> = {};

  for (const player of players) {
    grants[player.id] = emptyHand();
    if (!seedResources) continue;
    for (const building of player.buildings) {
      for (const spot of building.spots) {
        bank[spot.resource] = Math.max(0, bank[spot.resource] - 1);
        grants[player.id][spot.resource] += 1;
      }
    }
  }

  return { hexes, grants, shortages: [] };
}
