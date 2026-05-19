import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  NegocioService,
  resolveNegocioRouteCommands,
} from '../../../servicios/negocioService/negocio.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css',
  imports: [CommonModule]
})
export class MenuComponent {
  negocioService = inject(NegocioService);
  private readonly router = inject(Router);

  resultados: any[] = [];
  errorMensaje = '';

  
  filtrarNegocios(event: Event) {
    const valor = (event.target as HTMLInputElement).value;
    this.errorMensaje = '';
    console.log('Filtrando negocios con:', valor);
    this.negocioService.buscarNegocios(valor).subscribe({
      next: (res: any) => {
        this.resultados = res;
      },
      error: err => {
        console.error('Error buscando negocios', err);
      }
    });
  }


  irANegocio(negocio: { id?: number | null; slug?: string | null; nickname?: string | null }) {
    const negocioRoute = resolveNegocioRouteCommands(negocio);
    if (!negocioRoute) {
      this.errorMensaje = 'No hemos podido abrir ese negocio todavía.';
      return;
    }

    this.errorMensaje = '';
    void this.router.navigate(negocioRoute);
    this.resultados = [];
  }

}
