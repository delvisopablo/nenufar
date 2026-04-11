import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CrearResenaModalComponent } from '../crear-resena/crear-resena-modal/crear-resena-modal.component';
import { PromoMock, PROMOS_MOCK } from '../promocion/promocion/promocionesMock';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';
import { RESENAS_MOCK, ResenaMock } from './resenasMock';

type ZoneKey = 'promos' | 'resenas' | 'perfil' | 'crear';
type LilyKind = 'promo' | 'review' | 'profile' | 'create';
type PopupKind = 'info' | 'ayuda' | 'signin' | 'review';

type HoverTooltip = {
  text: string;
  title: string;
  tone: 'promo' | 'review';
  x: number;
  y: number;
};

type HomePopup = {
  kind: PopupKind;
  lilyId?: string;
  message?: string;
  review?: ResenaMock;
  title?: string;
};

type BusinessCatalogItem = {
  categoria: string;
  descripcion: string;
  id: number;
  nombre: string;
};

type LilyView = {
  badge?: string;
  id: string;
  kind: LilyKind;
  label: string;
  promo?: PromoMock;
  review?: ResenaMock;
  subtitle: string;
  zone: ZoneKey;
};

type LilyBody = {
  angle: number;
  angVel: number;
  drag: number;
  driftSeed: number;
  element?: HTMLElement;
  id: string;
  radius: number;
  speedCapMultiplier: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type ZoneRuntime = {
  bodies: LilyBody[];
  host: HTMLDivElement;
  key: ZoneKey;
  maxSpeed: number;
};

@Component({
  selector: 'app-principal',
  standalone: true,
  imports: [CommonModule, FormsModule, CrearResenaModalComponent, EstanqueBackgroundComponent],
  templateUrl: './principal.component.html',
  styleUrl: './principal.component.css'
})
export class PrincipalComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(EstanqueBackgroundComponent) private backgroundRef?: EstanqueBackgroundComponent;
  @ViewChild('scene', { static: true }) private sceneRef?: ElementRef<HTMLDivElement>;
  @ViewChild('promosZone', { static: true }) private promosZoneRef?: ElementRef<HTMLDivElement>;
  @ViewChild('resenasZone', { static: true }) private resenasZoneRef?: ElementRef<HTMLDivElement>;
  @ViewChild('perfilZone', { static: true }) private perfilZoneRef?: ElementRef<HTMLDivElement>;
  @ViewChild('crearZone', { static: true }) private crearZoneRef?: ElementRef<HTMLDivElement>;

  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly zone = inject(NgZone);

  readonly brandLogoSrc = 'assets/imagenes/flor_logo.png';

  readonly busqueda = signal('');
  readonly crearResenaAbierto = signal(false);
  readonly hoveredTooltip = signal<HoverTooltip | null>(null);
  readonly popup = signal<HomePopup | null>(null);
  readonly promociones = signal<PromoMock[]>(PROMOS_MOCK);
  readonly promoLilies = signal<LilyView[]>([]);
  readonly reviewLilies = signal<LilyView[]>([]);
  readonly resenas = signal<ResenaMock[]>(RESENAS_MOCK);
  readonly usuarioLogueado = signal<any | null>(null);
  readonly profileLilies = signal<LilyView[]>([]);
  readonly createLilies = signal<LilyView[]>([]);

  readonly nombreUsuario = computed(() => {
    const nombre = this.usuarioLogueado()?.nombre;
    return nombre ? String(nombre).split(' ')[0] : 'Nenúfar';
  });

  readonly businessCatalog = computed<BusinessCatalogItem[]>(() => {
    const catalog = new Map<number, BusinessCatalogItem>();

    for (const promo of this.promociones()) {
      catalog.set(promo.negocioId, {
        id: promo.negocioId,
        nombre: promo.negocioNombre,
        categoria: 'Promoción activa',
        descripcion: promo.descripcionCorta
      });
    }

    for (const resena of this.resenas()) {
      if (!catalog.has(resena.negocioId)) {
        catalog.set(resena.negocioId, {
          id: resena.negocioId,
          nombre: resena.negocioNombre,
          categoria: 'Reseñas recientes',
          descripcion: resena.contenidoCorto
        });
      }
    }

    return Array.from(catalog.values());
  });

  readonly resultadosBusqueda = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    if (!termino) {
      return [];
    }

    return this.businessCatalog()
      .filter((negocio) => {
        const texto = `${negocio.nombre} ${negocio.categoria} ${negocio.descripcion}`.toLowerCase();
        return texto.includes(termino);
      })
      .slice(0, 6);
  });

  readonly sinResultadosBusqueda = computed(
    () => Boolean(this.busqueda().trim()) && this.resultadosBusqueda().length === 0
  );

  private animationFrameId = 0;
  private lastFrameTime = 0;
  private resizeObserver?: ResizeObserver;
  private reviewInstanceCounter = 0;
  private reviewSpawnCursor = 0;
  private syncFrameId = 0;
  private viewReady = false;
  private readonly zoneRuntimes = new Map<ZoneKey, ZoneRuntime>();

  ngOnInit(): void {
    this.title.setTitle('Inicio');
    this.usuarioLogueado.set(this.leerJsonLocal('usuarioLogueado'));
    this.refreshStaticLilies();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;

    this.zone.runOutsideAngular(() => {
      this.scheduleZoneSync();

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.scheduleZoneSync());

        const elements = [
          this.sceneRef?.nativeElement,
          this.promosZoneRef?.nativeElement,
          this.resenasZoneRef?.nativeElement,
          this.perfilZoneRef?.nativeElement,
          this.crearZoneRef?.nativeElement
        ];

        elements.forEach((element) => {
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
    this.zoneRuntimes.clear();
  }

  abrirAyuda(): void {
    this.hoveredTooltip.set(null);
    this.popup.set({ kind: 'ayuda' });
  }

  abrirInfo(): void {
    this.hoveredTooltip.set(null);
    this.popup.set({ kind: 'info' });
  }

  buscarPrimerNegocio(): void {
    const primerResultado = this.resultadosBusqueda()[0];
    if (primerResultado) {
      this.seleccionarNegocio(primerResultado);
    }
  }

  cerrarCrearResena(): void {
    this.crearResenaAbierto.set(false);
  }

  cerrarPopup(): void {
    this.popup.set(null);
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
    void this.router.navigate(['/login']);
  }

  lanzarReviewActiva(): void {
    const activePopup = this.popup();
    if (!activePopup?.review?.lanzable || !activePopup.lilyId) {
      this.cerrarPopup();
      return;
    }

    const runtime = this.zoneRuntimes.get('resenas');
    const body = runtime?.bodies.find((item) => item.id === activePopup.lilyId);

    if (body) {
      const angle = this.randomBetween(-0.95, 0.95);
      const horizontal = body.x < (runtime?.host.clientWidth || 0) * 0.5 ? 1 : -1;
      body.vx += Math.cos(angle) * 115 * horizontal;
      body.vy += Math.sin(angle) * 86;
      body.drag = 0.992;
      body.speedCapMultiplier = 6.4;
      body.angVel += this.randomBetween(-0.22, 0.22);
    }

    const nextLilies = this.takeNextReviewLilies(2);
    this.appendReviewLilies(nextLilies);
    this.cerrarPopup();
  }

  manejarResenaCreada(respuesta: any): void {
    const nuevaResena: ResenaMock = {
      id: Number(respuesta?.id ?? Date.now()),
      negocioId: Number(respuesta?.negocioId ?? this.businessCatalog()[0]?.id ?? 1),
      negocioNombre: String(
        respuesta?.negocio?.nombre ??
        this.businessCatalog().find((item) => item.id === Number(respuesta?.negocioId))?.nombre ??
        'Negocio local'
      ),
      autorNombre: this.usuarioLogueado()?.nombre || 'Tú',
      puntuacion: Number(respuesta?.puntuacion ?? 5),
      contenidoCorto: String(
        respuesta?.contenido ?? 'Tu nueva reseña ya está flotando por el estanque.'
      ).slice(0, 140),
      selloNenufar: Boolean(respuesta?.selloNenufar),
      fechaISO: new Date().toISOString(),
      lanzable: true
    };

    this.resenas.update((items) => [nuevaResena, ...items]);
    this.crearResenaAbierto.set(false);
    this.appendReviewLilies([this.createReviewLily(nuevaResena)]);
  }

  manejarLilyClick(item: LilyView): void {
    this.hoveredTooltip.set(null);

    switch (item.kind) {
      case 'promo':
        if (item.promo?.negocioId) {
          void this.router.navigate(['/negocio', item.promo.negocioId]);
        }
        break;
      case 'review':
        if (item.review) {
          this.popup.set({
            kind: 'review',
            lilyId: item.id,
            review: item.review
          });
        }
        break;
      case 'profile':
        this.abrirPerfil();
        break;
      case 'create':
        this.abrirCrearResena();
        break;
    }
  }

  mostrarTooltip(event: MouseEvent, item: LilyView): void {
    const tooltip = this.buildTooltip(item);
    if (!tooltip) {
      return;
    }

    this.hoveredTooltip.set({
      ...tooltip,
      x: event.clientX + 18,
      y: event.clientY - 16
    });
  }

  ocultarTooltip(): void {
    this.hoveredTooltip.set(null);
  }

  onScenePointerDown(event: PointerEvent): void {
    const target = event.target as Element | null;
    if (
      target?.closest(
        '.zone-lily, .top-lily, .topbar, .brand-lockup, .search-shell, .searchbar, ' +
        '.search-results, .search-result, .popup-overlay, .popup-card, .popup-close, ' +
        '.modal, .modal-backdrop, input, textarea, button'
      )
    ) {
      return;
    }

    this.backgroundRef?.triggerRippleAtClientPoint(event.clientX, event.clientY, 1);
  }

  seleccionarNegocio(negocio: BusinessCatalogItem): void {
    this.busqueda.set(negocio.nombre);
    void this.router.navigate(['/negocio', negocio.id]);
  }

  private abrirCrearResena(): void {
    if (this.usuarioLogueado()?.id) {
      this.crearResenaAbierto.set(true);
      return;
    }

    this.popup.set({
      kind: 'signin',
      title: 'Inicia sesión para reseñar',
      message: 'Necesitas iniciar sesión para dejar una reseña y guardarla en tu actividad.'
    });
  }

  private abrirPerfil(): void {
    const idUsuario = this.usuarioLogueado()?.id;
    if (idUsuario) {
      void this.router.navigate(['/perfil', idUsuario]);
      return;
    }

    this.popup.set({
      kind: 'signin',
      title: 'Inicia sesión',
      message: 'Necesitas iniciar sesión para entrar en tu perfil y recuperar tu actividad.'
    });
  }

  private animate = (timestamp: number): void => {
    const dt = this.lastFrameTime ? Math.min((timestamp - this.lastFrameTime) / 1000, 0.032) : 0.016;
    this.lastFrameTime = timestamp;
    const elapsed = timestamp / 1000;

    this.zoneRuntimes.forEach((runtime) => this.updateZone(runtime, dt, elapsed));
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private appendReviewLilies(items: LilyView[]): void {
    if (!items.length) {
      return;
    }

    this.reviewLilies.update((current) => [...current, ...items]);

    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.attachBodiesToZone('resenas', items);
      });
    });
  }

  private applyZoneBodies(bodies: LilyBody[]): void {
    bodies.forEach((body) => {
      if (!body.element) {
        return;
      }

      body.element.style.transform =
        `translate3d(${body.x - body.radius}px, ${body.y - body.radius}px, 0) rotate(${body.angle}deg)`;
    });
  }

  private attachBodiesToZone(key: ZoneKey, items: LilyView[]): void {
    const host = this.getZoneHost(key);
    if (!host || !items.length) {
      return;
    }

    const maxSpeed = this.getZoneMaxSpeed(key);
    const runtime = this.zoneRuntimes.get(key);
    const occupied = runtime?.bodies ?? [];
    const bodies = items.map((item) => this.createBodyForItem(key, host, item, maxSpeed, occupied));

    if (runtime) {
      runtime.bodies.push(...bodies);
      this.applyZoneBodies(runtime.bodies);
      return;
    }

    this.zoneRuntimes.set(key, {
      key,
      host,
      bodies,
      maxSpeed
    });
    this.applyZoneBodies(bodies);
  }

  private buildTooltip(item: LilyView): Omit<HoverTooltip, 'x' | 'y'> | null {
    if (item.kind === 'promo' && item.promo) {
      return {
        tone: 'promo',
        title: `${item.promo.negocioNombre} · ${item.promo.descuentoTexto}`,
        text: item.promo.descripcionCorta
      };
    }

    if (item.kind === 'review' && item.review) {
      return {
        tone: 'review',
        title: `${item.review.autorNombre} · ${this.getEstrellas(item.review.puntuacion)}`,
        text: item.review.contenidoCorto
      };
    }

    return null;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private createBodyForItem(
    key: ZoneKey,
    host: HTMLDivElement,
    item: LilyView,
    maxSpeed: number,
    occupied: LilyBody[]
  ): LilyBody {
    const element = host.querySelector<HTMLElement>(`[data-lily-id="${item.id}"]`) ?? undefined;
    const size = element
      ? Math.max(element.offsetWidth, element.offsetHeight)
      : this.fallbackSizeForZone(key);
    const radius = size / 2;
    const centerX = host.clientWidth / 2;
    const centerY = host.clientHeight / 2;
    let x = centerX;
    let y = centerY;

    if (key === 'perfil' || key === 'crear') {
      x = centerX;
      y = centerY;
    } else {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const nextX = this.randomBetween(radius + 16, Math.max(radius + 16, host.clientWidth - radius - 16));
        const nextY = this.randomBetween(radius + 16, Math.max(radius + 16, host.clientHeight - radius - 16));

        if (!occupied.some((body) => this.areBodiesOverlapping(nextX, nextY, radius, body))) {
          x = nextX;
          y = nextY;
          break;
        }

        x = nextX;
        y = nextY;
      }
    }

    return {
      id: item.id,
      element,
      radius,
      x,
      y,
      vx: this.randomBetween(-maxSpeed * 0.5, maxSpeed * 0.5),
      vy: this.randomBetween(-maxSpeed * 0.5, maxSpeed * 0.5),
      angle: this.randomBetween(-9, 9),
      angVel: this.randomBetween(-0.01, 0.01),
      driftSeed: Math.random() * Math.PI * 2,
      drag: 0.989,
      speedCapMultiplier: 1
    };
  }

  private createReviewLily(review: ResenaMock): LilyView {
    return {
      id: `review-instance-${++this.reviewInstanceCounter}`,
      zone: 'resenas',
      kind: 'review',
      label: review.negocioNombre,
      subtitle: `${review.autorNombre} · ${this.getEstrellas(review.puntuacion)}`,
      review,
      badge: review.selloNenufar ? 'Sello Nenúfar' : undefined
    };
  }

  private fallbackSizeForZone(zone: ZoneKey): number {
    switch (zone) {
      case 'promos':
        return 128;
      case 'resenas':
        return 118;
      case 'perfil':
      case 'crear':
        return 178;
    }
  }

  private getZoneHost(key: ZoneKey): HTMLDivElement | undefined {
    switch (key) {
      case 'promos':
        return this.promosZoneRef?.nativeElement;
      case 'resenas':
        return this.resenasZoneRef?.nativeElement;
      case 'perfil':
        return this.perfilZoneRef?.nativeElement;
      case 'crear':
        return this.crearZoneRef?.nativeElement;
    }
  }

  private getZoneMaxSpeed(key: ZoneKey): number {
    switch (key) {
      case 'promos':
        return 10.8;
      case 'resenas':
        return 9.8;
      case 'perfil':
        return 6.5;
      case 'crear':
        return 6.2;
    }
  }

  private leerJsonLocal(key: string): any {
    const value = localStorage.getItem(key);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn(`No se ha podido leer ${key} desde localStorage`, error);
      return null;
    }
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private refreshStaticLilies(): void {
    const usuario = this.usuarioLogueado();
    const nombreCorto = usuario?.nombre ? String(usuario.nombre).split(' ')[0] : 'Tu perfil';

    this.promoLilies.set(
      this.promociones().slice(0, 3).map((promo) => ({
        id: `promo-${promo.id}`,
        zone: 'promos',
        kind: 'promo',
        label: promo.titulo,
        subtitle: promo.descuentoTexto,
        promo
      }))
    );

    if (!this.reviewLilies().length) {
      this.reviewLilies.set(this.takeNextReviewLilies(4));
    }

    this.profileLilies.set([
      {
        id: 'profile-entry',
        zone: 'perfil',
        kind: 'profile',
        label: nombreCorto,
        subtitle: usuario?.id ? 'Entrar en tu perfil' : 'Inicia sesión'
      }
    ]);

    this.createLilies.set([
      {
        id: 'create-review-entry',
        zone: 'crear',
        kind: 'create',
        label: '+ Reseña',
        subtitle: usuario?.id ? 'Abrir modal' : 'Necesitas sesión'
      }
    ]);

    this.scheduleZoneSync();
  }

  private resolveCircleCollision(first: LilyBody, second: LilyBody): void {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.hypot(dx, dy) || 0.001;
    const minDistance = first.radius + second.radius - 6;

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
      const impulse = (-(1 + 0.86) * relAlongNormal) / 2;
      first.vx -= impulse * nx;
      first.vy -= impulse * ny;
      second.vx += impulse * nx;
      second.vy += impulse * ny;
    }
  }

  private resolveWallBounce(body: LilyBody, width: number, height: number): void {
    const margin = 12;
    const left = body.radius + margin;
    const right = width - body.radius - margin;
    const top = body.radius + margin;
    const bottom = height - body.radius - margin;

    if (body.x <= left) {
      body.x = left;
      body.vx = Math.abs(body.vx);
    } else if (body.x >= right) {
      body.x = right;
      body.vx = -Math.abs(body.vx);
    }

    if (body.y <= top) {
      body.y = top;
      body.vy = Math.abs(body.vy);
    } else if (body.y >= bottom) {
      body.y = bottom;
      body.vy = -Math.abs(body.vy);
    }
  }

  private resolveZoneCollisions(bodies: LilyBody[]): void {
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        this.resolveCircleCollision(bodies[i], bodies[j]);
      }
    }
  }

  private scheduleZoneSync(): void {
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

  private syncZones(): void {
    const configs: Array<{
      host?: HTMLDivElement;
      items: LilyView[];
      key: ZoneKey;
      maxSpeed: number;
    }> = [
      {
        key: 'promos',
        host: this.promosZoneRef?.nativeElement,
        items: this.promoLilies(),
        maxSpeed: this.getZoneMaxSpeed('promos')
      },
      {
        key: 'resenas',
        host: this.resenasZoneRef?.nativeElement,
        items: this.reviewLilies(),
        maxSpeed: this.getZoneMaxSpeed('resenas')
      },
      {
        key: 'perfil',
        host: this.perfilZoneRef?.nativeElement,
        items: this.profileLilies(),
        maxSpeed: this.getZoneMaxSpeed('perfil')
      },
      {
        key: 'crear',
        host: this.crearZoneRef?.nativeElement,
        items: this.createLilies(),
        maxSpeed: this.getZoneMaxSpeed('crear')
      }
    ];

    this.zoneRuntimes.clear();

    configs.forEach((config) => {
      if (!config.host || !config.items.length || !config.host.clientWidth || !config.host.clientHeight) {
        return;
      }

      const occupied: LilyBody[] = [];
      const bodies = config.items.map((item) => {
        const body = this.createBodyForItem(config.key, config.host!, item, config.maxSpeed, occupied);
        occupied.push(body);
        return body;
      });

      this.zoneRuntimes.set(config.key, {
        key: config.key,
        host: config.host,
        bodies,
        maxSpeed: config.maxSpeed
      });
      this.applyZoneBodies(bodies);
    });
  }

  private takeNextReviewLilies(count: number): LilyView[] {
    const pool = this.resenas();
    if (!pool.length) {
      return [];
    }

    const nextItems: LilyView[] = [];

    for (let i = 0; i < count; i += 1) {
      const review = pool[this.reviewSpawnCursor % pool.length];
      this.reviewSpawnCursor = (this.reviewSpawnCursor + 1) % pool.length;
      nextItems.push(this.createReviewLily(review));
    }

    return nextItems;
  }

  private updateZone(runtime: ZoneRuntime, dt: number, elapsed: number): void {
    const width = runtime.host.clientWidth;
    const height = runtime.host.clientHeight;

    if (!width || !height) {
      return;
    }

    const frameScale = dt * 60;

    runtime.bodies.forEach((body, index) => {
      const drift = elapsed * 0.2 + body.driftSeed + index * 0.68;
      body.vx += Math.cos(drift) * 1.7 * dt;
      body.vy += Math.sin(drift * 0.88) * 1.45 * dt;
      body.vx *= Math.pow(body.drag, frameScale);
      body.vy *= Math.pow(body.drag, frameScale);
      body.drag += (0.989 - body.drag) * 0.05 * frameScale;
      body.speedCapMultiplier += (1 - body.speedCapMultiplier) * 0.05 * frameScale;
      body.angVel += Math.sin(elapsed * 0.12 + body.driftSeed) * 0.0007;
      body.angVel *= 0.988;
      body.angVel = this.clamp(body.angVel, -0.018, 0.018);

      this.keepMinimumMotion(body, runtime.maxSpeed * 0.26, drift);
      this.limitSpeed(body, runtime.maxSpeed * body.speedCapMultiplier);

      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.angle += body.angVel * 60 * dt;

      this.resolveWallBounce(body, width, height);
    });

    this.resolveZoneCollisions(runtime.bodies);
    runtime.bodies.forEach((body) => this.resolveWallBounce(body, width, height));
    this.applyZoneBodies(runtime.bodies);
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

  private limitSpeed(body: LilyBody, maxSpeed: number): void {
    const speed = Math.hypot(body.vx, body.vy);
    if (speed <= maxSpeed) {
      return;
    }

    const ratio = maxSpeed / speed;
    body.vx *= ratio;
    body.vy *= ratio;
  }

  private areBodiesOverlapping(x: number, y: number, radius: number, body: LilyBody): boolean {
    const dx = x - body.x;
    const dy = y - body.y;
    return dx * dx + dy * dy < (radius + body.radius - 8) * (radius + body.radius - 8);
  }
}
