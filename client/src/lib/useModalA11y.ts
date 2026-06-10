import { useEffect, useRef } from 'react';

// Hook compartido para accesibilidad de modales:
//  - Cierra el modal al presionar ESC.
//  - Implementa un focus trap básico (Tab / Shift+Tab ciclan entre los
//    elementos enfocables dentro del contenedor).
//  - Mueve el foco al primer elemento enfocable al montar.
//  - Restaura el foco al elemento previo cuando el modal se cierra.
//
// Cumple WCAG 2.1 SC 2.1.1 (Keyboard) y SC 2.4.3 (Focus Order).
// `aria-modal` y `role="dialog"` se aplican en el markup del componente.
export function useModalA11y(
  ref: React.RefObject<HTMLElement>,
  onClose: () => void
): void {
  // Guarda el elemento que tenía foco al abrir para restaurarlo al cerrar.
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Mantener `onClose` "fresco" en un ref para no perder la versión más
  // reciente cuando el padre re-renderiza (las arrow functions de cierre
  // suelen recrearse en cada render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    const node = ref.current;
    if (!node) return;

    // Enfocar el primer elemento focusable del modal (o el modal mismo si es
    // focusable). Esto da un punto de partida para el teclado y los lectores
    // de pantalla.
    const focusables = getFocusable(node);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else if (node.tabIndex >= 0) {
      node.focus();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      // Recalcular en cada Tab por si el contenido cambió.
      const list = node ? getFocusable(node) : [];
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !node!.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      // Restaurar foco al elemento anterior si sigue en el DOM.
      const prev = previouslyFocused.current;
      if (prev && document.contains(prev)) {
        prev.focus();
      }
    };
    // ref.current y onCloseRef se manejan vía refs: setup único por montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root: HTMLElement): HTMLElement[] {
  const all = Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  return all.filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}
