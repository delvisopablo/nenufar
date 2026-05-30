import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../servicios/authService/auth.service';

export const authToEstanqueGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService
    .hydrateSession({ forceRemote: !authService.isSessionResolved() })
    .pipe(
      map((usuario) =>
        usuario || authService.isAuthenticated()
          ? true
          : router.createUrlTree(['/estanque']),
      ),
      catchError(() => of(router.createUrlTree(['/estanque']))),
    );
};
