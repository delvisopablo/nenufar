import { AuthUser, resolveOwnedBusinessId } from '../servicios/authService/auth.service';

// Acceso de cuentas de negocio deshabilitado temporalmente desde la interfaz.
// Mantener lógica y rutas para poder reactivarlo más adelante: basta con poner
// este flag a `true` para recuperar el login y el registro de nenúfares.
export const BUSINESS_ACCESS_ENABLED = false;

export const BUSINESS_ACCESS_DISABLED_MESSAGE =
  'El acceso para Nenúfares está en desarrollo. Volverá a estar disponible próximamente.';

/** Misma heurística que usa el estanque para distinguir cuentas de negocio. */
export function isBusinessAccount(usuario: AuthUser | null | undefined): boolean {
  if (!usuario) {
    return false;
  }

  const rol = String(usuario.rol ?? '').toUpperCase();
  return Boolean(resolveOwnedBusinessId(usuario)) || rol === 'NEGOCIO';
}
