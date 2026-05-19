import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { resolveBusinessImage, addUnsplashParams, buildUnsplashSrcset } from '../../core/negocio/negocio-visuals';
import { buildHorarioSummaryLines } from '../../core/negocio/negocio-horario';
import {
  AuthService,
  resolveOwnedBusinessId,
} from '../../servicios/authService/auth.service';
import { NegocioService, NegocioSummary } from '../../servicios/negocioService/negocio.service';
import {
  DashboardNegocio,
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
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly negocioService = inject(NegocioService);

  readonly negocioId = signal<number>(0);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly negocio = signal<DashboardNegocio | null>(null);
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

  readonly horarioResumen = computed(() =>
    buildHorarioSummaryLines(
      this.negocio()?.horario ?? null,
      this.negocio()?.intervaloReserva ?? null,
    )
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
    const negocioId = resolveOwnedBusinessId(this.authService.obtenerUsuario());

    if (negocioId) {
      this.negocioId.set(negocioId);
      this.cargarNegocioBase(negocioId);
      return;
    }

    this.negocioService.getMine().subscribe({
      next: (negocio) => {
        if (!negocio?.id) {
          this.error.set('No hemos podido identificar el negocio de este dashboard.');
          this.cargando.set(false);
          return;
        }

        this.negocioId.set(negocio.id);
        this.cargarNegocioBase(negocio.id);
      },
      error: () => {
        this.error.set('No hemos podido identificar el negocio de este dashboard.');
        this.cargando.set(false);
      },
    });
  }

  cargarDashboard(): void {
    this.cargando.set(true);
    this.error.set('');
    this.pendingSources = 2;

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

  private cargarNegocioBase(negocioId: number): void {
    this.negocioService.getNegocioById(negocioId).subscribe({
      next: (negocio) => {
        this.aplicarNegocio(negocio);
        this.cargarDashboard();
      },
      error: () => {
        this.error.set('No hemos podido resolver el negocio de este dashboard.');
        this.cargando.set(false);
      },
    });
  }

  private aplicarNegocio(negocio: NegocioSummary): void {
    this.negocio.set({
      id: negocio.id,
      nombre: negocio.nombre,
      foto: negocio.foto ?? undefined,
      fotoPerfil: negocio.fotoPerfil ?? undefined,
      fotoPortada: negocio.fotoPortada ?? undefined,
      nenufarAsset: negocio.nenufarAsset ?? undefined,
      nenufarKey: negocio.nenufarKey ?? undefined,
      aceptaReservas: Boolean(negocio.aceptaReservas),
      intervaloReserva: Number(negocio.intervaloReserva ?? negocio.horario?.intervalo ?? 0) || null,
      categoria:
        typeof negocio.categoria === 'string'
          ? { nombre: negocio.categoria }
          : negocio.categoria,
      horario: negocio.horario ?? undefined,
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

  getBusinessImage(): string {
    return addUnsplashParams(resolveBusinessImage(this.negocio()), 136);
  }

  getBusinessImageSrcset(): string {
    return buildUnsplashSrcset(resolveBusinessImage(this.negocio()), [68, 136]);
  }

  getBusinessCategory(): string {
    return this.negocio()?.categoria?.nombre || 'Negocio local';
  }
}
