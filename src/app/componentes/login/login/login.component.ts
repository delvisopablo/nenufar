import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../servicios/authService/auth.service';
import { HttpClient } from '@angular/common/http';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  fb = inject(FormBuilder);
  auth = inject(AuthService);
http = inject(HttpClient);

  loginForm!: FormGroup;
  loginError = signal(false);

  ngOnInit(): void {
    const accesoPermitido = localStorage.getItem('accesoPermitido');
    if (accesoPermitido !== 'true') {
      this.router.navigate(['/']);
    }

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  constructor(
  private authService: AuthService,
  private router: Router
) {}


 // login.component.ts (fragmento clave)
iniciarSesion() {
  const email = this.loginForm.get('email')?.value;
  const password = this.loginForm.get('password')?.value;
  this.authService.login(email, password).subscribe({
    next: (res) => {
      console.log('🎉 Login correcto');
            localStorage.setItem('access_token', res.access_token);
    localStorage.setItem('usuarioLogueado', JSON.stringify(res.usuario)); // 👈 esto debe guardar el usuario completo

      this.router.navigate(['/inicio']); // o donde quieras redirigir después del login
    },
  error: (err) => {
    console.error('❌ Error en login:', err);
  }
});

  

  // this.auth.login(email, password).subscribe({
  //   next: (res: any) => {
  //     console.log('✅ Login OK:', res);
  //   localStorage.setItem('usuarioLogueado', JSON.stringify(res.usuario)); // 👈 esto debe guardar el usuario completo
  //     this.auth.guardarUsuario(res.usuario); // Guarda el usuario en el servicio
  //     // this.auth.actualizarToken(res.access_token); // Actualiza el token en el servicio
  //     localStorage.setItem('token', res.access_token);
  //     this.router.navigate(['/inicio']);
  //     // Ahora ve a por el perfil
  //     // this.http.get('http://localhost:3000/usuario/perfil', {
  //     //   headers: {
  //     //     Authorization: `Bearer ${res.access_token}`
  //     //   }
  //     // }).subscribe({
  //     //   next: (perfil: any) => {
  //     //     this.auth.guardarUsuario(perfil);
  //     //     this.router.navigate(['/perfil']);
  //     //   },
  //     //   error: (err: unknown) => {
  //     //     console.error('❌ No se pudo obtener el perfil', err);
  //     //   }
  //     // });
  //   },
  //   error: err => {
  //     console.error('❌ Login fallido', err);
  //     this.loginError.set(true);
  //   }
  // });
}


  crearCuenta() {
    this.router.navigate(['/registro-opciones']);
  }

  recuperarClave() {
    alert('Función no disponible todavía 🙈');
  }
}
