
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TokenInterceptor } from '../app/servicios/authService/token.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient( withInterceptors([TokenInterceptor])), provideRouter(routes), ReactiveFormsModule]
};



