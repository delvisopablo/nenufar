import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MenuComponent } from '../menu/menu/menu.component';
import { CrearResenaModalComponent } from '../crear-resena/crear-resena-modal/crear-resena-modal.component';
import { PortalReseñasComponent } from '../portal-resenas/portal-resenas/portal-resenas.component';
import { resenasMock } from './resenasMock';



@Component({
  selector: 'app-principal',
  standalone: true,
  imports: [RouterLink, MenuComponent, CrearResenaModalComponent, PortalReseñasComponent],
  templateUrl: './principal.component.html',
  styleUrl: './principal.component.css'
})
export class PrincipalComponent {
  reseñas = signal<any[]>(resenasMock);
  private router: Router;
  usuarioLogueado = signal<any | null>(null);



  ngOnInit() {
    const guardadas = localStorage.getItem('reseñas');
    if (guardadas) {
      this.reseñas.set(JSON.parse(guardadas));
    }

    const local = localStorage.getItem('reseñas');

  if (!local) {
    localStorage.setItem('reseñas', JSON.stringify(resenasMock));
    this.reseñas.set(resenasMock);
  } else {
    this.reseñas.set(JSON.parse(local));
  }

  const user = localStorage.getItem('usuarioLogueado');
  if (user) this.usuarioLogueado.set(JSON.parse(user));
  }
  

  // modalVisible: boolean = false;


  constructor(router: Router) {
    this.router = inject(Router);
  }

  // Duplicate declaration removed

  modalVisible = false;

anadirResena(resena: any) {
  this.reseñas.update(prev => [resena, ...prev]);
  const todas = JSON.parse(localStorage.getItem('reseñas') || '[]');
  todas.unshift(resena);
  localStorage.setItem('reseñas', JSON.stringify(todas));
}


}
