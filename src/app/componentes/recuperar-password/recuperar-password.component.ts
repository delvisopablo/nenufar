import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AuthService } from '../../servicios/authService/auth.service';
import { isAppErrorModel } from '../../core/errors/error-parser';
import { getFieldError } from '../../core/errors/form-error.utils';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';

const MENSAJE_EXITO =
  'Si existe una cuenta con ese correo, recibirás instrucciones para cambiar tu contraseña.';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EstanqueBackgroundComponent],
  templateUrl: './recuperar-password.component.html',
  styleUrl: './recuperar-password.component.css',
})
export class RecuperarPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  readonly enviando = signal(false);
  readonly exitoMensaje = signal('');
  readonly errorMensaje = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    this.title.setTitle('Recuperar contraseña');
  }

  campoInvalido(nombreCampo: 'email'): boolean {
    const control = this.form.controls[nombreCampo];
    return control.invalid && (control.touched || control.dirty);
  }

  getErrorCampo(nombreCampo: 'email'): string {
    return getFieldError(this.form.controls[nombreCampo]);
  }

  enviarEnlace(): void {
    if (this.enviando()) {
      return;
    }

    this.errorMensaje.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    const email = this.form.controls.email.value.trim().toLowerCase();

    this.auth.forgotPassword(email).subscribe({
      next: () => {
        this.enviando.set(false);
        this.exitoMensaje.set(MENSAJE_EXITO);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.errorMensaje.set(this.getMensajeEnvioError(error));
      },
    });
  }

  volverAlLogin(): void {
    void this.router.navigate(['/estanque']);
  }

  private getMensajeEnvioError(error: unknown): string {
    if (isAppErrorModel(error) && error.kind === 'rate-limit') {
      return 'Has solicitado demasiados enlaces. Espera unos minutos e inténtalo de nuevo.';
    }

    return 'No se pudo enviar la solicitud. Inténtalo de nuevo en unos minutos.';
  }
}
