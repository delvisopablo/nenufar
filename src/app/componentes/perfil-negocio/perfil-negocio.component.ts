import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { CrearResenaModalComponent } from '../crear-resena/crear-resena-modal/crear-resena-modal.component';
import { RouterLink } from '@angular/router';

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
  usuarioActual: any = JSON.parse(localStorage.getItem('usuario')!);
  mediaPuntuacion: number = 0;
  resenas: any[] = [];
  negocioId!: number;

  diasSemana: string[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  horasGeneradas: string[] = [];
  reservasOcupadas: { [dia: string]: string[] } = {};


  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.negocioId = +id;
    this.http.get(`http://localhost:3000/negocio/${id}`).subscribe((data: any) => {
      this.negocio = data;
      this.negocioId = data.id;
      this.refrescarResenas();
      if (data?.dueño && this.usuarioActual?.id) {
        this.esDueno = this.usuarioActual.id === data.dueño.id;
      } else {
        this.esDueno = false;
      }
      this.generarHorasDisponibles();
      this.verificarPropietario();
    });

    this.http.get<any[]>(`http://localhost:3000/resena/negocio/${id}`).subscribe((data) => {
      this.resenas = data;
      if (data.length > 0) {
        const suma = data.reduce((acc, r) => acc + r.puntuacion, 0);
        this.mediaPuntuacion = Math.round((suma / data.length) * 10) / 10;
      }
    });

    this.recargarReservas();

  }

 generarHorasDisponibles() {
  if (!this.negocio?.horario) return;
  const { apertura, cierre, intervalo } = this.negocio.horario;
  const [hStart, mStart] = apertura.split(':').map(Number);
  const [hEnd, mEnd] = cierre.split(':').map(Number);
  const start = hStart * 60 + mStart;
  const end = hEnd * 60 + mEnd;
  const paso = +intervalo || 30;

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
  this.http.get<any[]>(`http://localhost:3000/reserva/negocio/${this.negocioId}`).subscribe({
    next: (data) => {
      // Inicializa estructura
      this.diasSemana.forEach(dia => this.reservasOcupadas[dia] = []);

      data.forEach(res => {
        if (this.diasSemana.includes(res.dia)) {
          this.reservasOcupadas[res.dia].push(res.hora);
        }
      });
    },
    error: (err) => console.error('Error cargando reservas:', err)
  });
}


  verificarPropietario() {
    if (!this.usuarioActual || !this.negocio) return;
    this.esDueno = this.usuarioActual.id === this.negocio.usuarioId;
  }

  abrirModalResena() {
    this.modalAbierto = true;
  }

  cerrarModalResena() {
    this.modalAbierto = false;
  }

 refrescarResenas() {
  if (!this.negocioId) return;
  this.http.get<any[]>(`http://localhost:3000/resena/negocio/${this.negocioId}`).subscribe({
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


  reservar(slot: string) {
    const payload = {
      usuarioId: this.usuarioActual.id,
      negocioId: this.negocioId,
      fecha: slot,
    };
    this.http.post(`http://localhost:3000/reserva`, payload).subscribe({
      next: () => alert('Reserva hecha'),
      error: (err) => console.error('Error al reservar:', err)
    });
  }

  confirmarReserva(dia: string, hora: string) {
  const ok = confirm(`¿Reservar el ${dia} a las ${hora}?`);
  if (!ok) return;

  const body = {
    negocioId: this.negocio.id,
    usuarioId: this.usuarioActual.id,
    dia,
    hora
  };

  this.http.post('http://localhost:3000/reserva', body).subscribe({
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
