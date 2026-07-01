import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { getUserErrorMessage } from '../../../core/errors/error-parser';
import { environment } from '../../../../environments/environment';
import { AccessRequiredModalComponent } from '../../../components/shared/access-required-modal/access-required-modal.component';
import { EstanqueBackgroundComponent } from '../../shared/estanque-background/estanque-background.component';
import {
  AuthService,
  AuthUser,
  resolveOwnedBusinessId,
  resolvePrivateProfileRoute,
} from '../../../servicios/authService/auth.service';
import { Logro, LogroServiceService, MiLogro } from '../../../servicios/logroServicio/logroService.service';
import {
  extractEmbeddedLogrosDestacados,
  LogroVisualData,
  normalizeLogroVisual,
  resolveLogroIconAsset,
} from '../../../core/logros/logro-visuals';
import {
  NegocioService,
  NegocioSummary,
  resolveNegocioRouteCommands,
} from '../../../servicios/negocioService/negocio.service';
import { ReservaRecord, ReservaService } from '../../../servicios/reservaService/reserva.service';
import { ReviewProductMetaService } from '../../../servicios/reviewProductMeta/review-product-meta.service';
import { ResenaService } from '../../../servicios/reviewServicio/resena.service';
import { NenufarizarService } from '../../../services/nenufarizar.service';
import {
  PerfilUsuarioResponse,
  SeguidorEntry,
  UpdatePerfilPayload,
  UsuarioServiceService,
} from '../../../servicios/usuarioServicio/usuarioService.service';
import {
  DEFAULT_PROFILE_PHOTO,
  getProfilePhotoFileError,
  resolveProfilePhoto,
} from '../../../core/usuario/profile-photo';

type UserReview = {
  id?: number;
  puntuacion?: number;
  comentario?: string;
  contenido?: string;
  selloNenufar?: boolean;
  fecha?: string;
  creadoEn?: string;
  productoId?: number | null;
  productoNombre?: string | null;
  precioProducto?: number | null;
  producto?: {
    id?: number;
    nombre?: string;
    precio?: number | null;
  } | null;
  productos?: Array<{
    id?: number | null;
    nombre: string;
  }>;
  productoIds?: number[];
  productosSugeridos?: Array<{
    localId?: string;
    nombre: string;
    precioSugerido?: number | null;
    descripcion?: string | null;
    estado?: string | null;
  }>;
  negocio?: {
    id?: number;
    nombre?: string;
    slug?: string | null;
    nickname?: string | null;
  };
};

type CopiaReferidoAccion = '' | 'codigo' | 'enlace';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AccessRequiredModalComponent, EstanqueBackgroundComponent],
  templateUrl: '../../perfil-usuario/perfil-usuario.component.html',
  styleUrl: '../../perfil-usuario/perfil-usuario.component.css'
})
export class PerfilComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioServiceService);
  private readonly resenaService = inject(ResenaService);
  private readonly reservaService = inject(ReservaService);
  private readonly logroService = inject(LogroServiceService);
  private readonly reviewProductMeta = inject(ReviewProductMetaService);
  private readonly negocioService = inject(NegocioService);
  readonly nenufarizar = inject(NenufarizarService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly usuario = signal<PerfilUsuarioResponse | null>(null);
  readonly usuarioActual = signal<AuthUser | null>(this.authService.obtenerUsuario());
  readonly modoEdicion = signal(false);
  readonly resenas = signal<UserReview[]>([]);
  readonly reservas = signal<ReservaRecord[]>([]);
  readonly logros = signal<Logro[]>([]);
  readonly logrosDestacados = signal<LogroVisualData[]>([]);
  readonly logrosDestacadosSeleccionados = signal<number[]>([]);
  readonly logrosDestacadosError = signal('');
  readonly logroTooltipActivo = signal<number | null>(null);
  readonly seguidoresTotal = signal(0);
  readonly siguiendoTotal = signal(0);
  readonly siguiendoUsuario = signal(false);

  readonly panelSeguimientoTipo = signal<'seguidores' | 'siguiendo' | null>(null);
  readonly seguidoresLista = signal<SeguidorEntry[]>([]);
  readonly siguiendoUsuariosLista = signal<SeguidorEntry[]>([]);
  readonly siguiendoNegociosLista = signal<NegocioSummary[]>([]);
  readonly cargandoSeguimientoLista = signal(false);
  readonly accessModalAbierto = signal(false);
  readonly accessModalMensaje = signal('Necesitas iniciar sesion para continuar.');
  readonly regenerandoCodigo = signal(false);
  readonly accionCopiada = signal<CopiaReferidoAccion>('');
  readonly nenufarizarError = signal('');
  readonly mostrarCodigoPanel = signal(false);
  readonly profileFlowerSpinning = signal(false);
  readonly guardandoPerfil = signal(false);
  readonly perfilEditError = signal('');
  readonly perfilEditExito = signal('');
  readonly fotoPerfilError = signal('');
  readonly fotoPerfilArchivo = signal<File | null>(null);
  readonly fotoPerfilPreview = signal<string | null>(null);
  readonly reservaMenuAbiertoId = signal<number | null>(null);
  readonly reservaACancelar = signal<ReservaRecord | null>(null);
  readonly motivoCancelacionReserva = signal('');
  readonly cancelandoReserva = signal(false);
  readonly errorCancelacionReserva = signal('');
  readonly fotoPerfilEdicionSrc = computed(
    () =>
      this.fotoPerfilPreview() ||
      resolveProfilePhoto(this.usuario()) ||
      DEFAULT_PROFILE_PHOTO,
  );

  nuevaBio = '';
  private copyFeedbackTimerId: number | null = null;
  private perfilEditSuccessTimerId: number | null = null;
  private fotoPerfilObjectUrl: string | null = null;
  private logrosDestacadosIniciales: number[] = [];

  readonly esPerfilPropio = computed(() => {
    const actual = this.usuarioActual();
    const perfil = this.usuario();

    if (!actual || !perfil) {
      return false;
    }

    return (
      (actual.id != null && actual.id === perfil.id) ||
      (actual.nickname?.trim().toLowerCase() ?? '') === perfil.nickname.trim().toLowerCase()
    );
  });
  
  ngOnInit(): void {
    this.authService.hydrateSession({ forceRemote: !this.authService.isSessionResolved() })
      .pipe(
        switchMap((actual) => {
          if (!actual?.id) {
            this.cargando.set(false);
            void this.router.navigate(['/estanque']);
            return of(null);
          }

          this.usuarioActual.set(actual);
          this.error.set('');
          this.modoEdicion.set(this.shouldOpenNenúditar());

          return this.usuarioService.getById(actual.id).pipe(
            switchMap((perfil) => {
              this.usuario.set(perfil);
              this.nuevaBio = perfil.biografia || '';
              this.cargarSeguimiento(perfil);

              const resenas$ =
                perfil.resenas && perfil.resenas.length
                  ? of(perfil.resenas)
                  : this.resenaService.getResenasPorUsuario(perfil.id).pipe(
                      catchError(() => of([])),
                    );

              return forkJoin({
                resenas: resenas$,
                logros: this.cargarLogros(perfil.id),
                destacados: this.cargarLogrosDestacados(perfil),
                reservas: this.reservaService.reservasPorUsuario(perfil.id).pipe(
                  catchError((error: unknown) => {
                    this.logDevSecondary('reservas', error);
                    return of([]);
                  }),
                ),
                codigoReferido: this.nenufarizar.loadCodigo().pipe(
                  catchError((error: unknown) => {
                    this.registrarErrorNenufarizar(error);
                    return of('');
                  }),
                ),
                referidos: this.nenufarizar.loadReferidos().pipe(
                  catchError((error: unknown) => {
                    this.registrarErrorNenufarizar(error);
                    return of([]);
                  }),
                ),
              }).pipe(
                catchError(() =>
                  of({
                    resenas: [],
                    logros: [],
                    destacados: [],
                    reservas: [],
                    codigoReferido: '',
                    referidos: [],
                  }),
                ),
              );
            }),
            catchError((error: unknown) => {
              this.usuario.set(null);
              this.resenas.set([]);
              this.logros.set([]);
              this.reservas.set([]);
              this.error.set(getUserErrorMessage(error, 'Tu perfil no se cargó.'));
              return of(null);
            }),
          );
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.resenas.set(this.reviewProductMeta.mergeReviews(result.resenas));
          this.logros.set(result.logros);
          this.aplicarLogrosDestacados(result.destacados);
          this.reservas.set(result.reservas);
        }

        this.cargando.set(false);
      });
  }

  ngOnDestroy(): void {
    this.clearFotoPerfilSelection();

    if (this.copyFeedbackTimerId) {
      window.clearTimeout(this.copyFeedbackTimerId);
    }

    if (this.perfilEditSuccessTimerId) {
      window.clearTimeout(this.perfilEditSuccessTimerId);
    }
  }

  @HostListener('document:click')
  cerrarReservaMenuDesdeDocumento(): void {
    this.reservaMenuAbiertoId.set(null);
  }

  getStars(n: number): string {
    return '★'.repeat(Math.max(0, Math.min(5, Math.round(n))));
  }

  getReviewProductLabels(review: UserReview | null | undefined): string[] {
    return this.reviewProductMeta.getProductLabels(review);
  }

  getReviewPendingProductLabels(review: UserReview | null | undefined): string[] {
    return this.reviewProductMeta.getPendingSuggestionLabels(review);
  }

  getCoverImage(): string | null {
    const perfil = this.usuario() as (PerfilUsuarioResponse & {
      fotoPortada?: string | null;
      foto_portada?: string | null;
    }) | null;

    return perfil?.fotoPortada || perfil?.foto_portada || null;
  }

  toggleSeguirUsuario(): void {
    return;
  }

  guardarCambios(): void {
    const perfil = this.usuario();
    if (!perfil?.id || !this.esPerfilPropio()) {
      return;
    }

    this.perfilEditError.set('');
    this.perfilEditExito.set('');
    this.fotoPerfilError.set('');
    this.logrosDestacadosError.set('');

    if (this.nuevaBio.length > 220) {
      this.perfilEditError.set('La biografía debe tener 220 caracteres como máximo.');
      return;
    }

    const payload: UpdatePerfilPayload = {
      biografia: this.nuevaBio,
    };
    const archivoFotoPerfil = this.fotoPerfilArchivo();

    this.guardandoPerfil.set(true);
    this.usuarioService.updatePerfil(perfil.id, payload).pipe(
      switchMap((response) => {
        if (!archivoFotoPerfil) {
          return of(response);
        }

        return this.usuarioService.subirFotoPerfil(archivoFotoPerfil).pipe(
          map((perfilConFoto) => ({
            ...response,
            ...perfilConFoto,
          })),
        );
      }),
      switchMap((response) => {
        if (!this.logrosDestacadosHanCambiado()) {
          return of({ perfil: response, destacados: null as MiLogro[] | null });
        }

        return this.logroService
          .actualizarMisLogrosDestacados(this.logrosDestacadosSeleccionados())
          .pipe(map((destacados) => ({ perfil: response, destacados })));
      }),
      finalize(() => this.guardandoPerfil.set(false)),
    ).subscribe({
      next: ({ perfil: response, destacados }) => {
        const actual = this.usuarioActual();
        const fotoPerfil = resolveProfilePhoto(response) ?? resolveProfilePhoto(perfil);
        const usuarioActualizado = {
          ...perfil,
          ...response,
          biografia: response.biografia ?? this.nuevaBio,
          foto: fotoPerfil ?? response.foto ?? perfil.foto ?? null,
          fotoPerfil: fotoPerfil ?? null,
          foto_perfil: fotoPerfil ?? null,
        };

        this.usuario.set(usuarioActualizado);
        this.nuevaBio = usuarioActualizado.biografia || '';
        this.modoEdicion.set(false);
        this.perfilEditExito.set('Perfil actualizado correctamente.');
        this.programarLimpiezaExitoPerfil();
        this.clearFotoPerfilSelection();
        if (destacados) {
          const normalizados = this.normalizarDestacadosGuardados(destacados);
          this.aplicarLogrosDestacados(normalizados.length ? normalizados : this.logrosDesdeSeleccionActual());
        }

        if (actual) {
          this.authService.guardarUsuario({
            ...actual,
            ...response,
            biografia: response.biografia ?? this.nuevaBio,
            foto: fotoPerfil ?? response.foto ?? actual.foto ?? null,
            fotoPerfil: fotoPerfil ?? null,
            foto_perfil: fotoPerfil ?? null,
          });
          this.usuarioActual.set(this.authService.obtenerUsuario());
        }
      },
      error: (error: unknown) => {
        this.logDevError(error);
        const mensaje = getUserErrorMessage(error, 'Los cambios del perfil no se guardaron.');
        this.perfilEditError.set(mensaje);
        this.logrosDestacadosError.set(mensaje);
      },
    });
  }

  getBusinessRoute(negocio: UserReview['negocio'] | undefined): (string | number)[] | null {
    const negocioId = Number(negocio?.id);
    const negocioPropioId = resolveOwnedBusinessId(this.usuarioActual());

    if (
      Number.isFinite(negocioId) &&
      negocioId > 0 &&
      negocioPropioId === negocioId
    ) {
      return resolvePrivateProfileRoute(this.usuarioActual());
    }

    return resolveNegocioRouteCommands(negocio);
  }

  bioInvalida(): boolean {
    return this.nuevaBio.length > 220;
  }

  getLogroIcon(logro: unknown, collection: readonly unknown[] = this.logros()): string {
    return resolveLogroIconAsset(logro, collection);
  }

  mostrarLogroTooltip(logroId: number): void {
    this.logroTooltipActivo.set(logroId);
  }

  ocultarLogroTooltip(): void {
    this.logroTooltipActivo.set(null);
  }

  alternarLogroTooltip(logroId: number, event: Event): void {
    event.stopPropagation();
    this.logroTooltipActivo.update((actual) => actual === logroId ? null : logroId);
  }

  toggleLogroDestacado(logro: Logro): void {
    const normalizado = normalizeLogroVisual(logro);
    if (!normalizado || this.guardandoPerfil()) {
      return;
    }

    this.logrosDestacadosError.set('');
    const actuales = this.logrosDestacadosSeleccionados();
    if (actuales.includes(normalizado.id)) {
      this.logrosDestacadosSeleccionados.set(actuales.filter((id) => id !== normalizado.id));
      return;
    }

    if (actuales.length >= 3) {
      this.logrosDestacadosError.set('Puedes elegir como máximo 3 insignias.');
      return;
    }

    this.logrosDestacadosSeleccionados.set([...actuales, normalizado.id]);
  }

  logroDestacadoSeleccionado(logro: Logro): boolean {
    const normalizado = normalizeLogroVisual(logro);
    return Boolean(normalizado && this.logrosDestacadosSeleccionados().includes(normalizado.id));
  }

  getLogroDestacadoTooltip(logro: LogroVisualData): string {
    return [
      logro.descripcion,
      logro.conseguidoEn ? `Conseguido el ${this.formatFecha(logro.conseguidoEn)}` : '',
      logro.motivo || logro.progreso,
    ].filter(Boolean).join(' · ');
  }

  formatFecha(fecha?: string): string {
    if (!fecha) {
      return '';
    }

    return new Date(fecha).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  estadoReservaLabel(estado: string | null | undefined): string {
    const normalizado = String(estado || 'PENDIENTE').toUpperCase();
    return (
      {
        PENDIENTE: 'Pendiente',
        CONFIRMADA: 'Aceptada',
        ACEPTADA: 'Aceptada',
        CANCELADA: 'Cancelada',
        COMPLETADA: 'Completada',
        NO_SHOW: 'No show',
      }[normalizado] ?? normalizado
    );
  }

  reservaEstadoTexto(reserva: ReservaRecord): string {
    if (String(reserva.estado || '').toUpperCase() !== 'CANCELADA') {
      return this.estadoReservaLabel(reserva.estado);
    }

    const canceladaPor = String(reserva.canceladaPor || '').toUpperCase();
    if (canceladaPor === 'USUARIO') {
      return 'Cancelada por ti';
    }

    if (canceladaPor === 'NEGOCIO') {
      return 'Cancelada por el negocio';
    }

    return 'Cancelada';
  }

  estadoReservaClass(estado: string | null | undefined): string {
    const normalizado = String(estado || 'PENDIENTE').toLowerCase();
    return `estado-tag--${normalizado === 'aceptada' ? 'confirmada' : normalizado}`;
  }

  toggleReservaMenu(reserva: ReservaRecord, event: Event): void {
    event.stopPropagation();
    this.reservaMenuAbiertoId.update((actual) => (actual === reserva.id ? null : reserva.id));
  }

  puedeCancelarReservaUsuario(reserva: ReservaRecord): boolean {
    const estado = String(reserva.estado || '').toUpperCase();
    const estadoCancelable = estado === 'PENDIENTE' || estado === 'CONFIRMADA' || estado === 'ACEPTADA';

    return estadoCancelable && reserva.puedeCancelar !== false && !this.reservaYaPaso(reserva);
  }

  abrirCancelacionReserva(reserva: ReservaRecord, event?: Event): void {
    event?.stopPropagation();

    if (!reserva.id || !this.puedeCancelarReservaUsuario(reserva)) {
      return;
    }

    this.reservaMenuAbiertoId.set(null);
    this.reservaACancelar.set(reserva);
    this.motivoCancelacionReserva.set('');
    this.errorCancelacionReserva.set('');
    this.cancelandoReserva.set(false);
  }

  cerrarCancelacionReserva(): void {
    if (this.cancelandoReserva()) {
      return;
    }

    this.reservaACancelar.set(null);
    this.motivoCancelacionReserva.set('');
    this.errorCancelacionReserva.set('');
  }

  confirmarCancelacionReserva(): void {
    const reserva = this.reservaACancelar();
    if (!reserva?.id || this.cancelandoReserva()) {
      return;
    }

    const motivo = this.motivoCancelacionReserva().trim();
    if (!motivo) {
      this.errorCancelacionReserva.set('Escribe un motivo para cancelar la reserva.');
      return;
    }

    this.cancelandoReserva.set(true);
    this.errorCancelacionReserva.set('');

    this.reservaService.cancelarPorUsuario(reserva.id, motivo).subscribe({
      next: (actualizada) => {
        const actualizadaCompleta = this.mergeReserva(reserva, actualizada);
        this.reservas.update((items) =>
          items.map((item) => (item.id === actualizada.id ? this.mergeReserva(item, actualizadaCompleta) : item)),
        );
        this.cancelandoReserva.set(false);
        this.reservaACancelar.set(null);
        this.motivoCancelacionReserva.set('');
      },
      error: () => {
        this.cancelandoReserva.set(false);
        this.errorCancelacionReserva.set('No se ha podido cancelar la reserva. Inténtalo de nuevo.');
      },
    });
  }

  getReferidoInitial(nickname: string | null | undefined): string {
    const normalized = String(nickname ?? '').trim();
    return normalized ? normalized.charAt(0).toUpperCase() : 'N';
  }

  async copiarCodigoReferido(): Promise<void> {
    await this.copiarTexto(this.nenufarizar.codigoReferido(), 'codigo');
  }

  async compartirEnlaceReferido(): Promise<void> {
    const codigoReferido = this.nenufarizar.codigoReferido();
    const enlace = codigoReferido
      ? `${window.location.origin}/registro?ref=${encodeURIComponent(codigoReferido)}`
      : '';

    await this.copiarTexto(enlace, 'enlace');
  }

  regenerarCodigoReferido(): void {
    if (!this.nenufarizar.codigoReferido()) {
      return;
    }

    const confirmado = confirm(
      '¿Quieres generar un nuevo código? Tus referidos actuales se mantendrán vinculados a tu cuenta.',
    );

    if (!confirmado) {
      return;
    }

    this.nenufarizarError.set('');
    this.regenerandoCodigo.set(true);

    this.nenufarizar
      .regenerarCodigo()
      .pipe(
        finalize(() => this.regenerandoCodigo.set(false)),
      )
      .subscribe({
        error: (error: unknown) => {
          this.nenufarizarError.set(
            getUserErrorMessage(
              error,
              'El nuevo código de invitación no se generó.',
            ),
          );
        },
      });
  }

  private reservaYaPaso(reserva: ReservaRecord): boolean {
    const fecha = new Date(reserva.fecha ?? '').getTime();
    return Number.isFinite(fecha) && fecha < Date.now();
  }

  private mergeReserva(base: ReservaRecord, actualizada: ReservaRecord): ReservaRecord {
    return {
      ...base,
      ...actualizada,
      negocio: actualizada.negocio ?? base.negocio,
      usuario: actualizada.usuario ?? base.usuario,
      recurso: actualizada.recurso ?? base.recurso,
    };
  }

  private cargarLogros(usuarioId: number) {
    return forkJoin({
      asignados: this.logroService.porUsuario(usuarioId).pipe(catchError(() => of([]))),
      catalogo: this.logroService.findAll().pipe(catchError(() => of([]))),
    }).pipe(
      switchMap(({ asignados, catalogo }) => {
        const mapById = new Map(catalogo.map((item) => [item.id, item]));
        const logros = asignados
          .map((item) => mapById.get(item.logroId))
          .filter((item): item is Logro => Boolean(item));
        return of(logros);
      }),
    );
  }

  private cargarLogrosDestacados(perfil: PerfilUsuarioResponse) {
    const embebidos = extractEmbeddedLogrosDestacados(perfil);
    if (embebidos.length) {
      return of(embebidos);
    }

    return this.logroService.misLogrosDestacados().pipe(
      map((items) => this.normalizarDestacadosGuardados(items)),
      catchError((error: unknown) => {
        this.logDevSecondary('logros destacados', error);
        return of([] as LogroVisualData[]);
      }),
    );
  }

  private normalizarDestacadosGuardados(items: readonly unknown[]): LogroVisualData[] {
    return items
      .map((item) => normalizeLogroVisual(item))
      .filter((item): item is LogroVisualData => Boolean(item))
      .slice(0, 3);
  }

  private aplicarLogrosDestacados(logros: readonly LogroVisualData[]): void {
    const destacados = logros.slice(0, 3);
    this.logrosDestacados.set(destacados);
    this.logrosDestacadosIniciales = destacados.map((logro) => logro.id);
    this.logrosDestacadosSeleccionados.set(this.logrosDestacadosIniciales);
  }

  private logrosDestacadosHanCambiado(): boolean {
    return this.serializeIds(this.logrosDestacadosSeleccionados()) !==
      this.serializeIds(this.logrosDestacadosIniciales);
  }

  private serializeIds(ids: readonly number[]): string {
    return ids.slice().sort((a, b) => a - b).join(',');
  }

  private logrosDesdeSeleccionActual(): LogroVisualData[] {
    const seleccionados = new Set(this.logrosDestacadosSeleccionados());
    return this.logros()
      .filter((logro) => {
        const normalizado = normalizeLogroVisual(logro);
        return Boolean(normalizado && seleccionados.has(normalizado.id));
      })
      .map((logro) => normalizeLogroVisual(logro))
      .filter((logro): logro is LogroVisualData => Boolean(logro))
      .slice(0, 3);
  }

  private cargarSeguimiento(perfil: PerfilUsuarioResponse): void {
    forkJoin({
      seguidores: this.usuarioService.getSeguidores(perfil.id).pipe(catchError(() => of([]))),
      siguiendo: this.usuarioService.getSiguiendo(perfil.id).pipe(catchError(() => of([]))),
    }).subscribe(({ seguidores, siguiendo }) => {
      this.seguidoresLista.set(seguidores);
      this.siguiendoUsuariosLista.set(siguiendo);
      this.seguidoresTotal.set(
        seguidores.length ||
        Number(perfil._count?.seguidores ?? 0) ||
        0,
      );
      this.siguiendoTotal.set(
        siguiendo.length ||
        Number(perfil._count?.siguiendo ?? 0) ||
        0,
      );
    });

    // Los negocios seguidos solo se pueden consultar para el usuario autenticado
    // (el endpoint no acepta un id arbitrario), así que solo aplica en mi propio perfil.
    if (this.esPerfilPropio()) {
      this.negocioService.listSeguidos().pipe(catchError(() => of([]))).subscribe((negocios) => {
        this.siguiendoNegociosLista.set(negocios);
        this.siguiendoTotal.update((total) => total + negocios.length);
      });
    }
  }

  abrirPanelSeguidores(): void {
    this.panelSeguimientoTipo.set('seguidores');
  }

  abrirPanelSiguiendo(): void {
    this.panelSeguimientoTipo.set('siguiendo');
  }

  cerrarPanelSeguimiento(): void {
    this.panelSeguimientoTipo.set(null);
  }

  getSeguidorRoute(entry: SeguidorEntry): (string | number)[] {
    const usuario = entry.usuario;
    const actual = this.usuarioActual();

    if (actual?.id != null && usuario?.id === actual.id) {
      return resolvePrivateProfileRoute(actual);
    }

    return ['/usuario', usuario.id];
  }

  getNegocioSeguidoRoute(negocio: NegocioSummary): (string | number)[] | null {
    return resolveNegocioRouteCommands(negocio);
  }

  irALogin(): void {
    this.accessModalAbierto.set(false);
    void this.router.navigate(['/estanque']);
  }

  onProfileFlowerClick(): void {
    this.profileFlowerSpinning.set(true);
    this.toggleModoEdicion();
    window.setTimeout(() => this.profileFlowerSpinning.set(false), 380);
  }

  toggleModoEdicion(): void {
    const nextValue = !this.modoEdicion();
    this.modoEdicion.set(nextValue);
    this.perfilEditError.set('');
    this.fotoPerfilError.set('');

    if (nextValue) {
      this.perfilEditExito.set('');
      this.clearPerfilEditSuccessTimer();
    }

    if (!nextValue) {
      this.clearFotoPerfilSelection();
    }
  }

  onFotoPerfilSeleccionada(event: Event): void {
    this.fotoPerfilError.set('');
    this.perfilEditExito.set('');
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

  private shouldOpenNenúditar(): boolean {
    return /\/Nen[uú]ditar(?:[/?#]|$)/i.test(this.router.url);
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

  private async copiarTexto(
    value: string | null | undefined,
    accion: Exclude<CopiaReferidoAccion, ''>,
  ): Promise<void> {
    const texto = String(value ?? '').trim();
    if (!texto || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(texto);
      this.activarFeedbackCopia(accion);
    } catch (error: unknown) {
      this.nenufarizarError.set(
        getUserErrorMessage(
          error,
          'El contenido no se copió al portapapeles.',
        ),
      );
    }
  }

  private activarFeedbackCopia(accion: Exclude<CopiaReferidoAccion, ''>): void {
    this.accionCopiada.set(accion);

    if (this.copyFeedbackTimerId) {
      window.clearTimeout(this.copyFeedbackTimerId);
    }

    this.copyFeedbackTimerId = window.setTimeout(() => {
      this.accionCopiada.set('');
      this.copyFeedbackTimerId = null;
    }, 2000);
  }

  private programarLimpiezaExitoPerfil(): void {
    this.clearPerfilEditSuccessTimer();
    this.perfilEditSuccessTimerId = window.setTimeout(() => {
      this.perfilEditExito.set('');
      this.perfilEditSuccessTimerId = null;
    }, 1800);
  }

  private clearPerfilEditSuccessTimer(): void {
    if (!this.perfilEditSuccessTimerId) {
      return;
    }

    window.clearTimeout(this.perfilEditSuccessTimerId);
    this.perfilEditSuccessTimerId = null;
  }

  private registrarErrorNenufarizar(error: unknown): void {
    this.nenufarizar.codigoReferido.set('');
    this.nenufarizar.referidos.set([]);
    this.logDevSecondary('referidos', error);
  }

  private logDevSecondary(area: string, error: unknown): void {
    if (!environment.production) {
      console.warn(`[PerfilComponent] ${area} no disponible`, error);
    }
  }

  private logDevError(error: unknown): void {
    if (!environment.production) {
      console.error('[PerfilComponent] Error guardando perfil', error);
    }
  }
}
