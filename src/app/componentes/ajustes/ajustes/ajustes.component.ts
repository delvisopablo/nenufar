import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, AuthUser } from '../../../servicios/authService/auth.service';
import { UsuarioServiceService } from '../../../servicios/usuarioServicio/usuarioService.service';
import { getUserErrorMessage } from '../../../core/errors/error-parser';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.css'
})
export class AjustesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuarioServiceService);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly errorMensaje = signal('');
  readonly mensajeExito = signal('');
  readonly usuario = signal<AuthUser | null>(null);

  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    nickname: [{ value: '', disabled: true }],
    email: [{ value: '', disabled: true }],
    biografia: ['', Validators.maxLength(220)],
    foto: ['', Validators.maxLength(255)],
  });

  ngOnInit(): void {
    this.cargarPerfil();
  }

  private cargarPerfil(): void {
    this.cargando.set(true);
    this.errorMensaje.set('');
    this.auth.me().subscribe({
      next: (usuario) => {
        if (!usuario) {
          this.errorMensaje.set('Inicia sesión para gestionar tus ajustes.');
          this.cargando.set(false);
          return;
        }
        this.usuario.set(usuario);
        this.form.patchValue({
          nombre: usuario.nombre ?? '',
          nickname: usuario.nickname ?? '',
          email: usuario.email ?? '',
          biografia: usuario.biografia ?? '',
          foto: typeof usuario.foto === 'string' ? usuario.foto : (usuario.foto_perfil ?? ''),
        });
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.errorMensaje.set(getUserErrorMessage(err, 'No hemos podido cargar tu perfil.'));
      },
    });
  }

  guardar(): void {
    this.errorMensaje.set('');
    this.mensajeExito.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const usuario = this.usuario();
    if (!usuario?.id) {
      this.errorMensaje.set('Sesión expirada, vuelve a iniciar sesión.');
      return;
    }
    const valores = this.form.getRawValue();
    this.guardando.set(true);
    this.usuarios.updatePerfil(usuario.id, {
      nombre: valores.nombre,
      biografia: valores.biografia || null,
      foto: valores.foto || null,
    }).subscribe({
      next: (perfil) => {
        this.guardando.set(false);
        this.mensajeExito.set('Cambios guardados correctamente.');
        // Refrescar la sesión cacheada (normalizo null→undefined para AuthUser)
        const merged = {
          ...usuario,
          nombre: perfil.nombre ?? usuario.nombre,
          biografia: perfil.biografia ?? undefined,
          foto: perfil.foto ?? undefined,
          foto_perfil: perfil.foto_perfil ?? undefined,
        };
        this.auth.guardarUsuario(merged);
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.errorMensaje.set(getUserErrorMessage(err, 'No hemos podido guardar los cambios.'));
      }
    });
  }
}
