import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subscription, catchError, map, of } from 'rxjs';
import { CrearResenaModalComponent } from '../crear-resena/crear-resena-modal/crear-resena-modal.component';
import { PromoMock, PROMOS_MOCK } from '../promocion/promocion/promocionesMock';
import {
  ResenaComentarioCreadoEvent,
  ResenaDetalleModalComponent,
  ResenaLikeCambiadoEvent,
} from '../resena-detalle-modal/resena-detalle-modal.component';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';
import {
  AuthService,
  AuthUser,
  resolveOwnedBusinessId,
  resolvePrivateProfileRoute,
} from '../../servicios/authService/auth.service';
import {
  EstanqueFeedService,
  PondPromotionAnnouncement,
  PondReviewAnnouncement,
} from '../../servicios/estanqueFeed/estanque-feed.service';
import { HomeHeaderService } from '../../servicios/homeHeaderServicio/home-header.service';
import {
  FiltroCategoria,
  FiltroSubcategoria,
  FiltrosEstanqueService,
} from '../../servicios/filtrosEstanqueServicio/filtros-estanque.service';
import {
  NegocioService,
  resolveNegocioRouteCommands,
} from '../../servicios/negocioService/negocio.service';
import {
  NegocioLite,
  NegocioReviewSnippet,
  NegocioSearchService,
} from '../../servicios/buscador/negocio-search.service';
import {
  DEFAULT_NENUFAR_SMALL_ASSET,
  DEFAULT_NENUFAR_FALLBACK_ASSET,
  NegocioVisualData,
  addUnsplashParams,
  buildUnsplashSrcset,
  resolveBusinessNenufarAsset,
} from '../../core/negocio/negocio-visuals';
import { NenufarPerformanceService } from '../../core/performance/nenufar-performance.service';
import {
  Promocion,
  PromocionService,
  TipoDescuento,
} from '../../servicios/promocionServicio/promocionService.service';
import {
  PostComentario,
  PostService,
} from '../../servicios/postServicio/post.service';
import { ReviewProductMetaService } from '../../servicios/reviewProductMeta/review-product-meta.service';

type HomePromo = PromoMock & {
  creadoEnISO?: string;
  negocio?: (NegocioVisualData & {
    categoria?: { id?: number; nombre?: string } | string | null;
    duenoId?: number | null;
    id?: number;
    nickname?: string | null;
    nombre?: string;
    routeKey?: string;
    slug?: string | null;
  }) | null;
};

type ZoneKey = 'promos' | 'resenas' | 'perfil' | 'crear';
type LilyKind = 'promo' | 'review' | 'business' | 'profile' | 'create';
type LilyEntryMotion = 'burst' | null;
type TooltipTone = 'promo' | 'review' | 'profile' | 'create';
type HoverTooltip = {
  placement: 'above' | 'below';
  text: string;
  title: string;
  tone: TooltipTone;
  x: number;
  y: number;
};

type HoveredLilyTarget = {
  element: HTMLElement;
  item: LilyView;
  pointerX: number;
  pointerY: number;
};

type HomePopup =
  | { kind: 'info' }
  | { kind: 'ayuda' }
  | { kind: 'navigationError'; message: string; title: string }
  | { kind: 'signin'; message: string; title: string }
  | { kind: 'review'; lilyId: string; business: NegocioLite; review: PondReviewItem }
  | { kind: 'business'; lilyId: string; business: NegocioLite }
  | { kind: 'promo'; lilyId: string; promo: HomePromo }
  | { kind: 'profile'; lilyId: string }
  | { kind: 'create'; lilyId: string };

type NavigableBusiness =
  | NegocioLite
  | (NegocioVisualData & {
      duenoId?: number | null;
      id?: number;
      nickname?: string | null;
      nombre?: string;
      routeKey?: string | null;
      slug?: string | null;
    });

type PondReviewItem = NegocioReviewSnippet & {
  business: NegocioLite;
  negocioId: number;
};

type ReviewInteractionState = {
  commentDraft: string;
  comments: PostComentario[];
  commentsCount: number;
  error: string | null;
  likedByMe: boolean;
  likesCount: number;
  loading: boolean;
  submittingComment: boolean;
  togglingLike: boolean;
};

type PondCandidate = {
  item: LilyView;
  key: string;
  priority: number;
  timestamp: number;
};

type LilyView = {
  id: string;
  kind: LilyKind;
  label: string;
  insertedAt: number;
  entryMotion?: LilyEntryMotion;
  highlighted?: boolean;
  priority: number;
  promo?: HomePromo;
  business?: NegocioLite;
  review?: PondReviewItem;
  subtitle: string;
  tone: 'fresh' | 'mustio';
  zone: ZoneKey;
};

type LilyBody = {
  angle: number;
  angVel: number;
  dataRef: LilyView;
  driftSeed: number;
  element?: HTMLElement;
  escapeUntil: number;
  id: string;
  lastTouchedAt: number;
  r: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type ZonePhysicsConfig = {
  damping: number;
  maxSpeed: number;
  minSpeed: number;
  restitution: number;
  targetCount: number;
};

type ZoneRuntime = {
  bodies: LilyBody[];
  config: ZonePhysicsConfig;
  host: HTMLDivElement;
  key: ZoneKey;
  respawnTimers: Set<number>;
  size: {
    height: number;
    width: number;
  };
};

function readJson<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  if (raw === 'undefined' || raw === 'null') {
    localStorage.removeItem(key);
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as T | null;

    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

@Component({
  selector: 'app-principal',
  standalone: true,
  imports: [CommonModule, CrearResenaModalComponent, ResenaDetalleModalComponent, EstanqueBackgroundComponent],
  templateUrl: './principal.component.html',
  styleUrl: './principal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrincipalComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(EstanqueBackgroundComponent) private backgroundRef?: EstanqueBackgroundComponent;
  @ViewChild('scene', { static: true }) private sceneRef?: ElementRef<HTMLDivElement>;
  @ViewChild('promosField', { static: true }) private promosFieldRef?: ElementRef<HTMLDivElement>;
  @ViewChild('resenasField', { static: true }) private resenasFieldRef?: ElementRef<HTMLDivElement>;
  @ViewChild('perfilField', { static: true }) private perfilFieldRef?: ElementRef<HTMLDivElement>;
  @ViewChild('crearField', { static: true }) private crearFieldRef?: ElementRef<HTMLDivElement>;

  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly authService = inject(AuthService);
  private readonly homeHeaderService = inject(HomeHeaderService);
  private readonly filtrosEstanqueService = inject(FiltrosEstanqueService);
  private readonly negocioService = inject(NegocioService);
  private readonly negocioSearchService = inject(NegocioSearchService);
  private readonly promocionService = inject(PromocionService);
  private readonly postService = inject(PostService);
  private readonly estanqueFeed = inject(EstanqueFeedService);
  private readonly reviewProductMeta = inject(ReviewProductMetaService);
  private readonly performanceService = inject(NenufarPerformanceService);

  readonly freshLilyImageSrc = DEFAULT_NENUFAR_SMALL_ASSET;
  readonly mustioLilyImageSrc = 'assets/imagenes/nenufar_mustio_small.png';
  readonly performanceProfile = this.performanceService.getProfile();

  readonly crearResenaAbierto = signal(false);
  readonly hoveredTooltip = signal<HoverTooltip | null>(null);
  readonly popup = signal<HomePopup | null>(null);
  readonly promociones = signal<HomePromo[]>([]);
  readonly promoLilies = signal<LilyView[]>([]);
  readonly reviewLilies = signal<LilyView[]>([]);
  readonly negociosDestacados = signal<NegocioLite[]>([]);
  /** null = sin filtro activo (se usa negociosDestacados); array = resultado filtrado por categoria/subcategoria */
  private readonly negociosFiltrados = signal<NegocioLite[] | null>(null);
  readonly filtroEstanqueCargando = signal(false);
  readonly hayFiltroEstanqueActivo = computed(() => this.filtrosEstanqueService.hayFiltroActivo());
  readonly mostrarEstanqueVacio = computed(
    () =>
      this.hayFiltroEstanqueActivo() &&
      !this.filtroEstanqueCargando() &&
      (this.negociosFiltrados()?.length ?? 0) === 0,
  );
  readonly reviewButtonSpinning = signal(false);
  readonly usuarioLogueado = signal<AuthUser | null>(null);
  readonly profileLilies = signal<LilyView[]>([]);
  readonly createLilies = signal<LilyView[]>([]);
  readonly reviewInteractions = signal<Record<number, ReviewInteractionState>>({});
  readonly nombreUsuario = computed(() => {
    const nombre = this.usuarioLogueado()?.nombre;
    return nombre ? String(nombre).split(' ')[0] : 'Invitado';
  });

  private readonly zoneConfigs: Record<ZoneKey, ZonePhysicsConfig> = {
    promos: { targetCount: 8, maxSpeed: 76, minSpeed: 7, damping: 0.991, restitution: 0.78 },
    resenas: { targetCount: 24, maxSpeed: 62, minSpeed: 6, damping: 0.992, restitution: 0.8 },
    perfil: { targetCount: 0, maxSpeed: 72, minSpeed: 6, damping: 0.991, restitution: 0.82 },
    crear: { targetCount: 0, maxSpeed: 70, minSpeed: 6, damping: 0.991, restitution: 0.82 }
  };

  private readonly cooldownMs = 5 * 60 * 1000;
  private readonly recentDisplayWindowMs = 90 * 1000;
  private readonly highlightDurationMs = 1600;
  private animationFrameId = 0;
  private lilyInstanceCounter = 0;
  private lastFrameTime = 0;
  private lastTooltipSyncAt = 0;
  private resizeObserver?: ResizeObserver;
  private reviewSpawnCursor = 0;
  private promoSpawnCursor = 0;
  private profileSpawnCursor = 0;
  private createSpawnCursor = 0;
  private physicsFrameCounter = 0;
  private sessionHydrationSubscription?: Subscription;
  private syncFrameId = 0;
  private viewReady = false;
  private hoveredTarget: HoveredLilyTarget | null = null;
  private reviewButtonSpinTimerId: number | null = null;
  private readonly dataLoadTimerIds = new Set<number>();
  private readonly startupAt = performance.now();
  private firstPondPaintLogged = false;
  private readonly tooltipSyncCadenceMs = 84;
  private readonly tooltipViewportPadding = 12;
  private readonly lilyDoubleClickWindowMs = 320;
  private readonly zoneRuntimes = new Map<ZoneKey, ZoneRuntime>();
  private readonly cooldownUntilByKey = new Map<string, number>();
  private readonly lastShownAtByKey = new Map<string, number>();
  private readonly highlightTimerByKey = new Map<string, number>();
  private lastLilyPrimaryPointer: { id: string; at: number } | null = null;
  private lastLilyDoubleClickAt = 0;

  constructor() {
    effect(() => {
      const pendingPopup = this.homeHeaderService.pendingPopup();
      if (!pendingPopup) {
        return;
      }

      if (pendingPopup.kind === 'info') {
        this.abrirInfo();
      } else {
        this.abrirAyuda();
      }

      this.homeHeaderService.clearPopup(pendingPopup.nonce);
    }, { allowSignalWrites: true });

    effect(() => {
      const announcedReviews = this.estanqueFeed.reviewAnnouncements();
      if (!announcedReviews.length) {
        return;
      }

      announcedReviews.forEach((review) => this.integrateAnnouncedReview(review));
      this.estanqueFeed.clearReviews(announcedReviews.map((review) => review.id));
    }, { allowSignalWrites: true });

    effect(() => {
      const announcedPromotions = this.estanqueFeed.promotionAnnouncements();
      if (!announcedPromotions.length) {
        return;
      }

      announcedPromotions.forEach((promotion) => this.integrateAnnouncedPromotion(promotion));
      this.estanqueFeed.clearPromotions(announcedPromotions.map((promotion) => promotion.id));
    }, { allowSignalWrites: true });

    effect(() => {
      const categoria = this.filtrosEstanqueService.categoria();
      const subcategoria = this.filtrosEstanqueService.subcategoria();
      this.aplicarFiltroEstanque(categoria, subcategoria);
    }, { allowSignalWrites: true });

    effect(() => {
      const limite = this.filtrosEstanqueService.limite();
      this.aplicarLimiteEstanque(limite);
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.title.setTitle('Inicio');
    this.logPerformance('inicio:init', this.performanceProfile);
    this.hidratarSesionPersistida();
    this.seedZoneLilies();
    this.cargarPromocionesInicio();
    this.scheduleDataLoad(
      () => this.cargarNegociosDestacados(),
      this.performanceProfile.secondaryDataDelayMs,
    );
  }

  ngAfterViewInit(): void {
    this.viewReady = true;

    this.zone.runOutsideAngular(() => {
      this.queueZoneSync();

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.queueZoneSync());

        [
          this.sceneRef?.nativeElement,
          this.promosFieldRef?.nativeElement,
          this.resenasFieldRef?.nativeElement,
          this.perfilFieldRef?.nativeElement,
          this.crearFieldRef?.nativeElement
        ].forEach((element) => {
          if (element) {
            this.resizeObserver?.observe(element);
          }
        });
      }

      this.animationFrameId = requestAnimationFrame(this.animate);
    });
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.syncFrameId) {
      cancelAnimationFrame(this.syncFrameId);
    }

    if (this.reviewButtonSpinTimerId !== null) {
      window.clearTimeout(this.reviewButtonSpinTimerId);
      this.reviewButtonSpinTimerId = null;
    }

    this.dataLoadTimerIds.forEach((timerId) => window.clearTimeout(timerId));
    this.dataLoadTimerIds.clear();

    this.resizeObserver?.disconnect();
    this.hoveredTarget = null;
    this.sessionHydrationSubscription?.unsubscribe();

    this.zoneRuntimes.forEach((runtime) => {
      runtime.respawnTimers.forEach((timerId) => window.clearTimeout(timerId));
      runtime.respawnTimers.clear();
    });
    this.zoneRuntimes.clear();
    this.highlightTimerByKey.forEach((timerId) => window.clearTimeout(timerId));
    this.highlightTimerByKey.clear();
  }

  abrirAyuda(): void {
    this.ocultarTooltip();
    this.schedulePopup({ kind: 'ayuda' });
  }

  abrirInfo(): void {
    this.ocultarTooltip();
    this.schedulePopup({ kind: 'info' });
  }

  abrirCrearResena(): void {
    this.ocultarTooltip();

    if (this.usuarioLogueado()?.id) {
      this.schedulePopup(null);
      this.crearResenaAbierto.set(true);
      this.changeDetector.markForCheck();
      return;
    }

    this.schedulePopup({
      kind: 'signin',
      title: 'Inicia sesion para resenar',
      message: 'Necesitas iniciar sesion para crear una resena y guardarla en tu actividad.'
    });
  }

  onCreateReviewClick(): void {
    if (this.reviewButtonSpinTimerId !== null) {
      window.clearTimeout(this.reviewButtonSpinTimerId);
    }

    this.reviewButtonSpinning.set(true);
    this.changeDetector.markForCheck();

    this.reviewButtonSpinTimerId = window.setTimeout(() => {
      this.reviewButtonSpinTimerId = null;
      this.reviewButtonSpinning.set(false);
      this.abrirCrearResena();
      this.changeDetector.markForCheck();
    }, 280);
  }

  abrirPerfil(): void {
    this.ocultarTooltip();

    if (this.usuarioLogueado()?.id) {
      this.schedulePopup(null);
      void this.router.navigate(resolvePrivateProfileRoute(this.usuarioLogueado()));
      return;
    }

    this.schedulePopup({
      kind: 'signin',
      title: 'Inicia sesion',
      message: 'Necesitas iniciar sesion para entrar en tu perfil y recuperar tu actividad.'
    });
  }

  getPrimaryReview(negocio: NegocioLite): NegocioReviewSnippet | null {
    return negocio.latestReviews[0] ?? null;
  }

  getNenufarNegocio(negocio: NegocioLite | NegocioVisualData | null | undefined): string {
    return resolveBusinessNenufarAsset(negocio, DEFAULT_NENUFAR_SMALL_ASSET);
  }

  getLilyImageSrc(item: LilyView): string {
    return addUnsplashParams(this.getPerformanceAwareLilyImage(item), 320);
  }

  getLilyImageSrcset(item: LilyView): string {
    const image = this.getPerformanceAwareLilyImage(item);
    return this.performanceProfile.preferSmallLocalAssets && image.startsWith('assets/')
      ? ''
      : buildUnsplashSrcset(image, [160, 320, 480]);
  }

  getPopupBusinessSrc(negocio: NegocioLite | NegocioVisualData | null | undefined): string {
    return addUnsplashParams(this.getNenufarNegocio(negocio), 544);
  }

  getPopupBusinessSrcset(negocio: NegocioLite | NegocioVisualData | null | undefined): string {
    return buildUnsplashSrcset(this.getNenufarNegocio(negocio), [280, 480, 544]);
  }

  toggleSeguirNegocio(negocio: NegocioLite): void {
    if (!this.usuarioLogueado()?.id) {
      this.schedulePopup({
        kind: 'signin',
        title: 'Inicia sesion para seguir negocios',
        message: 'Necesitas iniciar sesion para guardar este negocio en tu lista de seguidos.'
      });
      return;
    }

    const request$ = negocio.isFollowing
      ? this.negocioService.dejarDeSeguirNegocio(negocio.id)
      : this.negocioService.seguirNegocio(negocio.id);

    request$.subscribe({
      next: (response) => {
        this.patchNegocioDestacado(negocio.id, (item) => ({
          ...item,
          isFollowing: !item.isFollowing,
          followersCount: Number(response.total ?? item.followersCount ?? 0) || 0,
        }));
      },
    });
  }

  limpiarFiltroEstanque(): void {
    this.filtrosEstanqueService.limpiar();
  }

  cerrarCrearResena(): void {
    this.crearResenaAbierto.set(false);
    this.changeDetector.markForCheck();
  }

  cerrarPopup(): void {
    this.schedulePopup(null);
  }

  formatearFecha(fechaISO: string): string {
    const fecha = new Date(fechaISO);
    if (Number.isNaN(fecha.getTime())) {
      return 'Hace poco';
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short'
    }).format(fecha);
  }

  formatearFechaCompleta(fechaISO: string): string {
    const fecha = new Date(fechaISO);
    if (Number.isNaN(fecha.getTime())) {
      return 'Sin fecha';
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(fecha);
  }

  getEstrellas(puntuacion: number): string {
    const nota = this.clamp(Math.round(Number(puntuacion) || 0), 0, 5);
    return `${'★'.repeat(nota)}${'☆'.repeat(5 - nota)}`;
  }

  getReviewProductLabel(
    review:
      | ({
          productoNombre?: string | null;
          nombreProducto?: string | null;
          servicioNombre?: string | null;
        } & Partial<NegocioReviewSnippet>)
      | null
      | undefined,
  ): string | null {
    return this.reviewProductMeta.getPrimaryProductLabel(review);
  }

  getReviewProductLabels(review: Partial<NegocioReviewSnippet> | null | undefined): string[] {
    return this.reviewProductMeta.getProductLabels(review);
  }

  getReviewPendingProductLabels(review: Partial<NegocioReviewSnippet> | null | undefined): string[] {
    return this.reviewProductMeta.getPendingSuggestionLabels(review);
  }

  getReviewPostId(review: Partial<NegocioReviewSnippet> | null | undefined): number | null {
    const postId = Number(review?.postId ?? 0);
    return Number.isFinite(postId) && postId > 0 ? postId : null;
  }

  getReviewInteraction(review: Partial<NegocioReviewSnippet>): ReviewInteractionState {
    return this.reviewInteractions()[Number(review.id)] ?? this.createInitialReviewInteraction(review);
  }

  updateReviewCommentDraft(review: Partial<NegocioReviewSnippet>, value: string): void {
    const reviewId = Number(review.id ?? 0);
    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return;
    }

    this.patchReviewInteraction(reviewId, {
      ...this.getReviewInteraction(review),
      commentDraft: value,
      error: null,
    });
  }

  toggleReviewLike(review: Partial<NegocioReviewSnippet>): void {
    const postId = this.getReviewPostId(review);
    const reviewId = Number(review.id ?? 0);
    if (!postId || !Number.isFinite(reviewId) || reviewId <= 0) {
      return;
    }

    if (!this.usuarioLogueado()?.id) {
      this.patchReviewInteraction(reviewId, {
        ...this.getReviewInteraction(review),
        error: 'Inicia sesión para dar like a esta reseña.',
      });
      return;
    }

    const current = this.getReviewInteraction(review);
    if (current.togglingLike) {
      return;
    }

    this.patchReviewInteraction(reviewId, { ...current, togglingLike: true, error: null });
    const request$ = current.likedByMe
      ? this.postService.unlike(postId)
      : this.postService.like(postId);

    request$.subscribe({
      next: () => {
        const next = this.getReviewInteraction(review);
        const likedByMe = !current.likedByMe;
        const likesCount = Math.max(0, next.likesCount + (likedByMe ? 1 : -1));
        this.patchReviewInteraction(reviewId, {
          ...next,
          likedByMe,
          likesCount,
          togglingLike: false,
          error: null,
        });
        this.patchReviewStats(reviewId, { likedByMe, likesCount });
      },
      error: () => {
        this.patchReviewInteraction(reviewId, {
          ...this.getReviewInteraction(review),
          togglingLike: false,
          error: 'El like de la reseña no se actualizó.',
        });
      },
    });
  }

  submitReviewComment(review: Partial<NegocioReviewSnippet>): void {
    const postId = this.getReviewPostId(review);
    const reviewId = Number(review.id ?? 0);
    if (!postId || !Number.isFinite(reviewId) || reviewId <= 0) {
      return;
    }

    if (!this.usuarioLogueado()?.id) {
      this.patchReviewInteraction(reviewId, {
        ...this.getReviewInteraction(review),
        error: 'Inicia sesión para comentar esta reseña.',
      });
      return;
    }

    const current = this.getReviewInteraction(review);
    const contenido = current.commentDraft.trim();
    if (!contenido || current.submittingComment) {
      return;
    }

    this.patchReviewInteraction(reviewId, {
      ...current,
      submittingComment: true,
      error: null,
    });

    this.postService.crearComentario(postId, contenido).subscribe({
      next: (comment) => {
        const next = this.getReviewInteraction(review);
        const comments = [...next.comments, comment];
        this.patchReviewInteraction(reviewId, {
          ...next,
          comments,
          commentsCount: comments.length,
          commentDraft: '',
          submittingComment: false,
          error: null,
        });
        this.patchReviewStats(reviewId, { comentariosCount: comments.length });
      },
      error: () => {
        this.patchReviewInteraction(reviewId, {
          ...this.getReviewInteraction(review),
          submittingComment: false,
          error: 'El comentario no se publicó.',
        });
      },
    });
  }

  manejarComentarioResenaCreado(event: ResenaComentarioCreadoEvent): void {
    this.patchReviewStats(event.resenaId, {
      comentariosCount: event.comentariosCount,
    });
  }

  manejarLikeResenaCambiado(event: ResenaLikeCambiadoEvent): void {
    this.patchReviewStats(event.resenaId, {
      likedByMe: event.likedByMe,
      likesCount: event.likesCount,
    });
  }

  handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrarPopup();
    }
  }

  irALogin(): void {
    this.schedulePopup(null);
    void this.router.navigate(['/estanque']);
  }

  goToNegocio(negocio: NavigableBusiness | null | undefined): void {
    if (!negocio) {
      this.schedulePopup({
        kind: 'navigationError',
        title: 'Negocio no disponible',
        message: 'Este negocio no se abrió porque le falta una dirección pública.',
      });
      return;
    }

    const negocioId = Number(negocio.id ?? 0);
    const negocioDuenoId = Number(negocio.duenoId ?? 0);
    const ownedBusinessId = resolveOwnedBusinessId(this.usuarioLogueado());
    const usuarioActualId = Number(this.usuarioLogueado()?.id ?? 0);
    const esMiNegocio =
      (Number.isFinite(negocioId) && negocioId > 0 && ownedBusinessId === negocioId) ||
      (Number.isFinite(negocioDuenoId) && negocioDuenoId > 0 && negocioDuenoId === usuarioActualId);

    if (esMiNegocio) {
      this.schedulePopup(null);
      void this.router.navigate(resolvePrivateProfileRoute(this.usuarioLogueado()));
      return;
    }

    const negocioRoute = resolveNegocioRouteCommands(negocio);
    if (negocioRoute) {
      this.schedulePopup(null);
      void this.router.navigate(negocioRoute);
      return;
    }

    this.schedulePopup({
      kind: 'navigationError',
      title: 'Negocio no disponible',
      message: 'Este negocio no se abrió porque le falta una dirección pública.',
    });
  }

  /**
   * Pool de negocios que debe usarse para construir los nenufares del estanque, recortado
   * a la cantidad elegida en el contador del header (FiltrosEstanqueService.limite), que
   * solo cambia cuando el usuario pulsa "OK".
   */
  private negociosParaEstanque(): NegocioLite[] {
    const pool = this.negociosFiltrados() ?? this.negociosDestacados();
    return pool.slice(0, this.filtrosEstanqueService.limite());
  }

  private filtroEstanqueActivoAnterior = false;

  private aplicarFiltroEstanque(categoria: FiltroCategoria, subcategoria: FiltroSubcategoria): void {
    if (!categoria && !subcategoria) {
      if (!this.filtroEstanqueActivoAnterior) {
        // Estado inicial sin filtro: todavia no hay nada que resincronizar.
        return;
      }

      this.filtroEstanqueActivoAnterior = false;
      this.negociosFiltrados.set(null);
      this.filtroEstanqueCargando.set(false);
      this.resincronizarZonasFiltradas();
      return;
    }

    this.filtroEstanqueActivoAnterior = true;
    this.filtroEstanqueCargando.set(true);

    this.negocioSearchService
      .search('', {
        ...(categoria ? { categoriaId: categoria.id } : {}),
        ...(subcategoria ? { subcategoriaId: subcategoria.id } : {}),
      })
      .pipe(catchError(() => of([] as NegocioLite[])))
      .subscribe((items) => {
        this.negociosFiltrados.set(items);
        this.filtroEstanqueCargando.set(false);
        this.resincronizarZonasFiltradas();
        this.changeDetector.markForCheck();
      });
  }

  /** Vacia y reconstruye las zonas que dependen de negocios (resenas/promos) tras un cambio de filtro. */
  private resincronizarZonasFiltradas(): void {
    this.reviewLilies.set([]);
    this.promoLilies.set([]);
    this.reconcileZonePopulation('resenas');
    this.reconcileZonePopulation('promos');
    this.queueZoneSync();
    this.changeDetector.markForCheck();
  }

  private cargarNegociosDestacados(): void {
    this.negocioSearchService.showcase(this.performanceProfile.showcaseLimit).subscribe({
      next: (items) => {
        this.logPerformance('inicio:negocios-listos', {
          negocios: items.length,
          ms: Math.round(performance.now() - this.startupAt),
        });
        this.negociosDestacados.update((current) => this.mergeBusinesses(current, items));
        this.reconcileZonePopulation('resenas');
        this.reconcileZonePopulation('promos');
        this.queueZoneSync();
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.negociosDestacados.update((items) => items);
        this.reconcileZonePopulation('resenas');
        this.reconcileZonePopulation('promos');
        this.queueZoneSync();
        this.changeDetector.markForCheck();
      },
    });
  }

  /** Ultimo limite ya aplicado al estanque; evita resincronizar en el primer render del effect. */
  private limiteEstanqueAnterior = this.filtrosEstanqueService.limite();

  /**
   * Reacciona al contador de nenúfares del header (solo cambia al pulsar "OK"): si no hay
   * categoria/subcategoria activa y se pide más negocios de los que ya están cargados,
   * amplia negociosDestacados pidiendo ese límite al backend antes de resincronizar el
   * estanque. Si hay filtro activo, no hace falta: aplicarFiltroEstanque ya trae hasta 30
   * resultados por búsqueda y negociosParaEstanque() recorta al límite elegido.
   */
  private aplicarLimiteEstanque(limite: number): void {
    if (limite === this.limiteEstanqueAnterior) {
      // Primer disparo del effect (o mismo valor ya aplicado): nada que resincronizar.
      return;
    }

    this.limiteEstanqueAnterior = limite;

    if (!this.hayFiltroEstanqueActivo() && limite > this.negociosDestacados().length) {
      this.ampliarNegociosDestacados(limite);
    }

    this.resincronizarZonasFiltradas();
  }

  private ampliarNegociosDestacados(limite: number): void {
    this.negocioSearchService.showcase(limite).subscribe({
      next: (items) => {
        this.negociosDestacados.update((current) => this.mergeBusinesses(current, items));
        this.reconcileZonePopulation('resenas');
        this.reconcileZonePopulation('promos');
        this.queueZoneSync();
        this.changeDetector.markForCheck();
      },
      error: () => {
        // Si falla la ampliacion, negociosParaEstanque() ya recorta al pool ya disponible.
      },
    });
  }

  private scheduleDataLoad(task: () => void, delayMs: number): void {
    if (delayMs <= 0) {
      task();
      return;
    }

    const timerId = window.setTimeout(() => {
      this.dataLoadTimerIds.delete(timerId);
      task();
    }, delayMs);

    this.dataLoadTimerIds.add(timerId);
  }

  private logPerformance(label: string, payload?: unknown): void {
    this.performanceService.logDev(label, payload);
  }

  private cargarPromocionesInicio(): void {
    this.promocionService.findActivas()
      .pipe(
        map((items) =>
          items
            .map((item) => this.toHomePromo(item))
            .filter((item): item is HomePromo => item !== null),
        ),
        catchError(() => of(PROMOS_MOCK)),
      )
      .subscribe({
        next: (items) => {
          this.logPerformance('inicio:promos-listas', {
            promociones: items.length,
            ms: Math.round(performance.now() - this.startupAt),
          });
          this.promociones.update((current) => this.mergePromotions(current, items));
          this.reconcileZonePopulation('promos');
          this.queueZoneSync();
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.promociones.update((current) => this.mergePromotions(current, PROMOS_MOCK));
          this.reconcileZonePopulation('promos');
          this.queueZoneSync();
          this.changeDetector.markForCheck();
        },
      });
  }

  private createInitialReviewInteraction(
    review: Partial<NegocioReviewSnippet>,
  ): ReviewInteractionState {
    return {
      commentDraft: '',
      comments: [],
      commentsCount: Number(review.comentariosCount ?? 0) || 0,
      error: null,
      likedByMe: Boolean(review.likedByMe),
      likesCount: Number(review.likesCount ?? 0) || 0,
      loading: false,
      submittingComment: false,
      togglingLike: false,
    };
  }

  private patchReviewInteraction(reviewId: number, state: ReviewInteractionState): void {
    this.reviewInteractions.update((items) => ({
      ...items,
      [reviewId]: state,
    }));
    this.changeDetector.markForCheck();
  }

  private loadReviewInteractionsForBusiness(business: NegocioLite): void {
    business.latestReviews.forEach((review) => this.loadReviewInteraction(review));
  }

  private loadReviewInteraction(review: NegocioReviewSnippet): void {
    const reviewId = Number(review.id ?? 0);
    const postId = this.getReviewPostId(review);
    if (!postId || !Number.isFinite(reviewId) || reviewId <= 0) {
      return;
    }

    const existing = this.reviewInteractions()[reviewId];
    if (existing?.loading || existing?.comments.length) {
      return;
    }

    this.patchReviewInteraction(reviewId, {
      ...(existing ?? this.createInitialReviewInteraction(review)),
      loading: true,
      error: null,
    });

    this.postService.listLikes(postId).subscribe({
      next: (likesResponse) => {
        const usuarioId = Number(this.usuarioLogueado()?.id ?? 0);
        const likedByMe =
          Number.isFinite(usuarioId) &&
          usuarioId > 0 &&
          likesResponse.likes.some((like) => Number(like.usuarioId) === usuarioId);

        this.patchReviewInteraction(reviewId, {
          ...this.getReviewInteraction(review),
          likedByMe,
          likesCount: likesResponse.count,
        });
        this.patchReviewStats(reviewId, { likedByMe, likesCount: likesResponse.count });
      },
      error: () => {
        this.patchReviewInteraction(reviewId, {
          ...this.getReviewInteraction(review),
          error: 'No se han podido cargar los likes.',
        });
      },
    });

    this.postService.listComentarios(postId).subscribe({
      next: (comments) => {
        this.patchReviewInteraction(reviewId, {
          ...this.getReviewInteraction(review),
          comments,
          commentsCount: comments.length,
          loading: false,
        });
        this.patchReviewStats(reviewId, { comentariosCount: comments.length });
      },
      error: () => {
        this.patchReviewInteraction(reviewId, {
          ...this.getReviewInteraction(review),
          loading: false,
          error: 'No se han podido cargar los comentarios.',
        });
      },
    });
  }

  private patchReviewStats(
    reviewId: number,
    stats: { likedByMe?: boolean; likesCount?: number; comentariosCount?: number },
  ): void {
    const patchReview = <T extends NegocioReviewSnippet>(review: T): T =>
      review.id === reviewId ? { ...review, ...stats } : review;

    this.negociosDestacados.update((items) =>
      items.map((business) => ({
        ...business,
        latestReviews: business.latestReviews.map((review) => patchReview(review)),
      })),
    );

    const activePopup = this.popup();
    if (activePopup?.kind === 'review') {
      this.popup.set({
        ...activePopup,
        review:
          activePopup.review.id === reviewId
            ? { ...activePopup.review, ...stats }
            : activePopup.review,
        business: {
          ...activePopup.business,
          latestReviews: activePopup.business.latestReviews.map((review) =>
            patchReview(review),
          ),
        },
      });
    }
  }

  manejarResenaCreada(respuesta: any): void {
    this.integrateAnnouncedReview(this.normalizeReviewAnnouncement(respuesta));
    this.crearResenaAbierto.set(false);
    this.changeDetector.markForCheck();
  }

  private normalizeReviewAnnouncement(response: unknown): PondReviewAnnouncement {
    const payload = (response && typeof response === 'object' ? response : {}) as Record<string, unknown>;
    const mergedPayload = this.reviewProductMeta.mergeReview(payload);
    const productoNombre = this.reviewProductMeta.getPrimaryProductLabel(mergedPayload);

    return {
      id: Number(payload['id'] ?? Date.now()),
      negocioId: Number(payload['negocioId'] ?? 0),
      ...(Number.isFinite(Number(payload['postId'])) ? { postId: Number(payload['postId']) } : {}),
      ...(typeof payload['likesCount'] === 'number' ? { likesCount: Number(payload['likesCount']) } : {}),
      ...(typeof payload['likedByMe'] === 'boolean' ? { likedByMe: Boolean(payload['likedByMe']) } : {}),
      ...(typeof payload['comentariosCount'] === 'number' ? { comentariosCount: Number(payload['comentariosCount']) } : {}),
      contenido: String(
        payload['contenido'] ??
          'Tu nueva reseña ya está flotando por el estanque y volverá a aparecer en el negocio.',
      ),
      puntuacion: Number(payload['puntuacion'] ?? 5),
      selloNenufar: Boolean(payload['selloNenufar']),
      fechaISO: String(payload['fechaISO'] ?? new Date().toISOString()),
      autorNombre:
        typeof payload['autorNombre'] === 'string'
          ? payload['autorNombre']
          : this.usuarioLogueado()?.nombre ?? 'Tu',
      usuarioNickname:
        typeof payload['usuarioNickname'] === 'string'
          ? payload['usuarioNickname']
          : this.usuarioLogueado()?.nickname,
      usuarioFoto:
        typeof payload['usuarioFoto'] === 'string'
          ? payload['usuarioFoto']
          : this.usuarioLogueado()?.foto ?? null,
      productoNombre,
      productos:
        (mergedPayload as { productos?: PondReviewAnnouncement['productos'] }).productos ?? [],
      productosSugeridos:
        (mergedPayload as { productosSugeridos?: PondReviewAnnouncement['productosSugeridos'] }).productosSugeridos ?? [],
      negocio: (payload['negocio'] as PondReviewAnnouncement['negocio']) ?? null,
    };
  }

  private integrateAnnouncedReview(announcement: PondReviewAnnouncement): void {
    const business = this.buildBusinessFromSnapshot(
      announcement.negocio,
      announcement.negocioId,
    );
    const review = this.buildReviewFromAnnouncement(announcement, business);

    this.negociosDestacados.update((items) => {
      const current = items.find((item) => item.id === business.id) ?? null;
      const reviewCount = Math.max(
        Number(current?.reviewCount ?? 0) + (this.businessHasReview(current, review.id) ? 0 : 1),
        Number(current?.reviewCount ?? 0),
        1,
      );
      const averageRating =
        current && current.reviewCount > 0 && !this.businessHasReview(current, review.id)
          ? Number(
              (
                ((current.averageRating || 0) * current.reviewCount + review.puntuacion) /
                Math.max(1, current.reviewCount + 1)
              ).toFixed(1),
            )
          : current?.averageRating ?? review.puntuacion;

      const mergedBusiness = this.mergeBusiness(
        current ?? business,
        {
          ...business,
          reviewCount,
          averageRating,
          latestReviews: this.mergeReviewCollections([review], current?.latestReviews ?? []),
        },
      );

      return this.upsertBusiness(items, mergedBusiness);
    });

    if (this.negocioVisibleEnEstanque(business.id)) {
      this.forceInsertPriorityItem(
        'resenas',
        this.createReviewLily(review, this.isFollowedBusiness(review.business), 'burst'),
      );
    }
    this.queueZoneSync();
    this.changeDetector.markForCheck();
  }

  /** Comprueba si un negocio cumple el filtro de categoria/subcategoria activo en el estanque. */
  private negocioVisibleEnEstanque(negocioId: number): boolean {
    if (!this.hayFiltroEstanqueActivo()) {
      return true;
    }

    return this.negociosParaEstanque().some((item) => item.id === negocioId);
  }

  private integrateAnnouncedPromotion(announcement: PondPromotionAnnouncement): void {
    const estadoNormalizado = String(announcement.estado ?? 'PUBLICADO').trim().toUpperCase();
    const promoEsVisible = announcement.activa !== false && estadoNormalizado !== 'OCULTO' && estadoNormalizado !== 'BORRADOR';

    if (!promoEsVisible) {
      this.promociones.update((items) => items.filter((item) => item.id !== announcement.id));
      this.promoLilies.update((items) => items.filter((item) => item.id !== `promo:${announcement.id}`));
      this.queueZoneSync();
      this.changeDetector.markForCheck();
      return;
    }

    if (announcement.negocio) {
      this.negociosDestacados.update((items) =>
        this.upsertBusiness(
          items,
          this.buildBusinessFromSnapshot(announcement.negocio, announcement.negocioId),
        ),
      );
    }

    const nextPromo = this.toHomePromoFromAnnouncement(announcement);
    if (!nextPromo) {
      return;
    }

    this.promociones.update((items) => this.mergePromotions(items, [nextPromo]));

    const visiblePromoId = this.promoLilies().find((item) => item.promo?.id === nextPromo.id)?.id ?? null;
    if (visiblePromoId) {
      this.highlightVisibleItem('promos', visiblePromoId);
      this.changeDetector.markForCheck();
      return;
    }

    if (this.negocioVisibleEnEstanque(nextPromo.negocioId)) {
      this.forceInsertPriorityItem(
        'promos',
        this.createPromoLily(nextPromo, this.isFollowedPromotion(nextPromo), 'burst'),
      );
    }
    this.queueZoneSync();
    this.changeDetector.markForCheck();
  }

  private buildBusinessFromSnapshot(
    snapshot: PondReviewAnnouncement['negocio'] | PondPromotionAnnouncement['negocio'],
    fallbackId: number,
  ): NegocioLite {
    const negocioId = Number(snapshot?.id ?? fallbackId);
    const categoriaNombre =
      typeof snapshot?.categoria === 'string'
        ? snapshot.categoria
        : snapshot?.categoria?.nombre;

    return {
      id: Number.isFinite(negocioId) && negocioId > 0 ? negocioId : fallbackId,
      nombre: String(snapshot?.nombre ?? '').trim() || `Negocio ${fallbackId}`,
      ...(snapshot?.slug?.trim() ? { slug: snapshot.slug.trim() } : {}),
      ...(snapshot?.nickname?.trim() ? { nickname: snapshot.nickname.trim() } : {}),
      ...(snapshot?.ciudad?.trim() ? { ciudad: snapshot.ciudad.trim() } : {}),
      ...(snapshot?.provincia?.trim() ? { provincia: snapshot.provincia.trim() } : {}),
      ...(Number.isFinite(Number(snapshot?.duenoId)) ? { duenoId: Number(snapshot?.duenoId) } : {}),
      ...(categoriaNombre?.trim() ? { categoria: { nombre: categoriaNombre.trim() } } : {}),
      ...(snapshot?.descripcion?.trim() ? { descripcion: snapshot.descripcion.trim() } : {}),
      ...(snapshot?.foto?.trim() ? { foto: snapshot.foto.trim() } : {}),
      ...(snapshot?.fotoPerfil?.trim() ? { fotoPerfil: snapshot.fotoPerfil.trim() } : {}),
      ...(snapshot?.fotoPortada?.trim() ? { fotoPortada: snapshot.fotoPortada.trim() } : {}),
      ...(snapshot?.imagenNenufar?.trim() ? { imagenNenufar: snapshot.imagenNenufar.trim() } : {}),
      ...(snapshot?.nenufarActivo?.trim() ? { nenufarActivo: snapshot.nenufarActivo.trim() } : {}),
      ...(snapshot?.assetNenufar?.trim() ? { assetNenufar: snapshot.assetNenufar.trim() } : {}),
      ...(snapshot?.nenufarColor?.trim() ? { nenufarColor: snapshot.nenufarColor.trim() } : {}),
      ...(snapshot?.nenufarAsset?.trim() ? { nenufarAsset: snapshot.nenufarAsset.trim() } : {}),
      ...(snapshot?.nenufarKey?.trim() ? { nenufarKey: snapshot.nenufarKey.trim() } : {}),
      ...(typeof snapshot?.verificado === 'boolean' ? { verificado: snapshot.verificado } : {}),
      reviewCount: 0,
      averageRating: 0,
      latestReviews: [],
      isFollowing: Boolean(snapshot?.isFollowing ?? snapshot?.isFollowedByMe),
      followersCount: Number(snapshot?.followersCount ?? 0) || 0,
    };
  }

  private buildReviewFromAnnouncement(
    announcement: PondReviewAnnouncement,
    business: NegocioLite,
  ): PondReviewItem {
    const contenido = String(announcement.contenido ?? '').trim();
    return {
      id: Number(announcement.id ?? Date.now()),
      negocioId: business.id,
      business,
      autorNombre: String(announcement.autorNombre ?? 'Cliente de Nenúfar').trim() || 'Cliente de Nenúfar',
      contenido,
      contenidoCorto: contenido.length > 132 ? `${contenido.slice(0, 129)}...` : contenido,
      fechaISO: String(announcement.fechaISO ?? new Date().toISOString()),
      ...(Number.isFinite(Number(announcement.postId)) ? { postId: Number(announcement.postId) } : {}),
      ...(typeof announcement.likesCount === 'number' ? { likesCount: announcement.likesCount } : {}),
      ...(typeof announcement.likedByMe === 'boolean' ? { likedByMe: announcement.likedByMe } : {}),
      ...(typeof announcement.comentariosCount === 'number' ? { comentariosCount: announcement.comentariosCount } : {}),
      puntuacion: Number(announcement.puntuacion ?? 0) || 0,
      selloNenufar: Boolean(announcement.selloNenufar),
      ...(announcement.productoNombre?.trim() ? { productoNombre: announcement.productoNombre.trim() } : {}),
      ...(announcement.productos?.length ? { productos: announcement.productos } : {}),
      ...(announcement.productosSugeridos?.length ? { productosSugeridos: announcement.productosSugeridos } : {}),
      ...(announcement.usuarioNickname?.trim() ? { usuarioNickname: announcement.usuarioNickname.trim() } : {}),
      ...(announcement.usuarioFoto?.trim() ? { usuarioFoto: announcement.usuarioFoto.trim() } : {}),
    };
  }

  private businessHasReview(
    business: NegocioLite | null | undefined,
    reviewId: number,
  ): boolean {
    return Boolean(
      business?.latestReviews?.some((review) => Number(review.id ?? 0) === reviewId),
    );
  }

  private mergeReviewCollections(
    ...reviewLists: Array<Array<NegocioReviewSnippet | PondReviewItem>>
  ): NegocioReviewSnippet[] {
    const byId = new Map<number, NegocioReviewSnippet>();

    reviewLists
      .flat()
      .filter((review) => Number.isFinite(Number(review?.id ?? NaN)))
      .sort((left, right) =>
        String(right.fechaISO ?? '').localeCompare(String(left.fechaISO ?? '')),
      )
      .forEach((review) => {
        const reviewId = Number(review.id ?? 0);
        if (!byId.has(reviewId)) {
          byId.set(reviewId, review);
        }
      });

    return Array.from(byId.values())
      .sort((left, right) =>
        String(right.fechaISO ?? '').localeCompare(String(left.fechaISO ?? '')),
      )
      .slice(0, 6);
  }

  private mergeBusiness(existing: NegocioLite, incoming: NegocioLite): NegocioLite {
    const incomingCount = Number(incoming.reviewCount ?? 0);
    const existingCount = Number(existing.reviewCount ?? 0);

    return {
      ...existing,
      ...incoming,
      latestReviews: this.mergeReviewCollections(
        incoming.latestReviews ?? [],
        existing.latestReviews ?? [],
      ),
      reviewCount: Math.max(incomingCount, existingCount),
      averageRating:
        incomingCount >= existingCount
          ? Number(incoming.averageRating ?? existing.averageRating ?? 0)
          : Number(existing.averageRating ?? incoming.averageRating ?? 0),
      isFollowing: Boolean(incoming.isFollowing ?? existing.isFollowing),
      followersCount: Number(incoming.followersCount ?? existing.followersCount ?? 0) || 0,
    };
  }

  private upsertBusiness(items: NegocioLite[], nextBusiness: NegocioLite): NegocioLite[] {
    const nextItems = items.filter((item) => item.id !== nextBusiness.id);
    nextItems.unshift(nextBusiness);
    return this.sortBusinesses(nextItems);
  }

  private mergeBusinesses(
    current: NegocioLite[],
    incoming: NegocioLite[],
  ): NegocioLite[] {
    const businessById = new Map<number, NegocioLite>();

    [...current, ...incoming].forEach((business) => {
      const businessId = Number(business.id ?? 0);
      if (!Number.isFinite(businessId) || businessId <= 0) {
        return;
      }

      const existing = businessById.get(businessId);
      businessById.set(
        businessId,
        existing ? this.mergeBusiness(existing, business) : business,
      );
    });

    return this.sortBusinesses(Array.from(businessById.values()));
  }

  private sortBusinesses(items: NegocioLite[]): NegocioLite[] {
    return [...items].sort((left, right) => {
      const followDelta = Number(Boolean(right.isFollowing)) - Number(Boolean(left.isFollowing));
      if (followDelta !== 0) {
        return followDelta;
      }

      const reviewDelta = Number(right.reviewCount ?? 0) - Number(left.reviewCount ?? 0);
      if (reviewDelta !== 0) {
        return reviewDelta;
      }

      return String(left.nombre ?? '').localeCompare(String(right.nombre ?? ''));
    });
  }

  private mergePromotions(current: HomePromo[], incoming: HomePromo[]): HomePromo[] {
    const promoById = new Map<number, HomePromo>();

    [...current, ...incoming].forEach((promo) => {
      const promoId = Number(promo.id ?? 0);
      if (!Number.isFinite(promoId) || promoId <= 0) {
        return;
      }

      const existing = promoById.get(promoId);
      promoById.set(
        promoId,
        existing
          ? {
              ...existing,
              ...promo,
              creadoEnISO: promo.creadoEnISO ?? existing.creadoEnISO,
              negocio: promo.negocio ?? existing.negocio,
            }
          : promo,
      );
    });

    return Array.from(promoById.values()).sort((left, right) =>
      this.getPromoTimestamp(right) - this.getPromoTimestamp(left),
    );
  }

  private isFollowedBusiness(
    business: NegocioLite | NegocioVisualData | null | undefined,
  ): boolean {
    return Boolean((business as { isFollowing?: boolean } | null)?.isFollowing);
  }

  private isFollowedPromotion(promo: HomePromo): boolean {
    return this.isFollowedBusiness(this.getPromoBusiness(promo));
  }

  private getZoneTargetCount(zone: ZoneKey): number {
    const width =
      this.sceneRef?.nativeElement.clientWidth ??
      (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const profile = this.performanceService.getProfile(width);

    switch (zone) {
      case 'resenas':
        return profile.reviewLilyCount;
      case 'promos':
        return profile.promoLilyCount;
      case 'perfil':
      case 'crear':
        return 0;
    }
  }

  private getZonePhysicsConfig(zone: ZoneKey): ZonePhysicsConfig {
    const width =
      this.sceneRef?.nativeElement.clientWidth ??
      (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const profile = this.performanceService.getProfile(width);
    const base = this.zoneConfigs[zone];

    return {
      ...base,
      targetCount: this.getZoneTargetCount(zone),
      maxSpeed: base.maxSpeed * profile.motionSpeedMultiplier,
      minSpeed: base.minSpeed * profile.motionSpeedMultiplier,
      damping:
        profile.mode === 'full'
          ? base.damping
          : Math.min(0.997, base.damping + (profile.mode === 'lite' ? 0.004 : 0.002)),
    };
  }

  private reconcileZonePopulation(zone: ZoneKey): void {
    const signalRef = this.getSignalForZone(zone);
    const targetCount = this.getZoneTargetCount(zone);
    const currentItems = signalRef();

    if (!targetCount) {
      if (currentItems.length) {
        signalRef.set([]);
      }
      return;
    }

    let nextItems = [...currentItems];
    if (nextItems.length > targetCount) {
      const keepIds = new Set(
        [...nextItems]
          .sort((left, right) =>
            right.priority - left.priority || right.insertedAt - left.insertedAt,
          )
          .slice(0, targetCount)
          .map((item) => item.id),
      );
      nextItems = nextItems.filter((item) => keepIds.has(item.id));
    }

    const blockedKeys = new Set(nextItems.map((item) => item.id));
    while (nextItems.length < targetCount) {
      const nextItem = this.createNextZoneItem(zone, blockedKeys);
      if (!nextItem) {
        break;
      }

      nextItems.push(nextItem);
      blockedKeys.add(nextItem.id);
      this.registerItemShown(nextItem);
    }

    signalRef.set(nextItems);
  }

  private getVisibleKeysForZone(zone: ZoneKey): Set<string> {
    return new Set(this.getSignalForZone(zone)().map((item) => item.id));
  }

  private registerItemShown(item: LilyView): void {
    this.lastShownAtByKey.set(item.id, Date.now());
    this.cooldownUntilByKey.delete(item.id);
  }

  private registerItemCooldown(itemKey: string): void {
    this.cooldownUntilByKey.set(itemKey, Date.now() + this.cooldownMs);
  }

  private isCoolingDown(itemKey: string): boolean {
    const until = this.cooldownUntilByKey.get(itemKey) ?? 0;
    if (!until) {
      return false;
    }

    if (until <= Date.now()) {
      this.cooldownUntilByKey.delete(itemKey);
      return false;
    }

    return true;
  }

  private hasBeenShownRecently(itemKey: string): boolean {
    const shownAt = this.lastShownAtByKey.get(itemKey) ?? 0;
    return shownAt > 0 && Date.now() - shownAt < this.recentDisplayWindowMs;
  }

  private forceInsertPriorityItem(zone: ZoneKey, nextItem: LilyView): void {
    const signalRef = this.getSignalForZone(zone);
    const visibleItems = signalRef();

    if (visibleItems.some((item) => item.id === nextItem.id)) {
      this.highlightVisibleItem(zone, nextItem.id);
      return;
    }

    this.cooldownUntilByKey.delete(nextItem.id);
    const stampedItem = {
      ...nextItem,
      insertedAt: Date.now(),
    };
    const targetCount = this.getZoneTargetCount(zone);

    if (visibleItems.length < targetCount) {
      signalRef.set([...visibleItems, stampedItem]);
      this.registerItemShown(stampedItem);
      return;
    }

    const replaceIndex = this.pickReplacementIndex(visibleItems);
    if (replaceIndex < 0) {
      signalRef.set([...visibleItems, stampedItem]);
      this.registerItemShown(stampedItem);
      return;
    }

    const removed = visibleItems[replaceIndex];
    const nextVisibleItems = [...visibleItems];
    nextVisibleItems.splice(replaceIndex, 1, stampedItem);
    signalRef.set(nextVisibleItems);
    this.handleRemovedVisibleItem(removed.id);
    this.registerItemCooldown(removed.id);
    this.registerItemShown(stampedItem);
  }

  private pickReplacementIndex(items: LilyView[]): number {
    if (!items.length) {
      return -1;
    }

    let lowestIndex = 0;
    for (let index = 1; index < items.length; index += 1) {
      const current = items[index];
      const lowest = items[lowestIndex];
      if (
        current.priority < lowest.priority ||
        (current.priority === lowest.priority && current.insertedAt < lowest.insertedAt)
      ) {
        lowestIndex = index;
      }
    }

    return lowestIndex;
  }

  private handleRemovedVisibleItem(itemId: string): void {
    if (this.hoveredTarget?.item.id === itemId) {
      this.ocultarTooltip();
    }

    const activePopup = this.popup();
    if (activePopup && 'lilyId' in activePopup && activePopup.lilyId === itemId) {
      this.schedulePopup(null);
    }
  }

  private highlightVisibleItem(zone: ZoneKey, itemId: string): void {
    const signalRef = this.getSignalForZone(zone);
    signalRef.update((items) =>
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              highlighted: false,
            }
          : item,
      ),
    );

    queueMicrotask(() => {
      signalRef.update((items) =>
        items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                highlighted: true,
              }
            : item,
        ),
      );
      this.scheduleHighlightCleanup(zone, itemId);
      this.changeDetector.markForCheck();
    });
  }

  private scheduleHighlightCleanup(zone: ZoneKey, itemId: string): void {
    const currentTimer = this.highlightTimerByKey.get(itemId);
    if (currentTimer) {
      window.clearTimeout(currentTimer);
    }

    const timerId = window.setTimeout(() => {
      this.highlightTimerByKey.delete(itemId);
      this.getSignalForZone(zone).update((items) =>
        items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                highlighted: false,
              }
            : item,
        ),
      );
      this.changeDetector.markForCheck();
    }, this.highlightDurationMs);

    this.highlightTimerByKey.set(itemId, timerId);
  }

  onLilyHoverStart(event: MouseEvent, item: LilyView): void {
    const element = event.currentTarget as HTMLElement | null;
    if (!element) {
      return;
    }

    this.hoveredTarget = {
      item,
      element,
      pointerX: event.clientX,
      pointerY: event.clientY
    };
    this.syncTooltipFromHoveredTarget(true);
  }

  onLilyHoverMove(event: MouseEvent, item: LilyView): void {
    const element = event.currentTarget as HTMLElement | null;
    if (!element) {
      return;
    }

    if (!this.hoveredTarget || this.hoveredTarget.item.id !== item.id) {
      this.hoveredTarget = {
        item,
        element,
        pointerX: event.clientX,
        pointerY: event.clientY
      };
      this.syncTooltipFromHoveredTarget(true);
      return;
    }

    this.hoveredTarget.element = element;
    this.hoveredTarget.pointerX = event.clientX;
    this.hoveredTarget.pointerY = event.clientY;
    this.syncTooltipFromHoveredTarget();
  }

  ocultarTooltip(): void {
    this.hoveredTarget = null;
    if (!this.hoveredTooltip()) {
      return;
    }

    this.hoveredTooltip.set(null);
    this.changeDetector.markForCheck();
  }

  onLilyPointerDown(event: PointerEvent, item: LilyView): void {
    if (event.button !== 0) {
      return;
    }

    const now = performance.now();
    const isMouseDoubleClick =
      event.pointerType === 'mouse' &&
      (
        event.detail > 1 ||
        (
          this.lastLilyPrimaryPointer?.id === item.id &&
          now - this.lastLilyPrimaryPointer.at <= this.lilyDoubleClickWindowMs
        )
      );

    if (isMouseDoubleClick) {
      this.lastLilyDoubleClickAt = now;
      this.openLilyDetailFromGesture(event, item);
      return;
    }

    this.lastLilyPrimaryPointer = event.pointerType === 'mouse'
      ? { id: item.id, at: now }
      : null;

    event.preventDefault();
    event.stopPropagation();
    this.ocultarTooltip();

    const runtime = this.zoneRuntimes.get(item.zone);
    const body = runtime?.bodies.find((candidate) => candidate.id === item.id);
    if (!runtime || !body) {
      return;
    }

    const rect = runtime.host.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const dNorm = this.applyImpulseFromPoint(
      runtime,
      body,
      localX,
      localY,
      performance.now() * 0.001
    );

    this.emitRipple(event.clientX, event.clientY, 0.82 + dNorm * 0.34);
  }

  onLilyContextMenu(event: MouseEvent, item: LilyView): void {
    this.openLilyDetailFromGesture(event, item);
  }

  onLilyDoubleClick(event: MouseEvent, item: LilyView): void {
    const now = performance.now();
    if (now - this.lastLilyDoubleClickAt < 240) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.lastLilyDoubleClickAt = now;
    this.openLilyDetailFromGesture(event, item);
  }

  onScenePointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as Element | null;
    if (
      target?.closest(
        '.zone-lily, .floating-review-btn, .popup-overlay, .popup-card, .popup-close, ' +
          '.modal, .modal-backdrop, input, textarea, button'
      )
    ) {
      return;
    }

    this.ocultarTooltip();
    this.emitRipple(event.clientX, event.clientY, 1);
  }

  verPromo(promo: HomePromo): void {
    this.goToNegocio(this.getPromoBusiness(promo));
  }

  private openLilyDetailFromGesture(event: MouseEvent, item: LilyView): void {
    event.preventDefault();
    event.stopPropagation();
    this.lastLilyPrimaryPointer = null;
    this.ocultarTooltip();
    this.emitRipple(event.clientX, event.clientY, 0.92);
    this.abrirPopupDesdeNenufar(item);
  }

  private abrirPopupDesdeNenufar(item: LilyView): void {
    switch (item.kind) {
      case 'promo':
        if (item.promo) {
          this.schedulePopup({ kind: 'promo', lilyId: item.id, promo: item.promo });
        }
        break;
      case 'review':
        if (item.business && item.review) {
          this.openReviewPopup(item.id, item.business, item.review);
        }
        break;
      case 'business':
        if (item.business) {
          this.schedulePopup({ kind: 'business', lilyId: item.id, business: item.business });
        }
        break;
      case 'profile':
        this.schedulePopup({ kind: 'profile', lilyId: item.id });
        break;
      case 'create':
        this.schedulePopup({ kind: 'create', lilyId: item.id });
        break;
    }
  }

  private openReviewPopup(lilyId: string, business: NegocioLite, review: PondReviewItem): void {
    this.schedulePopup({ kind: 'review', lilyId, business, review });
    this.loadReviewInteraction(review);
  }

  private patchNegocioDestacado(
    negocioId: number,
    updater: (item: NegocioLite) => NegocioLite,
  ): void {
    this.negociosDestacados.update((items) =>
      items.map((item) => (item.id === negocioId ? updater(item) : item)),
    );
    const nextBusiness = this.negociosDestacados().find((item) => item.id === negocioId) ?? null;

    const activePopup = this.popup();
    if (activePopup?.kind === 'review' && activePopup.business.id === negocioId && nextBusiness) {
      const nextReview = nextBusiness.latestReviews.find((review) => review.id === activePopup.review.id);
      this.openReviewPopup(
        activePopup.lilyId,
        nextBusiness,
        nextReview
          ? { ...nextReview, negocioId: nextBusiness.id, business: nextBusiness }
          : { ...activePopup.review, negocioId: nextBusiness.id, business: nextBusiness },
      );
    }

    this.reviewLilies.update((items) =>
      items.map((item) =>
        item.business?.id === negocioId && nextBusiness
          ? {
              ...item,
              business: nextBusiness,
              ...(item.review
                ? {
                    review:
                      (() => {
                        const nextReview = nextBusiness.latestReviews.find(
                          (review) => review.id === item.review?.id,
                        );
                        return nextReview
                          ? {
                              ...item.review,
                              ...nextReview,
                              business: nextBusiness,
                              negocioId: nextBusiness.id,
                            }
                          : {
                              ...item.review,
                              business: nextBusiness,
                              negocioId: nextBusiness.id,
                            };
                      })(),
                  }
                : {}),
            }
          : item,
      ),
    );
    this.changeDetector.markForCheck();
  }

  private animate = (timestamp: number): void => {
    const frameIntervalMs = this.performanceProfile.frameIntervalMs;
    if (this.lastFrameTime && timestamp - this.lastFrameTime < frameIntervalMs) {
      this.animationFrameId = requestAnimationFrame(this.animate);
      return;
    }

    const dt = this.lastFrameTime ? Math.min((timestamp - this.lastFrameTime) / 1000, 0.032) : 0.016;
    const elapsed = timestamp * 0.001;
    this.lastFrameTime = timestamp;

    const profile = this.performanceProfile;
    this.physicsFrameCounter += 1;
    const runLocalCollisions =
      this.physicsFrameCounter % Math.max(1, profile.localCollisionEveryNFrames) === 0;
    const runSharedCollisions =
      profile.enableSharedCollisions &&
      this.physicsFrameCounter % Math.max(1, profile.sharedCollisionEveryNFrames) === 0;

    this.zoneRuntimes.forEach((runtime) =>
      this.updateZone(runtime, dt, elapsed, runLocalCollisions),
    );
    if (runSharedCollisions) {
      this.applySharedPondCollisions(elapsed);
    }
    this.syncTooltipFromHoveredTarget(false, timestamp);

    if (!this.firstPondPaintLogged && this.zoneRuntimes.size) {
      this.firstPondPaintLogged = true;
      this.logPerformance('inicio:estanque-pintado', {
        activeLilies: this.reviewLilies().length + this.promoLilies().length,
        ms: Math.round(performance.now() - this.startupAt),
      });
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private applyImpulseFromPoint(
    runtime: ZoneRuntime,
    body: LilyBody,
    impactX: number,
    impactY: number,
    now: number
  ): number {
    const dx = body.x - impactX;
    const dy = body.y - impactY;
    const distance = Math.hypot(dx, dy);
    const safeDistance = distance || 0.001;
    const nx = dx / safeDistance;
    const ny = dy / safeDistance;
    const dNorm = this.clamp(distance / Math.max(body.r, 1), 0, 1);
    const impulseMultiplier = this.performanceProfile.impulseMultiplier;
    const minForce = 120 * impulseMultiplier;
    const maxForce = 310 * impulseMultiplier;
    const force = this.lerp(minForce, maxForce, dNorm);
    const torque = ((impactX - body.x) * ny - (impactY - body.y) * nx) / Math.max(body.r, 1);

    body.vx += nx * force;
    body.vy += ny * force;
    body.angVel += torque * 0.08;
    body.lastTouchedAt = now;
    body.escapeUntil = now + 1.05;

    this.limitSpeed(body, runtime.config.maxSpeed * 4.4);
    return dNorm;
  }

  private applyZoneBodies(bodies: LilyBody[]): void {
    bodies.forEach((body) => {
      if (!body.element) {
        return;
      }

      body.element.style.transform =
        `translate3d(${body.x - body.r}px, ${body.y - body.r}px, 0) rotate(${body.angle}deg)`;
    });
  }

  private attachElement(body: LilyBody, host: HTMLDivElement): void {
    body.element = host.querySelector<HTMLElement>(`[data-lily-id="${body.id}"]`) ?? undefined;
    if (body.element) {
      const nextRadius = Math.max(body.element.offsetWidth, body.element.offsetHeight) / 2;
      if (nextRadius > 0) {
        body.r = nextRadius;
      }
    }
  }

  private buildTooltip(item: LilyView): Omit<HoverTooltip, 'placement' | 'x' | 'y'> | null {
    if (item.kind === 'promo' && item.promo) {
      return {
        tone: 'promo',
        title: item.promo.titulo,
        text: `${item.promo.negocioNombre} · ${item.promo.descuentoTexto}. ${item.promo.descripcionCorta}`
      };
    }

    if (item.kind === 'review' && item.business) {
      const latest = item.review ?? item.business.latestReviews[0];
      return {
        tone: 'review',
        title: item.business.nombre,
        text: latest
          ? `${latest.autorNombre} · ${this.getEstrellas(latest.puntuacion)} · ${latest.contenidoCorto}`
          : `${item.business.categoria?.nombre || 'Negocio local'} · Disponible en el estanque`
      };
    }

    if (item.kind === 'business' && item.business) {
      const latest = item.business.latestReviews[0];
      return {
        tone: 'review',
        title: item.business.nombre,
        text: latest
          ? `${latest.autorNombre} · ${this.getEstrellas(latest.puntuacion)} · ${latest.contenidoCorto}`
          : `${item.business.categoria?.nombre || 'Negocio local'} · Disponible en el estanque`,
      };
    }

    if (item.kind === 'profile') {
      return {
        tone: 'profile',
        title: this.usuarioLogueado()?.id ? 'Abrir perfil' : 'Perfil invitado',
        text: this.usuarioLogueado()?.id
          ? 'Doble clic o clic derecho para abrir tu perfil.'
          : 'Inicia sesion para entrar en tu perfil.'
      };
    }

    if (item.kind === 'create') {
      return {
        tone: 'create',
        title: 'Nueva resena',
        text: this.usuarioLogueado()?.id
          ? 'Doble clic o clic derecho para ver la ficha y crear una resena.'
          : 'Inicia sesion para publicar una resena.'
      };
    }

    return null;
  }

  private buildTooltipState(target: HoveredLilyTarget): HoverTooltip | null {
    if (!target.element.isConnected) {
      return null;
    }

    const base = this.buildTooltip(target.item);
    if (!base) {
      return null;
    }

    const rect = target.element.getBoundingClientRect();
    const estimatedWidth = this.clamp(window.innerWidth * 0.44, 180, 280);
    const centerX = rect.left + rect.width / 2;
    const pointerOffset = (target.pointerX - centerX) * 0.22;
    const x = this.clamp(
      centerX + pointerOffset,
      estimatedWidth / 2 + this.tooltipViewportPadding,
      window.innerWidth - estimatedWidth / 2 - this.tooltipViewportPadding
    );
    // Cambiamos a "below" en cuanto el nenúfar pasa la mitad superior del viewport
    // (no esperamos a que esté pegado al header) para que el tooltip nunca se corte.
    const showBelow = rect.top < window.innerHeight * 0.55;

    return {
      ...base,
      placement: showBelow ? 'below' : 'above',
      x,
      y: showBelow ? rect.bottom + 10 : rect.top - 10
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private actualizarNenufaresDeSesion(): void {
    this.profileLilies.update((items) =>
      items.map((item) =>
        item.kind === 'profile'
          ? {
              ...item,
              label: this.usuarioLogueado()?.id
                ? `Perfil de ${this.nombreUsuario()}`
                : 'Perfil invitado',
              subtitle: this.usuarioLogueado()?.id ? 'Abrir tu zona privada' : 'Inicia sesion'
            }
          : item
      )
    );

    this.createLilies.update((items) =>
      items.map((item) =>
        item.kind === 'create'
          ? {
              ...item,
              subtitle: this.usuarioLogueado()?.id
                ? 'Abrir ficha de nueva resena'
                : 'Necesitas sesion'
            }
          : item
      )
    );

    this.queueZoneSync();
    this.changeDetector.markForCheck();
  }

  private aplicarUsuarioHydratado(usuario: AuthUser | null): void {
    this.usuarioLogueado.set(usuario);
    this.actualizarNenufaresDeSesion();
  }

  private createBody(runtime: ZoneRuntime, item: LilyView, occupied: LilyBody[]): LilyBody {
    const body: LilyBody = {
      id: item.id,
      dataRef: item,
      x: runtime.size.width * 0.5,
      y: runtime.size.height * 0.5,
      vx: this.randomBetween(-runtime.config.maxSpeed * 0.55, runtime.config.maxSpeed * 0.55),
      vy: this.randomBetween(-runtime.config.maxSpeed * 0.55, runtime.config.maxSpeed * 0.55),
      r: this.fallbackRadiusForZone(item.zone),
      angle: this.randomBetween(-12, 12),
      angVel: this.randomBetween(-0.014, 0.014),
      driftSeed: Math.random() * Math.PI * 2,
      lastTouchedAt: 0,
      escapeUntil: 0
    };

    this.attachElement(body, runtime.host);
    const occupiedBodies = [
      ...occupied,
      ...this.getSharedPondBodies(runtime.key),
    ];

    if (item.entryMotion === 'burst') {
      this.placeBurstBody(runtime, body, occupiedBodies);
    } else {
      this.placeBodyWithoutOverlap(runtime, body, occupiedBodies);
    }

    return body;
  }

  private createCreateLily(): LilyView {
    return {
      id: `crear-${++this.lilyInstanceCounter}`,
      zone: 'crear',
      kind: 'create',
      label: 'Crear resena',
      insertedAt: Date.now(),
      priority: 0,
      subtitle: this.usuarioLogueado()?.id ? 'Abrir ficha de nueva resena' : 'Necesitas sesion',
      tone: 'fresh'
    };
  }

  private getPriorityBusinessIds(): Set<number> {
    return new Set(
      this.negociosParaEstanque()
        .filter((item) => item.isFollowing)
        .map((item) => item.id),
    );
  }

  private buildReviewCandidates(): PondCandidate[] {
    const followedBusinessIds = this.getPriorityBusinessIds();
    const reviewById = new Map<number, PondReviewItem>();

    this.negociosParaEstanque().forEach((business) => {
      (business.latestReviews ?? []).forEach((review) => {
        const reviewId = Number(review.id ?? 0);
        if (!Number.isFinite(reviewId) || reviewId <= 0) {
          return;
        }

        reviewById.set(reviewId, {
          ...review,
          negocioId: business.id,
          business,
        });
      });
    });

    return Array.from(reviewById.values()).map((review) => {
      const prioritario = followedBusinessIds.has(review.business.id);
      return {
        key: `review:${review.id}`,
        item: this.createReviewLily(review, prioritario),
        priority: prioritario ? 700 : 500,
        timestamp: Date.parse(review.fechaISO ?? '') || 0,
      };
    });
  }

  private buildBusinessCandidates(): PondCandidate[] {
    const followedBusinessIds = this.getPriorityBusinessIds();

    return this.negociosParaEstanque()
      .filter((business) => Number.isFinite(Number(business.id ?? 0)) && Number(business.id ?? 0) > 0)
      .map((business) => {
        const prioritario = followedBusinessIds.has(business.id);
        return {
          key: `business:${business.id}`,
          item: this.createBusinessLily(business, prioritario),
          priority: prioritario ? 300 : 100,
          timestamp: Number(business.reviewCount ?? 0),
        };
      });
  }

  private buildPromoCandidates(): PondCandidate[] {
    const hayFiltro = this.hayFiltroEstanqueActivo();
    const negociosVisiblesIds = hayFiltro
      ? new Set(this.negociosParaEstanque().map((business) => business.id))
      : null;

    return this.promociones()
      .filter((promo) => Number.isFinite(Number(promo.id ?? 0)) && Number(promo.id ?? 0) > 0)
      .filter((promo) => !negociosVisiblesIds || negociosVisiblesIds.has(promo.negocioId))
      .map((promo) => {
        const prioritario = this.isFollowedPromotion(promo);
        return {
          key: `promo:${promo.id}`,
          item: this.createPromoLily(promo, prioritario),
          priority: prioritario ? 650 : 450,
          timestamp: this.getPromoTimestamp(promo),
        };
      });
  }

  private pickNextCandidate(
    candidates: PondCandidate[],
    blockedKeys: Set<string>,
  ): PondCandidate | null {
    const eligibleCandidates = candidates
      .filter((candidate) => !blockedKeys.has(candidate.key))
      .filter((candidate) => !this.isCoolingDown(candidate.key))
      .sort((left, right) => {
        const priorityDelta = right.priority - left.priority;
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        const leftRecent = this.hasBeenShownRecently(left.key);
        const rightRecent = this.hasBeenShownRecently(right.key);
        if (leftRecent !== rightRecent) {
          return Number(leftRecent) - Number(rightRecent);
        }

        const leftShownAt = this.lastShownAtByKey.get(left.key) ?? 0;
        const rightShownAt = this.lastShownAtByKey.get(right.key) ?? 0;
        if (leftShownAt !== rightShownAt) {
          return leftShownAt - rightShownAt;
        }

        return right.timestamp - left.timestamp;
      });

    return eligibleCandidates[0] ?? null;
  }

  private createNextZoneItem(
    key: ZoneKey,
    blockedKeys: Set<string> = new Set<string>(),
  ): LilyView | null {
    switch (key) {
      case 'promos': {
        return this.pickNextCandidate(this.buildPromoCandidates(), blockedKeys)?.item ?? null;
      }
      case 'resenas': {
        return this.pickNextCandidate(
          [
            ...this.buildReviewCandidates(),
            ...this.buildBusinessCandidates(),
          ],
          blockedKeys,
        )?.item ?? null;
      }
      case 'perfil':
        this.profileSpawnCursor = (this.profileSpawnCursor + 1) % 1000;
        return this.createProfileLily();
      case 'crear':
        this.createSpawnCursor = (this.createSpawnCursor + 1) % 1000;
        return this.createCreateLily();
    }
  }

  private createProfileLily(): LilyView {
    return {
      id: `perfil-${++this.lilyInstanceCounter}`,
      zone: 'perfil',
      kind: 'profile',
      label: this.usuarioLogueado()?.id ? `Perfil de ${this.nombreUsuario()}` : 'Perfil invitado',
      insertedAt: Date.now(),
      priority: 0,
      subtitle: this.usuarioLogueado()?.id ? 'Abrir tu zona privada' : 'Inicia sesion',
      tone: 'fresh'
    };
  }

  private createPromoLily(
    promo: HomePromo,
    prioritario = false,
    entryMotion: LilyEntryMotion = null,
  ): LilyView {
    return {
      id: `promo:${promo.id}`,
      zone: 'promos',
      kind: 'promo',
      label: promo.titulo,
      insertedAt: Date.now(),
      entryMotion,
      priority: prioritario ? 650 : 450,
      subtitle: `${promo.negocioNombre} · ${promo.descuentoTexto}`,
      promo,
      tone: 'fresh'
    };
  }

  private createReviewLily(
    review: PondReviewItem,
    prioritario = false,
    entryMotion: LilyEntryMotion = null,
  ): LilyView {
    return {
      id: `review:${review.id}`,
      zone: 'resenas',
      kind: 'review',
      label: review.business.nombre,
      insertedAt: Date.now(),
      entryMotion,
      priority: prioritario ? 700 : 500,
      subtitle:
        review.productoNombre
          ? `${review.autorNombre} · ${review.productoNombre}`
          : `${review.autorNombre} · ${review.business.categoria?.nombre || 'Negocio local'}`,
      business: review.business,
      review,
      tone: review.puntuacion >= 3 || review.business.reviewCount === 0 ? 'fresh' : 'mustio'
    };
  }

  private createBusinessLily(
    business: NegocioLite,
    prioritario = false,
  ): LilyView {
    return {
      id: `business:${business.id}`,
      zone: 'resenas',
      kind: 'business',
      label: business.nombre,
      insertedAt: Date.now(),
      priority: prioritario ? 300 : 100,
      subtitle:
        `${business.categoria?.nombre || 'Negocio local'} · ${business.reviewCount} reseña${business.reviewCount !== 1 ? 's' : ''}`,
      business,
      tone: business.averageRating >= 3 || business.reviewCount === 0 ? 'fresh' : 'mustio'
    };
  }

  getLilyImage(item: LilyView): string {
    if (item.kind === 'promo' && item.promo) {
      return this.getNenufarNegocio(this.getPromoBusiness(item.promo));
    }

    if ((item.kind === 'review' || item.kind === 'business') && item.business) {
      return this.getNenufarNegocio(item.business);
    }

    return item.tone === 'mustio' ? this.mustioLilyImageSrc : this.freshLilyImageSrc;
  }

  private getPerformanceAwareLilyImage(item: LilyView): string {
    const image = this.getLilyImage(item);
    if (!this.performanceProfile.preferSmallLocalAssets) {
      return image;
    }

    if (image.endsWith('/nenufar.png')) {
      return item.tone === 'mustio' ? this.mustioLilyImageSrc : DEFAULT_NENUFAR_SMALL_ASSET;
    }

    if (image.endsWith('/nenufar_mustio.png')) {
      return this.mustioLilyImageSrc;
    }

    if (image === DEFAULT_NENUFAR_FALLBACK_ASSET) {
      return DEFAULT_NENUFAR_SMALL_ASSET;
    }

    return image;
  }

  private getPromoBusiness(promo: HomePromo): NegocioVisualData | null {
    const negocioRelacionado = this.negociosParaEstanque().find((item) => item.id === promo.negocioId) ?? null;

    if (!promo.negocio) {
      return negocioRelacionado;
    }

    return {
      ...negocioRelacionado,
      ...promo.negocio,
    };
  }

  private getPromoDescriptionShort(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
      return 'Promocion activa en el estanque.';
    }

    return normalized.length > 96 ? `${normalized.slice(0, 93)}...` : normalized;
  }

  private getPromoDiscountText(promocion: Promocion): string {
    const descuento = Number(promocion.descuento ?? 0);

    switch (promocion.tipoDescuento as TipoDescuento) {
      case 'PORCENTAJE':
        return `${descuento}%`;
      case 'IMPORTE_FIJO':
        return `${descuento} €`;
      case 'PACK':
        return `Pack ${descuento}`;
      case 'DOS_X_UNO':
        return '2x1';
      default:
        return descuento > 0 ? String(descuento) : 'Promo activa';
    }
  }

  private getPromoConditions(promocion: Promocion): string {
    const parts = [
      promocion.codigo ? `Codigo ${promocion.codigo}` : '',
      promocion.fechaInicio ? `Desde ${this.formatearFechaCompleta(promocion.fechaInicio)}` : '',
      promocion.fechaCaducidad ? `Hasta ${this.formatearFechaCompleta(promocion.fechaCaducidad)}` : '',
    ].filter(Boolean);

    return parts.join(' · ') || 'Consulta las condiciones completas en el negocio.';
  }

  private toHomePromo(promocion: Promocion): HomePromo | null {
    const id = Number(promocion.id ?? 0);
    const negocioId = Number(promocion.negocioId ?? promocion.negocio?.id ?? 0);

    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(negocioId) || negocioId <= 0) {
      return null;
    }

    const descripcion = String(promocion.descripcion ?? '').trim();
    const negocioNombre =
      String(promocion.negocio?.nombre ?? promocion['negocioNombre'] ?? '').trim() ||
      `Negocio ${negocioId}`;
    const titulo = String(promocion.titulo ?? promocion['nombre_promo'] ?? '').trim() || 'Promocion activa';
    const fechaCaducidadISO =
      String(promocion.fechaCaducidad ?? promocion['fechaCaducidadISO'] ?? '').trim() ||
      new Date().toISOString();
    const creadoEnISO =
      String(promocion['creadoEn'] ?? promocion['createdAt'] ?? '').trim() ||
      new Date().toISOString();

    return {
      id,
      negocioId,
      negocioNombre,
      titulo,
      descripcion: descripcion || 'Promocion activa en Nenufar.',
      descripcionCorta: this.getPromoDescriptionShort(descripcion),
      descuentoTexto: this.getPromoDiscountText(promocion),
      creadoEnISO,
      fechaCaducidadISO,
      condiciones: this.getPromoConditions(promocion),
      ...(promocion.negocio ? { negocio: promocion.negocio } : {}),
    };
  }

  private toHomePromoFromAnnouncement(
    promocion: PondPromotionAnnouncement,
  ): HomePromo | null {
    const id = Number(promocion.id ?? 0);
    const negocioId = Number(promocion.negocioId ?? 0);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(negocioId) || negocioId <= 0) {
      return null;
    }

    const descripcion = String(promocion.descripcion ?? '').trim();
    return {
      id,
      negocioId,
      negocioNombre:
        String(promocion.negocioNombre ?? promocion.negocio?.nombre ?? '').trim() ||
        `Negocio ${negocioId}`,
      titulo: String(promocion.titulo ?? '').trim() || 'Promocion activa',
      descripcion: descripcion || 'Promocion activa en Nenufar.',
      descripcionCorta: this.getPromoDescriptionShort(descripcion),
      descuentoTexto: this.getPromoDiscountText({
        descuento: Number(promocion.descuento ?? 0),
        tipoDescuento: promocion.tipoDescuento ?? 'PORCENTAJE',
      } as Promocion),
      creadoEnISO: String(promocion.creadoEnISO ?? new Date().toISOString()),
      fechaCaducidadISO:
        String(promocion.fechaCaducidad ?? '').trim() || new Date().toISOString(),
      condiciones: this.getPromoConditions({
        codigo: promocion.codigo ?? null,
        fechaInicio: promocion.fechaInicio ?? null,
        fechaCaducidad: promocion.fechaCaducidad ?? new Date().toISOString(),
      } as Promocion),
      ...(promocion.negocio
        ? {
            negocio: {
              id: promocion.negocio.id,
              nombre:
                promocion.negocio.nombre?.trim() || `Negocio ${promocion.negocio.id}`,
              slug: promocion.negocio.slug ?? null,
              nickname: promocion.negocio.nickname ?? null,
              duenoId: promocion.negocio.duenoId ?? null,
              categoria: promocion.negocio.categoria ?? null,
              fotoPerfil: promocion.negocio.fotoPerfil ?? null,
              imagenNenufar: promocion.negocio.imagenNenufar ?? null,
              nenufarActivo: promocion.negocio.nenufarActivo ?? null,
              assetNenufar: promocion.negocio.assetNenufar ?? null,
              nenufarColor: promocion.negocio.nenufarColor ?? null,
              nenufarKey: promocion.negocio.nenufarKey ?? null,
              nenufarAsset: promocion.negocio.nenufarAsset ?? null,
            },
          }
        : {}),
    };
  }

  private getPromoTimestamp(promo: HomePromo): number {
    return (
      Date.parse(String(promo.creadoEnISO ?? '')) ||
      Date.parse(String(promo.fechaCaducidadISO ?? '')) ||
      0
    );
  }

  private hidratarSesionPersistida(): void {
    const usuarioGuardado = readJson<AuthUser>('usuarioLogueado');

    if (usuarioGuardado) {
      this.aplicarUsuarioHydratado(usuarioGuardado);
      return;
    }

    this.sessionHydrationSubscription?.unsubscribe();
    this.sessionHydrationSubscription = this.authService.hydrateSession({ forceRemote: false }).subscribe({
      next: (usuario) => this.aplicarUsuarioHydratado(usuario),
      error: () => this.aplicarUsuarioHydratado(null)
    });
  }

  private despawnBody(runtime: ZoneRuntime, bodyId: string): void {
    const removed = runtime.bodies.find((body) => body.id === bodyId);
    if (!removed) {
      return;
    }

    runtime.bodies = runtime.bodies.filter((body) => body.id !== bodyId);

    if (this.hoveredTarget?.item.id === bodyId) {
      this.zone.run(() => this.ocultarTooltip());
    }

    const activePopup = this.popup();
    if (activePopup && 'lilyId' in activePopup && activePopup.lilyId === bodyId) {
      this.schedulePopup(null);
    }

    this.registerItemCooldown(bodyId);
    this.removeZoneItem(runtime.key, bodyId);
    this.scheduleRespawn(runtime.key, this.randomBetween(900, 1700));
  }

  private emitRipple(clientX: number, clientY: number, strength: number): void {
    const profile = this.performanceProfile;
    if (!profile.enableRipples) {
      return;
    }

    this.backgroundRef?.triggerRippleAtClientPoint(
      clientX,
      clientY,
      strength * profile.impulseMultiplier,
    );
  }

  private fallbackRadiusForZone(zone: ZoneKey): number {
    switch (zone) {
      case 'promos':
        return 34;
      case 'resenas':
        return 66;
      case 'perfil':
      case 'crear':
        return 76;
    }
  }

  private getSharedPondBodies(zone: ZoneKey): LilyBody[] {
    if (!this.isSharedPondZone(zone)) {
      return [];
    }

    return Array.from(this.zoneRuntimes.values())
      .filter((runtime) => runtime.key !== zone && this.isSharedPondZone(runtime.key))
      .flatMap((runtime) => runtime.bodies);
  }

  private getSharedPondRuntimes(): ZoneRuntime[] {
    return (['resenas', 'promos'] as ZoneKey[])
      .map((zoneKey) => this.zoneRuntimes.get(zoneKey))
      .filter((runtime): runtime is ZoneRuntime => Boolean(runtime));
  }

  private isSharedPondZone(zone: ZoneKey): boolean {
    return zone === 'resenas' || zone === 'promos';
  }

  private getSignalForZone(zone: ZoneKey) {
    switch (zone) {
      case 'promos':
        return this.promoLilies;
      case 'resenas':
        return this.reviewLilies;
      case 'perfil':
        return this.profileLilies;
      case 'crear':
        return this.createLilies;
    }
  }

  private getZoneHost(key: ZoneKey): HTMLDivElement | undefined {
    switch (key) {
      case 'promos':
        return this.promosFieldRef?.nativeElement;
      case 'resenas':
        return this.resenasFieldRef?.nativeElement;
      case 'perfil':
        return this.perfilFieldRef?.nativeElement;
      case 'crear':
        return this.crearFieldRef?.nativeElement;
    }
  }

  private handleBoundary(runtime: ZoneRuntime, body: LilyBody, elapsed: number): void {
    const left = body.r;
    const right = runtime.size.width - body.r;
    const top = body.r;
    const bottom = runtime.size.height - body.r;
    const escapeSpeed = 164;
    const canEscape = elapsed <= body.escapeUntil;

    if (body.x < left) {
      const shouldEscape = canEscape && body.vx < -escapeSpeed;
      if (!shouldEscape) {
        body.x = left;
        body.vx = Math.abs(body.vx) * runtime.config.restitution;
      }
    } else if (body.x > right) {
      const shouldEscape = canEscape && body.vx > escapeSpeed;
      if (!shouldEscape) {
        body.x = right;
        body.vx = -Math.abs(body.vx) * runtime.config.restitution;
      }
    }

    if (body.y < top) {
      const shouldEscape = canEscape && body.vy < -escapeSpeed;
      if (!shouldEscape) {
        body.y = top;
        body.vy = Math.abs(body.vy) * runtime.config.restitution;
      }
    } else if (body.y > bottom) {
      const shouldEscape = canEscape && body.vy > escapeSpeed;
      if (!shouldEscape) {
        body.y = bottom;
        body.vy = -Math.abs(body.vy) * runtime.config.restitution;
      }
    }
  }

  private keepMinimumMotion(body: LilyBody, minSpeed: number, seed: number): void {
    const speed = Math.hypot(body.vx, body.vy);
    if (speed >= minSpeed) {
      return;
    }

    const angle = speed > 0.01 ? Math.atan2(body.vy, body.vx) : seed;
    body.vx = Math.cos(angle) * minSpeed;
    body.vy = Math.sin(angle) * minSpeed;
  }

  private lerp(min: number, max: number, factor: number): number {
    return min + (max - min) * factor;
  }

  private limitSpeed(body: LilyBody, maxSpeed: number): void {
    const speed = Math.hypot(body.vx, body.vy);
    if (speed <= maxSpeed) {
      return;
    }

    const ratio = maxSpeed / speed;
    body.vx *= ratio;
    body.vy *= ratio;
  }

  private placeBodyWithoutOverlap(runtime: ZoneRuntime, body: LilyBody, occupied: LilyBody[]): void {
    const margin = body.r + 10;
    const minX = Math.min(runtime.size.width * 0.5, Math.max(margin, body.r));
    const minY = Math.min(runtime.size.height * 0.5, Math.max(margin, body.r));
    const maxX = Math.max(minX, runtime.size.width - margin);
    const maxY = Math.max(minY, runtime.size.height - margin);

    for (let attempt = 0; attempt < 42; attempt += 1) {
      const x = this.randomBetween(minX, maxX);
      const y = this.randomBetween(minY, maxY);
      const overlaps = occupied.some((candidate) => this.areBodiesOverlapping(x, y, body.r, candidate));

      if (!overlaps) {
        body.x = x;
        body.y = y;
        return;
      }

      body.x = x;
      body.y = y;
    }
  }

  private placeBurstBody(runtime: ZoneRuntime, body: LilyBody, occupied: LilyBody[]): void {
    const centerX = runtime.size.width * 0.5 + this.randomBetween(-48, 48);
    const centerY = runtime.size.height * 0.62 + this.randomBetween(-24, 24);
    body.x = this.clamp(centerX, body.r, Math.max(body.r, runtime.size.width - body.r));
    body.y = this.clamp(centerY, body.r, Math.max(body.r, runtime.size.height - body.r));

    if (occupied.some((candidate) => this.areBodiesOverlapping(body.x, body.y, body.r, candidate))) {
      this.placeBodyWithoutOverlap(runtime, body, occupied);
    }

    body.vx = this.randomBetween(-32, 32);
    body.vy = this.randomBetween(-148, -86);
    body.angVel = this.randomBetween(-0.028, 0.028);
    body.escapeUntil = performance.now() * 0.001 + 0.85;
  }

  private queueZoneSync(): void {
    if (!this.viewReady || this.syncFrameId) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.syncFrameId = requestAnimationFrame(() => {
        this.syncFrameId = 0;
        this.syncZones();
      });
    });
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private removeZoneItem(zone: ZoneKey, bodyId: string): void {
    this.zone.run(() => {
      this.getSignalForZone(zone).update((items) => items.filter((item) => item.id !== bodyId));
      this.queueZoneSync();
      this.changeDetector.markForCheck();
    });
  }

  private rescaleBodies(runtime: ZoneRuntime, nextWidth: number, nextHeight: number): void {
    const previousWidth = runtime.size.width;
    const previousHeight = runtime.size.height;

    runtime.size.width = nextWidth;
    runtime.size.height = nextHeight;

    if (!previousWidth || !previousHeight) {
      return;
    }

    const scaleX = nextWidth / previousWidth;
    const scaleY = nextHeight / previousHeight;

    runtime.bodies.forEach((body) => {
      body.x *= scaleX;
      body.y *= scaleY;
      this.attachElement(body, runtime.host);
      body.x = this.clamp(body.x, body.r, Math.max(body.r, nextWidth - body.r));
      body.y = this.clamp(body.y, body.r, Math.max(body.r, nextHeight - body.r));
    });
  }

  private resolveCircleCollision(first: LilyBody, second: LilyBody, restitution: number): void {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.hypot(dx, dy) || 0.001;
    const minDistance = first.r + second.r - 3;

    if (distance >= minDistance) {
      return;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minDistance - distance;
    const firstMass = Math.max(first.r * first.r, 1);
    const secondMass = Math.max(second.r * second.r, 1);
    const firstInvMass = 1 / firstMass;
    const secondInvMass = 1 / secondMass;
    const invMassSum = firstInvMass + secondInvMass;

    first.x -= nx * overlap * (firstInvMass / invMassSum);
    first.y -= ny * overlap * (firstInvMass / invMassSum);
    second.x += nx * overlap * (secondInvMass / invMassSum);
    second.y += ny * overlap * (secondInvMass / invMassSum);

    const relVx = second.vx - first.vx;
    const relVy = second.vy - first.vy;
    const relAlongNormal = relVx * nx + relVy * ny;

    if (relAlongNormal < 0) {
      const impulse = (-(1 + restitution) * relAlongNormal) / invMassSum;
      first.vx -= impulse * firstInvMass * nx;
      first.vy -= impulse * firstInvMass * ny;
      second.vx += impulse * secondInvMass * nx;
      second.vy += impulse * secondInvMass * ny;
      first.angVel = this.clamp(first.angVel - relAlongNormal * 0.0014, -0.04, 0.04);
      second.angVel = this.clamp(second.angVel + relAlongNormal * 0.0014, -0.04, 0.04);
    }
  }

  private applySharedPondCollisions(elapsed: number): void {
    const runtimes = this.getSharedPondRuntimes();
    if (runtimes.length < 2) {
      return;
    }

    for (let runtimeIndex = 0; runtimeIndex < runtimes.length; runtimeIndex += 1) {
      const firstRuntime = runtimes[runtimeIndex];

      for (let nextRuntimeIndex = runtimeIndex + 1; nextRuntimeIndex < runtimes.length; nextRuntimeIndex += 1) {
        const secondRuntime = runtimes[nextRuntimeIndex];

        firstRuntime.bodies.forEach((firstBody) => {
          secondRuntime.bodies.forEach((secondBody) => {
            this.resolveCircleCollision(
              firstBody,
              secondBody,
              Math.min(firstRuntime.config.restitution, secondRuntime.config.restitution),
            );
          });
        });
      }
    }

    runtimes.forEach((runtime) => {
      runtime.bodies.forEach((body) => this.handleBoundary(runtime, body, elapsed));
      this.applyZoneBodies(runtime.bodies);
    });
  }

  private schedulePopup(nextPopup: HomePopup | null): void {
    this.zone.run(() => {
      queueMicrotask(() => {
        this.popup.set(nextPopup);
        this.changeDetector.markForCheck();
      });
    });
  }

  private scheduleRespawn(zoneKey: ZoneKey, delayMs?: number): void {
    const runtime = this.zoneRuntimes.get(zoneKey);
    if (!runtime) {
      return;
    }

    const timerId = window.setTimeout(() => {
      const activeRuntime = this.zoneRuntimes.get(zoneKey);
      activeRuntime?.respawnTimers.delete(timerId);
      this.zone.run(() => this.respawnZoneItem(zoneKey));
    }, Math.max(0, Math.round(delayMs ?? this.randomBetween(900, 1700))));

    runtime.respawnTimers.add(timerId);
  }

  private seedZoneLilies(): void {
    this.promoLilies.set(this.takeInitialLilies('promos'));
    this.reviewLilies.set(this.takeInitialLilies('resenas'));
    this.profileLilies.set(this.takeInitialLilies('perfil'));
    this.createLilies.set(this.takeInitialLilies('crear'));
    this.queueZoneSync();
  }

  private respawnZoneItem(zone: ZoneKey): void {
    const runtime = this.zoneRuntimes.get(zone);
    if (!runtime) {
      return;
    }

    const signalRef = this.getSignalForZone(zone);
    if (signalRef().length >= runtime.config.targetCount) {
      return;
    }

    const nextItem = this.createNextZoneItem(zone, this.getVisibleKeysForZone(zone));
    if (!nextItem) {
      this.scheduleRespawn(zone, 2400);
      return;
    }

    this.registerItemShown(nextItem);
    signalRef.update((items) => [...items, nextItem]);
    this.queueZoneSync();
    this.changeDetector.markForCheck();
  }

  private syncTooltipFromHoveredTarget(force = false, timestamp = performance.now()): void {
    if (!this.hoveredTarget) {
      return;
    }

    if (!force && timestamp - this.lastTooltipSyncAt < this.tooltipSyncCadenceMs) {
      return;
    }

    const nextTooltip = this.buildTooltipState(this.hoveredTarget);
    this.lastTooltipSyncAt = timestamp;

    if (!nextTooltip) {
      this.hoveredTarget = null;
      if (!this.hoveredTooltip()) {
        return;
      }

      this.zone.run(() => {
        this.hoveredTooltip.set(null);
        this.changeDetector.markForCheck();
      });
      return;
    }

    this.zone.run(() => {
      this.hoveredTooltip.set(nextTooltip);
      this.changeDetector.markForCheck();
    });
  }

  private syncZone(zoneKey: ZoneKey): void {
    const host = this.getZoneHost(zoneKey);
    if (!host || !host.clientWidth || !host.clientHeight) {
      return;
    }

    const items = this.getSignalForZone(zoneKey)();
    const config = this.getZonePhysicsConfig(zoneKey);
    const existing = this.zoneRuntimes.get(zoneKey);

    if (!existing) {
      const runtime: ZoneRuntime = {
        key: zoneKey,
        host,
        config,
        respawnTimers: new Set<number>(),
        bodies: [],
        size: {
          width: host.clientWidth,
          height: host.clientHeight
        }
      };

      items.forEach((item) => {
        runtime.bodies.push(this.createBody(runtime, item, runtime.bodies));
      });
      this.zoneRuntimes.set(zoneKey, runtime);
      this.applyZoneBodies(runtime.bodies);
      return;
    }

    existing.host = host;
    existing.config = config;
    this.rescaleBodies(existing, host.clientWidth, host.clientHeight);

    const currentBodies = new Map(existing.bodies.map((body) => [body.id, body]));
    const nextBodies: LilyBody[] = [];

    for (const item of items) {
      const current = currentBodies.get(item.id);
      if (current) {
        current.dataRef = item;
        this.attachElement(current, existing.host);
        nextBodies.push(current);
      } else {
        nextBodies.push(this.createBody(existing, item, nextBodies));
      }
    }

    existing.bodies = nextBodies;
    this.applyZoneBodies(existing.bodies);
  }

  private syncZones(): void {
    this.reconcileZonePopulation('promos');
    this.reconcileZonePopulation('resenas');
    this.reconcileZonePopulation('perfil');
    this.reconcileZonePopulation('crear');
    this.syncZone('promos');
    this.syncZone('resenas');
    this.syncZone('perfil');
    this.syncZone('crear');
  }

  private takeInitialLilies(zone: ZoneKey): LilyView[] {
    const targetCount = this.getZoneTargetCount(zone);
    const nextItems: LilyView[] = [];
    const blockedKeys = new Set<string>();

    for (let index = 0; index < targetCount; index += 1) {
      const item = this.createNextZoneItem(zone, blockedKeys);
      if (item) {
        nextItems.push(item);
        blockedKeys.add(item.id);
        this.registerItemShown(item);
      }
    }

    return nextItems;
  }

  private updateZone(
    runtime: ZoneRuntime,
    dt: number,
    elapsed: number,
    runCollisions: boolean,
  ): void {
    const frameScale = dt * 60;
    const escapedIds: string[] = [];

    runtime.bodies.forEach((body, index) => {
      if (!body.element) {
        this.attachElement(body, runtime.host);
      }

      body.vx *= Math.pow(runtime.config.damping, frameScale);
      body.vy *= Math.pow(runtime.config.damping, frameScale);
      body.angVel *= Math.pow(0.98, frameScale);

      body.vx += Math.cos(elapsed * 0.72 + body.driftSeed + index) * 0.22 * frameScale;
      body.vy += Math.sin(elapsed * 0.68 + body.driftSeed + index * 0.7) * 0.2 * frameScale;

      this.keepMinimumMotion(body, runtime.config.minSpeed, body.driftSeed + elapsed);
      this.limitSpeed(body, runtime.config.maxSpeed * 4.4);

      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.angle += body.angVel * 60 * dt;

      this.handleBoundary(runtime, body, elapsed);

      if (this.isBodyOutside(runtime, body)) {
        escapedIds.push(body.id);
      }
    });

    if (runCollisions) {
      for (let i = 0; i < runtime.bodies.length; i += 1) {
        for (let j = i + 1; j < runtime.bodies.length; j += 1) {
          this.resolveCircleCollision(runtime.bodies[i], runtime.bodies[j], runtime.config.restitution);
        }
      }
    }

    runtime.bodies.forEach((body) => this.handleBoundary(runtime, body, elapsed));
    this.applyZoneBodies(runtime.bodies);

    escapedIds.forEach((bodyId) => this.despawnBody(runtime, bodyId));
  }

  private isBodyOutside(runtime: ZoneRuntime, body: LilyBody): boolean {
    return (
      body.x < -body.r * 0.5 ||
      body.x > runtime.size.width + body.r * 0.5 ||
      body.y < -body.r * 0.5 ||
      body.y > runtime.size.height + body.r * 0.5
    );
  }

  private areBodiesOverlapping(x: number, y: number, radius: number, body: LilyBody): boolean {
    const dx = x - body.x;
    const dy = y - body.y;
    const minDistance = radius + body.r - 3;
    return dx * dx + dy * dy < minDistance * minDistance;
  }
}
