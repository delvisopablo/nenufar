import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject
} from '@angular/core';
import * as THREE from 'three';
import { NenufarPerformanceService } from '../../../core/performance/nenufar-performance.service';

type AmbientDrifterKind = 'leaf' | 'gleam';

type AmbientDrifter = {
  baseU: number;
  baseV: number;
  driftX: number;
  driftY: number;
  kind: AmbientDrifterKind;
  opacity: number;
  phase: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  speed: number;
  tint: string;
};

type PondWaveSource = {
  amp: number;
  born: number;
  life: number;
  phase: number;
  wl: number;
  x: number;
  y: number;
};

type ClickRipple = {
  startAt: number;
  strength: number;
  uv: THREE.Vector2;
};

type ViewportSize = {
  height: number;
  width: number;
};

@Component({
  selector: 'app-estanque-background',
  standalone: true,
  templateUrl: './estanque-background.component.html',
  styleUrl: './estanque-background.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstanqueBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('bgCanvas', { static: true }) private bgCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewport', { static: true }) private viewportRef?: ElementRef<HTMLDivElement>;

  private readonly ngZone = inject(NgZone);
  private readonly performanceService = inject(NenufarPerformanceService);
  private readonly performanceProfile = this.performanceService.getProfile();

  private readonly clickRippleDuration = 2.5;
  private readonly maxClickRipples = 3;
  private readonly maxPads = 26;
  private readonly maxPondClickSources = this.performanceProfile.background.maxClickSources;
  private readonly worldHeight = 10;
  private readonly initialSpawnBounds = {
    left: -4.65,
    right: 4.65,
    top: 3.35,
    bottom: -3.35
  };
  private readonly minWorldWidth = Math.max(
    this.worldHeight,
    this.initialSpawnBounds.right - this.initialSpawnBounds.left + 0.7
  );

  private animationFrameId: number | null = null;
  private bgCanvas?: HTMLCanvasElement;
  private bgCtx?: CanvasRenderingContext2D | null;
  private bounds = { left: -5, right: 5, top: 5, bottom: -5 };
  private camera?: THREE.OrthographicCamera;
  private clockStart = 0;
  private destroyed = false;
  private lastFrameAt = 0;
  private renderer?: THREE.WebGLRenderer;
  private resizeObserver?: ResizeObserver;
  private scene?: THREE.Scene;
  private waterGeometry?: THREE.PlaneGeometry;
  private waterMaterial?: THREE.ShaderMaterial;
  private waterMesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  private ambientDrifters: AmbientDrifter[] = [];
  private pondBaseSources: PondWaveSource[] = [];
  private pondClickSources: PondWaveSource[] = [];
  private pondField = new Float32Array(0);
  private pondWidth = 0;
  private pondHeight = 0;
  private pondCols = 0;
  private pondRows = 0;
  private pondRes = 8;
  private readonly pondLevels = [-1.25, -0.8, -0.35, 0, 0.35, 0.8, 1.25];
  private readonly pondPalette = [
    '#0f2e53',
    '#13496f',
    '#1e6f92',
    '#459cbd',
    '#77bdd8',
    '#bde5f1',
    '#f1feff'
  ];
  private ripples: ClickRipple[] = [];

  triggerRippleAtClientPoint(clientX: number, clientY: number, strength = 1): void {
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) {
      return;
    }

    const elapsed = this.elapsedNow();
    const uv = new THREE.Vector2(
      THREE.MathUtils.clamp(localX / rect.width, 0, 1),
      THREE.MathUtils.clamp(1 - localY / rect.height, 0, 1)
    );

    this.ripples.unshift({
      startAt: elapsed,
      strength,
      uv
    });
    this.ripples = this.ripples.slice(0, this.maxClickRipples);
    this.syncClickRippleUniforms();

    const x = uv.x * this.pondWidth;
    const y = (1 - uv.y) * this.pondHeight;

    for (let k = 0; k < 3; k += 1) {
      this.pondClickSources.push({
        x,
        y,
        wl: 18 + k * 13,
        phase: k * 1.08,
        amp: (1.35 - k * 0.24) * THREE.MathUtils.lerp(0.8, 1.08, strength),
        born: elapsed,
        life: 2.3 + k * 0.28
      });
    }

    if (this.pondClickSources.length > this.maxPondClickSources) {
      this.pondClickSources.splice(0, this.pondClickSources.length - this.maxPondClickSources);
    }
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initializeScene();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;

    if (this.waterMesh && this.scene) {
      this.scene.remove(this.waterMesh);
    }

    this.waterGeometry?.dispose();
    this.waterMaterial?.dispose();
    this.renderer?.dispose();

    const rendererCanvas = this.renderer?.domElement;
    if (rendererCanvas?.parentElement) {
      rendererCanvas.parentElement.removeChild(rendererCanvas);
    }

    this.bgCtx = null;
    this.pondBaseSources = [];
    this.pondClickSources = [];
    this.pondField = new Float32Array(0);
    this.ambientDrifters = [];
    this.ripples = [];
  }

  private initializeScene(): void {
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport || this.destroyed) {
      return;
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: this.performanceProfile.background.antialias,
      powerPreference: this.performanceProfile.mode === 'lite' ? 'low-power' : 'high-performance'
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, this.performanceProfile.background.maxPixelRatio),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.classList.add('estanque-canvas');
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.inset = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.pointerEvents = 'none';
    viewport.appendChild(this.renderer.domElement);

    this.initBackgroundPond();
    this.createWater();
    this.resizeRenderer();
    this.resizeBackgroundPond();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeRenderer();
        this.resizeBackgroundPond();
      });
      this.resizeObserver.observe(viewport);
    }

    const now = performance.now() * 0.001;
    this.clockStart = now;
    this.lastFrameAt = now;
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  }

  private createWater(): void {
    if (!this.scene) {
      return;
    }

    this.waterGeometry = new THREE.PlaneGeometry(1, 1);
    this.waterMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uClickRipples: {
          value: Array.from({ length: this.maxClickRipples }, () => new THREE.Vector4(-10, -10, -100, 0))
        },
        uFocusHalo: { value: new THREE.Vector4(0, 0, 0, 0) },
        uWakeRipples: {
          value: Array.from({ length: this.maxPads }, () => new THREE.Vector4())
        },
        uWakeDirs: {
          value: Array.from({ length: this.maxPads }, () => new THREE.Vector4())
        }
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec2 vUv;

        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec4 uClickRipples[3];
        uniform vec4 uFocusHalo;
        uniform vec4 uWakeRipples[26];
        uniform vec4 uWakeDirs[26];

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);

          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));

          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.55;

          for (int i = 0; i < 5; i++) {
            value += amplitude * noise(p);
            p = p * 2.03 + vec2(7.1, 13.4);
            amplitude *= 0.5;
          }

          return value;
        }

        vec2 metric(vec2 delta) {
          delta.x *= uResolution.x / max(uResolution.y, 1.0);
          return delta;
        }

        void main() {
          vec2 distortion = vec2(0.0);
          float foamBoost = 0.0;
          float causticBoost = 0.0;
          float focusAura = 0.0;
          float focusRing = 0.0;

          for (int i = 0; i < 3; i++) {
            vec4 ripple = uClickRipples[i];
            float age = uTime - ripple.z;

            if (age > 0.0 && age < 2.5 && ripple.w > 0.0) {
              vec2 delta = metric(vUv - ripple.xy);
              float dist = length(delta) + 0.0001;
              vec2 dir = delta / dist;
              float radius = age * mix(0.12, 0.22, ripple.w);
              float ring = exp(-15.0 * abs(dist - radius));
              float oscillation = sin(dist * 50.0 - age * 11.5);
              float fade = 1.0 - age / 2.5;
              float pulse = oscillation * ring * fade * ripple.w;

              distortion += dir * pulse * 0.012;
              foamBoost += smoothstep(0.18, 0.0, abs(dist - radius)) * 0.34 * fade * ripple.w;
              causticBoost += smoothstep(0.22, 0.0, abs(dist - radius * 0.82)) * 0.24 * fade * ripple.w;
            }
          }

          for (int i = 0; i < 26; i++) {
            vec4 wake = uWakeRipples[i];

            if (wake.w > 0.001) {
              vec4 wakeDir = uWakeDirs[i];
              vec2 delta = metric(vUv - wake.xy);
              vec2 dir = normalize(metric(wakeDir.xy) + vec2(0.0001, 0.0));
              vec2 perp = vec2(-dir.y, dir.x);

              float radius = max(0.012, wake.z);
              float strength = wake.w;
              float trail = dot(delta, -dir);
              float ahead = dot(delta, dir);
              float side = dot(delta, perp);

              float body = exp(
                -pow(side / (radius * 0.78), 2.0)
                -pow(ahead / (radius * 0.74), 2.0)
              );
              float wakeEnvelope = exp(
                -pow(side / (radius * 0.64), 2.0)
                -pow(max(0.0, trail - radius * 0.05) / (radius * 1.68), 2.0)
              );
              float wakeWave = sin(trail * 96.0 - uTime * 6.9 - wakeDir.z) * wakeEnvelope;
              vec2 localDir = normalize(delta + vec2(0.0001, 0.0));

              distortion += localDir * body * strength * 0.0022;
              distortion += perp * wakeWave * strength * 0.0038;
              foamBoost += (body * 0.08 + wakeEnvelope * 0.07) * strength;
              causticBoost += wakeEnvelope * strength * 0.06;
            }
          }

          if (uFocusHalo.z > 0.0) {
            vec2 focusDelta = metric(vUv - uFocusHalo.xy);
            float focusDist = length(focusDelta) + 0.0001;
            float focusPulse = 0.5 + 0.5 * sin(uTime * 0.34 + uFocusHalo.w * 0.7);
            float focusRadius = uFocusHalo.z * (1.28 + focusPulse * 0.12);
            vec2 focusDir = focusDelta / focusDist;

            focusAura = exp(-pow(focusDist / max(focusRadius * 2.15, 0.0001), 2.0));
            focusRing = exp(-18.0 * abs(focusDist - focusRadius * 1.08));

            distortion += focusDir * focusRing * (0.0032 + focusPulse * 0.0011);
            foamBoost += focusAura * 0.085 + focusRing * 0.095;
            causticBoost += focusAura * 0.16 + focusRing * 0.07;
          }

          vec2 uv = vUv + distortion;
          vec2 drift = vec2(uTime * 0.008, -uTime * 0.011);

          float baseField = fbm(uv * 2.35 + drift);
          float softField = fbm(uv * 4.15 - drift * 0.85);
          float foamField = fbm(uv * 7.3 + vec2(-uTime * 0.024, uTime * 0.021));
          float depthField = fbm(uv * 1.22 + vec2(-uTime * 0.0032, uTime * 0.0026));
          float glazeField = fbm(uv * 1.65 + vec2(uTime * 0.0045, -uTime * 0.0034));
          float reflectionField = fbm(uv * 0.86 + vec2(-uTime * 0.0022, uTime * 0.0018));

          float foam = smoothstep(0.62, 0.92, foamField * 0.72 + softField * 0.42) * 0.16;
          float basinDepth = smoothstep(0.14, 0.84, depthField * 0.74 + reflectionField * 0.44);

          float reflectionA = sin((uv.x * 3.4 + uv.y * 1.3) + uTime * 0.045 + glazeField * 1.4);
          float reflectionB = sin((uv.x * -2.2 + uv.y * 2.8) - uTime * 0.034 + depthField * 1.7);
          float broadReflection = smoothstep(
            0.5,
            0.92,
            reflectionA * 0.24 + reflectionB * 0.22 + glazeField * 0.74
          );
          float skyLift = smoothstep(1.12, -0.18, vUv.y + depthField * 0.16) * 0.16;

          float causticA = sin((uv.x + softField * 0.11 + uTime * 0.034) * 24.0);
          float causticB = sin((uv.y - baseField * 0.14 - uTime * 0.028) * 21.0);
          float causticC = sin((uv.x + uv.y + softField * 0.16 + uTime * 0.022) * 15.0);
          float caustics = pow(max(0.0, causticA * causticB * 0.58 + causticC * 0.42), 2.0);
          float causticSlow = pow(
            max(
              0.0,
              sin((uv.x * 11.0 - uv.y * 7.6 + glazeField * 4.2 + uTime * 0.14)) * 0.5 + 0.5
            ),
            4.2
          ) * (0.055 + focusAura * 0.05);
          caustics *= 0.24 + causticBoost;
          caustics += causticSlow;

          vec3 white = vec3(0.987, 0.996, 1.0);
          vec3 pale = vec3(0.84, 0.95, 0.99);
          vec3 aqua = vec3(0.71, 0.89, 0.96);
          vec3 blue = vec3(0.58, 0.81, 0.93);
          vec3 deepAqua = vec3(0.46, 0.77, 0.9);

          vec3 color = mix(white, pale, smoothstep(0.04, 0.58, baseField));
          color = mix(color, aqua, smoothstep(0.22, 0.88, baseField * 0.82 + softField * 0.23));
          color = mix(color, blue, smoothstep(0.56, 1.0, baseField * 0.88));
          color = mix(color, deepAqua, basinDepth * 0.2);
          color = mix(color, vec3(0.992, 0.998, 1.0), broadReflection * 0.12 + skyLift);
          color += vec3(0.04, 0.065, 0.055) * caustics;
          color += caustics * vec3(0.15, 0.18, 0.14);
          color = mix(color, vec3(0.996, 0.999, 1.0), focusAura * 0.09 + focusRing * 0.04);
          color = mix(color, vec3(0.996, 0.999, 1.0), clamp(foam + foamBoost, 0.0, 0.74));

          gl_FragColor = vec4(color, 0.82);
        }
      `
    });

    this.waterMesh = new THREE.Mesh(this.waterGeometry, this.waterMaterial);
    this.waterMesh.position.set(0, 0, -0.2);
    this.scene.add(this.waterMesh);
  }

  private renderLoop = (timestampMs: number): void => {
    if (this.destroyed || !this.renderer || !this.waterMaterial) {
      return;
    }

    const now = timestampMs * 0.001;
    if (
      this.lastFrameAt &&
      timestampMs - this.lastFrameAt * 1000 < this.performanceProfile.background.frameIntervalMs
    ) {
      this.animationFrameId = requestAnimationFrame(this.renderLoop);
      return;
    }

    const elapsed = now - this.clockStart;
    this.lastFrameAt = now;

    this.waterMaterial.uniforms['uTime'].value = elapsed;
    this.cleanupRipples(elapsed);

    this.renderBackgroundPond(elapsed);
    this.renderer.render(this.scene!, this.camera!);
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  private initBackgroundPond(): void {
    const canvas = this.bgCanvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    this.bgCanvas = canvas;
    this.bgCtx = canvas.getContext('2d', { alpha: false });
    this.resizeBackgroundPond();
  }

  private resizeBackgroundPond(): void {
    const canvas = this.bgCanvas;
    const ctx = this.bgCtx;

    if (!canvas || !ctx) {
      return;
    }

    const size = this.measureViewportSize();
    if (!size) {
      return;
    }

    const { width, height } = size;
    const dpr = 1;
    this.pondWidth = Math.max(1, Math.round(width * dpr));
    this.pondHeight = Math.max(1, Math.round(height * dpr));

    canvas.width = this.pondWidth;
    canvas.height = this.pondHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    this.pondRes = Math.max(
      this.performanceProfile.background.pondResolution,
      width < 720 ? 10 : 8,
    );
    this.pondCols = Math.max(2, Math.floor(this.pondWidth / this.pondRes));
    this.pondRows = Math.max(2, Math.floor(this.pondHeight / this.pondRes));
    this.pondField = new Float32Array(this.pondRows * this.pondCols);

    this.rebuildBackgroundBaseSources();
    this.seedAmbientDrifters();
  }

  private rebuildBackgroundBaseSources(): void {
    this.pondBaseSources = [];

    if (!this.pondWidth || !this.pondHeight) {
      return;
    }

    const ring = this.performanceProfile.background.baseWaveSources;
    const radius = Math.min(this.pondWidth, this.pondHeight) * 0.24;

    for (let i = 0; i < ring; i += 1) {
      const angle = (i / ring) * Math.PI * 2;

      this.pondBaseSources.push({
        x: this.pondWidth * 0.5 + Math.cos(angle) * radius,
        y: this.pondHeight * 0.5 + Math.sin(angle) * radius,
        wl: 34 + (i % 4) * 10,
        phase: angle,
        amp: 0.2,
        born: -Infinity,
        life: Infinity
      });
    }
  }

  private seedAmbientDrifters(): void {
    this.ambientDrifters = [];

    const leafTints = [
      'rgba(109, 148, 124, 0.16)',
      'rgba(133, 165, 142, 0.14)',
      'rgba(165, 192, 169, 0.12)'
    ];

    for (let index = 0; index < this.performanceProfile.background.leafCount; index += 1) {
      const point = this.sampleAmbientLocation(0.18);
      this.ambientDrifters.push({
        baseU: point.x,
        baseV: point.y,
        driftX: THREE.MathUtils.randFloat(0.02, 0.038),
        driftY: THREE.MathUtils.randFloat(0.014, 0.028),
        kind: 'leaf',
        opacity: THREE.MathUtils.randFloat(0.8, 1),
        phase: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: THREE.MathUtils.randFloat(0.04, 0.08),
        size: THREE.MathUtils.randFloat(20, 34),
        speed: THREE.MathUtils.randFloat(0.04, 0.082),
        tint: leafTints[index % leafTints.length]
      });
    }

    for (let index = 0; index < this.performanceProfile.background.gleamCount; index += 1) {
      const point = this.sampleAmbientLocation(0.12);
      this.ambientDrifters.push({
        baseU: point.x,
        baseV: point.y,
        driftX: THREE.MathUtils.randFloat(0.012, 0.026),
        driftY: THREE.MathUtils.randFloat(0.01, 0.024),
        kind: 'gleam',
        opacity: THREE.MathUtils.randFloat(0.72, 0.98),
        phase: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: THREE.MathUtils.randFloat(0.02, 0.05),
        size: THREE.MathUtils.randFloat(14, 26),
        speed: THREE.MathUtils.randFloat(0.03, 0.06),
        tint: 'rgba(255, 255, 255, 0.22)'
      });
    }
  }

  private sampleAmbientLocation(minCenterDistance: number): THREE.Vector2 {
    for (let attempt = 0; attempt < 36; attempt += 1) {
      const point = new THREE.Vector2(
        THREE.MathUtils.randFloat(0.08, 0.92),
        THREE.MathUtils.randFloat(0.08, 0.92)
      );
      if (point.distanceTo(new THREE.Vector2(0.5, 0.5)) >= minCenterDistance) {
        return point;
      }
    }

    return new THREE.Vector2(
      THREE.MathUtils.randFloat(0.1, 0.9),
      THREE.MathUtils.randFloat(0.1, 0.9)
    );
  }

  private renderBackgroundPond(elapsed: number): void {
    const ctx = this.bgCtx;
    if (!ctx || !this.pondRows || !this.pondCols) {
      return;
    }

    ctx.fillStyle = '#d9f3fb';
    ctx.fillRect(0, 0, this.pondWidth, this.pondHeight);
    this.renderEdgeAtmosphere(elapsed);

    this.pondClickSources = this.pondClickSources.filter(
      (source) => elapsed - source.born < source.life
    );

    for (let row = 0; row < this.pondRows; row += 1) {
      for (let col = 0; col < this.pondCols; col += 1) {
        const x = col * this.pondRes;
        const y = row * this.pondRes;
        let amp = 0;

        for (const src of this.pondBaseSources) {
          const sx = src.x + Math.sin(elapsed * 0.35 + src.phase) * 10;
          const sy = src.y + Math.cos(elapsed * 0.28 + src.phase) * 10;
          const dx = x - sx;
          const dy = y - sy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const falloff = Math.max(0, 1 - dist / (Math.min(this.pondWidth, this.pondHeight) * 0.5));
          amp += src.amp * falloff *
            Math.sin((dist / src.wl - elapsed * 0.82) * Math.PI * 2 + src.phase);
        }

        for (const src of this.pondClickSources) {
          const age = elapsed - src.born;
          if (age < 0 || age >= src.life) {
            continue;
          }

          const dx = x - src.x;
          const dy = y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const wavefront = age * 78;
          const spread = 86 + age * 18;
          const envelope = Math.max(0, 1 - Math.abs(dist - wavefront) / spread);
          const decay = Math.max(0, 1 - age / src.life);
          const falloff = envelope * decay * Math.max(
            0,
            1 - dist / (Math.max(this.pondWidth, this.pondHeight) * 0.65)
          );

          amp += src.amp * falloff *
            Math.sin((dist / src.wl - elapsed * 1.08) * Math.PI * 2 + src.phase);
        }

        this.pondField[row * this.pondCols + col] = amp;
      }
    }

    const middle = Math.floor(this.pondLevels.length / 2);

    for (let li = 0; li < this.pondLevels.length; li += 1) {
      const level = this.pondLevels[li];

      ctx.strokeStyle = this.pondPalette[li];
      ctx.lineWidth = li === middle ? 1.35 : 0.85;
      ctx.globalAlpha = 0.42 + (li / this.pondLevels.length) * 0.18;
      ctx.beginPath();

      for (let row = 0; row < this.pondRows - 1; row += 1) {
        for (let col = 0; col < this.pondCols - 1; col += 1) {
          const idx = row * this.pondCols + col;
          const x = col * this.pondRes;
          const y = row * this.pondRes;

          const v00 = this.pondField[idx] > level;
          const v10 = this.pondField[idx + 1] > level;
          const v11 = this.pondField[idx + this.pondCols + 1] > level;
          const v01 = this.pondField[idx + this.pondCols] > level;

          if (v00 !== v10) {
            ctx.moveTo(x + this.pondRes * 0.5, y);
            ctx.lineTo(x + this.pondRes, y + this.pondRes * 0.5);
          }
          if (v10 !== v11) {
            ctx.moveTo(x + this.pondRes, y + this.pondRes * 0.5);
            ctx.lineTo(x + this.pondRes * 0.5, y + this.pondRes);
          }
          if (v11 !== v01) {
            ctx.moveTo(x + this.pondRes * 0.5, y + this.pondRes);
            ctx.lineTo(x, y + this.pondRes * 0.5);
          }
          if (v01 !== v00) {
            ctx.moveTo(x, y + this.pondRes * 0.5);
            ctx.lineTo(x + this.pondRes * 0.5, y);
          }
        }
      }

      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    this.renderAmbientDrifters(elapsed);
  }

  private renderEdgeAtmosphere(elapsed: number): void {
    const ctx = this.bgCtx;
    if (!ctx) {
      return;
    }

    const minSide = Math.min(this.pondWidth, this.pondHeight);
    ctx.save();

    const topGlow = ctx.createRadialGradient(
      this.pondWidth * (0.52 + Math.sin(elapsed * 0.018) * 0.03),
      this.pondHeight * 0.08,
      minSide * 0.06,
      this.pondWidth * 0.5,
      this.pondHeight * 0.1,
      minSide * 0.64
    );
    topGlow.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
    topGlow.addColorStop(0.55, 'rgba(206, 239, 247, 0.18)');
    topGlow.addColorStop(1, 'rgba(206, 239, 247, 0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, this.pondWidth, this.pondHeight);

    const edgeMistLeft = ctx.createRadialGradient(
      this.pondWidth * 0.02,
      this.pondHeight * (0.28 + Math.sin(elapsed * 0.026) * 0.02),
      minSide * 0.04,
      this.pondWidth * 0.02,
      this.pondHeight * 0.3,
      minSide * 0.42
    );
    edgeMistLeft.addColorStop(0, 'rgba(111, 152, 126, 0.18)');
    edgeMistLeft.addColorStop(0.58, 'rgba(111, 152, 126, 0.09)');
    edgeMistLeft.addColorStop(1, 'rgba(111, 152, 126, 0)');
    ctx.fillStyle = edgeMistLeft;
    ctx.fillRect(0, 0, this.pondWidth, this.pondHeight);

    const edgeMistRight = ctx.createRadialGradient(
      this.pondWidth * 0.98,
      this.pondHeight * (0.7 + Math.cos(elapsed * 0.022) * 0.025),
      minSide * 0.05,
      this.pondWidth * 0.98,
      this.pondHeight * 0.68,
      minSide * 0.4
    );
    edgeMistRight.addColorStop(0, 'rgba(133, 168, 144, 0.16)');
    edgeMistRight.addColorStop(0.56, 'rgba(133, 168, 144, 0.08)');
    edgeMistRight.addColorStop(1, 'rgba(133, 168, 144, 0)');
    ctx.fillStyle = edgeMistRight;
    ctx.fillRect(0, 0, this.pondWidth, this.pondHeight);

    ctx.strokeStyle = 'rgba(82, 120, 102, 0.085)';
    ctx.lineWidth = minSide * 0.045;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-minSide * 0.03, this.pondHeight * 0.18);
    ctx.bezierCurveTo(
      this.pondWidth * 0.06,
      this.pondHeight * 0.22,
      this.pondWidth * 0.02,
      this.pondHeight * 0.42,
      this.pondWidth * 0.08,
      this.pondHeight * 0.48
    );
    ctx.moveTo(this.pondWidth * 0.94, this.pondHeight * 0.54);
    ctx.bezierCurveTo(
      this.pondWidth * 0.9,
      this.pondHeight * 0.62,
      this.pondWidth * 0.97,
      this.pondHeight * 0.76,
      this.pondWidth * 1.02,
      this.pondHeight * 0.84
    );
    ctx.stroke();
    ctx.restore();
  }

  private renderAmbientDrifters(elapsed: number): void {
    const ctx = this.bgCtx;
    if (!ctx || !this.ambientDrifters.length) {
      return;
    }

    ctx.save();

    for (const drifter of this.ambientDrifters) {
      const u = this.repeat01(
        drifter.baseU +
          Math.sin(elapsed * drifter.speed + drifter.phase) * drifter.driftX +
          Math.sin(elapsed * drifter.speed * 0.42 + drifter.phase * 1.4) * drifter.driftX * 0.4
      );
      const v = this.repeat01(
        drifter.baseV +
          Math.cos(elapsed * drifter.speed * 0.78 + drifter.phase * 1.1) * drifter.driftY
      );
      const x = u * this.pondWidth;
      const y = v * this.pondHeight;
      const angle = drifter.rotation + elapsed * drifter.rotationSpeed;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = drifter.opacity;

      if (drifter.kind === 'leaf') {
        const leafWidth = drifter.size;
        const leafHeight = drifter.size * 0.46;
        const leafGradient = ctx.createLinearGradient(-leafWidth, 0, leafWidth, leafHeight * 0.4);
        leafGradient.addColorStop(0, drifter.tint);
        leafGradient.addColorStop(1, 'rgba(232, 248, 234, 0.05)');
        ctx.fillStyle = leafGradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, leafWidth, leafHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(240, 255, 244, 0.08)';
        ctx.lineWidth = Math.max(1, drifter.size * 0.06);
        ctx.beginPath();
        ctx.moveTo(-leafWidth * 0.5, 0);
        ctx.quadraticCurveTo(0, -leafHeight * 0.14, leafWidth * 0.52, leafHeight * 0.04);
        ctx.stroke();
      } else {
        const glow = ctx.createRadialGradient(0, 0, drifter.size * 0.08, 0, 0, drifter.size);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        glow.addColorStop(0.5, drifter.tint);
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(0, 0, drifter.size * 0.82, drifter.size * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private resizeRenderer(): void {
    if (!this.renderer || !this.waterMesh || !this.waterMaterial || !this.camera) {
      return;
    }

    const size = this.measureViewportSize();
    if (!size) {
      return;
    }

    const { width, height } = size;
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      this.performanceProfile.background.maxPixelRatio,
    );

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.domElement.style.width = `${width}px`;
    this.renderer.domElement.style.height = `${height}px`;

    const aspect = width / height;
    const worldWidth = Math.max(this.minWorldWidth, this.worldHeight * aspect);
    const worldHeight = Math.max(this.worldHeight, worldWidth / aspect);

    this.camera.left = -worldWidth / 2;
    this.camera.right = worldWidth / 2;
    this.camera.top = worldHeight / 2;
    this.camera.bottom = -worldHeight / 2;
    this.camera.position.set(0, 0, 10);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    this.bounds = {
      left: this.camera.left,
      right: this.camera.right,
      top: this.camera.top,
      bottom: this.camera.bottom
    };

    this.waterMesh.position.set(0, 0, -0.2);
    this.waterMesh.scale.set(worldWidth, worldHeight, 1);
    this.waterMaterial.uniforms['uResolution'].value.set(width, height);
  }

  private cleanupRipples(elapsed: number): void {
    const before = this.ripples.length;
    this.ripples = this.ripples.filter((ripple) => elapsed - ripple.startAt < this.clickRippleDuration);

    if (before !== this.ripples.length) {
      this.syncClickRippleUniforms();
    }
  }

  private elapsedNow(): number {
    return performance.now() * 0.001 - this.clockStart;
  }

  private repeat01(value: number): number {
    return ((value % 1) + 1) % 1;
  }

  private syncClickRippleUniforms(): void {
    const uniform = this.waterMaterial?.uniforms['uClickRipples']?.value as THREE.Vector4[] | undefined;
    if (!uniform) {
      return;
    }

    for (let index = 0; index < this.maxClickRipples; index += 1) {
      const ripple = this.ripples[index];
      if (ripple) {
        uniform[index].set(ripple.uv.x, ripple.uv.y, ripple.startAt, ripple.strength);
      } else {
        uniform[index].set(-10, -10, -100, 0);
      }
    }
  }

  private measureViewportSize(): ViewportSize | null {
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport) {
      return null;
    }

    const rect = viewport.getBoundingClientRect();
    const width = Math.max(
      1,
      Math.round(viewport.clientWidth || viewport.offsetWidth || rect.width)
    );
    const height = Math.max(
      1,
      Math.round(viewport.clientHeight || viewport.offsetHeight || rect.height)
    );

    return { width, height };
  }
}
