export const PENDING_VERIFICATION_EMAIL_KEY = 'pendingVerificationEmail';
export const PENDING_VERIFICATION_MASKED_EMAIL_KEY = 'pendingVerificationMaskedEmail';
export const PENDING_VERIFICATION_EXPIRES_KEY = 'pendingVerificationExpiresInMinutes';

export interface PendingEmailVerificationState {
  email: string;
  maskedEmail: string;
  expiresInMinutes: number | null;
}

function hasSessionStorage(): boolean {
  return typeof sessionStorage !== 'undefined';
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeMaskedEmail(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function normalizeExpiresInMinutes(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

export function savePendingEmailVerification(
  state: PendingEmailVerificationState,
): void {
  if (!hasSessionStorage()) {
    return;
  }

  const email = normalizeEmail(state.email);

  if (!email) {
    clearPendingEmailVerification();
    return;
  }

  sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, email);
  sessionStorage.setItem(
    PENDING_VERIFICATION_MASKED_EMAIL_KEY,
    normalizeMaskedEmail(state.maskedEmail, email),
  );

  const expiresInMinutes = normalizeExpiresInMinutes(state.expiresInMinutes);
  if (expiresInMinutes) {
    sessionStorage.setItem(
      PENDING_VERIFICATION_EXPIRES_KEY,
      String(expiresInMinutes),
    );
    return;
  }

  sessionStorage.removeItem(PENDING_VERIFICATION_EXPIRES_KEY);
}

export function readPendingEmailVerification(): PendingEmailVerificationState | null {
  if (!hasSessionStorage()) {
    return null;
  }

  const email = normalizeEmail(sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY));

  if (!email) {
    return null;
  }

  return {
    email,
    maskedEmail: normalizeMaskedEmail(
      sessionStorage.getItem(PENDING_VERIFICATION_MASKED_EMAIL_KEY),
      email,
    ),
    expiresInMinutes: normalizeExpiresInMinutes(
      sessionStorage.getItem(PENDING_VERIFICATION_EXPIRES_KEY),
    ),
  };
}

export function clearPendingEmailVerification(): void {
  if (!hasSessionStorage()) {
    return;
  }

  sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
  sessionStorage.removeItem(PENDING_VERIFICATION_MASKED_EMAIL_KEY);
  sessionStorage.removeItem(PENDING_VERIFICATION_EXPIRES_KEY);
}
