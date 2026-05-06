import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AccessRequiredModalComponent } from '../../components/shared/access-required-modal/access-required-modal.component';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import {
  AuthService,
  AuthUser,
  resolveOwnedBusinessId,
} from '../../servicios/authService/auth.service';
import { DashboardService } from '../../servicios/dashboardService/dashboard.service';
import { NegocioService } from '../../servicios/negocioService/negocio.service';
import {
  AvailabilityResponse,
  ReservaEstado,
  ReservaRecord,
  ReservaService,
} from '../../servicios/reservaService/reserva.service';

type ReservaModo = 'cliente' | 'negocio';
type ReservaModoInput = ReservaModo | 'auto';
type PestañaCliente = 'reservar' | 'mis';
type DiaOpcion = {
  iso: string;
  nombre: string;
  dia: number;
  hoy: boolean;
  activa: boolean;
  abierta: boolean;
};
type GrupoSlots = {
  label: string;
  slots: Array<{ iso: string; hora: string }>;
};
type ResumenHorarioSlot = {
  hora: string;
  disponible: boolean;
  ocupadas: number;
};
type NegocioReservasContexto = {
  id: number;
  nombre: string;
  aceptaReservas?: boolean;
  intervaloReserva?: number | null;
  horario?: {
    apertura?: string;
    cierre?: string;
    intervalo?: number;
    weekly?: Record<string, [string, string][]>;
    exceptions?: Record<string, [string, string][]>;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AccessRequiredModalComponent],
  templateUrl: './reservas.component.html',
  styleUrl: './reservas.component.scss',
})
export class ReservasComponent implements OnInit, OnChanges {
  @Input() modo: ReservaModoInput = 'auto';
  @Input() negocioId: number | null = null;
  @Input() negocio: NegocioReservasContexto | null = null;
  @Input() embebido = false;
  @Input() permitirMisReservas = true;

  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly negocioService = inject(NegocioService);
  private readonly dashboardService = inject(DashboardService);
  private readonly reservaService = inject(ReservaService);

  readonly personasOptions = [1, 2, 3, 4, 5, 6, 8, 10];
  readonly duracionOptions = [30, 45, 60, 90, 120];
  readonly filtrosEstado: Array<'TODAS' | ReservaEstado> = [
    'TODAS',
    'PENDIENTE',
    'CONFIRMADA',
    'CANCELADA',
    'COMPLETADA',
    'NO_SHOW',
  ];

  usuarioActual: AuthUser | null = this.authService.obtenerUsuario();
  modoResuelto: ReservaModo = 'cliente';
  negocioActual: NegocioReservasContexto | null = null;

  cargando = true;
  cargandoDisponibilidad = false;
  accionEnCurso = false;

  error = '';
  exito = '';

  modalAccesoAbierto = false;
  mensajeAcceso = 'Necesitas iniciar sesion para continuar con las reservas.';

  fechaSeleccionada = this.todayIso();
  ventanaDiasOffset = 0;
  pestanaCliente: PestañaCliente = 'reservar';
  filtroEstado: 'TODAS' | ReservaEstado = 'TODAS';

  numPersonas = 2;
  duracionMinutos = 30;
  nota = '';
  slotSeleccionadoIso: string | null = null;

  disponibilidad: AvailabilityResponse | null = null;
  reservasNegocio: ReservaRecord[] = [];
  misReservas: ReservaRecord[] = [];

  private lastContextKey = '';
  private mineLookupInFlight = false;

  ngOnInit(): void {
    this.authService
      .hydrateSession({ forceRemote: this.authService.hasSessionHint() })
      .subscribe({
        next: (usuario) => {
          this.usuarioActual = usuario;
          this.ensureContext();
        },
      });

    this.ensureContext();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.ensureContext();
  }

  get mostrarTabsCliente(): boolean {
    return this.modoResuelto === 'cliente' && this.mostrarTabReservar && this.mostrarTabMis;
  }

  get mostrarTabReservar(): boolean {
    return this.modoResuelto === 'cliente' && Boolean(this.negocioActual?.id);
  }

  get mostrarTabMis(): boolean {
    return Boolean(this.permitirMisReservas && this.usuarioActual?.id);
  }

  get tieneHorarioConfigurado(): boolean {
    return this.hasHorarioConfigurado(this.negocioActual?.horario ?? null);
  }

  get reservasNegocioFiltradas(): ReservaRecord[] {
    const items = [...this.reservasNegocio].sort((left, right) =>
      left.fecha.localeCompare(right.fecha),
    );

    if (this.filtroEstado === 'TODAS') {
      return items;
    }

    return items.filter((item) => item.estado === this.filtroEstado);
  }

  get misReservasOrdenadas(): ReservaRecord[] {
    return [...this.misReservas].sort((left, right) =>
      left.fecha.localeCompare(right.fecha),
    );
  }

  get slotsAgrupados(): GrupoSlots[] {
    const slots = (this.disponibilidad?.slots ?? []).map((slot) => ({
      iso: slot,
      hora: this.timeLabel(slot),
    }));

    return [
      {
        label: 'Mañana',
        slots: slots.filter((slot) => this.timeToMinutes(slot.hora) < 12 * 60),
      },
      {
        label: 'Tarde',
        slots: slots.filter(
          (slot) =>
            this.timeToMinutes(slot.hora) >= 12 * 60 &&
            this.timeToMinutes(slot.hora) < 18 * 60,
        ),
      },
      {
        label: 'Noche',
        slots: slots.filter((slot) => this.timeToMinutes(slot.hora) >= 18 * 60),
      },
    ].filter((grupo) => grupo.slots.length > 0);
  }

  get resumenHorario(): ResumenHorarioSlot[] {
    if (!this.negocioActual?.horario) {
      return [];
    }

    const ranges = this.getRangesForDate(this.negocioActual.horario, this.fechaSeleccionada);
    if (!ranges.length) {
      return [];
    }

    const intervalo = this.getIntervaloReserva(this.negocioActual);
    const disponibles = new Set(
      (this.disponibilidad?.slots ?? []).map((slot) => this.timeLabel(slot)),
    );
    const ocupadas = new Map<string, number>();

    for (const reserva of this.reservasNegocio) {
      const hora = this.timeLabel(reserva.fecha);
      ocupadas.set(hora, (ocupadas.get(hora) ?? 0) + 1);
    }

    const labels = Array.from(
      new Set(
        ranges.flatMap(([inicio, fin]) =>
          this.generateTimeLabels(inicio, fin, intervalo),
        ),
      ),
    );

    return labels.map((hora) => ({
      hora,
      disponible: disponibles.has(hora),
      ocupadas: ocupadas.get(hora) ?? 0,
    }));
  }

  get conteosNegocio(): Record<string, number> {
    return {
      TODAS: this.reservasNegocio.length,
      PENDIENTE: this.reservasNegocio.filter((item) => item.estado === 'PENDIENTE').length,
      CONFIRMADA: this.reservasNegocio.filter((item) => item.estado === 'CONFIRMADA').length,
      CANCELADA: this.reservasNegocio.filter((item) => item.estado === 'CANCELADA').length,
      COMPLETADA: this.reservasNegocio.filter((item) => item.estado === 'COMPLETADA').length,
      NO_SHOW: this.reservasNegocio.filter((item) => item.estado === 'NO_SHOW').length,
    };
  }

  get tarjetasNegocio(): Array<{ label: string; value: string | number; tone: string }> {
    return [
      {
        label: 'Reservas del día',
        value: this.reservasNegocio.length,
        tone: 'poppy',
      },
      {
        label: 'Pendientes',
        value: this.conteosNegocio['PENDIENTE'],
        tone: 'butter',
      },
      {
        label: 'Confirmadas',
        value: this.conteosNegocio['CONFIRMADA'],
        tone: 'mint',
      },
      {
        label: 'Franjas libres',
        value: this.resumenHorario.filter((slot) => slot.disponible).length,
        tone: 'bubble',
      },
    ];
  }

  get diasVentana(): DiaOpcion[] {
    const today = this.parseDate(`${this.todayIso()}T12:00:00`);
    const base = new Date(today);
    base.setDate(base.getDate() + this.ventanaDiasOffset * 14);

    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(base);
      date.setDate(base.getDate() + index);
      const iso = date.toISOString().slice(0, 10);

      return {
        iso,
        nombre: date.toLocaleDateString('es-ES', { weekday: 'short' }),
        dia: date.getDate(),
        hoy: iso === this.todayIso(),
        activa: iso === this.fechaSeleccionada,
        abierta: this.dayHasSchedule(iso),
      };
    });
  }

  get filasDias(): DiaOpcion[][] {
    const dias = this.diasVentana;
    return [dias.slice(0, 7), dias.slice(7, 14)].filter((fila) => fila.length > 0);
  }

  get etiquetaVentanaDias(): string {
    const primerDia = this.diasVentana[0];
    if (!primerDia) {
      return '';
    }

    return this.parseDate(`${primerDia.iso}T12:00:00`).toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    });
  }

  get tituloPrincipal(): string {
    if (this.modoResuelto === 'negocio') {
      return this.embebido ? 'Reservas del negocio' : 'Gestión de reservas';
    }

    if (this.negocioActual?.nombre) {
      return `Reservar en ${this.negocioActual.nombre}`;
    }

    return this.embebido ? 'Reservas' : 'Mis reservas';
  }

  get subtituloPrincipal(): string {
    if (this.modoResuelto === 'negocio') {
      return this.longDateLabel(this.fechaSeleccionada);
    }

    if (this.negocioActual?.nombre) {
      return 'Elige día, hora y consulta tus reservas desde el mismo bloque.';
    }

    return 'Consulta tus próximas reservas y cancela si lo necesitas.';
  }

  moverVentanaDias(delta: number): void {
    if (delta < 0 && this.ventanaDiasOffset === 0) {
      return;
    }

    this.ventanaDiasOffset = Math.max(0, this.ventanaDiasOffset + delta);
  }

  seleccionarPestanaCliente(tab: PestañaCliente): void {
    if (tab === 'reservar' && !this.mostrarTabReservar) {
      return;
    }

    if (tab === 'mis' && !this.mostrarTabMis) {
      return;
    }

    this.pestanaCliente = tab;
  }

  seleccionarDia(iso: string): void {
    if (!iso || iso === this.fechaSeleccionada) {
      return;
    }

    this.fechaSeleccionada = iso;
    this.slotSeleccionadoIso = null;
    this.exito = '';
    this.error = '';
    this.refreshCurrentData();
  }

  seleccionarSlot(slotIso: string): void {
    this.slotSeleccionadoIso = slotIso;
  }

  setNumPersonas(value: number | string): void {
    const parsed = Number(value);
    this.numPersonas = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  setDuracion(value: number | string): void {
    const parsed = Number(value);
    this.duracionMinutos = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  }

  crearReserva(): void {
    if (!this.negocioActual?.id || !this.slotSeleccionadoIso) {
      return;
    }

    if (!this.authService.isAuthenticated()) {
      this.mensajeAcceso = 'Necesitas iniciar sesion para crear una reserva.';
      this.modalAccesoAbierto = true;
      return;
    }

    this.accionEnCurso = true;
    this.error = '';
    this.exito = '';

    this.reservaService
      .crearReserva({
        negocioId: this.negocioActual.id,
        fecha: this.slotSeleccionadoIso,
        nota: this.nota,
        duracionMinutos: this.duracionMinutos,
        numPersonas: this.numPersonas,
      })
      .subscribe({
        next: () => {
          this.accionEnCurso = false;
          this.exito = 'Reserva creada correctamente.';
          this.nota = '';
          this.slotSeleccionadoIso = null;
          this.loadAvailability(this.negocioActual?.id ?? null);
          this.loadMyReservations();
          if (this.mostrarTabMis) {
            this.pestanaCliente = 'mis';
          }
        },
        error: (error: unknown) => {
          this.accionEnCurso = false;
          this.error = getUserErrorMessage(error, 'No hemos podido crear la reserva.');
        },
      });
  }

  cancelarReservaPropia(reserva: ReservaRecord): void {
    if (!reserva.id) {
      return;
    }

    const confirmed = confirm('¿Quieres cancelar esta reserva?');
    if (!confirmed) {
      return;
    }

    const motivo = prompt('Motivo de cancelación (opcional):')?.trim() || undefined;
    this.accionEnCurso = true;
    this.error = '';
    this.exito = '';

    this.reservaService.cancelarReserva(reserva.id, motivo).subscribe({
      next: (actualizada) => {
        this.accionEnCurso = false;
        this.exito = 'Reserva cancelada.';
        if (actualizada) {
          this.patchReserva(actualizada);
        } else {
          this.misReservas = this.misReservas.filter((item) => item.id !== reserva.id);
          this.reservasNegocio = this.reservasNegocio.filter((item) => item.id !== reserva.id);
        }
        this.loadAvailability(this.negocioActual?.id ?? null);
      },
      error: (error: unknown) => {
        this.accionEnCurso = false;
        this.error = getUserErrorMessage(error, 'No hemos podido cancelar la reserva.');
      },
    });
  }

  confirmarReservaNegocio(reserva: ReservaRecord): void {
    this.actualizarEstadoReserva(reserva, 'CONFIRMADA');
  }

  completarReservaNegocio(reserva: ReservaRecord): void {
    this.actualizarEstadoReserva(reserva, 'COMPLETADA');
  }

  marcarNoShow(reserva: ReservaRecord): void {
    this.actualizarEstadoReserva(reserva, 'NO_SHOW');
  }

  cancelarReservaNegocio(reserva: ReservaRecord): void {
    const motivo = prompt('Motivo de cancelación (opcional):')?.trim() || undefined;
    this.actualizarEstadoReserva(reserva, 'CANCELADA', motivo);
  }

  estadoLabel(estado: ReservaEstado): string {
    return (
      {
        PENDIENTE: 'Pendiente',
        CONFIRMADA: 'Confirmada',
        CANCELADA: 'Cancelada',
        COMPLETADA: 'Completada',
        NO_SHOW: 'No show',
      }[estado] ?? estado
    );
  }

  estadoClass(estado: ReservaEstado): string {
    return `estado-${String(estado).toLowerCase()}`;
  }

  shortDateLabel(iso: string): string {
    return this.parseDate(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });
  }

  longDateLabel(iso: string): string {
    return this.parseDate(`${iso}T12:00:00`).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  timeLabel(value: string): string {
    return this.parseDate(value).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  puedeGestionar(reserva: ReservaRecord): boolean {
    return reserva.estado === 'PENDIENTE' || reserva.estado === 'CONFIRMADA';
  }

  irAReservasPrivadas(): void {
    void this.router.navigate(['/reservas']);
  }

  irAGestionNegocio(): void {
    void this.router.navigate(['/mi-negocio/reservas']);
  }

  irAConfigurarHorario(): void {
    void this.router.navigate(['/mi-negocio/editar']);
  }

  irAEstanque(): void {
    this.modalAccesoAbierto = false;
    void this.router.navigate(['/estanque']);
  }

  private ensureContext(): void {
    const mode = this.resolveMode();
    const businessId = this.resolveBusinessId();
    const inputBusinessId = Number(this.negocio?.id ?? 0) || null;
    const contextKey = `${mode}|${businessId ?? 'none'}|${inputBusinessId ?? 'none'}|${this.embebido ? 'embedded' : 'page'}`;

    if (contextKey === this.lastContextKey) {
      return;
    }

    this.lastContextKey = contextKey;
    this.modoResuelto = mode;
    this.error = '';
    this.exito = '';
    this.cargando = true;

    if (this.negocio && inputBusinessId && businessId === inputBusinessId) {
      this.negocioActual = this.normalizeNegocioContext(this.negocio);
    } else if (!businessId) {
      this.negocioActual = null;
    }

    if (mode === 'negocio') {
      this.loadBusinessMode(businessId);
      return;
    }

    this.loadClientMode(businessId);
  }

  private resolveMode(): ReservaModo {
    if (this.modo === 'cliente' || this.modo === 'negocio') {
      return this.modo;
    }

    const path = this.route.snapshot.routeConfig?.path ?? '';
    return path.startsWith('mi-negocio') ? 'negocio' : 'cliente';
  }

  private resolveBusinessId(): number | null {
    const fromInput = Number(this.negocioId);
    if (Number.isFinite(fromInput) && fromInput > 0) {
      return fromInput;
    }

    const fromBusiness = Number(this.negocio?.id ?? 0);
    if (Number.isFinite(fromBusiness) && fromBusiness > 0) {
      return fromBusiness;
    }

    if (this.resolveMode() === 'negocio') {
      return resolveOwnedBusinessId(this.usuarioActual) ?? null;
    }

    return null;
  }

  private loadBusinessMode(targetBusinessId: number | null): void {
    if (!targetBusinessId) {
      this.lookupMineAndReload();
      return;
    }

    this.getBusinessContext(targetBusinessId).subscribe({
      next: (negocio) => {
        this.negocioActual = negocio;
        this.loadBusinessDayData(targetBusinessId);
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.error = getUserErrorMessage(
          error,
          'No hemos podido cargar la configuración del negocio.',
        );
      },
    });
  }

  private loadClientMode(targetBusinessId: number | null): void {
    const negocio$ = targetBusinessId
      ? this.getBusinessContext(targetBusinessId).pipe(catchError(() => of(null)))
      : of(null);
    const misReservas$ = this.authService.isAuthenticated() || this.usuarioActual?.id
      ? this.reservaService.getMisReservas({ limit: 50 }).pipe(catchError(() => of([])))
      : of([]);

    forkJoin({ negocio: negocio$, misReservas: misReservas$ }).subscribe({
      next: ({ negocio, misReservas }) => {
        this.negocioActual = negocio;
        this.misReservas = misReservas;

        if (!this.mostrarTabReservar && this.mostrarTabMis) {
          this.pestanaCliente = 'mis';
        }

        if (negocio?.id) {
          this.loadAvailability(negocio.id);
        } else {
          this.disponibilidad = null;
          this.cargando = false;
        }
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.error = getUserErrorMessage(error, 'No hemos podido cargar las reservas.');
      },
    });
  }

  private loadBusinessDayData(negocioId: number): void {
    forkJoin({
      reservas: this.reservaService
        .getReservasPorNegocio(negocioId, {
          from: this.startOfDayIso(this.fechaSeleccionada),
          to: this.endOfDayIso(this.fechaSeleccionada),
          limit: 100,
        })
        .pipe(catchError(() => of([]))),
      disponibilidad: this.tieneHorarioConfigurado
        ? this.reservaService
            .availability(negocioId, this.fechaSeleccionada)
            .pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: ({ reservas, disponibilidad }) => {
        this.reservasNegocio = reservas;
        this.disponibilidad = disponibilidad;
        this.cargando = false;
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.error = getUserErrorMessage(error, 'No hemos podido cargar las reservas del negocio.');
      },
    });
  }

  private loadMyReservations(): void {
    if (!(this.authService.isAuthenticated() || this.usuarioActual?.id)) {
      this.misReservas = [];
      return;
    }

    this.reservaService.getMisReservas({ limit: 50 }).subscribe({
      next: (reservas) => {
        this.misReservas = reservas;
      },
      error: () => {
        this.misReservas = [];
      },
    });
  }

  private loadAvailability(negocioId: number | null): void {
    if (!negocioId || !this.tieneHorarioConfigurado) {
      this.disponibilidad = null;
      this.cargando = false;
      return;
    }

    this.cargandoDisponibilidad = true;

    this.reservaService.availability(negocioId, this.fechaSeleccionada).subscribe({
      next: (disponibilidad) => {
        this.disponibilidad = disponibilidad;
        this.cargandoDisponibilidad = false;
        this.cargando = false;
      },
      error: (error: unknown) => {
        this.disponibilidad = null;
        this.cargandoDisponibilidad = false;
        this.cargando = false;
        this.error = getUserErrorMessage(
          error,
          'No hemos podido cargar la disponibilidad de este negocio.',
        );
      },
    });
  }

  private refreshCurrentData(): void {
    const targetBusinessId = this.negocioActual?.id ?? this.resolveBusinessId();

    if (this.modoResuelto === 'negocio' && targetBusinessId) {
      this.loadBusinessDayData(targetBusinessId);
      return;
    }

    if (this.modoResuelto === 'cliente') {
      this.loadAvailability(targetBusinessId);
      if (this.mostrarTabMis) {
        this.loadMyReservations();
      }
    }
  }

  private actualizarEstadoReserva(
    reserva: ReservaRecord,
    estado: ReservaEstado,
    motivoCancelacion?: string,
  ): void {
    if (!reserva.id) {
      return;
    }

    this.accionEnCurso = true;
    this.error = '';
    this.exito = '';

    this.reservaService
      .actualizarEstadoReserva(reserva.id, estado, motivoCancelacion)
      .subscribe({
        next: (actualizada) => {
          this.accionEnCurso = false;
          this.exito = `Reserva marcada como ${this.estadoLabel(estado).toLowerCase()}.`;
          this.patchReserva(actualizada);
          this.loadAvailability(this.negocioActual?.id ?? null);
        },
        error: (error: unknown) => {
          this.accionEnCurso = false;
          this.error = getUserErrorMessage(error, 'No hemos podido actualizar el estado.');
        },
      });
  }

  private patchReserva(actualizada: ReservaRecord): void {
    this.reservasNegocio = this.reservasNegocio.map((item) =>
      item.id === actualizada.id ? { ...item, ...actualizada } : item,
    );
    this.misReservas = this.misReservas.map((item) =>
      item.id === actualizada.id ? { ...item, ...actualizada } : item,
    );
  }

  private lookupMineAndReload(): void {
    if (this.mineLookupInFlight) {
      return;
    }

    this.mineLookupInFlight = true;

    this.negocioService.getMine().subscribe({
      next: (negocio) => {
        this.mineLookupInFlight = false;
        const negocioId = Number(negocio?.id ?? 0);

        if (!Number.isFinite(negocioId) || negocioId <= 0) {
          this.cargando = false;
          this.error = 'No hemos podido identificar el negocio de esta cuenta.';
          return;
        }

        this.negocioActual = this.normalizeNegocioContext(negocio);
        this.lastContextKey = '';
        this.loadBusinessMode(negocioId);
      },
      error: (error: unknown) => {
        this.mineLookupInFlight = false;
        this.cargando = false;
        this.error = getUserErrorMessage(
          error,
          'No hemos podido identificar el negocio de esta cuenta.',
        );
      },
    });
  }

  private getBusinessContext(negocioId: number) {
    if (this.negocioActual?.id === negocioId && this.negocioActual?.horario) {
      return of(this.negocioActual);
    }

    if (this.negocio?.id === negocioId && this.negocio?.horario) {
      return of(this.normalizeNegocioContext(this.negocio));
    }

    return this.dashboardService.obtenerNegocio(negocioId).pipe(
      map((item) => this.normalizeNegocioContext(item)),
      catchError(() =>
        this.negocioService.getNegocioById(negocioId).pipe(
          map((item) => this.normalizeNegocioContext(item)),
        ),
      ),
    );
  }

  private normalizeNegocioContext(source: any): NegocioReservasContexto {
    return {
      id: Number(source?.id ?? 0) || 0,
      nombre: String(source?.nombre ?? 'Negocio'),
      aceptaReservas:
        typeof source?.aceptaReservas === 'boolean' ? source.aceptaReservas : true,
      intervaloReserva:
        Number(source?.intervaloReserva ?? source?.horario?.intervalo ?? 0) || null,
      horario: source?.horario ?? null,
    };
  }

  private hasHorarioConfigurado(horario: NegocioReservasContexto['horario'] | null): boolean {
    if (!horario) {
      return false;
    }

    if (horario.apertura && horario.cierre) {
      return true;
    }

    return Object.values(horario.weekly ?? {}).flat().length > 0;
  }

  private dayHasSchedule(isoDate: string): boolean {
    return this.getRangesForDate(this.negocioActual?.horario ?? null, isoDate).length > 0;
  }

  private getRangesForDate(
    horario: NegocioReservasContexto['horario'] | null,
    isoDate: string,
  ): Array<[string, string]> {
    if (!horario) {
      return [];
    }

    if (horario.exceptions && horario.exceptions[isoDate] !== undefined) {
      return Array.isArray(horario.exceptions[isoDate]) ? horario.exceptions[isoDate] : [];
    }

    if (horario.weekly && typeof horario.weekly === 'object') {
      const date = this.parseDate(`${isoDate}T12:00:00`);
      const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
      return Array.isArray(horario.weekly[dayKey]) ? horario.weekly[dayKey] : [];
    }

    if (horario.apertura && horario.cierre) {
      return [[horario.apertura, horario.cierre]];
    }

    return [];
  }

  private getIntervaloReserva(negocio: NegocioReservasContexto | null): number {
    return Number(negocio?.intervaloReserva ?? negocio?.horario?.intervalo ?? 30) || 30;
  }

  private generateTimeLabels(start: string, end: string, intervalo: number): string[] {
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);
    const labels: string[] = [];

    for (let current = startMinutes; current < endMinutes; current += intervalo) {
      const hour = Math.floor(current / 60).toString().padStart(2, '0');
      const minute = (current % 60).toString().padStart(2, '0');
      labels.push(`${hour}:${minute}`);
    }

    return labels;
  }

  private timeToMinutes(value: string): number {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private startOfDayIso(isoDate: string): string {
    return new Date(`${isoDate}T00:00:00`).toISOString();
  }

  private endOfDayIso(isoDate: string): string {
    return new Date(`${isoDate}T23:59:59.999`).toISOString();
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private parseDate(value: string): Date {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }
}
