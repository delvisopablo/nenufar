import {
  Component,
  Input,
  Output,
  EventEmitter,
  computed,
  inject,
  signal,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../../config/api.config';
import { getUserErrorMessage } from '../../../core/errors/error-parser';
import { SKIP_HTTP_ERROR_HANDLING } from '../../../core/errors/http-error.interceptor';
import { resolveBusinessImage, resolveNenufarAsset, NENUFAR_OPTIONS } from '../../../core/negocio/negocio-visuals';
import { NenufarBurstComponent } from '../../shared/nenufar-burst/nenufar-burst.component';
import {
  ReviewProductChip,
  SuggestedReviewProduct,
} from '../../../core/reviews/review-products';
import { PondBusinessSnapshot } from '../../../servicios/estanqueFeed/estanque-feed.service';
import {
  Producto,
  ProductoServiceService,
} from '../../../servicios/productoServicio/productoService.service';
import { ReviewProductMetaService } from '../../../servicios/reviewProductMeta/review-product-meta.service';

interface NegocioOption {
  id: number;
  nombre: string;
  slug?: string | null;
  nickname?: string | null;
  duenoId?: number | null;
  categoria?: { id?: number; nombre?: string } | string | null;
  ciudad?: string | null;
  provincia?: string | null;
  foto?: string;
  fotoPerfil?: string;
  fotoPortada?: string;
  imagenNenufar?: string;
  nenufarActivo?: string;
  assetNenufar?: string;
  nenufarColor?: string;
  nenufarAsset?: string;
  nenufarKey?: string;
}

interface UsuarioActual {
  id: number;
  nombre?: string;
  nickname?: string;
  foto?: string | null;
}

interface CrearResenaPayload {
  contenido: string;
  puntuacion: number;
  selloNenufar: boolean;
  negocioId: number;
  productoIds?: number[];
  productosSugeridos?: SuggestedReviewProduct[];
}

@Component({
  selector: 'app-crear-resena-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NenufarBurstComponent],
  templateUrl: './crear-resena-modal.component.html',
  styleUrl: './crear-resena-modal.component.css'
})
export class CrearResenaModalComponent implements OnInit, OnChanges {
  private readonly silentRequestContext = new HttpContext().set(
    SKIP_HTTP_ERROR_HANDLING,
    true,
  );
  private readonly productoService = inject(ProductoServiceService);
  private readonly reviewProductMeta = inject(ReviewProductMetaService);

  // @Output() cerrarModal = new EventEmitter<void>();
  @Output() resenaCreada = new EventEmitter<unknown>();
  @Input() visible = false;
  @Input() negocioId!: number;

  @Input() resenas: unknown[] = [];
  @Input() negocio: unknown;
  @Output() cerrarModal = new EventEmitter<void>();
  usuarioActual: UsuarioActual | null = this.obtenerUsuarioActual();

  form: FormGroup;
  negocios: NegocioOption[] = [];
  negocioIdSeleccionado: number | null = null;

  mostrarLista = signal(false);
  cargandoNegocios = signal(false);
  cargandoProductos = signal(false);
  errorMensaje = signal('');
  errorProductos = signal('');
  enviando = signal(false);
  burstActivo = signal(false);
  burstNenufarSrc = signal('assets/imagenes/nenufar.png');
  mostrarTooltipSello = signal(false);
  selectorProductosAbierto = signal(false);
  sugerirProductoAbierto = signal(false);
  productoBusqueda = signal('');
  productosNegocio = signal<Producto[]>([]);
  productosSeleccionados = signal<ReviewProductChip[]>([]);
  productosSugeridos = signal<SuggestedReviewProduct[]>([]);
  productosFiltrados = computed(() => {
    const query = this.productoBusqueda().trim().toLowerCase();
    const items = this.productosNegocio();

    if (!query) {
      return items.slice(0, 8);
    }

    return items
      .filter((producto) => {
        const nombre = String(producto.nombre ?? '').toLowerCase();
        const descripcion = String(producto.descripcion ?? '').toLowerCase();
        return nombre.includes(query) || descripcion.includes(query);
      })
      .slice(0, 8);
  });
  puedeSugerirProducto = computed(() => {
    const query = this.productoBusqueda().trim().toLowerCase();
    if (!query || !this.negocioIdSeleccionado) {
      return false;
    }

    const existe = this.productosNegocio().some((producto) =>
      String(producto.nombre ?? '').trim().toLowerCase() === query,
    );
    const yaSugerido = this.productosSugeridos().some((producto) =>
      String(producto.nombre ?? '').trim().toLowerCase() === query,
    );

    return !existe && !yaSugerido;
  });

  sugerenciaForm: FormGroup;
  private ultimoNegocioProductosCargado: number | null = null;
  private readonly productosCache = new Map<number, Producto[]>();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
  ) {
    this.form = this.fb.group({
      negocio: ['', Validators.required],
      comentario: ['', Validators.required],
      valoracion: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
      selloNenufar: [false],
    });
    this.sugerenciaForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(191)]],
      precioSugerido: [''],
      descripcion: [''],
    });
  }

  get sugerenciaNombreControl(): FormControl {
    return this.sugerenciaForm.get('nombre') as FormControl;
  }

  get sugerenciaPrecioControl(): FormControl {
    return this.sugerenciaForm.get('precioSugerido') as FormControl;
  }

  get sugerenciaDescripcionControl(): FormControl {
    return this.sugerenciaForm.get('descripcion') as FormControl;
  }

  ngOnInit() {
    this.cargandoNegocios.set(true);
    this.http.get<ApiListResponse<NegocioOption>>(buildApiUrl('/negocios')).subscribe({
      next: (data) => {
        this.negocios = extractItems(data);
        this.cargandoNegocios.set(false);
        this.errorMensaje.set('');
      },
      error: (error: unknown) => {
        this.cargandoNegocios.set(false);
        this.errorMensaje.set(getUserErrorMessage(error, 'No hemos podido cargar los negocios.'));
      }
    });
    this.sincronizarNegocioInicial();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['negocioId'] || changes['negocio'] || changes['visible']) {
      this.sincronizarNegocioInicial();
    }
  }

  getNegocioImage(negocio: NegocioOption): string {
    return resolveBusinessImage(negocio);
  }

  seleccionarNegocio(negocio: NegocioOption): void {
    this.aplicarNegocioSeleccionado(negocio.id, negocio.nombre);
    this.mostrarLista.set(false);
  }

  onBurstFinished(): void {
    this.burstActivo.set(false);
    this.cerrar();
  }

  cerrar(): void {
    this.visible = false;
    this.resetProductComposer();
    this.cerrarModal.emit();
  }

  ocultarListaConRetraso(): void {
    setTimeout(() => this.mostrarLista.set(false), 200);
  }

  toggleSello(): void {
    const actual = this.form.controls['selloNenufar'].value;
    this.form.controls['selloNenufar'].setValue(!actual);
  }

  mostrarInfoSello(): void {
    this.mostrarTooltipSello.set(true);
  }

  ocultarInfoSello(): void {
    this.mostrarTooltipSello.set(false);
  }

  enviar(): void {
    this.errorMensaje.set('');

    if (this.enviando()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.negocioIdSeleccionado) {
      this.errorMensaje.set('Selecciona un negocio de la lista.');
      return;
    }

    if (!this.usuarioActual?.id) {
      this.errorMensaje.set('Inicia sesión para publicar una reseña.');
      return;
    }

    if (this.form.valid && this.negocioIdSeleccionado && this.usuarioActual?.id) {
      const productoIds = this.productosSeleccionados()
        .map((producto) => Number(producto.id ?? 0))
        .filter((id) => Number.isFinite(id) && id > 0);
      const productosSugeridos = this.productosSugeridos().map((producto) => ({
        nombre: producto.nombre,
        ...(Number.isFinite(Number(producto.precioSugerido))
          ? { precioSugerido: Number(producto.precioSugerido) }
          : {}),
        ...(String(producto.descripcion ?? '').trim()
          ? { descripcion: String(producto.descripcion ?? '').trim() }
          : {}),
      }));
      const reseña: CrearResenaPayload = {
        contenido: String(this.form.value.comentario ?? '').trim(),
        puntuacion: Number(this.form.value.valoracion ?? 0),
        selloNenufar: Boolean(this.form.value.selloNenufar),
        negocioId: this.negocioIdSeleccionado,
        ...(productoIds.length ? { productoIds } : {}),
        ...(productosSugeridos.length ? { productosSugeridos } : {}),
      };

      this.enviando.set(true);

      this.http.post(buildApiUrl('/resena'), reseña, {
        context: this.silentRequestContext,
      }).pipe(
        finalize(() => this.enviando.set(false)),
      ).subscribe({
        next: (res) => {
          const respuestaNormalizada = this.normalizarRespuestaCreada(
            res,
            reseña,
            this.productosSeleccionados(),
            this.productosSugeridos(),
          );
          this.reviewProductMeta.rememberReviewMeta({
            reviewId: Number((respuestaNormalizada as { id?: unknown }).id ?? Date.now()),
            negocioId: this.negocioIdSeleccionado ?? reseña.negocioId,
            productos: this.productosSeleccionados(),
            productosSugeridos: this.productosSugeridos(),
            reviewContenido: reseña.contenido,
            usuarioId: this.usuarioActual?.id ?? null,
            usuarioNombre: this.usuarioActual?.nombre ?? null,
          });

          const negocioOpt = this.negocios.find(n => n.id === this.negocioIdSeleccionado);
          const rawAsset = negocioOpt?.nenufarAsset ?? negocioOpt?.nenufarActivo ?? negocioOpt?.nenufarKey ?? null;
          const resolvedSrc = rawAsset
            ? resolveNenufarAsset(rawAsset, NENUFAR_OPTIONS) ?? 'assets/imagenes/nenufar.png'
            : 'assets/imagenes/nenufar.png';
          this.burstNenufarSrc.set(resolvedSrc);
          this.burstActivo.set(true);

          this.resenaCreada.emit(respuestaNormalizada);
          this.form.reset({
            negocio: this.negocioIdSeleccionado === this.negocioId ? this.getNegocioNombreInicial() : '',
            comentario: '',
            valoracion: 0,
            selloNenufar: false,
          });
          this.resetProductComposer();

          if (this.negocioId) {
            this.sincronizarNegocioInicial();
          } else {
            this.negocioIdSeleccionado = null;
          }
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.errorMensaje.set('No hemos podido guardar la reseña ahora mismo.');
            return;
          }

          this.errorMensaje.set(
            getUserErrorMessage(error, 'No hemos podido guardar la reseña.')
          );
        }
      });
    }
  }

  private sincronizarNegocioInicial(): void {
    if (!this.visible && !this.negocioIdSeleccionado && !this.negocioId) {
      return;
    }

    const negocioId = Number(this.negocioId);
    const nombre = this.getNegocioNombreInicial();

    if (Number.isFinite(negocioId) && negocioId > 0 && nombre) {
      this.aplicarNegocioSeleccionado(negocioId, nombre);
      return;
    }

    if (Number.isFinite(negocioId) && negocioId > 0) {
      const negocioEncontrado = this.negocios.find((item) => item.id === negocioId);
      this.aplicarNegocioSeleccionado(
        negocioId,
        negocioEncontrado?.nombre ?? this.form.controls['negocio'].value ?? '',
      );
    }
  }

  private getNegocioNombreInicial(): string {
    const negocio = this.negocio as { nombre?: string } | null;
    return String(negocio?.nombre ?? '').trim();
  }

  private aplicarNegocioSeleccionado(
    negocioId: number,
    nombreNegocio: string,
  ): void {
    const negocioCambiado = this.negocioIdSeleccionado !== negocioId;
    this.negocioIdSeleccionado = negocioId;
    this.form.controls['negocio'].setValue(nombreNegocio);
    if (negocioCambiado) {
      this.resetProductComposer();
    }
    this.cargarProductosNegocio(negocioId);
  }

  toggleSelectorProductos(): void {
    this.selectorProductosAbierto.update((value) => !value);
  }

  actualizarBusquedaProducto(value: string): void {
    this.productoBusqueda.set(String(value ?? ''));
  }

  productoSeleccionado(productoId: number): boolean {
    return this.productosSeleccionados().some((producto) => Number(producto.id ?? 0) === productoId);
  }

  alternarProducto(producto: Producto): void {
    const productoId = Number(producto.id ?? 0);
    if (!Number.isFinite(productoId) || productoId <= 0) {
      return;
    }

    this.productosSeleccionados.update((items) => {
      const existe = items.some((item) => Number(item.id ?? 0) === productoId);
      if (existe) {
        return items.filter((item) => Number(item.id ?? 0) !== productoId);
      }

      return [
        ...items,
        {
          id: productoId,
          nombre: producto.nombre,
          foto:
            String(producto.foto ?? '').trim() ||
            String(producto.imagen ?? '').trim() ||
            String(producto.imageUrl ?? '').trim() ||
            null,
        },
      ];
    });
  }

  quitarProductoSeleccionado(productoId: number | null | undefined): void {
    const normalizedId = Number(productoId ?? 0);
    this.productosSeleccionados.update((items) =>
      items.filter((item) => Number(item.id ?? 0) !== normalizedId),
    );
  }

  abrirFormularioSugerencia(): void {
    if (!this.negocioIdSeleccionado) {
      this.errorProductos.set('Selecciona antes un negocio para sugerir un producto.');
      return;
    }

    this.errorProductos.set('');
    this.sugerirProductoAbierto.set(true);
    this.sugerenciaForm.reset({
      nombre: this.productoBusqueda().trim(),
      precioSugerido: '',
      descripcion: '',
    });
  }

  cancelarSugerenciaProducto(): void {
    this.sugerirProductoAbierto.set(false);
    this.sugerenciaForm.reset({
      nombre: '',
      precioSugerido: '',
      descripcion: '',
    });
  }

  guardarProductoSugerido(): void {
    if (this.sugerenciaForm.invalid) {
      this.sugerenciaForm.markAllAsTouched();
      return;
    }

    const raw = this.sugerenciaForm.getRawValue();
    const nombre = String(raw.nombre ?? '').trim();
    const descripcion = String(raw.descripcion ?? '').trim();
    const precioSugerido = Number(raw.precioSugerido ?? NaN);

    if (!nombre) {
      return;
    }

    const existeEnCatalogo = this.productosNegocio().some(
      (producto) => String(producto.nombre ?? '').trim().toLowerCase() === nombre.toLowerCase(),
    );
    const yaSugerido = this.productosSugeridos().some(
      (producto) => String(producto.nombre ?? '').trim().toLowerCase() === nombre.toLowerCase(),
    );

    if (existeEnCatalogo || yaSugerido) {
      this.errorProductos.set('Ese producto ya existe o ya está sugerido.');
      return;
    }

    this.productosSugeridos.update((items) => [
      ...items,
      {
        localId: `draft-${Date.now()}-${items.length}`,
        nombre,
        ...(Number.isFinite(precioSugerido) ? { precioSugerido } : {}),
        ...(descripcion ? { descripcion } : {}),
        estado: 'pendiente',
      },
    ]);
    this.errorProductos.set('');
    this.cancelarSugerenciaProducto();
  }

  quitarProductoSugerido(localId: string | undefined): void {
    if (!localId) {
      return;
    }

    this.productosSugeridos.update((items) => items.filter((item) => item.localId !== localId));
  }

  private cargarProductosNegocio(negocioId: number): void {
    const normalizedId = Number(negocioId ?? 0);
    if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
      this.productosNegocio.set([]);
      return;
    }

    const cached = this.productosCache.get(normalizedId);
    if (cached) {
      this.productosNegocio.set(cached);
      this.errorProductos.set('');
      this.ultimoNegocioProductosCargado = normalizedId;
      return;
    }

    if (this.cargandoProductos() && this.ultimoNegocioProductosCargado === normalizedId) {
      return;
    }

    this.cargandoProductos.set(true);
    this.errorProductos.set('');
    this.ultimoNegocioProductosCargado = normalizedId;

    this.productoService
      .listByNegocio(normalizedId)
      .pipe(finalize(() => this.cargandoProductos.set(false)))
      .subscribe({
        next: (productos) => {
          this.productosCache.set(normalizedId, productos);
          if (this.negocioIdSeleccionado === normalizedId) {
            this.productosNegocio.set(productos);
          }
        },
        error: (error: unknown) => {
          if (this.negocioIdSeleccionado === normalizedId) {
            this.productosNegocio.set([]);
            this.errorProductos.set(
              getUserErrorMessage(error, 'No hemos podido cargar los productos del negocio.'),
            );
          }
        },
      });
  }

  private resetProductComposer(): void {
    this.selectorProductosAbierto.set(false);
    this.sugerirProductoAbierto.set(false);
    this.productoBusqueda.set('');
    this.errorProductos.set('');
    this.productosSeleccionados.set([]);
    this.productosSugeridos.set([]);
    this.sugerenciaForm.reset({
      nombre: '',
      precioSugerido: '',
      descripcion: '',
    });
  }

  private normalizarRespuestaCreada(
    response: unknown,
    payload: CrearResenaPayload,
    productosSeleccionados: ReviewProductChip[],
    productosSugeridos: SuggestedReviewProduct[],
  ): Record<string, unknown> {
    const negocio = this.getSelectedBusinessSnapshot(payload.negocioId);
    const productoNombre = productosSeleccionados[0]?.nombre ?? null;

    return {
      ...(response && typeof response === 'object' ? response as Record<string, unknown> : {}),
      id: Number((response as { id?: unknown } | null)?.id ?? Date.now()),
      negocioId: payload.negocioId,
      contenido: payload.contenido,
      puntuacion: payload.puntuacion,
      selloNenufar: payload.selloNenufar,
      fechaISO: new Date().toISOString(),
      autorNombre: this.usuarioActual?.nombre ?? 'Tu',
      usuarioNickname: this.usuarioActual?.nickname,
      usuarioFoto: this.usuarioActual?.foto ?? null,
      ...(productoNombre ? { productoNombre } : {}),
      ...(productosSeleccionados.length ? { productos: productosSeleccionados } : {}),
      ...(payload.productoIds?.length ? { productoIds: payload.productoIds } : {}),
      ...(productosSugeridos.length ? { productosSugeridos } : {}),
      negocio,
    };
  }

  private obtenerUsuarioActual(): UsuarioActual | null {
    const raw = localStorage.getItem('usuarioLogueado');

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<UsuarioActual>;
      return typeof parsed.id === 'number'
        ? {
            id: parsed.id,
            nombre: typeof parsed.nombre === 'string' ? parsed.nombre : undefined,
            nickname: typeof parsed.nickname === 'string' ? parsed.nickname : undefined,
            foto: typeof parsed.foto === 'string' ? parsed.foto : null,
          }
        : null;
    } catch {
      return null;
    }
  }

  private getSelectedBusinessSnapshot(negocioId: number): PondBusinessSnapshot | null {
    const negocioInput = this.negocio as (PondBusinessSnapshot | null | undefined);
    if (Number(negocioInput?.id ?? 0) === negocioId) {
      return {
        id: negocioId,
        ...negocioInput,
      };
    }

    const negocioOption = this.negocios.find((item) => item.id === negocioId);
    if (!negocioOption) {
      return null;
    }

    return {
      id: negocioOption.id,
      nombre: negocioOption.nombre,
      slug: negocioOption.slug ?? null,
      nickname: negocioOption.nickname ?? null,
      duenoId: negocioOption.duenoId ?? null,
      categoria: negocioOption.categoria ?? null,
      ciudad: negocioOption.ciudad ?? null,
      provincia: negocioOption.provincia ?? null,
      foto: negocioOption.foto ?? null,
      fotoPerfil: negocioOption.fotoPerfil ?? null,
      fotoPortada: negocioOption.fotoPortada ?? null,
      imagenNenufar: negocioOption.imagenNenufar ?? null,
      nenufarActivo: negocioOption.nenufarActivo ?? null,
      assetNenufar: negocioOption.assetNenufar ?? null,
      nenufarColor: negocioOption.nenufarColor ?? null,
      nenufarAsset: negocioOption.nenufarAsset ?? null,
      nenufarKey: negocioOption.nenufarKey ?? null,
    };
  }
}
