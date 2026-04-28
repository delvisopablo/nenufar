
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { CredentialsInterceptor } from '../app/servicios/authService/credentials.interceptor';
import { provideAppErrorHandling } from './core/errors/error.providers';
import { httpErrorInterceptor } from './core/errors/http-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([CredentialsInterceptor, httpErrorInterceptor])),
    provideRouter(routes),
    ReactiveFormsModule,
    provideAppErrorHandling(),
  ]
};

