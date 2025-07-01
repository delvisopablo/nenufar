// registro-negocio.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../servicios/authService/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-registro-negocio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './RegistroNegocio.component.html',
  styleUrls: ['./RegistroNegocio.component.css']
})
export class RegistroNegocioComponent implements OnInit {
  fb = inject(FormBuilder);
  router = inject(Router);
  auth = inject(AuthService);
  http = inject(HttpClient);

  negocioForm!: FormGroup;
  categorias = signal<{ id: number, nombre: string }[]>([]);
  cargandoCategorias = signal(true);

  ngOnInit(): void {
    // 1️⃣ Formulario con todos los campos necesarios
    this.negocioForm = this.fb.group({
      nombreDueño: ['', Validators.required],
      nickname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      nombreNegocio: ['', Validators.required],
      direccion: [''],
      fechaFundacion: ['', Validators.required],
      historia: [''],
      categoriaNombre: ['', Validators.required], // 👈 INPUT libre o autocompletado
    });

    // 2️⃣ Cargar categorías dinámicamente desde tu backend:
    this.http.get<any[]>('http://localhost:3000/categorias').subscribe({
      next: (data) => {
        this.categorias.set(data);
        this.cargandoCategorias.set(false);
      },
      error: (err) => {
        console.error('❌ Error cargando categorías', err);
        this.cargandoCategorias.set(false);
      }
    });
  }

  mostrarSugerencias = false;
categoriasFiltradas = signal<{ id: number, nombre: string }[]>([]);

filtrarCategorias() {
  const texto = this.negocioForm.get('categoriaNombre')?.value?.toLowerCase() || '';
  const filtradas = this.categorias().filter(cat => cat.nombre.toLowerCase().includes(texto));
  this.categoriasFiltradas.set(filtradas);
}

seleccionarCategoria(cat: { id: number, nombre: string }) {
  this.negocioForm.get('categoriaNombre')?.setValue(cat.nombre);
  this.mostrarSugerencias = false;
}

ocultarSugerenciasConRetraso() {
  setTimeout(() => this.mostrarSugerencias = false, 150);
}


  registrar() {
    if (this.negocioForm.invalid) {
  console.warn('❌ Formulario inválido:', this.negocioForm.value);
  alert('🚫 Hay campos obligatorios vacíos. Por favor, revisa el formulario.');
    this.negocioForm.markAllAsTouched(); // Para que se vean los errores visualmente
  return;
}

    const datos = this.negocioForm.value;

    // 3️⃣ Preparamos payload limpio:
    const payload = {
      dueñoId: 1, // Asignar ID del dueño después de registrar usuario
      nombre: datos.nombreDueño,
      nickname: datos.nickname,
      email: datos.email,
      password: datos.password,
      nombreNegocio: datos.nombreNegocio,
      direccion: datos.direccion,
      fechaFundacion: datos.fechaFundacion,
      historia: datos.historia,
      categoriaNombre: datos.categoriaNombre
    };

    console.log('📤 Payload final negocio:', payload);

    // 4️⃣ Llamar a AuthService → Backend:
    this.auth.registerNegocio(payload).subscribe({
      next: res => {
        console.log('✅ Negocio registrado:', res);
        this.router.navigate(['/inicio']);
      },
      error: err => console.error('❌ Error registrando negocio', err)
    });
  }
}
