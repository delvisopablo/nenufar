import { Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import {
  FormBuilder, FormGroup, Validators, ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import {
  resolveNenufarAsset,
  resolveNenufarKey,
} from '../../core/negocio/negocio-visuals';
import {
  AuthService,
  resolveOwnedBusinessId,
} from '../../servicios/authService/auth.service';
import { NegocioService } from '../../servicios/negocioService/negocio.service';
import {
  NenufarSelectorComponent,
} from '../../components/shared/nenufar-selector/nenufar-selector.component';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';

interface NegocioDetalle {
  id?: number;
  nombre?: string;
  nickname?: string | null;
  slug?: string | null;
  descripcionCorta?: string | null;
  historia?: string | null;
  direccion?: string;
  ciudad?: string | null;
  provincia?: string | null;
  subcategoria?: { nombre?: string } | string | null;
  codigoPostal?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  web?: string | null;
  instagram?: string | null;
  fotoPerfil?: string | null;
  fotoPortada?: string | null;
  nenufarAsset?: string | null;
  nenufarKey?: string | null;
  dueno?: { nickname?: string };
  categoria?: { nombre?: string };
}

type Seccion = 'perfil' | 'contacto' | 'visual' | 'peligro';
type ImageField = 'fotoPerfil' | 'fotoPortada';

@Component({
  selector: 'app-editar-negocio',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NenufarSelectorComponent, EstanqueBackgroundComponent],
  templateUrl: './editar-negocio.component.html',
  styleUrl: './editar-negocio.component.css'
})
export class EditarNegocioComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private negocioService = inject(NegocioService);

  @ViewChild(NenufarSelectorComponent)
  private readonly nenufarSelector?: NenufarSelectorComponent;

  negocioForm!: FormGroup;
  negocioId!: number;
  negocioRouteKey = '';

  cargando = true;
  guardando = false;
  borrando = false;
  errorMensaje = '';
  exitoMensaje = '';
  avisoMensaje = '';
  confirmandoBorrar = false;
  textoConfirmacion = '';

  readonly seccionesAbiertas = signal<Record<Seccion, boolean>>({
    perfil: true,
    contacto: true,
    visual: true,
    peligro: false,
  });
  readonly fotoPerfilPreview = signal<string | null>(null);
  readonly fotoPortadaPreview = signal<string | null>(null);
  private readonly localPreviewUrls = new Map<ImageField, string>();

  ngOnInit(): void {
    this.negocioForm = this.fb.group({
      nombre: ['', Validators.required],
      slug: [''],
      descripcionCorta: ['', Validators.maxLength(160)],
      historia: ['', Validators.maxLength(800)],
      direccion: [''],
      ciudad: [''],
      provincia: [''],
      codigoPostal: [''],
      telefono: [''],
      emailContacto: ['', Validators.email],
      web: [''],
      instagram: [''],
      fotoPerfil: [''],
      fotoPortada: [''],
      nenufarAsset: [null as string | null],
      categoria: [''],
      subcategoria: [''],
    });

    const negocioId = resolveOwnedBusinessId(this.authService.obtenerUsuario());
    if (negocioId) {
      this.negocioId = negocioId;
      this.cargarDatos();
      return;
    }

    this.negocioService.getMine().subscribe({
      next: (negocio) => {
        if (!negocio?.id) {
          this.cargando = false;
          this.errorMensaje = 'Falta el identificador del negocio para Nenúditar.';
          return;
        }
        this.negocioId = negocio.id;
        this.cargarDatos();
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.errorMensaje = getUserErrorMessage(error, 'El negocio no se identificó.');
      },
    });
  }

  ngOnDestroy(): void {
    this.localPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    this.localPreviewUrls.clear();
  }

  abrirSeccion(s: Seccion): void {
    this.seccionesAbiertas.update((current) => ({
      ...current,
      [s]: !current[s],
    }));
  }

  esSeccionAbierta(s: Seccion): boolean {
    return Boolean(this.seccionesAbiertas()[s]);
  }

  cargarDatos(): void {
    this.errorMensaje = '';
    this.avisoMensaje = '';
    this.cargando = true;

    this.negocioService.getNegocioById(this.negocioId)
      .pipe(map((n) => n as NegocioDetalle))
      .subscribe({
      next: (negocio) => {
        this.negocioForm.patchValue({
          nombre: negocio.nombre ?? '',
          slug: negocio.slug ?? negocio.nickname ?? '',
          descripcionCorta: negocio.descripcionCorta ?? '',
          historia: negocio.historia ?? '',
          direccion: negocio.direccion ?? '',
          ciudad: (negocio as any).ciudad ?? '',
          provincia: (negocio as any).provincia ?? '',
          codigoPostal: (negocio as any).codigoPostal ?? '',
          telefono: (negocio as any).telefono ?? '',
          emailContacto: (negocio as any).emailContacto ?? '',
          web: (negocio as any).web ?? '',
          instagram: (negocio as any).instagram ?? '',
          fotoPerfil: negocio.fotoPerfil ?? '',
          fotoPortada: negocio.fotoPortada ?? '',
          nenufarAsset: negocio.nenufarAsset ?? resolveNenufarAsset(negocio.nenufarKey) ?? null,
          categoria: negocio.categoria?.nombre ?? '',
          subcategoria:
            typeof negocio.subcategoria === 'string'
              ? negocio.subcategoria
              : negocio.subcategoria?.nombre ?? '',
        });

        this.syncPreviewFromUrl('fotoPerfil', negocio.fotoPerfil ?? '');
        this.syncPreviewFromUrl('fotoPortada', negocio.fotoPortada ?? '');
        this.cargando = false;
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.errorMensaje = getUserErrorMessage(error, 'El negocio no se cargó para editarlo.');
      },
    });
  }

  guardarCambios(): void {
    this.errorMensaje = '';
    this.exitoMensaje = '';
    this.avisoMensaje = '';

    if (this.negocioForm.invalid) {
      this.negocioForm.markAllAsTouched();
      return;
    }

    const datos = this.negocioForm.getRawValue();
    const nenufarAsset = resolveNenufarAsset(datos.nenufarAsset);
    const nenufarKey = resolveNenufarKey(nenufarAsset);

    const negocioPayload: Record<string, unknown> = {
      nombre: datos.nombre?.trim(),
      slug: datos.slug?.trim() || null,
      descripcionCorta: datos.descripcionCorta?.trim() || null,
      historia: datos.historia?.trim() || null,
      direccion: datos.direccion?.trim() || null,
      ciudad: datos.ciudad?.trim() || null,
      provincia: datos.provincia?.trim() || null,
      codigoPostal: datos.codigoPostal?.trim() || null,
      telefono: datos.telefono?.trim() || null,
      emailContacto: datos.emailContacto?.trim() || null,
      web: datos.web?.trim() || null,
      instagram: datos.instagram?.trim() || null,
      ...(datos.fotoPerfil?.trim() ? { fotoPerfil: datos.fotoPerfil.trim() } : {}),
      ...(datos.fotoPortada?.trim() ? { fotoPortada: datos.fotoPortada.trim() } : {}),
      ...(nenufarAsset ? { nenufarAsset } : {}),
      ...(nenufarKey ? { nenufarKey } : {}),
    };

    this.guardando = true;
    this.negocioService.update(this.negocioId, negocioPayload as any)
      .pipe(
        map((n) => n as NegocioDetalle),
      )
      .subscribe({
        next: (negocioActualizado) => {
          this.guardando = false;
          this.exitoMensaje = 'Cambios guardados correctamente.';
          if (this.localPreviewUrls.size) {
            this.avisoMensaje =
              'La previsualización desde tu dispositivo queda lista en la UI, pero el backend actual todavía no sube archivos binarios. Para guardar imágenes reales por ahora sigue usando URL.';
          }
          this.sincronizarNegocioEnSesion(negocioActualizado);
          this.nenufarSelector?.markAsSaved(negocioActualizado.nenufarAsset ?? null);
          this.syncPreviewFromUrl('fotoPerfil', String(datos.fotoPerfil ?? ''));
          this.syncPreviewFromUrl('fotoPortada', String(datos.fotoPortada ?? ''));
          setTimeout(() => void this.router.navigate(['/mi-negocio']), 900);
        },
        error: (error: unknown) => {
          this.guardando = false;
          this.errorMensaje = getUserErrorMessage(error, 'Los cambios del negocio no se guardaron.');
        },
      });
  }

  iniciarBorrado(): void {
    this.confirmandoBorrar = true;
    this.textoConfirmacion = '';
  }

  cancelarBorrado(): void {
    this.confirmandoBorrar = false;
    this.textoConfirmacion = '';
  }

  get puedeConfirmarBorrado(): boolean {
    return this.textoConfirmacion.trim().toLowerCase() === 'borrar';
  }

  confirmarBorrado(): void {
    if (!this.puedeConfirmarBorrado || this.borrando) return;

    this.borrando = true;
    this.errorMensaje = '';

    // TODO(backend): verificar que DELETE /api/negocios/:id elimina el negocio y cierra la sesión
    this.negocioService.remove(this.negocioId).subscribe({
      next: () => {
        this.authService.clearSession();
        void this.router.navigate(['/estanque']);
      },
      error: (error: unknown) => {
        this.borrando = false;
        this.confirmandoBorrar = false;
        this.errorMensaje = getUserErrorMessage(
          error,
          'El negocio no se eliminó. Si el problema persiste, contacta con soporte.',
        );
      },
    });
  }

  volver(): void {
    void this.router.navigate(['/mi-negocio']);
  }

  onImageFileSelected(field: ImageField, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMensaje = 'Selecciona una imagen válida para la previsualización.';
      if (input) {
        input.value = '';
      }
      return;
    }

    const previousUrl = this.localPreviewUrls.get(field);
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    this.localPreviewUrls.set(field, objectUrl);
    if (field === 'fotoPerfil') {
      this.fotoPerfilPreview.set(objectUrl);
    } else {
      this.fotoPortadaPreview.set(objectUrl);
    }

    this.avisoMensaje =
      'Puedes previsualizar imágenes desde tu dispositivo, pero el backend actual solo guarda URLs. La subida binaria queda preparada como siguiente paso.';
    this.errorMensaje = '';
  }

  getImagePreview(field: ImageField): string | null {
    if (field === 'fotoPerfil') {
      return this.fotoPerfilPreview() || this.normalizeImageValue(this.negocioForm.get('fotoPerfil')?.value);
    }

    return this.fotoPortadaPreview() || this.normalizeImageValue(this.negocioForm.get('fotoPortada')?.value);
  }

  clearLocalPreview(field: ImageField): void {
    const localUrl = this.localPreviewUrls.get(field);
    if (localUrl) {
      URL.revokeObjectURL(localUrl);
      this.localPreviewUrls.delete(field);
    }

    this.syncPreviewFromUrl(
      field,
      String(this.negocioForm.get(field)?.value ?? ''),
    );
  }

  private sincronizarNegocioEnSesion(negocioActualizado: NegocioDetalle): void {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem('usuarioLogueado');
    if (!raw || raw === 'undefined' || raw === 'null') return;
    try {
      const usuario = JSON.parse(raw) as { negocio?: Record<string, unknown> & { id?: number } };
      if (usuario?.negocio?.id !== this.negocioId) return;
      usuario.negocio = { ...usuario.negocio, ...negocioActualizado };
      localStorage.setItem('usuarioLogueado', JSON.stringify(usuario));
    } catch {
      localStorage.removeItem('usuarioLogueado');
    }
  }

  private syncPreviewFromUrl(field: ImageField, value: string): void {
    const localUrl = this.localPreviewUrls.get(field);
    if (localUrl) {
      URL.revokeObjectURL(localUrl);
      this.localPreviewUrls.delete(field);
    }

    const normalized = this.normalizeImageValue(value);
    if (field === 'fotoPerfil') {
      this.fotoPerfilPreview.set(normalized);
      return;
    }

    this.fotoPortadaPreview.set(normalized);
  }

  private normalizeImageValue(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }
}
