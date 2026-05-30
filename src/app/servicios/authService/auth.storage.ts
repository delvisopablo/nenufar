export const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';

const LEGACY_ACCESS_TOKEN_STORAGE_KEYS = ['access_token', 'token'] as const;

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function removeLegacyAccessTokenKeys(): void {
  if (!hasStorage()) {
    return;
  }

  for (const key of LEGACY_ACCESS_TOKEN_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

export function writeAccessToken(token: string | null | undefined): void {
  clearAccessToken();
}

export function readAccessToken(): string | null {
  if (!hasStorage()) {
    return null;
  }

  clearAccessToken();
  return null;
}

export function hasAccessToken(): boolean {
  return Boolean(readAccessToken());
}

export function clearAccessToken(): void {
  if (!hasStorage()) {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  removeLegacyAccessTokenKeys();
}
