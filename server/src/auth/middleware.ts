import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  username: string;
}

export function jwtSecret(): string {
  return process.env.JWT_SECRET ?? 'dev-only-insecure-secret';
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, jwtSecret());
    if (typeof payload === 'object' && payload !== null && typeof payload.sub === 'string') {
      return { sub: payload.sub, username: String((payload as Record<string, unknown>).username ?? '') };
    }
    return null;
  } catch {
    return null;
  }
}

// REST: exige Authorization: Bearer <token>; adjunta req.userId.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Inicia sesión para continuar.' });
    return;
  }
  (req as Request & { userId: string }).userId = payload.sub;
  next();
}

// Socket.IO: si hay token válido en el handshake adjunta socket.data.userId;
// sin token (o inválido) el socket sigue permitido como invitado.
export function socketAuthGuard(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token as string | undefined;
  if (token) {
    const payload = verifyToken(token);
    if (payload) socket.data.userId = payload.sub;
  }
  next();
}
