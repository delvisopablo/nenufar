import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from '../../config/api.config';
import { clearAccessToken } from './auth.storage';

export const CredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE_URL)) {
    return next(req);
  }

  clearAccessToken();
  const authenticatedRequest = req.clone({ withCredentials: true });

  return next(authenticatedRequest);
};
