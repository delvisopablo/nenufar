import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../servicios/authService/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.esAdmin()) {
    return true;
  }

  if (!authService.hasSessionHint()) {
    return router.createUrlTree(['/estanque']);
  }

  return authService.me().pipe(
    map((usuario) =>
      usuario?.rolGlobal === 'ADMIN'
        ? true
        : (router.createUrlTree(['/mi-perfil']) as UrlTree),
    ),
    catchError(() => of(router.createUrlTree(['/mi-perfil']))),
  );
};
