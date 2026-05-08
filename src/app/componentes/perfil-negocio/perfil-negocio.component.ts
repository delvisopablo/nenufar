import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CrearResenaModalComponent } from '../crear-resena/crear-resena-modal/crear-resena-modal.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { getUserErrorMessage } from '../../core/errors/error-parser';
import { TicketScannerComponent } from '../ticket-scanner/ticket-scanner.component';
import { TicketScannerSubmitResult } from '../../servicios/ticketScannerServicio/ticket-scanner.service';
import { PromocionComponent } from '../promocion/promocion/promocion.component';
import { ReservasComponent } from '../reservas/reservas.component';
import {
  NenufarSelectorComponent,
} from '../../components/shared/nenufar-selector/nenufar-selector.component';
import { EstanqueBackgroundComponent } from '../shared/estanque-background/estanque-background.component';
import {
  DEFAULT_NENUFAR_FALLBACK_ASSET,
  NENUFAR_OPTIONS,
  resolveBusinessImage,
  resolveBusinessNenufarAsset,
  resolveNenufarAsset,
  resolveNenufarKey,
} from '../../core/negocio/negocio-visuals';
import {
  AuthService,
  resolveOwnedBusinessId,
} from '../../servicios/authService/auth.service';
import { NegocioService } from '../../servicios/negocioService/negocio.service';
import { ReservaService } from '../../servicios/reservaService/reserva.service';
import { AccessRequiredModalComponent } from '../../components/shared/access-required-modal/access-required-modal.component';

type AvailabilityResponse = {
  date: string;
  intervalo?: number;
  slots: string[];
};

function readStoredUser(): any | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem('usuarioLogueado') || localStorage.getItem('usuario');
  if (!raw || raw === 'undefined' || raw === 'null') return null;
  try { return JSON.parse(raw); } catch { return null; }
}

@Component({
  selector: 'app-perfil-negocio',
  standalone: true,
  imports: [
    CommonModule,
    CrearResenaModalComponent,
    RouterLink,
    TicketScannerComponent,
    PromocionComponent,
    ReservasComponent,
    NenufarSelectorComponent,
    EstanqueBackgroundComponent,
    AccessRequiredModalComponent,
  ],
  templateUrl: './perfil-negocio.component.html',
  styleUrl: './perfil-negocio.component.css'
})
export class PerfilNegocioComponent implements OnInit {
  private readonly negocioService = inject(NegocioService);
  private readonly reservaService = inject(ReservaService);
  private readonly authService = inject(AuthService);

  @ViewChild(NenufarSelectorComponent)
  private readonly nenufarSelector?: NenufarSelectorComponent;

  negocio: any = null;
  esPropietario = true;
  esDueno = true;
  modalAbierto = false;
  usuarioActual: any = null;
  mediaPuntuacion = 0;
  resenas: any[] = [];
  negocioId = 0;
  errorMensaje = '';
  reservaError = '';
  ticketScannerAbierto = false;
  ticketScannerMensaje = '';
  puedeGestionarReservas = false;
  mensajeReservasConfiguracion = 'Configura primero tu horario para gestionar reservas.';
  negocioRouteKey = '';
  siguiendoNegocio = false;
  seguidoresTotal = 0;
  seguidosTotal = 0;
  accessModalAbierto = false;
  accessModalMensaje = 'Necesitas iniciar sesion para seguir este negocio o reservar una franja.';
  guardandoNenufar = false;
  nenufarError = '';
  readonly nenufarOptions = NENUFAR_OPTIONS;

  diasSemana: string[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  horasGeneradas: string[] = [];
  reservasOcupadas: { [dia: string]: string[] } = {};
  private fechasSemana: Record<string, string> = {};

  // Acordeones del perfil del dueño
  readonly seccionHorario  = signal(false);
  readonly seccionReservas = signal(false);
  readonly seccionResenas  = signal(false);
  readonly seccionPromos   = signal(false);
  readonly modalActiva = signal<'nenufar' | 'reservas' | 'promociones' | null>(null);

  toggleSeccion(s: 'horario' | 'reservas' | 'resenas' | 'promos'): void {
    if (s === 'horario')  this.seccionHorario.update(v => !v);
    if (s === 'reservas') this.seccionReservas.update(v => !v);
    if (s === 'resenas')  this.seccionResenas.update(v => !v);
    if (s === 'promos')   this.seccionPromos.update(v => !v);
  }

  constructor(private router: Router) {
    this.usuarioActual = this.authService.obtenerUsuario() ?? readStoredUser();
  }

  ngOnInit(): void {
    this.inicializarSemanaActual();

    const negocioIdEnSesion = resolveOwnedBusinessId(this.usuarioActual);
    if (negocioIdEnSesion) {
      this.negocioId = negocioIdEnSesion;
      this.negocioRouteKey = String(negocioIdEnSesion);
      this.cargarNegocio();
      return;
    }

    this.negocioService.getMine().subscribe({
      next: (negocio) => {
        if (!negocio?.id) {
          this.errorMensaje = 'No hemos podido identificar tu negocio.';
          return;
        }

        this.negocioId = negocio.id;
        this.negocioRouteKey = String(negocio.id);
        this.cargarNegocio();
      },
      error: (error: unknown) => {
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido identificar tu negocio.');
      },
    });
  }

  getStars(n: number): string {
    return '★'.repeat(Math.max(0, Math.min(5, Math.round(n))));
  }

  getReviewProductLabel(review: any): string | null {
    const productoNombre =
      review?.producto?.nombre ??
      review?.productoNombre ??
      review?.nombreProducto ??
      review?.servicioNombre;

    const normalized = String(productoNombre ?? '').trim();
    return normalized || null;
  }

  getHorarioLineas(): string[] {
    const h = this.negocio?.horario;
    if (!h) return [];

    if (h.weekly && typeof h.weekly === 'object') {
      const labelByDay: Record<string, string> = {
        mon: 'Lunes',
        tue: 'Martes',
        wed: 'Miércoles',
        thu: 'Jueves',
        fri: 'Viernes',
        sat: 'Sábado',
        sun: 'Domingo',
      };

      const orderedDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      return orderedDays
        .map((dayKey) => {
          const ranges = Array.isArray(h.weekly?.[dayKey]) ? h.weekly[dayKey] : [];
          const formatted = ranges
            .map((range: unknown) => {
              if (!Array.isArray(range) || range.length < 2) {
                return '';
              }

              return `${range[0]} – ${range[1]}`;
            })
            .filter(Boolean)
            .join(' · ');

          return formatted ? `${labelByDay[dayKey]}: ${formatted}` : `${labelByDay[dayKey]}: Cerrado`;
        })
        .filter(Boolean);
    }

    if (h.apertura && h.cierre) {
      return [`Horario general: ${h.apertura} – ${h.cierre}`];
    }

    return ['Consultar horario directamente'];
  }

  getMapsUrl(): string {
    if (this.negocio?.latitud && this.negocio?.longitud) {
      return `https://www.google.com/maps?q=${this.negocio.latitud},${this.negocio.longitud}`;
    }
    const partes = [this.negocio?.direccion, this.negocio?.ciudad, this.negocio?.provincia]
      .filter(Boolean)
      .join(', ');
    return `https://www.google.com/maps/search/${encodeURIComponent(partes)}`;
  }

  getNenufarAsset(): string {
    return resolveBusinessNenufarAsset(this.negocio, DEFAULT_NENUFAR_FALLBACK_ASSET);
  }

  getBusinessCoverImage(): string {
    return resolveBusinessImage(this.negocio, {
      fallback: DEFAULT_NENUFAR_FALLBACK_ASSET,
      preferCover: true,
    });
  }

  getBusinessAvatarImage(): string {
    return resolveBusinessImage(this.negocio, {
      fallback: DEFAULT_NENUFAR_FALLBACK_ASSET,
    });
  }

  getBusinessNickname(): string {
    const nickname =
      this.negocio?.nickname ??
      this.negocio?.slug ??
      this.negocio?.dueno?.nickname ??
      this.negocioRouteKey;

    return nickname ? `@${String(nickname).trim()}` : '@negocio';
  }

  getBusinessAddressSummary(): string {
    return [
      this.negocio?.direccion,
      this.negocio?.ciudad,
      this.negocio?.provincia,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  getBusinessCategoryLabel(): string {
    const categoria = this.negocio?.categoria?.nombre || this.negocio?.categoria || 'Sin categoría';
    const subcategoria = this.negocio?.subcategoria?.nombre;
    return subcategoria ? `${categoria} · ${subcategoria}` : categoria;
  }

  getBusinessLocationLine(): string {
    return [
      this.negocio?.direccion,
      this.negocio?.ciudad,
      this.negocio?.provincia,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  getSavedNenufarAsset(): string | null {
    return (
      resolveNenufarAsset(
        this.negocio?.nenufarAsset ??
          this.negocio?.nenufarActivo ??
          this.negocio?.assetNenufar ??
          this.negocio?.imagenNenufar,
        this.nenufarOptions,
      ) ??
      resolveNenufarAsset(
        this.negocio?.nenufarKey ?? this.negocio?.nenufarColor,
        this.nenufarOptions,
      )
    );
  }

  getNenufarLabel(): string {
    const asset = this.getSavedNenufarAsset() ?? this.getNenufarAsset();
    const option = this.nenufarOptions.find((candidate) => candidate.asset === asset);
    return this.prettifyNenufarLabel(option?.label ?? 'Nenufar del negocio');
  }

  shouldShowFollowButton(): boolean {
    return !this.esDueno;
  }

  guardarNenufarDesdePerfil(value: string | null): void {
    const nenufarAsset = resolveNenufarAsset(value, this.nenufarOptions);
    if (!this.negocioId || !nenufarAsset) {
      return;
    }

    const previoAsset = this.getSavedNenufarAsset();
    const previoKey = resolveNenufarKey(previoAsset, this.nenufarOptions);
    const nenufarKey = resolveNenufarKey(nenufarAsset, this.nenufarOptions);

    this.guardandoNenufar = true;
    this.nenufarError = '';

    this.negocioService.update(this.negocioId, {
      nenufarAsset,
      nenufarKey,
    }).subscribe({
      next: (negocioActualizado) => {
        this.guardandoNenufar = false;
        this.negocio = {
          ...this.negocio,
          ...negocioActualizado,
          nenufarAsset,
          nenufarKey,
        };
      },
      error: (error: unknown) => {
        this.guardandoNenufar = false;
        this.nenufarError = getUserErrorMessage(error, 'No hemos podido actualizar el nenufar.');
        this.nenufarSelector?.markAsSaved(previoAsset);
        this.negocio = {
          ...this.negocio,
          nenufarAsset: previoAsset,
          nenufarKey: previoKey,
        };
      },
    });
  }

  abrirPromociones(): void {
    this.modalActiva.set('promociones');
  }

  abrirReservas(): void {
    this.modalActiva.set('reservas');
  }

  abrirSelectorNenufar(): void {
    this.modalActiva.set('nenufar');
  }

  cerrarModal(): void {
    this.modalActiva.set(null);
  }

  private inicializarSemanaActual(): void {
    const hoy = new Date();
    const diaActual = hoy.getDay();
    const offsetLunes = diaActual === 0 ? -6 : 1 - diaActual;
    const lunes = new Date(hoy);
    lunes.setHours(0, 0, 0, 0);
    lunes.setDate(hoy.getDate() + offsetLunes);

    this.diasSemana.forEach((dia, index) => {
      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + index);
      this.fechasSemana[dia] = fecha.toISOString().slice(0, 10);
    });
  }

  generarHorasDisponibles(): void {
    if (!this.tieneHorarioConfigurado()) {
      this.horasGeneradas = [];
      return;
    }

    const horario = this.negocio.horario;
    const paso = Number(this.negocio.intervaloReserva || horario.intervalo || 30);

    let apertura = horario.apertura;
    let cierre = horario.cierre;

    if (!apertura || !cierre) {
      const ranges = Object.values(horario.weekly ?? {}).flat() as [string, string][];
      if (ranges.length > 0) {
        apertura = ranges[0][0];
        cierre = ranges[ranges.length - 1][1];
      }
    }

    if (!apertura || !cierre) return;

    const [hStart, mStart] = apertura.split(':').map(Number);
    const [hEnd, mEnd] = cierre.split(':').map(Number);
    const start = hStart * 60 + mStart;
    const end = hEnd * 60 + mEnd;

    const horas: string[] = [];
    for (let t = start; t < end; t += paso) {
      const h = Math.floor(t / 60).toString().padStart(2, '0');
      const m = (t % 60).toString().padStart(2, '0');
      horas.push(`${h}:${m}`);
    }

    this.horasGeneradas = horas;
    this.diasSemana.forEach(dia => this.reservasOcupadas[dia] = []);
  }

  recargarReservas(): void {
    if (!this.negocioId || !this.horasGeneradas.length) {
      this.diasSemana.forEach(dia => this.reservasOcupadas[dia] = []);
      return;
    }

    const requests = this.diasSemana.map((dia) =>
      this.reservaService
        .availability(this.negocioId, this.fechasSemana[dia])
        .pipe(
          catchError((error: unknown) => {
            this.reservaError = getUserErrorMessage(error, 'No hemos podido cargar toda la disponibilidad.');
            return of({ date: this.fechasSemana[dia], intervalo: this.negocio?.intervaloReserva || 30, slots: [] });
          }),
        ),
    );

    forkJoin(requests).subscribe((responses) => {
      responses.forEach((response, index) => {
        const dia = this.diasSemana[index];
        const disponibles = response.slots.map((slot) =>
          new Date(slot).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }),
        );
        this.reservasOcupadas[dia] = this.horasGeneradas.filter((hora) => !disponibles.includes(hora));
      });
    });
  }

  verificarPropietario(): void {
    this.esDueno = Boolean(this.negocio);
    this.actualizarAccesosGestion();
  }

  private actualizarAccesosGestion(): void {
    this.puedeGestionarReservas =
      this.esDueno && (Boolean(this.negocio?.aceptaReservas) || this.tieneHorarioConfigurado());
  }

  tieneHorarioConfigurado(): boolean {
    const horario = this.negocio?.horario;
    if (!horario) return false;
    if (horario.apertura && horario.cierre) return true;
    return Object.values(horario.weekly ?? {}).flat().length > 0;
  }

  abrirModalResena(): void { this.modalAbierto = true; }

  getUsuarioRoute(usuario: { id?: number | null } | null | undefined): (string | number)[] | null {
    const usuarioId = Number(usuario?.id);
    return Number.isFinite(usuarioId) && usuarioId > 0 ? ['/usuario', usuarioId] : null;
  }

  private cargarNegocio(): void {
    if (!this.negocioId) {
      return;
    }

    this.negocioService.getNegocioById(this.negocioId).subscribe({
      next: (data: any) => {
        this.errorMensaje = '';
        this.negocio = data;
        this.negocioId = data.id;
        this.negocioRouteKey = String(data.id);
        this.refrescarResenas();
        this.cargarSeguimiento();
        this.generarHorasDisponibles();
        this.verificarPropietario();
        this.actualizarAccesosGestion();
        this.cargarSeguidosPropios();
        this.recargarReservas();
      },
      error: (error: unknown) => {
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido cargar el negocio.');
      },
    });
  }

  refrescarResenas(): void {
    if (!this.negocioId) return;
    this.negocioService.getResenasNegocio(this.negocioId).subscribe({
      next: (res) => {
        const reviews = Array.isArray(res) ? (res as Array<{ puntuacion?: number }>) : [];
        this.resenas = reviews;
        if (reviews.length > 0) {
          const suma = reviews.reduce((acc, review) => acc + (review.puntuacion || 0), 0);
          this.mediaPuntuacion = Math.round((suma / reviews.length) * 10) / 10;
        } else {
          this.mediaPuntuacion = 0;
        }
      },
      error: (error: unknown) => {
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido actualizar las reseñas.');
      },
    });
  }

  cargarSeguimiento(): void {
    if (!this.negocioId) {
      return;
    }

    this.negocioService.getSeguidoresNegocio(this.negocioId).subscribe({
      next: (response) => {
        this.seguidoresTotal = Number(response.total ?? 0) || 0;
        this.siguiendoNegocio = Boolean(response.actorSiguiendo);
      },
      error: () => {
        this.seguidoresTotal = Number(this.negocio?.followersCount ?? 0) || 0;
        this.siguiendoNegocio = Boolean(this.negocio?.isFollowing ?? this.negocio?.isFollowedByMe);
      },
    });
  }

  alternarSeguimiento(): void {
    if (this.esDueno || !this.negocioId) {
      return;
    }

    if (!this.authService.isAuthenticated()) {
      this.accessModalMensaje = 'Necesitas iniciar sesion para seguir este negocio.';
      this.accessModalAbierto = true;
      return;
    }

    const followingNext = !this.siguiendoNegocio;
    const request$ = this.siguiendoNegocio
      ? this.negocioService.dejarDeSeguirNegocio(this.negocioId)
      : this.negocioService.seguirNegocio(this.negocioId);

    request$.subscribe({
      next: (response) => {
        this.siguiendoNegocio = !this.siguiendoNegocio;
        this.seguidoresTotal = Number(response.total ?? this.seguidoresTotal) || 0;

        if (followingNext && this.negocio?.id) {
          const activar = confirm(`¿Quieres recibir notificaciones de ${this.negocio.nombre}?`);
          if (!activar) {
            this.negocioService
              .toggleNotificacionesSeguimiento(this.negocio.id, false)
              .pipe(catchError(() => of({ activas: false })))
              .subscribe();
          }
        }
      },
      error: (error: unknown) => {
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido actualizar el seguimiento.');
      },
    });
  }

  confirmarReserva(dia: string, hora: string): void {
    if (!this.authService.isAuthenticated()) {
      this.accessModalMensaje = 'Necesitas iniciar sesion para reservar en este negocio.';
      this.accessModalAbierto = true;
      return;
    }

    const ok = confirm(`¿Reservar el ${dia} a las ${hora}?`);
    if (!ok) return;

    const fechaBase = this.fechasSemana[dia];
    if (!fechaBase) { this.reservaError = 'No hemos podido calcular la fecha de la reserva.'; return; }

    const fecha = new Date(`${fechaBase}T${hora}:00`);
    this.reservaError = '';
    this.reservaService.crearReserva({
      negocioId: this.negocio.id,
      fecha: fecha.toISOString(),
      nota: '',
    }).subscribe({
      next: () => {
        alert(`✅ ¡Reserva confirmada en ${this.negocio.nombre} a las ${hora}!`);
        this.recargarReservas();
      },
      error: (error: unknown) => {
        this.reservaError = getUserErrorMessage(error, 'Hubo un problema al hacer la reserva.');
      },
    });
  }

  alternarTicketScanner(): void {
    this.ticketScannerAbierto = !this.ticketScannerAbierto;
    if (this.ticketScannerAbierto) {
      this.ticketScannerMensaje = '';
    }
  }

  onTicketScannerSaved(result: TicketScannerSubmitResult): void {
    const total = Number(result.total || 0).toFixed(2);
    this.ticketScannerMensaje =
      result.pago
        ? `Compra creada correctamente por ${total} €. Ya aparece asociada a tu cuenta en ${this.negocio?.nombre || 'este negocio'}.`
        : `Compra creada correctamente por ${total} €.`;
    this.ticketScannerAbierto = false;
  }

  volver(): void { void this.router.navigate(['/inicio']); }

  irALogin(): void {
    this.accessModalAbierto = false;
    void this.router.navigate(['/estanque']);
  }

  irALogosNenufar(): void {
    void this.router.navigate(['/logos-nenufar']);
  }

  irAEditarNegocio(): void {
    void this.router.navigate(['/mi-negocio/editar']);
  }

  irADashboardNegocio(): void {
    void this.router.navigate(['/mi-negocio/dashboard']);
  }

  irAReservasNegocio(): void {
    void this.router.navigate(['/mi-negocio/reservas']);
  }

  private cargarSeguidosPropios(): void {
    if (!this.esDueno) {
      this.seguidosTotal = 0;
      return;
    }

    this.negocioService.listSeguidos().subscribe({
      next: (negocios) => {
        this.seguidosTotal = negocios.length;
      },
      error: () => {
        this.seguidosTotal = 0;
      },
    });
  }

  private scrollToSection(sectionId: string): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  private prettifyNenufarLabel(label: string): string {
    return label.replace(/^Nenufar\b/, 'Nenúfar');
  }
}
