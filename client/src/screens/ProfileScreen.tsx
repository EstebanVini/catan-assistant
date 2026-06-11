import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { getMe, patchMe } from '../api';
import { BASE_COLORS, EXTENSION_COLORS, PlayerColor, User } from '../types';
import { Avatar } from '../components/Avatar';
import { BadgeChip } from '../components/BadgeIcon';
import { ColorChip } from '../components/ColorChip';
import {
  COLOR_NAMES,
  DISPLAY_NAME_HELP,
  SESSION_EXPIRED,
} from '../lib/spanish';
import { CheckIcon } from '../components/InitialBuildSetup';

// Pantalla Perfil (Fase 3, brief §2). Accesible SOLO desde Home (chip de
// cuenta): durante la partida el perfil es ruido y el `Player.name` de una
// sala activa no cambia retroactivamente.
//
//  - Guardado POR CAMPO vía PATCH /api/users/me (sin "Guardar todo").
//  - Avatar: generado determinístico por default; URL con preview en vivo
//    (timeout 5 s) antes de poder guardar.
//  - Stats de solo lectura con empty state si gamesPlayed = 0.

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function memberSince(createdAt: string): string | null {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function ProfileScreen(): JSX.Element {
  const authToken = useStore((s) => s.authToken);
  const authUser = useStore((s) => s.authUser);
  const session = useStore((s) => s.session);
  const setHomeView = useStore((s) => s.setHomeView);
  const updateAuthUser = useStore((s) => s.updateAuthUser);
  const clearAuthSession = useStore((s) => s.clearAuthSession);
  const pushToast = useStore((s) => s.pushToast);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!authToken) {
        setHomeView('home');
        return;
      }
      setLoadState('loading');
      const res = await getMe(authToken);
      if (cancelled) return;
      if (res.ok) {
        updateAuthUser(res.user);
        setLoadState('ready');
        return;
      }
      if (res.status === 401) {
        pushToast('error', SESSION_EXPIRED);
        clearAuthSession();
        setHomeView('home');
        return;
      }
      setLoadState('error');
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, reloadKey]);

  async function saveField(fields: {
    displayName?: string;
    avatarUrl?: string;
    color?: PlayerColor | null;
  }): Promise<'ok' | 'expired' | 'error'> {
    if (!authToken) return 'error';
    const res = await patchMe(authToken, fields);
    if (res.ok) {
      updateAuthUser(res.user);
      return 'ok';
    }
    if (res.status === 401) {
      pushToast('error', SESSION_EXPIRED);
      clearAuthSession();
      setHomeView('home');
      return 'expired';
    }
    return 'error';
  }

  return (
    <main className="mx-auto min-h-[100dvh] max-w-md px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] md:max-w-2xl">
      <header className="flex items-center justify-between pt-6">
        <button
          type="button"
          onClick={() => setHomeView('home')}
          className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-neutral-300 transition-colors active:text-neutral-100"
        >
          <span aria-hidden>←</span> Inicio
        </button>
        <h1 className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-neutral-300">
          Mi perfil
        </h1>
      </header>

      {loadState === 'loading' || !authUser ? (
        <ProfileSkeleton />
      ) : loadState === 'error' ? (
        <div className="mt-8 rounded-2xl border border-red-500/40 bg-red-500/[0.06] p-4 text-center">
          <p className="text-sm text-red-200">No pudimos cargar tu perfil.</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-3 min-h-[44px] w-full rounded-lg border border-white/12 bg-surface-3 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
          >
            Reintentar
          </button>
        </div>
      ) : (
        // md+: identidad y estadísticas lado a lado; en móvil el wrapper es
        // un <div> neutro y conservan su apilado vertical (mt-4 propio).
        <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-4">
          <IdentityCard
            user={authUser}
            hasActiveSession={session !== null}
            onSave={saveField}
          />
          <StatsCard user={authUser} />
        </div>
      )}
    </main>
  );
}

function ProfileSkeleton(): JSX.Element {
  return (
    <div className="mt-4 animate-pulse" aria-hidden>
      <div className="rounded-2xl border border-white/10 bg-surface-1 p-4">
        <div className="mx-auto h-24 w-24 rounded-full bg-white/10" />
        <div className="mx-auto mt-4 h-4 w-32 rounded bg-white/10" />
        <div className="mx-auto mt-2 h-3 w-40 rounded bg-surface-3" />
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-surface-1 p-4">
        <div className="flex justify-around">
          <div className="h-8 w-10 rounded bg-white/10" />
          <div className="h-8 w-10 rounded bg-white/10" />
          <div className="h-8 w-10 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}

function IdentityCard({
  user,
  hasActiveSession,
  onSave,
}: {
  user: User;
  hasActiveSession: boolean;
  onSave: (fields: {
    displayName?: string;
    avatarUrl?: string;
    color?: PlayerColor | null;
  }) => Promise<'ok' | 'expired' | 'error'>;
}): JSX.Element {
  const since = memberSince(user.createdAt);
  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card">
      <div className="flex flex-col items-center">
        <Avatar
          seed={user.username}
          name={user.displayName}
          avatarUrl={user.avatarUrl}
          size={96}
        />
        <AvatarUrlEditor user={user} onSave={onSave} />
      </div>

      <DisplayNameEditor
        user={user}
        hasActiveSession={hasActiveSession}
        onSave={onSave}
      />

      <p className="mt-1.5 text-center text-xs text-neutral-500">
        @{user.username}
        {since ? ` · desde ${since}` : ''}
      </p>

      <ColorPreference user={user} onSave={onSave} />
    </section>
  );
}

function AvatarUrlEditor({
  user,
  onSave,
}: {
  user: User;
  onSave: (fields: { avatarUrl?: string }) => Promise<'ok' | 'expired' | 'error'>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const [save, setSave] = useState<SaveState>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const trimmed = url.trim();

  useEffect(() => {
    if (tab !== 'url') return;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (!trimmed) {
      setPreview('idle');
      return;
    }
    setPreview('loading');
    timeoutRef.current = window.setTimeout(() => {
      setPreview((p) => (p === 'loading' ? 'fail' : p));
    }, 5000);
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [trimmed, tab]);

  function switchTab(t: 'file' | 'url') {
    setTab(t);
    setUrl('');
    setPreview('idle');
    setSave('idle');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSave('idle');
    setPreview('loading');
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const SIZE = 256;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setPreview('fail'); URL.revokeObjectURL(objectUrl); return; }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
      URL.revokeObjectURL(objectUrl);
      setUrl(canvas.toDataURL('image/jpeg', 0.85));
      setPreview('ok');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setPreview('fail');
    };
    img.src = objectUrl;
  }

  async function doSave() {
    if (preview !== 'ok' || save === 'saving') return;
    setSave('saving');
    const result = await onSave({ avatarUrl: trimmed || url });
    if (result === 'ok') {
      setSave('saved');
      window.setTimeout(() => {
        setSave('idle');
        setOpen(false);
        setUrl('');
        setPreview('idle');
      }, 1200);
    } else if (result === 'error') {
      setSave('error');
    }
  }

  function closePanel() {
    setOpen(false);
    setUrl('');
    setPreview('idle');
    setSave('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const canSave = preview === 'ok' && save !== 'saving';

  return (
    <div className="mt-2 w-full">
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-h-[44px] px-3 text-xs font-semibold text-emerald-300 underline-offset-2 active:underline"
        >
          Cambiar foto
        </button>
      </div>
      {open ? (
        <div className="anim-fade-in mt-1 rounded-lg border border-white/10 bg-surface-1 p-3">
          {/* Tabs */}
          <div className="mb-3 flex rounded-lg border border-white/10 bg-neutral-950/60 p-0.5">
            {(['file', 'url'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchTab(t)}
                className={
                  'flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ' +
                  (tab === t
                    ? 'bg-surface-3 text-neutral-100 shadow-soft'
                    : 'text-neutral-400 active:text-neutral-200')
                }
              >
                {t === 'file' ? 'Subir archivo' : 'URL'}
              </button>
            ))}
          </div>

          {tab === 'file' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleFile}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] w-full rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-300 transition-colors active:bg-white/[0.06]"
              >
                {preview === 'ok' ? 'Cambiar archivo' : 'Elegir imagen PNG / JPG'}
              </button>
              <p className="mt-1 text-[11px] text-neutral-500">
                Se recortará y guardará como 256×256 px.
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="avatar-url"
                className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400"
              >
                URL de la imagen
              </label>
              <input
                id="avatar-url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setSave('idle'); }}
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://…"
                className="mt-1.5 w-full rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-50 outline-none transition-colors focus:border-emerald-400"
              />
            </div>
          )}

          {/* Preview */}
          {(preview !== 'idle') ? (
            <div className="mt-2.5 flex items-center gap-3">
              <span
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-neutral-950"
                aria-hidden
              >
                {preview === 'fail' ? (
                  <Avatar seed={user.username} name={user.displayName} size={64} />
                ) : (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    referrerPolicy="no-referrer"
                    onLoad={() => tab === 'url' && setPreview('ok')}
                    onError={() => tab === 'url' && setPreview('fail')}
                    className="h-16 w-16 object-cover"
                  />
                )}
              </span>
              <p className="flex-1 text-[11px] leading-snug text-neutral-400">
                {preview === 'loading'
                  ? 'Procesando…'
                  : preview === 'ok'
                    ? 'Así se verá tu avatar.'
                    : tab === 'url'
                      ? 'No pudimos cargar esa imagen. Revisa la URL.'
                      : 'No pudimos procesar el archivo.'}
              </p>
            </div>
          ) : null}

          {save === 'error' ? (
            <p role="alert" className="mt-2 text-[12px] font-medium text-red-300">
              No se guardó.{' '}
              <button
                type="button"
                onClick={() => void doSave()}
                className="-my-3 inline-flex min-h-[44px] items-center px-1 font-semibold underline-offset-2 active:underline"
              >
                Reintentar
              </button>
            </p>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={closePanel}
              className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void doSave()}
              className={
                'min-h-[44px] flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all ' +
                (canSave
                  ? 'bg-emerald-500 text-neutral-950'
                  : 'cursor-not-allowed border border-white/10 bg-surface-1 text-neutral-500')
              }
            >
              {save === 'saving' ? 'Guardando…' : save === 'saved' ? 'Guardado' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DisplayNameEditor({
  user,
  hasActiveSession,
  onSave,
}: {
  user: User;
  hasActiveSession: boolean;
  onSave: (fields: { displayName?: string }) => Promise<'ok' | 'expired' | 'error'>;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(user.displayName);
  const [save, setSave] = useState<SaveState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const trimmed = value.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 20;

  async function confirm() {
    if (!valid || save === 'saving') return;
    if (trimmed === user.displayName) {
      setEditing(false);
      return;
    }
    setSave('saving');
    const result = await onSave({ displayName: trimmed });
    if (result === 'ok') {
      setSave('saved');
      window.setTimeout(() => {
        setSave('idle');
        setEditing(false);
      }, 1200);
    } else if (result === 'error') {
      setSave('error');
    }
  }

  return (
    <div className="mt-3">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        Nombre visible
      </p>
      {!editing ? (
        <button
          type="button"
          onClick={() => {
            setValue(user.displayName);
            setEditing(true);
          }}
          aria-label={`Editar nombre visible (actual: ${user.displayName})`}
          className="mx-auto mt-1 flex min-h-[44px] items-center justify-center gap-1.5 px-3 text-lg font-semibold tracking-tight text-neutral-50 transition-colors active:text-emerald-200"
        >
          {user.displayName}
          <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden className="text-neutral-400">
            <path
              d="M4 20 L8 19 L19.5 7.5 C 20.3 6.7, 20.3 5.3, 19.5 4.5 C 18.7 3.7, 17.3 3.7, 16.5 4.5 L5 16 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : (
        <div className="mt-1.5">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirm();
                if (e.key === 'Escape') setEditing(false);
              }}
              maxLength={20}
              disabled={save === 'saving'}
              className="min-w-0 flex-1 rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400 disabled:opacity-60"
            />
            <button
              type="button"
              disabled={!valid || save === 'saving'}
              onClick={() => void confirm()}
              aria-label="Guardar nombre"
              className={
                'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-colors ' +
                (valid && save !== 'saving'
                  ? 'bg-emerald-500 text-neutral-950'
                  : 'cursor-not-allowed border border-white/10 bg-surface-1 text-neutral-500')
              }
            >
              {save === 'saving' ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M5 12.5 L10 17.5 L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
          {!valid && value.length > 0 ? (
            <p className="mt-1.5 text-[11px] font-medium text-amber-300">
              Usa entre 1 y 20 caracteres.
            </p>
          ) : null}
          {save === 'error' ? (
            <p role="alert" className="mt-1.5 text-[12px] font-medium text-red-300">
              No se guardó.{' '}
              <button
                type="button"
                onClick={() => void confirm()}
                className="-my-3 inline-flex min-h-[44px] items-center px-1 font-semibold underline-offset-2 active:underline"
              >
                Reintentar
              </button>
            </p>
          ) : null}
          <p className="mt-1.5 text-[11px] text-neutral-500">
            {DISPLAY_NAME_HELP}
            {hasActiveSession ? ' El cambio aplica desde tu próxima partida.' : ''}
          </p>
        </div>
      )}
      {save === 'saved' ? (
        <p
          role="status"
          className="anim-fade-in mt-1 flex items-center justify-center gap-1 text-[11px] font-medium text-emerald-300"
        >
          <CheckIcon size={12} /> Guardado
        </p>
      ) : null}
    </div>
  );
}

function ColorPreference({
  user,
  onSave,
}: {
  user: User;
  onSave: (fields: { color?: PlayerColor | null }) => Promise<'ok' | 'expired' | 'error'>;
}): JSX.Element {
  const [save, setSave] = useState<SaveState>('idle');
  const [pending, setPending] = useState<PlayerColor | null | undefined>(
    undefined
  );

  const current = user.color ?? null;
  const allColors: PlayerColor[] = [...BASE_COLORS, ...EXTENSION_COLORS];

  async function pick(color: PlayerColor | null) {
    if (save === 'saving' || color === current) return;
    setPending(color);
    setSave('saving');
    const result = await onSave({ color });
    setPending(undefined);
    if (result === 'ok') {
      setSave('saved');
      window.setTimeout(() => setSave('idle'), 1200);
    } else if (result === 'error') {
      setSave('error');
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
          Color preferido
        </p>
        {save === 'saved' ? (
          <span
            role="status"
            className="anim-fade-in flex items-center gap-1 text-[11px] font-medium text-emerald-300"
          >
            <CheckIcon size={12} /> Guardado
          </span>
        ) : save === 'error' ? (
          <span role="alert" className="text-[11px] font-medium text-red-300">
            No se guardó.
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {allColors.map((c) => {
          const selected = current === c;
          const isExt = c === 'green' || c === 'brown';
          const isSaving = save === 'saving' && pending === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={selected}
              disabled={save === 'saving'}
              onClick={() => void pick(c)}
              className={
                'inline-flex min-h-[44px] flex-col items-start justify-center gap-0.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] ' +
                (selected
                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-50'
                  : 'border-white/12 bg-surface-2 text-neutral-100')
              }
            >
              <span className="flex items-center gap-1.5">
                <ColorChip color={c} size={16} />
                {COLOR_NAMES[c]}
                {isSaving ? (
                  <span
                    className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                    aria-hidden
                  />
                ) : null}
              </span>
              {isExt ? (
                <span className="text-[9px] text-neutral-500">
                  solo en partidas de 5–6
                </span>
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={current === null}
          disabled={save === 'saving'}
          onClick={() => void pick(null)}
          className={
            'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] ' +
            (current === null
              ? 'border-emerald-400 bg-emerald-500/15 text-emerald-50'
              : 'border-white/12 bg-surface-2 text-neutral-400')
          }
        >
          Sin preferencia
        </button>
      </div>
      <p className="mt-2 text-[11px] text-neutral-500">
        Si está libre, te lo asignamos al entrar al lobby.
      </p>
    </div>
  );
}

function StatsCard({ user }: { user: User }): JSX.Element {
  const s = user.stats;
  const winPct =
    s.gamesPlayed > 0 ? Math.round((s.wins / s.gamesPlayed) * 100) : null;
  const hasBadges = s.longestRoadBadges > 0 || s.largestArmyBadges > 0;

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-card">
      <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
        Estadísticas
      </h2>
      {s.gamesPlayed === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-xs leading-relaxed text-neutral-400">
          Aún no terminas ninguna partida con esta cuenta. Tus resultados
          aparecerán aquí.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="nums text-count text-neutral-50">{s.gamesPlayed}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-400">
                Partidas
              </p>
            </div>
            <div>
              <p className="nums text-count text-emerald-300">{s.wins}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-400">
                Victorias
              </p>
            </div>
            <div>
              <p className="nums text-count text-neutral-300">{s.losses}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-400">
                Derrotas
              </p>
            </div>
          </div>
          {winPct !== null ? (
            <p className="mt-2.5 text-center text-xs text-neutral-400">
              <span className="nums font-semibold text-neutral-100">
                {winPct}%
              </span>{' '}
              de victorias
            </p>
          ) : null}
          {hasBadges ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
              {s.longestRoadBadges > 0 ? (
                <BadgeChip
                  variant="road"
                  label={`Camino más largo ×${s.longestRoadBadges}`}
                />
              ) : null}
              {s.largestArmyBadges > 0 ? (
                <BadgeChip
                  variant="army"
                  label={`Ejército más grande ×${s.largestArmyBadges}`}
                />
              ) : null}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-neutral-400">
            Puntos de victoria acumulados:{' '}
            <span className="nums font-semibold text-neutral-100">
              {s.totalVictoryPoints}
            </span>
          </p>
        </>
      )}
    </section>
  );
}
