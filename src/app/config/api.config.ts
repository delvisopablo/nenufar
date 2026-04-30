import { environment } from '../../environments/environment';

function normalizeBaseUrl(baseUrl: string | null | undefined): string {
  const normalized = String(baseUrl ?? 'http://localhost:3000/api').replace(
    /\/+$/,
    '',
  );

  if (normalized.endsWith('/api')) {
    return normalized;
  }

  return `${normalized}/api`;
}

export const API_BASE_URL = normalizeBaseUrl(environment.api);

export type ApiListResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function extractItems<T>(
  response: T[] | ApiListResponse<T> | null | undefined,
): T[] {
  if (Array.isArray(response)) {
    return response;
  }

  return response?.items ?? [];
}
