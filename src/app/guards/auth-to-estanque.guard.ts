import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import {
  AuthService,
  AuthUser,
  requiresPendingEmailVerification,
} from '../servicios/authService/auth.service';
import { readPendingEmailVerification } from '../servicios/authService/email-verification.storage';

function tieneVerificacionPendienteGuardada(usuario: AuthUser): boolean {
  const pendingVerification = readPendingEmailVerification();
  const email = usuario.email?.trim().toLowerCase();

  return Boolean(email && pendingVerification?.email === email);
}

export const authToEstanqueGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService
    .hydrateSession({ forceRemote: !authService.isSessionResolved() })
    .pipe(
      map((usuario) => {
        const usuarioActual = usuario ?? authService.obtenerUsuario();

        if (!usuarioActual && !authService.isAuthenticated()) {
          return router.createUrlTree(['/estanque']);
        }

        if (
          usuarioActual?.email &&
          requiresPendingEmailVerification(usuarioActual) &&
          tieneVerificacionPendienteGuardada(usuarioActual)
        ) {
          return router.createUrlTree(['/confirmar-email']);
        }

        return true;
      }),
      catchError(() => of(router.createUrlTree(['/estanque']))),
    );
};
