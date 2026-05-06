import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { TimeoutError, catchError, throwError, timeout } from 'rxjs';
import { ErrorObservabilityService } from './error-observability.service';
import { parseHttpError, parseTimeoutError, parseUnknownError } from './error-parser';

export const HTTP_REQUEST_TIMEOUT_MS = new HttpContextToken<number>(() => 30000);
export const SKIP_HTTP_ERROR_HANDLING = new HttpContextToken<boolean>(() => false);

function isSilentAuthMeUnauthorized(req: { method: string; urlWithParams: string }, error: unknown): boolean {
  return (
    req.method.toUpperCase() === 'GET' &&
    error instanceof HttpErrorResponse &&
    error.status === 401 &&
    /\/api\/auth\/me(?:\?|$)/.test(req.urlWithParams)
  );
}

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_HTTP_ERROR_HANDLING)) {
    return next(req);
  }

  const observability = inject(ErrorObservabilityService);
  const timeoutMs = req.context.get(HTTP_REQUEST_TIMEOUT_MS);
  const request$ = timeoutMs > 0 ? next(req).pipe(timeout({ first: timeoutMs })) : next(req);

  return request$.pipe(
    catchError((error: unknown) => {
      if (isSilentAuthMeUnauthorized(req, error)) {
        return throwError(() => error);
      }

      const appError =
        error instanceof HttpErrorResponse
          ? parseHttpError(error, { url: req.urlWithParams, method: req.method })
          : error instanceof TimeoutError
            ? parseTimeoutError(error, { url: req.urlWithParams, method: req.method })
            : parseUnknownError(error, {
                source: 'http',
                code: 'HTTP_UNEXPECTED_ERROR',
                kind: 'unknown',
              });

      observability.report(appError, {
        surface: 'http-interceptor',
        handled: true,
      });

      return throwError(() => appError);
    }),
  );
};
