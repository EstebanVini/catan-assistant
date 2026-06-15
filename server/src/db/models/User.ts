import mongoose, { Schema, InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 20 },
    avatarUrl: { type: String, trim: true },
    color: { type: String, trim: true },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      longestRoadBadges: { type: Number, default: 0 },
      largestArmyBadges: { type: Number, default: 0 },
      totalVictoryPoints: { type: Number, default: 0 },
      // Racha de victorias: partidas ganadas seguidas (se reinicia al perder)
      // y la racha más larga histórica.
      currentWinStreak: { type: Number, default: 0 },
      longestWinStreak: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

// Perfil seguro para el cliente: nunca incluye passwordHash.
export function toPublicUser(user: UserDoc) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email ?? null,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    color: user.color ?? null,
    stats: user.stats,
    createdAt: user.createdAt,
  };
}

export const User = mongoose.model('User', userSchema);
