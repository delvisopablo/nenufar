export const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';

const LEGACY_ACCESS_TOKEN_STORAGE_KEYS = ['access_token', 'token'] as const;

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function normalizeStoredToken(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    return null;
  }

  return normalized;
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
  if (!hasStorage()) {
    return;
  }

  const normalized = normalizeStoredToken(token);
  if (!normalized) {
    clearAccessToken();
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, normalized);
  removeLegacyAccessTokenKeys();
}

export function readAccessToken(): string | null {
  if (!hasStorage()) {
    return null;
  }

  const stableToken = normalizeStoredToken(
    localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY),
  );
  if (stableToken) {
    removeLegacyAccessTokenKeys();
    return stableToken;
  }

  for (const key of LEGACY_ACCESS_TOKEN_STORAGE_KEYS) {
    const legacyToken = normalizeStoredToken(localStorage.getItem(key));
    if (legacyToken) {
      writeAccessToken(legacyToken);
      return legacyToken;
    }

    localStorage.removeItem(key);
  }

  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
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
