import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = 'http://192.168.0.23:3000'; 

  constructor(private http: HttpClient) {}

  login(email: string, contrasena: string) {
    return this.http.post(`${this.baseUrl}/auth/login`, {
      email,
      contrasena
    });
  }

  register(data: any) {
    return this.http.post(`${this.baseUrl}/auth/register`, data);
  }

  obtenerUsuariosRegistrados(): any[] {
    return JSON.parse(localStorage.getItem('usuariosRegistrados') || '[]');
  }

  usuarioExiste(usuario: string, email: string): boolean {
    const registrados = JSON.parse(localStorage.getItem('usuariosRegistrados') || '[]');
    return registrados.some((u: { usuario: string; email: string; }) => u.usuario === usuario || u.email === email);
  }
  
}
