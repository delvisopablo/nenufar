import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  DashboardMetrica,
  DashboardReserva,
  DashboardResumen,
  DashboardService
} from '../../servicios/dashboardService/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dashboardService = inject(DashboardService);

  readonly negocioId = signal<number>(0);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly resumen = signal<DashboardResumen | null>(null);
  readonly metricas = signal<DashboardMetrica[]>([]);
  readonly reservas = signal<DashboardReserva[]>([]);

  readonly metricMax = computed(() =>
    Math.max(...this.metricas().map((item) => item.value), 1)
  );

  readonly proximasReservas = computed(() =>
    this.reservas()
      .filter((item) => new Date(item.fecha).getTime() >= Date.now())
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      .slice(0, 6)
  );

  readonly resumenEstado = computed(() => {
    const data = this.resumen();
    if (!data) {
      return [];
    }

    return [
      { label: 'Reservas', value: String(data.totalReservas), tone: 'green' },
      { label: 'Pendientes', value: String(data.pendientes), tone: 'gold' },
      { label: 'Confirmadas', value: String(data.confirmadas), tone: 'orange' },
      { label: 'No show', value: String(data.noShow), tone: 'soft' },
      { label: 'Reseñas', value: String(data.totalResenas), tone: 'green' },
      { label: 'Nota media', value: `${data.puntuacionMedia.toFixed(1)} / 5`, tone: 'gold' }
    ];
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('No hemos podido identificar el negocio de este dashboard.');
      this.cargando.set(false);
      return;
    }

    this.negocioId.set(id);
    this.cargarDashboard();
  }

  cargarDashboard(): void {
    this.cargando.set(true);
    this.error.set('');

    this.dashboardService.getResumen(this.negocioId()).subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        this.cargarMetricas();
        this.cargarReservas();
      },
      error: () => {
        this.error.set('No hemos podido cargar el dashboard del negocio.');
        this.cargando.set(false);
      }
    });
  }

  private cargarMetricas(): void {
    this.dashboardService.getMetricas(this.negocioId()).subscribe({
      next: (metricas) => {
        this.metricas.set(metricas);
        this.finalizarCargaSiProcede();
      },
      error: () => {
        this.metricas.set([]);
        this.finalizarCargaSiProcede();
      }
    });
  }

  private cargarReservas(): void {
    this.dashboardService.getReservasDashboard(this.negocioId()).subscribe({
      next: (reservas) => {
        this.reservas.set(reservas);
        this.finalizarCargaSiProcede();
      },
      error: () => {
        this.reservas.set([]);
        this.finalizarCargaSiProcede();
      }
    });
  }

  private pendingSources = 2;

  private finalizarCargaSiProcede(): void {
    this.pendingSources -= 1;

    if (this.pendingSources <= 0) {
      this.cargando.set(false);
      this.pendingSources = 2;
    }
  }

  estadoLabel(estado: string): string {
    return {
      PENDIENTE: 'Pendiente',
      CONFIRMADA: 'Confirmada',
      CANCELADA: 'Cancelada',
      COMPLETADA: 'Completada',
      NO_SHOW: 'No show'
    }[estado] ?? estado;
  }

  formatFecha(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Sin fecha'
      : date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
  }
}
