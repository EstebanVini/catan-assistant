import mongoose, { Schema, InferSchemaType } from 'mongoose';

const matchSchema = new Schema({
  code: { type: String, required: true },
  extension56: { type: Boolean, default: false },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  winner: {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
  },
  players: [
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User' }, // ausente si era invitado
      name: { type: String, required: true },
      color: { type: String },
      victoryPoints: { type: Number, default: 0 },
      longestRoad: { type: Boolean, default: false },
      largestArmy: { type: Boolean, default: false },
      knightsPlayed: { type: Number, default: 0 },
    },
  ],
});

export type MatchDoc = InferSchemaType<typeof matchSchema>;

export const Match = mongoose.model('Match', matchSchema);
