import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as THREE from 'three';
import { NenufarEngine } from '../nenufar/nenufar-engine';
import { NenufarEntity } from '../nenufar/nenufar.types';
import { AuthService } from '../../servicios/authService/auth.service';
import { CuentaAtrasService } from '../../servicios/cuentaAtrasServicio/cuenta-atras.service';
import { getUserErrorMessage, isAppErrorModel } from '../../core/errors/error-parser';
import { NenufarPerformanceService } from '../../core/performance/nenufar-performance.service';

type ClickRipple = {
  startAt: number;
  strength: number;
  uv: THREE.Vector2;
};

type PopupTheme = 'mist' | 'sun' | 'ember' | 'flare' | 'prism';

type PopupState = {
  combo: number;
  comboColor: string;
  comboScale: number;
  createdAt: number;
  driftX: number;
  driftY: number;
  duration: number;
  durationMs: number;
  endScale: number;
  glowColor: string;
  id: number;
  pointColor: string;
  pointSize: number;
  points: number;
  startScale: number;
  world: THREE.Vector2;
  x: number;
  y: number;
};

type PopupView = {
  comboColor: string;
  comboScale: number;
  comboText: string;
  driftX: number;
  driftY: number;
  durationMs: number;
  endScale: number;
  glowColor: string;
  id: number;
  pointColor: string;
  pointSize: number;
  pointsText: string;
  startScale: number;
  x: number;
  y: number;
};

type LilyPadBody = NenufarEntity<number> & {
  activationUntil: number;
  activeThrowId: number;
  angVel: number;
  angularDamping: number;
  appearT: number;
  baseScale: number;
  driftDir: THREE.Vector2;
  driftStrength: number;
  flowInfluence: number;
  glowMesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  haloMesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  isOriginal: boolean;
  lastTouchedAt: number;
  linearDamping: number;
  maxSpeed: number;
  maxSpin: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  microPhase: number;
  microSpeed: number;
  pos: THREE.Vector2;
  prevPos: THREE.Vector2;
  rotation: number;
  shadowMesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  shimmerOffset: number;
  spawnDelayUntil: number;
  swayAmplitude: number;
  vel: THREE.Vector2;
  wakeBoost: number;
  wakeStrength: number;
  wrappedThisFrame: boolean;
};

type ThrowState = {
  active: boolean;
  comboStep: number;
  id: number;
  lastEventAt: number;
  scoreTotal: number;
};

type PlacedSeed = {
  isFocal?: boolean;
  pos: THREE.Vector2;
  radius: number;
};

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

type PadTextureBackgroundMode = 'preserve-source-alpha' | 'remove-white-background';

type PadTextureLoadOptions = {
  backgroundMode: PadTextureBackgroundMode;
  fallbackColors: {
    dark: string;
    light: string;
    vein: string;
  };
};

type ViewportSize = {
  height: number;
  width: number;
};

@Component({
  selector: 'app-estanque',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './estanque.component.html',
  styleUrl: './estanque.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstanqueComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('bgCanvas', { static: true }) bgCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewport', { static: true }) viewportRef?: ElementRef<HTMLDivElement>;

  hudReady = false;
  hudVisible = false;
  popupViews: PopupView[] = [];

  loginModalOpen = false;
  loginEmail = '';
  loginPassword = '';
  loginRememberMe = false;
  loginSubmitting = false;
  loginError = '';
  logoPath = 'assets/imagenes/logo_nenufar_small.png';

  lastScore = 0;
  bestScore = 0;
  activeCombo = 0;

  private readonly activeThrowWindow = 1.2;
  private readonly clickRippleDuration = 2.5;
  private readonly collisionRestitution = 0.66;
  private readonly hudInfoDuration = 2.1;
  private readonly hudShowDuration = 1.95;
  private readonly idleTimeout = 1.2;
  private readonly maxClickRipples = 3;
  private readonly maxKick = 1.12;
  private readonly performanceProfile: ReturnType<NenufarPerformanceService['getProfile']>;
  private readonly maxPads = 26;
  private readonly activePadCount: number;
  private readonly maxPopupCount = 12;
  private readonly maxSpeed = 1.92;
  private readonly maxSpin = 0.142;
  private readonly minForce = 0.84;
  private readonly maxForce = 1.98;
  private readonly minScoreSpeed = 0.05;
  private readonly scoringPairCooldown = 0.16;
  private readonly touchTransferWindow = 1.2;
  private readonly wrapBoost = 0.008;
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

  private readonly interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly pointerNdc = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private readonly tempPoint = new THREE.Vector3();
  private readonly zeroVector = new THREE.Vector4(0, 0, 0, 0);

  private animationFrameId: number | null = null;
  private bounds = { left: -5, right: 5, top: 5, bottom: -5 };
  private camera!: THREE.OrthographicCamera;
  private clockStart = 0;
  private destroyed = false;
  private focusHaloTexture?: THREE.Texture;
  private focalPad: LilyPadBody | null = null;
  private glowTexture?: THREE.Texture;
  private hoverPad: LilyPadBody | null = null;
  private hudActivityUntil = 0;
  private lastFrameAt = 0;
  private lilyEngine?: NenufarEngine<LilyPadBody>;
  private lilyPads: LilyPadBody[] = [];
  private pairScoreAt = new Map<string, number>();
  private padById = new Map<number, LilyPadBody>();
  private padGeometry?: THREE.PlaneGeometry;
  private padShadowTexture?: THREE.Texture;
  private mustioTexture?: THREE.Texture;
  private originalTexture?: THREE.Texture;
  private popups: PopupState[] = [];
  private popupId = 0;
  private renderer?: THREE.WebGLRenderer;
  private resizeObserver?: ResizeObserver;
  private resizeSyncFrameId: number | null = null;
  private ripples: ClickRipple[] = [];
  private scene!: THREE.Scene;
  private throwState: ThrowState = {
    active: false,
    comboStep: 0,
    id: 0,
    lastEventAt: 0,
    scoreTotal: 0
  };
  private waterGeometry?: THREE.PlaneGeometry;
  private waterMaterial?: THREE.ShaderMaterial;
  private waterMesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  private bgCanvas?: HTMLCanvasElement;
  private bgCtx?: CanvasRenderingContext2D | null;
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
  private readonly maxPondClickSources: number;

  private readonly onWindowResize = (): void => {
    this.scheduleViewportSync();
  };

  private readonly onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.loginModalOpen) {
      return;
    }

    this.ngZone.run(() => {
      this.closeLoginModal();
    });
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.loginModalOpen) {
      this.hoverPad = null;
      this.setCanvasCursor('default');
      return;
    }

    const hit = this.performRaycast(event);
    const elapsed = this.elapsedNow();
    const hoveredPad = hit.pad && this.isPadActive(hit.pad, elapsed) ? hit.pad : null;

    if (hoveredPad !== this.hoverPad) {
      this.hoverPad = hoveredPad;
      this.setCanvasCursor(hoveredPad ? 'pointer' : 'default');
    }
  };

  private readonly onPointerLeave = (): void => {
    this.hoverPad = null;
    this.setCanvasCursor('default');
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.loginModalOpen) {
      return;
    }

    event.preventDefault();
    const elapsed = this.elapsedNow();
    const hit = this.performRaycast(event);

    if (hit.point) {
      const strength = hit.pad ? 1 : 0.78;
      this.addClickRipple(hit.point, elapsed, strength);
      this.addBackgroundClickRipple(hit.point, elapsed, strength);
    }

    if (!hit.pad || !hit.point || !this.isPadActive(hit.pad, elapsed)) {
      return;
    }

    this.applyImpulseFromImpact(hit.pad, hit.point, elapsed);

    if (hit.pad.isOriginal) {
      this.ngZone.run(() => {
        this.loginModalOpen = !this.loginModalOpen;
        this.loginError = '';
        this.loginSubmitting = false;
        this.cdr.markForCheck();
      });
      this.hoverPad = null;
      this.setCanvasCursor('default');
      return;
    }

    this.beginThrow(hit.pad, elapsed);
  };

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private cuentaAtrasService: CuentaAtrasService,
    private ngZone: NgZone,
    private performanceService: NenufarPerformanceService,
    private router: Router
  ) {
    this.performanceProfile = this.performanceService.getProfile();
    this.activePadCount = this.performanceProfile.loginPond.padCount;
    this.maxPondClickSources = this.performanceProfile.background.maxClickSources;
  }

  ngOnInit(): void {
    this.lastScore = Number(localStorage.getItem('estanque_last_score') || 0);
    this.bestScore = Number(localStorage.getItem('estanque_best_score') || 0);
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      if (this.destroyed) {
        return;
      }

      this.ngZone.run(() => {
        this.hudReady = true;
        this.cdr.detectChanges();
      });
    });

    this.ngZone.runOutsideAngular(() => {
      void this.initializeScene();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.resizeSyncFrameId !== null) {
      cancelAnimationFrame(this.resizeSyncFrameId);
      this.resizeSyncFrameId = null;
    }

    window.removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('keydown', this.onDocumentKeydown);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;

    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerleave', this.onPointerLeave);
      canvas.removeEventListener('pointerdown', this.onPointerDown);
    }

    for (const pad of this.lilyPads) {
      this.scene?.remove(pad.mesh);
      this.disposeMaterial(pad.mesh.material);

      if (pad.glowMesh) {
        this.scene?.remove(pad.glowMesh);
        this.disposeMaterial(pad.glowMesh.material);
      }

      if (pad.haloMesh) {
        this.scene?.remove(pad.haloMesh);
        this.disposeMaterial(pad.haloMesh.material);
      }

      if (pad.shadowMesh) {
        this.scene?.remove(pad.shadowMesh);
        this.disposeMaterial(pad.shadowMesh.material);
      }
    }

    if (this.waterMesh) {
      this.scene?.remove(this.waterMesh);
    }

    this.padGeometry?.dispose();
    this.waterGeometry?.dispose();
    this.waterMaterial?.dispose();
    this.mustioTexture?.dispose();
    this.originalTexture?.dispose();
    this.padShadowTexture?.dispose();
    this.focusHaloTexture?.dispose();
    this.glowTexture?.dispose();
    this.renderer?.dispose();

    this.lilyPads = [];
    this.lilyEngine?.clear();
    this.lilyEngine = undefined;
    this.padById.clear();
    this.popups = [];
    this.ripples = [];
    this.bgCtx = null;
    this.pondBaseSources = [];
    this.pondClickSources = [];
    this.pondField = new Float32Array(0);
    this.ambientDrifters = [];
    this.focalPad = null;
  }

  closeLoginModal(): void {
    this.loginModalOpen = false;
    this.loginSubmitting = false;
    this.loginError = '';
    this.loginRememberMe = false;
    this.cdr.detectChanges();
  }

  onRegisterClick(): void {
    this.habilitarAcceso();
    this.loginModalOpen = false;
    this.cdr.markForCheck();
    void this.router.navigate(['/registro-opciones']);
  }

  continueAsGuest(): void {
    this.habilitarAcceso({ guest: true });
    this.loginModalOpen = false;
    this.loginSubmitting = false;
    this.loginError = '';
    this.loginRememberMe = false;
    this.cdr.markForCheck();
    void this.router.navigate(['/inicio']);
  }

  showHudTemporarily(): void {
    this.noteHudActivity(this.elapsedNow(), this.hudInfoDuration, true);
  }

  submitLogin(): void {
    if (this.loginSubmitting) {
      return;
    }

    const email = this.loginEmail.trim();
    const password = this.loginPassword.trim();

    if (!email || !password) {
      this.loginError = 'Escribe tu email y tu contraseña.';
      this.cdr.markForCheck();
      return;
    }

    this.loginSubmitting = true;
    this.loginError = '';
    this.cdr.markForCheck();

    this.authService.login(email, password, this.loginRememberMe).subscribe({
      next: () => {
        this.habilitarAcceso();
        this.loginSubmitting = false;
        this.loginModalOpen = false;
        this.loginRememberMe = false;
        this.cdr.markForCheck();

        void this.router.navigate(['/inicio']);
      },
      error: (error: unknown) => {
        this.loginSubmitting = false;
        this.loginError =
          isAppErrorModel(error) && error.kind === 'auth'
            ? 'Correo o contraseña incorrectos.'
            : getUserErrorMessage(error, 'No hemos podido iniciar sesión. Revisa los datos.');
        this.cdr.markForCheck();
      }
    });
  }

  private habilitarAcceso(options?: { guest?: boolean }): void {
    localStorage.setItem('accesoPermitido', 'true');

    if (options?.guest) {
      localStorage.setItem('guestMode', 'true');
      localStorage.removeItem('usuarioLogueado');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
    } else {
      localStorage.removeItem('guestMode');
    }

    this.cuentaAtrasService.desbloquearAcceso();
  }

  private async initializeScene(): Promise<void> {
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport || this.destroyed) {
      return;
    }

    this.lilyEngine = new NenufarEngine<LilyPadBody>({
      bounds: this.bounds,
      collision: {
        impulseScale: 1.92,
        restitution: this.collisionRestitution,
        separationFactor: 0.58,
        spinFromImpact: 0.06,
        spinFromTangential: 0.085,
        tangentTransfer: 0.07
      },
      defaultBoundsMode: 'wrap',
      defaultMaxSpeed: this.maxSpeed,
      defaultMaxSpin: this.maxSpin,
      wrapBoost: this.wrapBoost
    });

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
    this.renderer.domElement.style.touchAction = 'none';
    viewport.appendChild(this.renderer.domElement);

    this.initBackgroundPond();
    this.bindResizeObserver(viewport);

    window.addEventListener('resize', this.onWindowResize, { passive: true });
    document.addEventListener('keydown', this.onDocumentKeydown);

    this.padGeometry = new THREE.PlaneGeometry(1, 1);
    this.createWater();
    await this.createPads();

    if (this.destroyed) {
      return;
    }

    this.resizeRenderer();
    this.resizeBackgroundPond();
    this.scheduleViewportSync();

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.onPointerMove, { passive: true });
    canvas.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    canvas.addEventListener('pointerdown', this.onPointerDown);

    const now = performance.now() * 0.001;
    this.clockStart = now;
    this.lastFrameAt = now;
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  }

  private createWater(): void {
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

  private async createPads(): Promise<void> {
    this.padShadowTexture = this.createPadShadowTexture();
    this.focusHaloTexture = this.createFocusHaloTexture();
    this.glowTexture = this.createGlowTexture();
    this.mustioTexture = await this.loadPadTexture(
      this.performanceProfile.preferSmallLocalAssets
        ? 'assets/imagenes/nenufar_mustio_small.png'
        : 'assets/imagenes/nenufar_mustio.png',
      {
        backgroundMode: 'preserve-source-alpha',
        fallbackColors: {
          dark: '#546646',
          light: '#8c9d72',
          vein: '#d5e0ba'
        }
      }
    );
    this.originalTexture = await this.loadPadTexture(
      this.performanceProfile.preferSmallLocalAssets
        ? 'assets/imagenes/nenufar_small.png'
        : 'assets/imagenes/nenufar.png',
      {
        backgroundMode: 'remove-white-background',
        fallbackColors: {
          dark: '#4d7d4f',
          light: '#b7d48f',
          vein: '#eef7d3'
        }
      }
    );

    const totalPads = this.activePadCount;
    const coreCount = Math.min(
      totalPads - 2,
      this.performanceProfile.loginPond.corePadCount,
    );
    const outerCount = totalPads - coreCount - 1;
    const minDist = this.basePadMinDist();
    const placed: PlacedSeed[] = [];

    const originalRadius = 0.66;
    const originalPosition = this.findOriginalPosition(placed, minDist, originalRadius);
    const originalPad = this.buildPad(
      originalPosition,
      originalRadius,
      true,
      THREE.MathUtils.randFloat(0.04, 0.16)
    );
    this.focalPad = originalPad;
    this.lilyPads.push(originalPad);
    this.padById.set(originalPad.id, originalPad);
    placed.push({ isFocal: true, pos: originalPosition.clone(), radius: originalRadius });

    const coreSeeds = [
      new THREE.Vector2(-1.0, -0.08),
      new THREE.Vector2(1.05, 0.16),
      new THREE.Vector2(-0.14, 1.0),
      new THREE.Vector2(0.18, -1.02),
      new THREE.Vector2(-0.78, 0.78),
      new THREE.Vector2(0.84, -0.72)
    ];
    const clusterRotation = THREE.MathUtils.randFloatSpread(0.72);

    for (let index = 0; index < coreCount; index += 1) {
      const radius = this.sampleMustioRadius(index, true);
      const seed = coreSeeds[index % coreSeeds.length]
        .clone()
        .multiplyScalar(1.16)
        .rotateAround(new THREE.Vector2(0, 0), clusterRotation)
        .multiplyScalar(Math.max(radius * 3.0, 1.3))
        .add(new THREE.Vector2(
          THREE.MathUtils.randFloatSpread(0.28),
          THREE.MathUtils.randFloatSpread(0.28)
        ));

      const pos = this.acceptPosition(seed, radius, placed, minDist)
        ? seed
        : this.sampleOrganicPosition(placed, minDist, radius, 1.7, 3.35, 0.6);
      const pad = this.buildPad(
        pos,
        radius,
        false,
        THREE.MathUtils.randFloat(0.0, 0.74)
      );
      this.lilyPads.push(pad);
      this.padById.set(pad.id, pad);
      placed.push({ pos: pos.clone(), radius });
    }

    for (let index = 0; index < outerCount; index += 1) {
      const radius = this.sampleMustioRadius(index, false);
      const pos = this.sampleOrganicPosition(placed, minDist, radius, 3.1, 5.8, 0.94);
      const pad = this.buildPad(
        pos,
        radius,
        false,
        THREE.MathUtils.randFloat(0.22, 1.2)
      );
      this.lilyPads.push(pad);
      this.padById.set(pad.id, pad);
      placed.push({ pos: pos.clone(), radius });
    }

    this.recenterInitialPadCluster();
    this.syncWakeUniforms(0);
  }

  private buildPad(
    position: THREE.Vector2,
    radius: number,
    isOriginal: boolean,
    spawnDelayUntil: number
  ): LilyPadBody {
    const material = new THREE.MeshBasicMaterial({
      alphaTest: 0.06,
      color: new THREE.Color(isOriginal ? '#ffffff' : '#eef6eb'),
      depthWrite: false,
      map: isOriginal ? this.originalTexture! : this.mustioTexture!,
      transparent: true
    });
    const shadowMesh = new THREE.Mesh(
      this.padGeometry!,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(isOriginal ? '#4b6f75' : '#54706b'),
        depthWrite: false,
        map: this.padShadowTexture,
        opacity: isOriginal ? 0.3 : 0.22,
        transparent: true
      })
    );
    shadowMesh.position.set(position.x + 0.04, position.y - 0.08, 0.08);
    shadowMesh.renderOrder = 0;
    shadowMesh.scale.set(0.001, 0.001, 1);
    this.scene.add(shadowMesh);

    const mesh = new THREE.Mesh(this.padGeometry!, material);
    mesh.position.set(position.x, position.y, 0.45);
    mesh.renderOrder = 3;
    mesh.scale.set(0.001, 0.001, 1);
    this.scene.add(mesh);

    let glowMesh: LilyPadBody['glowMesh'];
    let haloMesh: LilyPadBody['haloMesh'];
    if (isOriginal) {
      haloMesh = new THREE.Mesh(
        this.padGeometry!,
        new THREE.MeshBasicMaterial({
          blending: THREE.AdditiveBlending,
          color: new THREE.Color('#fff8ce'),
          depthWrite: false,
          map: this.focusHaloTexture,
          opacity: 0.3,
          transparent: true
        })
      );
      haloMesh.position.set(position.x, position.y, 0.18);
      haloMesh.renderOrder = 1;
      haloMesh.scale.set(0.001, 0.001, 1);
      this.scene.add(haloMesh);

      glowMesh = new THREE.Mesh(
        this.padGeometry!,
        new THREE.MeshBasicMaterial({
          blending: THREE.AdditiveBlending,
          color: new THREE.Color('#fff4b1'),
          depthWrite: false,
          map: this.glowTexture,
          opacity: 0.34,
          transparent: true
        })
      );
      glowMesh.position.set(position.x, position.y, 0.28);
      glowMesh.renderOrder = 2;
      glowMesh.scale.set(0.001, 0.001, 1);
      this.scene.add(glowMesh);
    }

    const direction = new THREE.Vector2(
      THREE.MathUtils.randFloatSpread(1),
      THREE.MathUtils.randFloatSpread(1)
    ).normalize();
    const speed = THREE.MathUtils.randFloat(0.05, 0.11);

    const pad: LilyPadBody = {
      activationUntil: -10,
      activeThrowId: -1,
      angVel: THREE.MathUtils.randFloat(-0.008, 0.008),
      angularDamping: isOriginal ? 0.993 : 0.9922,
      appearT: 0,
      baseScale: radius * (isOriginal ? 2.7 : 2.45),
      boundsMode: 'wrap',
      collisionEnabled: true,
      driftDir: direction.clone(),
      driftStrength: THREE.MathUtils.randFloat(0.06, 0.12),
      flowInfluence: THREE.MathUtils.randFloat(0.9, 1.45),
      glowMesh,
      haloMesh,
      id: this.lilyPads.length,
      isMustio: !isOriginal,
      isOriginal,
      lastTouchedAt: -10,
      linearDamping: isOriginal ? 0.9914 : 0.9908,
      maxSpeed: this.maxSpeed,
      maxSpin: this.maxSpin,
      mesh,
      microPhase: Math.random() * Math.PI * 2,
      microSpeed: THREE.MathUtils.randFloat(0.22, 0.52),
      pos: position.clone(),
      prevPos: position.clone(),
      radius,
      rotation: THREE.MathUtils.randFloatSpread(Math.PI * 2),
      shadowMesh,
      shimmerOffset: Math.random() * Math.PI * 2,
      spawnDelayUntil,
      swayAmplitude: THREE.MathUtils.randFloat(0.16, 0.46),
      vel: direction.multiplyScalar(speed),
      wakeBoost: 0,
      wakeStrength: 0,
      wrappedThisFrame: false
    };

    this.lilyEngine?.addEntity(pad);
    mesh.userData['padId'] = pad.id;
    return pad;
  }

  private renderLoop = (timestampMs: number): void => {
    if (this.destroyed || !this.renderer || !this.waterMaterial) {
      return;
    }

    const now = timestampMs * 0.001;
    if (
      this.lastFrameAt &&
      timestampMs - this.lastFrameAt * 1000 < this.performanceProfile.loginPond.frameIntervalMs
    ) {
      this.animationFrameId = requestAnimationFrame(this.renderLoop);
      return;
    }

    const elapsed = now - this.clockStart;
    const dt = Math.min(Math.max(now - this.lastFrameAt, 1 / 144), 1 / 24);
    this.lastFrameAt = now;

    this.waterMaterial.uniforms['uTime'].value = elapsed;

    this.updatePads(dt, elapsed);
    this.syncWakeUniforms(elapsed);
    this.syncFocalUniforms(elapsed);
    this.cleanupRipples(elapsed);
    this.cleanupPopups(elapsed);
    this.updateThrowLifecycle(elapsed);
    this.updateHudVisibility(elapsed);

    this.renderBackgroundPond(elapsed);
    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  private updatePads(dt: number, elapsed: number): void {
    const frameScale = dt * 60;

    for (const pad of this.lilyPads) {
      const appearT = THREE.MathUtils.clamp((elapsed - pad.spawnDelayUntil) / 0.48, 0, 1);
      pad.appearT = appearT;
      pad.wrappedThisFrame = false;

      pad.mesh.visible = appearT > 0;
      if (pad.glowMesh) {
        pad.glowMesh.visible = appearT > 0;
      }
      if (pad.haloMesh) {
        pad.haloMesh.visible = appearT > 0;
      }
      if (pad.shadowMesh) {
        pad.shadowMesh.visible = appearT > 0;
      }

      if (appearT >= 1) {
        pad.prevPos.copy(pad.pos);

        const personalAngle = Math.sin(elapsed * pad.microSpeed + pad.microPhase) * pad.swayAmplitude;
        const personalCurrent = pad.driftDir.clone()
          .rotateAround(new THREE.Vector2(0, 0), personalAngle)
          .multiplyScalar(pad.driftStrength);
        const flow = this.sampleFlowField(pad.pos, pad.id, elapsed).multiplyScalar(pad.flowInfluence);
        const drift = this.sampleCalmDrift(pad.id, elapsed).multiplyScalar(0.85 + pad.flowInfluence * 0.18);
        const steering = personalCurrent.clone().add(flow).add(drift);

        pad.vel.addScaledVector(steering, dt * 1.18);

        const cruiseFloor = pad.driftStrength * 0.88;
        if (pad.vel.length() < cruiseFloor) {
          pad.vel.addScaledVector(personalCurrent, dt * 2.6);
        }

        pad.angVel += Math.sin(elapsed * 0.24 + pad.shimmerOffset) * 0.00016 * frameScale;
      } else {
        pad.wakeStrength = 0;
        pad.wakeBoost = 0;
      }
    }

    this.lilyEngine?.step(dt, {
      elapsed,
      isActive: (pad) => pad.appearT >= 1,
      onCollision: ({ a, b, closingSpeed, normal }) => {
        this.handleEngineCollision(a, b, normal, closingSpeed, elapsed);
      },
      onOutOfBounds: ({ entity, mode }) => {
        if (mode !== 'wrap') {
          return;
        }

        entity.wrappedThisFrame = true;
        entity.prevPos?.copy(entity.pos);
      }
    });

    for (const pad of this.lilyPads) {
      const appearT = pad.appearT;
      const eased = appearT * appearT * (3 - 2 * appearT);

      if (appearT >= 1) {
        const displacement = pad.wrappedThisFrame
          ? pad.vel.length()
          : pad.pos.distanceTo(pad.prevPos) / Math.max(dt, 1e-4);
        const motionWake = THREE.MathUtils.clamp(
          THREE.MathUtils.mapLinear(displacement, 0.03, 0.5, 0.06, 1),
          0.02,
          1
        );

        pad.wakeStrength = Math.max(pad.wakeBoost, motionWake);
        pad.wakeBoost = 0;
        pad.rotation += pad.angVel * dt * 2.45;
      }

      const floatPulse = 1 + Math.sin(elapsed * 0.52 + pad.shimmerOffset) * 0.02;
      const scale = Math.max(0.001, pad.baseScale * eased * floatPulse);

      pad.mesh.position.set(pad.pos.x, pad.pos.y, 0.45);
      pad.mesh.rotation.z = pad.rotation;
      pad.mesh.scale.set(scale, scale, 1);

      if (pad.shadowMesh) {
        const shadowPulse = 1 + Math.sin(elapsed * 0.44 + pad.microPhase) * 0.035;
        pad.shadowMesh.position.set(
          pad.pos.x + 0.05 + pad.vel.x * 0.085,
          pad.pos.y - 0.11 + pad.vel.y * 0.035,
          0.08
        );
        pad.shadowMesh.rotation.z = pad.rotation * 0.72;
        pad.shadowMesh.scale.set(
          scale * 3.08 * shadowPulse,
          scale * 2.26 * shadowPulse,
          1
        );
        pad.shadowMesh.material.opacity = (pad.isOriginal ? 0.24 : 0.18) + pad.wakeStrength * 0.08;
      }

      if (pad.glowMesh) {
        const glowPulse = 1 + Math.sin(elapsed * 0.84 + pad.shimmerOffset) * 0.07;
        pad.glowMesh.position.set(pad.pos.x, pad.pos.y, 0.28);
        pad.glowMesh.scale.set(scale * 1.85 * glowPulse, scale * 1.85 * glowPulse, 1);
        pad.glowMesh.rotation.z = pad.rotation * 0.94;
        pad.glowMesh.material.opacity = 0.24 + pad.wakeStrength * 0.12 + (pad.isOriginal ? glowPulse * 0.06 : 0);
      }

      if (pad.haloMesh) {
        const haloPulse = 1 + Math.sin(elapsed * 0.32 + pad.microPhase) * 0.09;
        const haloDrift = 1 + Math.cos(elapsed * 0.21 + pad.shimmerOffset) * 0.055;
        pad.haloMesh.position.set(pad.pos.x, pad.pos.y, 0.16);
        pad.haloMesh.scale.set(
          scale * 3.55 * haloPulse,
          scale * 3.05 * haloDrift,
          1
        );
        pad.haloMesh.rotation.z = pad.rotation * 0.58 + Math.sin(elapsed * 0.08 + pad.microPhase) * 0.045;
        pad.haloMesh.material.opacity = 0.14 + pad.wakeStrength * 0.07 + haloPulse * 0.04;
      }
    }
  }

  private handleEngineCollision(
    a: LilyPadBody,
    b: LilyPadBody,
    normal: { x: number; y: number },
    closingSpeed: number,
    elapsed: number
  ): void {
    const normalVector = new THREE.Vector2(normal.x, normal.y);
    const wakeBoost = THREE.MathUtils.clamp(closingSpeed * 2.2, 0.2, 1);

    a.wakeBoost = Math.max(a.wakeBoost, wakeBoost);
    b.wakeBoost = Math.max(b.wakeBoost, wakeBoost);

    this.applyTouchTransfer(a, b, normalVector, elapsed);
    this.handleCollisionScore(a, b, normalVector, closingSpeed, elapsed);
  }

  private applyTouchTransfer(
    a: LilyPadBody,
    b: LilyPadBody,
    normal: THREE.Vector2,
    elapsed: number
  ): void {
    const aRecentlyTouched = elapsed - a.lastTouchedAt < this.touchTransferWindow;
    const bRecentlyTouched = elapsed - b.lastTouchedAt < this.touchTransferWindow;

    if (aRecentlyTouched && !bRecentlyTouched) {
      b.vel.addScaledVector(normal, THREE.MathUtils.clamp(a.vel.length() * 3.6, 0, this.maxKick));
      b.wakeBoost = Math.max(b.wakeBoost, 0.6);
      this.clampVectorLength(b.vel, this.maxSpeed);
      return;
    }

    if (bRecentlyTouched && !aRecentlyTouched) {
      a.vel.addScaledVector(normal, -THREE.MathUtils.clamp(b.vel.length() * 3.6, 0, this.maxKick));
      a.wakeBoost = Math.max(a.wakeBoost, 0.6);
      this.clampVectorLength(a.vel, this.maxSpeed);
    }
  }

  private handleCollisionScore(
    a: LilyPadBody,
    b: LilyPadBody,
    normal: THREE.Vector2,
    closingSpeed: number,
    elapsed: number
  ): void {
    if (!this.throwState.active || closingSpeed < 0.04) {
      return;
    }

    const aActive = this.isPadThrowActive(a, elapsed);
    const bActive = this.isPadThrowActive(b, elapsed);
    if (!aActive && !bActive) {
      return;
    }

    const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
    const lastPairScoreAt = this.pairScoreAt.get(pairKey) ?? -10;
    if (elapsed - lastPairScoreAt < this.scoringPairCooldown) {
      return;
    }

    let attacker = a;
    let target = b;
    let direction = normal.clone();

    if (!aActive && bActive) {
      attacker = b;
      target = a;
      direction.multiplyScalar(-1);
    } else if (aActive && bActive && b.vel.lengthSq() > a.vel.lengthSq()) {
      attacker = b;
      target = a;
      direction.multiplyScalar(-1);
    }

    target.vel.addScaledVector(direction, THREE.MathUtils.clamp(attacker.vel.length() * 3.7, 0, this.maxKick));
    target.wakeBoost = Math.max(target.wakeBoost, 0.74);
    this.clampVectorLength(target.vel, this.maxSpeed);

    attacker.activeThrowId = this.throwState.id;
    attacker.activationUntil = elapsed + this.activeThrowWindow;
    target.activeThrowId = this.throwState.id;
    target.activationUntil = elapsed + this.activeThrowWindow;

    this.throwState.comboStep += 1;
    this.throwState.lastEventAt = elapsed;

    const multiplier = this.throwState.comboStep + 1;
    const mapped = THREE.MathUtils.mapLinear(attacker.vel.length(), this.minScoreSpeed, this.maxSpeed, 10, 150);
    const base = THREE.MathUtils.clamp(Math.round(mapped), 10, 150);
    const points = Math.round(base * multiplier);

    this.throwState.scoreTotal += points;
    this.pairScoreAt.set(pairKey, elapsed);
    this.activeCombo = multiplier;

    this.noteHudActivity(elapsed, this.hudShowDuration);
    this.spawnPopup(target.pos, points, multiplier, elapsed);
    this.pushHudUpdate();
  }

  private updateThrowLifecycle(elapsed: number): void {
    if (!this.throwState.active) {
      return;
    }

    if (elapsed - this.throwState.lastEventAt <= this.idleTimeout) {
      return;
    }

    const finalScore = this.throwState.scoreTotal;
    this.throwState.active = false;
    this.throwState.comboStep = 0;
    this.throwState.scoreTotal = 0;
    this.activeCombo = 0;
    this.clearPadActivation();

    this.lastScore = finalScore;
    this.bestScore = Math.max(this.bestScore, finalScore);
    localStorage.setItem('estanque_last_score', String(this.lastScore));
    localStorage.setItem('estanque_best_score', String(this.bestScore));

    this.pushHudUpdate();
  }

  private beginThrow(pad: LilyPadBody, elapsed: number): void {
    this.throwState.active = true;
    this.throwState.id += 1;
    this.throwState.comboStep = 0;
    this.throwState.scoreTotal = 0;
    this.throwState.lastEventAt = elapsed;
    this.activeCombo = 0;
    this.pairScoreAt.clear();
    this.clearPadActivation();

    pad.activeThrowId = this.throwState.id;
    pad.activationUntil = elapsed + this.activeThrowWindow;
    this.pushHudUpdate();
  }

  private clearPadActivation(): void {
    for (const pad of this.lilyPads) {
      pad.activeThrowId = -1;
      pad.activationUntil = -10;
    }
  }

  private applyImpulseFromImpact(pad: LilyPadBody, point: THREE.Vector3, elapsed: number): void {
    const result = this.lilyEngine?.applyImpulse(
      pad.id,
      { x: point.x, y: point.y },
      {
        maxForce: this.maxForce,
        minForce: this.minForce,
        spinJitterFactor: 0.054,
        spinJitterMin: 0.024,
        timestamp: elapsed
      }
    );

    if (!result) {
      return;
    }

    pad.wakeBoost = Math.max(
      pad.wakeBoost,
      THREE.MathUtils.clamp(0.46 + result.distanceRatio * 0.88, 0.22, 1)
    );
  }

  private performRaycast(event: PointerEvent): { pad: LilyPadBody | null; point: THREE.Vector3 | null } {
    if (!this.renderer) {
      return { pad: null, point: null };
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const visibleMeshes = this.lilyPads.filter((pad) => pad.mesh.visible).map((pad) => pad.mesh);
    const intersections = this.raycaster.intersectObjects(visibleMeshes, false);
    const waterPoint = this.raycaster.ray.intersectPlane(this.interactionPlane, this.tempPoint);

    for (const hit of intersections) {
      const padId = hit.object.userData['padId'] as number | undefined;
      if (padId === undefined) {
        continue;
      }

      const pad = this.padById.get(padId);
      if (!pad) {
        continue;
      }

      const dx = hit.point.x - pad.pos.x;
      const dy = hit.point.y - pad.pos.y;
      if (dx * dx + dy * dy > pad.radius * pad.radius * 1.08) {
        continue;
      }

      return {
        pad,
        point: hit.point.clone()
      };
    }

    return {
      pad: null,
      point: waterPoint ? waterPoint.clone() : null
    };
  }

  private addClickRipple(point: THREE.Vector3, elapsed: number, strength: number): void {
    this.ripples.unshift({
      startAt: elapsed,
      strength,
      uv: this.worldToUv(point.x, point.y)
    });
    this.ripples = this.ripples.slice(0, this.maxClickRipples);
    this.syncClickRippleUniforms();
  }

  private cleanupRipples(elapsed: number): void {
    const before = this.ripples.length;
    this.ripples = this.ripples.filter((ripple) => elapsed - ripple.startAt < this.clickRippleDuration);
    if (before !== this.ripples.length) {
      this.syncClickRippleUniforms();
    }
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

  private syncWakeUniforms(elapsed: number): void {
    const wakeUniform = this.waterMaterial?.uniforms['uWakeRipples']?.value as THREE.Vector4[] | undefined;
    const directionUniform = this.waterMaterial?.uniforms['uWakeDirs']?.value as THREE.Vector4[] | undefined;
    if (!wakeUniform || !directionUniform) {
      return;
    }

    const worldSpanY = this.bounds.top - this.bounds.bottom;

    for (let index = 0; index < this.maxPads; index += 1) {
      const pad = this.lilyPads[index];
      if (!pad || !this.isPadActive(pad, elapsed)) {
        wakeUniform[index].copy(this.zeroVector);
        directionUniform[index].copy(this.zeroVector);
        continue;
      }

      const strength = THREE.MathUtils.clamp(
        THREE.MathUtils.mapLinear(pad.wakeStrength, 0.05, 1, 0, 1),
        0,
        1
      );

      if (strength <= 0.001) {
        wakeUniform[index].copy(this.zeroVector);
        directionUniform[index].copy(this.zeroVector);
        continue;
      }

      const uv = this.worldToUv(pad.pos.x, pad.pos.y);
      const direction = pad.vel.lengthSq() > 1e-6
        ? pad.vel.clone().normalize()
        : pad.driftDir.clone();
      const uvRadius = (pad.radius * (pad.isOriginal ? 1.42 : 1.2)) / worldSpanY;

      wakeUniform[index].set(uv.x, uv.y, uvRadius, strength * (pad.isOriginal ? 1.08 : 1));
      directionUniform[index].set(direction.x, direction.y, pad.shimmerOffset, 1);
    }
  }

  private syncFocalUniforms(elapsed: number): void {
    const focusUniform = this.waterMaterial?.uniforms['uFocusHalo']?.value as THREE.Vector4 | undefined;
    if (!focusUniform || !this.focalPad || !this.isPadActive(this.focalPad, elapsed)) {
      focusUniform?.set(0, 0, 0, 0);
      return;
    }

    const worldSpanY = this.bounds.top - this.bounds.bottom;
    const uv = this.worldToUv(this.focalPad.pos.x, this.focalPad.pos.y);
    const radius = (this.focalPad.radius * 1.68) / Math.max(worldSpanY, 1e-6);
    focusUniform.set(uv.x, uv.y, radius, this.focalPad.shimmerOffset);
  }

  private spawnPopup(position: THREE.Vector2, points: number, combo: number, elapsed: number): void {
    const projected = this.projectWorldToScreen(position);
    if (!projected) {
      return;
    }

    const palette = this.getPopupPalette(points, combo);
    const duration = THREE.MathUtils.randFloat(0.56, 0.82);

    this.popups.push({
      combo,
      comboColor: palette.comboColor,
      comboScale: 0.94 + palette.emphasis * 0.32,
      createdAt: elapsed,
      driftX: THREE.MathUtils.randFloatSpread(18),
      driftY: THREE.MathUtils.randFloat(44, 74),
      duration,
      durationMs: Math.round(duration * 1000),
      endScale: 0.92 + palette.emphasis * 0.12,
      glowColor: palette.glowColor,
      id: ++this.popupId,
      pointColor: palette.pointColor,
      pointSize: 1.02 + palette.emphasis * 0.34,
      points,
      startScale: 0.68 + palette.emphasis * 0.14,
      world: position.clone(),
      x: projected.x,
      y: projected.y
    });

    this.popups = this.popups.slice(-this.maxPopupCount);
    this.publishPopupViews();
  }

  private cleanupPopups(elapsed: number): void {
    const before = this.popups.length;
    this.popups = this.popups.filter((popup) => elapsed - popup.createdAt < popup.duration);
    if (before !== this.popups.length) {
      this.publishPopupViews();
    }
  }

  private publishPopupViews(): void {
    const nextViews = this.popups.map((popup) => ({
      comboColor: popup.comboColor,
      comboScale: popup.comboScale,
      comboText: `x${popup.combo}`,
      driftX: popup.driftX,
      driftY: popup.driftY,
      durationMs: popup.durationMs,
      endScale: popup.endScale,
      glowColor: popup.glowColor,
      id: popup.id,
      pointColor: popup.pointColor,
      pointSize: popup.pointSize,
      pointsText: `+${popup.points}`,
      startScale: popup.startScale,
      x: popup.x,
      y: popup.y
    }));

    this.ngZone.run(() => {
      this.popupViews = nextViews;
      this.cdr.markForCheck();
    });
  }

  private getPopupPalette(points: number, combo: number): {
    comboColor: string;
    emphasis: number;
    glowColor: string;
    pointColor: string;
    theme: PopupTheme;
  } {
    if (points >= 520 || combo >= 5) {
      return {
        comboColor: '#aeb3ff',
        emphasis: 1,
        glowColor: 'rgba(229, 114, 255, 0.66)',
        pointColor: '#ef74ff',
        theme: 'prism'
      };
    }

    if (points >= 320 || combo >= 4) {
      return {
        comboColor: '#ffd4d0',
        emphasis: 0.82,
        glowColor: 'rgba(255, 92, 96, 0.58)',
        pointColor: '#ff5f5a',
        theme: 'flare'
      };
    }

    if (points >= 180 || combo >= 3) {
      return {
        comboColor: '#ffd5a8',
        emphasis: 0.62,
        glowColor: 'rgba(255, 144, 82, 0.52)',
        pointColor: '#ff9850',
        theme: 'ember'
      };
    }

    if (points >= 90) {
      return {
        comboColor: '#fff0ae',
        emphasis: 0.38,
        glowColor: 'rgba(255, 219, 104, 0.48)',
        pointColor: '#ffd86b',
        theme: 'sun'
      };
    }

    return {
      comboColor: '#bffaff',
      emphasis: 0.18,
      glowColor: 'rgba(177, 245, 255, 0.42)',
      pointColor: '#f3fffb',
      theme: 'mist'
    };
  }

  private pushHudUpdate(): void {
    this.ngZone.run(() => {
      this.cdr.markForCheck();
    });
  }

  private noteHudActivity(elapsed: number, duration: number, forceVisible = false): void {
    this.hudActivityUntil = Math.max(this.hudActivityUntil, elapsed + duration);

    if (this.hudVisible && !forceVisible) {
      return;
    }

    if (!this.hudVisible) {
      this.ngZone.run(() => {
        this.hudVisible = true;
        this.cdr.markForCheck();
      });
    }
  }

  private updateHudVisibility(elapsed: number): void {
    const shouldShow = elapsed <= this.hudActivityUntil;
    if (shouldShow === this.hudVisible) {
      return;
    }

    this.ngZone.run(() => {
      this.hudVisible = shouldShow;
      this.cdr.markForCheck();
    });
  }

  private resizeRenderer(): void {
    if (!this.renderer || !this.waterMesh || !this.waterMaterial) {
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
    this.lilyEngine?.setBounds(this.bounds);

    this.waterMesh.position.set(0, 0, -0.2);
    this.waterMesh.scale.set(worldWidth, worldHeight, 1);
    this.waterMaterial.uniforms['uResolution'].value.set(width, height);
    this.reprojectPopups();
  }

  private reprojectPopups(): void {
    if (!this.popups.length) {
      return;
    }

    for (const popup of this.popups) {
      const projected = this.projectWorldToScreen(popup.world);
      if (projected) {
        popup.x = projected.x;
        popup.y = projected.y;
      }
    }

    this.publishPopupViews();
  }

  private wrapPad(pad: LilyPadBody): boolean {
    let wrapped = false;

    if (pad.pos.x < this.bounds.left - pad.radius) {
      pad.pos.x = this.bounds.right + pad.radius * 0.18;
      pad.vel.x += this.wrapBoost;
      wrapped = true;
    } else if (pad.pos.x > this.bounds.right + pad.radius) {
      pad.pos.x = this.bounds.left - pad.radius * 0.18;
      pad.vel.x -= this.wrapBoost;
      wrapped = true;
    }

    if (pad.pos.y < this.bounds.bottom - pad.radius) {
      pad.pos.y = this.bounds.top + pad.radius * 0.18;
      pad.vel.y += this.wrapBoost;
      wrapped = true;
    } else if (pad.pos.y > this.bounds.top + pad.radius) {
      pad.pos.y = this.bounds.bottom - pad.radius * 0.18;
      pad.vel.y -= this.wrapBoost;
      wrapped = true;
    }

    if (wrapped) {
      this.clampVectorLength(pad.vel, this.maxSpeed);
      pad.prevPos.copy(pad.pos);
    }

    return wrapped;
  }

  private sampleFlowField(position: THREE.Vector2, id: number, elapsed: number): THREE.Vector2 {
    return new THREE.Vector2(
      Math.sin(position.y * 0.41 + elapsed * 0.19 + id * 0.16) * 0.022 +
        Math.cos(position.x * 0.23 - elapsed * 0.12 + id * 0.08) * 0.013,
      Math.cos(position.x * 0.35 - elapsed * 0.16 + id * 0.11) * 0.019 -
        Math.sin(position.y * 0.28 + elapsed * 0.1 + id * 0.05) * 0.011
    );
  }

  private sampleCalmDrift(id: number, elapsed: number): THREE.Vector2 {
    return new THREE.Vector2(
      Math.sin(elapsed * 0.44 + id * 1.37),
      Math.cos(elapsed * 0.38 + id * 1.08)
    ).multiplyScalar(0.014);
  }

  private worldToUv(x: number, y: number): THREE.Vector2 {
    return new THREE.Vector2(
      THREE.MathUtils.clamp((x - this.bounds.left) / (this.bounds.right - this.bounds.left), 0, 1),
      THREE.MathUtils.clamp((y - this.bounds.bottom) / (this.bounds.top - this.bounds.bottom), 0, 1)
    );
  }

  private elapsedNow(): number {
    return performance.now() * 0.001 - this.clockStart;
  }

  private isPadActive(pad: LilyPadBody, elapsed: number): boolean {
    return elapsed >= pad.spawnDelayUntil + 0.08;
  }

  private isPadThrowActive(pad: LilyPadBody, elapsed: number): boolean {
    return this.throwState.active &&
      pad.activeThrowId === this.throwState.id &&
      elapsed <= pad.activationUntil;
  }

  private clampVectorLength(vector: THREE.Vector2, maxLength: number): void {
    const length = vector.length();
    if (length > maxLength) {
      vector.multiplyScalar(maxLength / length);
    }
  }

  private basePadMinDist(): number {
    return 0.28 * 2.4;
  }

  private recenterInitialPadCluster(): void {
    if (!this.lilyPads.length) {
      return;
    }

    const bounds = this.measureInitialPadClusterBounds();
    const centroid = this.measureInitialPadClusterCentroid();
    const bboxCenter = bounds.min.clone().add(bounds.max).multiplyScalar(0.5);
    const clusterCenter = bboxCenter.lerp(centroid, 0.38);
    const recenterOffset = clusterCenter.multiplyScalar(-1);

    this.offsetInitialPadCluster(recenterOffset);

    const shiftedBounds = this.measureInitialPadClusterBounds();
    const correction = new THREE.Vector2();

    if (shiftedBounds.min.x < this.initialSpawnBounds.left) {
      correction.x = this.initialSpawnBounds.left - shiftedBounds.min.x;
    }
    if (shiftedBounds.max.x + correction.x > this.initialSpawnBounds.right) {
      correction.x += this.initialSpawnBounds.right - (shiftedBounds.max.x + correction.x);
    }

    if (shiftedBounds.min.y < this.initialSpawnBounds.bottom) {
      correction.y = this.initialSpawnBounds.bottom - shiftedBounds.min.y;
    }
    if (shiftedBounds.max.y + correction.y > this.initialSpawnBounds.top) {
      correction.y += this.initialSpawnBounds.top - (shiftedBounds.max.y + correction.y);
    }

    if (correction.lengthSq() > 1e-6) {
      this.offsetInitialPadCluster(correction);
    }
  }

  private measureInitialPadClusterBounds(): { min: THREE.Vector2; max: THREE.Vector2 } {
    const min = new THREE.Vector2(Infinity, Infinity);
    const max = new THREE.Vector2(-Infinity, -Infinity);

    for (const pad of this.lilyPads) {
      min.x = Math.min(min.x, pad.pos.x - pad.radius);
      min.y = Math.min(min.y, pad.pos.y - pad.radius);
      max.x = Math.max(max.x, pad.pos.x + pad.radius);
      max.y = Math.max(max.y, pad.pos.y + pad.radius);
    }

    return { min, max };
  }

  private measureInitialPadClusterCentroid(): THREE.Vector2 {
    const centroid = new THREE.Vector2();

    for (const pad of this.lilyPads) {
      centroid.add(pad.pos);
    }

    return centroid.multiplyScalar(1 / this.lilyPads.length);
  }

  private offsetInitialPadCluster(offset: THREE.Vector2): void {
    if (offset.lengthSq() <= 1e-6) {
      return;
    }

    for (const pad of this.lilyPads) {
      pad.pos.add(offset);
      pad.prevPos.add(offset);
      pad.mesh.position.set(pad.pos.x, pad.pos.y, 0.45);

      if (pad.shadowMesh) {
        pad.shadowMesh.position.set(pad.pos.x + 0.04, pad.pos.y - 0.08, 0.08);
      }

      if (pad.glowMesh) {
        pad.glowMesh.position.set(pad.pos.x, pad.pos.y, 0.28);
      }

      if (pad.haloMesh) {
        pad.haloMesh.position.set(pad.pos.x, pad.pos.y, 0.18);
      }
    }
  }

  private sampleMustioRadius(index: number, core: boolean): number {
    const roll = Math.random();
    if (roll < 0.2) {
      return THREE.MathUtils.randFloat(core ? 0.56 : 0.52, core ? 0.68 : 0.62);
    }

    if (roll < 0.55) {
      return THREE.MathUtils.randFloat(core ? 0.42 : 0.38, core ? 0.56 : 0.52);
    }

    return THREE.MathUtils.randFloat(core ? 0.3 : 0.28, core ? 0.42 : 0.4) + (index % 2 === 0 ? 0.02 : 0);
  }

  private acceptPosition(position: THREE.Vector2, radius: number, placed: PlacedSeed[], minDist: number): boolean {
    for (const seed of placed) {
      const focalBoost = seed.isFocal ? 0.42 : 0;
      const pairMin = Math.max(
        minDist + focalBoost * 0.22,
        (radius + seed.radius) * 1.22 + focalBoost
      );
      if (seed.pos.distanceTo(position) < pairMin) {
        return false;
      }
    }

    return (
      position.x > this.initialSpawnBounds.left &&
      position.x < this.initialSpawnBounds.right &&
      position.y > this.initialSpawnBounds.bottom &&
      position.y < this.initialSpawnBounds.top
    );
  }

  private sampleOrganicPosition(
    placed: PlacedSeed[],
    minDist: number,
    radius: number,
    minRing: number,
    maxRing: number,
    focalClearanceBoost = 0
  ): THREE.Vector2 {
    const focalSeed = placed.find((seed) => seed.isFocal);

    for (let attempt = 0; attempt < 220; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const ring = THREE.MathUtils.randFloat(minRing, maxRing);
      const ellipse = new THREE.Vector2(
        Math.cos(angle) * ring * 1.08,
        Math.sin(angle) * ring * 0.82
      ).rotateAround(new THREE.Vector2(0, 0), THREE.MathUtils.randFloatSpread(0.7));

      const candidate = ellipse.add(new THREE.Vector2(
        THREE.MathUtils.randFloatSpread(0.54),
        THREE.MathUtils.randFloatSpread(0.54)
      ));

      if (focalSeed) {
        const focalMin = focalSeed.radius + radius + focalClearanceBoost;
        if (candidate.distanceTo(focalSeed.pos) < focalMin) {
          continue;
        }
      }

      if (this.acceptPosition(candidate, radius, placed, minDist)) {
        return candidate;
      }
    }

    return new THREE.Vector2(
      THREE.MathUtils.randFloat(this.initialSpawnBounds.left + 0.45, this.initialSpawnBounds.right - 0.45),
      THREE.MathUtils.randFloat(this.initialSpawnBounds.bottom + 0.3, this.initialSpawnBounds.top - 0.3)
    );
  }

  private findOriginalPosition(placed: PlacedSeed[], minDist: number, radius: number): THREE.Vector2 {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const candidate = new THREE.Vector2(
        THREE.MathUtils.randFloat(-0.46, 0.46),
        THREE.MathUtils.randFloat(-0.36, 0.36)
      );
      if (this.acceptPosition(candidate, radius, placed, minDist)) {
        return candidate;
      }
    }

    return new THREE.Vector2(0, 0);
  }

  private projectWorldToScreen(position: THREE.Vector2): { x: number; y: number } | null {
    if (!this.renderer) {
      return null;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const projected = new THREE.Vector3(position.x, position.y, 0.82).project(this.camera);

    return {
      x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height
    };
  }

  private async loadPadTexture(path: string, options: PadTextureLoadOptions): Promise<THREE.Texture> {
    return new Promise((resolve) => {
      new THREE.ImageLoader().load(
        path,
        (image: HTMLImageElement | ImageBitmap) => {
          resolve(this.preparePadTexture(image, options));
        },
        undefined,
        () => {
          const fallback = this.createLeafTexture(
            options.fallbackColors.light,
            options.fallbackColors.dark,
            options.fallbackColors.vein
          );
          fallback.colorSpace = THREE.SRGBColorSpace;
          fallback.needsUpdate = true;
          resolve(fallback);
        }
      );
    });
  }

  private preparePadTexture(
    source: HTMLImageElement | ImageBitmap,
    options: PadTextureLoadOptions
  ): THREE.Texture {
    const { backgroundMode, fallbackColors } = options;
    const width = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', {
      willReadFrequently: backgroundMode === 'remove-white-background'
    });

    if (!context) {
      const fallback = this.createLeafTexture(
        fallbackColors.light,
        fallbackColors.dark,
        fallbackColors.vein
      );
      fallback.colorSpace = THREE.SRGBColorSpace;
      fallback.needsUpdate = true;
      return fallback;
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);

    if (backgroundMode === 'remove-white-background') {
      const imageData = context.getImageData(0, 0, width, height);
      this.removeWhiteBackgroundFromEdges(imageData);
      context.putImageData(imageData, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private removeWhiteBackgroundFromEdges(imageData: ImageData): void {
    const { data, width, height } = imageData;
    const visited = new Uint8Array(width * height);
    const queue = new Uint32Array(width * height);
    let head = 0;
    let tail = 0;

    const enqueue = (x: number, y: number): void => {
      if (x < 0 || x >= width || y < 0 || y >= height) {
        return;
      }

      const index = y * width + x;
      if (visited[index]) {
        return;
      }

      const offset = index * 4;
      if (!this.isEdgeBackgroundPixel(data, offset)) {
        return;
      }

      visited[index] = 1;
      queue[tail] = index;
      tail += 1;
    };

    for (let x = 0; x < width; x += 1) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }

    for (let y = 1; y < height - 1; y += 1) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }

    while (head < tail) {
      const index = queue[head];
      head += 1;

      const x = index % width;
      const y = Math.floor(index / width);

      enqueue(x - 1, y);
      enqueue(x + 1, y);
      enqueue(x, y - 1);
      enqueue(x, y + 1);
      enqueue(x - 1, y - 1);
      enqueue(x + 1, y - 1);
      enqueue(x - 1, y + 1);
      enqueue(x + 1, y + 1);
    }

    for (let index = 0; index < visited.length; index += 1) {
      if (!visited[index]) {
        continue;
      }

      data[index * 4 + 3] = 0;
    }
  }

  private isEdgeBackgroundPixel(data: Uint8ClampedArray, offset: number): boolean {
    const alpha = data[offset + 3];
    if (alpha < 20) {
      return true;
    }

    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const brightness = (r + g + b) / 3;

    return brightness >= 224 && min >= 200 && max - min <= 48;
  }

  private traceLeafShape(
    context: CanvasRenderingContext2D,
    radius: number,
    notchRadius: number
  ): void {
    const cutStart = THREE.MathUtils.degToRad(30);
    const cutEnd = THREE.MathUtils.degToRad(62);
    const cutCenter = (cutStart + cutEnd) * 0.5;

    context.beginPath();
    context.arc(0, 0, radius, cutEnd, cutStart + Math.PI * 2, false);
    context.lineTo(
      Math.cos(cutCenter) * notchRadius,
      Math.sin(cutCenter) * notchRadius
    );
    context.closePath();
  }

  private createLeafMaskTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;

    context.translate(canvas.width / 2, canvas.height / 2);
    this.traceLeafShape(context, 96, 12);
    context.fillStyle = '#ffffff';
    context.fill();

    return new THREE.CanvasTexture(canvas);
  }

  private createLeafTexture(light: string, dark: string, vein: string): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);

    const fill = context.createRadialGradient(-26, -28, 14, 0, 0, 118);
    fill.addColorStop(0, light);
    fill.addColorStop(0.56, dark);
    fill.addColorStop(1, '#28382c');

    this.traceLeafShape(context, 96, 12);
    context.fillStyle = fill;
    context.fill();

    context.strokeStyle = 'rgba(255,255,255,0.18)';
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(-70, 18);
    context.quadraticCurveTo(-8, -6, 54, -66);
    context.stroke();

    context.strokeStyle = vein;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-16, 10);
    context.lineTo(36, 58);
    context.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  private createFocusHaloTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;

    const mainGlow = context.createRadialGradient(128, 128, 16, 128, 128, 128);
    mainGlow.addColorStop(0, 'rgba(255, 249, 226, 0.8)');
    mainGlow.addColorStop(0.22, 'rgba(255, 248, 186, 0.34)');
    mainGlow.addColorStop(0.58, 'rgba(182, 238, 204, 0.18)');
    mainGlow.addColorStop(1, 'rgba(182, 238, 204, 0)');
    context.fillStyle = mainGlow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const sideLift = context.createRadialGradient(104, 114, 10, 104, 114, 108);
    sideLift.addColorStop(0, 'rgba(255, 255, 255, 0.36)');
    sideLift.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = sideLift;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return new THREE.CanvasTexture(canvas);
  }

  private createPadShadowTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;

    const shadow = context.createRadialGradient(128, 128, 18, 128, 128, 128);
    shadow.addColorStop(0, 'rgba(18, 34, 39, 0.72)');
    shadow.addColorStop(0.48, 'rgba(30, 55, 58, 0.36)');
    shadow.addColorStop(1, 'rgba(30, 55, 58, 0)');
    context.fillStyle = shadow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return new THREE.CanvasTexture(canvas);
  }

  private createGlowTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;

    const gradient = context.createRadialGradient(128, 128, 12, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(251, 255, 216, 0.88)');
    gradient.addColorStop(0.34, 'rgba(231, 248, 172, 0.24)');
    gradient.addColorStop(1, 'rgba(231, 248, 172, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return new THREE.CanvasTexture(canvas);
  }

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

  private addBackgroundClickRipple(point: THREE.Vector3, elapsed: number, strength: number): void {
    const p = this.worldToBackground(point.x, point.y);

    for (let k = 0; k < 3; k += 1) {
      this.pondClickSources.push({
        x: p.x,
        y: p.y,
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

    const wakePads = this.lilyPads
      .filter((pad) => this.isPadActive(pad, elapsed) && pad.wakeStrength > 0.025)
      .map((pad) => {
        const screenPos = this.worldToBackground(pad.pos.x, pad.pos.y);
        const direction = pad.vel.lengthSq() > 1e-6
          ? pad.vel.clone().normalize()
          : pad.driftDir.clone().normalize();

        const dirScreen = new THREE.Vector2(direction.x, -direction.y).normalize();
        const radiusPx = Math.max(
          18,
          (pad.radius / Math.max(this.bounds.top - this.bounds.bottom, 1e-6)) *
            this.pondHeight *
            (pad.isOriginal ? 2.2 : 1.85)
        );

        return {
          dir: dirScreen,
          microPhase: pad.microPhase,
          pos: screenPos,
          radiusPx,
          strength: THREE.MathUtils.clamp(
            THREE.MathUtils.mapLinear(pad.wakeStrength, 0.03, 1, 0.08, 1),
            0.04,
            1
          )
        };
      });

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

        for (const wake of wakePads) {
          const dx = x - wake.pos.x;
          const dy = y - wake.pos.y;

          const ahead = dx * wake.dir.x + dy * wake.dir.y;
          const trail = -ahead;
          const perpX = -wake.dir.y;
          const perpY = wake.dir.x;
          const side = dx * perpX + dy * perpY;

          const body = Math.exp(
            -(side * side) / (wake.radiusPx * wake.radiusPx * 0.44) -
            (ahead * ahead) / (wake.radiusPx * wake.radiusPx * 0.74)
          );

          const tail = Math.exp(
            -(side * side) / (wake.radiusPx * wake.radiusPx * 0.32) -
            (Math.max(0, trail - wake.radiusPx * 0.06) * Math.max(0, trail - wake.radiusPx * 0.06)) /
            (wake.radiusPx * wake.radiusPx * 2.4)
          );

          const wakeWave = Math.sin(trail * 0.12 - elapsed * 6.2 - wake.microPhase) * tail;

          amp += body * wake.strength * 0.26;
          amp += wakeWave * wake.strength * 0.64;
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

  private repeat01(value: number): number {
    return ((value % 1) + 1) % 1;
  }

  private worldToBackground(x: number, y: number): THREE.Vector2 {
    const u = THREE.MathUtils.clamp(
      (x - this.bounds.left) / Math.max(this.bounds.right - this.bounds.left, 1e-6),
      0,
      1
    );

    const v = THREE.MathUtils.clamp(
      (y - this.bounds.bottom) / Math.max(this.bounds.top - this.bounds.bottom, 1e-6),
      0,
      1
    );

    return new THREE.Vector2(
      u * this.pondWidth,
      (1 - v) * this.pondHeight
    );
  }

  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) {
      for (const item of material) {
        item.dispose();
      }
      return;
    }

    material.dispose();
  }

  private setCanvasCursor(cursor: string): void {
    if (this.renderer?.domElement) {
      this.renderer.domElement.style.cursor = cursor;
    }
  }

  private bindResizeObserver(viewport: HTMLDivElement): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleViewportSync();
    });
    this.resizeObserver.observe(viewport);
  }

  private scheduleViewportSync(): void {
    if (this.destroyed || this.resizeSyncFrameId !== null) {
      return;
    }

    this.resizeSyncFrameId = requestAnimationFrame(() => {
      this.resizeSyncFrameId = null;
      this.resizeRenderer();
      this.resizeBackgroundPond();
    });
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

    if (!width || !height) {
      return null;
    }

    return { width, height };
  }
}
