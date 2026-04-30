import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import {
  AccionLogro,
  LogroServiceService,
  NivelProgreso,
  ProgresoEscalera,
} from '../../servicios/logroServicio/logroService.service';

@Component({
  selector: 'app-mis-logros',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-logros.component.html',
  styleUrl: './mis-logros.component.css',
})
export class MisLogrosComponent implements OnInit {
  private readonly logros = inject(LogroServiceService);

  readonly cargando = signal(true);
  readonly errorMensaje = signal('');
  readonly escaleras = signal<ProgresoEscalera[]>([]);

  ngOnInit(): void {
    this.logros.miProgreso().subscribe({
      next: (escaleras) => {
        this.escaleras.set(escaleras);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorMensaje.set(
          getUserErrorMessage(error, 'No hemos podido cargar tu progreso de logros.'),
        );
      },
    });
  }

  tituloAccion(accion: AccionLogro): string {
    switch (accion) {
      case 'RESENA_PUBLICADA':
        return 'Reseñas';
      case 'COMPRA_REALIZADA':
        return 'Compras';
      case 'RESERVA_HECHA':
        return 'Reservas';
      case 'PROMOCION_CANJEADA':
        return 'Promociones';
      case 'VISITA_NEGOCIO':
        return 'Visitas';
      case 'NEGOCIO_SEGUIDO':
        return 'Negocios seguidos';
      default:
        return 'Progreso';
    }
  }

  esNivelActual(escalera: ProgresoEscalera, nivel: NivelProgreso): boolean {
    const siguiente = escalera.niveles.find((item) => !item.desbloqueado);
    return !!siguiente && siguiente.id === nivel.id;
  }

  porcentajeAlSiguiente(escalera: ProgresoEscalera): number {
    const siguiente = escalera.niveles.find((item) => !item.desbloqueado);
    if (!siguiente) {
      return 100;
    }

    if (!siguiente.umbral || siguiente.umbral <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (escalera.contador / siguiente.umbral) * 100));
  }

  siguienteUmbralLabel(escalera: ProgresoEscalera): string {
    const siguiente = escalera.niveles.find((item) => !item.desbloqueado);
    if (!siguiente) {
      return 'Has completado todos los niveles.';
    }

    const faltan = Math.max(0, siguiente.umbral - escalera.contador);
    return `Te faltan ${faltan} para "${siguiente.titulo}" (${siguiente.umbral}).`;
  }
}
