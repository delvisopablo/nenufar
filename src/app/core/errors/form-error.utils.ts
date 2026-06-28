import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormGroup } from '@angular/forms';
import { AppErrorModel } from './api-error.types';
import { getUserErrorMessage, isAppErrorModel } from './error-parser';

export const DEFAULT_FORM_ERROR_MESSAGE =
  'Ha ocurrido un error. Revisa los datos e inténtalo de nuevo.';

export interface MappedApiError {
  message: string;
  fieldErrors: Record<string, string>;
}

const FIELD_ALIASES: Record<string, string> = {
  correo: 'email',
  correoElectronico: 'email',
  emailContacto: 'emailContacto',
  usuario: 'nickname',
  username: 'nickname',
  nombreUsuario: 'nickname',
  contrasena: 'password',
  contraseña: 'password',
  passwordConfirmation: 'confirmarContrasena',
  confirmarPassword: 'confirmarContrasena',
  confirmPassword: 'confirmarContrasena',
  codigo: 'code',
};

const TECHNICAL_PATTERNS = [
  /must be/i,
  /should not/i,
  /is not/i,
  /prisma/i,
  /unique constraint/i,
  /foreign key/i,
  /violates/i,
  /exception/i,
  /stack/i,
];

export function mapApiError(
  error: unknown,
  fallbackMessage = DEFAULT_FORM_ERROR_MESSAGE,
): MappedApiError {
  const payload = readErrorPayload(error);
  const rawMessage = readPayloadMessage(payload) || getUserErrorMessage(error, fallbackMessage);
  const fieldErrors = normalizeFieldErrors(readFieldErrors(payload));
  const inferredFieldError = inferFieldError(rawMessage, error);

  if (inferredFieldError) {
    fieldErrors[inferredFieldError.field] = inferredFieldError.message;
  }

  const message = sanitizeGeneralMessage(rawMessage, fallbackMessage, fieldErrors);

  return {
    message,
    fieldErrors,
  };
}

export function setFormErrors(
  form: FormGroup,
  fieldErrors: Record<string, string>,
): void {
  for (const [rawField, message] of Object.entries(fieldErrors)) {
    const field = FIELD_ALIASES[rawField] ?? rawField;
    const control = form.get(field);

    if (!control) {
      continue;
    }

    control.setErrors({
      ...(control.errors ?? {}),
      api: message,
    });
    control.markAsTouched();
  }
}

export function clearFormApiErrors(form: FormGroup): void {
  Object.values(form.controls).forEach((control) => {
    const currentErrors = control.errors;
    if (!currentErrors?.['api']) {
      return;
    }

    const { api: _api, ...rest } = currentErrors;
    control.setErrors(Object.keys(rest).length ? rest : null);
  });
}

export function getFieldError(control: AbstractControl | null | undefined): string {
  if (!control || !(control.touched || control.dirty)) {
    return '';
  }

  if (control.hasError('api')) {
    return String(control.getError('api'));
  }

  if (control.hasError('required')) {
    return 'Este campo es obligatorio.';
  }

  if (control.hasError('email')) {
    return 'El correo introducido no tiene un formato válido.';
  }

  if (control.hasError('minlength')) {
    const requiredLength = Number(control.getError('minlength')?.requiredLength ?? 0);
    return requiredLength >= 8
      ? 'La contraseña debe tener al menos 8 caracteres.'
      : `Debe tener al menos ${requiredLength} caracteres.`;
  }

  if (control.hasError('maxlength')) {
    return 'El texto es demasiado largo.';
  }

  if (control.hasError('min')) {
    const min = Number(control.getError('min')?.min ?? 0);
    return min >= 0 ? 'El valor no puede ser negativo.' : 'El valor no es válido.';
  }

  if (control.hasError('max')) {
    return 'El valor supera el máximo permitido.';
  }

  if (control.hasError('pattern')) {
    return 'El formato introducido no es válido.';
  }

  return 'Revisa este campo.';
}

export function hasFieldError(control: AbstractControl | null | undefined): boolean {
  return Boolean(control?.invalid && (control.touched || control.dirty));
}

function readErrorPayload(error: unknown): unknown {
  if (error instanceof HttpErrorResponse) {
    return error.error;
  }

  if (isAppErrorModel(error)) {
    const original = error.originalError;
    if (original instanceof HttpErrorResponse) {
      return original.error;
    }

    return {
      code: error.code,
      message: error.message,
      details: error.details,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return error;
}

function readPayloadMessage(payload: unknown): string {
  const record = asRecord(payload);
  if (!record) {
    return '';
  }

  const nested = asRecord(record['error']);
  const source = nested ?? record;
  const message = source['message'] ?? source['mensaje'];

  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string').join(' ');
  }

  return typeof message === 'string' ? message : '';
}

function readFieldErrors(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const nested = asRecord(record['error']);
  const details = asRecord(record['details']) ?? asRecord(nested?.['details']);

  return (
    record['fieldErrors'] ??
    record['fields'] ??
    record['errors'] ??
    nested?.['fieldErrors'] ??
    nested?.['fields'] ??
    nested?.['errors'] ??
    details?.['fieldErrors'] ??
    details?.['fields'] ??
    details?.['errors'] ??
    null
  );
}

function normalizeFieldErrors(value: unknown): Record<string, string> {
  if (!value) {
    return {};
  }

  if (Array.isArray(value)) {
    return value.reduce<Record<string, string>>((acc, item) => {
      const record = asRecord(item);
      const field = String(record?.['field'] ?? record?.['property'] ?? '').trim();
      const message =
        normalizeFieldMessage(record?.['message']) ||
        normalizeFieldMessage(record?.['messages']) ||
        normalizeFieldMessage(record?.['constraints']);

      if (field && message) {
        acc[FIELD_ALIASES[field] ?? field] = message;
      }

      return acc;
    }, {});
  }

  const record = asRecord(value);
  if (!record) {
    return {};
  }

  return Object.entries(record).reduce<Record<string, string>>((acc, [field, message]) => {
    const normalizedMessage = normalizeFieldMessage(message);
    if (normalizedMessage) {
      acc[FIELD_ALIASES[field] ?? field] = normalizedMessage;
    }
    return acc;
  }, {});
}

function normalizeFieldMessage(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFieldMessage(item)).find(Boolean) ?? '';
  }

  const record = asRecord(value);
  if (record) {
    const constraint = record['constraints'];
    if (constraint) {
      return normalizeFieldMessage(constraint);
    }
  }

  if (typeof value !== 'string') {
    return '';
  }

  return translateKnownMessage(value);
}

function inferFieldError(
  message: string,
  error: unknown,
): { field: string; message: string } | null {
  const status = error instanceof HttpErrorResponse
    ? error.status
    : isAppErrorModel(error)
      ? error.status
      : undefined;
  const normalized = normalize(message);

  if (
    (status === 409 || normalized.includes('uso') || normalized.includes('registr')) &&
    normalized.includes('email')
  ) {
    return { field: 'email', message: 'Este correo ya está en uso.' };
  }

  if (
    (status === 409 || normalized.includes('uso') || normalized.includes('registr')) &&
    (normalized.includes('nickname') || normalized.includes('usuario'))
  ) {
    return { field: 'nickname', message: 'Este nickname ya está en uso.' };
  }

  if (normalized.includes('password') || normalized.includes('contrasena')) {
    if (normalized.includes('short') || normalized.includes('corta') || normalized.includes('8')) {
      return { field: 'password', message: 'La contraseña debe tener al menos 8 caracteres.' };
    }
  }

  return null;
}

function sanitizeGeneralMessage(
  message: string,
  fallback: string,
  fieldErrors: Record<string, string>,
): string {
  const translated = translateKnownMessage(message);

  if (!translated || isTechnicalMessage(translated)) {
    return Object.keys(fieldErrors).length ? '' : fallback;
  }

  return translated;
}

function translateKnownMessage(message: string): string {
  const normalized = normalize(message);

  if (normalized.includes('email') && normalized.includes('formato')) {
    return 'El correo introducido no tiene un formato válido.';
  }

  if (normalized.includes('email') && (normalized.includes('uso') || normalized.includes('registr') || normalized.includes('unique'))) {
    return 'Este correo ya está en uso.';
  }

  if ((normalized.includes('nickname') || normalized.includes('usuario')) && (normalized.includes('uso') || normalized.includes('registr') || normalized.includes('unique'))) {
    return 'Este nickname ya está en uso.';
  }

  if (normalized.includes('credenciales') || normalized.includes('unauthorized')) {
    return 'Correo o contraseña incorrectos.';
  }

  if (normalized.includes('no verificado')) {
    return 'Este correo todavía no está verificado.';
  }

  if (normalized.includes('forbidden') || normalized.includes('permiso')) {
    return 'No tienes permisos para realizar esta acción.';
  }

  if (normalized.includes('codigo') && (normalized.includes('caduc') || normalized.includes('expir'))) {
    return 'El código ha caducado. Puedes pedir uno nuevo.';
  }

  if (normalized.includes('codigo') && (normalized.includes('incorrect') || normalized.includes('inval'))) {
    return 'El código introducido no es válido.';
  }

  if (normalized.includes('precio') && normalized.includes('negativo')) {
    return 'El precio no puede ser negativo.';
  }

  if (normalized.includes('stock') && normalized.includes('negativo')) {
    return 'El stock no puede ser negativo.';
  }

  return message.trim();
}

function isTechnicalMessage(message: string): boolean {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(message));
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}
