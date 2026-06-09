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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthResponse, AuthService } from '../../../servicios/authService/auth.service';
import { savePendingEmailVerification } from '../../../servicios/authService/email-verification.storage';
import { getUserErrorMessage } from '../../../core/errors/error-parser';
import { EstanqueBackgroundComponent } from '../../shared/estanque-background/estanque-background.component';

type PondSource = {
  x: number;
  y: number;
  wl: number;
  phase: number;
  amp: number;
  born: number;
  life: number;
};

class PondBackgroundRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly W = 600;
  private readonly H = 600;
  private readonly res = 4;
  private readonly rows = Math.floor(this.H / this.res);
  private readonly cols = Math.floor(this.W / this.res);
  private readonly field = new Float32Array(this.rows * this.cols);

  private readonly blues = [
    '#0a1628', '#0d2137', '#0e3a5e', '#1a5276', '#1f618d',
    '#2980b9', '#5dade2', '#85c1e9', '#aed6f1'
  ];

  // Fuentes base (siempre activas, sutiles)
  private readonly baseSources: PondSource[] = [];

  // Clicks generan olas temporales
  private readonly clickSources: PondSource[] = [];

  private readonly levels = [-1.4, -0.8, -0.3, 0, 0.3, 0.8, 1.4];

  private time = 0;
  private animationFrameId = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
      throw new Error('El fondo interactivo del registro no se inició.');
    }

    this.ctx = ctx;
    this.canvas.width = this.W;
    this.canvas.height = this.H;

    const ring = 8;
    for (let i = 0; i < ring; i += 1) {
      const angle = (i / ring) * Math.PI * 2;
      this.baseSources.push({
        x: this.W / 2 + Math.cos(angle) * 160,
        y: this.H / 2 + Math.sin(angle) * 160,
        wl: 40 + (i % 4) * 10,
        phase: angle,
        amp: 0.25,
        born: -Infinity,
        life: Infinity
      });
    }

    this.canvas.addEventListener('click', this.handleClick);
  }

  start(): void {
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.canvas.removeEventListener('click', this.handleClick);
  }

  private handleClick = (event: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.W / rect.width;
    const scaleY = this.H / rect.height;
    const cx = (event.clientX - rect.left) * scaleX;
    const cy = (event.clientY - rect.top) * scaleY;

    // Varias sub-fuentes por click para efecto de piedra en agua
    for (let k = 0; k < 3; k += 1) {
      this.clickSources.push({
        x: cx,
        y: cy,
        wl: 20 + k * 14,
        phase: k * 1.1,
        amp: 1.4 - k * 0.3,
        born: this.time,
        life: 6.0 + k * 0.5
      });
    }
  };

  private animate = (): void => {
    this.ctx.fillStyle = '#0a1f3d';
    this.ctx.fillRect(0, 0, this.W, this.H);

    const now = this.time;
    const allSources = this.baseSources.concat(
      this.clickSources.filter((source) => now - source.born < source.life)
    );

    // Limpiar viejas
    while (this.clickSources.length && now - this.clickSources[0].born >= this.clickSources[0].life) {
      this.clickSources.shift();
    }

    for (let i = 0; i < this.rows; i += 1) {
      for (let j = 0; j < this.cols; j += 1) {
        const x = j * this.res;
        const y = i * this.res;
        let amp = 0;

        for (let s = 0; s < allSources.length; s += 1) {
          const source = allSources[s];
          const age = now - source.born;

          if (age < 0) {
            continue;
          }

          // Fuentes base: oscilan levemente
          const sx = source.born === -Infinity
            ? source.x + Math.sin(now * 0.4 + source.phase) * 10
            : source.x;
          const sy = source.born === -Infinity
            ? source.y + Math.cos(now * 0.3 + source.phase) * 10
            : source.y;

          const dx = x - sx;
          const dy = y - sy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let falloff;
          if (source.born === -Infinity) {
            falloff = Math.max(0, 1 - dist / 320);
          } else {
            // Ola de click: se expande y se desvanece
            const wavefront = age * 60;
            const spread = 80 + age * 20;
            const envelope = Math.max(0, 1 - Math.abs(dist - wavefront) / spread);
            const decay = Math.max(0, 1 - age / source.life);
            falloff = envelope * decay * Math.max(0, 1 - dist / 500);
          }

          amp += source.amp * falloff
            * Math.sin((dist / source.wl - now * 0.9) * 2 * Math.PI + source.phase);
        }

        this.field[i * this.cols + j] = amp;
      }
    }

    for (let li = 0; li < this.levels.length; li += 1) {
      const level = this.levels[li];
      this.ctx.strokeStyle = this.blues[li];
      this.ctx.lineWidth = li === 3 ? 1.2 : 0.7;
      this.ctx.globalAlpha = 0.75 + (li / this.levels.length) * 0.25;
      this.ctx.beginPath();

      for (let i = 0; i < this.rows - 1; i += 1) {
        for (let j = 0; j < this.cols - 1; j += 1) {
          const idx = i * this.cols + j;
          const x = j * this.res;
          const y = i * this.res;
          const v00 = this.field[idx] > level;
          const v10 = this.field[idx + 1] > level;
          const v11 = this.field[idx + this.cols + 1] > level;
          const v01 = this.field[idx + this.cols] > level;

          if (v00 !== v10) {
            this.ctx.moveTo(x + this.res / 2, y);
            this.ctx.lineTo(x + this.res, y + this.res / 2);
          }
          if (v10 !== v11) {
            this.ctx.moveTo(x + this.res, y + this.res / 2);
            this.ctx.lineTo(x + this.res / 2, y + this.res);
          }
          if (v11 !== v01) {
            this.ctx.moveTo(x + this.res / 2, y + this.res);
            this.ctx.lineTo(x, y + this.res / 2);
          }
          if (v01 !== v00) {
            this.ctx.moveTo(x, y + this.res / 2);
            this.ctx.lineTo(x + this.res / 2, y);
          }
        }
      }

      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;
    this.time += 0.012;
    this.animationFrameId = requestAnimationFrame(this.animate);
  };
}

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EstanqueBackgroundComponent],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pondCanvas') private pondCanvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly title = inject(Title);
  private readonly zone = inject(NgZone);

  private pondBackground?: PondBackgroundRenderer;
  private codigoReferidoDesdeUrl = '';

  readonly registrando = signal(false);
  readonly errorMensaje = signal('');

  readonly registroForm = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      nickname: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmarContrasena: ['', [Validators.required]],
      biografia: ['', [Validators.maxLength(220)]],
    },
    { validators: this.passwordMatchValidator }
  );

  ngOnInit(): void {
    this.title.setTitle('Regístrate');
    this.codigoReferidoDesdeUrl = this.route.snapshot.queryParamMap.get('ref')?.trim() ?? '';
  }

  ngAfterViewInit(): void {
    const canvas = this.pondCanvasRef?.nativeElement;

    if (!canvas) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      try {
        this.pondBackground = new PondBackgroundRenderer(canvas);
        this.pondBackground.start();
      } catch {
        this.pondBackground = undefined;
      }
    });
  }

  ngOnDestroy(): void {
    this.pondBackground?.destroy();
  }

  registrarUsuario(): void {
    this.errorMensaje.set('');

    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }

    const datos = this.registroForm.getRawValue();
    const codigoReferido = this.codigoReferidoDesdeUrl;
    const email = datos.email?.trim().toLowerCase() ?? '';
    this.registrando.set(true);

    this.auth
      .register({
        nombre: datos.nombre?.trim(),
        nickname: datos.nickname?.trim(),
        email,
        password: datos.password ?? '',
        biografia: datos.biografia?.trim() || '',
        ...(codigoReferido ? { codigoReferido } : {}),
      })
      .subscribe({
        next: (response) => {
          if (response.requiresEmailVerification === true) {
            this.guardarVerificacionPendiente(response, email);
            this.registrando.set(false);
            void this.router.navigate(['/confirmar-email']);
            return;
          }

          localStorage.setItem('accesoPermitido', 'true');
          localStorage.removeItem('guestMode');
          // Verify session via HttpOnly cookie before navigating to ensure
          // the profile guard finds an authenticated user immediately
          this.auth.me().subscribe({
            next: () => {
              this.registrando.set(false);
              void this.router.navigate(['/inicio']);
            },
            error: () => {
              this.registrando.set(false);
              void this.router.navigate(['/inicio']);
            }
          });
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.errorMensaje.set(this.extraerMensajeError(error));
        }
      });
  }

  volverAOpciones(): void {
    void this.router.navigate(['/registro-opciones']);
  }

  irAlEstanque(): void {
    void this.router.navigate(['/estanque']);
  }

  campoInvalido(nombreCampo: string): boolean {
    const control = this.registroForm.get(nombreCampo);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  getErrorCampo(nombreCampo: string): string {
    const control = this.registroForm.get(nombreCampo);

    if (!control || !(control.touched || control.dirty)) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }

    if (control.hasError('email')) {
      return 'Escribe un correo válido.';
    }

    if (control.hasError('minlength')) {
      const requiredLength = control.getError('minlength')?.requiredLength ?? 0;
      return `Necesitas al menos ${requiredLength} caracteres.`;
    }

    if (control.hasError('maxlength')) {
      return 'Intenta resumirlo un poco más.';
    }

    if (nombreCampo === 'confirmarContrasena' && this.registroForm.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden.';
    }

    return 'Revisa este campo.';
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmacion = control.get('confirmarContrasena')?.value;

    if (!password || !confirmacion) {
      return null;
    }

    return password === confirmacion ? null : { passwordMismatch: true };
  }

  private extraerMensajeError(error: unknown): string {
    return getUserErrorMessage(
      error,
      'La cuenta no se creó. Revisa los datos del registro.'
    );
  }

  private guardarVerificacionPendiente(response: AuthResponse, emailFormulario: string): void {
    const emailReal = this.getEmailRealPendiente(response, emailFormulario);

    savePendingEmailVerification({
      email: emailReal,
      maskedEmail: response.emailVerification?.email ?? emailReal,
      expiresInMinutes: response.emailVerification?.expiresInMinutes ?? null,
    });
  }

  private getEmailRealPendiente(response: AuthResponse, fallbackEmail: string): string {
    const responseEmail =
      response.user?.email ??
      response.usuario?.email ??
      response.data?.email ??
      fallbackEmail;

    return responseEmail.trim().toLowerCase();
  }
}
