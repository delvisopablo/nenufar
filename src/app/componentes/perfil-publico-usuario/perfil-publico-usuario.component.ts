import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
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
import {
  extractEmbeddedLogrosDestacados,
  LogroVisualData,
  normalizeLogroVisual,
  resolveLogroIconAsset,
} from '../../core/logros/logro-visuals';
import {
  NegocioService,
  NegocioSummary,
  resolveNegocioRouteCommands,
} from '../../servicios/negocioService/negocio.service';
import { ReviewProductMetaService } from '../../servicios/reviewProductMeta/review-product-meta.service';
import { ResenaService } from '../../servicios/reviewServicio/resena.service';
import {
  PerfilUsuarioResponse,
  SeguidorEntry,
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
  producto?: {
    id?: number;
    nombre?: string;
  } | null;
  productos?: Array<{
    id?: number | null;
    nombre: string;
  }>;
  productosSugeridos?: Array<{
    localId?: string;
    nombre: string;
    estado?: string | null;
  }>;
  negocio?: {
    id?: number;
    nombre?: string;
    slug?: string | null;
    nickname?: string | null;
  };
};

@Component({
  selector: 'app-perfil-publico-usuario',
  standalone: true,
  imports: [CommonModule, RouterLink, AccessRequiredModalComponent, EstanqueBackgroundComponent],
  templateUrl: './perfil-publico-usuario.component.html',
  styleUrl: '../perfil-usuario/perfil-usuario.component.css'
})
export class PerfilPublicoUsuarioComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioServiceService);
  private readonly resenaService = inject(ResenaService);
  private readonly reviewProductMeta = inject(ReviewProductMetaService);
  private readonly logroService = inject(LogroServiceService);
  private readonly negocioService = inject(NegocioService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly usuario = signal<PerfilUsuarioResponse | null>(null);
  readonly usuarioActual = signal<AuthUser | null>(this.authService.obtenerUsuario());
  readonly resenas = signal<UserReview[]>([]);
  readonly logros = signal<Logro[]>([]);
  readonly logrosDestacados = signal<LogroVisualData[]>([]);
  readonly logroTooltipActivo = signal<number | null>(null);
  readonly seguidoresTotal = signal(0);
  readonly siguiendoTotal = signal(0);
  readonly siguiendoUsuario = signal(false);

  readonly panelSeguimientoTipo = signal<'seguidores' | 'siguiendo' | null>(null);
  readonly seguidoresLista = signal<SeguidorEntry[]>([]);
  readonly siguiendoUsuariosLista = signal<SeguidorEntry[]>([]);
  readonly siguiendoNegociosLista = signal<NegocioSummary[]>([]);
  readonly accessModalAbierto = signal(false);
  readonly accessModalMensaje = signal('Necesitas iniciar sesion para seguir a este usuario.');

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
        }
      },
    });

    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const usuarioId = Number(params.get('id'));

          if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
            this.error.set('Falta el identificador del perfil de usuario.');
            this.cargando.set(false);
            return of(null);
          }

          this.cargando.set(true);
          this.error.set('');

          return this.usuarioService.getById(usuarioId).pipe(
            switchMap((perfil) => {
              this.usuario.set(perfil);
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
              }).pipe(
                catchError(() =>
                  of({
                    resenas: [],
                    logros: [],
                    destacados: [],
                  }),
                ),
              );
            }),
            catchError((error: unknown) => {
              this.usuario.set(null);
              this.resenas.set([]);
              this.logros.set([]);
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
          this.logrosDestacados.set(result.destacados);
        }

        this.cargando.set(false);
      });
  }

  getStars(n: number): string {
    return '⭐'.repeat(Math.max(0, Math.min(5, Math.round(n))));
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

    const request$ = this.esPerfilPropio()
      ? this.logroService.misLogrosDestacados()
      : this.logroService.logrosDestacadosUsuario(perfil.id);

    return request$.pipe(
      map((items) =>
        items
          .map((item) => normalizeLogroVisual(item))
          .filter((item): item is LogroVisualData => Boolean(item))
          .slice(0, 3),
      ),
      catchError(() => of([] as LogroVisualData[])),
    );
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

    if (this.esPerfilPropio()) {
      this.negocioService.listSeguidos().pipe(catchError(() => of([]))).subscribe((negocios) => {
        this.siguiendoNegociosLista.set(negocios);
        this.siguiendoTotal.update((total) => total + negocios.length);
      });
    }

    const actual = this.usuarioActual();
    if (!actual?.id || this.esPerfilPropio()) {
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
}
