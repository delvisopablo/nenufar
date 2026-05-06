import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NegocioService } from '../../../servicios/negocioService/negocio.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css',
  imports: [CommonModule]
})
export class MenuComponent {
  negocioService = inject(NegocioService);

  resultados: any[] = [];

constructor(private http: HttpClient, private router: Router) {}

  
  filtrarNegocios(event: Event) {
    const valor = (event.target as HTMLInputElement).value;
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


  irANegocio(id: number) {
    void this.router.navigate(['/negocio', id]);
    this.resultados = [];
  }

}
