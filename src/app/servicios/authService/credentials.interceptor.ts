import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from '../../config/api.config';
import { readAccessToken } from './auth.storage';

export const CredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE_URL)) {
    return next(req);
  }

  const accessToken = readAccessToken();
  const authenticatedRequest = accessToken
    ? req.clone({
        withCredentials: true,
        setHeaders: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    : req.clone({
        withCredentials: true,
      });

  return next(authenticatedRequest);
};
