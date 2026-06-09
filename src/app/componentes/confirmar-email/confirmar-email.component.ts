import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AuthResponse, AuthService } from '../../servicios/authService/auth.service';
import {
  clearPendingEmailVerification,
  readPendingEmailVerification,
  savePendingEmailVerification,
} from '../../servicios/authService/email-verification.storage';
import { getUserErrorMessage, isAppErrorModel } from '../../core/errors/error-parser';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';

@Component({
  selector: 'app-confirmar-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EstanqueBackgroundComponent],
  templateUrl: './confirmar-email.component.html',
  styleUrl: './confirmar-email.component.css'
})
export class ConfirmarEmailComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  private emailPendiente = '';
  private cooldownTimerId: number | null = null;
  private redirectTimerId: number | null = null;

  readonly maskedEmail = signal('');
  readonly expiresInMinutes = signal<number | null>(null);
  readonly confirmando = signal(false);
  readonly reenviando = signal(false);
  readonly cooldownRemaining = signal(0);
  readonly errorMensaje = signal('');
  readonly exitoMensaje = signal('');

  readonly verificationForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  get textoBotonReenviar(): string {
    const segundos = this.cooldownRemaining();

    if (segundos > 0) {
      return `Reenviar código (${segundos}s)`;
    }

    return this.reenviando() ? 'Reenviando...' : 'Reenviar código';
  }

  get cooldownProgress(): number {
    return (this.cooldownRemaining() / 60) * 100;
  }

  ngOnInit(): void {
    this.title.setTitle('Confirma tu email');

    const pendingVerification = readPendingEmailVerification();

    if (!pendingVerification) {
      void this.router.navigate(['/registro'], { replaceUrl: true });
      return;
    }

    this.emailPendiente = pendingVerification.email;
    this.maskedEmail.set(pendingVerification.maskedEmail);
    this.expiresInMinutes.set(pendingVerification.expiresInMinutes);
    this.iniciarCooldown(60);
  }

  ngOnDestroy(): void {
    this.limpiarCooldown();

    if (this.redirectTimerId !== null) {
      window.clearTimeout(this.redirectTimerId);
      this.redirectTimerId = null;
    }
  }

  confirmarCodigo(): void {
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    if (this.verificationForm.invalid) {
      this.verificationForm.markAllAsTouched();
      return;
    }

    if (!this.emailPendiente) {
      void this.router.navigate(['/registro'], { replaceUrl: true });
      return;
    }

    this.confirmando.set(true);

    this.auth.verifyEmail({
      email: this.emailPendiente,
      code: this.verificationForm.controls.code.value.trim(),
    }).subscribe({
      next: () => {
        clearPendingEmailVerification();
        this.errorMensaje.set('');
        this.exitoMensaje.set('Email verificado correctamente');
        this.persistirAccesoVerificado();
        this.refrescarSesionYRedirigir();
      },
      error: (error: unknown) => {
        this.confirmando.set(false);
        this.errorMensaje.set(this.getMensajeConfirmacionError(error));
      }
    });
  }

  reenviarCodigo(): void {
    if (
      !this.emailPendiente ||
      this.cooldownRemaining() > 0 ||
      this.reenviando() ||
      this.confirmando()
    ) {
      return;
    }

    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.reenviando.set(true);

    this.auth.resendEmailCode({ email: this.emailPendiente }).subscribe({
      next: (response) => {
        this.reenviando.set(false);
        this.actualizarVerificacionPendiente(response);
        this.verificationForm.controls.code.reset('');
        this.exitoMensaje.set('Te hemos enviado un nuevo código');
        this.iniciarCooldown(60);
      },
      error: (error: unknown) => {
        this.reenviando.set(false);
        this.errorMensaje.set(
          getUserErrorMessage(
            error,
            'El nuevo código de confirmación no se envió. Vuelve a intentarlo en unos segundos.',
          ),
        );
      }
    });
  }

  normalizarCodigo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(0, 6);

    if (input.value !== value) {
      input.value = value;
    }

    this.verificationForm.controls.code.setValue(value, { emitEvent: false });
  }

  campoInvalido(nombreCampo: 'code'): boolean {
    const control = this.verificationForm.controls[nombreCampo];
    return control.invalid && (control.touched || control.dirty);
  }

  getErrorCampo(nombreCampo: 'code'): string {
    const control = this.verificationForm.controls[nombreCampo];

    if (!(control.touched || control.dirty)) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Introduce el código de 6 dígitos.';
    }

    if (control.hasError('pattern')) {
      return 'El código debe tener exactamente 6 dígitos.';
    }

    return 'Revisa el código.';
  }

  volverAlRegistro(): void {
    void this.router.navigate(['/registro']);
  }

  private persistirAccesoVerificado(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem('accesoPermitido', 'true');
    localStorage.removeItem('guestMode');
  }

  private refrescarSesionYRedirigir(): void {
    this.auth.me().subscribe({
      next: () => this.finalizarConfirmacion(),
      error: () => this.finalizarConfirmacion(),
    });
  }

  private finalizarConfirmacion(): void {
    this.confirmando.set(false);
    this.redirectTimerId = window.setTimeout(() => {
      void this.router.navigate(['/inicio']);
    }, 900);
  }

  private actualizarVerificacionPendiente(response: AuthResponse): void {
    const emailVerification = response.emailVerification;
    const maskedEmail = emailVerification?.email?.trim() || this.maskedEmail();
    const expiresInMinutes =
      typeof emailVerification?.expiresInMinutes === 'number'
        ? emailVerification.expiresInMinutes
        : this.expiresInMinutes();

    this.maskedEmail.set(maskedEmail);
    this.expiresInMinutes.set(expiresInMinutes);

    savePendingEmailVerification({
      email: this.emailPendiente,
      maskedEmail,
      expiresInMinutes,
    });
  }

  private iniciarCooldown(seconds: number): void {
    this.limpiarCooldown();
    this.cooldownRemaining.set(seconds);

    this.cooldownTimerId = window.setInterval(() => {
      const siguienteValor = Math.max(this.cooldownRemaining() - 1, 0);
      this.cooldownRemaining.set(siguienteValor);

      if (siguienteValor === 0) {
        this.limpiarCooldown();
      }
    }, 1000);
  }

  private limpiarCooldown(): void {
    if (this.cooldownTimerId !== null) {
      window.clearInterval(this.cooldownTimerId);
      this.cooldownTimerId = null;
    }
  }

  private getMensajeConfirmacionError(error: unknown): string {
    if (this.esErrorExpirado(error)) {
      return 'El código ha caducado. Puedes pedir uno nuevo con el botón Reenviar código.';
    }

    return getUserErrorMessage(
      error,
      'El email no se confirmó. Revisa el código de 6 dígitos.',
    );
  }

  private esErrorExpirado(error: unknown): boolean {
    const errorText = this.getErrorText(error);

    return (
      errorText.includes('EXPIR') ||
      errorText.includes('CADUC') ||
      errorText.includes('VENCID')
    );
  }

  private getErrorText(error: unknown): string {
    if (isAppErrorModel(error)) {
      return `${error.code} ${error.message}`.toUpperCase();
    }

    if (error instanceof Error) {
      return error.message.toUpperCase();
    }

    if (typeof error === 'string') {
      return error.toUpperCase();
    }

    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      return `${String(record['code'] ?? '')} ${String(record['message'] ?? '')}`.toUpperCase();
    }

    return '';
  }
}
