import { Component, inject, signal, ViewChild } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MenuComponent } from '../menu/menu/menu.component';
import { CommonModule } from '@angular/common';
import { CrearResenaModalComponent } from '../crear-resena/crear-resena-modal/crear-resena-modal.component';
import { PortalReseñasComponent } from '../portal-resenas/portal-resenas/portal-resenas.component';
import { ResenaService } from '../../servicios/reviewServicio/resena.service';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-principal',
  standalone: true,
  imports: [CrearResenaModalComponent, CommonModule, FormsModule],
  templateUrl: './principal.component.html',
  styleUrl: './principal.component.css'
})
export class PrincipalComponent {
  private http = inject(HttpClient);
  private router = inject(Router);

  @ViewChild(PortalReseñasComponent) portalReseñasComponent!: PortalReseñasComponent;

  // ⚡️ Reactive stores
  reseñas = signal<any[]>([]);
  negocios = signal<any[]>([]);
  promociones = signal<any[]>([]);
  usuarioLogueado = signal<any | null>(null);
  actualizacionResenas = 0;
  mediaPuntuacion: number = 0;

  modalAbierto = false;
  idUsuario: string = '';
  modalAyudaAbierto = false;
mensajeAyuda = '';

  constructor(private ResenaService: ResenaService, private route: ActivatedRoute) {}


  ngOnInit() {
    // ✅ Cargar reseñas mock si no existen
        // this.autenticarToken();
      this.idUsuario = this.route.snapshot.paramMap.get('id') || '';

    this.cargarResenas();
    const local = localStorage.getItem('reseñas');
    if (!local) {
      localStorage.setItem('reseñas', JSON.stringify([]));
    }
    this.reseñas.set(JSON.parse(localStorage.getItem('reseñas') || '[]'));

    // ✅ Cargar user logueado
   const userRaw = localStorage.getItem('usuarioLogueado');
    if (userRaw) {
      const user = JSON.parse(userRaw);
      this.usuarioLogueado.set(userRaw);
      console.log('Usuario logueado cargado:', this.usuarioLogueado());
      if (user?.id && typeof user.id === 'number') {
        this.usuarioLogueado.set(user);
      } else {
        console.warn('❗️ Usuario sin ID válido');
      }
    } else {
      console.warn('❗️ No hay usuario logueado');
    }




    // ✅ Cargar negocios y promociones del backend
    this.http.get('http://localhost:3000/negocio').subscribe(data => this.negocios.set(data as any[]));
    this.http.get('http://localhost:3000/promociones/activas').subscribe(data => this.promociones.set(data as any[]));
  }

  // ✅ Crear reseña: guardar local + enviar a backend
  anadirResena(resena: any) {
    // 1️⃣ Local storage para mock rápido
    this.reseñas.update(prev => [resena, ...prev]);
    const todas = JSON.parse(localStorage.getItem('reseñas') || '[]');
    todas.unshift(resena);
    localStorage.setItem('reseñas', JSON.stringify(todas));

    // 2️⃣ Mandar al backend real (ajusta la URL si es '/api/resenas')
    this.http.post('http://localhost:3000/resena', resena).subscribe({
      next: (res) => console.log('✅ Resena guardada backend:', res),
      error: (err) => console.error('❌ Error enviando reseña:', err)
    });
  }

actualizarResenas() {
    this.actualizacionResenas++;
    console.log('🔄 Actualizando reseñas, recargando...');
  this.cargarResenas(); // tu método para hacer GET /resena/ultimas
}

enviarAyuda() {
  const idUsuario = JSON.parse(localStorage.getItem('usuario') || '{}')?.id;
  if (!this.mensajeAyuda.trim()) return alert("Mensaje vacío");

  const cuerpo = {
    usuarioId: idUsuario,
    mensaje: this.mensajeAyuda
  };

  this.http.post('http://localhost:3000/ayuda', cuerpo).subscribe({
    next: () => {
      alert("Gracias por tu mensaje. ¡Lo revisaremos!");
      this.modalAyudaAbierto = false;
      this.mensajeAyuda = '';
    },
    error: (e) => {
      alert("Error al enviar mensaje.");
      console.error("❌ Error ayuda:", e);
    }
  });
}

cargarResenas() {
    this.ResenaService.obtenerUltimas().subscribe({
      next: (data) => {
        this.reseñas.set(data);
        console.log('🔁 Últimas reseñas cargadas:', data);
      },
      error: (err) => {
        console.error('❌ Error al cargar reseñas:', err);
      }
    });
  }

  calcularMediaPorNegocio(idNegocio: number): number {
  const reseñasNegocio = this.reseñas().filter(r => r.negocioId === idNegocio);
  if (reseñasNegocio.length === 0) return 0;

  const suma = reseñasNegocio.reduce((acc, r) => acc + Number(r.puntuacion), 0);
  return Math.round((suma / reseñasNegocio.length) * 10) / 10; // redondeo a un decimal
}


refrescarResenas() {
  this.actualizarResenas();
}

verNegocio(id: number) {
  this.router.navigate(['/negocio', id]);
}

irAMiPerfil() {
  const idUsuario = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}')?.id;
  if (idUsuario) {
    this.router.navigate(['/perfil', idUsuario]);
  } else {
    alert("No estás logueado.");
  }
}

//   autenticarToken() {
//     const token = localStorage.getItem('token');

// this.http.get('http://localhost:3000/ruta-protegida', {
//   headers: {
//     Authorization: `Bearer ${token}`
//   }
// }).subscribe({
//   next: (res) => {
//     console.log('✅ Token autenticado:', res);
//   },
//   error: (err) => {
//     console.error('❌ Error al autenticar token:', err);
//   }
// });
//   }

  abrirModal() {
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
  }


  // irAPerfil(id:number) {
  //   this.router.navigate(['/perfil', id]);
  // }
}
