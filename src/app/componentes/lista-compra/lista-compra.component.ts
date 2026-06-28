import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import {
  clearFormApiErrors,
  getFieldError,
  mapApiError,
  setFormErrors,
} from '../../core/errors/form-error.utils';
import {
  NENUFAR_OPTIONS,
  resolveBusinessNenufarAsset,
  resolveNenufarAsset,
} from '../../core/negocio/negocio-visuals';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';
import { AuthService } from '../../servicios/authService/auth.service';
import {
  AddListaCompraItemPayload,
  CerrarListaResponse,
  HistorialPedidoNenulista,
  Lista,
  ListaCompraItem,
  ListaCompraService,
  PreviewCodigoResponse,
} from '../../servicios/listaCompraServicio/lista-compra.service';
import {
  BuscarProductosFiltros,
  Producto,
  ProductoBusqueda,
  ProductoServiceService,
} from '../../servicios/productoServicio/productoService.service';
import {
  ProductoFavorito,
  ProductoFavoritoService,
} from '../../servicios/productoFavoritoServicio/producto-favorito.service';
import {
  Categoria,
  CategoriaServiceService,
  Subcategoria,
} from '../../servicios/categoriaServicio/categoriaService.service';

interface NegocioFiltroOpcion {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-lista-compra',
  standalone: true,
  imports: [RouterLink, DatePipe, EstanqueBackgroundComponent],
  templateUrl: './lista-compra.component.html',
  styleUrl: './lista-compra.component.css',
})
export class ListaCompraComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly listaCompraService = inject(ListaCompraService);
  private readonly productoFavoritoService = inject(ProductoFavoritoService);
  private readonly productoService = inject(ProductoServiceService);
  private readonly categoriaService = inject(CategoriaServiceService);
  private readonly authService = inject(AuthService);

  private busquedaTimeout: ReturnType<typeof setTimeout> | null = null;
  private detalleCierreTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly cargandoListas = signal(true);
  readonly cargandoListaActiva = signal(false);
  readonly sesionResuelta = signal(false);
  readonly guardandoLista = signal(false);
  readonly eliminandoListaId = signal<number | null>(null);
  readonly itemPendienteId = signal<number | string | null>(null);
  readonly favoritoPendienteProductoId = signal<number | null>(null);
  readonly errorMensaje = signal('');
  readonly exitoMensaje = signal('');
  readonly authNotice = signal('');

  readonly misListas = signal<Lista[]>([]);
  readonly listaActivaId = signal<number | null>(null);
  readonly listaActiva = signal<Lista | null>(null);
  readonly crearListaAbierto = signal(false);

  readonly favoritos = signal<ProductoFavorito[]>([]);

  readonly panelBusquedaAbierto = signal(false);
  readonly busquedaQuery = signal('');
  readonly busquedaResultados = signal<ProductoBusqueda[]>([]);
  readonly buscando = signal(false);
  readonly categorias = signal<Categoria[]>([]);
  readonly subcategorias = signal<Subcategoria[]>([]);
  readonly filtroCategoriaId = signal<number | null>(null);
  readonly filtroSubcategoriaId = signal<number | null>(null);
  readonly filtroNegocioId = signal<number | null>(null);

  readonly productoDetalle = signal<ProductoBusqueda | null>(null);
  readonly detalleCantidad = signal(1);
  readonly detalleListaSeleccionadaId = signal<number | null>(null);
  readonly detalleCrearListaAbierto = signal(false);
  readonly detalleGuardando = signal(false);

  readonly editarListaAbierto = signal(false);
  readonly guardandoEdicionLista = signal(false);

  readonly cerrarListaAbierto = signal(false);
  readonly cerrandoLista = signal(false);
  readonly resumenCierre = signal<CerrarListaResponse | null>(null);

  readonly historialAbierto = signal(false);
  readonly cargandoHistorial = signal(false);
  readonly historial = signal<HistorialPedidoNenulista[]>([]);

  readonly codigoAbierto = signal(false);
  readonly generandoCodigo = signal(false);
  readonly codigoGenerado = signal<string | null>(null);
  readonly codigoCopiado = signal(false);

  readonly importarAbierto = signal(false);
  readonly importarCodigoTexto = signal('');
  readonly buscandoPreviewCodigo = signal(false);
  readonly previewCodigo = signal<PreviewCodigoResponse | null>(null);
  readonly importandoCodigo = signal(false);

  readonly nenufarOpciones = NENUFAR_OPTIONS;

  readonly estaAutenticado = computed(() =>
    this.authService.authStatus() === 'authenticated' ||
    Boolean(this.authService.usuarioActual()),
  );

  readonly negociosFiltro = computed<NegocioFiltroOpcion[]>(() => {
    const vistos = new Map<number, NegocioFiltroOpcion>();
    for (const producto of this.busquedaResultados()) {
      const id = Number(producto.negocio?.id ?? producto.negocioId ?? 0);
      const nombre = String(producto.negocio?.nombre ?? '').trim();
      if (id > 0 && nombre && !vistos.has(id)) {
        vistos.set(id, { id, nombre });
      }
    }
    return Array.from(vistos.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  readonly nuevaListaForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
  });

  readonly detalleNuevaListaForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
  });

  readonly editarListaForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    descripcion: ['', [Validators.maxLength(300)]],
    color: [''],
    iconoNenufar: [''],
  });

  ngOnInit(): void {
    this.cargarProductosCatalogo('');
    this.categoriaService.list().subscribe({ next: (categorias) => this.categorias.set(categorias) });
    this.inicializarSesion();
  }

  ngOnDestroy(): void {
    if (this.busquedaTimeout) {
      clearTimeout(this.busquedaTimeout);
    }
    this.limpiarDetalleCierreTimeout();
  }

  // ===== Listas =====

  cargarListas(): void {
    if (!this.puedeUsarPrivado('cargar tus listas')) {
      this.cargandoListas.set(false);
      this.sesionResuelta.set(true);
      return;
    }

    this.cargandoListas.set(true);
    this.errorMensaje.set('');

    forkJoin({
      listas: this.listaCompraService.getMisListas().pipe(
        catchError((error: unknown) => {
          this.gestionarErrorPrivado(error, 'Tus listas no se cargaron.');
          return of([] as Lista[]);
        }),
      ),
      favoritos: this.productoFavoritoService.getFavoritos().pipe(
        catchError(() => of([] as ProductoFavorito[])),
      ),
    })
      .pipe(finalize(() => {
        this.cargandoListas.set(false);
        this.sesionResuelta.set(true);
      }))
      .subscribe(({ listas, favoritos }) => {
        this.misListas.set(listas);
        this.favoritos.set(favoritos);
        this.seleccionarListaPorDefecto(listas);
      });
  }

  seleccionarListaPorDefecto(listas: Lista[]): void {
    if (!listas.length) {
      this.listaActivaId.set(null);
      this.listaActiva.set(null);
      return;
    }

    const favoritos = listas.find((lista) => lista.tipo === 'FAVORITOS');
    const objetivo = favoritos ?? listas[0];
    this.seleccionarLista(objetivo.id);
  }

  seleccionarLista(listaId: number): void {
    if (this.listaActivaId() === listaId && this.listaActiva()) {
      return;
    }

    this.listaActivaId.set(listaId);
    this.cargandoListaActiva.set(true);
    this.errorMensaje.set('');

    this.listaCompraService
      .getListaPorId(listaId)
      .pipe(finalize(() => this.cargandoListaActiva.set(false)))
      .subscribe({
        next: (lista) => this.listaActiva.set(lista),
        error: (error: unknown) => {
          this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'Esa lista no se cargó.'));
        },
      });
  }

  abrirCrearLista(): void {
    this.crearListaAbierto.set(true);
    this.nuevaListaForm.reset({ nombre: '' });
  }

  cancelarCrearLista(): void {
    this.crearListaAbierto.set(false);
  }

  actualizarNombreNuevaLista(value: string): void {
    this.nuevaListaForm.controls.nombre.setValue(value);
    this.nuevaListaForm.controls.nombre.markAsDirty();
  }

  crearLista(): void {
    if (!this.puedeUsarPrivado('crear lista')) {
      return;
    }

    if (this.guardandoLista()) {
      return;
    }

    clearFormApiErrors(this.nuevaListaForm);

    if (this.nuevaListaForm.invalid) {
      this.nuevaListaForm.markAllAsTouched();
      return;
    }

    const nombre = String(this.nuevaListaForm.controls.nombre.value ?? '').trim();
    this.guardandoLista.set(true);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    this.listaCompraService
      .crearLista({ nombre })
      .pipe(finalize(() => this.guardandoLista.set(false)))
      .subscribe({
        next: (lista) => {
          this.misListas.update((items) => [...items, { ...lista, itemsCount: 0 }]);
          this.crearListaAbierto.set(false);
          this.nuevaListaForm.reset({ nombre: '' });
          this.seleccionarLista(lista.id);
          this.exitoMensaje.set('Lista creada.');
        },
        error: (error: unknown) => {
          this.aplicarErroresFormulario(this.nuevaListaForm, error, 'La lista no se creó.');
        },
      });
  }

  eliminarLista(lista: Lista): void {
    if (!this.puedeUsarPrivado('eliminar lista') || this.eliminandoListaId() === lista.id) {
      return;
    }

    const ok = confirm(`¿Eliminar la lista "${lista.nombre}"?`);
    if (!ok) {
      return;
    }

    this.eliminandoListaId.set(lista.id);
    this.errorMensaje.set('');

    this.listaCompraService
      .eliminarLista(lista.id)
      .pipe(finalize(() => this.eliminandoListaId.set(null)))
      .subscribe({
        next: () => {
          const restantes = this.misListas().filter((item) => item.id !== lista.id);
          this.misListas.set(restantes);
          if (this.listaActivaId() === lista.id) {
            this.seleccionarListaPorDefecto(restantes);
          }
          this.exitoMensaje.set('Lista eliminada.');
        },
        error: (error: unknown) => {
          this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'La lista no se eliminó.'));
        },
      });
  }

  getNenufarIcono(lista: Lista): string {
    const resuelto = resolveNenufarAsset(lista.iconoNenufar ?? lista.color ?? null);
    if (resuelto) {
      return resuelto;
    }
    const variante = (Math.abs(lista.id) % 17) + 1;
    return resolveNenufarAsset(`nenufar_var${variante}`) ?? 'assets/imagenes/nenufar.png';
  }

  // ===== Items de la lista activa =====

  actualizarCantidadItem(item: ListaCompraItem, event: Event): void {
    const listaId = this.listaActivaId();
    const input = event.target as HTMLInputElement;
    const cantidad = this.normalizarCantidad(input.value);

    if (!listaId || !this.puedeUsarPrivado('actualizar cantidad') || this.itemPendienteId() === item.id) {
      return;
    }

    if (cantidad === this.getItemQuantity(item)) {
      return;
    }

    this.itemPendienteId.set(item.id);
    this.errorMensaje.set('');

    this.listaCompraService
      .updateItemDeLista(listaId, item.id, { cantidad })
      .pipe(finalize(() => this.itemPendienteId.set(null)))
      .subscribe({
        next: (actualizado) => {
          this.listaActiva.update((lista) =>
            lista
              ? {
                  ...lista,
                  items: (lista.items ?? []).map((i) => (i.id === item.id ? { ...i, ...actualizado } : i)),
                }
              : lista,
          );
        },
        error: (error: unknown) => {
          this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'La cantidad no se actualizó.'));
        },
      });
  }

  quitarItem(item: ListaCompraItem): void {
    const listaId = this.listaActivaId();
    if (!listaId || !this.puedeUsarPrivado('quitar producto') || this.itemPendienteId() === item.id) {
      return;
    }

    this.itemPendienteId.set(item.id);
    this.errorMensaje.set('');

    this.listaCompraService
      .removeItemDeLista(listaId, item.id)
      .pipe(finalize(() => this.itemPendienteId.set(null)))
      .subscribe({
        next: () => {
          this.listaActiva.update((lista) =>
            lista ? { ...lista, items: (lista.items ?? []).filter((i) => i.id !== item.id) } : lista,
          );
          this.misListas.update((items) =>
            items.map((lista) =>
              lista.id === listaId
                ? { ...lista, itemsCount: Math.max(0, (lista.itemsCount ?? 1) - 1) }
                : lista,
            ),
          );
          this.exitoMensaje.set('Producto quitado de la lista.');
        },
        error: (error: unknown) => {
          this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'El producto no se quitó.'));
        },
      });
  }

  toggleCompletadoItem(item: ListaCompraItem): void {
    const listaId = this.listaActivaId();
    if (!listaId || !this.puedeUsarPrivado('marcar completado') || this.itemPendienteId() === item.id) {
      return;
    }

    this.itemPendienteId.set(item.id);
    this.errorMensaje.set('');
    const completado = !this.isCompleted(item);

    this.listaCompraService
      .updateItemDeLista(listaId, item.id, { completado })
      .pipe(finalize(() => this.itemPendienteId.set(null)))
      .subscribe({
        next: (actualizado) => {
          this.listaActiva.update((lista) =>
            lista
              ? {
                  ...lista,
                  items: (lista.items ?? []).map((i) => (i.id === item.id ? { ...i, ...actualizado } : i)),
                }
              : lista,
          );
        },
        error: (error: unknown) => {
          this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'No se actualizó el producto.'));
        },
      });
  }

  esListaDeCompra(lista: Lista | null): boolean {
    return lista?.tipo === 'COMPRA' || lista?.tipo === 'PERSONALIZADA';
  }

  // ===== Búsqueda de productos =====

  togglePanelBusqueda(): void {
    this.panelBusquedaAbierto.update((abierto) => !abierto);
  }

  onBusqueda(q: string): void {
    this.busquedaQuery.set(q);
    this.panelBusquedaAbierto.set(true);
    if (this.busquedaTimeout) {
      clearTimeout(this.busquedaTimeout);
    }
    this.buscando.set(true);
    this.busquedaTimeout = setTimeout(() => {
      this.cargarProductosCatalogo(q.trim());
    }, 350);
  }

  onFiltroCategoria(value: string): void {
    const categoriaId = value ? Number(value) : null;
    this.filtroCategoriaId.set(categoriaId);
    this.filtroSubcategoriaId.set(null);
    this.subcategorias.set([]);

    if (categoriaId) {
      this.categoriaService.listSubcategorias(categoriaId).subscribe({
        next: (subcategorias) => this.subcategorias.set(subcategorias),
      });
    }

    this.cargarProductosCatalogo(this.busquedaQuery().trim());
  }

  onFiltroSubcategoria(value: string): void {
    this.filtroSubcategoriaId.set(value ? Number(value) : null);
    this.cargarProductosCatalogo(this.busquedaQuery().trim());
  }

  onFiltroNegocio(value: string): void {
    this.filtroNegocioId.set(value ? Number(value) : null);
    this.cargarProductosCatalogo(this.busquedaQuery().trim());
  }

  private cargarProductosCatalogo(q: string): void {
    this.buscando.set(true);
    const filtros: BuscarProductosFiltros = {
      ...(this.filtroCategoriaId() ? { categoriaId: this.filtroCategoriaId()! } : {}),
      ...(this.filtroSubcategoriaId() ? { subcategoriaId: this.filtroSubcategoriaId()! } : {}),
      ...(this.filtroNegocioId() ? { negocioId: this.filtroNegocioId()! } : {}),
    };

    this.productoService.buscarProductos(q, 30, filtros).subscribe({
      next: (resultado) => {
        this.busquedaResultados.set(resultado.items ?? []);
        this.buscando.set(false);
      },
      error: () => {
        this.busquedaResultados.set([]);
        this.buscando.set(false);
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

  getProductoNegocio(producto: ProductoBusqueda | Producto): string {
    return this.cleanText(producto.negocio?.nombre) || 'Negocio local';
  }

  getProductoCategoria(producto: ProductoBusqueda | Producto): string {
    const categoria = this.cleanText(producto.negocio?.categoria?.nombre);
    const subcategoria = this.cleanText(producto.negocio?.subcategoria?.nombre);
    return [categoria, subcategoria].filter(Boolean).join(' · ');
  }

  esFavoritoProducto(producto: ProductoBusqueda | Producto): boolean {
    const productoId = Number(producto.id ?? 0);
    return this.favoritos().some((favorito) => this.getFavoriteProductoId(favorito) === productoId);
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

    const yaFavorito = this.esFavoritoProducto(producto);
    const request$ = yaFavorito
      ? this.productoFavoritoService.quitarFavorito(productoId)
      : this.productoFavoritoService.marcarFavorito(productoId);

    request$
      .pipe(finalize(() => this.favoritoPendienteProductoId.set(null)))
      .subscribe({
        next: () => {
          if (yaFavorito) {
            this.favoritos.update((items) =>
              items.filter((item) => this.getFavoriteProductoId(item) !== productoId),
            );
            this.exitoMensaje.set('Producto quitado de favoritos.');
          } else {
            this.favoritos.update((items) => [{ productoId, producto }, ...items]);
            this.exitoMensaje.set('Producto guardado en favoritos.');
          }
          this.refrescarListasTrasFavorito();
        },
        error: (error: unknown) => {
          this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'Tus favoritos no se actualizaron.'));
        },
      });
  }

  private refrescarListasTrasFavorito(): void {
    if (!this.estaAutenticado()) {
      return;
    }

    this.listaCompraService.getMisListas().subscribe({
      next: (listas) => {
        this.misListas.set(listas);
        const activa = this.listaActiva();
        if (activa?.tipo === 'FAVORITOS') {
          this.seleccionarLista(activa.id);
        }
      },
    });
  }

  // ===== Detalle de producto =====

  abrirDetalleProducto(producto: ProductoBusqueda): void {
    this.limpiarDetalleCierreTimeout();
    this.productoDetalle.set(producto);
    this.detalleCantidad.set(1);
    this.detalleGuardando.set(false);
    this.detalleCrearListaAbierto.set(false);
    this.detalleNuevaListaForm.reset({ nombre: '' });
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
    this.detalleListaSeleccionadaId.set(this.listaActivaId() ?? this.misListas()[0]?.id ?? null);
  }

  cerrarDetalleProducto(): void {
    this.limpiarDetalleCierreTimeout();
    this.productoDetalle.set(null);
    this.detalleGuardando.set(false);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');
  }

  incrementarDetalleCantidad(): void {
    this.detalleCantidad.update((v) => v + 1);
  }

  decrementarDetalleCantidad(): void {
    this.detalleCantidad.update((v) => Math.max(1, v - 1));
  }

  seleccionarListaDetalle(value: string): void {
    this.detalleListaSeleccionadaId.set(value ? Number(value) : null);
  }

  abrirCrearListaDetalle(): void {
    this.detalleCrearListaAbierto.set(true);
    this.detalleNuevaListaForm.reset({ nombre: '' });
  }

  crearListaDesdeDetalle(): void {
    if (!this.puedeUsarPrivado('crear lista')) {
      return;
    }

    if (this.detalleGuardando()) {
      return;
    }

    clearFormApiErrors(this.detalleNuevaListaForm);

    if (this.detalleNuevaListaForm.invalid) {
      this.detalleNuevaListaForm.markAllAsTouched();
      return;
    }

    const nombre = String(this.detalleNuevaListaForm.controls.nombre.value ?? '').trim();
    this.detalleGuardando.set(true);
    this.errorMensaje.set('');

    this.listaCompraService
      .crearLista({ nombre })
      .pipe(finalize(() => this.detalleGuardando.set(false)))
      .subscribe({
        next: (lista) => {
          this.misListas.update((items) => [...items, { ...lista, itemsCount: 0 }]);
          this.detalleListaSeleccionadaId.set(lista.id);
          this.detalleCrearListaAbierto.set(false);
          this.exitoMensaje.set('Lista creada.');
        },
        error: (error: unknown) => {
          this.aplicarErroresFormulario(this.detalleNuevaListaForm, error, 'La lista no se creó.');
        },
      });
  }

  anadirDetalleALista(): void {
    const producto = this.productoDetalle();
    const listaId = this.detalleListaSeleccionadaId();

    if (!producto || !listaId || !this.puedeUsarPrivado('añadir producto a la lista')) {
      return;
    }

    if (this.detalleGuardando()) {
      return;
    }

    const productoId = Number(producto.id ?? 0);
    this.detalleGuardando.set(true);
    this.errorMensaje.set('');
    this.exitoMensaje.set('');

    const continuarConDuplicado = (yaExiste: boolean) => {
      if (yaExiste) {
        this.errorMensaje.set('Este producto ya está en esa lista.');
        this.detalleGuardando.set(false);
        return;
      }

      const payload: AddListaCompraItemPayload = {
        productoId,
        cantidad: this.detalleCantidad(),
      };

      this.listaCompraService
        .addProductoALista(listaId, payload)
        .subscribe({
          next: () => {
            this.exitoMensaje.set(`${producto.nombre} añadido a la lista.`);
            this.misListas.update((items) =>
              items.map((lista) =>
                lista.id === listaId ? { ...lista, itemsCount: (lista.itemsCount ?? 0) + 1 } : lista,
              ),
            );
            if (this.listaActivaId() === listaId) {
              this.seleccionarListaForzado(listaId);
            }
            this.programarCierreDetalleProducto();
          },
          error: (error: unknown) => {
            this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'El producto no se añadió.'));
            this.detalleGuardando.set(false);
          },
        });
    };

    const listaCargada = this.listaActiva();
    if (listaCargada && listaCargada.id === listaId) {
      continuarConDuplicado(
        (listaCargada.items ?? []).some((item) => Number(item.productoId ?? 0) === productoId),
      );
      return;
    }

    this.listaCompraService.getListaPorId(listaId).subscribe({
      next: (lista) => {
        continuarConDuplicado((lista.items ?? []).some((item) => Number(item.productoId ?? 0) === productoId));
      },
      error: () => continuarConDuplicado(false),
    });
  }

  private seleccionarListaForzado(listaId: number): void {
    this.listaCompraService.getListaPorId(listaId).subscribe({
      next: (lista) => this.listaActiva.set(lista),
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

  // ===== Editar / borrar lista =====

  abrirEditarLista(): void {
    const lista = this.listaActiva();
    if (!lista) {
      return;
    }

    this.editarListaForm.reset({
      nombre: lista.nombre,
      descripcion: lista.descripcion ?? '',
      color: lista.color ?? '',
      iconoNenufar: lista.iconoNenufar ?? '',
    });
    this.editarListaAbierto.set(true);
  }

  cerrarEditarLista(): void {
    this.editarListaAbierto.set(false);
  }

  elegirIconoNenufar(id: string): void {
    this.editarListaForm.controls.iconoNenufar.setValue(id);
    this.editarListaForm.controls.iconoNenufar.markAsDirty();
  }

  previewIconoNenufar(id: string): string | null {
    return resolveNenufarAsset(id);
  }

  guardarEdicionLista(): void {
    const lista = this.listaActiva();
    clearFormApiErrors(this.editarListaForm);

    if (!lista || this.guardandoEdicionLista() || this.editarListaForm.invalid) {
      this.editarListaForm.markAllAsTouched();
      return;
    }

    const raw = this.editarListaForm.getRawValue();
    const nombre = String(raw.nombre ?? '').trim();
    if (!nombre) {
      return;
    }

    this.guardandoEdicionLista.set(true);
    this.errorMensaje.set('');

    this.listaCompraService
      .actualizarLista(lista.id, {
        nombre,
        descripcion: String(raw.descripcion ?? '').trim(),
        color: String(raw.color ?? '').trim(),
        iconoNenufar: String(raw.iconoNenufar ?? '').trim(),
      })
      .pipe(finalize(() => this.guardandoEdicionLista.set(false)))
      .subscribe({
        next: (actualizada) => {
          this.listaActiva.set({ ...lista, ...actualizada });
          this.misListas.update((items) =>
            items.map((item) => (item.id === lista.id ? { ...item, ...actualizada } : item)),
          );
          this.editarListaAbierto.set(false);
          this.exitoMensaje.set('Lista actualizada.');
        },
        error: (error: unknown) => {
          this.aplicarErroresFormulario(this.editarListaForm, error, 'La lista no se actualizó.');
        },
      });
  }

  borrarListaActiva(): void {
    const lista = this.listaActiva();
    if (!lista) {
      return;
    }
    this.editarListaAbierto.set(false);
    this.eliminarLista(lista);
  }

  // ===== Cerrar lista (genera pedidos pendientes) =====

  abrirCerrarLista(): void {
    if (!this.listaActiva() || !this.puedeUsarPrivado('cerrar lista')) {
      return;
    }
    this.resumenCierre.set(null);
    this.cerrarListaAbierto.set(true);
  }

  cancelarCerrarLista(): void {
    this.cerrarListaAbierto.set(false);
  }

  confirmarCerrarLista(): void {
    const lista = this.listaActiva();
    if (!lista || this.cerrandoLista()) {
      return;
    }

    this.cerrandoLista.set(true);
    this.errorMensaje.set('');

    this.listaCompraService
      .cerrarLista(lista.id)
      .pipe(finalize(() => this.cerrandoLista.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.resumenCierre.set(respuesta);
          this.exitoMensaje.set('Pedido generado. La lista sigue disponible.');
          window.setTimeout(() => this.cerrarResumenCierre(), 1000);
        },
        error: (error: unknown) => {
          this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'No se pudo cerrar la lista.'));
        },
      });
  }

  cerrarResumenCierre(): void {
    this.cerrarListaAbierto.set(false);
    this.resumenCierre.set(null);
  }

  // ===== Historial de pedidos =====

  toggleHistorial(): void {
    const abrir = !this.historialAbierto();
    this.historialAbierto.set(abrir);

    if (abrir && !this.historial().length) {
      this.cargandoHistorial.set(true);
      this.listaCompraService
        .getHistorialPedidosNenulista()
        .pipe(finalize(() => this.cargandoHistorial.set(false)))
        .subscribe({
          next: (historial) => this.historial.set(historial),
          error: (error: unknown) => {
            this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'El historial no se cargó.'));
          },
        });
    }
  }

  // ===== Compartir / importar por código =====

  abrirCodigoCompartir(): void {
    if (!this.listaActiva() || !this.puedeUsarPrivado('compartir lista')) {
      return;
    }
    this.codigoGenerado.set(null);
    this.codigoAbierto.set(true);
  }

  generarCodigo(): void {
    const lista = this.listaActiva();
    if (!lista || this.generandoCodigo()) {
      return;
    }

    this.generandoCodigo.set(true);
    this.errorMensaje.set('');

    this.listaCompraService
      .generarCodigoCompartir(lista.id)
      .pipe(finalize(() => this.generandoCodigo.set(false)))
      .subscribe({
        next: (respuesta) => this.codigoGenerado.set(respuesta.codigo),
        error: (error: unknown) => {
          this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'No se generó el código.'));
        },
      });
  }

  copiarCodigo(): void {
    const codigo = this.codigoGenerado();
    if (!codigo || !navigator.clipboard) {
      this.errorMensaje.set('No se pudo copiar el código. Cópialo manualmente.');
      return;
    }

    navigator.clipboard.writeText(codigo).then(
      () => {
        this.codigoCopiado.set(true);
        setTimeout(() => this.codigoCopiado.set(false), 2500);
      },
      () => {
        this.errorMensaje.set('No se pudo copiar el código. Cópialo manualmente.');
      },
    );
  }

  abrirImportarCodigo(): void {
    if (!this.puedeUsarPrivado('importar lista por código')) {
      return;
    }
    this.importarCodigoTexto.set('');
    this.previewCodigo.set(null);
    this.importarAbierto.set(true);
  }

  cancelarImportarCodigo(): void {
    this.importarAbierto.set(false);
    this.previewCodigo.set(null);
  }

  actualizarImportarCodigoTexto(value: string): void {
    this.importarCodigoTexto.set(value);
    this.previewCodigo.set(null);
  }

  buscarPreviewCodigo(): void {
    const codigo = this.importarCodigoTexto().trim();
    if (!codigo || this.buscandoPreviewCodigo()) {
      if (!codigo) {
        this.errorMensaje.set('El código de importación es obligatorio.');
      }
      return;
    }

    this.buscandoPreviewCodigo.set(true);
    this.errorMensaje.set('');

    this.listaCompraService
      .previewCodigoLista(codigo)
      .pipe(finalize(() => this.buscandoPreviewCodigo.set(false)))
      .subscribe({
        next: (preview) => this.previewCodigo.set(preview),
        error: (error: unknown) => {
          this.previewCodigo.set(null);
          this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'Ese código no existe o ya no está activo.'));
        },
      });
  }

  confirmarImportarCodigo(): void {
    const codigo = this.importarCodigoTexto().trim();
    if (!codigo || this.importandoCodigo()) {
      if (!codigo) {
        this.errorMensaje.set('El código de importación es obligatorio.');
      }
      return;
    }

    this.importandoCodigo.set(true);
    this.errorMensaje.set('');

    this.listaCompraService
      .importarListaPorCodigo(codigo)
      .pipe(finalize(() => this.importandoCodigo.set(false)))
      .subscribe({
        next: ({ lista, productosNoDisponibles }) => {
          this.misListas.update((items) => [...items, { ...lista, itemsCount: lista.items?.length ?? 0 }]);
          this.importarAbierto.set(false);
          this.seleccionarLista(lista.id);
          this.exitoMensaje.set(
            productosNoDisponibles.length
              ? `Lista importada. Algunos productos ya no están disponibles: ${productosNoDisponibles.join(', ')}.`
              : 'Lista importada correctamente.',
          );
        },
        error: (error: unknown) => {
          this.errorMensaje.set(this.obtenerMensajeErrorPrivado(error, 'El código de lista no es válido o ha caducado.'));
        },
      });
  }

  getFormFieldError(form: { get(path: string): AbstractControl | null }, field: string): string {
    return getFieldError(form.get(field));
  }

  // ===== Helpers de presentación de items =====

  getItemNegocioIcono(item: ListaCompraItem): string | null {
    const negocio = this.getItemProduct(item)?.negocio ?? item.negocio;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return resolveBusinessNenufarAsset(negocio as any, '') || null;
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

  getItemDescripcion(item: ListaCompraItem): string {
    return this.cleanText(this.getItemProduct(item)?.descripcion);
  }

  getItemBusiness(item: ListaCompraItem): string {
    return (
      this.cleanText(item.negocio?.nombre) ||
      this.cleanText(this.getItemProduct(item)?.negocio?.nombre) ||
      'Añadido manualmente'
    );
  }

  getItemCategoria(item: ListaCompraItem): string {
    const producto = this.getItemProduct(item);
    return this.getProductoCategoria(producto ?? ({} as Producto));
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

  formatPrice(value: unknown): string {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed.toFixed(2)} €` : 'Precio pendiente';
  }

  private getFavoriteProductoId(favorito: ProductoFavorito): number | null {
    const productoId = Number(favorito.productoId ?? favorito.producto?.id ?? favorito.id ?? 0);
    return Number.isFinite(productoId) && productoId > 0 ? productoId : null;
  }

  private inicializarSesion(): void {
    const forceRemote = !this.authService.isSessionResolved();
    this.cargandoListas.set(true);
    this.sesionResuelta.set(false);

    this.authService.hydrateSession({ forceRemote }).subscribe({
      next: (usuario) => {
        if (usuario || this.estaAutenticado()) {
          this.authNotice.set('');
          this.cargarListas();
          return;
        }

        this.cargandoListas.set(false);
        this.sesionResuelta.set(true);
        this.authNotice.set('Inicia sesión para guardar tu Nenulista.');
      },
      error: () => {
        this.cargandoListas.set(false);
        this.sesionResuelta.set(true);
        this.authNotice.set('Inicia sesión para guardar tu Nenulista.');
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

  private aplicarErroresFormulario(
    form: typeof this.nuevaListaForm | typeof this.detalleNuevaListaForm | typeof this.editarListaForm,
    error: unknown,
    fallback: string,
  ): void {
    const apiError = mapApiError(error, fallback);
    setFormErrors(form, apiError.fieldErrors);
    this.errorMensaje.set(
      apiError.message ||
        (Object.keys(apiError.fieldErrors).length ? '' : this.obtenerMensajeErrorPrivado(error, fallback)),
    );
  }

  private esErrorAuth(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
  }

  private registrarAuthWarning(message: string, error?: unknown): void {
    if (!environment.production) {
      console.warn(`[Nenulista] ${message}`, error ?? '');
    }
  }

  private normalizarCantidad(value: unknown): number {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private cleanText(value: unknown): string {
    return String(value ?? '').trim();
  }
}
