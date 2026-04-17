import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { buildApiUrl } from '../../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class ResenaService {
private readonly baseUrl = buildApiUrl('/resena');

  constructor(private http: HttpClient) {}

  obtenerUltimas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/ultimas`);
  }

  getMediaPorNegocio(negocioId: number): Observable<number> {
  return this.http.get<number>(`${this.baseUrl}/media/${negocioId}`);
}

getResenasPorUsuario(usuarioId: number) {
  return this.http.get<any[]>(`${this.baseUrl}/usuario/${usuarioId}`);
}


}
