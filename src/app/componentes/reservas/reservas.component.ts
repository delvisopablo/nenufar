import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NegocioService } from '../../servicios/negocioService/negocio.service';
import {
  DashboardDisponibilidad,
  DashboardNegocio,
  DashboardReserva,
  DashboardService,
  EstadoReserva
} from '../../servicios/dashboardService/dashboard.service';

type SlotView = {
  hora: string;
  disponible: boolean;
  ocupadas: number;
  capacidad: number;
};

type HourPeak = {
  hora: string;
  total: number;
  tone: 'baja' | 'media' | 'alta';
};

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reservas.component.html',
  styleUrl: './reservas.component.css'
})
export class ReservasComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dashboardService = inject(DashboardService);
  private readonly negocioService = inject(NegocioService);

  readonly negocioId = signal<number>(0);
  readonly negocioRouteKey = signal('');
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly negocio = signal<DashboardNegocio | null>(null);
  readonly fechaSeleccionada = signal(this.todayIso());
  readonly filtroEstado = signal<'TODAS' | EstadoReserva>('TODAS');
  readonly disponibilidad = signal<DashboardDisponibilidad | null>(null);
  readonly reservas = signal<DashboardReserva[]>([]);
  readonly historicas = signal<DashboardReserva[]>([]);

  readonly tieneHorario = computed(() =>
    this.hasHorarioConfigurado(this.negocio()?.horario)
  );

  readonly reservasFiltradas = computed(() => {
    const estado = this.filtroEstado();
    if (estado === 'TODAS') {
      return this.reservas();
    }

    return this.reservas().filter((item) => item.estado === estado);
  });

  readonly conteos = computed(() => ({
    todas: this.reservas().length,
    pendientes: this.reservas().filter((item) => item.estado === 'PENDIENTE').length,
    confirmadas: this.reservas().filter((item) => item.estado === 'CONFIRMADA').length,
    canceladas: this.reservas().filter((item) => item.estado === 'CANCELADA').length,
    noShow: this.reservas().filter((item) => item.estado === 'NO_SHOW').length
  }));

  readonly slots = computed<SlotView[]>(() => {
    const horario = this.negocio()?.horario;
    const date = this.fechaSeleccionada();
    const ranges = this.getRangesForDate(horario, date);

    if (!ranges.length) {
      return [];
    }

    const intervalo = Number(horario?.intervalo ?? this.disponibilidad()?.intervalo ?? 30) || 30;
    const availableTimes = new Set(
      (this.disponibilidad()?.slots ?? []).map((slot) =>
        this.timeLabelFromIso(slot)
      )
    );

    const occupiedCount = new Map<string, number>();
    for (const reserva of this.reservas()) {
      const key = this.timeLabelFromIso(reserva.fecha);
      occupiedCount.set(key, (occupiedCount.get(key) ?? 0) + 1);
    }

    const labels = ranges.flatMap(([start, end]) => this.generateTimeLabels(start, end, intervalo));
    const uniqueLabels = Array.from(new Set(labels));

    return uniqueLabels.map((hora) => {
      const ocupadas = occupiedCount.get(hora) ?? 0;
      const disponible = availableTimes.size ? availableTimes.has(hora) : ocupadas === 0;

      return {
        hora,
        disponible,
        ocupadas,
        capacidad: 1
      };
    });
  });

  readonly horasPunta = computed<HourPeak[]>(() => {
    const grouped = new Map<string, number>();

    for (const reserva of this.historicas()) {
      const key = this.timeLabelFromIso(reserva.fecha);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }

    const max = Math.max(...grouped.values(), 1);

    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([hora, total]) => ({
        hora,
        total,
        tone: total / max > 0.74 ? 'alta' : total / max > 0.38 ? 'media' : 'baja'
      }));
  });

  readonly semana = computed(() =>
    Array.from({ length: 7 }, (_, index) => {
      const date = this.dateFromWeekOffset(index);
      const iso = date.toISOString().slice(0, 10);
      return {
        iso,
        nombre: date.toLocaleDateString('es-ES', { weekday: 'short' }),
        dia: date.getDate(),
        activa: iso === this.fechaSeleccionada(),
        hoy: iso === this.todayIso()
      };
    })
  );

  ngOnInit(): void {
    const routeParam = this.negocioService.normalizeRouteParam(
      this.route.snapshot.paramMap.get('nickname') ??
      this.route.snapshot.paramMap.get('slug'),
    );

    if (!routeParam) {
      this.error.set('No hemos podido identificar el negocio de esta vista de reservas.');
      this.cargando.set(false);
      return;
    }

    this.negocioService.resolveNegocioFromRouteParam(routeParam).subscribe({
      next: (negocio) => {
        if (!negocio) {
          this.error.set('No hemos podido resolver el negocio de esta vista de reservas.');
          this.cargando.set(false);
          return;
        }

        this.negocioId.set(negocio.id);
        this.negocioRouteKey.set(this.negocioService.getRouteKey(negocio) ?? routeParam);
        this.cargarBase();
      },
      error: () => {
        this.error.set('No hemos podido resolver el negocio de esta vista de reservas.');
        this.cargando.set(false);
      }
    });
  }

  seleccionarFecha(value: string): void {
    if (!value) {
      return;
    }

    this.fechaSeleccionada.set(value);
    this.cargarDia();
  }

  seleccionarDiaSemana(iso: string): void {
    this.fechaSeleccionada.set(iso);
    this.cargarDia();
  }

  confirmar(reserva: DashboardReserva): void {
    this.dashboardService.actualizarReservaEstado(reserva.id, 'CONFIRMADA').subscribe({
      next: (actualizada) => this.patchReserva(actualizada),
      error: () => this.error.set('No hemos podido confirmar la reserva.')
    });
  }

  cancelar(reserva: DashboardReserva): void {
    this.dashboardService.actualizarReservaEstado(reserva.id, 'CANCELADA').subscribe({
      next: (actualizada) => this.patchReserva(actualizada),
      error: () => this.error.set('No hemos podido cancelar la reserva.')
    });
  }

  marcarNoShow(reserva: DashboardReserva): void {
    this.dashboardService.actualizarReservaEstado(reserva.id, 'NO_SHOW').subscribe({
      next: (actualizada) => this.patchReserva(actualizada),
      error: () => this.error.set('No hemos podido marcar la reserva como no show.')
    });
  }

  estadoLabel(estado: EstadoReserva): string {
    return {
      PENDIENTE: 'Pendiente',
      CONFIRMADA: 'Confirmada',
      CANCELADA: 'Cancelada',
      COMPLETADA: 'Completada',
      NO_SHOW: 'No show'
    }[estado] ?? estado;
  }

  fechaLabel(isoDate: string): string {
    const date = new Date(`${isoDate}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? 'Sin fecha'
      : date.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        });
  }

  horaLabel(isoDate: string): string {
    return this.timeLabelFromIso(isoDate);
  }

  esAccionable(reserva: DashboardReserva): boolean {
    return !['CANCELADA', 'COMPLETADA', 'NO_SHOW'].includes(reserva.estado);
  }

  private cargarBase(): void {
    this.cargando.set(true);
    this.error.set('');

    this.dashboardService.obtenerNegocio(this.negocioId()).subscribe({
      next: (negocio) => {
        this.negocio.set(negocio);
        this.cargarHistorico();
        this.cargarDia();
      },
      error: () => {
        this.error.set('No hemos podido cargar los datos del negocio.');
        this.cargando.set(false);
      }
    });
  }

  private cargarDia(): void {
    this.cargando.set(true);
    this.error.set('');
    const fecha = this.fechaSeleccionada();

    this.dashboardService.obtenerReservasNegocio(this.negocioId(), { fecha, limit: 100 }).subscribe({
      next: (reservas) => {
        this.reservas.set(reservas);

        this.dashboardService.obtenerDisponibilidad(this.negocioId(), fecha).subscribe({
          next: (disponibilidad) => {
            this.disponibilidad.set(disponibilidad);
            this.cargando.set(false);
          },
          error: () => {
            this.disponibilidad.set({ date: fecha, intervalo: 30, slots: [] });
            this.cargando.set(false);
          }
        });
      },
      error: () => {
        this.error.set('No hemos podido cargar las reservas del negocio.');
        this.cargando.set(false);
      }
    });
  }

  private cargarHistorico(): void {
    this.dashboardService.getReservasDashboard(this.negocioId()).subscribe({
      next: (reservas) => this.historicas.set(reservas),
      error: () => this.historicas.set([])
    });
  }

  private patchReserva(updated: DashboardReserva): void {
    this.reservas.update((items) =>
      items.map((item) => (item.id === updated.id ? updated : item))
    );
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private timeLabelFromIso(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value.slice(11, 16) || value;
    }

    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private generateTimeLabels(start: string, end: string, interval: number): string[] {
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    const labels: string[] = [];

    for (let current = startTotal; current < endTotal; current += interval) {
      const hour = String(Math.floor(current / 60)).padStart(2, '0');
      const minute = String(current % 60).padStart(2, '0');
      labels.push(`${hour}:${minute}`);
    }

    return labels;
  }

  private getRangesForDate(
    horario: DashboardNegocio['horario'] | null | undefined,
    isoDate: string
  ): Array<[string, string]> {
    if (!horario) {
      return [];
    }

    const date = new Date(`${isoDate}T12:00:00`);
    const weekdayIndex = date.getDay();
    const weekdayAliases = [
      ['domingo', 'dom', 'sunday'],
      ['lunes', 'lun', 'monday'],
      ['martes', 'mar', 'tuesday'],
      ['miércoles', 'miercoles', 'mié', 'mie', 'wednesday'],
      ['jueves', 'jue', 'thursday'],
      ['viernes', 'vie', 'friday'],
      ['sábado', 'sabado', 'sáb', 'sab', 'saturday']
    ][weekdayIndex];

    const weekly = horario.weekly ?? {};
    for (const alias of weekdayAliases) {
      const key = Object.keys(weekly).find((item) => item.toLowerCase() === alias);
      const ranges = key ? weekly[key] : undefined;

      if (ranges?.length) {
        return ranges.filter(
          (item): item is [string, string] =>
            Array.isArray(item) &&
            item.length === 2 &&
            typeof item[0] === 'string' &&
            typeof item[1] === 'string'
        );
      }
    }

    if (horario.apertura && horario.cierre) {
      return [[horario.apertura, horario.cierre]];
    }

    return [];
  }

  private dateFromWeekOffset(offset: number): Date {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(now.getDate() + mondayOffset + offset);
    return monday;
  }

  private hasHorarioConfigurado(horario: DashboardNegocio['horario'] | null | undefined): boolean {
    if (!horario) {
      return false;
    }

    if (horario.apertura && horario.cierre) {
      return true;
    }

    return Object.values(horario.weekly ?? {}).flat().length > 0;
  }

  getBusinessRouteKey(): string {
    return this.negocioRouteKey() || this.negocioService.normalizeRouteParam(
      this.route.snapshot.paramMap.get('nickname') ??
      this.route.snapshot.paramMap.get('slug'),
    ) || '';
  }
}
