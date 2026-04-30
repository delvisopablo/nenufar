import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-access-required-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './access-required-modal.component.html',
  styleUrl: './access-required-modal.component.scss',
})
export class AccessRequiredModalComponent {
  @Input() open = false;
  @Input() title = 'Acceso necesario';
  @Input() message = 'Necesitas iniciar sesion para continuar.';

  @Output() closed = new EventEmitter<void>();
  @Output() loginRequested = new EventEmitter<void>();

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
