import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  EventEmitter,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import {
  clearFormApiErrors,
  getFieldError,
  mapApiError,
  setFormErrors,
} from '../../core/errors/form-error.utils';
import { AuthService } from '../../servicios/authService/auth.service';
import {
  AddListaCompraItemPayload,
  Lista,
  ListaCompraService,
} from '../../servicios/listaCompraServicio/lista-compra.service';
import { PondBusinessSnapshot } from '../../servicios/estanqueFeed/estanque-feed.service';
import {
  CreateProductoPayload,
  Producto,
  ProductoServiceService,
  SolicitudProducto,
} from '../../servicios/productoServicio/productoService.service';
import {
  ProductoFavorito,
  ProductoFavoritoService,
} from '../../servicios/productoFavoritoServicio/producto-favorito.service';
import {
  PendingProductSuggestionRequest,
  ReviewProductMetaService,
} from '../../servicios/reviewProductMeta/review-product-meta.service';

type CatalogoFormControlName = 'nombre' | 'descripcion' | 'precio' | 'codigoSKU' | 'foto';

const FOTO_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-catalogo-negocio-modal',
  standalone: true,
  imports: [],
  templateUrl: './catalogo-negocio-modal.component.html',
  styleUrl: './catalogo-negocio-modal.component.css',
})
export class CatalogoNegocioModalComponent implements OnChanges, OnDestroy {
  @Input() negocioId!: number;
  @Input() negocio: PondBusinessSnapshot | null = null;
  @Input() puedeGestionar = false;
  @Input() mostrarSugerencias = false;
  @Output() productoGuardado = new EventEmitter<Producto>();

  @ViewChild('fotoArchivoInput') fotoArchivoInput?: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  private readonly productoService = inject(ProductoServiceService);
  private readonly productoFavoritoService = inject(ProductoFavoritoService);
  private readonly listaCompraService = inject(ListaCompraService);
  private readonly authService = inject(AuthService);
  private readonly reviewProductMeta = inject(ReviewProductMetaService);

  readonly productos = signal<Producto[]>([]);
  readonly solicitudes = signal<PendingProductSuggestionRequest[]>([]);
  readonly productoDetalle = signal<Producto | null>(null);
  readonly cantidadDetalle = signal(1);
  readonly favoritosProductoIds = signal<ReadonlySet<number>>(new Set<number>());
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly favoritosCargando = signal(false);
  readonly favoritoPendienteId = signal<number | null>(null);
  readonly listaPendiente = signal(false);
  readonly errorMensaje = signal('');
  readonly exitoMensaje = signal('');
  readonly editorAbierto = signal(false);
  readonly productoEditandoId = signal<number | null>(null);
  readonly fotoPreviewUrl = signal<string | null>(null);
  readonly fotoArchivoError = signal('');

  readonly misListas = signal<Lista[]>([]);
  readonly listaSeleccionadaId = signal<number | null>(null);
  readonly crearListaDetalleAbierta = signal(false);
  readonly guardandoListaDetalle = signal(false);
  readonly nuevaListaDetalleNombre = signal('');
  readonly productosOrdenados = computed(() =>
    [...this.productos()].sort((left, right) =>
      left.nombre.localeCompare(right.nombre, 'es', { sensitivity: 'base' }),
    ),
  );

  private fotoObjectUrl: string | null = null;
  private detalleCierreTimeout: ReturnType<typeof setTimeout> | null = null;

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
    }

    if (
      ('negocioId' in changes ||
        'puedeGestionar' in changes ||
        'mostrarSugerencias' in changes) &&
      this.negocioId > 0
    ) {
      this.cargarSolicitudes();
    }
  }

  abrirCrearProducto(): void {
    if (!this.puedeGestionar) {
      return;
    }

    this.editorAbierto.set(true);
    this.productoEditandoId.set(null);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.limpiarFotoArchivo();
    this.form.reset({
      nombre: '',
      descripcion: '',
      precio: 0,
      codigoSKU: '',
      foto: '',
    });
  }

  onFotoArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!FOTO_TIPOS_PERMITIDOS.includes(file.type)) {
      this.fotoArchivoError.set('Solo se aceptan imágenes JPG, PNG o WEBP.');
      input.value = '';
      return;
    }

    this.fotoArchivoError.set('');
    this.revokeFotoObjectUrl();
    this.fotoObjectUrl = URL.createObjectURL(file);
    this.fotoPreviewUrl.set(this.fotoObjectUrl);
  }

  limpiarFotoArchivo(): void {
    this.revokeFotoObjectUrl();
    this.fotoPreviewUrl.set(null);
    this.fotoArchivoError.set('');

    if (this.fotoArchivoInput) {
      this.fotoArchivoInput.nativeElement.value = '';
    }
  }

  editarProducto(producto: Producto): void {
    if (!this.puedeGestionar) {
      return;
    }

    this.editorAbierto.set(true);
    this.productoEditandoId.set(producto.id);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.limpiarFotoArchivo();
    this.form.reset({
      nombre: producto.nombre,
      descripcion: String(producto.descripcion ?? ''),
      precio: Number(producto.precio ?? 0),
      codigoSKU: this.getProductCode(producto) ?? '',
      foto: this.getProductImage(producto),
    });
  }

  cancelarEdicion(): void {
    this.editorAbierto.set(false);
    this.productoEditandoId.set(null);
    this.limpiarFotoArchivo();
    this.form.reset({
      nombre: '',
      descripcion: '',
      precio: 0,
      codigoSKU: '',
      foto: '',
    });
    this.errorMensaje.set('');
  }

  ngOnDestroy(): void {
    this.limpiarDetalleCierreTimeout();
    this.revokeFotoObjectUrl();
  }

  private revokeFotoObjectUrl(): void {
    if (this.fotoObjectUrl) {
      URL.revokeObjectURL(this.fotoObjectUrl);
      this.fotoObjectUrl = null;
    }
  }

  abrirDetalleProducto(producto: Producto): void {
    if (!producto?.id) {
      return;
    }

    this.limpiarDetalleCierreTimeout();
    this.productoDetalle.set(producto);
    this.cantidadDetalle.set(1);
    this.listaPendiente.set(false);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.crearListaDetalleAbierta.set(false);
    this.nuevaListaDetalleNombre.set('');
    this.cargarMisListas();
  }

  private cargarMisListas(): void {
    if (!this.authService.isAuthenticated()) {
      this.misListas.set([]);
      this.listaSeleccionadaId.set(null);
      return;
    }

    this.listaCompraService.getMisListas().subscribe({
      next: (listas) => {
        this.misListas.set(listas);
        const porDefecto = listas.find((lista) => lista.tipo === 'COMPRA') ?? listas[0] ?? null;
        this.listaSeleccionadaId.set(porDefecto?.id ?? null);
      },
      error: () => this.misListas.set([]),
    });
  }

  seleccionarListaDetalle(value: string): void {
    this.listaSeleccionadaId.set(value ? Number(value) : null);
  }

  abrirCrearListaDetalle(): void {
    this.crearListaDetalleAbierta.set(true);
    this.nuevaListaDetalleNombre.set('');
  }

  actualizarNuevaListaDetalleNombre(value: string): void {
    this.nuevaListaDetalleNombre.set(value);
  }

  crearListaDesdeDetalle(): void {
    const nombre = this.nuevaListaDetalleNombre().trim();
    if (!nombre || this.guardandoListaDetalle()) {
      if (!nombre) {
        this.errorMensaje.set('El nombre de la lista es obligatorio.');
      }
      return;
    }

    this.guardandoListaDetalle.set(true);
    this.errorMensaje.set('');

    this.listaCompraService
      .crearLista({ nombre })
      .pipe(finalize(() => this.guardandoListaDetalle.set(false)))
      .subscribe({
        next: (lista) => {
          this.misListas.update((items) => [...items, { ...lista, itemsCount: 0 }]);
          this.listaSeleccionadaId.set(lista.id);
          this.crearListaDetalleAbierta.set(false);
        },
        error: (error: unknown) => {
          this.errorMensaje.set(getUserErrorMessage(error, 'La lista no se creó.'));
        },
      });
  }

  cerrarDetalleProducto(): void {
    this.limpiarDetalleCierreTimeout();
    this.productoDetalle.set(null);
    this.cantidadDetalle.set(1);
    this.listaPendiente.set(false);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
  }

  manejarTeclaProducto(event: KeyboardEvent, producto: Producto): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.abrirDetalleProducto(producto);
  }

  actualizarCantidadDetalle(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.cantidadDetalle.set(this.normalizarCantidad(input.value));
  }

  ajustarCantidadDetalle(delta: number): void {
    this.cantidadDetalle.update((value) => this.normalizarCantidad(value + delta));
  }

  esFavorito(producto: Producto | null | undefined): boolean {
    const productoId = Number(producto?.id ?? 0);

    if (!Number.isFinite(productoId) || productoId <= 0) {
      return false;
    }

    const favoritoBackend = this.readFavoriteFlag(producto);
    return favoritoBackend ?? this.favoritosProductoIds().has(productoId);
  }

  toggleFavorito(producto: Producto | null | undefined): void {
    const productoId = Number(producto?.id ?? 0);

    if (!producto || !Number.isFinite(productoId) || productoId <= 0) {
      return;
    }

    if (!this.authService.isAuthenticated()) {
      this.errorMensaje.set('Necesitas iniciar sesión para guardar productos favoritos.');
      this.exitoMensaje.set('');
      return;
    }

    if (this.favoritoPendienteId() === productoId) {
      return;
    }

    const favoritoActual = this.esFavorito(producto);
    const request$ = favoritoActual
      ? this.productoFavoritoService.quitarFavorito(productoId)
      : this.productoFavoritoService.marcarFavorito(productoId);

    this.favoritoPendienteId.set(productoId);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    request$
      .pipe(finalize(() => this.favoritoPendienteId.set(null)))
      .subscribe({
        next: () => {
          this.setFavoriteState(productoId, !favoritoActual);
          this.exitoMensaje.set(
            favoritoActual
              ? 'Producto quitado de favoritos.'
              : 'Producto guardado en favoritos.',
          );
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(error, 'El estado de favoritos del producto no se actualizó.'),
          );
        },
      });
  }

  anadirDetalleALista(): void {
    const producto = this.productoDetalle();
    const productoId = Number(producto?.id ?? 0);
    const listaId = this.listaSeleccionadaId();
    const listaElegida = this.misListas().find((lista) => lista.id === listaId) ?? null;

    if (!producto || !Number.isFinite(productoId) || productoId <= 0) {
      return;
    }

    if (!this.authService.isAuthenticated()) {
      this.errorMensaje.set('Necesitas iniciar sesión para añadir productos a una lista.');
      this.exitoMensaje.set('');
      return;
    }

    if (!listaId) {
      this.errorMensaje.set('Elige o crea primero una lista para guardar este producto.');
      return;
    }

    if (this.listaPendiente()) {
      return;
    }

    const cantidad = this.normalizarCantidad(this.cantidadDetalle());
    const payload: AddListaCompraItemPayload = { productoId, cantidad };
    const nombreLista = listaElegida?.nombre ?? 'la lista';
    this.listaPendiente.set(true);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    const continuarConDuplicado = (yaExiste: boolean) => {
      if (yaExiste) {
        this.errorMensaje.set(`Este producto ya está en "${nombreLista}".`);
        this.listaPendiente.set(false);
        return;
      }

      this.listaCompraService
        .addProductoALista(listaId, payload)
        .subscribe({
          next: () => {
            this.exitoMensaje.set(`Producto añadido a ${nombreLista}.`);
            this.misListas.update((items) =>
              items.map((item) =>
                item.id === listaId ? { ...item, itemsCount: (item.itemsCount ?? 0) + 1 } : item,
              ),
            );
            this.programarCierreDetalleProducto();
          },
          error: (error: unknown) => {
            this.errorMensaje.set(
              getUserErrorMessage(error, 'El producto no se añadió a la lista.'),
            );
            this.listaPendiente.set(false);
          },
        });
    };

    this.listaCompraService.getListaPorId(listaId).subscribe({
      next: (lista) => {
        continuarConDuplicado((lista.items ?? []).some((item) => Number(item.productoId ?? 0) === productoId));
      },
      error: () => continuarConDuplicado(false),
    });
  }

  private programarCierreDetalleProducto(): void {
    this.limpiarDetalleCierreTimeout();
    this.detalleCierreTimeout = setTimeout(() => {
      this.detalleCierreTimeout = null;
      this.cerrarDetalleProducto();
    }, 800);
  }

  private limpiarDetalleCierreTimeout(): void {
    if (this.detalleCierreTimeout) {
      clearTimeout(this.detalleCierreTimeout);
      this.detalleCierreTimeout = null;
    }
  }

  guardarProducto(): void {
    if (!this.puedeGestionar) {
      return;
    }

    if (this.guardando()) {
      return;
    }

    clearFormApiErrors(this.form);

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
          this.limpiarFotoArchivo();
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
          this.productoGuardado.emit(productoNormalizado);
        },
        error: (error: unknown) => {
          const apiError = mapApiError(error, 'El producto del catálogo no se guardó.');
          setFormErrors(this.form, apiError.fieldErrors);
          this.errorMensaje.set(
            apiError.message ||
              (Object.keys(apiError.fieldErrors).length
                ? ''
                : 'El producto del catálogo no se guardó.'),
          );
        },
      });
  }

  eliminarProducto(producto: Producto): void {
    if (!this.puedeGestionar) {
      return;
    }

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
          getUserErrorMessage(error, 'El producto no se eliminó del catálogo.'),
        );
      },
    });
  }

  actualizarCampoTextoProducto(
    control: Exclude<CatalogoFormControlName, 'precio'>,
    value: string,
  ): void {
    this.form.controls[control].setValue(value);
    this.form.controls[control].markAsDirty();
  }

  actualizarPrecioProducto(value: string): void {
    const normalized = value.trim() === '' ? null : Number(value);
    this.form.controls.precio.setValue(Number.isFinite(normalized) ? normalized : null);
    this.form.controls.precio.markAsDirty();
  }

  marcarProductoControlTocado(control: CatalogoFormControlName): void {
    this.form.controls[control].markAsTouched();
  }

  getProductoFieldError(control: CatalogoFormControlName): string {
    if (control === 'precio' && this.form.controls.precio.invalid) {
      return 'El precio no puede ser negativo.';
    }

    return getFieldError(this.form.controls[control]);
  }

  aprobarSolicitud(solicitud: PendingProductSuggestionRequest): void {
    if (!this.puedeGestionar || !solicitud?.localId || this.negocioId <= 0) {
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

    const backendId = this.getSolicitudBackendId(solicitud);
    if (solicitud.source === 'backend' && backendId) {
      this.productoService
        .aprobarSolicitud(backendId)
        .pipe(finalize(() => this.guardando.set(false)))
        .subscribe({
          next: () => {
            this.cargarCatalogo();
            this.cargarSolicitudes();
            this.exitoMensaje.set('Solicitud aprobada y convertida en producto.');
          },
          error: (error: unknown) => {
            this.errorMensaje.set(
              getUserErrorMessage(error, 'La solicitud de producto no se aprobó.'),
            );
          },
        });
      return;
    }

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
            getUserErrorMessage(error, 'La solicitud de producto no se aprobó.'),
          );
        },
      });
  }

  rechazarSolicitud(solicitud: PendingProductSuggestionRequest): void {
    if (!this.puedeGestionar || !solicitud?.localId) {
      return;
    }

    const backendId = this.getSolicitudBackendId(solicitud);
    if (solicitud.source === 'backend' && backendId) {
      this.guardando.set(true);
      this.errorMensaje.set('');
      this.exitoMensaje.set('');

      this.productoService
        .rechazarSolicitud(backendId)
        .pipe(finalize(() => this.guardando.set(false)))
        .subscribe({
          next: () => {
            this.cargarSolicitudes();
            this.exitoMensaje.set('Solicitud rechazada.');
          },
          error: (error: unknown) => {
            this.errorMensaje.set(
              getUserErrorMessage(error, 'La solicitud de producto no se rechazó.'),
            );
          },
        });
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

  getProductCode(producto: Partial<Producto> | null | undefined): string | null {
    if (!producto) {
      return null;
    }

    const codigo =
      String(producto.codigoProducto ?? '').trim() ||
      String(producto.codigoSKU ?? '').trim();

    return codigo || null;
  }

  getProductBusinessName(producto: Partial<Producto> | null | undefined): string {
    const negocioNombre = String(producto?.negocio?.nombre ?? '').trim();
    return negocioNombre || this.negocio?.nombre || 'Negocio';
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
          this.sincronizarFavoritosCatalogo(productos);
        },
        error: (error: unknown) => {
          this.productos.set([]);
          this.errorMensaje.set(
            getUserErrorMessage(error, 'El catálogo del negocio no se cargó.'),
          );
        },
      });
  }

  private sincronizarFavoritosCatalogo(productos: Producto[]): void {
    const favoriteFlags = new Map<number, boolean>();

    for (const producto of productos) {
      const productoId = Number(producto.id ?? 0);
      const favoriteFlag = this.readFavoriteFlag(producto);

      if (Number.isFinite(productoId) && productoId > 0 && favoriteFlag !== null) {
        favoriteFlags.set(productoId, favoriteFlag);
      }
    }

    if (favoriteFlags.size) {
      this.favoritosProductoIds.update((current) => {
        const next = new Set(current);
        favoriteFlags.forEach((favorito, productoId) => {
          if (favorito) {
            next.add(productoId);
          } else {
            next.delete(productoId);
          }
        });
        return next;
      });
    }

    const todosTraenFavorito =
      productos.length > 0 &&
      productos.every((producto) => this.readFavoriteFlag(producto) !== null);

    if (!todosTraenFavorito) {
      this.cargarFavoritosUsuario();
    }
  }

  private cargarFavoritosUsuario(): void {
    if (!this.authService.isAuthenticated()) {
      this.favoritosProductoIds.set(new Set<number>());
      return;
    }

    this.favoritosCargando.set(true);

    this.productoFavoritoService
      .getFavoritos()
      .pipe(finalize(() => this.favoritosCargando.set(false)))
      .subscribe({
        next: (favoritos) => {
          const ids = favoritos
            .map((favorito) => this.getFavoriteProductoId(favorito))
            .filter((id): id is number => id !== null && Number.isFinite(id) && id > 0);
          this.favoritosProductoIds.set(new Set(ids));
        },
        error: () => {
          this.favoritosProductoIds.set(new Set<number>());
        },
      });
  }

  private getFavoriteProductoId(favorito: ProductoFavorito): number | null {
    const productoId = Number(favorito.productoId ?? favorito.producto?.id ?? favorito.id ?? 0);
    return Number.isFinite(productoId) && productoId > 0 ? productoId : null;
  }

  private setFavoriteState(productoId: number, favorito: boolean): void {
    this.favoritosProductoIds.update((current) => {
      const next = new Set(current);
      if (favorito) {
        next.add(productoId);
      } else {
        next.delete(productoId);
      }
      return next;
    });

    this.productos.update((items) =>
      items.map((item) =>
        item.id === productoId
          ? {
              ...item,
              favorito,
              esFavorito: favorito,
              isFavorite: favorito,
              isFavorited: favorito,
            }
          : item,
      ),
    );

    const detalle = this.productoDetalle();
    if (detalle?.id === productoId) {
      this.productoDetalle.set({
        ...detalle,
        favorito,
        esFavorito: favorito,
        isFavorite: favorito,
        isFavorited: favorito,
      });
    }
  }

  private readFavoriteFlag(producto: Partial<Producto> | null | undefined): boolean | null {
    if (!producto) {
      return null;
    }

    const values = [
      producto.favorito,
      producto.esFavorito,
      producto.isFavorite,
      producto.isFavorited,
    ];

    for (const value of values) {
      const parsed = this.parseBoolean(value);
      if (parsed !== null) {
        return parsed;
      }
    }

    return null;
  }

  private parseBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'si', 'sí', 'yes'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no'].includes(normalized)) {
        return false;
      }
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
    }

    return null;
  }

  private normalizarCantidad(value: unknown): number {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private cargarSolicitudes(): void {
    if (!this.puedeGestionar || !this.mostrarSugerencias || this.negocioId <= 0) {
      this.solicitudes.set([]);
      return;
    }

    const solicitudesLocales = this.reviewProductMeta.listPendingRequests(this.negocioId);

    this.productoService
      .getSolicitudesProducto(this.negocioId)
      .pipe(catchError(() => of([])))
      .subscribe((solicitudesBackend) => {
        const solicitudesNormalizadas = solicitudesBackend
          .map((solicitud) => this.normalizeBackendSolicitud(solicitud))
          .filter((solicitud): solicitud is PendingProductSuggestionRequest => solicitud !== null);

        this.solicitudes.set(
          this.mergeSolicitudesPendientes(solicitudesNormalizadas, solicitudesLocales),
        );
      });
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
      codigoProducto:
        String(producto.codigoProducto ?? '').trim() ||
        String(payload.codigoSKU ?? '').trim() ||
        undefined,
      foto: this.getProductImage(producto) ?? payload.foto ?? null,
      negocioId: Number(producto.negocioId ?? this.negocioId),
    };
  }

  private normalizeBackendSolicitud(
    solicitud: SolicitudProducto,
  ): PendingProductSuggestionRequest | null {
    if (!solicitud || typeof solicitud !== 'object') {
      return null;
    }

    const nombre =
      this.cleanText(solicitud.nombre) ||
      this.cleanText(solicitud.nombreSugerido) ||
      this.cleanText(solicitud.productoNombre) ||
      this.cleanText(solicitud.servicioNombre);

    if (!nombre) {
      return null;
    }

    const estado = this.cleanText(solicitud.estado) || 'pendiente';
    const estadoNormalizado = estado.toLowerCase();
    if (
      estadoNormalizado &&
      estadoNormalizado !== 'pendiente' &&
      estadoNormalizado !== 'pending'
    ) {
      return null;
    }

    const precio = Number(solicitud.precioSugerido ?? solicitud.precio ?? NaN);
    const resena = solicitud.resena ?? solicitud.review ?? null;
    const usuario = solicitud.usuario ?? null;
    const backendId = solicitud.id;
    const reviewId = Number(
      solicitud.resenaId ?? solicitud.reviewId ?? resena?.id ?? 0,
    );
    const usuarioId = Number(solicitud.usuarioId ?? usuario?.id ?? NaN);
    const usuarioNombre =
      this.cleanText(solicitud.usuarioNombre) ||
      this.cleanText(usuario?.nombre) ||
      this.cleanText(usuario?.username) ||
      this.cleanText(usuario?.email);

    return {
      id: backendId,
      localId: `backend-${backendId}`,
      reviewId: Number.isFinite(reviewId) ? reviewId : 0,
      negocioId: Number(solicitud.negocioId ?? this.negocioId),
      createdAt:
        this.cleanText(solicitud.creadoEn) ||
        this.cleanText(solicitud.createdAt) ||
        this.cleanText(solicitud.actualizadoEn) ||
        new Date().toISOString(),
      nombre,
      ...(Number.isFinite(precio) ? { precioSugerido: precio } : {}),
      ...(this.cleanText(solicitud.descripcion)
        ? { descripcion: this.cleanText(solicitud.descripcion) }
        : {}),
      estado,
      reviewContenido:
        this.cleanText(resena?.contenido) ||
        this.cleanText(resena?.texto) ||
        this.cleanText(resena?.comentario) ||
        null,
      usuarioId: Number.isFinite(usuarioId) ? usuarioId : null,
      usuarioNombre: usuarioNombre || null,
      source: 'backend',
    };
  }

  private mergeSolicitudesPendientes(
    backend: PendingProductSuggestionRequest[],
    locales: PendingProductSuggestionRequest[],
  ): PendingProductSuggestionRequest[] {
    const seen = new Set<string>();
    const output: PendingProductSuggestionRequest[] = [];

    for (const solicitud of [...backend, ...locales]) {
      const key =
        solicitud.source === 'backend'
          ? `backend:${solicitud.id ?? solicitud.localId}`
          : `local:${solicitud.localId}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      output.push(solicitud);
    }

    return output.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private getSolicitudBackendId(
    solicitud: PendingProductSuggestionRequest,
  ): number | string | null {
    if (solicitud.id != null && String(solicitud.id).trim()) {
      return solicitud.id;
    }

    const rawLocalId = String(solicitud.localId ?? '');
    return rawLocalId.startsWith('backend-')
      ? rawLocalId.replace(/^backend-/, '')
      : null;
  }

  private cleanText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private truncate(value: string, maxLength: number): string {
    const normalized = String(value ?? '').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }
}
