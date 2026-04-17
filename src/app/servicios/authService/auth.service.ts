import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = API_BASE_URL;
  private token$ = new BehaviorSubject<string | null>(null);

  constructor(private http: HttpClient) {
    // Recupera token guardado (si hay)
    this.token$.next(localStorage.getItem('token'));
  }


usuarioExiste(usuario: string, email: string): boolean {
  const registrados = JSON.parse(localStorage.getItem('usuariosRegistrados') || '[]');
  return registrados.some(
    (u: { nickname: string; email: string }) =>
      u.nickname === usuario || u.email === email
  );
}


 login(email: string, password: string) {
  return this.http.post<{ access_token: string, usuario: any }>(`${this.baseUrl}/auth/login`, {
    email,
    password
  }).pipe(
    tap(res => {
      console.log('✅ Login response:', res);
      localStorage.setItem('token', res.access_token);
      localStorage.setItem('usuarioLogueado', JSON.stringify(res.usuario));
    })
  );
}




   register(data: any) {
  return this.http.post(`${this.baseUrl}/auth/register`, {
    nombre: data.nombre,
    nickname: data.nickname,
    email: data.email,
    password: data.password,
  
    biografia: data.biografia      // ✅ opcional
  });
}


registerNegocio(data: any) {
  return this.register(data);
}


 guardarUsuario(usuario: any) {
  
    localStorage.setItem('usuarioLogueado', JSON.stringify(usuario));
  }

 obtenerUsuario() {
    const user = localStorage.getItem('usuarioLogueado');
    return user ? JSON.parse(user) : null;
  }


  guardarToken(token: string) {
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  logout() {
    localStorage.removeItem('token');
  }
 
}
