import mongoose from 'mongoose';
import { GameState, emptyGameStats } from '../game/state';
import { playerVP } from '../game/rules';
import { Match } from './models/Match';
import { User } from './models/User';
import { isDbConnected } from './connection';
import { AchievementContext, newlyUnlocked, xpForGame } from '../game/achievements';

// Al terminar la partida: crea el Match y actualiza las stats de cada usuario
// registrado (lectura-modificación-escritura por usuario; las partidas terminan
// con poca frecuencia y el server es un solo proceso). Calcula racha, XP y
// logros desbloqueados. Los invitados solo quedan en Match.players.
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
        victoryPoints: playerVP(state, p),
        longestRoad: p.victoryPoints.longestRoad,
        largestArmy: p.victoryPoints.largestArmy,
        knightsPlayed: p.knightsPlayed,
      })),
    });

    await Promise.all(
      state.players
        .filter((p) => p.userId)
        .map(async (p) => {
          const user = await User.findById(p.userId);
          if (!user) return;
          const won = p.id === state.winnerId;
          const finalVP = playerVP(state, p);
          const s = user.stats ?? ({} as NonNullable<typeof user.stats>);

          // Stats acumuladas base ($ifNull para usuarios viejos).
          const prevWins = s.wins ?? 0;
          const prevLosses = s.losses ?? 0;
          const prevGames = s.gamesPlayed ?? 0;
          const prevTotalVP = s.totalVictoryPoints ?? 0;
          const prevStreak = s.currentWinStreak ?? 0;
          const prevLongestStreak = s.longestWinStreak ?? 0;
          const prevXp = s.xp ?? 0;
          const prevAchievements: string[] = Array.isArray(s.achievements) ? s.achievements : [];

          const newStreak = won ? prevStreak + 1 : 0;
          const careerTotalVP = prevTotalVP + finalVP;

          const ctx: AchievementContext = {
            won,
            finalVP,
            opponentsVP: state.players
              .filter((o) => o.id !== p.id)
              .map((o) => playerVP(state, o)),
            hasLongestRoad: p.victoryPoints.longestRoad,
            hasLargestArmy: p.victoryPoints.largestArmy,
            citiesAtEnd: p.victoryPoints.cities,
            stealsThisGame: state.stealsByPlayer[p.id] ?? 0,
            careerTotalVP,
            winStreakAfter: newStreak,
          };
          const gs = p.gameStats ?? emptyGameStats();
          const fresh = newlyUnlocked(gs, ctx, prevAchievements);
          const gainedXp = xpForGame(ctx, fresh);

          user.set('stats.gamesPlayed', prevGames + 1);
          user.set('stats.wins', prevWins + (won ? 1 : 0));
          user.set('stats.losses', prevLosses + (won ? 0 : 1));
          user.set('stats.longestRoadBadges', (s.longestRoadBadges ?? 0) + (p.victoryPoints.longestRoad ? 1 : 0));
          user.set('stats.largestArmyBadges', (s.largestArmyBadges ?? 0) + (p.victoryPoints.largestArmy ? 1 : 0));
          user.set('stats.totalVictoryPoints', careerTotalVP);
          user.set('stats.currentWinStreak', newStreak);
          user.set('stats.longestWinStreak', Math.max(prevLongestStreak, newStreak));
          user.set('stats.xp', prevXp + gainedXp);
          user.set('stats.achievements', [...prevAchievements, ...fresh]);
          await user.save();
        })
    );
    console.log(`[db] Match ${state.code} persistido (${state.players.length} jugadores).`);
  } catch (err) {
    console.error('[db] No se pudo persistir el resultado:', (err as Error).message);
  }
}
