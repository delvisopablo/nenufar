import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { NenufarComponent } from '../../nenufar/nenufar.component';
import { NenufarEngine } from '../../nenufar/nenufar-engine';
import {
  NenufarEntity,
  NenufarKind,
  NenufarLeftClickEvent,
  NenufarRenderState,
  NenufarRightClickEvent,
  NenufarTone
} from '../../nenufar/nenufar.types';
import { EstanqueBackgroundComponent } from '../../shared/estanque-background/estanque-background.component';

type LilyId = 'acompanante' | 'negocio' | 'usuario';

type LilyBody = NenufarEntity<LilyId> & {
  angle: number;
  angVel: number;
  angularDamping: number;
  badge?: string;
  boundsMode: 'bounce';
  collisionEnabled: boolean;
  contextText: string;
  imageSrc: string;
  kind: NenufarKind;
  label?: string;
  lastTouchedAt: number;
  linearDamping: number;
  maxSpeed: number;
  maxSpin: number;
  route: string | null;
  subtitle?: string;
  tone: NenufarTone;
};

type LilyView = {
  badge?: string;
  contextText: string;
  id: LilyId;
  imageSrc: string;
  kind: NenufarKind;
  label?: string;
  radius: number;
  route: string | null;
  state: NenufarRenderState;
  subtitle?: string;
};

type RectBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

@Component({
  selector: 'app-eleccion-registro',
  standalone: true,
  imports: [CommonModule, EstanqueBackgroundComponent, NenufarComponent],
  templateUrl: './eleccion-registro.component.html',
  styleUrls: ['./eleccion-registro.component.css']
})
export class EleccionRegistroComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scene', { static: true }) private sceneRef?: ElementRef<HTMLDivElement>;
  @ViewChild('card', { static: true }) private cardRef?: ElementRef<HTMLDivElement>;

  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly zone = inject(NgZone);
  private readonly lilyEngine = new NenufarEngine<LilyBody>({
    collision: {
      impulseScale: 1,
      restitution: 0.86,
      separationFactor: 0.5,
      spinFromImpact: 0.0016,
      spinFromTangential: 0,
      tangentTransfer: 0
    },
    defaultBoundsMode: 'bounce'
  });

  readonly lilies = signal<LilyView[]>([]);
  readonly contextHint = signal('Clic izquierdo empuja y entra. Clic derecho muestra información rápida.');

  private viewport = { width: 0, height: 0 };
  private safeRect: RectBounds | null = null;
  private lilyBodies: LilyBody[] = [];
  private resizeObserver?: ResizeObserver;
  private animationFrameId = 0;
  private lastFrameTime = 0;
  private lastUiCommit = 0;

  ngOnInit(): void {
    this.title.setTitle('Regístrate');
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.syncLayout();

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.syncLayout());
        if (this.sceneRef?.nativeElement) {
          this.resizeObserver.observe(this.sceneRef.nativeElement);
        }
        if (this.cardRef?.nativeElement) {
          this.resizeObserver.observe(this.cardRef.nativeElement);
        }
      }

      this.animationFrameId = requestAnimationFrame(this.animate);
    });
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.resizeObserver?.disconnect();
    this.lilyEngine.clear();
  }

  irARuta(route: string): void {
    void this.router.navigate([route]);
  }

  volverAlEstanque(): void {
    void this.router.navigate(['/estanque']);
  }

  onLilyLeftClick(event: NenufarLeftClickEvent<LilyView>): void {
    const body = this.findBody(event.id as LilyId);
    if (!body) {
      return;
    }

    const impactPoint = {
      x: body.pos.x + event.localPoint.x,
      y: body.pos.y + event.localPoint.y
    };

    this.lilyEngine.applyImpulse(body.id, impactPoint, {
      maxForce: 34,
      minForce: 14,
      spinJitterFactor: 0.008,
      spinJitterMin: 0.002,
      timestamp: performance.now() * 0.001
    });
  }

  onLilyRightClick(event: NenufarRightClickEvent<LilyView>): void {
    const hint = event.data?.contextText;
    if (!hint) {
      return;
    }

    this.zone.run(() => this.contextHint.set(hint));
  }

  private animate = (timestamp: number): void => {
    const dt = this.lastFrameTime ? Math.min((timestamp - this.lastFrameTime) / 1000, 0.032) : 0.016;
    this.lastFrameTime = timestamp;

    this.stepPhysics(dt, timestamp / 1000);

    if (timestamp - this.lastUiCommit >= 24) {
      this.lastUiCommit = timestamp;
      this.commitLilies();
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private stepPhysics(dt: number, elapsed: number): void {
    if (!this.lilyBodies.length) {
      return;
    }

    this.lilyEngine.setBounds(this.sceneBounds());

    this.lilyBodies.forEach((lily, index) => {
      const drift = elapsed * 0.28 + index * Math.PI * 0.72;
      lily.vel.x += Math.cos(drift) * 4.2 * dt;
      lily.vel.y += Math.sin(drift * 0.92) * 3.8 * dt;
      lily.angVel += Math.sin(elapsed * 0.18 + index) * 0.0008;

      this.keepMinimumMotion(lily, drift);
    });

    this.lilyEngine.step(dt);

    this.lilyBodies.forEach((lily) => {
      lily.angle += lily.angVel * 60 * dt;
      this.resolveCardAvoidance(lily);
      this.resolveWallBounce(lily);
    });
  }

  private syncLayout(): void {
    const scene = this.sceneRef?.nativeElement;
    const card = this.cardRef?.nativeElement;

    if (!scene || !card) {
      return;
    }

    const sceneRect = scene.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    if (!sceneRect.width || !sceneRect.height) {
      return;
    }

    const previousViewport = this.viewport;
    this.viewport = { width: sceneRect.width, height: sceneRect.height };

    const safePadding = this.viewport.width < 720 ? 26 : 42;
    this.safeRect = {
      left: cardRect.left - sceneRect.left - safePadding,
      right: cardRect.right - sceneRect.left + safePadding,
      top: cardRect.top - sceneRect.top - safePadding,
      bottom: cardRect.bottom - sceneRect.top + safePadding
    };

    if (!this.lilyBodies.length || !previousViewport.width || !previousViewport.height) {
      this.resetLilies();
      this.commitLilies();
      return;
    }

    const scaleX = this.viewport.width / previousViewport.width;
    const scaleY = this.viewport.height / previousViewport.height;
    const nextRadius = this.computeRadius();

    this.lilyBodies.forEach((lily) => {
      lily.pos.x *= scaleX;
      lily.pos.y *= scaleY;
      lily.radius = nextRadius;
      this.resolveWallBounce(lily);
      this.resolveCardAvoidance(lily);
    });

    this.commitLilies();
  }

  private resetLilies(): void {
    const radius = this.computeRadius();
    const width = this.viewport.width;
    const height = this.viewport.height;

    this.lilyEngine.clear();
    this.lilyBodies = [
      this.lilyEngine.createEntity({
        angle: -8,
        angVel: 0.006,
        angularDamping: 0.985,
        badge: 'Usuario',
        boundsMode: 'bounce',
        collisionEnabled: true,
        contextText: 'Ruta pensada para guardar reseñas, reservar y seguir tu actividad.',
        id: 'usuario',
        imageSrc: 'assets/imagenes/nenufar.jpeg',
        kind: 'menu',
        label: 'Usuario',
        lastTouchedAt: -10,
        linearDamping: 1,
        maxSpeed: 34,
        maxSpin: 0.018,
        pos: { x: width * 0.18, y: height * 0.24 },
        radius,
        route: '/registro',
        subtitle: 'Reseñas, reservas y pétalos',
        tone: 'fresh',
        vel: { x: 24, y: 16 }
      }),
      this.lilyEngine.createEntity({
        angle: 10,
        angVel: -0.005,
        angularDamping: 0.985,
        badge: 'Negocio',
        boundsMode: 'bounce',
        collisionEnabled: true,
        contextText: 'Ruta para perfilar tu negocio, horarios y promociones dentro de Nenúfar.',
        id: 'negocio',
        imageSrc: 'assets/imagenes/nenufar.jpeg',
        kind: 'menu',
        label: 'Negocio',
        lastTouchedAt: -10,
        linearDamping: 1,
        maxSpeed: 34,
        maxSpin: 0.018,
        pos: { x: width * 0.82, y: height * 0.72 },
        radius,
        route: '/registro-negocio',
        subtitle: 'Perfil, horarios y promos',
        tone: 'fresh',
        vel: { x: -22, y: -18 }
      }),
      this.lilyEngine.createEntity({
        angle: -4,
        angVel: 0.004,
        angularDamping: 0.985,
        boundsMode: 'bounce',
        collisionEnabled: true,
        contextText: 'Este nenúfar queda vacío a propósito para demostrar el modo decorativo reusable.',
        id: 'acompanante',
        imageSrc: 'assets/imagenes/nenufar_mustio.png',
        kind: 'empty',
        lastTouchedAt: -10,
        linearDamping: 1,
        maxSpeed: 34,
        maxSpin: 0.018,
        pos: { x: width * 0.18, y: height * 0.78 },
        radius,
        route: null,
        tone: 'mustio',
        vel: { x: 18, y: -20 }
      })
    ];

    this.lilyBodies.forEach((lily) => {
      this.placeAwayFromCard(lily);
      this.resolveWallBounce(lily);
    });

    if (this.lilyBodies.length >= 3) {
      this.lilyBodies[2].pos.x = width * 0.84;
      this.lilyBodies[2].pos.y = height * 0.26;
      this.resolveWallBounce(this.lilyBodies[2]);
      this.resolveCardAvoidance(this.lilyBodies[2]);
    }
  }

  private placeAwayFromCard(lily: LilyBody): void {
    const safeRect = this.safeRect;

    if (!safeRect) {
      return;
    }

    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (!this.intersectsRect(lily, safeRect)) {
        return;
      }

      const targetX = lily.pos.x < this.viewport.width / 2
        ? safeRect.left - lily.radius - 36
        : safeRect.right + lily.radius + 36;
      const targetY = lily.pos.y < this.viewport.height / 2
        ? safeRect.top - lily.radius - 28
        : safeRect.bottom + lily.radius + 28;

      lily.pos.x = this.clamp(targetX, lily.radius + 18, this.viewport.width - lily.radius - 18);
      lily.pos.y = this.clamp(targetY, lily.radius + 18, this.viewport.height - lily.radius - 18);
    }
  }

  private computeRadius(): number {
    const minSide = Math.min(this.viewport.width, this.viewport.height);
    if (this.viewport.width < 720) {
      return this.clamp(minSide * 0.16, 80, 110);
    }

    return this.clamp(minSide * 0.17, 110, 160);
  }

  private resolveWallBounce(lily: LilyBody): void {
    const margin = 18;
    const left = lily.radius + margin;
    const right = this.viewport.width - lily.radius - margin;
    const top = lily.radius + margin;
    const bottom = this.viewport.height - lily.radius - margin;

    if (lily.pos.x <= left) {
      lily.pos.x = left;
      lily.vel.x = Math.abs(lily.vel.x);
    } else if (lily.pos.x >= right) {
      lily.pos.x = right;
      lily.vel.x = -Math.abs(lily.vel.x);
    }

    if (lily.pos.y <= top) {
      lily.pos.y = top;
      lily.vel.y = Math.abs(lily.vel.y);
    } else if (lily.pos.y >= bottom) {
      lily.pos.y = bottom;
      lily.vel.y = -Math.abs(lily.vel.y);
    }
  }

  private resolveCardAvoidance(lily: LilyBody): void {
    const rect = this.safeRect;

    if (!rect || !this.intersectsRect(lily, rect)) {
      return;
    }

    const nearestX = this.clamp(lily.pos.x, rect.left, rect.right);
    const nearestY = this.clamp(lily.pos.y, rect.top, rect.bottom);
    let dx = lily.pos.x - nearestX;
    let dy = lily.pos.y - nearestY;
    let distance = Math.hypot(dx, dy);
    let nx = 0;
    let ny = 0;

    if (distance < 0.001) {
      const leftGap = Math.abs(lily.pos.x - rect.left);
      const rightGap = Math.abs(rect.right - lily.pos.x);
      const topGap = Math.abs(lily.pos.y - rect.top);
      const bottomGap = Math.abs(rect.bottom - lily.pos.y);
      const minGap = Math.min(leftGap, rightGap, topGap, bottomGap);

      if (minGap === leftGap) {
        nx = -1;
      } else if (minGap === rightGap) {
        nx = 1;
      } else if (minGap === topGap) {
        ny = -1;
      } else {
        ny = 1;
      }

      distance = 0;
    } else {
      nx = dx / distance;
      ny = dy / distance;
    }

    const overlap = lily.radius - distance;
    lily.pos.x += nx * (overlap + 1.5);
    lily.pos.y += ny * (overlap + 1.5);

    const dot = lily.vel.x * nx + lily.vel.y * ny;
    if (dot < 0) {
      lily.vel.x -= dot * nx * 1.75;
      lily.vel.y -= dot * ny * 1.75;
    } else {
      lily.vel.x += nx * 8;
      lily.vel.y += ny * 8;
    }

    this.limitSpeed(lily);
    this.resolveWallBounce(lily);
  }

  private keepMinimumMotion(lily: LilyBody, seed: number): void {
    const speed = Math.hypot(lily.vel.x, lily.vel.y);

    if (speed >= 18) {
      return;
    }

    const angle = speed > 0.01 ? Math.atan2(lily.vel.y, lily.vel.x) : seed;
    lily.vel.x = Math.cos(angle) * 18;
    lily.vel.y = Math.sin(angle) * 18;
  }

  private limitSpeed(lily: LilyBody): void {
    const speed = Math.hypot(lily.vel.x, lily.vel.y);

    if (speed <= lily.maxSpeed) {
      return;
    }

    const ratio = lily.maxSpeed / speed;
    lily.vel.x *= ratio;
    lily.vel.y *= ratio;
  }

  private intersectsRect(lily: LilyBody, rect: RectBounds): boolean {
    const nearestX = this.clamp(lily.pos.x, rect.left, rect.right);
    const nearestY = this.clamp(lily.pos.y, rect.top, rect.bottom);
    const dx = lily.pos.x - nearestX;
    const dy = lily.pos.y - nearestY;
    return dx * dx + dy * dy < lily.radius * lily.radius;
  }

  private commitLilies(): void {
    const nextLilies: LilyView[] = this.lilyBodies.map((lily) => ({
      badge: lily.badge,
      contextText: lily.contextText,
      id: lily.id,
      imageSrc: lily.imageSrc,
      kind: lily.kind,
      label: lily.label,
      radius: lily.radius,
      route: lily.route,
      state: {
        rotationDeg: lily.angle,
        tone: lily.tone,
        visible: true,
        x: lily.pos.x,
        y: lily.pos.y
      },
      subtitle: lily.subtitle
    }));

    this.zone.run(() => this.lilies.set(nextLilies));
  }

  private sceneBounds(): RectBounds {
    return {
      left: 18,
      right: Math.max(18, this.viewport.width - 18),
      top: 18,
      bottom: Math.max(18, this.viewport.height - 18)
    };
  }

  private findBody(id: LilyId): LilyBody | undefined {
    return this.lilyBodies.find((lily) => lily.id === id);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
