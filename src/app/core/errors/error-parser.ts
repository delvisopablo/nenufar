import { HttpErrorResponse } from '@angular/common/http';
import {
  ApiErrorPayload,
  ApiErrorResponse,
  AppErrorKind,
  AppErrorModel,
  HttpErrorContext,
  UnknownErrorContext,
} from './api-error.types';

const DEFAULT_MESSAGES: Record<AppErrorKind, string> = {
  validation: 'Hay campos pendientes o inválidos para completar esta acción.',
  auth: 'La sesión caducó. Inicia sesión para continuar con esta acción.',
  permission: 'Esta acción necesita permisos adicionales.',
  'not-found': 'El contenido que intentas abrir ya no está disponible.',
  conflict: 'Esta acción choca con datos que cambiaron recientemente.',
  'rate-limit': 'Esta acción se intentó demasiadas veces seguidas. Espera un momento.',
  server: 'El servidor no respondió correctamente a esta acción.',
  unavailable: 'Esta acción está temporalmente fuera de servicio.',
  network: 'La conexión interrumpió esta acción. Comprueba internet y repite el intento.',
  timeout: 'Esta acción tardó demasiado en responder. Vuelve a intentarlo.',
  unknown: 'Esta acción no se completó por un fallo inesperado.',
};

const STATUS_KIND: Record<number, AppErrorKind> = {
  400: 'validation',
  401: 'auth',
  403: 'permission',
  404: 'not-found',
  409: 'conflict',
  422: 'validation',
  429: 'rate-limit',
  500: 'server',
  503: 'unavailable',
};

const STATUS_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

export function parseHttpError(
  error: HttpErrorResponse,
  context: HttpErrorContext = {},
): AppErrorModel {
  const backendError = extractApiErrorPayload(error.error);
  const kind = error.status === 0 ? 'network' : STATUS_KIND[error.status] ?? 'unknown';
  const code = backendError?.code || (error.status === 0 ? 'NETWORK_ERROR' : STATUS_CODE[error.status] ?? 'HTTP_ERROR');

  return {
    kind,
    code,
    message: backendError?.message || DEFAULT_MESSAGES[kind],
    source: 'http',
    retryable: isRetryable(kind),
    timestamp: new Date().toISOString(),
    status: error.status,
    requestId: backendError?.requestId,
    details: backendError?.details,
    url: context.url || error.url || undefined,
    method: context.method,
    originalError: error,
  };
}

export function parseTimeoutError(error: unknown, context: HttpErrorContext = {}): AppErrorModel {
  return {
    kind: 'timeout',
    code: 'REQUEST_TIMEOUT',
    message: DEFAULT_MESSAGES.timeout,
    source: 'http',
    retryable: true,
    timestamp: new Date().toISOString(),
    url: context.url,
    method: context.method,
    originalError: error,
  };
}

export function parseUnknownError(error: unknown, context: UnknownErrorContext = {}): AppErrorModel {
  if (isAppErrorModel(error)) {
    return error;
  }

  const kind = context.kind ?? 'unknown';
  const message = context.message ?? extractNativeErrorMessage(error) ?? DEFAULT_MESSAGES[kind];

  return {
    kind,
    code: context.code ?? 'UNEXPECTED_ERROR',
    message,
    source: context.source ?? 'angular',
    retryable: context.retryable ?? false,
    timestamp: new Date().toISOString(),
    originalError: error,
  };
}

export function getUserErrorMessage(error: unknown, fallbackMessage = DEFAULT_MESSAGES.unknown): string {
  if (isAppErrorModel(error)) {
    return error.message || fallbackMessage;
  }

  if (error instanceof HttpErrorResponse) {
    return parseHttpError(error).message || fallbackMessage;
  }

  return extractNativeErrorMessage(error) || fallbackMessage;
}

export function isAppErrorModel(value: unknown): value is AppErrorModel {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value['kind'] === 'string' &&
    typeof value['code'] === 'string' &&
    typeof value['message'] === 'string' &&
    typeof value['source'] === 'string' &&
    typeof value['retryable'] === 'boolean'
  );
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!isRecord(value)) {
    return false;
  }

  return value['ok'] === false && isApiErrorPayload(value['error']);
}

function extractApiErrorPayload(value: unknown): ApiErrorPayload | null {
  if (isApiErrorResponse(value)) {
    return value.error;
  }

  if (!isRecord(value)) {
    return null;
  }

  const nested = value['error'];
  if (isApiErrorPayload(nested)) {
    return nested;
  }

  const code = readString(value, 'code');
  const message = readMessage(value);
  if (!code && !message) {
    return null;
  }

  return {
    code: code || 'API_ERROR',
    message: message || DEFAULT_MESSAGES.unknown,
    requestId: readString(value, 'requestId'),
    details: readDetails(value['details']),
  };
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value['code'] === 'string' && typeof value['message'] === 'string';
}

function readMessage(value: Record<string, unknown>): string | undefined {
  const message = value['message'] ?? value['mensaje'];

  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string').join(' ');
  }

  return typeof message === 'string' ? message : undefined;
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  const raw = value[key];
  return typeof raw === 'string' && raw.trim() ? raw : undefined;
}

function readDetails(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function extractNativeErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return undefined;
}

function isRetryable(kind: AppErrorKind): boolean {
  return ['network', 'timeout', 'server', 'unavailable', 'rate-limit'].includes(kind);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
