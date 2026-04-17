import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { CrearResenaModalComponent } from '../crear-resena/crear-resena-modal/crear-resena-modal.component';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { buildApiUrl } from '../../config/api.config';

type AvailabilityResponse = {
  date: string;
  intervalo: number;
  slots: string[];
};

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
  modalAbierto: boolean = false;
  usuarioActual: any = JSON.parse(
    localStorage.getItem('usuarioLogueado') ||
      localStorage.getItem('usuario') ||
      'null',
  );
  mediaPuntuacion: number = 0;
  resenas: any[] = [];
  negocioId!: number;

  diasSemana: string[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  horasGeneradas: string[] = [];
  reservasOcupadas: { [dia: string]: string[] } = {};
  private fechasSemana: Record<string, string> = {};


  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.inicializarSemanaActual();
    this.negocioId = +id;
    this.http.get(buildApiUrl(`/negocios/${id}`)).subscribe((data: any) => {
      this.negocio = data;
      this.negocioId = data.id;
      this.refrescarResenas();
      if (data?.dueno && this.usuarioActual?.id) {
        this.esDueno = this.usuarioActual.id === data.dueno.id;
      } else {
        this.esDueno = false;
      }
      this.generarHorasDisponibles();
      this.verificarPropietario();
      this.recargarReservas();
    });

    this.http.get<any[]>(buildApiUrl(`/negocios/${id}/resenas`)).subscribe((data) => {
      this.resenas = data;
      if (data.length > 0) {
        const suma = data.reduce((acc, r) => acc + r.puntuacion, 0);
        this.mediaPuntuacion = Math.round((suma / data.length) * 10) / 10;
      }
    });
  }

  private inicializarSemanaActual() {
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

 generarHorasDisponibles() {
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

  // Inicializa reservas vacías
  this.diasSemana.forEach(dia => this.reservasOcupadas[dia] = []);
}

recargarReservas() {
  if (!this.negocioId || !this.horasGeneradas.length) {
    this.diasSemana.forEach(dia => this.reservasOcupadas[dia] = []);
    return;
  }

  const requests = this.diasSemana.map((dia) =>
    this.http
      .get<AvailabilityResponse>(
        buildApiUrl(`/negocios/${this.negocioId}/availability?date=${this.fechasSemana[dia]}`),
      )
      .pipe(
        catchError((err) => {
          console.error(`Error cargando disponibilidad para ${dia}:`, err);
          return of({
            date: this.fechasSemana[dia],
            intervalo: this.negocio?.intervaloReserva || 30,
            slots: [],
          });
        }),
      ),
  );

  forkJoin(requests).subscribe((responses) => {
    responses.forEach((response, index) => {
      const dia = this.diasSemana[index];
      const disponibles = response.slots.map((slot) =>
        new Date(slot).toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      );

      this.reservasOcupadas[dia] = this.horasGeneradas.filter(
        (hora) => !disponibles.includes(hora),
      );
    });
  });
}


  verificarPropietario() {
    if (!this.usuarioActual || !this.negocio) return;
    this.esDueno = this.usuarioActual.id === this.negocio.duenoId;
  }

  abrirModalResena() {
    this.modalAbierto = true;
  }

  cerrarModalResena() {
    this.modalAbierto = false;
  }

 refrescarResenas() {
  if (!this.negocioId) return;
  this.http.get<any[]>(buildApiUrl(`/negocios/${this.negocioId}/resenas`)).subscribe({
    next: (res) => {
      this.resenas = res;
      console.log("🔁 Reseñas actualizadas:", res);

      if (res.length > 0) {
        const suma = res.reduce((acc, r) => acc + (r.puntuacion || 0), 0);
        this.mediaPuntuacion = Math.round((suma / res.length) * 10) / 10;
      } else {
        this.mediaPuntuacion = 0;
      }
    },
    error: (err) => {
      console.error("❌ Error al cargar reseñas:", err);
    }
  });
}

verPerfilUsuario(id: number) {
  if (id) this.router.navigate(['/perfil', id]);
}

  confirmarReserva(dia: string, hora: string) {
  const ok = confirm(`¿Reservar el ${dia} a las ${hora}?`);
  if (!ok) return;

  const fechaBase = this.fechasSemana[dia];
  if (!fechaBase) {
    alert('No hemos podido calcular la fecha de la reserva.');
    return;
  }

  const fecha = new Date(`${fechaBase}T${hora}:00`);
  this.http.post(buildApiUrl(`/negocios/${this.negocio.id}/reservas`), {
    fecha: fecha.toISOString(),
  }).subscribe({
    next: () => {
      alert(`✅ ¡Reserva confirmada en ${this.negocio.nombre} a las ${hora}!`);
      this.recargarReservas(); // vuelve a cargar datos si quieres actualizar
    },
    error: (err) => {
      console.error('Error al reservar:', err);
      alert('❌ Hubo un problema al hacer la reserva');
    }
  });
}



 irAEditarNegocio() {
  if (this.negocio?.id) {
    this.router.navigate(['/negocio-editar', this.negocio.id]);
  } else {
    console.warn('Negocio no cargado todavía');
  }
}

volver() {
  this.router.navigateByUrl('/inicio'); // o usa location.back()
}

}
