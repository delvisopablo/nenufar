import { provideHttpClient } from '@angular/common/http';
import { Component, OnInit, signal, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservaService } from '../../../servicios/reservaService/reserva.service';
import { HttpClient } from '@angular/common/http';
import { ResenaService } from '../../../servicios/reviewServicio/resena.service';



@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  usuarioLogueado = signal<any | null>(null);
  modoEdicion = signal(false);

  reservas = signal<any[]>([]);

  resenas = signal<any[]>([]);

constructor(
  private http: HttpClient,
  private reservaService: ReservaService,
  private resenaService: ResenaService
) {}


  nuevaBio = '';
  nuevoHorario = { apertura: '', cierre: '' };

  abrirFormularioReserva = false;
nuevaReserva = { fecha: '', nota: '' };


  ngOnInit(): void {
  const datos = localStorage.getItem('usuarioLogueado');
  if (datos) {
    const user = JSON.parse(datos);
    this.usuarioLogueado.set(user);
    this.nuevaBio = user.biografia || '';

    if (user.rol === 'negocio') {
      this.nuevoHorario.apertura = user.negocio?.horario?.apertura || '';
      this.nuevoHorario.cierre = user.negocio?.horario?.cierre || '';
    }

    // 📦 Cargar reseñas del usuario
    this.resenaService.getResenasPorUsuario(user.id).subscribe({
  next: (res: any[]) => {
    this.resenas.set(res);
    console.log("🟢 Reseñas del usuario:", res);
  },
  error: (err: any) => {
    console.error('❌ Error al cargar reseñas de usuario:', err);
  }
});

    // 📅 Cargar reservas del usuario
    this.reservaService.reservasPorUsuario(user.id).subscribe({
      next: (res: any) => this.reservas.set(res),
      error: (err: any) => console.error('Error al cargar reservas', err)

    });
  }
}


  hacerReserva() {
  const user = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
  const negocioId = this.usuarioLogueado()?.negocio?.id || this.usuarioLogueado()?.id;

  this.reservaService.crear({
    fecha: this.nuevaReserva.fecha,
    nota: this.nuevaReserva.nota,
    negocioId: negocioId,
    usuarioId: user.id
  }).subscribe({
    next: (res: any) => {
      alert('✅ Reserva creada!');
      this.abrirFormularioReserva = false;
      this.nuevaReserva = { fecha: '', nota: '' };
    },
    error: (err: any) => {
      console.error('❌ Error reserva:', err);
      alert('Error al crear reserva');
    }
  });
}
  guardarCambios() {
    const user = this.usuarioLogueado();

    // Actualiza campos editables:
    user.biografia = this.nuevaBio;

    if (user.rol === 'negocio') {
      user.negocio.horario = {
        apertura: this.nuevoHorario.apertura,
        cierre: this.nuevoHorario.cierre
      };
    }

    // Guarda y refresca:
    localStorage.setItem('usuarioLogueado', JSON.stringify(user));
    this.usuarioLogueado.set(user);
    this.modoEdicion.set(false);
  }
}
