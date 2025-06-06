import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../servicios/authService/auth.service';
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
  router = inject(Router);
  auth = inject(AuthService);


  loginForm!: FormGroup;
  loginError = signal(false);


  ngOnInit(): void {
    // Protege el acceso si no vienes de landing
    const accesoPermitido = localStorage.getItem('accesoPermitido');
    if (accesoPermitido !== 'true') {
      this.router.navigate(['/']);
    }

    this.loginForm = this.fb.group({
      usuario: ['', Validators.required],
      contrasena: ['', Validators.required]
    });
  }

  

  iniciarSesion() {
    const { usuario, contrasena } = this.loginForm.value;
    const userString = localStorage.getItem('usuarioLogueado');
  
    if (!userString) {
      // si no hay cuenta guardada, ve a registro
      this.router.navigate(['/registro']);
      console.log("Has llegado a registro")
      return;
    }
  
    const user = JSON.parse(userString);
  
    if (user.email === usuario && user.contrasena === contrasena) {
      // login correcto
      console.log("Usuario registrado con exito");
      this.router.navigate(['/inicio']);
    } else {
      this.loginError.set(true);
    }
  }
  
  
  
  crearCuenta() {
    this.router.navigate(['/registro']);
  }
  

  recuperarClave() {
    alert('Función no disponible todavía 🙈');
  }
}
