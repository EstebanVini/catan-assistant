import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { storageAvailable } from '../lib/persistence';
import { useModalA11y } from '../lib/useModalA11y';
import { Avatar } from '../components/Avatar';

type Modal = null | 'create' | 'join' | 'account' | 'logoutConfirm';

export function HomeScreen(): JSX.Element {
  const session = useStore((s) => s.session);
  const reconnectFailed = useStore((s) => s.reconnectFailed);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const forgetSession = useStore((s) => s.forgetSession);
  const createGame = useStore((s) => s.createGame);
  const joinGame = useStore((s) => s.joinGame);
  const pushToast = useStore((s) => s.pushToast);
  const authUser = useStore((s) => s.authUser);
  const logout = useStore((s) => s.logout);
  const setHomeView = useStore((s) => s.setHomeView);
  const setShowLogin = useStore((s) => s.setShowLogin);
  const [modal, setModal] = useState<Modal>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [storageWarned, setStorageWarned] = useState(false);

  useEffect(() => {
    if (!storageAvailable() && !storageWarned) {
      pushToast(
        'info',
        'Tu navegador no guardará la sesión. Anota el código antes de cerrar.'
      );
      setStorageWarned(true);
    }
  }, [pushToast, storageWarned]);

  async function onReconnect() {
    setReconnecting(true);
    const minDelay = new Promise((resolve) => window.setTimeout(resolve, 250));
    const result = await useStore.getState().reconnectGame();
    await minDelay;
    setReconnecting(false);
    if (result?.error) {
      pushToast('error', result.error);
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:max-w-lg md:justify-center">
      {/* En md+ el bloque completo se centra verticalmente (md:justify-center
          arriba + md:flex-none en el espaciador de en medio). */}
      <div className="pt-12 md:pt-0">
        <div className="flex items-start justify-between gap-3">
          <h1 className="title-gold font-display text-[28px] font-bold leading-none tracking-tight">
            Asistente de Catán
          </h1>
          {authUser ? (
            <button
              type="button"
              onClick={() => setModal('account')}
              aria-label={`Cuenta de ${authUser.displayName}. Abrir menú`}
              className="inline-flex min-h-[44px] max-w-[45%] items-center gap-2 rounded-full border border-white/12 bg-surface-2 py-1 pl-1 pr-3 transition-colors active:bg-white/10"
            >
              <Avatar
                seed={authUser.username}
                name={authUser.displayName}
                avatarUrl={authUser.avatarUrl}
                size={32}
              />
              <span className="truncate text-xs font-semibold text-neutral-100">
                {authUser.displayName}
              </span>
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Lleva la cuenta de tu partida presencial.
        </p>
      </div>

      <div className="mt-6 flex-1 md:flex-none md:pb-6">
        {session ? (
          <div
            className={
              'rounded-2xl border p-4 shadow-card ' +
              (reconnectFailed
                ? 'border-red-500/40 bg-red-500/[0.06]'
                : 'border-emerald-500/35 bg-emerald-500/[0.05]')
            }
          >
            {reconnectFailed ? (
              <>
                <h2 className="text-sm font-semibold text-red-200">
                  Esta partida ya no existe
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">
                  El servidor ya no recuerda el código{' '}
                  <span className="font-mono font-semibold text-neutral-100">{session.code}</span>.
                  Empieza una nueva partida.
                </p>
                <button
                  type="button"
                  onClick={() => forgetSession()}
                  className="mt-3 min-h-[44px] w-full rounded-lg border border-white/12 bg-surface-3 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
                >
                  Olvidar esta partida
                </button>
              </>
            ) : (
              <>
                <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-300">
                  Sigue donde lo dejaste
                </h2>
                <p className="mt-1.5 text-lg font-semibold tracking-tight text-neutral-50">
                  {session.name}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  Código{' '}
                  <span className="font-mono font-semibold tracking-wider text-neutral-200">
                    {session.code}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={onReconnect}
                  disabled={reconnecting || connectionStatus !== 'connected'}
                  className="mt-3 min-h-[48px] w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-neutral-950 shadow-cta transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reconnecting ? 'Conectando…' : 'Volver a la partida'}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-2.5 pb-5">
        <button
          type="button"
          onClick={() => setModal('create')}
          className="min-h-[56px] w-full rounded-xl bg-emerald-500 px-4 py-3 text-base font-bold tracking-tight text-neutral-950 shadow-cta transition-all active:scale-[0.99] active:bg-emerald-400"
        >
          Crear partida
        </button>
        <button
          type="button"
          onClick={() => setModal('join')}
          className="min-h-[56px] w-full rounded-xl border border-white/15 bg-surface-2 px-4 py-3 text-base font-semibold text-neutral-100 transition-all active:scale-[0.99] active:bg-white/10"
        >
          Unirse a partida
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/5 py-3 text-[11px] text-neutral-400">
        <span>v0.1.0 MVP</span>
        {!authUser ? (
          <button
            type="button"
            onClick={() => setShowLogin(true)}
            className="-my-2 inline-flex min-h-[44px] items-center text-neutral-400 underline-offset-2 hover:underline"
          >
            Iniciar sesión o crear cuenta
          </button>
        ) : null}
        {session ? (
          <button
            type="button"
            onClick={() => forgetSession()}
            className="-my-2 inline-flex min-h-[44px] items-center text-neutral-400 underline-offset-2 hover:underline"
          >
            Olvidar partida guardada
          </button>
        ) : null}
      </div>

      {modal === 'create' ? (
        <CreateModal
          accountName={authUser?.displayName ?? null}
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const res = await createGame(name);
            if (res.error) pushToast('error', res.error);
            else setModal(null);
          }}
        />
      ) : null}
      {modal === 'join' ? (
        <JoinModal
          accountName={authUser?.displayName ?? null}
          onClose={() => setModal(null)}
          onSubmit={async (code, name) => {
            const res = await joinGame(code, name);
            if (res.error) pushToast('error', res.error);
            else setModal(null);
          }}
        />
      ) : null}
      {modal === 'account' && authUser ? (
        <AccountMenuModal
          onClose={() => setModal(null)}
          onProfile={() => {
            setModal(null);
            setHomeView('profile');
          }}
          onLogout={() => {
            // Cerrar sesión nunca destruye la sesión de sala (principio 17).
            // Con partida guardada, confirmación explícita.
            if (session) setModal('logoutConfirm');
            else {
              setModal(null);
              logout();
            }
          }}
        />
      ) : null}
      {modal === 'logoutConfirm' ? (
        <LogoutConfirmModal
          onCancel={() => setModal(null)}
          onConfirm={() => {
            setModal(null);
            logout();
          }}
        />
      ) : null}
    </main>
  );
}

function AccountMenuModal({
  onClose,
  onProfile,
  onLogout,
}: {
  onClose: () => void;
  onProfile: () => void;
  onLogout: () => void;
}): JSX.Element {
  return (
    <ModalShell title="Tu cuenta" onClose={onClose}>
      <div className="space-y-2">
        <button
          type="button"
          onClick={onProfile}
          className="min-h-[48px] w-full rounded-lg border border-white/12 bg-surface-2 px-3 py-2 text-left text-sm font-medium text-neutral-100 transition-colors active:bg-white/10"
        >
          Ver perfil
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="min-h-[48px] w-full rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-left text-sm font-medium text-red-200 transition-colors active:bg-red-500/[0.12]"
        >
          Cerrar sesión
        </button>
      </div>
    </ModalShell>
  );
}

function LogoutConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  return (
    <ModalShell title="Cerrar sesión" onClose={onCancel}>
      <p className="text-sm leading-relaxed text-neutral-300">
        Tu partida guardada seguirá disponible como invitado. ¿Cerrar sesión?
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-[44px] flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white"
        >
          Sí, cerrar sesión
        </button>
      </div>
    </ModalShell>
  );
}

// Bloque "Jugarás como [displayName]" con link "cambiar" que revela el input
// (prellenado, editable solo para esa partida). Un tap menos para el caso
// común del usuario logueado (brief §1).
function NameField({
  accountName,
  name,
  setName,
  customizing,
  setCustomizing,
  onEnter,
  autoFocus,
  inputRef,
}: {
  accountName: string | null;
  name: string;
  setName: (v: string) => void;
  customizing: boolean;
  setCustomizing: (v: boolean) => void;
  onEnter: () => void;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}): JSX.Element {
  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 20;
  if (accountName && !customizing) {
    return (
      <p className="rounded-lg border border-white/10 bg-surface-1 px-3 py-2.5 text-sm text-neutral-300">
        Jugarás como{' '}
        <span className="font-semibold text-neutral-50">{accountName}</span>{' '}
        <button
          type="button"
          onClick={() => {
            setName(accountName);
            setCustomizing(true);
          }}
          className="-my-3 ml-1 inline-flex min-h-[44px] items-center px-1 text-xs font-semibold text-emerald-300 underline-offset-2 active:underline"
        >
          cambiar
        </button>
      </p>
    );
  }
  return (
    <>
      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        Tu nombre
      </label>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter();
        }}
        autoFocus={autoFocus}
        maxLength={20}
        placeholder="María"
        className="mt-1.5 w-full rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400"
      />
      {!valid && name.length > 0 ? (
        <p className="mt-1.5 text-[11px] font-medium text-amber-300">
          Usa entre 1 y 20 caracteres.
        </p>
      ) : null}
      {accountName ? (
        <p className="mt-1.5 text-[11px] text-neutral-500">
          Solo para esta partida. Tu cuenta no cambia.
        </p>
      ) : null}
    </>
  );
}

function CreateModal({
  accountName,
  onClose,
  onSubmit,
}: {
  accountName: string | null;
  onClose: () => void;
  onSubmit: (name?: string) => Promise<void>;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [customizing, setCustomizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!accountName) inputRef.current?.focus();
  }, [accountName]);
  const trimmed = name.trim();
  const useAccountName = !!accountName && !customizing;
  const valid = useAccountName || (trimmed.length >= 1 && trimmed.length <= 20);
  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    // Logueado sin personalizar: el servidor usa el displayName de la cuenta.
    await onSubmit(useAccountName ? undefined : trimmed);
    setSubmitting(false);
  }
  return (
    <ModalShell title="Crear partida" onClose={onClose}>
      <NameField
        accountName={accountName}
        name={name}
        setName={setName}
        customizing={customizing}
        setCustomizing={setCustomizing}
        onEnter={() => void submit()}
        inputRef={inputRef}
      />
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!valid || submitting}
          onClick={submit}
          className="min-h-[44px] flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-neutral-950 shadow-cta transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? 'Creando…' : 'Crear partida'}
        </button>
      </div>
    </ModalShell>
  );
}

function JoinModal({
  accountName,
  onClose,
  onSubmit,
}: {
  accountName: string | null;
  onClose: () => void;
  onSubmit: (code: string, name?: string) => Promise<void>;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [customizing, setCustomizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const trimmedName = name.trim();
  const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const validCode = normalizedCode.length >= 4 && normalizedCode.length <= 8;
  const useAccountName = !!accountName && !customizing;
  const validName =
    useAccountName || (trimmedName.length >= 1 && trimmedName.length <= 20);
  const canSubmit = validCode && validName && !submitting;
  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit(normalizedCode, useAccountName ? undefined : trimmedName);
    setSubmitting(false);
  }
  return (
    <ModalShell title="Unirse a partida" onClose={onClose}>
      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        Código
      </label>
      <input
        ref={inputRef}
        value={normalizedCode}
        onChange={(e) =>
          setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
        }
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="A4K7"
        className="mt-1.5 w-full rounded-lg border border-white/12 bg-neutral-950 px-3 py-3 text-center font-mono text-2xl font-bold uppercase tracking-[0.3em] text-neutral-50 outline-none transition-colors focus:border-emerald-400"
      />
      {code.length > 0 && !validCode ? (
        <p className="mt-1.5 text-[11px] font-medium text-amber-300">
          El código tiene entre 4 y 8 letras o números.
        </p>
      ) : null}
      <div className="mt-3">
        <NameField
          accountName={accountName}
          name={name}
          setName={setName}
          customizing={customizing}
          setCustomizing={setCustomizing}
          onEnter={() => void submit()}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-surface-3 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="min-h-[44px] flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-neutral-950 shadow-cta transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? 'Entrando…' : 'Unirse a la partida'}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  // El input interno tomará el foco con su propio useEffect (mantengo eso),
  // pero el hook se encarga del trap + ESC + restauración del foco previo.
  useModalA11y(dialogRef, onClose);
  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-2xl ring-1 ring-white/5"
      >
        <h2
          id={titleId}
          className="text-base font-semibold tracking-tight text-neutral-50"
        >
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
