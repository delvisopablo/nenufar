import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-crear-resena-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-resena-modal.component.html',
  styleUrl: './crear-resena-modal.component.css'
})
export class CrearResenaModalComponent {
ocultarListaConRetraso() {
throw new Error('Method not implemented.');
}
  @Input() visible = false;
  @Output() reseñaCreada = new EventEmitter<any>();

  form: FormGroup;
  negocios = [
    'Bar El Nenúfar', 'La Panadería Verde', 'Café Central', 'Restaurante El Lago',
    'Gym Salamandra', 'Mercado Azul', 'Café Central', 'Bar El Nenúfar'
  ];

  mostrarLista = signal(false);
  estrellas = signal(0);
  selloNenufar = signal(false);

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      negocio: ['', Validators.required],
      comentario: ['', Validators.required]
    });
  }

  seleccionarNegocio(nombre: string) {
    this.form.get('negocio')?.setValue(nombre);
    this.mostrarLista.set(false);
  }

  seleccionarEstrellas(valor: number) {
    this.estrellas.set(valor);
  }

  toggleSello() {
    this.selloNenufar.update((v) => !v);
  }

  cerrar() {
    this.visible = false;
  }

  enviar() {
    if (this.form.valid) {
      const reseña = {
        ...this.form.value,
        valoracion: this.estrellas(),
        selloNenufar: this.selloNenufar()
        
      };
      console.log('🟢 Reseña enviada:', reseña);
      this.form.reset();
      this.estrellas.set(0);
      this.selloNenufar.set(false);
      const guardadas = JSON.parse(localStorage.getItem('reseñas') || '[]');
          guardadas.push(reseña);
          localStorage.setItem('reseñas', JSON.stringify(guardadas));

      this.reseñaCreada.emit(reseña);
      this.cerrar();
    }
  }
}
