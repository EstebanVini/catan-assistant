import { FriendsData, PlayerColor, User, UserSearchResult } from './types';

// Cliente REST de autenticación y perfil. Mismo origen: en desarrollo el
// proxy de Vite manda /api al backend (puerto 3001); en producción el backend
// sirve el cliente.
//
// Convención de resultados: unión discriminada por `ok` para que las pantallas
// distingan entre éxito, error del servidor (con `status`) y falla de red
// (`status: null`). El caso 503 (Mongo caído) se trata como "cuentas no
// disponibles": el juego en vivo sigue funcionando como invitado.

export type ApiError = {
  ok: false;
  error: string;
  // HTTP status del error; null si no hubo respuesta (sin red / server caído).
  status: number | null;
};

export type ApiResult<T> = ({ ok: true } & T) | ApiError;

async function request<T>(
  path: string,
  init: RequestInit
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor.', status: null };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const error =
      body &&
      typeof body === 'object' &&
      typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : res.status === 503
          ? 'Las cuentas no están disponibles ahora.'
          : 'Algo salió mal. Intenta de nuevo.';
    return { ok: false, error, status: res.status };
  }
  return { ok: true, ...(body as T) };
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export interface AuthSuccess {
  token: string;
  user: User;
}

export function register(payload: {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
}): Promise<ApiResult<AuthSuccess>> {
  return request<AuthSuccess>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: {
  username: string;
  password: string;
}): Promise<ApiResult<AuthSuccess>> {
  return request<AuthSuccess>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMe(token: string): Promise<ApiResult<{ user: User }>> {
  return request<{ user: User }>('/api/users/me', {
    method: 'GET',
    headers: authHeaders(token),
  });
}

export function patchMe(
  token: string,
  fields: {
    displayName?: string;
    avatarUrl?: string;
    color?: PlayerColor | null;
  }
): Promise<ApiResult<{ user: User }>> {
  return request<{ user: User }>('/api/users/me', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(fields),
  });
}

// === Amigos (Fase 4) ===

export function searchUsers(
  token: string,
  q: string
): Promise<ApiResult<{ users: UserSearchResult[] }>> {
  return request<{ users: UserSearchResult[] }>(
    `/api/users/search?q=${encodeURIComponent(q)}`,
    { method: 'GET', headers: authHeaders(token) }
  );
}

export function getFriends(token: string): Promise<ApiResult<FriendsData>> {
  return request<FriendsData>('/api/friends', {
    method: 'GET',
    headers: authHeaders(token),
  });
}

export function requestFriend(
  token: string,
  username: string
): Promise<ApiResult<{ ok: true; status: 'pending' | 'accepted' }>> {
  return request<{ ok: true; status: 'pending' | 'accepted' }>(
    '/api/friends/request',
    { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ username }) }
  );
}

export function acceptFriend(
  token: string,
  friendshipId: string
): Promise<ApiResult<{ ok: true }>> {
  return request<{ ok: true }>(`/api/friends/${friendshipId}/accept`, {
    method: 'POST',
    headers: authHeaders(token),
  });
}

// Rechaza una solicitud, cancela una saliente o elimina a un amigo.
export function removeFriend(
  token: string,
  friendshipId: string
): Promise<ApiResult<{ ok: true }>> {
  return request<{ ok: true }>(`/api/friends/${friendshipId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}
