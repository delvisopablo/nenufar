import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { CrearResenaModalComponent } from '../crear-resena/crear-resena-modal/crear-resena-modal.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { buildApiUrl } from '../../config/api.config';
import { getUserErrorMessage } from '../../core/errors/error-parser';

type AvailabilityResponse = {
  date: string;
  intervalo: number;
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
  imports: [CommonModule, CrearResenaModalComponent, RouterLink],
  templateUrl: './perfil-negocio.component.html',
  styleUrl: './perfil-negocio.component.css'
})
export class PerfilNegocioComponent implements OnInit {
  negocio: any = null;
  esPropietario = false;
  horasDisponibles: string[] = [];
  esDueno = false;
  slots: string[] = [];
  modalAbierto = false;
  usuarioActual: any = readStoredUser();
  mediaPuntuacion = 0;
  resenas: any[] = [];
  negocioId!: number;
  errorMensaje = '';
  reservaError = '';
  puedeGestionarReservas = false;
  mensajeReservasConfiguracion = 'Configura primero tu horario para gestionar reservas.';

  diasSemana: string[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  horasGeneradas: string[] = [];
  reservasOcupadas: { [dia: string]: string[] } = {};
  private fechasSemana: Record<string, string> = {};
  private readonly authOptions = { withCredentials: true };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.inicializarSemanaActual();
    this.negocioId = +id;

    this.http.get(buildApiUrl(`/negocios/${id}`), this.authOptions).subscribe({
      next: (data: any) => {
        this.errorMensaje = '';
        this.negocio = data;
        this.negocioId = data.id;
        this.refrescarResenas();
        this.esDueno = !!this.usuarioActual?.id && this.usuarioActual.id === data.dueno?.id;
        this.generarHorasDisponibles();
        this.verificarPropietario();
        this.actualizarAccesosGestion();
        this.recargarReservas();
      },
      error: (error: unknown) => {
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido cargar el negocio.');
      },
    });

    this.http.get<any[]>(buildApiUrl(`/negocios/${id}/resenas`), this.authOptions).subscribe({
      next: (data) => {
        this.resenas = data;
        if (data.length > 0) {
          const suma = data.reduce((acc, r) => acc + r.puntuacion, 0);
          this.mediaPuntuacion = Math.round((suma / data.length) * 10) / 10;
        }
      },
      error: (error: unknown) => {
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido cargar las reseñas.');
      },
    });
  }

  getStars(n: number): string {
    return '⭐'.repeat(Math.max(0, Math.min(5, Math.round(n))));
  }

  getHorarioLineas(): string[] {
    const h = this.negocio?.horario;
    if (!h) return [];

    if (h.apertura && h.cierre) {
      return [`${h.apertura} – ${h.cierre}`];
    }

    if (h.weekly && typeof h.weekly === 'object') {
      return Object.entries(h.weekly).map(([dia, rango]: [string, any]) => {
        const r = Array.isArray(rango) ? rango.join(' – ') : String(rango);
        return `${dia}: ${r}`;
      });
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
    if (!this.negocio?.horario) return;
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
      this.http
        .get<AvailabilityResponse>(
          buildApiUrl(`/negocios/${this.negocioId}/availability?date=${this.fechasSemana[dia]}`),
          this.authOptions,
        )
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
    if (!this.usuarioActual || !this.negocio) return;
    this.esDueno = this.usuarioActual.id === this.negocio.duenoId;
    this.actualizarAccesosGestion();
  }

  private actualizarAccesosGestion(): void {
    this.puedeGestionarReservas =
      this.esDueno && (Boolean(this.negocio?.aceptaReservas) || this.tieneHorarioConfigurado());
  }

  private tieneHorarioConfigurado(): boolean {
    const horario = this.negocio?.horario;
    if (!horario) return false;
    if (horario.apertura && horario.cierre) return true;
    return Object.values(horario.weekly ?? {}).flat().length > 0;
  }

  abrirModalResena(): void { this.modalAbierto = true; }

  refrescarResenas(): void {
    if (!this.negocioId) return;
    this.http.get<any[]>(buildApiUrl(`/negocios/${this.negocioId}/resenas`), this.authOptions).subscribe({
      next: (res) => {
        this.resenas = res;
        if (res.length > 0) {
          const suma = res.reduce((acc, r) => acc + (r.puntuacion || 0), 0);
          this.mediaPuntuacion = Math.round((suma / res.length) * 10) / 10;
        } else {
          this.mediaPuntuacion = 0;
        }
      },
      error: (error: unknown) => {
        this.errorMensaje = getUserErrorMessage(error, 'No hemos podido actualizar las reseñas.');
      },
    });
  }

  confirmarReserva(dia: string, hora: string): void {
    const ok = confirm(`¿Reservar el ${dia} a las ${hora}?`);
    if (!ok) return;

    const fechaBase = this.fechasSemana[dia];
    if (!fechaBase) { this.reservaError = 'No hemos podido calcular la fecha de la reserva.'; return; }

    const fecha = new Date(`${fechaBase}T${hora}:00`);
    this.reservaError = '';
    this.http.post(buildApiUrl(`/negocios/${this.negocio.id}/reservas`), { fecha: fecha.toISOString() }, this.authOptions).subscribe({
      next: () => {
        alert(`✅ ¡Reserva confirmada en ${this.negocio.nombre} a las ${hora}!`);
        this.recargarReservas();
      },
      error: (error: unknown) => {
        this.reservaError = getUserErrorMessage(error, 'Hubo un problema al hacer la reserva.');
      },
    });
  }

  volver(): void { this.router.navigateByUrl('/inicio'); }
  irAEditarNegocio(): void { if (this.negocio?.id) this.router.navigate(['/negocio-editar', this.negocio.id]); }
  irADashboardNegocio(): void { if (this.negocio?.id) void this.router.navigate(['/negocios', this.negocio.id, 'dashboard']); }
  irAReservasNegocio(): void { if (this.puedeGestionarReservas && this.negocio?.id) void this.router.navigate(['/negocios', this.negocio.id, 'reservas']); }
}
