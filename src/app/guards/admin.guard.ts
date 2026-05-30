import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../servicios/authService/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService
    .hydrateSession({ forceRemote: !authService.isSessionResolved() })
    .pipe(
      map((usuario) => {
        if (!usuario && !authService.isAuthenticated()) {
          return router.createUrlTree(['/estanque']);
        }

        return authService.esAdmin(usuario ?? authService.obtenerUsuario())
          ? true
          : (router.createUrlTree(['/mi-perfil']) as UrlTree);
      }),
      catchError(() => of(router.createUrlTree(['/estanque']))),
    );
};
