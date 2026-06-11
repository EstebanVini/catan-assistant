import { PersistedSession, User } from '../types';

const KEY = 'catan-assistant.session';

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const s = window.localStorage;
    // Detectar localStorage bloqueado (incógnito en algunos navegadores).
    const probe = '__catan_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function getSession(): PersistedSession | null {
  const s = safeStorage();
  if (!s) return null;
  const raw = s.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (
      typeof parsed.code === 'string' &&
      typeof parsed.playerId === 'string' &&
      typeof parsed.sessionToken === 'string' &&
      typeof parsed.name === 'string'
    ) {
      return parsed as PersistedSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function setSession(session: PersistedSession): void {
  const s = safeStorage();
  if (!s) return;
  s.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  const s = safeStorage();
  if (!s) return;
  s.removeItem(KEY);
}

export function storageAvailable(): boolean {
  return safeStorage() !== null;
}

// ---------------------------------------------------------------------------
// Fase 3 — Sesión de cuenta (JWT). Independiente de la sesión de sala:
// cerrar sesión nunca toca la clave de sala y viceversa (brief, principio 17).
// ---------------------------------------------------------------------------

const AUTH_TOKEN_KEY = 'auth.token';
const AUTH_USER_KEY = 'auth.user';
const GUEST_MODE_KEY = 'guestMode';

export function getAuthToken(): string | null {
  const s = safeStorage();
  if (!s) return null;
  return s.getItem(AUTH_TOKEN_KEY);
}

export function setAuth(token: string, user: User): void {
  const s = safeStorage();
  if (!s) return;
  s.setItem(AUTH_TOKEN_KEY, token);
  s.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function setCachedUser(user: User): void {
  const s = safeStorage();
  if (!s) return;
  s.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function getCachedUser(): User | null {
  const s = safeStorage();
  if (!s) return null;
  const raw = s.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<User>;
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.username === 'string' &&
      typeof parsed.displayName === 'string'
    ) {
      return parsed as User;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  const s = safeStorage();
  if (!s) return;
  s.removeItem(AUTH_TOKEN_KEY);
  s.removeItem(AUTH_USER_KEY);
}

export function getGuestMode(): boolean {
  const s = safeStorage();
  if (!s) return false;
  return s.getItem(GUEST_MODE_KEY) === '1';
}

export function setGuestMode(enabled: boolean): void {
  const s = safeStorage();
  if (!s) return;
  if (enabled) s.setItem(GUEST_MODE_KEY, '1');
  else s.removeItem(GUEST_MODE_KEY);
}

// ---------------------------------------------------------------------------
// Fase 3 — Preferencia de colapsables por dispositivo (`ui.collapse.<id>`).
// `true` = colapsado. Devuelve null si no hay preferencia guardada.
// ---------------------------------------------------------------------------

export function getCollapsePref(sectionId: string): boolean | null {
  const s = safeStorage();
  if (!s) return null;
  const raw = s.getItem(`ui.collapse.${sectionId}`);
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

export function setCollapsePref(sectionId: string, collapsed: boolean): void {
  const s = safeStorage();
  if (!s) return;
  s.setItem(`ui.collapse.${sectionId}`, collapsed ? '1' : '0');
}
