import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import { environment } from '../../../environments/environment';
import { AccessRequiredModalComponent } from '../../components/shared/access-required-modal/access-required-modal.component';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';
import {
  AuthService,
  AuthUser,
  resolveOwnedBusinessId,
  resolvePrivateProfileRoute,
} from '../../servicios/authService/auth.service';
import { Logro, LogroServiceService } from '../../servicios/logroServicio/logroService.service';
import { resolveNegocioRouteCommands } from '../../servicios/negocioService/negocio.service';
import { ReservaService } from '../../servicios/reservaService/reserva.service';
import { ReviewProductMetaService } from '../../servicios/reviewProductMeta/review-product-meta.service';
import { ResenaService } from '../../servicios/reviewServicio/resena.service';
import { NenufarizarService } from '../../services/nenufarizar.service';
import {
  PerfilUsuarioResponse,
  UpdatePerfilPayload,
  UsuarioServiceService,
} from '../../servicios/usuarioServicio/usuarioService.service';
import {
  DEFAULT_PROFILE_PHOTO,
  getProfilePhotoFileError,
  resolveProfilePhoto,
} from '../../core/usuario/profile-photo';

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
  selector: 'app-perfil-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AccessRequiredModalComponent, EstanqueBackgroundComponent],
  templateUrl: './perfil-usuario.component.html',
  styleUrl: './perfil-usuario.component.css'
})
export class PerfilUsuarioComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioServiceService);
  private readonly resenaService = inject(ResenaService);
  private readonly reservaService = inject(ReservaService);
  private readonly logroService = inject(LogroServiceService);
  private readonly reviewProductMeta = inject(ReviewProductMetaService);
  readonly nenufarizar = inject(NenufarizarService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly usuario = signal<PerfilUsuarioResponse | null>(null);
  readonly usuarioActual = signal<AuthUser | null>(this.authService.obtenerUsuario());
  readonly modoEdicion = signal(false);
  readonly resenas = signal<UserReview[]>([]);
  readonly reservas = signal<any[]>([]);
  readonly logros = signal<Logro[]>([]);
  readonly seguidoresTotal = signal(0);
  readonly siguiendoTotal = signal(0);
  readonly siguiendoUsuario = signal(false);
  readonly accessModalAbierto = signal(false);
  readonly accessModalMensaje = signal('Necesitas iniciar sesion para seguir a este usuario.');
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
  readonly fotoPerfilEdicionSrc = computed(
    () =>
      this.fotoPerfilPreview() ||
      resolveProfilePhoto(this.usuario()) ||
      DEFAULT_PROFILE_PHOTO,
  );

  nuevaBio = '';
  private copyFeedbackTimerId: number | null = null;
  private fotoPerfilObjectUrl: string | null = null;

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
    this.route.paramMap
      .pipe(
        switchMap((params) =>
          this.authService
            .hydrateSession({ forceRemote: !this.authService.isSessionResolved() })
            .pipe(map((usuario) => ({ params, usuario }))),
        ),
        switchMap(({ params, usuario }) => {
          this.usuarioActual.set(usuario);
          const nickname = params.get('nickname')?.trim();

          if (!nickname) {
            this.error.set('Falta el identificador del perfil de usuario.');
            this.cargando.set(false);
            return of(null);
          }

          this.cargando.set(true);
          this.error.set('');
          this.modoEdicion.set(this.shouldOpenNenúditar());

          return this.usuarioService.getByNickname(nickname).pipe(
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
              const logros$ = this.cargarLogros(perfil.id);
              const reservas$ = this.esUsuarioActual(perfil)
                ? this.reservaService.reservasPorUsuario(perfil.id).pipe(
                    catchError((error: unknown) => {
                      this.logDevSecondary('reservas', error);
                      return of([]);
                    }),
                  )
                : of([]);

              return forkJoin({
                resenas: resenas$,
                logros: logros$,
                reservas: reservas$,
                codigoReferido: this.esUsuarioActual(perfil)
                  ? this.nenufarizar.loadCodigo().pipe(
                      catchError((error: unknown) => {
                        this.registrarErrorNenufarizar(error);
                        return of('');
                      }),
                    )
                  : of(''),
                referidos: this.esUsuarioActual(perfil)
                  ? this.nenufarizar.loadReferidos().pipe(
                      catchError((error: unknown) => {
                        this.registrarErrorNenufarizar(error);
                        return of([]);
                      }),
                    )
                  : of([]),
              }).pipe(
                catchError(() =>
                  of({
                    resenas: [],
                    logros: [],
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
              this.error.set(getUserErrorMessage(error, 'Este perfil de usuario no se cargó.'));
              return of(null);
            }),
          );
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.resenas.set(this.reviewProductMeta.mergeReviews(result.resenas));
          this.logros.set(result.logros);
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
    const perfil = this.usuario();

    if (!perfil || this.esPerfilPropio()) {
      return;
    }

    if (!this.authService.isAuthenticated()) {
      this.accessModalAbierto.set(true);
      return;
    }

    const request$ = this.siguiendoUsuario()
      ? this.usuarioService.dejarDeSeguir(perfil.id)
      : this.usuarioService.seguir(perfil.id);

    request$.subscribe({
      next: () => {
        const nextValue = !this.siguiendoUsuario();
        this.siguiendoUsuario.set(nextValue);
        this.seguidoresTotal.update((value) => Math.max(0, value + (nextValue ? 1 : -1)));
      },
      error: (error: unknown) => {
        this.error.set(getUserErrorMessage(error, 'El seguimiento de este usuario no se actualizó.'));
      },
    });
  }

  guardarCambios(): void {
    const perfil = this.usuario();
    if (!perfil?.id || !this.esPerfilPropio()) {
      return;
    }

    this.perfilEditError.set('');
    this.perfilEditExito.set('');
    this.fotoPerfilError.set('');
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
      finalize(() => this.guardandoPerfil.set(false)),
    ).subscribe({
      next: (response) => {
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
        this.clearFotoPerfilSelection();

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
        this.perfilEditError.set(getUserErrorMessage(error, 'Los cambios del perfil no se guardaron.'));
      },
    });
  }

  getBusinessRoute(
    negocio: UserReview['negocio'] | undefined,
  ): (string | number)[] | null {
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
    if (!this.esPerfilPropio() || !this.nenufarizar.codigoReferido()) {
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

  private esUsuarioActual(perfil: PerfilUsuarioResponse): boolean {
    const actual = this.usuarioActual();

    if (!actual) {
      return false;
    }

    return (
      (actual.id != null && actual.id === perfil.id) ||
      (actual.nickname?.trim().toLowerCase() ?? '') === perfil.nickname.trim().toLowerCase()
    );
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

  private cargarSeguimiento(perfil: PerfilUsuarioResponse): void {
    forkJoin({
      seguidores: this.usuarioService.getSeguidores(perfil.id).pipe(catchError(() => of([]))),
      siguiendo: this.usuarioService.getSiguiendo(perfil.id).pipe(catchError(() => of([]))),
    }).subscribe(({ seguidores, siguiendo }) => {
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

    const actual = this.usuarioActual();
    if (!actual?.id || this.esUsuarioActual(perfil)) {
      this.siguiendoUsuario.set(false);
      return;
    }

    this.usuarioService.getSiguiendo(actual.id).pipe(
      catchError(() => of([])),
    ).subscribe((items) => {
      this.siguiendoUsuario.set(
        items.some((item) => item.usuario?.id === perfil.id),
      );
    });
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

  private cargarNenufarizar(): void {
    this.nenufarizar.loadCodigo().pipe(
      catchError((error: unknown) => {
        this.registrarErrorNenufarizar(error);
        return of('');
      }),
    ).subscribe();

    this.nenufarizar.loadReferidos().pipe(
      catchError((error: unknown) => {
        this.registrarErrorNenufarizar(error);
        return of([]);
      }),
    ).subscribe();
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

  private registrarErrorNenufarizar(error: unknown): void {
    this.nenufarizar.codigoReferido.set('');
    this.nenufarizar.referidos.set([]);
    this.logDevSecondary('referidos', error);
  }

  private logDevSecondary(area: string, error: unknown): void {
    if (!environment.production) {
      console.warn(`[PerfilUsuarioComponent] ${area} no disponible`, error);
    }
  }

  private logDevError(error: unknown): void {
    if (!environment.production) {
      console.error('[PerfilUsuarioComponent] Error guardando perfil', error);
    }
  }
}
