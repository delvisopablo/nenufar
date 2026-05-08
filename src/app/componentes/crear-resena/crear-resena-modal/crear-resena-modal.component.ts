import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  OnInit,
  OnChanges,
  SimpleChanges,
  computed,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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
import { resolveBusinessImage } from '../../../core/negocio/negocio-visuals';
import {
  Producto,
  ProductoServiceService,
} from '../../../servicios/productoServicio/productoService.service';

interface NegocioOption {
  id: number;
  nombre: string;
  foto?: string;
  fotoPerfil?: string;
  fotoPortada?: string;
  nenufarAsset?: string;
  nenufarKey?: string;
}

interface UsuarioActual {
  id: number;
}

interface CrearResenaPayload {
  contenido: string;
  puntuacion: number;
  selloNenufar: boolean;
  negocioId: number;
  productoId?: number;
  productoNombre?: string;
  precioProducto?: number;
}

@Component({
  selector: 'app-crear-resena-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-resena-modal.component.html',
  styleUrl: './crear-resena-modal.component.css'
})
export class CrearResenaModalComponent implements OnInit, OnChanges {
  private readonly silentRequestContext = new HttpContext().set(
    SKIP_HTTP_ERROR_HANDLING,
    true,
  );

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
  productos: Producto[] = [];
  negocioIdSeleccionado: number | null = null;
  productoIdSeleccionado: number | null = null;

  mostrarLista = signal(false);
  mostrarListaProductos = signal(false);
  cargandoNegocios = signal(false);
  cargandoProductos = signal(false);
  errorMensaje = signal('');
  enviando = signal(false);
  mostrarTooltipSello = signal(false);
  readonly sugerenciasProducto = computed(() => {
    const term = this.normalizeText(this.form.controls['producto'].value);

    if (!this.productos.length) {
      return [];
    }

    if (!term) {
      return this.productos.slice(0, 6);
    }

    return this.productos.filter((producto) =>
      this.normalizeText(producto.nombre).includes(term),
    ).slice(0, 6);
  });

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private productoService: ProductoServiceService,
  ) {
    this.form = this.fb.group({
      negocio: ['', Validators.required],
      producto: [''],
      precioAproximado: [''],
      comentario: ['', Validators.required],
      valoracion: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
      selloNenufar: [false],
    });
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

  cerrar(): void {
    this.visible = false;
    this.cerrarModal.emit();
  }

  ocultarListaConRetraso(): void {
    setTimeout(() => this.mostrarLista.set(false), 200);
  }

  ocultarListaProductosConRetraso(): void {
    setTimeout(() => this.mostrarListaProductos.set(false), 200);
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

  onProductoInput(): void {
    const productoControl = this.form.controls['producto'];
    const typed = String(productoControl.value ?? '').trim();
    const productoSeleccionado = this.productos.find(
      (item) => item.id === this.productoIdSeleccionado,
    );

    if (!typed) {
      this.productoIdSeleccionado = null;
      return;
    }

    if (
      productoSeleccionado &&
      this.normalizeText(productoSeleccionado.nombre) !== this.normalizeText(typed)
    ) {
      this.productoIdSeleccionado = null;
    }
  }

  seleccionarProducto(producto: Producto): void {
    this.productoIdSeleccionado = producto.id;
    this.form.controls['producto'].setValue(producto.nombre);
    this.mostrarListaProductos.set(false);
  }

  getProductoHint(): string {
    if (this.cargandoProductos()) {
      return 'Cargando productos…';
    }

    if (!this.negocioIdSeleccionado) {
      return 'Elige antes el negocio para ver sugerencias.';
    }

    if (!this.productos.length) {
      return 'Puedes escribirlo libremente si aún no existe.';
    }

    return 'Puedes elegir uno existente o escribirlo libremente.';
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
      const productoNombreLibre = String(
        this.form.controls['producto'].value ?? '',
      ).trim();
      const precioProducto = this.parseOptionalPrice(
        this.form.controls['precioAproximado'].value,
      );
      const reseña: CrearResenaPayload = {
        contenido: String(this.form.value.comentario ?? '').trim(),
        puntuacion: Number(this.form.value.valoracion ?? 0),
        selloNenufar: Boolean(this.form.value.selloNenufar),
        negocioId: this.negocioIdSeleccionado,
        ...(this.productoIdSeleccionado ? { productoId: this.productoIdSeleccionado } : {}),
        ...(!this.productoIdSeleccionado && productoNombreLibre
          ? { productoNombre: productoNombreLibre }
          : {}),
        ...(precioProducto != null ? { precioProducto } : {}),
      };

      this.enviando.set(true);

      this.http.post(buildApiUrl('/resena'), reseña, {
        context: this.silentRequestContext,
      }).pipe(
        finalize(() => this.enviando.set(false)),
      ).subscribe({
        next: (res) => {
          const respuestaNormalizada = this.normalizarRespuestaCreada(res, reseña);

          alert('Genial!! Tu reseña se ha guardado.');
          this.resenaCreada.emit(respuestaNormalizada);
          this.form.reset({
            negocio: this.negocioIdSeleccionado === this.negocioId ? this.getNegocioNombreInicial() : '',
            producto: '',
            precioAproximado: '',
            comentario: '',
            valoracion: 0,
            selloNenufar: false,
          });
          this.productoIdSeleccionado = null;
          this.mostrarListaProductos.set(false);

          if (this.negocioId) {
            this.sincronizarNegocioInicial();
          } else {
            this.negocioIdSeleccionado = null;
            this.productos = [];
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
      this.aplicarNegocioSeleccionado(negocioId, nombre, true);
      return;
    }

    if (Number.isFinite(negocioId) && negocioId > 0) {
      const negocioEncontrado = this.negocios.find((item) => item.id === negocioId);
      this.aplicarNegocioSeleccionado(
        negocioId,
        negocioEncontrado?.nombre ?? this.form.controls['negocio'].value ?? '',
        true,
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
    preserveText = false,
  ): void {
    this.negocioIdSeleccionado = negocioId;
    this.form.controls['negocio'].setValue(nombreNegocio);

    const shouldResetProducto = !preserveText;
    if (shouldResetProducto) {
      this.form.controls['producto'].setValue('');
      this.form.controls['precioAproximado'].setValue('');
      this.productoIdSeleccionado = null;
    }

    this.cargarProductosNegocio(negocioId);
  }

  private cargarProductosNegocio(negocioId: number): void {
    if (!Number.isFinite(negocioId) || negocioId <= 0) {
      this.productos = [];
      this.productoIdSeleccionado = null;
      return;
    }

    this.cargandoProductos.set(true);
    this.productoService.listByNegocio(negocioId)
      .pipe(finalize(() => this.cargandoProductos.set(false)))
      .subscribe({
        next: (productos) => {
          this.productos = productos;
        },
        error: () => {
          this.productos = [];
        },
      });
  }

  private parseOptionalPrice(raw: unknown): number | null {
    const normalized = String(raw ?? '').replace(',', '.').trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private normalizarRespuestaCreada(
    response: unknown,
    payload: CrearResenaPayload,
  ): Record<string, unknown> {
    const productoNombre =
      payload.productoNombre?.trim() ||
      this.productos.find((producto) => producto.id === payload.productoId)?.nombre?.trim() ||
      '';

    return {
      ...(response && typeof response === 'object' ? response as Record<string, unknown> : {}),
      negocioId: payload.negocioId,
      contenido: payload.contenido,
      puntuacion: payload.puntuacion,
      selloNenufar: payload.selloNenufar,
      ...(payload.productoId ? { productoId: payload.productoId } : {}),
      ...(productoNombre
        ? {
            productoNombre,
            producto: {
              id: payload.productoId ?? null,
              nombre: productoNombre,
            },
          }
        : {}),
      ...(payload.precioProducto != null ? { precioProducto: payload.precioProducto } : {}),
    };
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private obtenerUsuarioActual(): UsuarioActual | null {
    const raw = localStorage.getItem('usuarioLogueado');

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<UsuarioActual>;
      return typeof parsed.id === 'number' ? { id: parsed.id } : null;
    } catch {
      return null;
    }
  }
}
