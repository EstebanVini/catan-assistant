import { io, Socket } from 'socket.io-client';

// Instancia única del cliente. En desarrollo, Vite hace proxy de /socket.io
// hacia el backend (puerto 3001). En producción, el backend sirve el cliente
// y el handshake va al mismo origen.
export const socket: Socket = io({
  path: '/socket.io',
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  transports: ['websocket', 'polling'],
});

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
