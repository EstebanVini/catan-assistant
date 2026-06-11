import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, toPublicUser, UserDoc } from '../db/models/User';
import { isDbConnected } from '../db/connection';
import { jwtSecret, requireAuth } from './middleware';

const SALT_ROUNDS = 11;
const TOKEN_TTL = '30d';

export const authRouter = Router();

function signToken(user: UserDoc): string {
  return jwt.sign({ sub: user._id.toString(), username: user.username }, jwtSecret(), { expiresIn: TOKEN_TTL });
}

function dbGuard(res: Response): boolean {
  if (!isDbConnected()) {
    res.status(503).json({ error: 'La base de datos no está disponible. Puedes jugar como invitado.' });
    return false;
  }
  return true;
}

authRouter.post('/api/auth/register', async (req: Request, res: Response) => {
  if (!dbGuard(res)) return;
  const { username, password, displayName, email } = req.body ?? {};
  if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 20) {
    res.status(400).json({ error: 'El usuario debe tener entre 3 y 20 caracteres.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }
  try {
    const existing = await User.findOne({ username: username.trim().toLowerCase() });
    if (existing) {
      res.status(409).json({ error: 'Ese usuario ya existe. Elige otro nombre.' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      username: username.trim().toLowerCase(),
      email: typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : undefined,
      passwordHash,
      displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim().slice(0, 20) : username.trim().slice(0, 20),
    });
    res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'Ese usuario o correo ya existe.' });
      return;
    }
    console.error('[auth] register failed:', (err as Error).message);
    res.status(500).json({ error: 'No pudimos crear tu cuenta. Intenta de nuevo.' });
  }
});

authRouter.post('/api/auth/login', async (req: Request, res: Response) => {
  if (!dbGuard(res)) return;
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Escribe tu usuario y contraseña.' });
    return;
  }
  try {
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok || !user) {
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }
    res.json({ token: signToken(user), user: toPublicUser(user) });
  } catch (err) {
    console.error('[auth] login failed:', (err as Error).message);
    res.status(500).json({ error: 'No pudimos iniciar sesión. Intenta de nuevo.' });
  }
});

authRouter.get('/api/users/me', requireAuth, async (req: Request, res: Response) => {
  if (!dbGuard(res)) return;
  const userId = (req as Request & { userId: string }).userId;
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ error: 'Tu cuenta ya no existe.' });
    return;
  }
  res.json({ user: toPublicUser(user) });
});

authRouter.patch('/api/users/me', requireAuth, async (req: Request, res: Response) => {
  if (!dbGuard(res)) return;
  const userId = (req as Request & { userId: string }).userId;
  const { displayName, avatarUrl, color } = req.body ?? {};
  const update: Record<string, string> = {};
  if (typeof displayName === 'string' && displayName.trim()) update.displayName = displayName.trim().slice(0, 20);
  if (typeof avatarUrl === 'string') update.avatarUrl = avatarUrl.trim().slice(0, 500);
  if (typeof color === 'string') update.color = color.trim().slice(0, 20);
  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true });
  if (!user) {
    res.status(404).json({ error: 'Tu cuenta ya no existe.' });
    return;
  }
  res.json({ user: toPublicUser(user) });
});

// Gancho futuro (Fase 3): POST /api/users/me/avatar (multipart) para subida real
// de archivos a disco/volumen o bucket; el MVP usa avatarUrl.
