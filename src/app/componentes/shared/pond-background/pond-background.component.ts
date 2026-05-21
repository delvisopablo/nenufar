import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  booleanAttribute,
  inject,
  numberAttribute
} from '@angular/core';

type PondBackgroundVariant = 'soft' | 'deep' | 'hero' | 'contour';
type PondBackgroundTone = 'kelp' | 'teal' | 'midnight';

interface WaveSource {
  x: number;
  y: number;
  wl: number;
  phase: number;
  drift: {
    ax: number;
    ay: number;
    rx: number;
    ry: number;
  };
}

interface PondPalette {
  steps: Array<[number, number, number]>;
  highlight: [number, number, number];
  trailCore: string;
  trailGlow: string;
  background: string;
  contourLines?: string[];
}

interface PondVariantConfig {
  renderPixels: number;
  speed: number;
  waveScale: number;
  threshold: number;
  trailFade: number;
}

interface ContourRipple {
  x: number;
  y: number;
  wl: number;
  phase: number;
  amp: number;
  born: number;
  life: number;
}

const TAU = Math.PI * 2;

const BASE_SOURCES: WaveSource[] = [
  { x: 0.5, y: 0.5, wl: 20, phase: 0, drift: { ax: 0.7, ay: 0.5, rx: 18, ry: 14 } },
  { x: 0.25, y: 0.25, wl: 22, phase: 1.0, drift: { ax: 0.4, ay: 0.9, rx: 12, ry: 20 } },
  { x: 0.75, y: 0.25, wl: 18, phase: 2.1, drift: { ax: 1.1, ay: 0.3, rx: 20, ry: 10 } },
  { x: 0.25, y: 0.75, wl: 24, phase: 0.7, drift: { ax: 0.6, ay: 1.3, rx: 15, ry: 18 } },
  { x: 0.75, y: 0.75, wl: 19, phase: 3.2, drift: { ax: 0.9, ay: 0.6, rx: 22, ry: 12 } },
  { x: 0.5, y: 0.2, wl: 21, phase: 1.8, drift: { ax: 1.3, ay: 0.8, rx: 10, ry: 16 } },
  { x: 0.5, y: 0.8, wl: 17, phase: 2.6, drift: { ax: 0.5, ay: 1.1, rx: 18, ry: 8 } },
  { x: 0.2, y: 0.6, wl: 26, phase: 0.3, drift: { ax: 1.5, ay: 0.7, rx: 25, ry: 20 } },
  { x: 0.8, y: 0.5, wl: 15, phase: 1.5, drift: { ax: 0.8, ay: 1.6, rx: 14, ry: 22 } },
  { x: 0.5, y: 0.7, wl: 23, phase: 4.1, drift: { ax: 1.2, ay: 0.4, rx: 20, ry: 15 } }
];

@Component({
  selector: 'app-pond-background',
  standalone: true,
  templateUrl: './pond-background.component.html',
  styleUrl: './pond-background.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PondBackgroundComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly zone = inject(NgZone);

  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() variant: PondBackgroundVariant | string = 'deep';
  @Input() tone: PondBackgroundTone | string = 'kelp';
  @Input({ transform: numberAttribute }) intensity = 1;
  @Input({ transform: numberAttribute }) opacity = 1;
  @Input({ transform: booleanAttribute }) animated = false;

  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver?: ResizeObserver;
  private frameId = 0;
  private imageData?: ImageData;
  private time = 0;
  private lastFrame = 0;
  private renderWidth = 0;
  private renderHeight = 0;
  private needsRender = true;

  private trailCanvas?: HTMLCanvasElement;
  private trailCtx: CanvasRenderingContext2D | null = null;
  private trailEnergy = 0;
  private isPointerDrawing = false;
  private lastTrailX: number | null = null;
  private lastTrailY: number | null = null;
  private contourRipples: ContourRipple[] = [];
  private contourField = new Float32Array(0);
  private teardownEvents: Array<() => void> = [];

  get normalizedVariant(): PondBackgroundVariant {
    return this.variant === 'soft' || this.variant === 'hero' || this.variant === 'contour' ? this.variant : 'deep';
  }

  get normalizedTone(): PondBackgroundTone {
    if (this.tone === 'teal' || this.tone === 'midnight') {
      return this.tone;
    }

    return 'kelp';
  }

  get clampedOpacity(): number {
    return this.clamp(this.opacity, 0.25, 1);
  }

  get clampedIntensity(): number {
    return this.clamp(this.intensity, 0.55, 1.45);
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const canvas = this.canvasRef.nativeElement;
      this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

      if (!this.ctx) {
        return;
      }

      this.resizeCanvas();
      this.attachPointerEvents();

      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
      });
      this.resizeObserver.observe(canvas);

      this.startLoop();
    });
  }

  ngOnChanges(_: SimpleChanges): void {
    this.syncCanvasPresentation();
    this.needsRender = true;
  }

  ngOnDestroy(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }

    this.resizeObserver?.disconnect();
    this.teardownEvents.forEach((teardown) => teardown());
  }

  private startLoop(): void {
    const render = (timestamp: number) => {
      if (!this.ctx) {
        return;
      }

      const delta = this.lastFrame ? (timestamp - this.lastFrame) / 1000 : 1 / 60;
      this.lastFrame = timestamp;

      if (this.animated) {
        this.time += Math.min(delta, 0.05) * this.getVariantConfig().speed * (0.52 + this.clampedIntensity * 0.18);
        this.needsRender = true;
      }

      if (this.needsRender || this.trailEnergy > 0.004) {
        this.drawFrame();
      }

      this.frameId = requestAnimationFrame(render);
    };

    this.frameId = requestAnimationFrame(render);
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = Math.max(1, Math.round(rect.width));
    const displayHeight = Math.max(1, Math.round(rect.height));
    const nextSize = this.getRenderDimensions(displayWidth, displayHeight);

    if (nextSize.width === this.renderWidth && nextSize.height === this.renderHeight && this.ctx) {
      this.syncCanvasPresentation();
      return;
    }

    this.renderWidth = nextSize.width;
    this.renderHeight = nextSize.height;

    canvas.width = this.renderWidth;
    canvas.height = this.renderHeight;

    this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!this.ctx) {
      return;
    }

    this.ctx.imageSmoothingEnabled = false;
    this.imageData = this.ctx.createImageData(this.renderWidth, this.renderHeight);
    this.createTrailCanvas();
    this.syncCanvasPresentation();
    this.needsRender = true;
  }

  private drawFrame(): void {
    if (this.normalizedVariant === 'contour') {
      this.drawContourFrame();
      this.needsRender = false;
      return;
    }

    const ctx = this.ctx;
    const imageData = this.imageData;

    if (!ctx || !imageData || !this.renderWidth || !this.renderHeight) {
      return;
    }

    const palette = this.getPalette();
    const variant = this.getVariantConfig();
    const data = imageData.data;
    const scale = Math.min(this.renderWidth, this.renderHeight) / 550;

    const positions = BASE_SOURCES.map((source) => ({
      x: source.x * this.renderWidth + Math.sin(this.time * source.drift.ax + source.phase) * source.drift.rx * scale,
      y: source.y * this.renderHeight + Math.cos(this.time * source.drift.ay + source.phase) * source.drift.ry * scale,
      wl: source.wl * scale * variant.waveScale,
      phase: source.phase
    }));

    let index = 0;

    for (let y = 0; y < this.renderHeight; y += 1) {
      for (let x = 0; x < this.renderWidth; x += 1) {
        let amplitude = 0;

        for (let sourceIndex = 0; sourceIndex < positions.length; sourceIndex += 1) {
          const source = positions[sourceIndex];
          const dx = x - source.x;
          const dy = y - source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          amplitude += Math.sin((distance / source.wl - this.time) * TAU + source.phase);
        }

        const normalized = this.clamp((amplitude / positions.length) * this.clampedIntensity, -1, 1);
        const color =
          Math.abs(normalized) < variant.threshold
            ? palette.highlight
            : this.sampleColor(normalized, palette.steps);

        data[index] = color[0];
        data[index + 1] = color[1];
        data[index + 2] = color[2];
        data[index + 3] = 255;
        index += 4;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    if (this.trailCtx && this.trailCanvas && this.trailEnergy > 0.004) {
      this.trailCtx.save();
      this.trailCtx.globalCompositeOperation = 'destination-in';
      this.trailCtx.fillStyle = `rgba(0,0,0,${variant.trailFade})`;
      this.trailCtx.fillRect(0, 0, this.renderWidth, this.renderHeight);
      this.trailCtx.restore();

      ctx.drawImage(this.trailCanvas, 0, 0, this.renderWidth, this.renderHeight);

      if (!this.isPointerDrawing) {
        this.trailEnergy *= 0.986;
      } else {
        this.trailEnergy = 1;
      }
    }

    this.needsRender = false;
  }

  private attachPointerEvents(): void {
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        return;
      }

      const point = this.getPointerPosition(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      if (this.normalizedVariant === 'contour') {
        this.isPointerDrawing = false;
        this.lastTrailX = null;
        this.lastTrailY = null;
        this.addContourRipple(point.x, point.y);
        return;
      }

      this.isPointerDrawing = true;
      this.lastTrailX = null;
      this.lastTrailY = null;
      this.addTrail(point.x, point.y);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!this.isPointerDrawing || event.pointerType === 'touch') {
        return;
      }

      const point = this.getPointerPosition(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      this.addTrail(point.x, point.y);
    };

    const onPointerUp = () => {
      this.isPointerDrawing = false;
      this.lastTrailX = null;
      this.lastTrailY = null;
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    this.teardownEvents.push(() => window.removeEventListener('pointerdown', onPointerDown));
    this.teardownEvents.push(() => window.removeEventListener('pointermove', onPointerMove));
    this.teardownEvents.push(() => window.removeEventListener('pointerup', onPointerUp));
    this.teardownEvents.push(() => window.removeEventListener('pointercancel', onPointerUp));
  }

  private addTrail(x: number, y: number): void {
    if (!this.trailCtx) {
      return;
    }

    const palette = this.getPalette();
    const baseWidth = Math.max(2, Math.round(Math.min(this.renderWidth, this.renderHeight) * 0.012));
    const glowWidth = baseWidth * 2.3;

    if (this.lastTrailX !== null && this.lastTrailY !== null) {
      this.trailCtx.beginPath();
      this.trailCtx.moveTo(this.lastTrailX, this.lastTrailY);
      this.trailCtx.lineTo(x, y);
      this.trailCtx.strokeStyle = palette.trailCore;
      this.trailCtx.lineWidth = baseWidth;
      this.trailCtx.lineCap = 'round';
      this.trailCtx.lineJoin = 'round';
      this.trailCtx.stroke();

      this.trailCtx.beginPath();
      this.trailCtx.moveTo(this.lastTrailX, this.lastTrailY);
      this.trailCtx.lineTo(x, y);
      this.trailCtx.strokeStyle = palette.trailGlow;
      this.trailCtx.lineWidth = glowWidth;
      this.trailCtx.lineCap = 'round';
      this.trailCtx.stroke();
    }

    this.lastTrailX = x;
    this.lastTrailY = y;
    this.trailEnergy = 1;
    this.needsRender = true;
  }

  private getPointerPosition(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();

    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom ||
      !rect.width ||
      !rect.height
    ) {
      return null;
    }

    const scaleX = this.renderWidth / rect.width;
    const scaleY = this.renderHeight / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  private createTrailCanvas(): void {
    this.trailCanvas = document.createElement('canvas');
    this.trailCanvas.width = this.renderWidth;
    this.trailCanvas.height = this.renderHeight;
    this.trailCtx = this.trailCanvas.getContext('2d', { alpha: true, desynchronized: true });
  }

  private addContourRipple(x: number, y: number): void {
    const scale = Math.min(this.renderWidth, this.renderHeight) / 600;

    for (let index = 0; index < 3; index += 1) {
      this.contourRipples.push({
        x,
        y,
        wl: (20 + index * 14) * scale,
        phase: index * 1.1,
        amp: 1.4 - index * 0.3,
        born: this.time,
        life: 6 + index * 0.5
      });
    }

    this.needsRender = true;
  }

  private drawContourFrame(): void {
    const ctx = this.ctx;

    if (!ctx || !this.renderWidth || !this.renderHeight) {
      return;
    }

    const palette = this.getPalette();
    const width = this.renderWidth;
    const height = this.renderHeight;
    const minSide = Math.min(width, height);
    const scale = minSide / 600;
    const resolution = Math.round(this.clamp(minSide / 150, 3, 6));
    const cols = Math.floor(width / resolution) + 1;
    const rows = Math.floor(height / resolution) + 1;
    const field = this.getContourField(rows * cols);
    const radius = minSide * 0.27;
    const levels = [-1.4, -0.8, -0.3, 0, 0.3, 0.8, 1.4];
    const lineColors = palette.contourLines ?? ['#0a1628', '#0d2137', '#0e3a5e', '#1a5276', '#1f618d', '#2980b9', '#5dade2'];
    const now = this.time;
    const baseSources = Array.from({ length: 8 }, (_, index) => {
      const angle = (index / 8) * TAU;

      return {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        wl: (40 + (index % 4) * 10) * scale,
        phase: angle
      };
    });

    this.contourRipples = this.contourRipples.filter((source) => now - source.born < source.life);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = col * resolution;
        const y = row * resolution;
        let amplitude = 0;

        for (let sourceIndex = 0; sourceIndex < baseSources.length; sourceIndex += 1) {
          const source = baseSources[sourceIndex];
          const sx = source.x + Math.sin(now * 0.4 + source.phase) * 10 * scale;
          const sy = source.y + Math.cos(now * 0.3 + source.phase) * 10 * scale;
          const distance = Math.hypot(x - sx, y - sy);
          const falloff = Math.max(0, 1 - distance / (minSide * 0.54));

          amplitude += 0.25 * falloff * Math.sin((distance / source.wl - now * 0.9) * TAU + source.phase);
        }

        for (let rippleIndex = 0; rippleIndex < this.contourRipples.length; rippleIndex += 1) {
          const ripple = this.contourRipples[rippleIndex];
          const age = now - ripple.born;

          if (age < 0) {
            continue;
          }

          const distance = Math.hypot(x - ripple.x, y - ripple.y);
          const wavefront = age * 60;
          const spread = (80 + age * 20) * scale;
          const envelope = Math.max(0, 1 - Math.abs(distance - wavefront) / spread);
          const decay = Math.max(0, 1 - age / ripple.life);
          const falloff = envelope * decay * Math.max(0, 1 - distance / (minSide * 0.9));

          amplitude += ripple.amp * falloff * Math.sin((distance / ripple.wl - now * 0.9) * TAU + ripple.phase);
        }

        field[row * cols + col] = amplitude;
      }
    }

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.5, height * 0.44, minSide * 0.06, width * 0.5, height * 0.5, minSide * 0.82);
    glow.addColorStop(0, 'rgba(174, 214, 241, 0.1)');
    glow.addColorStop(1, 'rgba(10, 22, 40, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
      const level = levels[levelIndex];

      ctx.strokeStyle = lineColors[Math.min(levelIndex, lineColors.length - 1)];
      ctx.lineWidth = levelIndex === Math.floor(levels.length / 2) ? Math.max(1.1, scale * 1.15) : Math.max(0.7, scale * 0.72);
      ctx.globalAlpha = 0.74 + (levelIndex / levels.length) * 0.22;
      ctx.beginPath();

      for (let row = 0; row < rows - 1; row += 1) {
        for (let col = 0; col < cols - 1; col += 1) {
          const index = row * cols + col;
          const x = col * resolution;
          const y = row * resolution;
          const v00 = field[index] > level;
          const v10 = field[index + 1] > level;
          const v11 = field[index + cols + 1] > level;
          const v01 = field[index + cols] > level;

          if (v00 !== v10) {
            ctx.moveTo(x + resolution / 2, y);
            ctx.lineTo(x + resolution, y + resolution / 2);
          }

          if (v10 !== v11) {
            ctx.moveTo(x + resolution, y + resolution / 2);
            ctx.lineTo(x + resolution / 2, y + resolution);
          }

          if (v11 !== v01) {
            ctx.moveTo(x + resolution / 2, y + resolution);
            ctx.lineTo(x, y + resolution / 2);
          }

          if (v01 !== v00) {
            ctx.moveTo(x, y + resolution / 2);
            ctx.lineTo(x + resolution / 2, y);
          }
        }
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  private getContourField(size: number): Float32Array {
    if (this.contourField.length !== size) {
      this.contourField = new Float32Array(size);
    }

    return this.contourField;
  }

  private getRenderDimensions(displayWidth: number, displayHeight: number): { width: number; height: number } {
    const aspect = displayWidth / displayHeight;
    const pixelBudget = this.getVariantConfig().renderPixels * this.clampedIntensity;

    let width = Math.round(Math.sqrt(pixelBudget * aspect));
    let height = Math.round(Math.sqrt(pixelBudget / aspect));

    width = this.clamp(width, 170, 430);
    height = this.clamp(height, 150, 430);

    return { width, height };
  }

  private getVariantConfig(): PondVariantConfig {
    if (this.normalizedVariant === 'soft') {
      return {
        renderPixels: 54000,
        speed: 0.36,
        waveScale: 1.08,
        threshold: 0.11,
        trailFade: 0.992
      };
    }

    if (this.normalizedVariant === 'hero') {
      return {
        renderPixels: 92000,
        speed: 0.54,
        waveScale: 0.94,
        threshold: 0.085,
        trailFade: 0.995
      };
    }

    if (this.normalizedVariant === 'contour') {
      return {
        renderPixels: 88000,
        speed: 0.48,
        waveScale: 1,
        threshold: 0.1,
        trailFade: 0.994
      };
    }

    return {
      renderPixels: 72000,
      speed: 0.44,
      waveScale: 1,
      threshold: 0.095,
      trailFade: 0.994
    };
  }

  private getPalette(): PondPalette {
    if (this.normalizedTone === 'midnight') {
      return {
        steps: [
          [10, 22, 40],
          [13, 33, 55],
          [14, 58, 94],
          [26, 82, 118],
          [31, 97, 141],
          [41, 128, 185],
          [93, 173, 226],
          [133, 193, 233],
          [174, 214, 241],
          [226, 240, 250]
        ],
        highlight: [214, 236, 249],
        trailCore: 'rgba(255,255,255,0.48)',
        trailGlow: 'rgba(174,214,241,0.24)',
        background: '#0a1f3d',
        contourLines: ['#0a1628', '#0d2137', '#0e3a5e', '#1a5276', '#1f618d', '#2980b9', '#5dade2']
      };
    }

    if (this.normalizedTone === 'teal') {
      return {
        steps: [
          [30, 80, 140],
          [40, 100, 165],
          [55, 125, 190],
          [75, 150, 210],
          [100, 170, 220],
          [130, 190, 230],
          [160, 210, 238],
          [190, 225, 244],
          [215, 238, 250],
          [235, 247, 255]
        ],
        highlight: [230, 243, 255],
        trailCore: 'rgba(255,255,255,0.56)',
        trailGlow: 'rgba(190,225,255,0.26)',
        background: '#082034'
      };
    }

    return {
      steps: [
        [0, 74, 88],
        [0, 90, 101],
        [9, 109, 112],
        [24, 127, 120],
        [44, 146, 128],
        [73, 164, 141],
        [109, 184, 160],
        [151, 205, 182],
        [197, 228, 211],
        [233, 247, 241]
      ],
      highlight: [222, 243, 236],
      trailCore: 'rgba(255,255,255,0.48)',
      trailGlow: 'rgba(150,220,205,0.22)',
      background: '#041f22'
    };
  }

  private sampleColor(normalized: number, palette: Array<[number, number, number]>): [number, number, number] {
    const t = (normalized + 1) / 2;
    const scaled = t * (palette.length - 1);
    const index = Math.floor(scaled);
    const from = palette[Math.min(index, palette.length - 1)];
    const to = palette[Math.min(index + 1, palette.length - 1)];
    const blend = scaled - index;

    return [
      Math.round(from[0] + (to[0] - from[0]) * blend),
      Math.round(from[1] + (to[1] - from[1]) * blend),
      Math.round(from[2] + (to[2] - from[2]) * blend)
    ];
  }

  private syncCanvasPresentation(): void {
    const canvas = this.canvasRef?.nativeElement;

    if (!canvas) {
      return;
    }

    canvas.style.opacity = String(this.clampedOpacity);
    canvas.style.imageRendering = this.normalizedVariant === 'contour' ? 'auto' : 'pixelated';
    canvas.style.filter =
      this.normalizedVariant === 'contour' ? 'saturate(114%) contrast(108%)' : 'saturate(106%) contrast(103%)';

    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = this.normalizedVariant === 'contour';
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
