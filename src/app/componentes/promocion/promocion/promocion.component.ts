import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';
import { getUserErrorMessage } from '../../../core/errors/error-parser';
import {
  Producto,
  ProductoServiceService,
} from '../../../servicios/productoServicio/productoService.service';
import {
  Promocion,
  PromocionEstado,
  PromocionMutationPayload,
  PromocionService,
  TipoDescuento,
} from '../../../servicios/promocionServicio/promocionService.service';
import { PondBusinessSnapshot } from '../../../servicios/estanqueFeed/estanque-feed.service';

type PromocionVisualState =
  | 'Programada'
  | 'Activa'
  | 'Caducada'
  | 'Oculta'
  | 'Borrador';

const TIPO_DESCUENTO_OPTIONS: Array<{ label: string; value: TipoDescuento }> = [
  { value: 'PORCENTAJE', label: 'Porcentaje' },
  { value: 'IMPORTE_FIJO', label: 'Importe fijo' },
  { value: 'PACK', label: 'Pack' },
  { value: 'DOS_X_UNO', label: 'Dos por uno' },
];

const ESTADO_OPTIONS: Array<{ label: string; value: PromocionEstado }> = [
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'PUBLICADO', label: 'Publicado' },
  { value: 'OCULTO', label: 'Oculto' },
];

function fechaRangoValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const fechaInicio = String(control.get('fechaInicio')?.value ?? '').trim();
    const fechaCaducidad = String(control.get('fechaCaducidad')?.value ?? '').trim();

    if (!fechaInicio || !fechaCaducidad) {
      return null;
    }

    return new Date(fechaCaducidad) > new Date(fechaInicio)
      ? null
      : { fechaRangoInvalido: true };
  };
}

function descuentoValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const tipo = String(control.get('tipoDescuento')?.value ?? '').trim();
    const descuento = Number(control.get('descuento')?.value ?? 0);

    if (!Number.isFinite(descuento) || descuento < 0) {
      return { descuentoInvalido: true };
    }

    if (tipo === 'PORCENTAJE' && (descuento < 0 || descuento > 100)) {
      return { porcentajeFueraDeRango: true };
    }

    return null;
  };
}

@Component({
  selector: 'app-promocion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './promocion.component.html',
  styleUrl: './promocion.component.css',
})
export class PromocionComponent implements OnChanges {
  @Input() negocioId!: number;
  @Input() negocio: PondBusinessSnapshot | null = null;
  @Output() promocionGuardada = new EventEmitter<Promocion>();

  private readonly fb = inject(FormBuilder);
  private readonly promocionService = inject(PromocionService);
  private readonly productoService = inject(ProductoServiceService);

  readonly promociones = signal<Promocion[]>([]);
  readonly productos = signal<Producto[]>([]);
  readonly cargando = signal(false);
  readonly cargandoProductos = signal(false);
  readonly guardando = signal(false);
  readonly guardandoProducto = signal(false);
  readonly errorMensaje = signal('');
  readonly exitoMensaje = signal('');
  readonly editorAbierto = signal(false);
  readonly editorProductoAbierto = signal(false);
  readonly promocionEditandoId = signal<number | null>(null);
  readonly tipoDescuentoOptions = TIPO_DESCUENTO_OPTIONS;
  readonly estadoOptions = ESTADO_OPTIONS;
  readonly promocionesOrdenadas = computed(() =>
    [...this.promociones()].sort((a, b) => {
      const fechaA = new Date(a.fechaCaducidad).getTime();
      const fechaB = new Date(b.fechaCaducidad).getTime();
      return fechaA - fechaB;
    }),
  );

  readonly form = this.fb.group(
    {
      titulo: ['', [Validators.required, Validators.maxLength(191)]],
      descripcion: [''],
      tipoDescuento: ['PORCENTAJE', Validators.required],
      descuento: [0, [Validators.required, Validators.min(0)]],
      fechaInicio: [''],
      fechaCaducidad: ['', Validators.required],
      activa: [true],
      estado: ['BORRADOR', Validators.required],
      stockMaximo: [''],
      usosMaximos: [''],
      codigo: [''],
      productoId: [''],
    },
    {
      validators: [fechaRangoValidator(), descuentoValidator()],
    },
  );

  readonly productoForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(191)]],
    precio: [0, [Validators.required, Validators.min(0)]],
    descripcion: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if ('negocioId' in changes && this.negocioId > 0) {
      this.cargarPromociones();
      this.cargarProductos();
    }
  }

  abrirCrear(): void {
    this.editorAbierto.set(true);
    this.promocionEditandoId.set(null);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.form.reset({
      titulo: '',
      descripcion: '',
      tipoDescuento: 'PORCENTAJE',
      descuento: 0,
      fechaInicio: '',
      fechaCaducidad: '',
      activa: true,
      estado: 'BORRADOR',
      stockMaximo: '',
      usosMaximos: '',
      codigo: '',
      productoId: '',
    });
  }

  editarPromocion(promocion: Promocion): void {
    this.editorAbierto.set(true);
    this.promocionEditandoId.set(promocion.id);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.form.reset({
      titulo: promocion.titulo,
      descripcion: promocion.descripcion ?? '',
      tipoDescuento: promocion.tipoDescuento || 'PORCENTAJE',
      descuento: promocion.descuento,
      fechaInicio: this.toDateTimeLocal(promocion.fechaInicio),
      fechaCaducidad: this.toDateTimeLocal(promocion.fechaCaducidad),
      activa: promocion.activa,
      estado: this.normalizeEstado(promocion.estado),
      stockMaximo: promocion.stockMaximo === null || promocion.stockMaximo === undefined ? '' : String(promocion.stockMaximo),
      usosMaximos: promocion.usosMaximos === null || promocion.usosMaximos === undefined ? '' : String(promocion.usosMaximos),
      codigo: promocion.codigo ?? '',
      productoId: promocion.productoId === null || promocion.productoId === undefined ? '' : String(promocion.productoId),
    });
  }

  cancelarEdicion(): void {
    this.editorAbierto.set(false);
    this.editorProductoAbierto.set(false);
    this.promocionEditandoId.set(null);
    this.form.reset();
    this.productoForm.reset({
      nombre: '',
      precio: 0,
      descripcion: '',
    });
    this.errorMensaje.set('');
  }

  abrirCrearProducto(): void {
    this.editorProductoAbierto.set(true);
    this.productoForm.reset({
      nombre: '',
      precio: 0,
      descripcion: '',
    });
  }

  cancelarCrearProducto(): void {
    this.editorProductoAbierto.set(false);
    this.productoForm.reset({
      nombre: '',
      precio: 0,
      descripcion: '',
    });
  }

  crearProductoRapido(): void {
    if (!this.negocioId || this.productoForm.invalid) {
      this.productoForm.markAllAsTouched();
      return;
    }

    const raw = this.productoForm.getRawValue();
    this.guardandoProducto.set(true);
    this.errorMensaje.set('');

    this.productoService.create(this.negocioId, {
      nombre: String(raw.nombre ?? '').trim(),
      precio: Number(raw.precio ?? 0),
      descripcion: this.optionalString(raw.descripcion) ?? undefined,
    })
      .pipe(finalize(() => this.guardandoProducto.set(false)))
      .subscribe({
        next: (producto) => {
          this.productos.update((items) => [...items, producto]);
          this.form.get('productoId')?.setValue(String(producto.id));
          this.exitoMensaje.set('Producto creado y listo para asociar a la promoción.');
          this.cancelarCrearProducto();
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(
              error,
              'No hemos podido crear el producto básico.',
            ),
          );
        },
      });
  }

  guardarPromocion(): void {
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    if (this.form.invalid || !this.negocioId) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    const promocionId = this.promocionEditandoId();
    const request$ = promocionId
      ? this.promocionService.actualizarPromocion(promocionId, payload)
      : this.promocionService.crearPromocion(this.negocioId, payload);

    this.guardando.set(true);

    request$
      .pipe(
        finalize(() => this.guardando.set(false)),
      )
      .subscribe({
        next: (saved) => {
          this.exitoMensaje.set(
            promocionId
              ? 'Promoción actualizada correctamente.'
              : 'Promoción creada correctamente.',
          );
          this.promocionGuardada.emit(this.attachBusinessSnapshot(saved));
          this.cancelarEdicion();
          this.cargarPromociones();
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(
              error,
              'No hemos podido guardar la promoción.',
            ),
          );
        },
      });
  }

  publicarPromocion(promocion: Promocion): void {
    this.actualizarEstado(promocion, 'PUBLICADO', true, 'Promoción publicada.');
  }

  ocultarPromocion(promocion: Promocion): void {
    this.actualizarEstado(promocion, 'OCULTO', false, 'Promoción ocultada.');
  }

  eliminarPromocion(promocion: Promocion): void {
    const ok = confirm(`¿Eliminar la promoción "${promocion.titulo}"?`);
    if (!ok) {
      return;
    }

    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.guardando.set(true);

    this.promocionService
      .eliminarPromocion(promocion.id)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: () => {
          this.exitoMensaje.set('Promoción eliminada correctamente.');
          this.promociones.update((items) =>
            items.filter((item) => item.id !== promocion.id),
          );
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(
              error,
              'No hemos podido eliminar la promoción.',
            ),
          );
        },
      });
  }

  getVisualState(promocion: Promocion): PromocionVisualState {
    const ahora = new Date();
    const fechaInicio = promocion.fechaInicio ? new Date(promocion.fechaInicio) : null;
    const fechaCaducidad = new Date(promocion.fechaCaducidad);
    const estado = this.normalizeEstado(promocion.estado);

    if (estado === 'BORRADOR') {
      return 'Borrador';
    }

    if (estado === 'OCULTO' || !promocion.activa) {
      return 'Oculta';
    }

    if (fechaCaducidad.getTime() < ahora.getTime()) {
      return 'Caducada';
    }

    if (fechaInicio && fechaInicio.getTime() > ahora.getTime()) {
      return 'Programada';
    }

    return 'Activa';
  }

  getVisualStateClass(promocion: Promocion): string {
    return `badge--${this.getVisualState(promocion).toLowerCase()}`;
  }

  getDescuentoLabel(promocion: Promocion): string {
    switch (promocion.tipoDescuento) {
      case 'PORCENTAJE':
        return `${promocion.descuento}%`;
      case 'IMPORTE_FIJO':
        return `${promocion.descuento} €`;
      case 'PACK':
        return `Pack ${promocion.descuento}`;
      case 'DOS_X_UNO':
        return `2x1 · ${promocion.descuento}`;
      default:
        return String(promocion.descuento);
    }
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'Sin fecha';
    }

    return new Date(value).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  hasControlError(controlName: string, errorKey?: string): boolean {
    const control = this.form.get(controlName);
    if (!control || !(control.touched || control.dirty)) {
      return false;
    }

    return errorKey ? Boolean(control.hasError(errorKey)) : Boolean(control.invalid);
  }

  private cargarPromociones(): void {
    if (!this.negocioId) {
      this.promociones.set([]);
      return;
    }

    this.cargando.set(true);
    this.errorMensaje.set('');

    this.promocionService
      .getPromocionesPorNegocio(this.negocioId)
      .pipe(
        catchError((error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(
              error,
              'Funcionalidad pendiente de conexión backend para promociones.',
            ),
          );
          return of([] as Promocion[]);
        }),
        finalize(() => this.cargando.set(false)),
      )
      .subscribe((items) => {
        this.promociones.set(items);
      });
  }

  private cargarProductos(): void {
    if (!this.negocioId) {
      this.productos.set([]);
      return;
    }

    this.cargandoProductos.set(true);

    this.productoService.listByNegocio(this.negocioId)
      .pipe(
        catchError(() => of([] as Producto[])),
        finalize(() => this.cargandoProductos.set(false)),
      )
      .subscribe((items) => {
        this.productos.set(items);
      });
  }

  private actualizarEstado(
    promocion: Promocion,
    estado: PromocionEstado,
    activa: boolean,
    successMessage: string,
  ): void {
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.guardando.set(true);

    const request$ =
      estado === 'PUBLICADO'
        ? this.promocionService.publicarPromocion(promocion.id)
        : this.promocionService.ocultarPromocion(promocion.id);

    request$
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (updated) => {
          this.exitoMensaje.set(successMessage);
          this.promocionGuardada.emit(this.attachBusinessSnapshot({
            ...promocion,
            ...updated,
            activa,
            estado: updated.estado ?? estado,
          }));
          this.promociones.update((items) =>
            items.map((item) =>
              item.id === promocion.id
                ? {
                    ...item,
                    ...updated,
                    activa,
                    estado: updated.estado ?? estado,
                  }
                : item,
            ),
          );
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(
              error,
              'No hemos podido actualizar el estado de la promoción.',
            ),
          );
        },
      });
  }

  private buildPayload(): PromocionMutationPayload {
    const raw = this.form.getRawValue();

    return {
      titulo: String(raw.titulo ?? '').trim(),
      descripcion: this.optionalString(raw.descripcion),
      tipoDescuento: String(raw.tipoDescuento ?? 'PORCENTAJE'),
      descuento: Number(raw.descuento ?? 0),
      fechaInicio: this.toIsoOrNull(raw.fechaInicio),
      fechaCaducidad: this.toIsoRequired(raw.fechaCaducidad),
      activa: Boolean(raw.activa),
      estado: this.normalizeEstado(raw.estado),
      stockMaximo: this.optionalPositiveNumber(raw.stockMaximo),
      usosMaximos: this.optionalPositiveNumber(raw.usosMaximos),
      codigo: this.optionalString(raw.codigo),
      productoId: this.optionalNumber(raw.productoId),
    };
  }

  private normalizeEstado(value: unknown): PromocionEstado {
    const estado = String(value ?? 'BORRADOR').trim();
    return estado || 'BORRADOR';
  }

  private optionalString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }

  private optionalNumber(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private optionalPositiveNumber(value: unknown): number | null {
    const parsed = this.optionalNumber(value);
    return parsed === null ? null : Math.max(0, parsed);
  }

  private toIsoOrNull(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? new Date(normalized).toISOString() : null;
  }

  private toIsoRequired(value: unknown): string {
    return new Date(String(value ?? '')).toISOString();
  }

  private toDateTimeLocal(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  private attachBusinessSnapshot(promocion: Promocion): Promocion {
    return {
      ...promocion,
      negocioId: Number(promocion.negocioId ?? this.negocioId),
      negocio:
        promocion.negocio ??
        (this.negocio
          ? {
              id: this.negocio.id,
              nombre: this.negocio.nombre ?? `Negocio ${this.negocio.id}`,
              slug: this.negocio.slug ?? null,
              nickname: this.negocio.nickname ?? null,
              duenoId: this.negocio.duenoId ?? null,
              categoria: this.negocio.categoria ?? null,
              fotoPerfil: this.negocio.fotoPerfil ?? null,
              imagenNenufar: this.negocio.imagenNenufar ?? null,
              nenufarActivo: this.negocio.nenufarActivo ?? null,
              assetNenufar: this.negocio.assetNenufar ?? null,
              nenufarColor: this.negocio.nenufarColor ?? null,
              nenufarKey: this.negocio.nenufarKey ?? null,
              nenufarAsset: this.negocio.nenufarAsset ?? null,
            }
          : null),
    };
  }
}
