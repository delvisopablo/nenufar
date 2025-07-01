import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../servicios/authService/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent implements OnInit {
  fb = inject(FormBuilder);
  router = inject(Router);
  auth = inject(AuthService);

  registroForm!: FormGroup;
  esNegocio = signal(false);

  tiposNegocio = [
    'Bar',
    'Cafetería',
    'Tienda de barrio',
    'Centro cultural',
    'Restaurante familiar',
    'Comercio',
    'Establecimiento turístico',
    'Negocio digital',
    'Tienda de ropa',
    'Peluquería',
    'Estética',
    'Gimnasio',
    'Estudio de fotografía',
    'Estudio de diseño',
    'Agencia de publicidad',
    'Agencia de viajes',
    'Tienda de tecnología',
    'Otro...'
  ];

 ngOnInit(): void {
  this.registroForm = this.fb.group({
    nombre: ['', Validators.required],
    nickname: ['', Validators.required],       // ✅ Añadido: nombre de usuario
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(5)]],
    confirmarContrasena: ['', Validators.required],
      biografia: [''], // ✅ NUEVO CAMPO

  });
console.log('Datos que se mandan:', this.registroForm.value);


  this.registroForm.get('rol')?.valueChanges.subscribe(valor => {
    this.esNegocio.set(valor === 'negocio');
  });
}


  registrarUsuario() {
  if (this.registroForm.invalid) return;

  const datos = this.registroForm.value;

  if (datos.password !== datos.confirmarContrasena) {
    alert('Las contraseñas no coinciden');
    return;
  }

  // 🚀 ENVÍA AL BACKEND REAL:
  this.auth.register({
    nombre: datos.nombre,
    nickname: datos.nickname,             // ✅ Ahora sí se envía
    email: datos.email,
    password: datos.password,
    biografia: datos.biografia,
  }).subscribe({
    next: (res: any) => {
      console.log('✅ Registro OK', res);
      localStorage.setItem('token', res.access_token);
      this.router.navigate(['/inicio']);
    },
    error: err => {
      console.error('❌ Error registrando', err);
      alert('No se pudo registrar, revisa los datos o el correo ya existe');
    }
  });
}

}
