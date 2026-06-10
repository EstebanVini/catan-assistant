// Helpers de motion compartidos.
//
// `safeVibrate` envuelve `navigator.vibrate` con guardas:
//  - existencia de la API (no todos los navegadores la implementan).
//  - try/catch porque algunos navegadores la lanzan en contextos no usuario.
//  - respeto de `prefers-reduced-motion`: usuarios con esa preferencia activa
//    no reciben vibración (la háptica es parte del sistema de motion).
export function safeVibrate(ms: number | number[]): void {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined')
      return;
    if (!('vibrate' in navigator)) return;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    navigator.vibrate(ms);
  } catch {
    // Silenciado: vibrate es non-critical.
  }
}

// Detector de reduce-motion para casos donde necesitamos decidir en JS
// (p.ej. para evitar montar overlays animados pesados). El media query se
// evalúa en cada llamada porque el usuario puede cambiarla en runtime.
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
