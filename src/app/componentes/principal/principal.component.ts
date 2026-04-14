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
type PopupKind = 'info' | 'ayuda' | 'signin' | 'review' | 'promo' | 'profile' | 'create';

type HoverTooltip = {
  text: string;
  title: string;
  tone: 'promo' | 'review';
  x: number;
  y: number;
};

type HomePopup =
  | { kind: 'info' }
  | { kind: 'ayuda' }
  | { kind: 'signin'; message: string; title: string }
  | { kind: 'review'; lilyId: string; review: ResenaMock }
  | { kind: 'promo'; lilyId: string; promo: PromoMock }
  | { kind: 'profile'; lilyId: string }
  | { kind: 'create'; lilyId: string };

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
  @ViewChild('promosField', { static: true }) private promosFieldRef?: ElementRef<HTMLDivElement>;
  @ViewChild('resenasField', { static: true }) private resenasFieldRef?: ElementRef<HTMLDivElement>;
  @ViewChild('perfilField', { static: true }) private perfilFieldRef?: ElementRef<HTMLDivElement>;
  @ViewChild('crearField', { static: true }) private crearFieldRef?: ElementRef<HTMLDivElement>;

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
    return nombre ? String(nombre).split(' ')[0] : 'Nenufar';
  });

  readonly businessCatalog = computed<BusinessCatalogItem[]>(() => {
    const catalog = new Map<number, BusinessCatalogItem>();

    for (const promo of this.promociones()) {
      catalog.set(promo.negocioId, {
        id: promo.negocioId,
        nombre: promo.negocioNombre,
        categoria: 'Promocion activa',
        descripcion: promo.descripcionCorta
      });
    }

    for (const resena of this.resenas()) {
      if (!catalog.has(resena.negocioId)) {
        catalog.set(resena.negocioId, {
          id: resena.negocioId,
          nombre: resena.negocioNombre,
          categoria: 'Resenas recientes',
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

  private readonly zoneConfigs: Record<ZoneKey, ZonePhysicsConfig> = {
    promos: { targetCount: 3, maxSpeed: 92, minSpeed: 9, damping: 0.989, restitution: 0.76 },
    resenas: { targetCount: 4, maxSpeed: 84, minSpeed: 8, damping: 0.99, restitution: 0.78 },
    perfil: { targetCount: 1, maxSpeed: 72, minSpeed: 6, damping: 0.991, restitution: 0.82 },
    crear: { targetCount: 1, maxSpeed: 70, minSpeed: 6, damping: 0.991, restitution: 0.82 }
  };

  private animationFrameId = 0;
  private lilyInstanceCounter = 0;
  private lastFrameTime = 0;
  private resizeObserver?: ResizeObserver;
  private reviewSpawnCursor = 0;
  private promoSpawnCursor = 0;
  private profileSpawnCursor = 0;
  private createSpawnCursor = 0;
  private syncFrameId = 0;
  private viewReady = false;
  private readonly zoneRuntimes = new Map<ZoneKey, ZoneRuntime>();

  ngOnInit(): void {
    this.title.setTitle('Inicio');
    this.usuarioLogueado.set(this.leerJsonLocal('usuarioLogueado'));
    this.seedZoneLilies();
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

    this.zoneRuntimes.forEach((runtime) => {
      runtime.respawnTimers.forEach((timerId) => window.clearTimeout(timerId));
      runtime.respawnTimers.clear();
    });
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

  abrirCrearResena(): void {
    if (this.usuarioLogueado()?.id) {
      this.popup.set(null);
      this.crearResenaAbierto.set(true);
      return;
    }

    this.popup.set({
      kind: 'signin',
      title: 'Inicia sesion para resenar',
      message: 'Necesitas iniciar sesion para crear una resena y guardarla en tu actividad.'
    });
  }

  abrirPerfil(): void {
    const idUsuario = this.usuarioLogueado()?.id;
    if (idUsuario) {
      this.popup.set(null);
      void this.router.navigate(['/perfil', idUsuario]);
      return;
    }

    this.popup.set({
      kind: 'signin',
      title: 'Inicia sesion',
      message: 'Necesitas iniciar sesion para entrar en tu perfil y recuperar tu actividad.'
    });
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
    this.popup.set(null);
    void this.router.navigate(['/login']);
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
      autorNombre: this.usuarioLogueado()?.nombre || 'Tu',
      puntuacion: Number(respuesta?.puntuacion ?? 5),
      contenidoCorto: String(
        respuesta?.contenido ?? 'Tu nueva resena ya esta flotando por el estanque.'
      ).slice(0, 132),
      contenido: String(
        respuesta?.contenido ??
          'Tu nueva resena ya esta flotando por el estanque y aparecera cuando vuelva a entrar en la zona.'
      ),
      selloNenufar: Boolean(respuesta?.selloNenufar),
      fechaISO: new Date().toISOString(),
      lanzable: true
    };

    this.resenas.update((items) => [nuevaResena, ...items]);
    this.crearResenaAbierto.set(false);
    this.scheduleRespawn('resenas', 220);
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

  onLilyPointerDown(event: PointerEvent, item: LilyView): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.hoveredTooltip.set(null);

    const runtime = this.zoneRuntimes.get(item.zone);
    const body = runtime?.bodies.find((candidate) => candidate.id === item.id);
    if (!runtime || !body) {
      return;
    }

    const rect = runtime.host.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const dNorm = this.applyImpulseFromPoint(runtime, body, localX, localY, performance.now() * 0.001);

    this.emitRipple(event.clientX, event.clientY, 0.82 + dNorm * 0.34);
  }

  onLilyContextMenu(event: MouseEvent, item: LilyView): void {
    event.preventDefault();
    event.stopPropagation();
    this.hoveredTooltip.set(null);
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
        '.zone-lily, .top-lily, .topbar, .brand-lockup, .search-shell, .searchbar, ' +
          '.search-results, .search-result, .popup-overlay, .popup-card, .popup-close, ' +
          '.modal, .modal-backdrop, input, textarea, button, .zone-quick-action'
      )
    ) {
      return;
    }

    this.emitRipple(event.clientX, event.clientY, 1);
  }

  seleccionarNegocio(negocio: BusinessCatalogItem): void {
    this.busqueda.set(negocio.nombre);
    void this.router.navigate(['/negocio', negocio.id]);
  }

  private abrirPopupDesdeNenufar(item: LilyView): void {
    switch (item.kind) {
      case 'promo':
        if (item.promo) {
          this.popup.set({ kind: 'promo', lilyId: item.id, promo: item.promo });
        }
        break;
      case 'review':
        if (item.review) {
          this.popup.set({ kind: 'review', lilyId: item.id, review: item.review });
        }
        break;
      case 'profile':
        this.popup.set({ kind: 'profile', lilyId: item.id });
        break;
      case 'create':
        this.popup.set({ kind: 'create', lilyId: item.id });
        break;
    }
  }

  private animate = (timestamp: number): void => {
    const dt = this.lastFrameTime ? Math.min((timestamp - this.lastFrameTime) / 1000, 0.032) : 0.016;
    const elapsed = timestamp * 0.001;
    this.lastFrameTime = timestamp;

    this.zoneRuntimes.forEach((runtime) => this.updateZone(runtime, dt, elapsed));
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
    const dNorm = this.clamp(distance / body.r, 0, 1);
    const minForce = 120;
    const maxForce = 310;
    const force = minForce + (maxForce - minForce) * dNorm;
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
      label: '+ Resena',
      subtitle: this.usuarioLogueado()?.id ? 'Click derecho para crear' : 'Necesitas sesion',
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
        const pool = this.resenas();
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
      label: this.nombreUsuario(),
      subtitle: this.usuarioLogueado()?.id ? 'Click derecho para abrir' : 'Inicia sesion',
      tone: 'fresh'
    };
  }

  private createPromoLily(promo: PromoMock): LilyView {
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

  private createReviewLily(review: ResenaMock): LilyView {
    return {
      id: `review-${review.id}-${++this.lilyInstanceCounter}`,
      zone: 'resenas',
      kind: 'review',
      label: review.negocioNombre,
      subtitle: `${review.autorNombre} · ${this.getEstrellas(review.puntuacion)}`,
      review,
      badge: review.selloNenufar ? 'Sello Nenufar' : undefined,
      tone: review.puntuacion >= 3 ? 'fresh' : 'mustio'
    };
  }

  private despawnBody(runtime: ZoneRuntime, bodyId: string): void {
    const removed = runtime.bodies.find((body) => body.id === bodyId);
    if (!removed) {
      return;
    }

    runtime.bodies = runtime.bodies.filter((body) => body.id !== bodyId);

    const activePopup = this.popup();
    if (
      activePopup &&
      'lilyId' in activePopup &&
      activePopup.lilyId === bodyId
    ) {
      this.popup.set(null);
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
        return 64;
      case 'resenas':
        return 58;
      case 'perfil':
      case 'crear':
        return 72;
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

      runtime.bodies = [];
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

  private updateZoneItems(zone: ZoneKey, nextItems: LilyView[]): void {
    this.getSignalForZone(zone).set(nextItems);
    this.queueZoneSync();
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
