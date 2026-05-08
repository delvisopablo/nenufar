import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';
import { Router } from '@angular/router';
import {
  NenufarActionEvent,
  NenufarActionType,
  NenufarHoverEvent,
  NenufarKind,
  NenufarLeftClickEvent,
  NenufarRenderState,
  NenufarRightClickEvent,
  NenufarTone,
  NenufarVectorLike
} from './nenufar.types';

@Component({
  selector: 'app-nenufar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nenufar.component.html',
  styleUrl: './nenufar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NenufarComponent<T = unknown> {
  private readonly router = inject(Router);

  @Input({ required: true }) id = '';
  @Input() actionType?: NenufarActionType;
  @Input() actionValue?: string;
  @Input() badge?: string;
  @Input() clickable = true;
  @Input() contextMenuEnabled = true;
  @Input() data?: T;
  @Input() imageSrc = 'assets/imagenes/nenufar_mustio.png';
  @Input() kind: NenufarKind = 'empty';
  @Input() label?: string;
  @Input() overlayEnabled = true;
  @Input() radius = 56;
  @Input() state?: NenufarRenderState | null;
  @Input() subtitle?: string;
  @Input() tooltipEnabled = true;
  @Input() x = 0;
  @Input() y = 0;

  @Output() action = new EventEmitter<NenufarActionEvent<T>>();
  @Output() hoverEnd = new EventEmitter<NenufarHoverEvent<T>>();
  @Output() hoverStart = new EventEmitter<NenufarHoverEvent<T>>();
  @Output() leftClick = new EventEmitter<NenufarLeftClickEvent<T>>();
  @Output() rightClick = new EventEmitter<NenufarRightClickEvent<T>>();

  tooltipVisible = false;

  get ariaLabel(): string {
    return this.label || this.subtitle || `Nenufar ${this.id}`;
  }

  get diameter(): number {
    return this.radius * 2;
  }

  get hasAction(): boolean {
    return !!this.actionType;
  }

  get isInteractive(): boolean {
    return this.clickable || this.contextMenuEnabled || this.hasAction;
  }

  get renderOpacity(): number {
    return this.state?.opacity ?? 1;
  }

  get renderRotation(): string {
    return `${this.state?.rotationDeg ?? 0}deg`;
  }

  get renderScale(): number {
    return this.state?.scale ?? 1;
  }

  get renderTone(): NenufarTone {
    return this.state?.tone ?? (this.kind === 'empty' ? 'mustio' : 'fresh');
  }

  get renderVisible(): boolean {
    return this.state?.visible ?? true;
  }

  get renderX(): number {
    return this.state?.x ?? this.x;
  }

  get renderY(): number {
    return this.state?.y ?? this.y;
  }

  get shouldShowOverlay(): boolean {
    if (!this.overlayEnabled || this.kind === 'empty') {
      return false;
    }

    return !!(this.label || this.subtitle || this.badge);
  }

  get shouldShowTooltip(): boolean {
    if (!this.tooltipEnabled || !this.tooltipVisible || this.kind === 'empty') {
      return false;
    }

    return !!(this.label || this.subtitle || this.badge || this.data);
  }

  get tooltipText(): string {
    if (this.subtitle) {
      return this.subtitle;
    }

    if (this.badge) {
      return this.badge;
    }

    return '';
  }

  onHoverStart(): void {
    this.tooltipVisible = true;
    this.hoverStart.emit({ data: this.data, id: this.id });
  }

  onHoverEnd(): void {
    this.tooltipVisible = false;
    this.hoverEnd.emit({ data: this.data, id: this.id });
  }

  onLeftClick(event: MouseEvent): void {
    if (!this.isInteractive) {
      return;
    }

    const localPoint = this.measureLocalPoint(event);
    this.leftClick.emit({
      data: this.data,
      id: this.id,
      localPoint,
      nativeEvent: event
    });

    this.triggerPrimaryAction(event);
  }

  onRightClick(event: MouseEvent): void {
    if (!this.contextMenuEnabled) {
      return;
    }

    event.preventDefault();
    this.rightClick.emit({
      data: this.data,
      id: this.id,
      nativeEvent: event
    });
  }

  private measureLocalPoint(event: MouseEvent): NenufarVectorLike {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return { x: 0, y: 0 };
    }

    const rect = target.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2
    };
  }

  private triggerPrimaryAction(event: MouseEvent): void {
    if (!this.actionType) {
      return;
    }

    const payload: NenufarActionEvent<T> = {
      actionType: this.actionType,
      actionValue: this.actionValue,
      data: this.data,
      id: this.id,
      nativeEvent: event
    };

    if (this.actionType === 'navigate' && this.actionValue) {
      void this.router.navigateByUrl(this.actionValue);
    }

    this.action.emit(payload);
  }
}
