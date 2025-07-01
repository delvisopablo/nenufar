import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReservaService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  crearReserva(data: any) {
//     const token = localStorage.getItem('token');

// this.http.get('http://localhost:3000/ruta-protegida', {
//   headers: {
//     Authorization: `Bearer ${token}`
//   }
// })

  // data.fecha debe ser data.fecha.toISOString()
  return this.http.post(`${this.baseUrl}/reserva`, {
    ...data,
    fecha: new Date(data.fecha).toISOString()
  });
}

reservasPorUsuario(usuarioId: number) {
  return this.http.get(`http://localhost:3000/reserva/usuario/${usuarioId}`);
}

crear(reserva: { fecha: string; nota: string; negocioId: number; usuarioId: number }): Observable<any> {
  return this.http.post<any>('http://localhost:3000/reserva', reserva);
}

  reservasPorNegocio(id: number) {
//     const token = localStorage.getItem('token');

// this.http.get('http://localhost:3000/ruta-protegida', {
//   headers: {
//     Authorization: `Bearer ${token}`
//   }
// })

    return this.http.get(`${this.baseUrl}/reserva/negocio/${id}`);
  }

  cancelarReserva(id: number) {
//     const token = localStorage.getItem('token');

// this.http.get('http://localhost:3000/ruta-protegida', {
//   headers: {
//     Authorization: `Bearer ${token}`
//   }
// })

    return this.http.delete(`${this.baseUrl}/reserva/${id}`);
  }
}
