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
      usuario: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(6)]],
      confirmarContrasena: ['', Validators.required],
      rol: ['usuario', Validators.required],
      nombreNegocio: [''],
      tipoNegocio: ['']
    });

    this.registroForm.get('rol')?.valueChanges.subscribe(valor => {
      this.esNegocio.set(valor === 'negocio');
    });
  }

  registrarUsuario() {
    console.log('🧪 Formulario enviado');
    if (this.registroForm.invalid) return;

    const datos = this.registroForm.value;

    if (datos.contrasena !== datos.confirmarContrasena) {
      alert('Las contraseñas no coinciden');
      return;
    }

    if (this.auth.usuarioExiste(datos.usuario, datos.email)) {
      alert('Este nombre de usuario o correo ya está registrado.');
      return;
    }

    const usuario = {
      usuario_id: crypto.randomUUID(),
      nombre: datos.nombre,
      usuario: datos.usuario,
      email: datos.email,
      contraseña: datos.contrasena,
      rol: datos.rol,
      foto_perfil: '',
      biografía: '',
      seguidores: [],
      seguidos: [],
      me_gusta: [],
      negocio: datos.rol === 'negocio' ? {
        nombre: datos.nombreNegocio,
        tipo: datos.tipoNegocio
      } : null
    };

    const registrados = JSON.parse(localStorage.getItem('usuariosRegistrados') || '[]');
    registrados.push(usuario);
    localStorage.setItem('usuariosRegistrados', JSON.stringify(registrados));
    localStorage.setItem('usuarioLogueado', JSON.stringify(usuario));

    this.router.navigate(['/inicio']);
  }
}
