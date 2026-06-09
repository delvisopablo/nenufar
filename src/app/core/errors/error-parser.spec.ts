import { HttpErrorResponse } from '@angular/common/http';
import {
  getUserErrorMessage,
  isApiErrorResponse,
  isAppErrorModel,
  parseHttpError,
  parseTimeoutError,
  parseUnknownError,
} from './error-parser';

describe('error-parser', () => {
  it('detecta la forma estandar de error del backend', () => {
    const response = {
      ok: false,
      error: {
        code: 'USER_EXISTS',
        message: 'El usuario ya existe',
        requestId: 'req-123',
        details: { field: 'email' },
      },
    };

    expect(isApiErrorResponse(response)).toBeTrue();
  });

  it('normaliza un 401 con codigo y requestId del backend', () => {
    const error = new HttpErrorResponse({
      status: 401,
      statusText: 'Unauthorized',
      url: '/auth/login',
      error: {
        ok: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales incorrectas',
          requestId: 'req-auth',
        },
      },
    });

    const appError = parseHttpError(error, { method: 'POST' });

    expect(appError.kind).toBe('auth');
    expect(appError.code).toBe('INVALID_CREDENTIALS');
    expect(appError.message).toBe('Credenciales incorrectas');
    expect(appError.requestId).toBe('req-auth');
    expect(appError.method).toBe('POST');
  });

  it('asigna mensajes por status cuando el backend no envia cuerpo estructurado', () => {
    const appError = parseHttpError(
      new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: '/negocios/404' }),
    );

    expect(appError.kind).toBe('not-found');
    expect(appError.code).toBe('NOT_FOUND');
    expect(appError.message).toContain('ya no está disponible');
  });

  it('normaliza errores de red con status 0', () => {
    const appError = parseHttpError(new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }));

    expect(appError.kind).toBe('network');
    expect(appError.code).toBe('NETWORK_ERROR');
    expect(appError.retryable).toBeTrue();
  });

  it('normaliza timeouts como reintentables', () => {
    const appError = parseTimeoutError(new Error('timeout'), { url: '/slow', method: 'GET' });

    expect(appError.kind).toBe('timeout');
    expect(appError.code).toBe('REQUEST_TIMEOUT');
    expect(appError.retryable).toBeTrue();
  });

  it('expone mensajes seguros para UI desde AppErrorModel y Error nativo', () => {
    const appError = parseUnknownError(new Error('Boom'), { source: 'browser' });

    expect(isAppErrorModel(appError)).toBeTrue();
    expect(getUserErrorMessage(appError)).toBe('Boom');
    expect(getUserErrorMessage(new Error('Fallo visible'))).toBe('Fallo visible');
  });
});
