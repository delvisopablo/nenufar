import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import {
  FormBuilder, FormGroup, Validators, ReactiveFormsModule,
  FormArray, FormControl
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
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
  codigoPostal?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  web?: string | null;
  instagram?: string | null;
  fotoPerfil?: string | null;
  fotoPortada?: string | null;
  nenufarAsset?: string | null;
  nenufarKey?: string | null;
  aceptaReservas?: boolean;
  intervaloReserva?: number;
  dueno?: { nickname?: string };
  categoria?: { nombre?: string };
  horario?: {
    apertura?: string;
    cierre?: string;
    intervalo?: number;
    diasAbre?: string[];
    weekly?: Record<string, [string, string][]>;
  };
}

type Seccion = 'perfil' | 'contacto' | 'visual' | 'horario' | 'peligro';

@Component({
  selector: 'app-editar-negocio',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NenufarSelectorComponent, EstanqueBackgroundComponent],
  templateUrl: './editar-negocio.component.html',
  styleUrl: './editar-negocio.component.css'
})
export class EditarNegocioComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private negocioService = inject(NegocioService);

  @ViewChild(NenufarSelectorComponent)
  private readonly nenufarSelector?: NenufarSelectorComponent;

  negocioForm!: FormGroup;
  negocioId!: number;
  negocioRouteKey = '';

  readonly diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  readonly intervalosReserva = [15, 30, 45, 60, 90, 120];

  cargando = true;
  guardando = false;
  borrando = false;
  errorMensaje = '';
  exitoMensaje = '';
  confirmandoBorrar = false;
  textoConfirmacion = '';

  readonly seccionAbierta = signal<Seccion>('perfil');

  ngOnInit(): void {
    this.negocioForm = this.fb.group({
      // Datos principales
      nombre: ['', Validators.required],
      slug: [''],
      descripcionCorta: ['', Validators.maxLength(160)],
      historia: ['', Validators.maxLength(800)],
      // Ubicación
      direccion: [''],
      ciudad: [''],
      provincia: [''],
      codigoPostal: [''],
      // Contacto
      telefono: [''],
      emailContacto: ['', Validators.email],
      web: [''],
      instagram: [''],
      // Imágenes — URL por ahora (TODO: subida de fichero)
      fotoPerfil: [''],
      fotoPortada: [''],
      // Nenúfar
      nenufarAsset: [null as string | null],
      // Categoría (solo lectura en este form, editaría mediante selector externo)
      categoria: [''],
      // Reservas
      aceptaReservas: [false],
      intervaloReserva: [30],
      horario: this.fb.group({
        apertura: [''],
        cierre: [''],
        diasAbre: this.fb.array([]),
      }),
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
          this.errorMensaje = 'No hemos podido identificar el negocio que quieres editar.';
          return;
        }
        this.negocioId = negocio.id;
        this.cargarDatos();
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido identificar el negocio.');
      },
    });
  }

  get diasAbre(): FormArray {
    return this.negocioForm.get('horario.diasAbre') as FormArray;
  }

  toggleDia(dia: string): void {
    const idx = this.diasAbre.controls.findIndex(c => c.value === dia);
    if (idx === -1) {
      this.diasAbre.push(new FormControl(dia));
    } else {
      this.diasAbre.removeAt(idx);
    }
  }

  isDiaActivo(dia: string): boolean {
    return this.diasAbre.controls.some(c => c.value === dia);
  }

  abrirSeccion(s: Seccion): void {
    this.seccionAbierta.set(this.seccionAbierta() === s ? 'perfil' : s);
  }

  esSeccionAbierta(s: Seccion): boolean {
    return this.seccionAbierta() === s;
  }

  cargarDatos(): void {
    this.errorMensaje = '';
    this.cargando = true;

    forkJoin({
      negocio: this.negocioService.getNegocioById(this.negocioId).pipe(
        map((n) => n as NegocioDetalle),
      ),
      horario: this.negocioService.getHorario(this.negocioId).pipe(
        catchError(() => of(null)),
      ),
    }).subscribe({
      next: ({ negocio, horario }) => {
        const horarioActual = horario ?? negocio.horario ?? null;
        const rangoBase = this.resolveHorarioBase(horarioActual);

        this.diasAbre.clear();
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
          aceptaReservas: negocio.aceptaReservas ?? false,
          intervaloReserva: Number(negocio.intervaloReserva ?? horarioActual?.intervalo ?? 30) || 30,
          horario: {
            apertura: rangoBase.apertura,
            cierre: rangoBase.cierre,
          },
        });

        if (Array.isArray(horarioActual?.diasAbre)) {
          horarioActual.diasAbre.forEach((dia: string) => {
            this.diasAbre.push(new FormControl(dia));
          });
        }

        this.cargando = false;
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido cargar el negocio.');
      },
    });
  }

  guardarCambios(): void {
    this.errorMensaje = '';
    this.exitoMensaje = '';

    if (this.negocioForm.invalid) {
      this.negocioForm.markAllAsTouched();
      return;
    }

    const datos = this.negocioForm.getRawValue();
    const nenufarAsset = resolveNenufarAsset(datos.nenufarAsset);
    const nenufarKey = resolveNenufarKey(nenufarAsset);

    const negocioPayload: Record<string, unknown> = {
      nombre: datos.nombre?.trim(),
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
      aceptaReservas: Boolean(datos.aceptaReservas),
      ...(datos.fotoPerfil?.trim() ? { fotoPerfil: datos.fotoPerfil.trim() } : {}),
      ...(datos.fotoPortada?.trim() ? { fotoPortada: datos.fotoPortada.trim() } : {}),
      ...(nenufarAsset ? { nenufarAsset } : {}),
      ...(nenufarKey ? { nenufarKey } : {}),
    };

    const horarioPayload = this.buildHorarioPayload(datos);

    this.guardando = true;

    forkJoin({
      negocioActualizado: this.negocioService.update(this.negocioId, negocioPayload as any),
      horarioActualizado: this.negocioService.configHorario(this.negocioId, horarioPayload).pipe(
        catchError((error: unknown) => {
          if ((error as { status?: number })?.status === 404) {
            return this.negocioService.update(this.negocioId, {
              horario: horarioPayload.horario,
              intervaloReserva: horarioPayload.intervaloReserva,
            });
          }
          throw error;
        }),
      ),
    })
      .pipe(
        switchMap(() =>
          this.negocioService.getNegocioById(this.negocioId).pipe(
            map((n) => n as NegocioDetalle),
          ),
        ),
      )
      .subscribe({
        next: (negocioActualizado) => {
          this.guardando = false;
          this.exitoMensaje = 'Cambios guardados correctamente.';
          this.sincronizarNegocioEnSesion(negocioActualizado);
          this.nenufarSelector?.markAsSaved(negocioActualizado.nenufarAsset ?? null);
          setTimeout(() => void this.router.navigate(['/mi-negocio']), 900);
        },
        error: (error: unknown) => {
          this.guardando = false;
          this.errorMensaje = getUserErrorMessage(error, 'No hemos podido actualizar el negocio.');
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
          'No hemos podido eliminar el negocio. Si el problema persiste, contacta con soporte.',
        );
      },
    });
  }

  volver(): void {
    void this.router.navigate(['/mi-negocio']);
  }

  private resolveHorarioBase(horario: NegocioDetalle['horario'] | null | undefined): { apertura: string; cierre: string } {
    if (!horario) return { apertura: '', cierre: '' };
    if (horario.apertura && horario.cierre) return { apertura: horario.apertura, cierre: horario.cierre };
    const ranges = horario.weekly ? Object.values(horario.weekly).flat() : [];
    const first = ranges.find((r): r is [string, string] => Array.isArray(r) && r.length >= 2);
    return { apertura: first?.[0] ?? '', cierre: first?.[1] ?? '' };
  }

  private buildHorarioPayload(datos: ReturnType<FormGroup['getRawValue']>) {
    const apertura = String(datos.horario?.apertura ?? '').trim();
    const cierre = String(datos.horario?.cierre ?? '').trim();
    const intervalo = Number(datos.intervaloReserva ?? 30) || 30;
    const diasAbre = Array.isArray(datos.horario?.diasAbre)
      ? datos.horario.diasAbre.filter((d: unknown): d is string => typeof d === 'string')
      : [];

    return {
      intervaloReserva: intervalo,
      horario: Boolean(datos.aceptaReservas)
        ? { apertura, cierre, intervalo, diasAbre }
        : { apertura: '', cierre: '', intervalo, diasAbre: [] as string[] },
    };
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
}
