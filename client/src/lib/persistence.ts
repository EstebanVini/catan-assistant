import { PersistedSession } from '../types';

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
