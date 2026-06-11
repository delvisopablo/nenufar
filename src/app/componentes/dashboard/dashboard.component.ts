import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { resolveBusinessImage, addUnsplashParams, buildUnsplashSrcset } from '../../core/negocio/negocio-visuals';
import {
  HORARIO_DAY_ORDER,
  HORARIO_DAY_SHORT_LABELS,
  buildHorarioSummaryLines,
  hasHorarioConfigurado,
  normalizeHorarioWeekly,
} from '../../core/negocio/negocio-horario';
import {
  AuthService,
  resolveOwnedBusinessId,
} from '../../servicios/authService/auth.service';
import { NegocioService, NegocioSummary } from '../../servicios/negocioService/negocio.service';
import { Pedido, PedidoService } from '../../servicios/pedidoServicio/pedido.service';
import { Promocion, PromocionService } from '../../servicios/promocionServicio/promocionService.service';
import {
  DashboardDisponibilidad,
  DashboardNegocio,
  DashboardMetrica,
  DashboardReserva,
  DashboardResumen,
  DashboardService
} from '../../servicios/dashboardService/dashboard.service';

interface DashboardReview {
  id: number | string;
  puntuacion: number;
  contenido: string;
  autor: string;
  creadoEn: string | null;
}

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
  private readonly pedidoService = inject(PedidoService);
  private readonly promocionService = inject(PromocionService);

  readonly negocioId = signal<number>(0);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly negocio = signal<DashboardNegocio | null>(null);
  readonly resumen = signal<DashboardResumen | null>(null);
  readonly metricas = signal<DashboardMetrica[]>([]);
  readonly reservas = signal<DashboardReserva[]>([]);
  readonly disponibilidades = signal<DashboardDisponibilidad[]>([]);
  readonly pedidos = signal<Pedido[]>([]);
  readonly promociones = signal<Promocion[]>([]);
  readonly resenas = signal<DashboardReview[]>([]);
  readonly pedidosDisponibles = signal(true);
  readonly promocionesDisponibles = signal(true);
  readonly resenasDisponibles = signal(true);

  readonly metricMax = computed(() =>
    Math.max(...this.metricas().map((item) => item.value), 1)
  );

  readonly reservasActivas = computed(() =>
    Boolean(
      this.resumen()?.aceptaReservas ??
      this.negocio()?.reservasActivas ??
      this.negocio()?.aceptaReservas
    )
  );

  readonly horarioResumen = computed(() =>
    buildHorarioSummaryLines(
      this.negocio()?.horario ?? null,
      this.negocio()?.intervaloReserva ?? null,
      this.reservasActivas(),
    )
  );

  readonly horarioConfigurado = computed(() =>
    Boolean(
      this.resumen()?.tieneHorario ||
      hasHorarioConfigurado(this.negocio()?.horario ?? null)
    )
  );

  readonly diasAbiertos = computed(() => {
    const horario = this.negocio()?.horario ?? null;
    if (!horario) {
      return [];
    }

    const weekly = normalizeHorarioWeekly(horario);
    return HORARIO_DAY_ORDER
      .filter((dayKey) => weekly[dayKey].length > 0)
      .map((dayKey) => HORARIO_DAY_SHORT_LABELS[dayKey]);
  });

  readonly proximasReservas = computed(() =>
    this.reservas()
      .filter((item) => new Date(item.fecha).getTime() >= Date.now())
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      .slice(0, 5)
  );

  readonly proximasFranjas = computed(() =>
    this.disponibilidades()
      .flatMap((dia) =>
        dia.slots.map((slot) => ({
          key: `${dia.date}-${slot}`,
          date: dia.date,
          dateLabel: this.formatAvailabilityDate(dia.date),
          timeLabel: this.formatSlotTime(slot),
        }))
      )
      .slice(0, 8)
  );

  readonly pedidosRecientes = computed(() =>
    [...this.pedidos()]
      .sort((a, b) => this.getPedidoTimestamp(b) - this.getPedidoTimestamp(a))
      .slice(0, 4)
  );

  readonly promocionesActivas = computed(() => {
    const now = Date.now();

    return this.promociones()
      .filter((promocion) => {
        const estado = String(promocion.estado ?? '').toUpperCase();
        const caducidad = new Date(promocion.fechaCaducidad).getTime();
        const vigente = Number.isNaN(caducidad) || caducidad >= now;

        return promocion.activa && vigente && !['BORRADOR', 'OCULTO', 'ELIMINADO'].includes(estado);
      })
      .sort((a, b) => new Date(a.fechaCaducidad).getTime() - new Date(b.fechaCaducidad).getTime())
      .slice(0, 3);
  });

  readonly resenasRecientes = computed(() =>
    [...this.resenas()]
      .sort((a, b) => this.getReviewTimestamp(b) - this.getReviewTimestamp(a))
      .slice(0, 3)
  );

  readonly resumenEstado = computed(() => {
    const data = this.resumen();
    if (!data) {
      return [];
    }

    return [
      { label: 'Reservas', value: String(data.totalReservas), tone: 'green' },
      { label: 'Pendientes', value: String(data.pendientes), tone: 'gold' },
      { label: 'Confirmadas', value: String(data.confirmadas), tone: 'blue' },
      { label: 'Reseñas', value: String(data.totalResenas), tone: 'orange' },
      { label: 'Nota media', value: data.puntuacionMedia ? data.puntuacionMedia.toFixed(1) : 'Sin nota', tone: 'soft' }
    ];
  });

  readonly estadoGeneral = computed(() => {
    if (!this.horarioConfigurado()) {
      return {
        label: 'Horario pendiente',
        detail: 'Configura el horario para empezar a recibir reservas.',
        tone: 'warning',
      };
    }

    if (!this.reservasActivas()) {
      return {
        label: 'Reservas pausadas',
        detail: 'El perfil está activo, pero las reservas online están desactivadas.',
        tone: 'paused',
      };
    }

    return {
      label: 'Listo para reservar',
      detail: 'Tu negocio tiene horario y reservas online activas.',
      tone: 'ready',
    };
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
          this.error.set('Falta el identificador del negocio para abrir el dashboard.');
          this.cargando.set(false);
          return;
        }

        this.negocioId.set(negocio.id);
        this.cargarNegocioBase(negocio.id);
      },
      error: () => {
        this.error.set('Falta el identificador del negocio para abrir el dashboard.');
        this.cargando.set(false);
      },
    });
  }

  cargarDashboard(): void {
    const negocioId = this.negocioId();

    if (!negocioId) {
      this.error.set('Falta el identificador del negocio para abrir el dashboard.');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set('');
    this.pedidosDisponibles.set(true);
    this.promocionesDisponibles.set(true);
    this.resenasDisponibles.set(true);

    forkJoin({
      resumen: this.dashboardService.getResumen(negocioId).pipe(
        catchError(() => of(this.buildFallbackResumen())),
      ),
      metricas: this.dashboardService.getMetricas(negocioId).pipe(
        catchError(() => of([] as DashboardMetrica[])),
      ),
      reservas: this.dashboardService.getReservasDashboard(negocioId).pipe(
        catchError(() => of([] as DashboardReserva[])),
      ),
      disponibilidades: this.cargarDisponibilidades(negocioId),
      pedidos: this.pedidoService.listPedidosNegocio(negocioId, { limit: 6 }).pipe(
        catchError(() => {
          this.pedidosDisponibles.set(false);
          return of([] as Pedido[]);
        }),
      ),
      promociones: this.promocionService.getPromocionesPorNegocio(negocioId).pipe(
        catchError(() => {
          this.promocionesDisponibles.set(false);
          return of([] as Promocion[]);
        }),
      ),
      resenas: this.negocioService.getResenas(negocioId).pipe(
        catchError(() => {
          this.resenasDisponibles.set(false);
          return of([] as unknown[]);
        }),
      ),
    }).subscribe({
      next: ({ resumen, metricas, reservas, disponibilidades, pedidos, promociones, resenas }) => {
        this.resumen.set(resumen);
        this.metricas.set(metricas);
        this.reservas.set(reservas);
        this.disponibilidades.set(disponibilidades);
        this.pedidos.set(pedidos);
        this.promociones.set(promociones);
        this.resenas.set(resenas.map((item) => this.normalizeReview(item)));
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('El dashboard del negocio no se cargó.');
        this.cargando.set(false);
      },
    });
  }

  private cargarNegocioBase(negocioId: number): void {
    this.negocioService.getNegocioById(negocioId).subscribe({
      next: (negocio) => {
        this.aplicarNegocio(negocio);
        this.cargarDashboard();
      },
      error: () => {
        this.error.set('El negocio del dashboard no se resolvió.');
        this.cargando.set(false);
      },
    });
  }

  private cargarDisponibilidades(negocioId: number) {
    const dates = this.getAvailabilityDates(3);

    return forkJoin(
      dates.map((fecha) =>
        this.dashboardService.obtenerDisponibilidad(negocioId, fecha).pipe(
          catchError(() => of(null)),
        )
      )
    ).pipe(
      map((items) =>
        items.filter((item): item is DashboardDisponibilidad => Boolean(item))
      ),
      catchError(() => of([] as DashboardDisponibilidad[])),
    );
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
      reservasActivas: Boolean(negocio.reservasActivas ?? negocio.aceptaReservas),
      aceptaReservas: Boolean(negocio.reservasActivas ?? negocio.aceptaReservas),
      intervaloReserva: Number(negocio.intervaloReserva ?? negocio.horario?.intervalo ?? 0) || null,
      categoria:
        typeof negocio.categoria === 'string'
          ? { nombre: negocio.categoria }
          : negocio.categoria,
      horario: negocio.horario ?? undefined,
    });
  }

  private buildFallbackResumen(): DashboardResumen {
    const reservasActivas = this.reservasActivas();

    return {
      totalReservas: 0,
      pendientes: 0,
      confirmadas: 0,
      canceladas: 0,
      completadas: 0,
      noShow: 0,
      puntuacionMedia: 0,
      totalResenas: 0,
      aceptaReservas: reservasActivas,
      tieneHorario: hasHorarioConfigurado(this.negocio()?.horario ?? null),
    };
  }

  private getAvailabilityDates(days: number): string[] {
    return Array.from({ length: days }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index);
      return this.formatDateKey(date);
    });
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  formatAvailabilityDate(value: string): string {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? 'Próximo día'
      : date.toLocaleDateString('es-ES', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
        });
  }

  formatSlotTime(value: string): string {
    const clean = String(value ?? '').trim();
    if (/^\d{2}:\d{2}/.test(clean)) {
      return clean.slice(0, 5);
    }

    const date = new Date(clean);
    return Number.isNaN(date.getTime())
      ? clean || 'Sin hora'
      : date.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
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

  getPublicProfileRoute(): (string | number)[] {
    const negocioId = this.negocio()?.id ?? this.negocioId();
    return negocioId ? ['/negocio', negocioId] : ['/mi-negocio'];
  }

  getPedidoEstadoLabel(estado: string): string {
    return {
      PENDIENTE: 'Pendiente',
      COMPLETADO: 'Completado',
      CANCELADO: 'Cancelado',
    }[estado] ?? estado;
  }

  formatPedidoTotal(pedido: Pedido): string {
    const total = Number(pedido.total);
    return Number.isFinite(total)
      ? total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
      : 'Total pendiente';
  }

  getPedidoMeta(pedido: Pedido): string {
    const items = Array.isArray(pedido.items) ? pedido.items.length : 0;
    const canal = pedido.canalVenta ? String(pedido.canalVenta).toLowerCase() : 'local';
    return items ? `${items} artículo${items !== 1 ? 's' : ''} · ${canal}` : canal;
  }

  formatPedidoFecha(pedido: Pedido): string {
    const timestamp = this.getPedidoTimestamp(pedido);
    return timestamp
      ? new Date(timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      : 'Sin fecha';
  }

  getPromocionDescuento(promocion: Promocion): string {
    switch (promocion.tipoDescuento) {
      case 'PORCENTAJE':
        return `${promocion.descuento}%`;
      case 'IMPORTE_FIJO':
        return `${promocion.descuento} €`;
      case 'PACK':
        return `Pack ${promocion.descuento}`;
      case 'DOS_X_UNO':
        return 'Dos por uno';
      default:
        return String(promocion.descuento);
    }
  }

  formatPromocionCaducidad(promocion: Promocion): string {
    const date = new Date(promocion.fechaCaducidad);
    return Number.isNaN(date.getTime())
      ? 'Sin caducidad'
      : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }

  getReviewInitial(review: DashboardReview): string {
    return review.autor.trim().charAt(0).toUpperCase() || 'N';
  }

  getStars(value: number): string {
    return '★'.repeat(Math.max(0, Math.min(5, Math.round(value))));
  }

  formatReviewDate(review: DashboardReview): string {
    if (!review.creadoEn) {
      return 'Sin fecha';
    }

    const date = new Date(review.creadoEn);
    return Number.isNaN(date.getTime())
      ? 'Sin fecha'
      : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }

  private getPedidoTimestamp(pedido: Pedido): number {
    const raw =
      pedido['creadoEn'] ??
      pedido['createdAt'] ??
      pedido['fecha'] ??
      pedido['actualizadoEn'] ??
      pedido['updatedAt'];
    const date = new Date(String(raw ?? ''));
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private getReviewTimestamp(review: DashboardReview): number {
    const date = new Date(review.creadoEn ?? '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private normalizeReview(item: unknown): DashboardReview {
    const raw = (item && typeof item === 'object' ? item : {}) as Record<string, any>;
    const usuario = (raw['usuario'] ?? raw['user'] ?? raw['autor'] ?? {}) as Record<string, any>;
    const contenido = String(raw['contenido'] ?? raw['texto'] ?? raw['comentario'] ?? '').trim();

    return {
      id: Number(raw['id'] ?? 0) || String(raw['id'] ?? (contenido || Math.random())),
      puntuacion: Number(raw['puntuacion'] ?? raw['rating'] ?? 0) || 0,
      contenido: contenido || 'Reseña sin comentario escrito.',
      autor: String(
        raw['autorNombre'] ??
        usuario['autorNombre'] ??
        usuario['nombre'] ??
        usuario['nickname'] ??
        'Cliente de Nenúfar'
      ),
      creadoEn: String(raw['creadoEn'] ?? raw['createdAt'] ?? raw['fechaISO'] ?? '') || null,
    };
  }
}
