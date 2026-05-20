import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';

interface BurstParticle {
  tx: string;
  ty: string;
  r: string;
  delay: string;
  duration: string;
  size: string;
}

@Component({
  selector: 'app-nenufar-burst',
  standalone: true,
  imports: [],
  template: `
    @if (active) {
      <div class="burst-overlay" aria-live="polite" aria-atomic="true">
        @for (p of particles(); track $index) {
          <div
            class="burst-particle"
            [style.--tx]="p.tx"
            [style.--ty]="p.ty"
            [style.--r]="p.r"
            [style.animation-delay]="p.delay"
            [style.animation-duration]="p.duration"
            [style.width]="p.size"
            [style.height]="p.size"
          >
            <img [src]="nenufarSrc" alt="" draggable="false">
          </div>
        }
        @if (showMessage()) {
          <div class="burst-message">{{ message }}</div>
        }
      </div>
    }
  `,
  styles: [`
    .burst-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .burst-particle {
      position: absolute;
      animation: nenufar-burst-fly var(--dur, 1s) ease-out forwards;
      animation-delay: var(--delay, 0ms);
    }

    .burst-particle img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.28));
    }

    @keyframes nenufar-burst-fly {
      0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
      70%  { opacity: 0.9; }
      100% { transform: translate(var(--tx), var(--ty)) rotate(var(--r)) scale(0.3); opacity: 0; }
    }

    .burst-message {
      position: absolute;
      padding: 0.78rem 1.5rem;
      border: 1px solid rgba(244, 92, 156, 0.36);
      border-radius: 999px;
      background:
        linear-gradient(135deg, rgba(17, 61, 49, 0.96), rgba(9, 34, 28, 0.96));
      backdrop-filter: blur(10px);
      color: #ffd4e8;
      font-weight: 800;
      font-size: 1.02rem;
      letter-spacing: 0.01em;
      box-shadow:
        0 14px 32px rgba(0, 0, 0, 0.28),
        0 0 0 1px rgba(255, 255, 255, 0.06);
      animation: burst-message-appear 0.36s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }

    @keyframes burst-message-appear {
      from { opacity: 0; transform: translateY(12px) scale(0.94); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
  `],
})
export class NenufarBurstComponent implements OnChanges {
  @Input() nenufarSrc = 'assets/imagenes/nenufar.png';
  @Input() active = false;
  @Input() message = 'Tu reseña ha sido publicada';
  @Output() finished = new EventEmitter<void>();

  readonly particles = signal<BurstParticle[]>([]);
  readonly showMessage = signal(false);

  private finishTimer: ReturnType<typeof setTimeout> | null = null;
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['active']?.currentValue === true) {
      this.launch();
    }

    if (changes['active']?.currentValue === false) {
      this.clearTimers();
      this.showMessage.set(false);
      this.particles.set([]);
    }
  }

  private launch(): void {
    this.clearTimers();
    this.showMessage.set(false);
    this.particles.set(this.buildParticles(11));

    this.messageTimer = setTimeout(() => this.showMessage.set(true), 560);
    this.finishTimer = setTimeout(() => this.finished.emit(), 1600);
  }

  private buildParticles(count: number): BurstParticle[] {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
      const dist = 70 + Math.random() * 110;
      const size = 36 + Math.round(Math.random() * 20);
      return {
        tx: `${Math.round(Math.cos(angle) * dist)}px`,
        ty: `${Math.round(Math.sin(angle) * dist)}px`,
        r: `${Math.round((Math.random() - 0.5) * 600)}deg`,
        delay: `${Math.round(i * 18 + Math.random() * 30)}ms`,
        duration: `${880 + Math.round(Math.random() * 320)}ms`,
        size: `${size}px`,
      };
    });
  }

  private clearTimers(): void {
    if (this.finishTimer !== null) {
      clearTimeout(this.finishTimer);
      this.finishTimer = null;
    }

    if (this.messageTimer !== null) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
  }
}
