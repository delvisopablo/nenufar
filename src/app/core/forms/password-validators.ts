import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface PasswordRequirements {
  minLength: boolean;
  mayuscula: boolean;
  minuscula: boolean;
  numero: boolean;
}

export function getPasswordRequirements(value: string | null | undefined): PasswordRequirements {
  const password = value ?? '';

  return {
    minLength: password.length >= 8,
    mayuscula: /[A-ZÁÉÍÓÚÑ]/.test(password),
    minuscula: /[a-záéíóúñ]/.test(password),
    numero: /[0-9]/.test(password),
  };
}

export function isPasswordStrong(value: string | null | undefined): boolean {
  const req = getPasswordRequirements(value);
  return req.minLength && req.mayuscula && req.minuscula && req.numero;
}

/** Valida fuerza de contraseña: 8+ caracteres, mayúscula, minúscula y número. */
export function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const requirements = getPasswordRequirements(control.value);
  return isPasswordStrong(control.value) ? null : { passwordStrength: requirements };
}

/** Valida que dos campos de un FormGroup coincidan (p. ej. password y confirmarContrasena). */
export function passwordsMatchValidator(
  passwordKey = 'password',
  confirmKey = 'confirmarContrasena',
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey)?.value;
    const confirmacion = group.get(confirmKey)?.value;

    if (!password || !confirmacion) {
      return null;
    }

    return password === confirmacion ? null : { passwordMismatch: true };
  };
}
