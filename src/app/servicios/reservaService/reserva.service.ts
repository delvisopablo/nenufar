import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReservaService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  crearReserva(data: any) {
  return this.http.post(`${this.baseUrl}/reserva`, {
    ...data,
    fecha: new Date(data.fecha).toISOString()
  });
}

reservasPorUsuario(usuarioId: number) {
  return this.http.get(`${this.baseUrl}/reserva/usuario/${usuarioId}`);
}

crear(reserva: { fecha: string; nota: string; negocioId: number; usuarioId: number }): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}/reserva`, reserva);
}

  reservasPorNegocio(id: number) {
    return this.http.get(`${this.baseUrl}/reserva/negocio/${id}`);
  }

  cancelarReserva(id: number) {
    return this.http.delete(`${this.baseUrl}/reserva/${id}`);
  }
}
