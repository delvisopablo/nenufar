export type AppErrorKind =
  | 'validation'
  | 'auth'
  | 'permission'
  | 'not-found'
  | 'conflict'
  | 'rate-limit'
  | 'server'
  | 'unavailable'
  | 'network'
  | 'timeout'
  | 'unknown';

export type AppErrorSource = 'http' | 'angular' | 'browser';

export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  ok: false;
  error: ApiErrorPayload;
}

export interface AppErrorModel {
  kind: AppErrorKind;
  code: string;
  message: string;
  source: AppErrorSource;
  retryable: boolean;
  timestamp: string;
  status?: number;
  requestId?: string;
  details?: Record<string, unknown>;
  url?: string;
  method?: string;
  originalError?: unknown;
}

export interface HttpErrorContext {
  url?: string;
  method?: string;
}

export interface UnknownErrorContext {
  source?: AppErrorSource;
  code?: string;
  message?: string;
  kind?: AppErrorKind;
  retryable?: boolean;
}

