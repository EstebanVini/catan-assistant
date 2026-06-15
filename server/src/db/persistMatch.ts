import mongoose from 'mongoose';
import { GameState } from '../game/state';
import { totalVictoryPoints } from '../game/rules';
import { Match } from './models/Match';
import { User } from './models/User';
import { isDbConnected } from './connection';

// Al terminar la partida: crea el Match y actualiza atómicamente ($inc) las stats
// de los usuarios registrados. Los invitados solo quedan en Match.players.
export async function persistMatchResult(state: GameState): Promise<void> {
  if (!isDbConnected()) {
    console.warn('[db] Partida terminada sin MongoDB: resultado no persistido.');
    return;
  }
  const winner = state.players.find((p) => p.id === state.winnerId);
  if (!winner) return;
  try {
    await Match.create({
      code: state.code,
      extension56: state.extension56,
      startedAt: new Date(state.startedAt ?? Date.now()),
      endedAt: new Date(),
      winner: {
        userId: winner.userId ? new mongoose.Types.ObjectId(winner.userId) : undefined,
        name: winner.name,
      },
      players: state.players.map((p) => ({
        userId: p.userId ? new mongoose.Types.ObjectId(p.userId) : undefined,
        name: p.name,
        color: p.color ?? undefined,
        victoryPoints: totalVictoryPoints(p),
        longestRoad: p.victoryPoints.longestRoad,
        largestArmy: p.victoryPoints.largestArmy,
        knightsPlayed: p.knightsPlayed,
      })),
    });
    await Promise.all(
      state.players
        .filter((p) => p.userId)
        .map((p) => {
          const won = p.id === state.winnerId;
          // Update con pipeline de agregación: permite calcular la racha
          // (incremento condicional + máximo) en una sola operación atómica.
          // $ifNull cubre a usuarios creados antes de existir estos campos.
          return User.updateOne({ _id: p.userId }, [
            {
              $set: {
                'stats.gamesPlayed': { $add: [{ $ifNull: ['$stats.gamesPlayed', 0] }, 1] },
                'stats.wins': { $add: [{ $ifNull: ['$stats.wins', 0] }, won ? 1 : 0] },
                'stats.losses': { $add: [{ $ifNull: ['$stats.losses', 0] }, won ? 0 : 1] },
                'stats.longestRoadBadges': {
                  $add: [{ $ifNull: ['$stats.longestRoadBadges', 0] }, p.victoryPoints.longestRoad ? 1 : 0],
                },
                'stats.largestArmyBadges': {
                  $add: [{ $ifNull: ['$stats.largestArmyBadges', 0] }, p.victoryPoints.largestArmy ? 1 : 0],
                },
                'stats.totalVictoryPoints': {
                  $add: [{ $ifNull: ['$stats.totalVictoryPoints', 0] }, totalVictoryPoints(p)],
                },
                // El ganador suma 1 a su racha; el resto la reinicia a 0.
                'stats.currentWinStreak': won
                  ? { $add: [{ $ifNull: ['$stats.currentWinStreak', 0] }, 1] }
                  : 0,
              },
            },
            {
              // Tras actualizar la racha actual, recalcular la más larga.
              $set: {
                'stats.longestWinStreak': {
                  $max: [{ $ifNull: ['$stats.longestWinStreak', 0] }, '$stats.currentWinStreak'],
                },
              },
            },
          ]);
        })
    );
    console.log(`[db] Match ${state.code} persistido (${state.players.length} jugadores).`);
  } catch (err) {
    console.error('[db] No se pudo persistir el resultado:', (err as Error).message);
  }
}
