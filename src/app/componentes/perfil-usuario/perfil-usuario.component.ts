import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { getUserErrorMessage } from '../../core/errors/error-parser';
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
export class PerfilUsuarioComponent implements OnInit {
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

  nuevaBio = '';
  private copyFeedbackTimerId: number | null = null;

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
    this.authService.hydrateSession().subscribe({
      next: (usuario) => {
        this.usuarioActual.set(usuario);
        const perfil = this.usuario();
        if (perfil) {
          this.cargarSeguimiento(perfil);
          if (this.esUsuarioActual(perfil)) {
            this.cargarNenufarizar();
          }
        }
      },
    });

    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const nickname = params.get('nickname')?.trim();

          if (!nickname) {
            this.error.set('No hemos podido identificar el perfil de usuario.');
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
              const reservas$ = this.esUsuarioActual(perfil) && this.authService.hasAccessToken()
                ? this.reservaService.reservasPorUsuario(perfil.id).pipe(catchError(() => of([])))
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
              this.error.set(getUserErrorMessage(error, 'No hemos podido cargar este perfil de usuario.'));
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
        this.error.set(getUserErrorMessage(error, 'No hemos podido actualizar el seguimiento.'));
      },
    });
  }

  guardarCambios(): void {
    const perfil = this.usuario();
    if (!perfil?.id || !this.esPerfilPropio()) {
      return;
    }

    const payload: UpdatePerfilPayload = {
      biografia: this.nuevaBio,
    };

    this.usuarioService.updatePerfil(perfil.id, payload).subscribe({
      next: (response) => {
        const actual = this.usuarioActual();
        const usuarioActualizado = {
          ...perfil,
          ...response,
          biografia: response.biografia ?? this.nuevaBio,
        };

        this.usuario.set(usuarioActualizado);
        this.nuevaBio = usuarioActualizado.biografia || '';
        this.modoEdicion.set(false);

        if (actual) {
          this.authService.guardarUsuario({
            ...actual,
            ...response,
            biografia: response.biografia ?? this.nuevaBio,
            foto_perfil:
              response.foto_perfil ??
              (typeof response.foto === 'string' ? response.foto : actual.foto_perfil),
          });
          this.usuarioActual.set(this.authService.obtenerUsuario());
        }
      },
      error: (error: unknown) => {
        this.error.set(getUserErrorMessage(error, 'No hemos podido guardar los cambios del perfil.'));
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
              'No hemos podido generar un código nuevo ahora mismo.',
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
    this.modoEdicion.update((value) => !value);
    window.setTimeout(() => this.profileFlowerSpinning.set(false), 380);
  }

  private shouldOpenNenúditar(): boolean {
    return /\/Nenúditar(?:[/?#]|$)/.test(this.router.url);
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
          'No hemos podido copiar el contenido al portapapeles.',
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
    if (this.nenufarizarError()) {
      return;
    }

    this.nenufarizarError.set(
      getUserErrorMessage(
        error,
        'No hemos podido cargar tu zona de referidos ahora mismo.',
      ),
    );
  }
}
