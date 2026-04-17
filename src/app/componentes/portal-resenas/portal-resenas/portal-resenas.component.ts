import { Component, OnInit, inject, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../servicios/authService/auth.service';
import { buildApiUrl } from '../../../config/api.config';

interface Reseña {
  contenido: string;
  puntuacion: number;
  negocioId: number;
  fecha: string;
}

@Component({
  selector: 'app-portal-resenas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portal-resenas.component.html',
  styleUrl: './portal-resenas.component.css'
})
export class PortalReseñasComponent implements OnInit {
  // ✅ Dependencias
  http = inject(HttpClient);
  auth = inject(AuthService);
  @Input() refrescar: number = 0;
  @Input() resenas: any[] = [];

  // ✅ Estado
  paginaActual = signal(1);
  resenasPorPagina = 5;
  reseñas = signal<any[]>([]);
  // ✅ Cargar reseñas del usuario logueado

  ngOnChanges() {
  this.cargarReseñasGlobales(); // o lo que sea que haga el fetch
}
  ngOnInit() {
     this.cargarReseñasGlobales();

  try {
    const userRaw = localStorage.getItem('usuarioLogueado');
    if (!userRaw) throw new Error('Usuario no logueado');

    const user = JSON.parse(userRaw);
    if (!user.id || typeof user.id !== 'number') {
      throw new Error('ID de usuario inválido');
    }

    const url = buildApiUrl('/resena/ultimas');
    this.http.get<Reseña[]>(url).subscribe({
      next: (data) => this.reseñas.set(data),
      error: (err) => console.error('❌ Error cargando reseñas:', err)
    });
  } catch (err) {
    console.error('❌ Error en ngOnInit portal-resenas:', err);
  }
}

cargarReseñasGlobales() {
    this.http.get(buildApiUrl('/resena/ultimas'))
      .subscribe({
        next: (res: any) => {
          this.reseñas.set(res);
        },
        error: (err) => {
          console.error('❌ Error cargando reseñas globales:', err);
        }
      });
  }


  // ✅ Computada para paginar
  resenasPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.resenasPorPagina;
    return this.reseñas().slice(inicio, inicio + this.resenasPorPagina);
  });

  // ✅ Navegación
  siguientePagina() {
    const totalPaginas = Math.ceil(this.reseñas().length / this.resenasPorPagina);
    if (this.paginaActual() < totalPaginas) {
      this.paginaActual.update(v => v + 1);
    }
  }

  anteriorPagina() {
    if (this.paginaActual() > 1) {
      this.paginaActual.update(v => v - 1);
    }
  }
}
