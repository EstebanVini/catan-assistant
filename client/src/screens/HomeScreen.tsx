import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { storageAvailable } from '../lib/persistence';
import { useModalA11y } from '../lib/useModalA11y';

type Modal = null | 'create' | 'join';

export function HomeScreen(): JSX.Element {
  const session = useStore((s) => s.session);
  const reconnectFailed = useStore((s) => s.reconnectFailed);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const forgetSession = useStore((s) => s.forgetSession);
  const createGame = useStore((s) => s.createGame);
  const joinGame = useStore((s) => s.joinGame);
  const pushToast = useStore((s) => s.pushToast);
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
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <div className="pt-12">
        <h1 className="text-[28px] font-bold leading-none tracking-tight text-neutral-50">
          Asistente de Catán
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          Lleva la cuenta de tu partida presencial.
        </p>
      </div>

      <div className="mt-6 flex-1">
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
                  className="mt-3 min-h-[44px] w-full rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
                >
                  Olvidar y volver
                </button>
              </>
            ) : (
              <>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-300">
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
          className="min-h-[56px] w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-base font-semibold text-neutral-100 transition-all active:scale-[0.99] active:bg-white/10"
        >
          Unirse a partida
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 py-3 text-[11px] text-neutral-500">
        <span>v0.1.0 MVP</span>
        {session ? (
          <button
            type="button"
            onClick={() => forgetSession()}
            className="text-neutral-400 underline-offset-2 hover:underline"
          >
            Olvidar partida guardada
          </button>
        ) : null}
      </div>

      {modal === 'create' ? (
        <CreateModal
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
          onClose={() => setModal(null)}
          onSubmit={async (code, name) => {
            const res = await joinGame(code, name);
            if (res.error) pushToast('error', res.error);
            else setModal(null);
          }}
        />
      ) : null}
    </main>
  );
}

function CreateModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 20;
  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    await onSubmit(trimmed);
    setSubmitting(false);
  }
  return (
    <ModalShell title="Crear partida" onClose={onClose}>
      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        Tu nombre
      </label>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        maxLength={20}
        placeholder="María"
        className="mt-1.5 w-full rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400"
      />
      {!valid && name.length > 0 ? (
        <p className="mt-1.5 text-[11px] font-medium text-amber-300">
          Usa entre 1 y 20 caracteres.
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
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
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (code: string, name: string) => Promise<void>;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const trimmedName = name.trim();
  const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const validCode = normalizedCode.length >= 4 && normalizedCode.length <= 8;
  const validName = trimmedName.length >= 1 && trimmedName.length <= 20;
  const canSubmit = validCode && validName && !submitting;
  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit(normalizedCode, trimmedName);
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
      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        Tu nombre
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        maxLength={20}
        placeholder="Juan"
        className="mt-1.5 w-full rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400"
      />
      {!validName && name.length > 0 ? (
        <p className="mt-1.5 text-[11px] font-medium text-amber-300">
          Usa entre 1 y 20 caracteres.
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium transition-colors active:bg-white/10"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="min-h-[44px] flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-neutral-950 shadow-cta transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? 'Uniéndose…' : 'Unirse a la partida'}
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
