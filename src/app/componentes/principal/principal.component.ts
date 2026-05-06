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
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';
import {
  AuthService,
  AuthUser,
  resolvePrivateProfileRoute,
} from '../../servicios/authService/auth.service';
import { HomeHeaderService } from '../../servicios/homeHeaderServicio/home-header.service';
import { NegocioService } from '../../servicios/negocioService/negocio.service';
import {
  NegocioLite,
  NegocioReviewSnippet,
  NegocioSearchService,
} from '../../servicios/buscador/negocio-search.service';
import {
  DEFAULT_NENUFAR_SMALL_ASSET,
  getNenufarNegocio as getNenufarNegocioAsset,
  NegocioVisualData,
} from '../../core/negocio/negocio-visuals';
import {
  Promocion,
  PromocionService,
  TipoDescuento,
} from '../../servicios/promocionServicio/promocionService.service';

type HomePromo = PromoMock & {
  negocio?: (NegocioVisualData & {
    categoria?: { id?: number; nombre?: string } | string | null;
    id?: number;
    nombre?: string;
  }) | null;
};

type ZoneKey = 'promos' | 'resenas' | 'perfil' | 'crear';
type LilyKind = 'promo' | 'review' | 'profile' | 'create';
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
  | { kind: 'signin'; message: string; title: string }
  | { kind: 'review'; lilyId: string; business: NegocioLite }
  | { kind: 'promo'; lilyId: string; promo: HomePromo }
  | { kind: 'profile'; lilyId: string }
  | { kind: 'create'; lilyId: string };

type BusinessCatalogItem = {
  categoria: string;
  descripcion: string;
  id: number;
  nombre: string;
};

type LilyView = {
  id: string;
  kind: LilyKind;
  label: string;
  promo?: HomePromo;
  business?: NegocioLite;
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
  imports: [CommonModule, CrearResenaModalComponent, EstanqueBackgroundComponent],
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
  private readonly negocioService = inject(NegocioService);
  private readonly negocioSearchService = inject(NegocioSearchService);
  private readonly promocionService = inject(PromocionService);

  readonly freshLilyImageSrc = DEFAULT_NENUFAR_SMALL_ASSET;
  readonly mustioLilyImageSrc = 'assets/imagenes/nenufar_mustio_small.png';

  readonly crearResenaAbierto = signal(false);
  readonly hoveredTooltip = signal<HoverTooltip | null>(null);
  readonly popup = signal<HomePopup | null>(null);
  readonly promociones = signal<HomePromo[]>([]);
  readonly promoLilies = signal<LilyView[]>([]);
  readonly reviewLilies = signal<LilyView[]>([]);
  readonly negociosDestacados = signal<NegocioLite[]>([]);
  readonly usuarioLogueado = signal<AuthUser | null>(null);
  readonly profileLilies = signal<LilyView[]>([]);
  readonly createLilies = signal<LilyView[]>([]);

  readonly nombreUsuario = computed(() => {
    const nombre = this.usuarioLogueado()?.nombre;
    return nombre ? String(nombre).split(' ')[0] : 'Invitado';
  });

  readonly businessCatalog = computed(() => {
    const catalog = new Map<number, BusinessCatalogItem>();

    for (const promo of this.promociones()) {
      catalog.set(promo.negocioId, {
        id: promo.negocioId,
        nombre: promo.negocioNombre,
        categoria: 'Promocion activa',
        descripcion: promo.descripcionCorta
      });
    }

    for (const negocio of this.negociosDestacados()) {
      if (!catalog.has(negocio.id)) {
        catalog.set(negocio.id, {
          id: negocio.id,
          nombre: negocio.nombre,
          categoria: negocio.categoria?.nombre || 'Negocio local',
          descripcion:
            negocio.latestReviews[0]?.contenidoCorto ||
            negocio.descripcion ||
            'Perfil disponible en el estanque.'
        });
      }
    }

    return Array.from(catalog.values());
  });

  private readonly zoneConfigs: Record<ZoneKey, ZonePhysicsConfig> = {
    promos: { targetCount: 3, maxSpeed: 92, minSpeed: 9, damping: 0.989, restitution: 0.76 },
    resenas: { targetCount: 4, maxSpeed: 84, minSpeed: 8, damping: 0.99, restitution: 0.78 },
    perfil: { targetCount: 1, maxSpeed: 72, minSpeed: 6, damping: 0.991, restitution: 0.82 },
    crear: { targetCount: 1, maxSpeed: 70, minSpeed: 6, damping: 0.991, restitution: 0.82 }
  };

  private animationFrameId = 0;
  private lilyInstanceCounter = 0;
  private lastFrameTime = 0;
  private lastTooltipSyncAt = 0;
  private resizeObserver?: ResizeObserver;
  private reviewSpawnCursor = 0;
  private promoSpawnCursor = 0;
  private profileSpawnCursor = 0;
  private createSpawnCursor = 0;
  private sessionHydrationSubscription?: Subscription;
  private syncFrameId = 0;
  private viewReady = false;
  private hoveredTarget: HoveredLilyTarget | null = null;
  private readonly tooltipSyncCadenceMs = 84;
  private readonly tooltipViewportPadding = 12;
  private readonly zoneRuntimes = new Map<ZoneKey, ZoneRuntime>();

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
  }

  ngOnInit(): void {
    this.title.setTitle('Inicio');
    this.hidratarSesionPersistida();
    this.seedZoneLilies();
    this.cargarPromocionesInicio();
    this.cargarNegociosDestacados();
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

    this.resizeObserver?.disconnect();
    this.hoveredTarget = null;
    this.sessionHydrationSubscription?.unsubscribe();

    this.zoneRuntimes.forEach((runtime) => {
      runtime.respawnTimers.forEach((timerId) => window.clearTimeout(timerId));
      runtime.respawnTimers.clear();
    });
    this.zoneRuntimes.clear();
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
    return getNenufarNegocioAsset(negocio);
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

  handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrarPopup();
    }
  }

  irALogin(): void {
    this.schedulePopup(null);
    void this.router.navigate(['/estanque']);
  }

  irANegocio(negocioId: number): void {
    this.schedulePopup(null);
    this.navegarANegocioPorId(negocioId);
  }

  private cargarNegociosDestacados(): void {
    this.negocioSearchService.showcase(8).subscribe({
      next: (items) => {
        this.negociosDestacados.set(items);
        this.reviewLilies.set(this.takeInitialLilies('resenas'));
        this.queueZoneSync();
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.negociosDestacados.set([]);
        this.reviewLilies.set([]);
        this.queueZoneSync();
        this.changeDetector.markForCheck();
      },
    });
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
          this.promociones.set(items);
          this.promoLilies.set(this.takeInitialLilies('promos'));
          this.queueZoneSync();
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.promociones.set(PROMOS_MOCK);
          this.promoLilies.set(this.takeInitialLilies('promos'));
          this.queueZoneSync();
          this.changeDetector.markForCheck();
        },
      });
  }

  manejarResenaCreada(respuesta: any): void {
    const negocioId = Number(respuesta?.negocioId ?? 0);
    const review: NegocioReviewSnippet = {
      id: Number(respuesta?.id ?? Date.now()),
      autorNombre: this.usuarioLogueado()?.nombre || 'Tu',
      puntuacion: Number(respuesta?.puntuacion ?? 5),
      contenido: String(
        respuesta?.contenido ??
          'Tu nueva reseña ya está flotando por el estanque y volverá a aparecer en el negocio.'
      ),
      contenidoCorto: String(
        respuesta?.contenido ?? 'Tu nueva reseña ya está flotando por el estanque.'
      ).slice(0, 132),
      fechaISO: new Date().toISOString(),
      selloNenufar: Boolean(respuesta?.selloNenufar),
      ...(this.usuarioLogueado()?.nickname ? { usuarioNickname: this.usuarioLogueado()?.nickname } : {}),
      ...(typeof this.usuarioLogueado()?.foto === 'string' ? { usuarioFoto: this.usuarioLogueado()?.foto || undefined } : {}),
    };

    this.negociosDestacados.update((items) =>
      items.map((item) =>
        item.id === negocioId
          ? {
              ...item,
              reviewCount: item.reviewCount + 1,
              latestReviews: [review, ...item.latestReviews].slice(0, 2),
              averageRating: Number(
                (
                  ((item.averageRating || 0) * item.reviewCount + review.puntuacion) /
                  Math.max(1, item.reviewCount + 1)
                ).toFixed(1)
              ),
            }
          : item,
      ),
    );
    this.crearResenaAbierto.set(false);
    this.reviewLilies.set(this.takeInitialLilies('resenas'));
    this.queueZoneSync();
    this.changeDetector.markForCheck();
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
    event.preventDefault();
    event.stopPropagation();
    this.ocultarTooltip();
    this.emitRipple(event.clientX, event.clientY, 0.92);
    this.abrirPopupDesdeNenufar(item);
  }

  onScenePointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as Element | null;
    if (
      target?.closest(
        '.zone-lily, .popup-overlay, .popup-card, .popup-close, .modal, .modal-backdrop, ' +
          'input, textarea, button, .zone-quick-action'
      )
    ) {
      return;
    }

    this.ocultarTooltip();
    this.emitRipple(event.clientX, event.clientY, 1);
  }

  verPromo(promo: HomePromo): void {
    this.schedulePopup(null);
    this.navegarANegocioPorId(promo.negocioId);
  }

  private navegarANegocioPorId(negocioId: number): void {
    void this.router.navigate(['/negocio', negocioId]);
  }

  private abrirPopupDesdeNenufar(item: LilyView): void {
    switch (item.kind) {
      case 'promo':
        if (item.promo) {
          this.schedulePopup({ kind: 'promo', lilyId: item.id, promo: item.promo });
        }
        break;
      case 'review':
        if (item.business) {
          this.schedulePopup({ kind: 'review', lilyId: item.id, business: item.business });
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

  private patchNegocioDestacado(
    negocioId: number,
    updater: (item: NegocioLite) => NegocioLite,
  ): void {
    this.negociosDestacados.update((items) =>
      items.map((item) => (item.id === negocioId ? updater(item) : item)),
    );

    const activePopup = this.popup();
    if (activePopup?.kind === 'review' && activePopup.business.id === negocioId) {
      const nextBusiness = this.negociosDestacados().find((item) => item.id === negocioId);
      if (nextBusiness) {
        this.schedulePopup({
          kind: 'review',
          lilyId: activePopup.lilyId,
          business: nextBusiness,
        });
      }
    }

    this.reviewLilies.update((items) =>
      items.map((item) =>
        item.business?.id === negocioId
          ? {
              ...item,
              business: this.negociosDestacados().find((candidate) => candidate.id === negocioId) ?? item.business,
            }
          : item,
      ),
    );
    this.changeDetector.markForCheck();
  }

  private animate = (timestamp: number): void => {
    const dt = this.lastFrameTime ? Math.min((timestamp - this.lastFrameTime) / 1000, 0.032) : 0.016;
    const elapsed = timestamp * 0.001;
    this.lastFrameTime = timestamp;

    this.zoneRuntimes.forEach((runtime) => this.updateZone(runtime, dt, elapsed));
    this.syncTooltipFromHoveredTarget(false, timestamp);
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
    const minForce = 120;
    const maxForce = 310;
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
      const latest = item.business.latestReviews[0];
      return {
        tone: 'review',
        title: item.business.nombre,
        text: latest
          ? `${latest.autorNombre} · ${this.getEstrellas(latest.puntuacion)} · ${latest.contenidoCorto}`
          : `${item.business.categoria?.nombre || 'Negocio local'} · Disponible en el estanque`
      };
    }

    if (item.kind === 'profile') {
      return {
        tone: 'profile',
        title: this.usuarioLogueado()?.id ? 'Abrir perfil' : 'Perfil invitado',
        text: this.usuarioLogueado()?.id
          ? 'Click derecho para abrir tu perfil.'
          : 'Inicia sesion para entrar en tu perfil.'
      };
    }

    if (item.kind === 'create') {
      return {
        tone: 'create',
        title: 'Nueva resena',
        text: this.usuarioLogueado()?.id
          ? 'Click derecho para ver la ficha y crear una resena.'
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
    const showBelow = rect.top < 124;

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
    this.placeBodyWithoutOverlap(runtime, body, occupied);
    return body;
  }

  private createCreateLily(): LilyView {
    return {
      id: `crear-${++this.lilyInstanceCounter}`,
      zone: 'crear',
      kind: 'create',
      label: 'Crear resena',
      subtitle: this.usuarioLogueado()?.id ? 'Abrir ficha de nueva resena' : 'Necesitas sesion',
      tone: 'fresh'
    };
  }

  private createNextZoneItem(key: ZoneKey): LilyView | null {
    switch (key) {
      case 'promos': {
        const pool = this.promociones();
        if (!pool.length) {
          return null;
        }

        const promo = pool[this.promoSpawnCursor % pool.length];
        this.promoSpawnCursor = (this.promoSpawnCursor + 1) % pool.length;
        return this.createPromoLily(promo);
      }
      case 'resenas': {
        const pool = this.negociosDestacados();
        if (!pool.length) {
          return null;
        }

        const review = pool[this.reviewSpawnCursor % pool.length];
        this.reviewSpawnCursor = (this.reviewSpawnCursor + 1) % pool.length;
        return this.createReviewLily(review);
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
      subtitle: this.usuarioLogueado()?.id ? 'Abrir tu zona privada' : 'Inicia sesion',
      tone: 'fresh'
    };
  }

  private createPromoLily(promo: HomePromo): LilyView {
    return {
      id: `promo-${promo.id}-${++this.lilyInstanceCounter}`,
      zone: 'promos',
      kind: 'promo',
      label: promo.titulo,
      subtitle: `${promo.negocioNombre} · ${promo.descuentoTexto}`,
      promo,
      tone: 'fresh'
    };
  }

  private createReviewLily(business: NegocioLite): LilyView {
    return {
      id: `review-${business.id}-${++this.lilyInstanceCounter}`,
      zone: 'resenas',
      kind: 'review',
      label: business.nombre,
      subtitle: `${business.categoria?.nombre || 'Negocio local'} · ${business.reviewCount} reseña${business.reviewCount !== 1 ? 's' : ''}`,
      business,
      tone: business.averageRating >= 3 || business.reviewCount === 0 ? 'fresh' : 'mustio'
    };
  }

  getLilyImage(item: LilyView): string {
    if (item.kind === 'promo' && item.promo) {
      return this.getNenufarNegocio(this.getPromoBusiness(item.promo));
    }

    if (item.kind === 'review' && item.business) {
      return this.getNenufarNegocio(item.business);
    }

    return item.tone === 'mustio' ? this.mustioLilyImageSrc : this.freshLilyImageSrc;
  }

  private getPromoBusiness(promo: HomePromo): NegocioVisualData | null {
    if (promo.negocio) {
      return promo.negocio;
    }

    return this.negociosDestacados().find((item) => item.id === promo.negocioId) ?? null;
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

    return {
      id,
      negocioId,
      negocioNombre,
      titulo,
      descripcion: descripcion || 'Promocion activa en Nenufar.',
      descripcionCorta: this.getPromoDescriptionShort(descripcion),
      descuentoTexto: this.getPromoDiscountText(promocion),
      fechaCaducidadISO,
      condiciones: this.getPromoConditions(promocion),
      ...(promocion.negocio ? { negocio: promocion.negocio } : {}),
    };
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

    this.removeZoneItem(runtime.key, bodyId);
    this.scheduleRespawn(runtime.key, this.randomBetween(1500, 3000));
  }

  private emitRipple(clientX: number, clientY: number, strength: number): void {
    this.backgroundRef?.triggerRippleAtClientPoint(clientX, clientY, strength);
  }

  private fallbackRadiusForZone(zone: ZoneKey): number {
    switch (zone) {
      case 'promos':
        return 68;
      case 'resenas':
        return 58;
      case 'perfil':
      case 'crear':
        return 76;
    }
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
    const minDistance = first.r + second.r - 6;

    if (distance >= minDistance) {
      return;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minDistance - distance;

    first.x -= nx * overlap * 0.5;
    first.y -= ny * overlap * 0.5;
    second.x += nx * overlap * 0.5;
    second.y += ny * overlap * 0.5;

    const relVx = second.vx - first.vx;
    const relVy = second.vy - first.vy;
    const relAlongNormal = relVx * nx + relVy * ny;

    if (relAlongNormal < 0) {
      const impulse = (-(1 + restitution) * relAlongNormal) / 2;
      first.vx -= impulse * nx;
      first.vy -= impulse * ny;
      second.vx += impulse * nx;
      second.vy += impulse * ny;
      first.angVel = this.clamp(first.angVel - relAlongNormal * 0.0014, -0.04, 0.04);
      second.angVel = this.clamp(second.angVel + relAlongNormal * 0.0014, -0.04, 0.04);
    }
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
    }, Math.max(0, Math.round(delayMs ?? this.randomBetween(1500, 3000))));

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

    const nextItem = this.createNextZoneItem(zone);
    if (!nextItem) {
      this.scheduleRespawn(zone, 2400);
      return;
    }

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
    const config = this.zoneConfigs[zoneKey];
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
    this.syncZone('promos');
    this.syncZone('resenas');
    this.syncZone('perfil');
    this.syncZone('crear');
  }

  private takeInitialLilies(zone: ZoneKey): LilyView[] {
    const targetCount = this.zoneConfigs[zone].targetCount;
    const nextItems: LilyView[] = [];

    for (let index = 0; index < targetCount; index += 1) {
      const item = this.createNextZoneItem(zone);
      if (item) {
        nextItems.push(item);
      }
    }

    return nextItems;
  }

  private updateZone(runtime: ZoneRuntime, dt: number, elapsed: number): void {
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

    for (let i = 0; i < runtime.bodies.length; i += 1) {
      for (let j = i + 1; j < runtime.bodies.length; j += 1) {
        this.resolveCircleCollision(runtime.bodies[i], runtime.bodies[j], runtime.config.restitution);
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
    const minDistance = radius + body.r - 6;
    return dx * dx + dy * dy < minDistance * minDistance;
  }
}
