// Banderas de funcionalidad del cliente.
//
// Caballeros y Ciudades está EN DESARROLLO: solo estas cuentas (username en
// minúsculas) pueden activarla. Espejo de CK_ALLOWED_USERNAMES en
// server/src/socket/handlers.ts (el servidor es la verja autoritativa; esto solo
// decide cómo se ve el toggle en el lobby). Mantener ambas listas en sincronía.
export const CK_ALLOWED_USERNAMES = new Set<string>(['esteban', 'yoyo']);

// ¿Puede este usuario activar Caballeros y Ciudades? Requiere cuenta registrada
// cuyo username esté en la allowlist (los invitados no pueden).
export function canUseCitiesKnights(username?: string | null): boolean {
  return !!username && CK_ALLOWED_USERNAMES.has(username.toLowerCase());
}
