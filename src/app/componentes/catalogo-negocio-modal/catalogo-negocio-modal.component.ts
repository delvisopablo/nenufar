import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import { PondBusinessSnapshot } from '../../servicios/estanqueFeed/estanque-feed.service';
import {
  CreateProductoPayload,
  Producto,
  ProductoServiceService,
} from '../../servicios/productoServicio/productoService.service';
import {
  PendingProductSuggestionRequest,
  ReviewProductMetaService,
} from '../../servicios/reviewProductMeta/review-product-meta.service';

@Component({
  selector: 'app-catalogo-negocio-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './catalogo-negocio-modal.component.html',
  styleUrl: './catalogo-negocio-modal.component.css',
})
export class CatalogoNegocioModalComponent implements OnChanges {
  @Input() negocioId!: number;
  @Input() negocio: PondBusinessSnapshot | null = null;

  private readonly fb = inject(FormBuilder);
  private readonly productoService = inject(ProductoServiceService);
  private readonly reviewProductMeta = inject(ReviewProductMetaService);

  readonly productos = signal<Producto[]>([]);
  readonly solicitudes = signal<PendingProductSuggestionRequest[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly errorMensaje = signal('');
  readonly exitoMensaje = signal('');
  readonly editorAbierto = signal(false);
  readonly productoEditandoId = signal<number | null>(null);
  readonly productosOrdenados = computed(() =>
    [...this.productos()].sort((left, right) =>
      left.nombre.localeCompare(right.nombre, 'es', { sensitivity: 'base' }),
    ),
  );

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(191)]],
    descripcion: [''],
    precio: [0, [Validators.required, Validators.min(0)]],
    codigoSKU: [''],
    foto: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if ('negocioId' in changes && this.negocioId > 0) {
      this.cargarCatalogo();
      this.cargarSolicitudes();
    }
  }

  abrirCrearProducto(): void {
    this.editorAbierto.set(true);
    this.productoEditandoId.set(null);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.form.reset({
      nombre: '',
      descripcion: '',
      precio: 0,
      codigoSKU: '',
      foto: '',
    });
  }

  editarProducto(producto: Producto): void {
    this.editorAbierto.set(true);
    this.productoEditandoId.set(producto.id);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.form.reset({
      nombre: producto.nombre,
      descripcion: String(producto.descripcion ?? ''),
      precio: Number(producto.precio ?? 0),
      codigoSKU: String(producto.codigoSKU ?? ''),
      foto: this.getProductImage(producto),
    });
  }

  cancelarEdicion(): void {
    this.editorAbierto.set(false);
    this.productoEditandoId.set(null);
    this.form.reset({
      nombre: '',
      descripcion: '',
      precio: 0,
      codigoSKU: '',
      foto: '',
    });
    this.errorMensaje.set('');
  }

  guardarProducto(): void {
    if (this.guardando()) {
      return;
    }

    if (this.form.invalid || this.negocioId <= 0) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    const editandoId = this.productoEditandoId();
    const request$ = editandoId
      ? this.productoService.update(editandoId, payload)
      : this.productoService.create(this.negocioId, payload);

    this.guardando.set(true);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    request$
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (producto) => {
          const productoNormalizado = this.normalizeLocalProduct(producto, payload, editandoId ?? undefined);
          this.productos.update((items) =>
            editandoId
              ? items.map((item) => (item.id === editandoId ? productoNormalizado : item))
              : [productoNormalizado, ...items.filter((item) => item.id !== productoNormalizado.id)],
          );
          this.editorAbierto.set(false);
          this.productoEditandoId.set(null);
          this.form.reset({
            nombre: '',
            descripcion: '',
            precio: 0,
            codigoSKU: '',
            foto: '',
          });
          this.exitoMensaje.set(
            editandoId
              ? 'Producto actualizado correctamente.'
              : 'Producto añadido al catálogo.',
          );
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido guardar el producto.'),
          );
        },
      });
  }

  eliminarProducto(producto: Producto): void {
    if (!producto?.id) {
      return;
    }

    const ok = confirm(`¿Eliminar "${producto.nombre}" del catálogo?`);
    if (!ok) {
      return;
    }

    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    this.productoService.remove(producto.id).subscribe({
      next: () => {
        this.productos.update((items) => items.filter((item) => item.id !== producto.id));
        this.exitoMensaje.set('Producto eliminado del catálogo.');
      },
      error: (error: unknown) => {
        this.errorMensaje.set(
          getUserErrorMessage(error, 'No hemos podido eliminar el producto.'),
        );
      },
    });
  }

  aprobarSolicitud(solicitud: PendingProductSuggestionRequest): void {
    if (!solicitud?.localId || this.negocioId <= 0) {
      return;
    }

    const payload: CreateProductoPayload = {
      nombre: solicitud.nombre,
      descripcion: solicitud.descripcion ?? undefined,
      precio: Number(solicitud.precioSugerido ?? 0),
    };

    this.guardando.set(true);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    this.productoService
      .create(this.negocioId, payload)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (producto) => {
          this.reviewProductMeta.markSuggestionApproved(solicitud.localId);
          this.cargarSolicitudes();
          this.productos.update((items) => [
            this.normalizeLocalProduct(producto, payload),
            ...items.filter((item) => item.id !== producto.id),
          ]);
          this.exitoMensaje.set('Solicitud aprobada y convertida en producto.');
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido aprobar la solicitud.'),
          );
        },
      });
  }

  rechazarSolicitud(solicitud: PendingProductSuggestionRequest): void {
    if (!solicitud?.localId) {
      return;
    }

    this.reviewProductMeta.markSuggestionRejected(solicitud.localId);
    this.cargarSolicitudes();
    this.exitoMensaje.set('Solicitud rechazada.');
  }

  formatPrice(value: number | null | undefined): string {
    return Number.isFinite(Number(value))
      ? `${Number(value).toFixed(2)} €`
      : 'Precio pendiente';
  }

  getProductImage(producto: Partial<Producto> | null | undefined): string | null {
    if (!producto) {
      return null;
    }

    const image =
      String(producto.foto ?? '').trim() ||
      String(producto.imagen ?? '').trim() ||
      String(producto.imageUrl ?? '').trim() ||
      '';

    return image || null;
  }

  getSolicitudContexto(solicitud: PendingProductSuggestionRequest): string {
    const partes = [
      solicitud.usuarioNombre ? `Sugerido por ${solicitud.usuarioNombre}` : '',
      solicitud.reviewContenido ? `Reseña: ${this.truncate(solicitud.reviewContenido, 88)}` : '',
    ].filter(Boolean);

    return partes.join(' · ');
  }

  private cargarCatalogo(): void {
    if (this.negocioId <= 0) {
      return;
    }

    this.cargando.set(true);
    this.errorMensaje.set('');

    this.productoService
      .listByNegocio(this.negocioId)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (productos) => {
          this.productos.set(productos);
        },
        error: (error: unknown) => {
          this.productos.set([]);
          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido cargar el catálogo.'),
          );
        },
      });
  }

  private cargarSolicitudes(): void {
    this.solicitudes.set(this.reviewProductMeta.listPendingRequests(this.negocioId));
  }

  private buildPayload(): CreateProductoPayload {
    const raw = this.form.getRawValue();
    const nombre = String(raw.nombre ?? '').trim();
    const descripcion = String(raw.descripcion ?? '').trim();
    const codigoSKU = String(raw.codigoSKU ?? '').trim();
    const foto = String(raw.foto ?? '').trim();

    return {
      nombre,
      precio: Number(raw.precio ?? 0),
      ...(descripcion ? { descripcion } : {}),
      ...(codigoSKU ? { codigoSKU } : {}),
      ...(foto ? { foto } : {}),
    };
  }

  private normalizeLocalProduct(
    producto: Producto,
    payload: CreateProductoPayload,
    fallbackId?: number,
  ): Producto {
    return {
      ...producto,
      id: Number(producto.id ?? fallbackId ?? Date.now()),
      nombre: producto.nombre || payload.nombre,
      precio: Number(producto.precio ?? payload.precio ?? 0),
      descripcion:
        String(producto.descripcion ?? '').trim() ||
        String(payload.descripcion ?? '').trim() ||
        undefined,
      codigoSKU:
        String(producto.codigoSKU ?? '').trim() ||
        String(payload.codigoSKU ?? '').trim() ||
        undefined,
      foto: this.getProductImage(producto) ?? payload.foto ?? null,
      negocioId: Number(producto.negocioId ?? this.negocioId),
    };
  }

  private truncate(value: string, maxLength: number): string {
    const normalized = String(value ?? '').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }
}
