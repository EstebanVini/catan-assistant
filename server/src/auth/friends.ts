import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { User, UserDoc } from '../db/models/User';
import { Friendship } from '../db/models/Friendship';
import { isDbConnected } from '../db/connection';
import { requireAuth } from './middleware';

export const friendsRouter = Router();

function dbGuard(res: Response): boolean {
  if (!isDbConnected()) {
    res.status(503).json({ error: 'Los amigos no están disponibles ahora. Vuelve a intentar más tarde.' });
    return false;
  }
  return true;
}

// Perfil público de un amigo: nombre, avatar y stats (nunca el passwordHash ni
// el correo).
function toFriendUser(user: UserDoc) {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    color: user.color ?? null,
    stats: user.stats,
  };
}

function userId(req: Request): string {
  return (req as Request & { userId: string }).userId;
}

// Buscar usuarios por username/nombre visible (para enviar solicitudes).
friendsRouter.get('/api/users/search', requireAuth, async (req: Request, res: Response) => {
  if (!dbGuard(res)) return;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    res.json({ users: [] });
    return;
  }
  const me = userId(req);
  // Escapar la query para usarla como literal en el regex.
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(safe, 'i');
  const users = await User.find({
    _id: { $ne: me },
    $or: [{ username: rx }, { displayName: rx }],
  })
    .limit(10)
    .lean();
  res.json({
    users: users.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl ?? null,
    })),
  });
});

// Listar amigos aceptados + solicitudes entrantes/salientes.
friendsRouter.get('/api/friends', requireAuth, async (req: Request, res: Response) => {
  if (!dbGuard(res)) return;
  const me = new mongoose.Types.ObjectId(userId(req));
  const docs = await Friendship.find({ $or: [{ requester: me }, { recipient: me }] })
    .populate('requester')
    .populate('recipient')
    .lean({ virtuals: false });

  const friends: unknown[] = [];
  const incoming: unknown[] = [];
  const outgoing: unknown[] = [];

  for (const d of docs as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    status: string;
    requester: UserDoc | null;
    recipient: UserDoc | null;
  }>) {
    if (!d.requester || !d.recipient) continue;
    const iAmRequester = d.requester._id.toString() === me.toString();
    const other = iAmRequester ? d.recipient : d.requester;
    const entry = { friendshipId: d._id.toString(), user: toFriendUser(other) };
    if (d.status === 'accepted') friends.push(entry);
    else if (iAmRequester) outgoing.push(entry);
    else incoming.push(entry);
  }

  res.json({ friends, incoming, outgoing });
});

// Enviar solicitud por username. Si ya existe una solicitud entrante del otro
// usuario, la acepta (apretón de manos).
friendsRouter.post('/api/friends/request', requireAuth, async (req: Request, res: Response) => {
  if (!dbGuard(res)) return;
  const me = userId(req);
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  if (!username) {
    res.status(400).json({ error: 'Escribe el usuario que quieres agregar.' });
    return;
  }
  const target = await User.findOne({ username });
  if (!target) {
    res.status(404).json({ error: 'No encontramos a ese usuario.' });
    return;
  }
  if (target._id.toString() === me) {
    res.status(400).json({ error: 'No puedes agregarte a ti mismo.' });
    return;
  }
  const meObj = new mongoose.Types.ObjectId(me);
  const existing = await Friendship.findOne({
    $or: [
      { requester: meObj, recipient: target._id },
      { requester: target._id, recipient: meObj },
    ],
  });
  if (existing) {
    if (existing.status === 'accepted') {
      res.status(409).json({ error: 'Ya son amigos.' });
      return;
    }
    // Pendiente: si la envió el otro, aceptarla. Si la envié yo, ya existe.
    if (existing.recipient.toString() === me) {
      existing.status = 'accepted';
      await existing.save();
      res.json({ ok: true, status: 'accepted' });
      return;
    }
    res.status(409).json({ error: 'Ya enviaste una solicitud a este usuario.' });
    return;
  }
  await Friendship.create({ requester: meObj, recipient: target._id, status: 'pending' });
  res.status(201).json({ ok: true, status: 'pending' });
});

// Aceptar una solicitud entrante.
friendsRouter.post('/api/friends/:id/accept', requireAuth, async (req: Request, res: Response) => {
  if (!dbGuard(res)) return;
  const me = userId(req);
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Solicitud inválida.' });
    return;
  }
  const fr = await Friendship.findById(req.params.id);
  if (!fr || fr.recipient.toString() !== me || fr.status !== 'pending') {
    res.status(404).json({ error: 'Esa solicitud ya no existe.' });
    return;
  }
  fr.status = 'accepted';
  await fr.save();
  res.json({ ok: true });
});

// Rechazar una solicitud entrante, cancelar una saliente o eliminar a un
// amigo: en todos los casos se borra la relación si soy parte de ella.
friendsRouter.delete('/api/friends/:id', requireAuth, async (req: Request, res: Response) => {
  if (!dbGuard(res)) return;
  const me = userId(req);
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Solicitud inválida.' });
    return;
  }
  const fr = await Friendship.findById(req.params.id);
  if (!fr || (fr.requester.toString() !== me && fr.recipient.toString() !== me)) {
    res.status(404).json({ error: 'Esa relación ya no existe.' });
    return;
  }
  await fr.deleteOne();
  res.json({ ok: true });
});

// Listado de ids de amigos aceptados (para validar invitaciones por socket).
export async function acceptedFriendIds(meId: string): Promise<Set<string>> {
  if (!isDbConnected()) return new Set();
  const me = new mongoose.Types.ObjectId(meId);
  const docs = await Friendship.find({
    status: 'accepted',
    $or: [{ requester: me }, { recipient: me }],
  }).lean();
  const ids = new Set<string>();
  for (const d of docs as unknown as Array<{ requester: mongoose.Types.ObjectId; recipient: mongoose.Types.ObjectId }>) {
    const other = d.requester.toString() === meId ? d.recipient.toString() : d.requester.toString();
    ids.add(other);
  }
  return ids;
}
