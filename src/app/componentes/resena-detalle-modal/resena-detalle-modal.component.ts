import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, throwError } from 'rxjs';
import {
  AuthService,
  AuthUser,
  resolveOwnedBusinessId,
  resolvePrivateProfileRoute,
} from '../../servicios/authService/auth.service';
import {
  NegocioRouteTarget,
  resolveNegocioRouteCommands,
} from '../../servicios/negocioService/negocio.service';
import {
  ComentarioResena,
  ResenaLikeResponse,
  ResenaService,
} from '../../servicios/reviewServicio/resena.service';
import {
  PostComentario,
  PostService,
} from '../../servicios/postServicio/post.service';
import {
  DEFAULT_NENUFAR_SMALL_ASSET,
  NegocioVisualData,
  addUnsplashParams,
  buildUnsplashSrcset,
  resolveBusinessNenufarAsset,
} from '../../core/negocio/negocio-visuals';
import { ReviewProductMetaService } from '../../servicios/reviewProductMeta/review-product-meta.service';

type ReviewUser = {
  id?: number | string | null;
  autorNombre?: string | null;
  nombre?: string | null;
  nickname?: string | null;
  foto?: string | null;
};

export type ResenaDetalleInput = {
  id?: number | string | null;
  negocioId?: number | string | null;
  postId?: number | string | null;
  autorNombre?: string | null;
  contenido?: string | null;
  contenidoCorto?: string | null;
  comentario?: string | null;
  creadoEn?: string | null;
  fecha?: string | null;
  fechaISO?: string | null;
  puntuacion?: number | string | null;
  selloNenufar?: boolean | null;
  likedByMe?: boolean | null;
  likesCount?: number | string | null;
  usuario?: ReviewUser | null;
  [key: string]: unknown;
};

type BusinessCategory = string | { id?: number; nombre?: string | null } | null;

export type ResenaDetalleBusiness = NegocioRouteTarget & {
  id?: number | string | null;
  nombre?: string | null;
  slug?: string | null;
  nickname?: string | null;
  routeKey?: string | null;
  duenoId?: number | string | null;
  dueno?: { id?: number | string | null } | null;
  categoria?: BusinessCategory;
  subcategoria?: BusinessCategory;
  [key: string]: unknown;
};

export type ResenaComentarioCreadoEvent = {
  comentario: ComentarioResena | PostComentario;
  comentariosCount: number;
  resenaId: number;
};

export type ResenaLikeCambiadoEvent = {
  likedByMe: boolean;
  likesCount: number;
  resenaId: number;
};

@Component({
  selector: 'app-resena-detalle-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resena-detalle-modal.component.html',
  styleUrl: './resena-detalle-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResenaDetalleModalComponent implements OnChanges {
  @Input({ required: true }) resena: ResenaDetalleInput | null = null;
  @Input() negocio: ResenaDetalleBusiness | null = null;
  @Input() usuarioActual: AuthUser | null = null;

  @Output() cerrar = new EventEmitter<void>();
  @Output() comentarioCreado = new EventEmitter<ResenaComentarioCreadoEvent>();
  @Output() likeCambiado = new EventEmitter<ResenaLikeCambiadoEvent>();

  private readonly authService = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly postService = inject(PostService);
  private readonly resenaService = inject(ResenaService);
  private readonly reviewProductMeta = inject(ReviewProductMetaService);
  private readonly router = inject(Router);

  comentarios: Array<ComentarioResena | PostComentario> = [];
  comentarioDraft = '';
  comentariosError = '';
  loadingComentarios = false;
  comentariosAbiertos = false;
  publicandoComentario = false;
  likedByMe = false;
  likesCount = 0;
  likeError = '';
  loadingLikes = false;
  togglingLike = false;

  private loadedReviewId: number | null = null;
  private loadedLikeReviewId: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resena']) {
      const reviewId = this.getResenaId();
      const previousReviewId = Number(changes['resena'].previousValue?.id ?? 0);
      const isSameReview =
        Number.isFinite(previousReviewId) &&
        previousReviewId > 0 &&
        previousReviewId === reviewId;

      if (isSameReview) {
        if (typeof this.resena?.likedByMe === 'boolean') {
          this.likedByMe = this.resena.likedByMe;
        }
        if (this.resena?.likesCount != null) {
          this.likesCount = this.parseCount(this.resena.likesCount);
        }
        this.changeDetector.markForCheck();
        return;
      }

      this.comentarioDraft = '';
      this.comentarios = [];
      this.comentariosError = '';
      this.comentariosAbiertos = false;
      this.likeError = '';
      this.loadedReviewId = null;
      this.loadedLikeReviewId = null;
      this.likedByMe = Boolean(this.resena?.likedByMe);
      this.likesCount = this.parseCount(this.resena?.likesCount);

      if (reviewId) {
        this.cargarLikes();
      }
    }
  }

  /** Número de comentarios a mostrar en la flecha antes de desplegarlos (no dispara carga). */
  getComentariosCount(): number {
    if (this.comentarios.length) {
      return this.comentarios.length;
    }
    return this.parseCount(this.resena?.['comentariosCount']);
  }

  toggleComentarios(): void {
    this.comentariosAbiertos = !this.comentariosAbiertos;

    if (this.comentariosAbiertos && !this.comentarios.length) {
      this.cargarComentarios();
    }
  }

  getResenaId(): number | null {
    const id = Number(this.resena?.id ?? 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  getPostId(): number | null {
    const id = Number(this.resena?.postId ?? 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  getAutor(): string {
    return (
      this.resena?.autorNombre?.trim() ||
      this.resena?.usuario?.autorNombre?.trim() ||
      this.resena?.usuario?.nombre?.trim() ||
      'Cliente de Nenúfar'
    );
  }

  /** Id numérico del autor de la reseña, si el dato viene disponible en la fuente real. */
  getAutorId(): number | null {
    const candidato =
      this.resena?.usuario?.id ??
      (this.resena?.['usuarioId'] as number | string | undefined) ??
      (this.resena?.['user'] as { id?: number | string } | undefined)?.id ??
      (this.resena?.['autor'] as { id?: number | string } | undefined)?.id ??
      null;

    const id = Number(candidato ?? 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  /** Navega al perfil del autor de la reseña: privado si es el usuario actual, público si no. */
  irAlAutor(): void {
    const autorId = this.getAutorId();
    if (!autorId) {
      return;
    }

    this.cerrar.emit();

    const currentUserId = Number(this.usuarioActual?.id ?? 0);
    if (Number.isFinite(currentUserId) && currentUserId > 0 && currentUserId === autorId) {
      void this.router.navigate(resolvePrivateProfileRoute(this.usuarioActual));
      return;
    }

    void this.router.navigate(['/usuario', autorId]);
  }

  getFechaLabel(): string {
    const raw = this.resena?.fechaISO ?? this.resena?.creadoEn ?? this.resena?.fecha ?? '';
    const date = new Date(String(raw));
    if (Number.isNaN(date.getTime())) {
      return 'Hace poco';
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  getPuntuacion(): number {
    const value = Number(this.resena?.puntuacion ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.min(5, Math.round(value))) : 0;
  }

  getEstrellas(): string {
    const rating = this.getPuntuacion();
    return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
  }

  getContenido(): string {
    return String(
      this.resena?.contenido ??
        this.resena?.comentario ??
        this.resena?.contenidoCorto ??
        'Reseña sin contenido.',
    ).trim();
  }

  getReviewProductLabels(): string[] {
    return this.reviewProductMeta.getProductLabels(this.resena);
  }

  getReviewPendingProductLabels(): string[] {
    return this.reviewProductMeta.getPendingSuggestionLabels(this.resena);
  }

  hasSelloNenufar(): boolean {
    return Boolean(this.resena?.selloNenufar);
  }

  getNenufarSrc(): string {
    return addUnsplashParams(
      resolveBusinessNenufarAsset(this.negocio as NegocioVisualData | null, DEFAULT_NENUFAR_SMALL_ASSET),
      192,
    );
  }

  getNenufarSrcset(): string {
    return buildUnsplashSrcset(
      resolveBusinessNenufarAsset(this.negocio as NegocioVisualData | null, DEFAULT_NENUFAR_SMALL_ASSET),
      [96, 160, 192],
    );
  }

  getBusinessName(): string {
    return this.negocio?.nombre?.trim() || 'Negocio local';
  }

  getBusinessHandle(): string {
    const handle =
      this.negocio?.slug?.trim() ||
      this.negocio?.nickname?.trim() ||
      this.negocio?.routeKey?.trim() ||
      (this.negocio?.id ? String(this.negocio.id) : '');

    return handle ? `@${handle}` : '@negocio';
  }

  getBusinessCategoryLabel(): string {
    const categoria = this.getCategoryName(this.negocio?.categoria) || 'Negocio local';
    const subcategoria = this.getCategoryName(this.negocio?.subcategoria);
    return subcategoria ? `${categoria} · ${subcategoria}` : categoria;
  }

  getCommentAuthor(comment: ComentarioResena | PostComentario): string {
    return comment.usuario?.nombre?.trim() || 'Usuario Nenúfar';
  }

  getCommentDate(comment: ComentarioResena | PostComentario): string {
    const date = new Date(String(comment.creadoEn ?? ''));
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  }

  updateComentarioDraft(value: string): void {
    this.comentarioDraft = value;
    this.comentariosError = '';
  }

  cargarLikes(force = false): void {
    const reviewId = this.getResenaId();
    const postId = this.getPostId();
    if (!reviewId || !postId || (!force && this.loadedLikeReviewId === reviewId)) {
      return;
    }

    this.loadingLikes = true;
    this.likeError = '';
    this.changeDetector.markForCheck();

    this.postService.listLikes(postId).subscribe({
      next: (response) => {
        const usuarioId = Number(this.usuarioActual?.id ?? 0);
        this.likesCount = response.count;
        this.likedByMe =
          Number.isFinite(usuarioId) &&
          usuarioId > 0 &&
          response.likes.some((like) => Number(like.usuarioId) === usuarioId);
        this.loadedLikeReviewId = reviewId;
        this.loadingLikes = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.loadingLikes = false;
        this.loadedLikeReviewId = reviewId;
        this.changeDetector.markForCheck();
      },
    });
  }

  toggleLike(): void {
    const reviewId = this.getResenaId();
    if (!reviewId || this.togglingLike) {
      return;
    }

    if (!this.usuarioActual?.id && !this.authService.isAuthenticated()) {
      this.likeError = 'Inicia sesión para dar like a esta reseña.';
      this.changeDetector.markForCheck();
      return;
    }

    const previousLiked = this.likedByMe;
    const previousCount = this.likesCount;
    const nextLiked = !previousLiked;
    const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));

    this.likedByMe = nextLiked;
    this.likesCount = nextCount;
    this.togglingLike = true;
    this.likeError = '';
    this.emitirLikeCambiado(reviewId);
    this.changeDetector.markForCheck();

    const request$ = nextLiked
      ? this.resenaService.like(reviewId)
      : this.resenaService.unlike(reviewId);

    request$
      .pipe(
        catchError((error: unknown) => {
          const postId = this.getPostId();
          return postId
            ? nextLiked
              ? this.postService.like(postId)
              : this.postService.unlike(postId)
            : throwError(() => error);
        }),
      )
      .subscribe({
        next: (response) => {
          this.applyLikeResponse(response, nextLiked, nextCount);
          this.togglingLike = false;
          this.emitirLikeCambiado(reviewId);
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.likedByMe = previousLiked;
          this.likesCount = previousCount;
          this.togglingLike = false;
          this.likeError = 'El like de la reseña no se actualizó.';
          this.emitirLikeCambiado(reviewId);
          this.changeDetector.markForCheck();
        },
      });
  }

  cargarComentarios(force = false): void {
    const reviewId = this.getResenaId();
    if (!reviewId || (!force && this.loadedReviewId === reviewId && this.comentarios.length)) {
      return;
    }

    this.loadingComentarios = true;
    this.comentariosError = '';
    this.changeDetector.markForCheck();

    this.resenaService
      .listComentarios(reviewId)
      .pipe(
        catchError(() => {
          const postId = this.getPostId();
          return postId
            ? this.postService.listComentarios(postId)
            : of([] as Array<ComentarioResena | PostComentario>);
        }),
      )
      .subscribe({
        next: (comentarios) => {
          this.comentarios = comentarios;
          this.loadedReviewId = reviewId;
          this.loadingComentarios = false;
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.comentarios = [];
          this.loadingComentarios = false;
          this.comentariosError = 'Los comentarios de esta reseña no se cargaron.';
          this.changeDetector.markForCheck();
        },
      });
  }

  publicarComentario(): void {
    const reviewId = this.getResenaId();
    const contenido = this.comentarioDraft.trim();

    if (!reviewId || !contenido || this.publicandoComentario) {
      return;
    }

    if (!this.usuarioActual?.id && !this.authService.isAuthenticated()) {
      this.comentariosError = 'Inicia sesión para comentar esta reseña.';
      this.changeDetector.markForCheck();
      return;
    }

    this.publicandoComentario = true;
    this.comentariosError = '';
    this.changeDetector.markForCheck();

    this.resenaService
      .crearComentario(reviewId, contenido)
      .pipe(
        catchError((error: unknown) => {
          const postId = this.getPostId();
          return postId
            ? this.postService.crearComentario(postId, contenido)
            : throwError(() => error);
        }),
      )
      .subscribe({
        next: (comentario) => {
          this.comentarioDraft = '';
          this.publicandoComentario = false;
          const nextComentariosCount = this.comentarios.length + 1;
          this.comentarioCreado.emit({
            comentario,
            comentariosCount: nextComentariosCount,
            resenaId: reviewId,
          });
          this.cargarComentarios(true);
        },
        error: () => {
          this.publicandoComentario = false;
          this.comentariosError =
            'Los comentarios de esta reseña todavía no están disponibles.';
          this.changeDetector.markForCheck();
        },
      });
  }

  irAlNegocio(): void {
    const negocio = this.negocio;
    if (!negocio) {
      return;
    }

    const negocioId = Number(negocio.id ?? 0);
    const ownerBusinessId = resolveOwnedBusinessId(this.usuarioActual);
    const ownerId = Number(negocio.duenoId ?? negocio.dueno?.id ?? 0);
    const currentUserId = Number(this.usuarioActual?.id ?? 0);
    const esMiNegocio =
      (Number.isFinite(negocioId) && negocioId > 0 && ownerBusinessId === negocioId) ||
      (Number.isFinite(ownerId) && ownerId > 0 && ownerId === currentUserId);

    this.cerrar.emit();

    if (esMiNegocio) {
      void this.router.navigate(resolvePrivateProfileRoute(this.usuarioActual));
      return;
    }

    const route = resolveNegocioRouteCommands(negocio);
    if (route) {
      void this.router.navigate(route);
    }
  }

  private getCategoryName(category: BusinessCategory | undefined): string {
    if (!category) {
      return '';
    }

    return typeof category === 'string'
      ? category.trim()
      : category.nombre?.trim() ?? '';
  }

  private applyLikeResponse(
    response: unknown,
    fallbackLiked: boolean,
    fallbackCount: number,
  ): void {
    const payload =
      response && typeof response === 'object'
        ? (response as ResenaLikeResponse)
        : {};
    const responseCount = Number(payload.likesCount ?? payload.count ?? NaN);

    this.likedByMe =
      typeof payload.likedByMe === 'boolean'
        ? payload.likedByMe
        : typeof payload.liked === 'boolean'
          ? payload.liked
          : fallbackLiked;
    this.likesCount = Number.isFinite(responseCount)
      ? Math.max(0, responseCount)
      : fallbackCount;
  }

  private emitirLikeCambiado(resenaId: number): void {
    this.likeCambiado.emit({
      likedByMe: this.likedByMe,
      likesCount: this.likesCount,
      resenaId,
    });
  }

  private parseCount(value: unknown): number {
    const count = Number(value ?? 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  }
}
