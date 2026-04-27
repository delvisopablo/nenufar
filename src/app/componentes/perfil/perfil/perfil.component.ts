import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ReservaService } from '../../../servicios/reservaService/reserva.service';
import { ResenaService } from '../../../servicios/reviewServicio/resena.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  usuarioLogueado = signal<any | null>(null);
  modoEdicion = signal(false);
  reservas = signal<any[]>([]);
  resenas = signal<any[]>([]);

  nuevaBio = '';
  nuevoHorario = { apertura: '', cierre: '' };
  abrirFormularioReserva = false;
  nuevaReserva = { fecha: '', nota: '' };

  constructor(
    private http: HttpClient,
    private reservaService: ReservaService,
    private resenaService: ResenaService,
  ) {}

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

      this.resenaService.getResenasPorUsuario(user.id).subscribe({
        next: (res: any[]) => this.resenas.set(res),
        error: (err: any) => console.error('Error al cargar reseñas de usuario:', err),
      });

      this.reservaService.reservasPorUsuario(user.id).subscribe({
        next: (res: any) => this.reservas.set(res),
        error: (err: any) => console.error('Error al cargar reservas', err),
      });
    }
  }

  getStars(n: number): string {
    return '⭐'.repeat(Math.max(0, Math.min(5, Math.round(n))));
  }

  guardarCambios(): void {
    const user = this.usuarioLogueado();
    if (!user) return;

    user.biografia = this.nuevaBio;

    if (user.rol === 'negocio') {
      user.negocio.horario = {
        apertura: this.nuevoHorario.apertura,
        cierre: this.nuevoHorario.cierre,
      };
    }

    localStorage.setItem('usuarioLogueado', JSON.stringify(user));
    this.usuarioLogueado.set({ ...user });
    this.modoEdicion.set(false);
  }

  hacerReserva(): void {
    const user = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
    const negocioId = this.usuarioLogueado()?.negocio?.id || this.usuarioLogueado()?.id;

    this.reservaService.crear({
      fecha: this.nuevaReserva.fecha,
      nota: this.nuevaReserva.nota,
      negocioId,
      usuarioId: user.id,
    }).subscribe({
      next: () => {
        this.abrirFormularioReserva = false;
        this.nuevaReserva = { fecha: '', nota: '' };
      },
      error: (err: any) => console.error('Error reserva:', err),
    });
  }
}
