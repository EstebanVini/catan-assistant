import { useRef, useState } from 'react';
import { useStore } from '../store';
import { login as apiLogin, register as apiRegister } from '../api';
import { User } from '../types';
import { DISPLAY_NAME_HELP } from '../lib/spanish';

// Pantalla Login/Registro (Fase 3, brief §1).
//
// Decisiones del brief:
//  - "Jugar como invitado" es el CTA PRIMARIO (la mesa quiere jugar ya).
//  - Login inline (sin navegación extra); registro como segunda vista de la
//    misma pantalla (no modal: el teclado en 360px deja poco espacio).
//  - Error de credenciales genérico a propósito (no revelar existencia).
//  - Sin confirmación de contraseña: toggle de visibilidad en su lugar.
//  - 503 (Mongo caído): banner "las cuentas no están disponibles"; el juego
//    en vivo sigue funcionando como invitado.
type View = 'login' | 'register';

export function LoginScreen(): JSX.Element {
  const enterGuestMode = useStore((s) => s.enterGuestMode);
  const setAuth = useStore((s) => s.setAuth);
  const setShowLogin = useStore((s) => s.setShowLogin);
  const showLogin = useStore((s) => s.showLogin);
  const session = useStore((s) => s.session);
  const guestMode = useStore((s) => s.guestMode);
  const pushToast = useStore((s) => s.pushToast);

  const [view, setView] = useState<View>('login');
  const [prefillUsername, setPrefillUsername] = useState('');
  // Remonta LoginForm SOLO cuando registro empuja un prefill ("ya existe →
  // inicia sesión"); en los demás cambios de vista cada formulario conserva
  // su estado (ambos viven montados para poder animar el slide de salida).
  const [loginFormKey, setLoginFormKey] = useState(0);
  const [authUnavailable, setAuthUnavailable] = useState(false);

  // Si el Login se abrió explícitamente desde Home (invitado que quiere
  // cuenta), se puede regresar sin elegir nada.
  const canGoBack = showLogin && (session !== null || guestMode);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:max-w-lg md:justify-center md:py-10">
      {/* md+: card más ancha y centrado vertical. El contenedor del slide
          login ↔ registro pierde su flex-1 (md:flex-none) para que el bloque
          completo quede centrado; el posicionamiento absolute del panel
          inactivo (.view-pane-out) no depende de esa altura extra. */}
      <div className="pt-10 md:pt-0">
        {canGoBack ? (
          <button
            type="button"
            onClick={() => setShowLogin(false)}
            className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-neutral-300 transition-colors active:text-neutral-100"
          >
            <span aria-hidden>←</span> Volver
          </button>
        ) : null}
        <h1 className="title-gold font-display text-[26px] font-bold leading-none tracking-tight">
          Asistente de Catán
        </h1>
        {/* Texto sobre el océano: mínimo neutral-300 (AA; ver
            docs/contrast-verification.md). */}
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Lleva la cuenta de tu partida presencial.
        </p>
      </div>

      {authUnavailable ? (
        <div
          role="status"
          className="anim-fade-in mt-4 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2.5 text-xs leading-snug text-amber-100"
        >
          Las cuentas no están disponibles ahora. Puedes jugar como invitado.
        </div>
      ) : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={() => enterGuestMode()}
          className="min-h-[56px] w-full rounded-xl bg-emerald-500 px-4 py-3 text-base font-bold tracking-tight text-neutral-950 shadow-cta transition-all active:scale-[0.99] active:bg-emerald-400"
        >
          Jugar como invitado
        </button>
        <p className="mt-1.5 text-center text-[11px] text-neutral-300">
          Sin cuenta. No guarda tus estadísticas.
        </p>
      </div>

      <div className="mt-6 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] uppercase tracking-[0.1em] text-neutral-300">
          o con tu cuenta
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {/* Slide horizontal 200 ms login ↔ registro: login vive "a la
          izquierda" y registro "a la derecha", así el saliente siempre se va
          hacia su lado y el entrante llega desde ahí (ver .view-pane en
          index.css). `overflow-x-clip` evita scroll horizontal durante el
          desplazamiento sin crear un scroll container. */}
      <div className="relative mt-5 flex-1 overflow-x-clip pb-8 md:flex-none md:pb-0">
        <div
          className={paneClass(view === 'login', 'left')}
          aria-hidden={view !== 'login'}
        >
          <LoginForm
            key={loginFormKey}
            prefillUsername={prefillUsername}
            onSuccess={(token, user) => setAuth(token, user)}
            onUnavailable={() => setAuthUnavailable(true)}
            onGoRegister={() => setView('register')}
          />
        </div>
        <div
          className={paneClass(view === 'register', 'right')}
          aria-hidden={view !== 'register'}
        >
          <RegisterForm
            hasActiveSession={session !== null}
            onSuccess={(token, user) => {
              setAuth(token, user);
              pushToast('success', 'Cuenta creada. ¡A jugar!');
            }}
            onUnavailable={() => setAuthUnavailable(true)}
            onGoLogin={(username) => {
              setPrefillUsername(username);
              setLoginFormKey((k) => k + 1);
              setView('login');
            }}
          />
        </div>
      </div>
    </main>
  );
}

// Clases del panel del slide login ↔ registro. El activo fluye normal; el
// inactivo queda absoluto (no afecta la altura), corrido 32px hacia su lado,
// transparente y visibility:hidden (no focusable; el delay de visibility
// vive en .view-pane-out, index.css).
function paneClass(active: boolean, side: 'left' | 'right'): string {
  if (active) return 'view-pane translate-x-0 opacity-100';
  return (
    'view-pane view-pane-out pointer-events-none absolute inset-x-0 top-0 opacity-0 ' +
    (side === 'left' ? '-translate-x-8' : 'translate-x-8')
  );
}

function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, '');
}

function usernameValid(u: string): boolean {
  return u.length >= 3 && u.length <= 20;
}

function LoginForm({
  prefillUsername,
  onSuccess,
  onUnavailable,
  onGoRegister,
}: {
  prefillUsername: string;
  onSuccess: (token: string, user: User) => void;
  onUnavailable: () => void;
  onGoRegister: () => void;
}): JSX.Element {
  const [username, setUsername] = useState(prefillUsername);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    usernameValid(username) && password.length > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const res = await apiLogin({ username, password });
    setSubmitting(false);
    if (res.ok) {
      onSuccess(res.token, res.user);
      return;
    }
    if (res.status === 503) {
      onUnavailable();
      setError(null);
      return;
    }
    if (res.status === null) {
      setError('Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.');
      return;
    }
    // Genérico a propósito: no revelar si el usuario existe. La contraseña se
    // limpia; el usuario se conserva (brief §1, estados).
    setError('Usuario o contraseña incorrectos.');
    setPassword('');
    setShake((k) => k + 1);
    passwordRef.current?.focus();
  }

  return (
    <form
      key={shake}
      className={'anim-fade-in' + (shake > 0 ? ' anim-shake' : '')}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label
        htmlFor="login-username"
        className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-300"
      >
        Usuario
      </label>
      <input
        id="login-username"
        value={username}
        onChange={(e) => setUsername(normalizeUsername(e.target.value))}
        autoComplete="username"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={submitting}
        maxLength={20}
        className="mt-1.5 w-full rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400 disabled:opacity-60"
      />

      <label
        htmlFor="login-password"
        className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-300"
      >
        Contraseña
      </label>
      <div className="relative mt-1.5">
        <input
          id="login-password"
          ref={passwordRef}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={submitting}
          className="w-full rounded-lg border border-white/12 bg-neutral-950 py-2.5 pl-3 pr-12 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400 disabled:opacity-60"
        />
        <PasswordToggle
          shown={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-2 text-[12px] font-medium text-red-300"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className={
          'mt-4 min-h-[52px] w-full rounded-xl px-3 py-2.5 text-sm font-bold tracking-tight transition-all active:scale-[0.99] ' +
          (canSubmit
            ? 'border border-white/15 bg-surface-3 text-neutral-50 active:bg-white/[0.12]'
            : 'cursor-not-allowed border border-white/10 bg-surface-1 text-neutral-500')
        }
      >
        {submitting ? 'Entrando…' : 'Iniciar sesión'}
      </button>

      <p className="mt-4 text-center text-xs text-neutral-300">
        ¿No tienes cuenta?{' '}
        <button
          type="button"
          onClick={onGoRegister}
          className="-my-3 inline-flex min-h-[44px] items-center px-1 font-semibold text-emerald-300 underline-offset-2 active:underline"
        >
          Crear cuenta →
        </button>
      </p>
    </form>
  );
}

function RegisterForm({
  hasActiveSession,
  onSuccess,
  onUnavailable,
  onGoLogin,
}: {
  hasActiveSession: boolean;
  onSuccess: (token: string, user: User) => void;
  onUnavailable: () => void;
  onGoLogin: (username: string) => void;
}): JSX.Element {
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [optionalsOpen, setOptionalsOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const validUser = usernameValid(username);
  const validPassword = password.length >= 8;
  const passwordsMatch = validPassword && confirmPassword === password;
  const canSubmit = validUser && passwordsMatch && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setUsernameError(null);
    setFormError(null);
    const res = await apiRegister({
      username,
      password,
      displayName: displayName.trim() || undefined,
      email: email.trim() || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      onSuccess(res.token, res.user);
      return;
    }
    if (res.status === 503) {
      onUnavailable();
      return;
    }
    if (res.status === null) {
      setFormError('Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.');
      return;
    }
    if (res.status === 409 || /exist/i.test(res.error)) {
      setUsernameError('exists');
      return;
    }
    setFormError(res.error);
  }

  return (
    <form
      className="anim-fade-in"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label
        htmlFor="reg-username"
        className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-300"
      >
        Usuario
      </label>
      <input
        id="reg-username"
        value={username}
        onChange={(e) => {
          setUsername(normalizeUsername(e.target.value));
          setUsernameError(null);
        }}
        onBlur={() => setUsernameTouched(true)}
        autoComplete="username"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={submitting}
        maxLength={20}
        className="mt-1.5 w-full rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400 disabled:opacity-60"
      />
      {usernameError === 'exists' ? (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-amber-300">
          Ese usuario ya existe. Elige otro o{' '}
          <button
            type="button"
            onClick={() => onGoLogin(username)}
            className="-my-3 inline-flex min-h-[44px] items-center px-1 font-semibold text-emerald-300 underline-offset-2 active:underline"
          >
            inicia sesión
          </button>
          .
        </p>
      ) : usernameTouched && username.length > 0 && !validUser ? (
        <p className="mt-1.5 text-[12px] font-medium text-amber-300">
          3–20 caracteres, sin espacios.
        </p>
      ) : null}

      <label
        htmlFor="reg-password"
        className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-300"
      >
        Contraseña
      </label>
      <div className="relative mt-1.5">
        <input
          id="reg-password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          aria-describedby="reg-password-hint"
          className="w-full rounded-lg border border-white/12 bg-neutral-950 py-2.5 pl-3 pr-12 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400 disabled:opacity-60"
        />
        <PasswordToggle
          shown={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
        />
      </div>
      <p
        id="reg-password-hint"
        className={
          'mt-1.5 text-[12px] font-medium ' +
          (password.length > 0 && !validPassword
            ? 'text-amber-300'
            : 'text-neutral-300')
        }
      >
        Mínimo 8 caracteres.
      </p>

      <label
        htmlFor="reg-confirm-password"
        className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-300"
      >
        Confirmar contraseña
      </label>
      <div className="relative mt-1.5">
        <input
          id="reg-confirm-password"
          type={showConfirmPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          className="w-full rounded-lg border border-white/12 bg-neutral-950 py-2.5 pl-3 pr-12 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400 disabled:opacity-60"
        />
        <PasswordToggle
          shown={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((v) => !v)}
        />
      </div>
      {confirmPassword.length > 0 && confirmPassword !== password ? (
        <p className="mt-1.5 text-[12px] font-medium text-amber-300">
          Las contraseñas no coinciden.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOptionalsOpen((v) => !v)}
        aria-expanded={optionalsOpen}
        className="mt-3 flex min-h-[44px] w-full items-center justify-between rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors active:bg-white/[0.07]"
      >
        Opcionales
        <span aria-hidden className="text-neutral-500">
          {optionalsOpen ? '−' : '+'}
        </span>
      </button>
      {optionalsOpen ? (
        <div className="anim-fade-in mt-2 space-y-3 rounded-lg border border-white/10 bg-surface-1 p-3">
          <div>
            <label
              htmlFor="reg-displayname"
              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-300"
            >
              Nombre visible
            </label>
            <input
              id="reg-displayname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={username || 'Igual que tu usuario'}
              maxLength={20}
              disabled={submitting}
              className="mt-1.5 w-full rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400 disabled:opacity-60"
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              {DISPLAY_NAME_HELP}
            </p>
          </div>
          <div>
            <label
              htmlFor="reg-email"
              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-300"
            >
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="nombre@correo.com"
              disabled={submitting}
              className="mt-1.5 w-full rounded-lg border border-white/12 bg-neutral-950 px-3 py-2.5 text-base text-neutral-50 outline-none transition-colors focus:border-emerald-400 disabled:opacity-60"
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              Para recuperar tu cuenta en el futuro.
            </p>
          </div>
        </div>
      ) : null}

      {hasActiveSession ? (
        <p className="mt-3 rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-[11px] leading-snug text-neutral-400">
          Esta cuenta contará tus estadísticas a partir de tu próxima partida.
        </p>
      ) : null}

      {formError ? (
        <p role="alert" className="mt-3 text-[12px] font-medium text-red-300">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className={
          'mt-4 min-h-[52px] w-full rounded-xl px-3 py-2.5 text-sm font-bold tracking-tight transition-all active:scale-[0.99] ' +
          (canSubmit
            ? 'bg-emerald-500 text-neutral-950 shadow-cta active:bg-emerald-400'
            : 'cursor-not-allowed border border-white/10 bg-surface-1 text-neutral-500')
        }
      >
        {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <p className="mt-4 text-center text-xs text-neutral-300">
        <button
          type="button"
          onClick={() => onGoLogin('')}
          className="-my-3 inline-flex min-h-[44px] items-center px-1 font-semibold text-emerald-300 underline-offset-2 active:underline"
        >
          ← Ya tengo cuenta
        </button>
      </p>
    </form>
  );
}

function PasswordToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={shown}
      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-400 transition-colors active:text-neutral-100"
    >
      {shown ? (
        <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
          <path
            d="M3 12 C 6 6.5, 18 6.5, 21 12 C 18 17.5, 6 17.5, 3 12 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.6" fill="currentColor" />
          <line
            x1="5"
            y1="20"
            x2="19"
            y2="4"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
          <path
            d="M3 12 C 6 6.5, 18 6.5, 21 12 C 18 17.5, 6 17.5, 3 12 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.6" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
