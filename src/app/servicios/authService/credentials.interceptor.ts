import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from '../../config/api.config';

export const CredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE_URL)) {
    return next(req);
  }

  return next(
    req.clone({
      withCredentials: true,
    })
  );
};
