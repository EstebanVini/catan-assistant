import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './lib/persistence';

// Instancia única del cliente. En desarrollo, Vite hace proxy de /socket.io
// hacia el backend (puerto 3001). En producción, el backend sirve el cliente
// y el handshake va al mismo origen.
//
// Auth (Fase 3): el JWT viaja en el handshake (`auth.token`). Se usa la forma
// función para que CADA (re)conexión lea el token vigente de localStorage —
// así un login/logout solo necesita reciclar la conexión (ver
// `refreshSocketAuth`). Sin token, el socket conecta igual como invitado.
export const socket: Socket = io({
  path: '/socket.io',
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  transports: ['websocket', 'polling'],
  auth: (cb) => {
    const token = getAuthToken();
    cb(token ? { token } : {});
  },
});

// Recicla la conexión para que el handshake lleve el token actual.
// Llamar tras login, logout o refresh del JWT.
export function refreshSocketAuth(): void {
  socket.disconnect();
  socket.connect();
}

// Tipos de respuesta esperados de los acks del servidor.
export interface CreateOrJoinResponse {
  code?: string;
  playerId?: string;
  sessionToken?: string;
  error?: string;
}

export interface AckResponse {
  ok?: boolean;
  error?: string;
}

export function emitWithAck<T>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res: T) => resolve(res));
  });
}
