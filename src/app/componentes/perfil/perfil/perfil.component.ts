import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


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
  nuevaBio = '';
  nuevoHorario = { apertura: '', cierre: '' };

  ngOnInit(): void {
    const datos = localStorage.getItem('usuarioLogueado');
    if (datos) {
      const user = JSON.parse(datos);
      this.usuarioLogueado.set(user);
      this.nuevaBio = user.biografía || '';
      if (user.rol === 'negocio') {
        this.nuevoHorario.apertura = user.negocio?.horario?.apertura || '';
        this.nuevoHorario.cierre = user.negocio?.horario?.cierre || '';
      }
    }
  }

  guardarCambios() {
    const user = this.usuarioLogueado();
  
    user.biografía = this.nuevaBio; // ✅ aquí se guarda lo nuevo
  
    if (user.rol === 'negocio') {
      user.negocio.horario = {
        apertura: this.nuevoHorario.apertura,
        cierre: this.nuevoHorario.cierre
      };
    }
  
    localStorage.setItem('usuarioLogueado', JSON.stringify(user));
    this.usuarioLogueado.set(user); // ✅ esto refresca el HTML
    this.modoEdicion.set(false);
  }
  
}
