import mongoose, { Schema, InferSchemaType } from 'mongoose';

// Relación de amistad entre dos usuarios. Una sola fila por par (sin importar
// quién la inició); `status` distingue solicitud pendiente de amistad
// aceptada. `requester` es quien envió la solicitud.
const friendshipSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted'],
      default: 'pending',
      required: true,
    },
  },
  { timestamps: true }
);

// Un par no puede tener dos solicitudes en la misma dirección.
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export type FriendshipDoc = InferSchemaType<typeof friendshipSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Friendship = mongoose.model('Friendship', friendshipSchema);
