import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { safeVibrate } from '../lib/motion';

// Banner contextual: condicional. Solo aparece cuando algo lo amerita.
export function ContextBanner(): JSX.Element | null {
  const view = useStore((s) => s.view);
  // Memoiza el último signature del banner para detectar reapariciones y
  // disparar un pulso háptico corto si requiere acción del usuario actual.
  // Se declara antes de cualquier early-return para respetar Rules of Hooks.
  const prevSignatureRef = useRef<string | null>(null);
  if (!view) return null;
  const { state, me } = view;
  if (!me) return null;
  const active = state.players.find(
    (p) => p.id === state.turnOrder[state.currentTurnIndex]
  );
  const isMyTurn = active?.id === me.id;

  // Calculamos kind/contenido/needsAction/waiting una sola vez. `needsAction`
  // controla la vibración corta; `waiting` activa el indicador "respirando".
  let kind: 'info' | 'warning' | 'danger' | null = null;
  let content: ReactNode = null;
  let needsAction = false;
  let waiting = false;
  let signature = '';

  // Discard
  if (state.phase === 'discard') {
    const myPending = state.pendingDiscards[me.id] ?? 0;
    if (myPending > 0) {
      kind = 'danger';
      content = (
        <>Debes descartar {myPending} {myPending === 1 ? 'carta' : 'cartas'}.</>
      );
      needsAction = true;
      signature = `discard-me-${myPending}`;
    } else {
      const others = Object.entries(state.pendingDiscards)
        .filter(([id, n]) => id !== me.id && n > 0)
        .map(([id, n]) => {
          const p = state.players.find((x) => x.id === id);
          return `${p?.name ?? 'Jugador'} (${n})`;
        });
      if (others.length > 0) {
        kind = 'warning';
        content = <>Esperando que descarten: {others.join(', ')}.</>;
        waiting = true;
        signature = `discard-others-${others.join(',')}`;
      }
    }
  } else if (state.phase === 'robber') {
    if (isMyTurn) {
      if (state.pendingRobberMove) {
        kind = 'info';
        content = <>Mueve el ladrón a otra ficha.</>;
        needsAction = true;
        signature = 'robber-move';
      } else if (state.pendingRobberSteal) {
        kind = 'info';
        content = <>Elige a quién robarle 1 carta.</>;
        needsAction = true;
        signature = 'robber-steal';
      }
    } else {
      kind = 'warning';
      content = (
        <>{active?.name ?? 'El jugador activo'} está moviendo el ladrón.</>
      );
      waiting = true;
      signature = `robber-other-${active?.id ?? ''}`;
    }
  } else if (state.phase === 'roll') {
    if (me.id === state.bankManagerId) {
      kind = 'info';
      content = <>Ingresa el número que salió en el dado.</>;
      needsAction = true;
      signature = 'roll-bank';
    } else {
      kind = 'info';
      content = <>Esperando a que ingresen el dado.</>;
      waiting = true;
      signature = 'roll-wait';
    }
  } else if (state.phase === 'main' && !isMyTurn) {
    kind = 'info';
    content = <>Turno de {active?.name ?? 'otro jugador'}.</>;
    waiting = true;
    signature = `main-other-${active?.id ?? ''}`;
  } else if (state.phase === 'specialBuild') {
    const inTurn = state.players.find(
      (p) => p.id === state.specialBuildQueue[0]
    );
    if (inTurn?.id === me.id) {
      kind = 'info';
      content = (
        <>Construcción especial: es tu turno. Construye o toca "Listo, paso".</>
      );
      needsAction = true;
      signature = 'sb-me';
    } else {
      const myPos = state.specialBuildQueue.indexOf(me.id);
      kind = 'info';
      content =
        myPos > 0 ? (
          <>
            Construcción especial: turno de {inTurn?.name ?? '...'}. Te toca en{' '}
            {myPos}.
          </>
        ) : (
          <>Construcción especial: turno de {inTurn?.name ?? '...'}.</>
        );
      waiting = true;
      signature = `sb-other-${inTurn?.id ?? ''}-${myPos}`;
    }
  }

  return (
    // `key` con signature: cuando cambia el banner, BannerEffect se remonta
    // y la animación de entrada (anim-slide-down) se reinicia. El ref de
    // prevSignature se preserva en el padre y rige la vibración háptica.
    <BannerEffect
      key={signature || 'empty'}
      kind={kind}
      signature={signature}
      needsAction={needsAction}
      waiting={waiting}
      prevSignatureRef={prevSignatureRef}
    >
      {content}
    </BannerEffect>
  );
}

function BannerEffect({
  kind,
  signature,
  needsAction,
  waiting,
  prevSignatureRef,
  children,
}: {
  kind: 'info' | 'warning' | 'danger' | null;
  signature: string;
  needsAction: boolean;
  waiting: boolean;
  prevSignatureRef: React.MutableRefObject<string | null>;
  children: ReactNode;
}): JSX.Element | null {
  useEffect(() => {
    if (!kind || !signature) {
      prevSignatureRef.current = null;
      return;
    }
    if (prevSignatureRef.current !== signature) {
      // Banner nuevo (o cambió de contexto). Si requiere acción mía, pulso
      // háptico corto de 50 ms — discreto pero perceptible.
      if (needsAction) safeVibrate(50);
      prevSignatureRef.current = signature;
    }
  }, [kind, signature, needsAction, prevSignatureRef]);

  if (!kind) return null;
  return (
    <Banner kind={kind} signature={signature} waiting={waiting}>
      {children}
    </Banner>
  );
}

function Banner({
  kind,
  signature,
  waiting,
  children,
}: {
  kind: 'info' | 'warning' | 'danger';
  signature: string;
  waiting: boolean;
  children: ReactNode;
}): JSX.Element {
  const styles =
    kind === 'danger'
      ? 'bg-red-500/12 border-red-500/45 text-red-50'
      : kind === 'warning'
        ? 'bg-amber-500/10 border-amber-500/45 text-amber-50'
        : 'bg-sky-500/[0.08] border-sky-400/40 text-sky-50';
  const dot =
    kind === 'danger'
      ? 'bg-red-400'
      : kind === 'warning'
        ? 'bg-amber-400'
        : 'bg-sky-400';
  return (
    <div
      role={kind === 'danger' ? 'alert' : 'status'}
      aria-live={kind === 'danger' ? 'assertive' : 'polite'}
      // El `key` con signature fuerza el re-mount cuando cambia el banner,
      // reiniciando la animación de entrada.
      key={signature}
      className={
        'anim-slide-down mx-3 mt-2 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium leading-snug ' +
        styles
      }
    >
      <span
        className={
          'mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ' +
          dot +
          ' ' +
          // Punto "respirando" cuando estamos esperando a alguien.
          (waiting ? 'anim-breathe' : '')
        }
        aria-hidden
      />
      <span className="flex-1">{children}</span>
    </div>
  );
}
