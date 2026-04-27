const LOCAL_API_BASE_URL = 'http://localhost:3000/api';

// TODO: Sustituye esta URL por la URL PUBLICA real de Railway.
// No uses dominios internos tipo `railway.internal` en el frontend.
const PROD_API_BASE_URL =
'https://nenufar-backend-v2-copy-production.up.railway.app/api';

const hostname =
  typeof window !== 'undefined' ? window.location.hostname : 'localhost';

export const API_BASE_URL =
  hostname === 'localhost' || hostname === '127.0.0.1'
    ? LOCAL_API_BASE_URL
    : PROD_API_BASE_URL;

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
