import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';

interface Pad {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rotation: number;
  angVel: number;
  tipo: 'resena' | 'promo';
  variant: number;
  driftPhase: number;
  mass: number;
}

interface Ripple {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

const VARIANTS = [
  { pad: '#1a6644', flower: '#f45c9c' },
  { pad: '#2d8a60', flower: '#ffd4e8' },
  { pad: '#145c38', flower: '#ee8d54' },
  { pad: '#3a7a55', flower: '#ffb8d8' },
];

const DAMPING = 0.993;
const ANG_DAMP = 0.974;
const RESTITUTION = 0.68;

@Component({
  selector: 'app-nenufar-pond',
  standalone: true,
  imports: [],
  templateUrl: './nenufar-pond.component.html',
  styleUrl: './nenufar-pond.component.scss',
})
export class NenufarPondComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private pads: Pad[] = [];
  private ripples: Ripple[] = [];
  private nenImages: HTMLImageElement[] = [];
  private imagesLoaded = false;
  private raf = 0;
  private tick = 0;
  private mx = -999;
  private my = -999;
  private readonly boundResize: () => void;

  hoverLabel = signal<string | null>(null);
  labelPos = signal({ x: 0, y: 0 });

  constructor(private zone: NgZone) {
    this.boundResize = this.resize.bind(this);
  }

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    this.loadImages();
    this.initPads();
    this.canvas.addEventListener('mousemove', this.onMove.bind(this));
    this.canvas.addEventListener('click', this.onClickCanvas.bind(this));
    this.canvas.addEventListener('mouseleave', () => this.hoverLabel.set(null));
    window.addEventListener('resize', this.boundResize);
    this.zone.runOutsideAngular(() => this.loop());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.boundResize);
  }

  private resize(): void {
    const el = this.canvas.parentElement!;
    this.canvas.width = el.clientWidth || 480;
    this.canvas.height = 310;
  }

  private initPads(): void {
    const { width: w, height: h } = this.canvas;
    const specs: { r: number; tipo: 'resena' | 'promo'; variant: number }[] = [
      { r: 64, tipo: 'resena', variant: 0 },
      { r: 56, tipo: 'resena', variant: 2 },
      { r: 60, tipo: 'resena', variant: 1 },
      { r: 35, tipo: 'promo',  variant: 3 },
      { r: 38, tipo: 'promo',  variant: 0 },
      { r: 30, tipo: 'promo',  variant: 2 },
      { r: 33, tipo: 'promo',  variant: 1 },
    ];

    this.pads = specs.map((s, i) => ({
      id: i,
      x: s.r + 20 + Math.random() * (w - s.r * 2 - 40),
      y: s.r + 20 + Math.random() * (h - s.r * 2 - 40),
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: s.r,
      rotation: Math.random() * Math.PI * 2,
      angVel: (Math.random() - 0.5) * 0.008,
      tipo: s.tipo,
      variant: s.variant,
      driftPhase: Math.random() * Math.PI * 2,
      mass: s.r * s.r,
    }));

    for (let i = 0; i < 80; i++) this.separate();
  }

  private loop(): void {
    this.tick++;
    this.update();
    this.draw();
    this.raf = requestAnimationFrame(this.loop.bind(this));
  }

  private update(): void {
    const { width: w, height: h } = this.canvas;
    const t = this.tick;

    for (const p of this.pads) {
      p.vx += Math.sin(t * 0.007 + p.driftPhase) * 0.012;
      p.vy += Math.cos(t * 0.005 + p.driftPhase * 1.4) * 0.01;

      const spd = Math.hypot(p.vx, p.vy);
      if (spd > 14) { p.vx = p.vx / spd * 14; p.vy = p.vy / spd * 14; }

      p.x += p.vx; p.y += p.vy;
      p.rotation += p.angVel;
      p.vx *= DAMPING; p.vy *= DAMPING; p.angVel *= ANG_DAMP;

      if (p.x - p.r < 0)  { p.x = p.r;     p.vx =  Math.abs(p.vx) * RESTITUTION; p.angVel += 0.015; }
      if (p.x + p.r > w)  { p.x = w - p.r; p.vx = -Math.abs(p.vx) * RESTITUTION; p.angVel -= 0.015; }
      if (p.y - p.r < 0)  { p.y = p.r;     p.vy =  Math.abs(p.vy) * RESTITUTION; }
      if (p.y + p.r > h)  { p.y = h - p.r; p.vy = -Math.abs(p.vy) * RESTITUTION; }
    }

    this.collide();
    this.updateHover();

    // Ambient ripples — subtle frog-in-water effect
    if (t % 140 === 0) {
      this.ripples.push({
        x: 24 + Math.random() * (w - 48),
        y: 24 + Math.random() * (h - 48),
        r: 5,
        alpha: 0.38
      });
    }
    this.ripples = this.ripples
      .map(r => ({ ...r, r: r.r + 0.7, alpha: r.alpha - 0.011 }))
      .filter(r => r.alpha > 0);
  }

  private collide(): void {
    for (let i = 0; i < this.pads.length; i++) {
      for (let j = i + 1; j < this.pads.length; j++) {
        const a = this.pads[i]; const b = this.pads[j];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r;
        if (dist >= min) continue;
        const nx = dx / dist; const ny = dy / dist;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const imp = -(1 + RESTITUTION) * rv / (1 / a.mass + 1 / b.mass);
          a.vx -= imp / a.mass * nx; a.vy -= imp / a.mass * ny;
          b.vx += imp / b.mass * nx; b.vy += imp / b.mass * ny;
          const spin = Math.abs(rv) * 0.004;
          a.angVel += spin * (Math.random() - 0.5);
          b.angVel += spin * (Math.random() - 0.5);
        }
        const push = (min - dist) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }

  private separate(): void {
    for (let i = 0; i < this.pads.length; i++) {
      for (let j = i + 1; j < this.pads.length; j++) {
        const a = this.pads[i]; const b = this.pads[j];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r + 6;
        if (dist < min) {
          const push = (min - dist) / 2;
          const nx = dx / dist; const ny = dy / dist;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }
  }

  private updateHover(): void {
    let found: Pad | null = null;
    for (const p of this.pads) {
      if (Math.hypot(this.mx - p.x, this.my - p.y) < p.r) { found = p; break; }
    }
    this.zone.run(() => {
      if (found) {
        this.hoverLabel.set('Nenúfar');
        this.labelPos.set({ x: found.x, y: found.y });
      } else {
        this.hoverLabel.set(null);
      }
    });
  }

  private draw(): void {
    const ctx = this.ctx;
    const { width: w, height: h } = this.canvas;
    this.drawWater(ctx, w, h);
    this.drawRipples(ctx);
    for (const p of this.pads) this.drawPad(ctx, p);
  }

  private drawWater(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const t = this.tick * 0.001;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0,   `hsl(${155 + Math.sin(t) * 4},46%,14%)`);
    g.addColorStop(0.5, `hsl(${162 + Math.cos(t * .7) * 4},42%,11%)`);
    g.addColorStop(1,   `hsl(${150 + Math.sin(t * 1.3) * 3},50%,9%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(244,92,156,0.04)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const y = ((h * i / 4) + this.tick * 0.2 + i * 42) % h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 6) {
        ctx.lineTo(x, y + Math.sin(x * 0.005 + t * 1.8 + i) * 4);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.018)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const y = ((h * i / 3 + h * 0.16) + this.tick * 0.14 + i * 28) % h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 8) {
        ctx.lineTo(x, y + Math.sin(x * 0.009 + t * 2.4 + i * 1.3) * 3);
      }
      ctx.stroke();
    }
  }

  private drawRipples(ctx: CanvasRenderingContext2D): void {
    for (const r of this.ripples) {
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.42, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${r.alpha})`;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  }

  private loadImages(): void {
    const paths = [
      'assets/nenufares_colores/nenufar_var1.png',
      'assets/nenufares_colores/nenufar_var3.png',
      'assets/nenufares_colores/nenufar_var5.png',
      'assets/nenufares_colores/nenufar_var7.png',
      'assets/nenufares_colores/nenufar_var9.png',
      'assets/nenufares_colores/nenufar_var11.png',
      'assets/nenufares_colores/nenufar_var13.png',
    ];
    let loaded = 0;
    this.nenImages = paths.map(path => {
      const img = new Image();
      img.onload = () => { loaded++; if (loaded === paths.length) this.imagesLoaded = true; };
      img.src = path;
      return img;
    });
  }

  private drawPad(ctx: CanvasRenderingContext2D, p: Pad): void {
    const imgIdx = p.variant % this.nenImages.length;
    if (this.imagesLoaded && this.nenImages[imgIdx]?.complete) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 5;
      ctx.drawImage(this.nenImages[imgIdx], -p.r, -p.r, p.r * 2, p.r * 2);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    this.drawPadFallback(ctx, p);
  }

  private drawPadFallback(ctx: CanvasRenderingContext2D, p: Pad): void {
    const v = VARIANTS[p.variant];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 6;

    const ns = Math.PI * 0.15;
    const ne = Math.PI * 0.52;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, p.r, ne, ns, true);
    ctx.closePath();
    ctx.fillStyle = v.pad;
    ctx.fill();

    ctx.shadowColor = 'transparent';

    ctx.beginPath();
    ctx.arc(0, 0, p.r, ne, ns, true);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const fx = -p.r * 0.12;
    const fy = -p.r * 0.12;
    ctx.translate(fx, fy);

    const fr  = p.r * 0.52;
    const pd  = fr * 0.44;
    const prx = fr * 0.22;
    const pry = fr * 0.46;
    const lw  = Math.max(1, p.r * 0.024);

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -pd, prx, pry, 0, 0, Math.PI * 2);
      ctx.fillStyle = v.flower;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, fr * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = v.flower;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.restore();
  }

  private toCanvas(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top)  * (this.canvas.height / rect.height),
    };
  }

  private onMove(e: MouseEvent): void {
    const { x, y } = this.toCanvas(e);
    this.mx = x; this.my = y;
  }

  private onClickCanvas(e: MouseEvent): void {
    const { x: mx, y: my } = this.toCanvas(e);
    this.ripples.push({ x: mx, y: my, r: 5, alpha: 0.52 });
    for (const p of this.pads) {
      const dx = mx - p.x; const dy = my - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < p.r + 12) {
        const norm = dist || 1;
        const nx = (p.x - mx) / norm;
        const ny = (p.y - my) / norm;
        const force = 7 + Math.min(dist / p.r, 1) * 16;
        p.vx += nx * force;
        p.vy += ny * force;
        p.angVel += (Math.random() - 0.5) * 0.18;
        break;
      }
    }
  }
}
