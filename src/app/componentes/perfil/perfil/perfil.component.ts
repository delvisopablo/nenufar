import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReservaService } from '../../../servicios/reservaService/reserva.service';
import { ResenaService } from '../../../servicios/reviewServicio/resena.service';
import { AuthService } from '../../../servicios/authService/auth.service';
import { UsuarioServiceService } from '../../../servicios/usuarioServicio/usuarioService.service';

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
    private authService: AuthService,
    private usuarioService: UsuarioServiceService,
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
    if (!user?.id) return;

    const negocioActualizado =
      user.rol === 'negocio'
        ? {
            ...(user.negocio || {}),
            horario: {
              apertura: this.nuevoHorario.apertura,
              cierre: this.nuevoHorario.cierre,
            },
          }
        : user.negocio;

    this.usuarioService.updatePerfil(user.id, {
      biografia: this.nuevaBio,
    }).subscribe({
      next: (response) => {
        const usuarioActualizado = {
          ...user,
          ...response,
          foto_perfil:
            response.foto_perfil ??
            response.foto ??
            user.foto_perfil,
          negocio: negocioActualizado ?? response.negocios?.[0] ?? user.negocio,
        };

        this.authService.guardarUsuario(usuarioActualizado);
        this.usuarioLogueado.set(usuarioActualizado);
        this.nuevaBio = usuarioActualizado.biografia || '';
        this.modoEdicion.set(false);
      },
      error: (err: unknown) => console.error('Error al guardar perfil:', err),
    });
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
