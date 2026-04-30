import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  input,
  OnDestroy,
  output,
  ViewChild,
  effect,
  inject,
  signal
} from '@angular/core';

@Component({
  selector: 'app-nenun-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nenun-info.component.html',
  styleUrl: './nenun-info.component.scss',
})
export class NenunInfoComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);

  readonly open = input(false);
  readonly closed = output<void>();

  @ViewChild('detailPopup') private readonly detailPopupRef?: ElementRef<HTMLElement>;
  @ViewChild('lilyDetail') private readonly lilyDetailRef?: ElementRef<HTMLElement>;

  readonly detailPopupVisible = signal(false);
  readonly pushTransform = signal('translate(0, 0) rotate(0deg)');
  readonly pushRippleActive = signal(false);
  readonly impactFlashActive = signal(false);

  private pushResetTimeoutId: number | null = null;
  private rippleResetTimeoutId: number | null = null;
  private flashResetTimeoutId: number | null = null;
  private previousBodyOverflow = '';

  constructor() {
    this.previousBodyOverflow = this.document.body.style.overflow;

    effect(() => {
      this.document.body.style.overflow = this.open() ? 'hidden' : this.previousBodyOverflow;
    });
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = this.previousBodyOverflow;
    this.clearTimers();
  }

  openModal(): void {
    void 0;
  }

  closeModal(): void {
    this.detailPopupVisible.set(false);
    this.closed.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  onPushMouseDown(event: MouseEvent, lily: HTMLElement): void {
    if (event.button !== 0) {
      return;
    }

    const rect = lily.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const edgeRatio = Math.min(dist / (rect.width * 0.5), 1);
    const magnitude = 28 + edgeRatio * 28;
    const nx = dx / dist;
    const ny = dy / dist;

    this.pushTransform.set(
      `translate(${-nx * magnitude}px, ${-ny * magnitude}px) rotate(${-nx * 8}deg)`,
    );
    this.pushRippleActive.set(false);
    this.impactFlashActive.set(false);

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        this.pushRippleActive.set(true);
        this.impactFlashActive.set(true);
      });
    } else {
      this.pushRippleActive.set(true);
      this.impactFlashActive.set(true);
    }

    if (this.pushResetTimeoutId != null) {
      window.clearTimeout(this.pushResetTimeoutId);
    }
    if (this.rippleResetTimeoutId != null) {
      window.clearTimeout(this.rippleResetTimeoutId);
    }
    if (this.flashResetTimeoutId != null) {
      window.clearTimeout(this.flashResetTimeoutId);
    }

    this.pushResetTimeoutId = window.setTimeout(() => {
      this.pushTransform.set('translate(0, 0) rotate(0deg)');
    }, 130);
    this.rippleResetTimeoutId = window.setTimeout(() => {
      this.pushRippleActive.set(false);
    }, 620);
    this.flashResetTimeoutId = window.setTimeout(() => {
      this.impactFlashActive.set(false);
    }, 300);

    event.preventDefault();
  }

  onDetailContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.detailPopupVisible.set(true);
  }

  closeDetail(event?: Event): void {
    event?.stopPropagation();
    this.detailPopupVisible.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }

    if (this.detailPopupVisible()) {
      this.detailPopupVisible.set(false);
      return;
    }

    if (this.open()) {
      this.closeModal();
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMousedown(event: MouseEvent): void {
    if (!this.detailPopupVisible() || event.button === 2) {
      return;
    }

    const target = event.target as Node | null;
    const detailPopup = this.detailPopupRef?.nativeElement;
    const lilyDetail = this.lilyDetailRef?.nativeElement;

    if (detailPopup?.contains(target) || lilyDetail?.contains(target)) {
      return;
    }

    this.detailPopupVisible.set(false);
  }

  private clearTimers(): void {
    if (this.pushResetTimeoutId != null) {
      window.clearTimeout(this.pushResetTimeoutId);
    }
    if (this.rippleResetTimeoutId != null) {
      window.clearTimeout(this.rippleResetTimeoutId);
    }
    if (this.flashResetTimeoutId != null) {
      window.clearTimeout(this.flashResetTimeoutId);
    }
  }
}
