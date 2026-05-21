import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  HorarioLike,
  getHorarioResumen,
  hasHorarioConfigurado,
} from '../../core/negocio/negocio-horario';

@Component({
  selector: 'app-business-horario-resumen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './business-horario-resumen.component.html',
  styleUrl: './business-horario-resumen.component.css',
})
export class BusinessHorarioResumenComponent {
  @Input() horario: HorarioLike | null | undefined = null;
  @Input() reservasActivas: boolean | null | undefined = null;
  @Input() intervaloReserva: number | null | undefined = null;

  get tieneHorarioReal(): boolean {
    return hasHorarioConfigurado(this.horario);
  }

  get lineas(): string[] {
    if (!this.tieneHorarioReal) {
      return [];
    }

    return getHorarioResumen(this.horario, {
      intervaloReserva: this.intervaloReserva,
      reservasActivas: this.reservasActivas,
    });
  }
}
