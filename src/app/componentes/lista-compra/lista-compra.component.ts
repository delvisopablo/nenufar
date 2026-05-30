import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';
import { AuthService } from '../../servicios/authService/auth.service';
import {
  AddListaCompraItemPayload,
  ListaCompraItem,
  ListaCompraService,
  UpdateListaCompraItemPayload,
} from '../../servicios/listaCompraServicio/lista-compra.service';
import {
  Producto,
  ProductoBusqueda,
  ProductoServiceService,
} from '../../servicios/productoServicio/productoService.service';
import {
  ProductoFavorito,
  ProductoFavoritoService,
} from '../../servicios/productoFavoritoServicio/producto-favorito.service';

type ManualFormControlName = 'nombre' | 'cantidad' | 'nota';
type ListaVista = 'pendientes' | 'completados' | 'favoritos';

@Component({
  selector: 'app-lista-compra',
  standalone: true,
  imports: [RouterLink, EstanqueBackgroundComponent],
  templateUrl: './lista-compra.component.html',
  styleUrl: './lista-compra.component.css',
})
export class ListaCompraComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly listaCompraService = inject(ListaCompraService);
  private readonly productoFavoritoService = inject(ProductoFavoritoService);
  private readonly productoService = inject(ProductoServiceService);
  private readonly authService = inject(AuthService);

  private busquedaTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly cargando = signal(true);
  readonly sesionListaResuelta = signal(false);
  readonly guardandoManual = signal(false);
  readonly limpiandoCompletados = signal(false);
  readonly itemPendienteId = signal<number | string | null>(null);
  readonly favoritoPendienteProductoId = signal<number | null>(null);
  readonly listaPendienteProductoId = signal<number | null>(null);
  readonly errorMensaje = signal('');
  readonly exitoMensaje = signal('');
  readonly authNotice = signal('');
  readonly lista = signal<ListaCompraItem[]>([]);
  readonly favoritos = signal<ProductoFavorito[]>([]);
  readonly busquedaQuery = signal('');
  readonly busquedaResultados = signal<ProductoBusqueda[]>([]);
  readonly buscando = signal(false);
  readonly busquedaProductoPendienteId = signal<number | null>(null);
  readonly vistaActiva = signal<ListaVista>('pendientes');
  readonly estaAutenticado = computed(() =>
    this.authService.authStatus() === 'authenticated' ||
    Boolean(this.authService.usuarioActual()),
  );
  readonly favoritosProductoIds = computed(() => {
    const ids = this.favoritos()
      .map((favorito) => this.getFavoriteProductoId(favorito))
      .filter((productoId): productoId is number => Boolean(productoId));
    return new Set(ids);
  });
  readonly pendientes = computed(() =>
    this.lista().filter((item) => !this.isCompleted(item)),
  );
  readonly completados = computed(() =>
    this.lista().filter((item) => this.isCompleted(item)),
  );

  readonly manualForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(191)]],
    cantidad: [1, [Validators.required, Validators.min(1)]],
    nota: [''],
  });

  ngOnInit(): void {
    this.cargarProductosCatalogo('');
    this.inicializarSesionPrivada();
  }

  ngOnDestroy(): void {
    if (this.busquedaTimeout) {
      clearTimeout(this.busquedaTimeout);
    }
  }

  cargarDatos(): void {
    if (!this.puedeUsarPrivado('cargar Nenulista')) {
      this.cargando.set(false);
      this.sesionListaResuelta.set(true);
      return;
    }

    this.cargando.set(true);
    this.errorMensaje.set('');
    this.authNotice.set('');

    forkJoin({
      lista: this.listaCompraService.getLista().pipe(
        catchError((error: unknown) => {
          this.gestionarErrorPrivado(error, 'No hemos podido cargar tu Nenulista.');
          return of([] as ListaCompraItem[]);
        }),
      ),
      favoritos: this.productoFavoritoService.getFavoritos().pipe(
        catchError((error: unknown) => {
          this.gestionarErrorPrivado(error, 'No hemos podido cargar tus productos favoritos.');
          return of([] as ProductoFavorito[]);
        }),
      ),
    })
      .pipe(finalize(() => {
        this.cargando.set(false);
        this.sesionListaResuelta.set(true);
      }))
      .subscribe(({ lista, favoritos }) => {
        this.lista.set(lista);
        this.favoritos.set(this.deduplicarFavoritos(favoritos));
      });
  }

  anadirManual(): void {
    if (!this.puedeUsarPrivado('añadir producto manual')) {
      return;
    }

    if (this.guardandoManual()) {
      return;
    }

    if (this.manualForm.invalid) {
      this.manualForm.markAllAsTouched();
      return;
    }

    const raw = this.manualForm.getRawValue();
    const nombre = String(raw.nombre ?? '').trim();
    const nota = String(raw.nota ?? '').trim();
    const cantidad = this.normalizarCantidad(raw.cantidad);
    const payload: AddListaCompraItemPayload = {
      nombreManual: nombre,
      cantidad,
      ...(nota ? { nota } : {}),
    };

    this.guardandoManual.set(true);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    this.listaCompraService
      .addItem(payload)
      .pipe(finalize(() => this.guardandoManual.set(false)))
      .subscribe({
        next: (item) => {
          this.lista.update((items) => [item, ...items]);
          this.manualForm.reset({ nombre: '', cantidad: 1, nota: '' });
          this.exitoMensaje.set('Producto añadido a tu lista');
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido añadir el producto manual.'),
          );
        },
      });
  }

  actualizarManualTexto(control: 'nombre' | 'nota', value: string): void {
    this.manualForm.controls[control].setValue(value);
    this.manualForm.controls[control].markAsDirty();
  }

  actualizarManualCantidad(value: string): void {
    const normalized = value.trim() === '' ? null : Number(value);
    this.manualForm.controls.cantidad.setValue(Number.isFinite(normalized) ? normalized : null);
    this.manualForm.controls.cantidad.markAsDirty();
  }

  marcarManualTocado(control: ManualFormControlName): void {
    this.manualForm.controls[control].markAsTouched();
  }

  actualizarCantidad(item: ListaCompraItem, event: Event): void {
    if (!this.puedeUsarPrivado('actualizar cantidad')) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const cantidad = this.normalizarCantidad(input.value);

    if (cantidad === this.getItemQuantity(item)) {
      return;
    }

    this.guardarItem(item, { cantidad }, 'Cantidad actualizada.');
  }

  toggleCompletado(item: ListaCompraItem): void {
    if (!this.puedeUsarPrivado('marcar completado')) {
      return;
    }

    this.guardarItem(
      item,
      { completado: !this.isCompleted(item) },
      this.isCompleted(item) ? 'Producto marcado como pendiente.' : 'Producto marcado como completado.',
    );
  }

  eliminarItem(item: ListaCompraItem): void {
    if (!this.puedeUsarPrivado('eliminar producto')) {
      return;
    }

    if (this.itemPendienteId() === item.id) {
      return;
    }

    this.itemPendienteId.set(item.id);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    this.listaCompraService
      .deleteItem(item.id)
      .pipe(finalize(() => this.itemPendienteId.set(null)))
      .subscribe({
        next: () => {
          this.lista.update((items) => items.filter((current) => current.id !== item.id));
          this.exitoMensaje.set('Producto eliminado de tu lista.');
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido eliminar ese producto.'),
          );
        },
      });
  }

  limpiarCompletados(): void {
    if (!this.puedeUsarPrivado('limpiar completados')) {
      return;
    }

    if (this.limpiandoCompletados() || !this.completados().length) {
      return;
    }

    this.limpiandoCompletados.set(true);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    this.listaCompraService
      .clearCompletados()
      .pipe(finalize(() => this.limpiandoCompletados.set(false)))
      .subscribe({
        next: () => {
          this.lista.update((items) => items.filter((item) => !this.isCompleted(item)));
          this.exitoMensaje.set('Productos completados eliminados.');
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido limpiar los completados.'),
          );
        },
      });
  }

  anadirFavoritoALista(favorito: ProductoFavorito): void {
    if (!this.puedeUsarPrivado('añadir favorito a Nenulista')) {
      return;
    }

    const productoId = this.getFavoriteProductoId(favorito);

    if (!productoId || this.listaPendienteProductoId() === productoId) {
      return;
    }

    const producto = this.getFavoriteProduct(favorito);
    const negocioId = Number(
      producto?.negocioId ??
        producto?.negocio?.id ??
        favorito.negocio?.id ??
        0,
    );
    const payload: AddListaCompraItemPayload = {
      productoId,
      cantidad: 1,
      ...(Number.isFinite(negocioId) && negocioId > 0 ? { negocioId } : {}),
    };

    this.listaPendienteProductoId.set(productoId);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    this.listaCompraService
      .addItem(payload)
      .pipe(finalize(() => this.listaPendienteProductoId.set(null)))
      .subscribe({
        next: (item) => {
          this.upsertListaItem(item);
          this.exitoMensaje.set('Producto añadido a tu lista');
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido añadir el favorito a tu lista.'),
          );
        },
      });
  }

  quitarFavorito(favorito: ProductoFavorito): void {
    if (!this.puedeUsarPrivado('quitar favorito')) {
      return;
    }

    const productoId = this.getFavoriteProductoId(favorito);

    if (!productoId || this.favoritoPendienteProductoId() === productoId) {
      return;
    }

    this.favoritoPendienteProductoId.set(productoId);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    this.productoFavoritoService
      .quitarFavorito(productoId)
      .pipe(finalize(() => this.favoritoPendienteProductoId.set(null)))
      .subscribe({
        next: () => {
          this.favoritos.update((items) =>
            items.filter((item) => this.getFavoriteProductoId(item) !== productoId),
          );
          this.exitoMensaje.set('Producto quitado de favoritos.');
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            this.obtenerMensajeErrorPrivado(error, 'No hemos podido quitar el favorito.'),
          );
        },
      });
  }

  setVistaActiva(vista: ListaVista): void {
    this.vistaActiva.set(vista);
  }

  getItemProduct(item: ListaCompraItem): Producto | null {
    return item.producto && typeof item.producto === 'object' ? item.producto : null;
  }

  getItemName(item: ListaCompraItem): string {
    return (
      this.cleanText(this.getItemProduct(item)?.nombre) ||
      this.cleanText(item.nombre) ||
      'Producto sin nombre'
    );
  }

  getItemBusiness(item: ListaCompraItem): string {
    return (
      this.cleanText(item.negocio?.nombre) ||
      this.cleanText(this.getItemProduct(item)?.negocio?.nombre) ||
      this.cleanText(item['negocioNombre']) ||
      'Añadido manualmente'
    );
  }

  getItemImage(item: ListaCompraItem): string | null {
    const producto = this.getItemProduct(item);
    const image =
      this.cleanText(producto?.foto) ||
      this.cleanText(producto?.imagen) ||
      this.cleanText(producto?.imageUrl) ||
      this.cleanText(item.foto) ||
      this.cleanText(item.imagen) ||
      this.cleanText(item.imageUrl);

    return image || null;
  }

  getItemQuantity(item: ListaCompraItem): number {
    return this.normalizarCantidad(item.cantidad);
  }

  getItemPrice(item: ListaCompraItem): number | null {
    const producto = this.getItemProduct(item);
    const value = producto?.precio ?? item.precio;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  isCompleted(item: ListaCompraItem): boolean {
    const estado = this.cleanText(item.estado).toLowerCase();
    return Boolean(
      item.completado ??
        item.completada ??
        ['completado', 'completada', 'complete', 'completed', 'done'].includes(estado),
    );
  }

  getFavoriteProduct(favorito: ProductoFavorito): Producto | null {
    if (favorito.producto && typeof favorito.producto === 'object') {
      return favorito.producto;
    }

    const productoId = this.getFavoriteProductoId(favorito);
    const nombre = this.cleanText(favorito['nombre']);

    if (!productoId || !nombre) {
      return null;
    }

    const precio = Number(favorito['precio'] ?? 0);
    return {
      id: productoId,
      nombre,
      precio: Number.isFinite(precio) ? precio : 0,
      descripcion: this.cleanText(favorito['descripcion']) || undefined,
      foto: this.cleanText(favorito['foto']) || null,
      imagen: this.cleanText(favorito['imagen']) || null,
      imageUrl: this.cleanText(favorito['imageUrl']) || null,
    };
  }

  getFavoriteProductoId(favorito: ProductoFavorito): number | null {
    const productoId = Number(favorito.productoId ?? favorito.producto?.id ?? favorito.id ?? 0);
    return Number.isFinite(productoId) && productoId > 0 ? productoId : null;
  }

  getFavoriteTrack(favorito: ProductoFavorito, index: number): string {
    return String(this.getFavoriteProductoId(favorito) ?? favorito.id ?? `favorito-${index}`);
  }

  getProductoNegocio(producto: ProductoBusqueda | Producto): string {
    return (
      this.cleanText(producto.negocio?.nombre) ||
      this.cleanText(producto['negocioNombre']) ||
      'Negocio local'
    );
  }

  esFavoritoProducto(producto: ProductoBusqueda | Producto): boolean {
    const productoId = Number(producto.id ?? 0);
    return Number.isFinite(productoId) && this.favoritosProductoIds().has(productoId);
  }

  toggleFavoritoProducto(producto: ProductoBusqueda): void {
    if (!this.puedeUsarPrivado('actualizar favorito')) {
      return;
    }

    const productoId = Number(producto.id ?? 0);
    if (!productoId || this.favoritoPendienteProductoId() === productoId) {
      return;
    }

    this.favoritoPendienteProductoId.set(productoId);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    const request$ = this.esFavoritoProducto(producto)
      ? this.productoFavoritoService.quitarFavorito(productoId)
      : this.productoFavoritoService.marcarFavorito(productoId);

    request$
      .pipe(finalize(() => this.favoritoPendienteProductoId.set(null)))
      .subscribe({
        next: (favorito) => {
          if (this.esFavoritoProducto(producto)) {
            this.favoritos.update((items) =>
              items.filter((item) => this.getFavoriteProductoId(item) !== productoId),
            );
            this.exitoMensaje.set('Producto quitado de favoritos.');
            return;
          }

          const favoritoNormalizado = this.normalizarFavoritoDesdeProducto(producto, favorito);
          this.favoritos.update((items) =>
            this.deduplicarFavoritos([favoritoNormalizado, ...items]),
          );
          this.exitoMensaje.set('Producto guardado en favoritos.');
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            this.obtenerMensajeErrorPrivado(error, 'No hemos podido actualizar favoritos.'),
          );
        },
      });
  }

  getFavoriteName(favorito: ProductoFavorito): string {
    return (
      this.cleanText(this.getFavoriteProduct(favorito)?.nombre) ||
      this.cleanText(favorito['nombre']) ||
      'Producto favorito'
    );
  }

  getFavoriteBusiness(favorito: ProductoFavorito): string {
    return (
      this.cleanText(this.getFavoriteProduct(favorito)?.negocio?.nombre) ||
      this.cleanText(favorito.negocio?.nombre) ||
      this.cleanText(favorito['negocioNombre']) ||
      'Negocio'
    );
  }

  getFavoriteImage(favorito: ProductoFavorito): string | null {
    const producto = this.getFavoriteProduct(favorito);
    const image =
      this.cleanText(producto?.foto) ||
      this.cleanText(producto?.imagen) ||
      this.cleanText(producto?.imageUrl) ||
      this.cleanText(favorito['foto']) ||
      this.cleanText(favorito['imagen']) ||
      this.cleanText(favorito['imageUrl']);

    return image || null;
  }

  getFavoritePrice(favorito: ProductoFavorito): number | null {
    const producto = this.getFavoriteProduct(favorito);
    const value = producto?.precio ?? favorito['precio'];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  formatPrice(value: unknown): string {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed.toFixed(2)} €` : 'Precio pendiente';
  }

  onBusqueda(q: string): void {
    this.busquedaQuery.set(q);
    if (this.busquedaTimeout) {
      clearTimeout(this.busquedaTimeout);
    }
    this.buscando.set(true);
    this.busquedaTimeout = setTimeout(() => {
      this.cargarProductosCatalogo(q.trim());
    }, 350);
  }

  anadirBusquedaALista(producto: ProductoBusqueda): void {
    if (!this.puedeUsarPrivado('añadir producto desde catálogo')) {
      return;
    }

    const productoId = Number(producto.id ?? 0);
    if (!productoId || this.busquedaProductoPendienteId() === productoId) {
      return;
    }

    const negocioId = Number(producto.negocioId ?? producto.negocio?.id ?? 0);
    const payload: AddListaCompraItemPayload = {
      productoId,
      cantidad: 1,
      ...(Number.isFinite(negocioId) && negocioId > 0 ? { negocioId } : {}),
    };

    this.busquedaProductoPendienteId.set(productoId);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    this.listaCompraService
      .addItem(payload)
      .pipe(finalize(() => this.busquedaProductoPendienteId.set(null)))
      .subscribe({
        next: (item) => {
          this.upsertListaItem(item);
          this.exitoMensaje.set(`${producto.nombre} añadido a Mi Nenulista`);
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            this.obtenerMensajeErrorPrivado(error, 'No hemos podido añadir el producto.'),
          );
        },
      });
  }

  getBusquedaImage(producto: ProductoBusqueda): string | null {
    const image =
      this.cleanText(producto.foto) ||
      this.cleanText(producto.imagen) ||
      this.cleanText(producto.imageUrl);
    return image || null;
  }

  private guardarItem(
    item: ListaCompraItem,
    payload: UpdateListaCompraItemPayload,
    successMessage: string,
  ): void {
    if (!this.puedeUsarPrivado('guardar item')) {
      return;
    }

    if (this.itemPendienteId() === item.id) {
      return;
    }

    this.itemPendienteId.set(item.id);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    this.listaCompraService
      .updateItem(item.id, payload)
      .pipe(finalize(() => this.itemPendienteId.set(null)))
      .subscribe({
        next: (updated) => {
          this.upsertListaItem({ ...item, ...payload, ...updated });
          this.exitoMensaje.set(successMessage);
        },
        error: (error: unknown) => {
          this.errorMensaje.set(
            this.obtenerMensajeErrorPrivado(error, 'No hemos podido actualizar tu Nenulista.'),
          );
        },
      });
  }

  private inicializarSesionPrivada(): void {
    const forceRemote = !this.authService.isSessionResolved();
    this.cargando.set(true);
    this.sesionListaResuelta.set(false);

    this.authService.hydrateSession({ forceRemote }).subscribe({
      next: (usuario) => {
        if (usuario || this.estaAutenticado()) {
          this.authNotice.set('');
          this.cargarDatos();
          return;
        }

        this.lista.set([]);
        this.favoritos.set([]);
        this.cargando.set(false);
        this.sesionListaResuelta.set(true);
        this.authNotice.set('Inicia sesión para guardar tu Nenulista.');
      },
      error: (error: unknown) => {
        this.registrarAuthWarning('No se pudo resolver la sesión de Nenulista.', error);
        this.lista.set([]);
        this.favoritos.set([]);
        this.cargando.set(false);
        this.sesionListaResuelta.set(true);
        this.authNotice.set('Inicia sesión para guardar tu Nenulista.');
      },
    });
  }

  private cargarProductosCatalogo(q: string): void {
    this.buscando.set(true);
    this.productoService.buscarProductos(q, 30).subscribe({
      next: (resultado) => {
        this.busquedaResultados.set(resultado.items ?? []);
        this.buscando.set(false);
      },
      error: (error: unknown) => {
        this.registrarAuthWarning('No hemos podido cargar productos para Nenulista.', error);
        this.busquedaResultados.set([]);
        this.buscando.set(false);
      },
    });
  }

  private puedeUsarPrivado(accion: string): boolean {
    if (this.estaAutenticado()) {
      return true;
    }

    this.errorMensaje.set('');
    this.authNotice.set('Inicia sesión para guardar tu Nenulista.');
    this.registrarAuthWarning(`Acción privada bloqueada sin sesión: ${accion}.`);
    return false;
  }

  private gestionarErrorPrivado(error: unknown, fallback: string): void {
    const mensaje = this.obtenerMensajeErrorPrivado(error, fallback);
    if (!this.esErrorAuth(error)) {
      this.errorMensaje.set(mensaje);
    }
  }

  private obtenerMensajeErrorPrivado(error: unknown, fallback: string): string {
    if (this.esErrorAuth(error)) {
      this.authService.clearStoredAuth();
      this.authNotice.set('Inicia sesión para guardar tu Nenulista.');
      this.registrarAuthWarning('Sesión no disponible en Nenulista.', error);
      return '';
    }

    return getUserErrorMessage(error, fallback);
  }

  private esErrorAuth(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
  }

  private registrarAuthWarning(message: string, error?: unknown): void {
    if (!environment.production) {
      console.warn(`[Nenulista] ${message}`, error ?? '');
    }
  }

  private upsertListaItem(item: ListaCompraItem): void {
    this.lista.update((items) => {
      const exists = items.some((current) => current.id === item.id);
      return exists
        ? items.map((current) => (current.id === item.id ? item : current))
        : [item, ...items];
      });
  }

  private deduplicarFavoritos(favoritos: ProductoFavorito[]): ProductoFavorito[] {
    const vistos = new Set<number>();
    const resultado: ProductoFavorito[] = [];

    for (const favorito of favoritos) {
      const productoId = this.getFavoriteProductoId(favorito);
      if (!productoId || vistos.has(productoId)) {
        continue;
      }

      vistos.add(productoId);
      resultado.push(favorito);
    }

    return resultado;
  }

  private normalizarFavoritoDesdeProducto(
    producto: ProductoBusqueda,
    favorito: unknown,
  ): ProductoFavorito {
    const response = favorito && typeof favorito === 'object'
      ? favorito as ProductoFavorito
      : {};

    return {
      ...response,
      productoId: Number(producto.id),
      producto: response.producto ?? producto,
      negocio: response.negocio ?? producto.negocio ?? null,
    };
  }

  private normalizarCantidad(value: unknown): number {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private cleanText(value: unknown): string {
    return String(value ?? '').trim();
  }
}
