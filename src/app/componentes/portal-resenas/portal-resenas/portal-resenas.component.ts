import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Reseña {
  autor: string;
  negocio: string;
  comentario: string;
  valoracion: number;
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
  todasResenas: Reseña[] = [];
  paginaActual = 1;
  resenasPorPagina = 10;

  ngOnInit(): void {
    const reseñasGuardadas = localStorage.getItem('reseñas');
    if (reseñasGuardadas) {
      this.todasResenas = JSON.parse(reseñasGuardadas);
    } else {
      this.todasResenas = []; // o mostrar un mensaje si no hay nada
    }
  }
  guardarResenas() {
    localStorage.setItem('reseñas', JSON.stringify(this.todasResenas));
  }  

  get resenasPaginadas(): Reseña[] {
    const inicio = (this.paginaActual - 1) * this.resenasPorPagina;
    const fin = inicio + this.resenasPorPagina;
    return this.todasResenas.slice(inicio, fin);
  }

  siguientePagina() {
    if ((this.paginaActual * this.resenasPorPagina) < this.todasResenas.length) {
      this.paginaActual++;
    }
  }

  anteriorPagina() {
    if (this.paginaActual > 1) {
      this.paginaActual--;
    }
  }

  // generarResenasDummy() {
  //   for (let i = 1; i <= 50; i++) {
  //     this.todasResenas.push({
  //       autor: `Usuario ${i}`,
  //       negocio: `Negocio ${i}`,
  //       comentario: `Comentario de la reseña número ${i}. Muy interesante y detallado.`,
  //       valoracion: Math.floor(Math.random() * 5) + 1,
  //       fecha: new Date().toLocaleDateString()
  //     });
  //   }
  // }



}


