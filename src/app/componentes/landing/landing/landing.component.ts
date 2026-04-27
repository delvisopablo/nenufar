import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CuentaAtrasService } from '../../../servicios/cuentaAtrasServicio/cuenta-atras.service';
import { AuthService } from '../../../servicios/authService/auth.service';
import { getUserErrorMessage, isAppErrorModel } from '../../../core/errors/error-parser';

type PondPad = {
  xRatio: number;
  yRatio: number;
  radiusRatio: number;
  phase: number;
  drift: number;
  rotation: number;
};

type Ripple = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
};

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pond') pondCanvas?: ElementRef<HTMLCanvasElement>;

  usuario = '';
  password = '';

  modalOpen = signal(false);
  loginPending = signal(false);
  loginError = signal('');

  private animationFrameId: number | null = null;
  private lastAmbientRipple = 0;
  private ripples: Ripple[] = [];
  private shouldAnimate = true;
  private readonly pads: PondPad[] = [
    { xRatio: 0.18, yRatio: 0.28, radiusRatio: 0.055, phase: 0.3, drift: 7, rotation: 0.25 },
    { xRatio: 0.34, yRatio: 0.62, radiusRatio: 0.082, phase: 1.2, drift: 11, rotation: -0.2 },
    { xRatio: 0.53, yRatio: 0.4, radiusRatio: 0.062, phase: 2.1, drift: 8, rotation: 0.15 },
    { xRatio: 0.7, yRatio: 0.7, radiusRatio: 0.09, phase: 2.9, drift: 13, rotation: -0.12 },
    { xRatio: 0.83, yRatio: 0.32, radiusRatio: 0.05, phase: 3.7, drift: 6, rotation: 0.32 },
    { xRatio: 0.56, yRatio: 0.82, radiusRatio: 0.07, phase: 4.4, drift: 10, rotation: -0.28 }
  ];

  constructor(
    private cuentaAtrasService: CuentaAtrasService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const accesoPermitido = localStorage.getItem('accesoPermitido') === 'true';

    if (accesoPermitido) {
      this.shouldAnimate = false;
      this.cuentaAtrasService.desbloquearAcceso();
      const destino = this.authService.isAuthenticated() ? '/inicio' : '/login';
      this.router.navigate([destino]);
    }
  }

  ngAfterViewInit(): void {
    if (!this.shouldAnimate) {
      return;
    }

    this.resizeCanvas();
    this.startAnimation();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeCanvas();
  }

  onCanvasClick(event: MouseEvent): void {
    const canvas = this.pondCanvas?.nativeElement;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      this.ripples.push({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        radius: 0,
        alpha: 0.45,
        speed: 1.8
      });
    }

    this.loginError.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.loginError.set('');
    this.modalOpen.set(false);
  }

  onLogin(): void {
    const usuario = this.usuario.trim();
    const password = this.password.trim();

    if (!usuario || !password) {
      this.loginError.set('Completa usuario y contraseña para continuar.');
      return;
    }

    this.loginPending.set(true);
    this.loginError.set('');

    this.authService.login(usuario, password).subscribe({
      next: () => {
        localStorage.setItem('accesoPermitido', 'true');
        localStorage.removeItem('guestMode');
        this.cuentaAtrasService.desbloquearAcceso();
        this.modalOpen.set(false);
        this.loginPending.set(false);
        this.router.navigate(['/inicio']);
      },
      error: (error: unknown) => {
        this.loginPending.set(false);
        this.loginError.set(
          isAppErrorModel(error) && error.kind === 'auth'
            ? 'Correo o contraseña incorrectos.'
            : getUserErrorMessage(error, 'No hemos podido iniciar sesión. Revisa tus datos.')
        );
      }
    });
  }

  onRegister(): void {
    localStorage.setItem('accesoPermitido', 'true');
    this.cuentaAtrasService.desbloquearAcceso();
    this.closeModal();
    this.router.navigate(['/registro-opciones']);
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private startAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  private animate = (time: number): void => {
    const canvas = this.pondCanvas?.nativeElement;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      this.animationFrameId = requestAnimationFrame(this.animate);
      return;
    }

    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;

    this.drawScene(context, width, height, time);
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private resizeCanvas(): void {
    const canvas = this.pondCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));

    const context = canvas.getContext('2d');
    context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private drawScene(context: CanvasRenderingContext2D, width: number, height: number, time: number): void {
    context.clearRect(0, 0, width, height);

    const waterGradient = context.createRadialGradient(
      width * 0.5,
      height * 0.58,
      width * 0.08,
      width * 0.5,
      height * 0.58,
      Math.max(width, height) * 0.7
    );
    waterGradient.addColorStop(0, 'rgba(18, 77, 119, 0.26)');
    waterGradient.addColorStop(0.55, 'rgba(6, 41, 71, 0.12)');
    waterGradient.addColorStop(1, 'rgba(1, 10, 24, 0)');

    context.fillStyle = waterGradient;
    context.fillRect(0, 0, width, height);

    this.drawReflections(context, width, height, time);
    this.spawnAmbientRipple(width, height, time);
    this.drawRipples(context);
    this.drawPads(context, width, height, time);
    this.drawPrompt(context, width, height);
  }

  private drawReflections(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ): void {
    context.save();
    context.globalAlpha = 0.18;

    for (let index = 0; index < 5; index += 1) {
      const offset = Math.sin(time * 0.00055 + index) * 18;
      context.beginPath();
      context.ellipse(
        width * (0.16 + index * 0.18),
        height * 0.18 + offset,
        width * 0.08,
        height * 0.025,
        -0.2 + index * 0.08,
        0,
        Math.PI * 2
      );
      context.fillStyle = 'rgba(138, 210, 241, 0.16)';
      context.fill();
    }

    context.restore();
  }

  private spawnAmbientRipple(width: number, height: number, time: number): void {
    if (time - this.lastAmbientRipple < 1400) {
      return;
    }

    this.lastAmbientRipple = time;
    this.ripples.push({
      x: width * (0.18 + Math.random() * 0.64),
      y: height * (0.22 + Math.random() * 0.58),
      radius: 4,
      alpha: 0.16,
      speed: 1.15
    });
  }

  private drawRipples(context: CanvasRenderingContext2D): void {
    this.ripples = this.ripples.filter((ripple) => {
      ripple.radius += ripple.speed;
      ripple.alpha -= 0.0035;

      if (ripple.alpha <= 0) {
        return false;
      }

      context.save();
      context.strokeStyle = `rgba(126, 204, 234, ${ripple.alpha})`;
      context.lineWidth = 1.4;

      context.beginPath();
      context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      context.stroke();

      context.beginPath();
      context.arc(ripple.x, ripple.y, ripple.radius * 1.65, 0, Math.PI * 2);
      context.stroke();

      context.restore();

      return ripple.radius < 220;
    });
  }

  private drawPads(context: CanvasRenderingContext2D, width: number, height: number, time: number): void {
    const minDimension = Math.min(width, height);

    for (const pad of this.pads) {
      const radius = minDimension * pad.radiusRatio;
      const x = width * pad.xRatio + Math.sin(time * 0.00045 + pad.phase) * pad.drift;
      const y = height * pad.yRatio + Math.cos(time * 0.00035 + pad.phase) * pad.drift * 0.7;
      const rotation = pad.rotation + Math.sin(time * 0.0003 + pad.phase) * 0.12;

      context.save();
      context.translate(x, y);
      context.rotate(rotation);

      context.beginPath();
      context.ellipse(0, radius * 0.18, radius * 1.04, radius * 0.72, 0, 0, Math.PI * 2);
      context.fillStyle = 'rgba(1, 7, 16, 0.36)';
      context.fill();

      const leafGradient = context.createRadialGradient(-radius * 0.25, -radius * 0.25, radius * 0.15, 0, 0, radius);
      leafGradient.addColorStop(0, '#79b678');
      leafGradient.addColorStop(0.55, '#397251');
      leafGradient.addColorStop(1, '#1a412d');

      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.fillStyle = leafGradient;
      context.fill();

      context.globalCompositeOperation = 'destination-out';
      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, radius * 0.98, -0.28, 0.28);
      context.closePath();
      context.fill();
      context.globalCompositeOperation = 'source-over';

      context.strokeStyle = 'rgba(177, 231, 183, 0.36)';
      context.lineWidth = Math.max(1, radius * 0.05);
      context.beginPath();
      context.moveTo(-radius * 0.75, radius * 0.08);
      context.quadraticCurveTo(-radius * 0.1, -radius * 0.12, radius * 0.5, -radius * 0.55);
      context.stroke();

      context.beginPath();
      context.moveTo(-radius * 0.1, radius * 0.05);
      context.lineTo(radius * 0.34, radius * 0.52);
      context.stroke();

      context.restore();
    }
  }

  private drawPrompt(context: CanvasRenderingContext2D, width: number, height: number): void {
    context.save();
    context.textAlign = 'center';
    context.fillStyle = 'rgba(168, 216, 240, 0.75)';
    context.font = '400 16px Georgia';
    context.fillText('haz clic sobre el estanque para entrar', width / 2, height - 42);
    context.restore();
  }
}
