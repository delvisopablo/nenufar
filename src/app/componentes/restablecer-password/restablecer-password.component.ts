import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../servicios/authService/auth.service';
import { isAppErrorModel } from '../../core/errors/error-parser';
import { getFieldError } from '../../core/errors/form-error.utils';
import {
  getPasswordRequirements as buildPasswordRequirements,
  passwordsMatchValidator,
  passwordStrengthValidator,
  PasswordRequirements,
} from '../../core/forms/password-validators';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';

type RestablecerCampo = 'nuevaPassword' | 'confirmarPassword';

@Component({
  selector: 'app-restablecer-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EstanqueBackgroundComponent],
  templateUrl: './restablecer-password.component.html',
  styleUrl: './restablecer-password.component.css',
})
export class RestablecerPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);

  private token = '';

  readonly tokenValido = signal(true);
  readonly enviando = signal(false);
  readonly exitoMensaje = signal('');
  readonly errorMensaje = signal('');
  readonly enlaceCaducado = signal(false);

  readonly form = this.fb.group(
    {
      nuevaPassword: ['', [Validators.required, passwordStrengthValidator]],
      confirmarPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator('nuevaPassword', 'confirmarPassword') },
  );

  ngOnInit(): void {
    this.title.setTitle('Restablecer contraseña');
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
    this.tokenValido.set(Boolean(this.token));
  }

  getPasswordRequirements(): PasswordRequirements {
    return buildPasswordRequirements(this.form.controls.nuevaPassword.value);
  }

  campoInvalido(nombreCampo: RestablecerCampo): boolean {
    const control = this.form.controls[nombreCampo];
    return control.invalid && (control.touched || control.dirty);
  }

  getErrorCampo(nombreCampo: RestablecerCampo): string {
    const control = this.form.controls[nombreCampo];

    if (!(control.touched || control.dirty)) {
      return '';
    }

    if (nombreCampo === 'confirmarPassword' && this.form.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden.';
    }

    return getFieldError(control);
  }

  cambiarPassword(): void {
    if (this.enviando() || !this.tokenValido()) {
      return;
    }

    this.errorMensaje.set('');
    this.enlaceCaducado.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    const nuevaPassword = String(this.form.controls.nuevaPassword.value ?? '');

    this.auth.resetPassword(this.token, nuevaPassword).subscribe({
      next: () => {
        this.enviando.set(false);
        this.exitoMensaje.set('Contraseña actualizada correctamente. Ya puedes iniciar sesión.');
      },
      error: (error: unknown) => {
        this.enviando.set(false);

        if (this.esErrorDeTokenInvalido(error)) {
          this.enlaceCaducado.set(true);
          this.errorMensaje.set('El enlace ha caducado o no es válido. Solicita uno nuevo.');
          return;
        }

        this.errorMensaje.set(
          'No se pudo actualizar la contraseña. Inténtalo de nuevo en unos minutos.',
        );
      },
    });
  }

  irAlLogin(): void {
    void this.router.navigate(['/estanque']);
  }

  solicitarNuevoEnlace(): void {
    void this.router.navigate(['/recuperar-password']);
  }

  private esErrorDeTokenInvalido(error: unknown): boolean {
    if (!isAppErrorModel(error)) {
      return false;
    }

    return (
      error.kind === 'validation' ||
      error.kind === 'not-found' ||
      error.kind === 'auth' ||
      error.status === 410
    );
  }
}
