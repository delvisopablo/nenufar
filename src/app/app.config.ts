import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { CredentialsInterceptor } from '../app/servicios/authService/credentials.interceptor';
import { provideAppErrorHandling } from './core/errors/error.providers';
import { httpErrorInterceptor } from './core/errors/http-error.interceptor';
import { AuthService } from './servicios/authService/auth.service';
import { catchError, firstValueFrom, map, of } from 'rxjs';

function initializeAuthSession(authService: AuthService) {
  return () =>
    firstValueFrom(
      authService.hydrateSession({ forceRemote: true }).pipe(
        map(() => void 0),
        catchError(() => of(void 0)),
      ),
    );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([CredentialsInterceptor, httpErrorInterceptor])),
    provideRouter(routes),
    ReactiveFormsModule,
    provideAppErrorHandling(),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: initializeAuthSession,
      deps: [AuthService],
    },
  ]
};
