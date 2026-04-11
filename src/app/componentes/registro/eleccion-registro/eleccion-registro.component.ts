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
import { EstanqueBackgroundComponent } from '../../shared/estanque-background/estanque-background.component';

type LilyId = 'usuario' | 'negocio' | 'acompanante';

type LilyBody = {
  angle: number;
  angVel: number;
  id: LilyId;
  label: string;
  radius: number;
  route: string | null;
  subtitle: string;
  tone: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type LilyView = {
  angle: number;
  diameter: number;
  id: LilyId;
  isInteractive: boolean;
  label: string;
  route: string | null;
  subtitle: string;
  tone: number;
  x: number;
  y: number;
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
  imports: [CommonModule, EstanqueBackgroundComponent],
  templateUrl: './eleccion-registro.component.html',
  styleUrls: ['./eleccion-registro.component.css']
})
export class EleccionRegistroComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scene', { static: true }) private sceneRef?: ElementRef<HTMLDivElement>;
  @ViewChild('card', { static: true }) private cardRef?: ElementRef<HTMLDivElement>;

  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly zone = inject(NgZone);

  readonly lilies = signal<LilyView[]>([]);

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
  }

  irARuta(route: string): void {
    void this.router.navigate([route]);
  }

  volverAlEstanque(): void {
    void this.router.navigate(['/estanque']);
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

    this.lilyBodies.forEach((lily, index) => {
      const drift = elapsed * 0.28 + index * Math.PI * 0.72;
      lily.vx += Math.cos(drift) * 4.2 * dt;
      lily.vy += Math.sin(drift * 0.92) * 3.8 * dt;
      lily.angVel += Math.sin(elapsed * 0.18 + index) * 0.0008;
      lily.angVel *= 0.985;
      lily.angVel = this.clamp(lily.angVel, -0.018, 0.018);
      lily.angle += lily.angVel * 60 * dt;

      this.keepMinimumMotion(lily, drift);
      this.limitSpeed(lily);

      lily.x += lily.vx * dt;
      lily.y += lily.vy * dt;

      this.resolveWallBounce(lily);
      this.resolveCardAvoidance(lily);
    });

    for (let i = 0; i < this.lilyBodies.length; i += 1) {
      for (let j = i + 1; j < this.lilyBodies.length; j += 1) {
        this.resolveLilyCollision(this.lilyBodies[i], this.lilyBodies[j]);
      }
    }
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
      lily.x *= scaleX;
      lily.y *= scaleY;
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

    this.lilyBodies = [
      {
        id: 'usuario',
        label: 'Usuario',
        subtitle: 'Reseñas, reservas y pétalos',
        route: '/registro',
        x: width * 0.18,
        y: height * 0.24,
        vx: 24,
        vy: 16,
        radius,
        angle: -8,
        angVel: 0.006,
        tone: 0
      },
      {
        id: 'negocio',
        label: 'Negocio',
        subtitle: 'Perfil, horarios y promos',
        route: '/registro-negocio',
        x: width * 0.82,
        y: height * 0.72,
        vx: -22,
        vy: -18,
        radius,
        angle: 10,
        angVel: -0.005,
        tone: 12
      },
      {
        id: 'acompanante',
        label: 'Nenúfar',
        subtitle: 'Explora a tu ritmo',
        route: null,
        x: width * 0.18,
        y: height * 0.78,
        vx: 18,
        vy: -20,
        radius,
        angle: -4,
        angVel: 0.004,
        tone: -8
      }
    ];

    this.lilyBodies.forEach((lily) => {
      this.placeAwayFromCard(lily);
      this.resolveWallBounce(lily);
    });

    if (this.lilyBodies.length >= 3) {
      this.lilyBodies[2].x = width * 0.84;
      this.lilyBodies[2].y = height * 0.26;
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

      const targetX = lily.x < this.viewport.width / 2
        ? safeRect.left - lily.radius - 36
        : safeRect.right + lily.radius + 36;
      const targetY = lily.y < this.viewport.height / 2
        ? safeRect.top - lily.radius - 28
        : safeRect.bottom + lily.radius + 28;

      lily.x = this.clamp(targetX, lily.radius + 18, this.viewport.width - lily.radius - 18);
      lily.y = this.clamp(targetY, lily.radius + 18, this.viewport.height - lily.radius - 18);
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

    if (lily.x <= left) {
      lily.x = left;
      lily.vx = Math.abs(lily.vx);
    } else if (lily.x >= right) {
      lily.x = right;
      lily.vx = -Math.abs(lily.vx);
    }

    if (lily.y <= top) {
      lily.y = top;
      lily.vy = Math.abs(lily.vy);
    } else if (lily.y >= bottom) {
      lily.y = bottom;
      lily.vy = -Math.abs(lily.vy);
    }
  }

  private resolveCardAvoidance(lily: LilyBody): void {
    const rect = this.safeRect;

    if (!rect || !this.intersectsRect(lily, rect)) {
      return;
    }

    const nearestX = this.clamp(lily.x, rect.left, rect.right);
    const nearestY = this.clamp(lily.y, rect.top, rect.bottom);
    let dx = lily.x - nearestX;
    let dy = lily.y - nearestY;
    let distance = Math.hypot(dx, dy);
    let nx = 0;
    let ny = 0;

    if (distance < 0.001) {
      const leftGap = Math.abs(lily.x - rect.left);
      const rightGap = Math.abs(rect.right - lily.x);
      const topGap = Math.abs(lily.y - rect.top);
      const bottomGap = Math.abs(rect.bottom - lily.y);
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
    lily.x += nx * (overlap + 1.5);
    lily.y += ny * (overlap + 1.5);

    const dot = lily.vx * nx + lily.vy * ny;
    if (dot < 0) {
      lily.vx -= dot * nx * 1.75;
      lily.vy -= dot * ny * 1.75;
    } else {
      lily.vx += nx * 8;
      lily.vy += ny * 8;
    }

    this.limitSpeed(lily);
    this.resolveWallBounce(lily);
  }

  private resolveLilyCollision(first: LilyBody, second: LilyBody): void {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.hypot(dx, dy) || 0.001;
    const minDistance = first.radius + second.radius - 10;

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

    first.angVel = this.clamp(first.angVel - relAlongNormal * 0.0016, -0.018, 0.018);
    second.angVel = this.clamp(second.angVel + relAlongNormal * 0.0016, -0.018, 0.018);
    this.limitSpeed(first);
    this.limitSpeed(second);
    this.resolveCardAvoidance(first);
    this.resolveCardAvoidance(second);
    this.resolveWallBounce(first);
    this.resolveWallBounce(second);
  }

  private keepMinimumMotion(lily: LilyBody, seed: number): void {
    const speed = Math.hypot(lily.vx, lily.vy);

    if (speed >= 18) {
      return;
    }

    const angle = speed > 0.01 ? Math.atan2(lily.vy, lily.vx) : seed;
    lily.vx = Math.cos(angle) * 18;
    lily.vy = Math.sin(angle) * 18;
  }

  private limitSpeed(lily: LilyBody): void {
    const speed = Math.hypot(lily.vx, lily.vy);

    if (speed <= 34) {
      return;
    }

    const ratio = 34 / speed;
    lily.vx *= ratio;
    lily.vy *= ratio;
  }

  private intersectsRect(lily: LilyBody, rect: RectBounds): boolean {
    const nearestX = this.clamp(lily.x, rect.left, rect.right);
    const nearestY = this.clamp(lily.y, rect.top, rect.bottom);
    const dx = lily.x - nearestX;
    const dy = lily.y - nearestY;
    return dx * dx + dy * dy < lily.radius * lily.radius;
  }

  private commitLilies(): void {
    const nextLilies = this.lilyBodies.map((lily) => ({
      id: lily.id,
      label: lily.label,
      subtitle: lily.subtitle,
      route: lily.route,
      isInteractive: !!lily.route,
      x: lily.x,
      y: lily.y,
      diameter: lily.radius * 2,
      angle: lily.angle,
      tone: lily.tone
    }));

    this.zone.run(() => this.lilies.set(nextLilies));
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
