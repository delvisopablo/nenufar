import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map, of, switchMap } from 'rxjs';
import { AuthService, AuthUser } from '../../../servicios/authService/auth.service';
import { UsuarioServiceService } from '../../../servicios/usuarioServicio/usuarioService.service';
import { getUserErrorMessage } from '../../../core/errors/error-parser';
import { environment } from '../../../../environments/environment';
import {
  DEFAULT_PROFILE_PHOTO,
  getProfilePhotoFileError,
  resolveProfilePhoto,
} from '../../../core/usuario/profile-photo';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.css'
})
export class AjustesComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuarioServiceService);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly errorMensaje = signal('');
  readonly mensajeExito = signal('');
  readonly fotoPerfilError = signal('');
  readonly fotoPerfilArchivo = signal<File | null>(null);
  readonly fotoPerfilPreview = signal<string | null>(null);
  readonly usuario = signal<AuthUser | null>(null);
  readonly fotoPerfilSrc = computed(
    () =>
      this.fotoPerfilPreview() ||
      resolveProfilePhoto(this.usuario()) ||
      DEFAULT_PROFILE_PHOTO,
  );

  private fotoPerfilObjectUrl: string | null = null;

  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    nickname: [{ value: '', disabled: true }],
    email: [{ value: '', disabled: true }],
    biografia: ['', Validators.maxLength(220)],
  });

  ngOnInit(): void {
    this.cargarPerfil();
  }

  ngOnDestroy(): void {
    this.revokeFotoPerfilPreview();
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
    this.fotoPerfilError.set('');
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
    const archivoFotoPerfil = this.fotoPerfilArchivo();
    this.guardando.set(true);
    this.usuarios.updatePerfil(usuario.id, {
      nombre: valores.nombre,
      biografia: valores.biografia || null,
    }).pipe(
      switchMap((perfil) => {
        if (!archivoFotoPerfil) {
          return of(perfil);
        }

        return this.usuarios.subirFotoPerfil(archivoFotoPerfil).pipe(
          map((perfilConFoto) => ({
            ...perfil,
            ...perfilConFoto,
          })),
        );
      }),
      finalize(() => this.guardando.set(false)),
    ).subscribe({
      next: (perfil) => {
        this.mensajeExito.set('Cambios guardados correctamente.');
        const fotoPerfil = resolveProfilePhoto(perfil);
        const merged = {
          ...usuario,
          ...perfil,
          nombre: perfil.nombre ?? usuario.nombre,
          biografia: perfil.biografia ?? undefined,
          foto: fotoPerfil ?? perfil.foto ?? undefined,
          fotoPerfil: fotoPerfil ?? null,
          foto_perfil: fotoPerfil ?? null,
        };
        this.usuario.set(merged);
        this.auth.guardarUsuario(merged);
        this.clearFotoPerfilSelection();
      },
      error: (err: unknown) => {
        this.logDevError(err);
        this.errorMensaje.set(getUserErrorMessage(err, 'No hemos podido guardar los cambios.'));
      }
    });
  }

  onFotoPerfilSeleccionada(event: Event): void {
    this.fotoPerfilError.set('');
    this.mensajeExito.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const fileError = getProfilePhotoFileError(file);
    if (fileError) {
      this.fotoPerfilError.set(fileError);
      input.value = '';
      return;
    }

    this.revokeFotoPerfilPreview();
    this.fotoPerfilArchivo.set(file);
    this.fotoPerfilObjectUrl = URL.createObjectURL(file);
    this.fotoPerfilPreview.set(this.fotoPerfilObjectUrl);
    input.value = '';
  }

  descartarFotoPerfilSeleccionada(): void {
    this.clearFotoPerfilSelection();
    this.fotoPerfilError.set('');
  }

  private clearFotoPerfilSelection(): void {
    this.fotoPerfilArchivo.set(null);
    this.fotoPerfilPreview.set(null);
    this.revokeFotoPerfilPreview();
  }

  private revokeFotoPerfilPreview(): void {
    if (this.fotoPerfilObjectUrl) {
      URL.revokeObjectURL(this.fotoPerfilObjectUrl);
      this.fotoPerfilObjectUrl = null;
    }
  }

  private logDevError(error: unknown): void {
    if (!environment.production) {
      console.error('[AjustesComponent] Error guardando perfil', error);
    }
  }
}
