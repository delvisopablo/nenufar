// ✅ token.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../../config/api.config';
import { AuthService } from './auth.service';

export const TokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE_URL)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getToken();
  const cloned = req.clone({
    withCredentials: true,
    ...(token
      ? {
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        }
      : {})
  });

  return next(cloned);
};
