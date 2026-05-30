import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from '../../config/api.config';
import { clearAccessToken } from './auth.storage';

function isBackendApiRequest(url: string): boolean {
  return url.startsWith(API_BASE_URL) || url === '/api' || url.startsWith('/api/');
}

export const CredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendApiRequest(req.url)) {
    return next(req);
  }

  clearAccessToken();
  const authenticatedRequest = req.clone({ withCredentials: true });

  return next(authenticatedRequest);
};
