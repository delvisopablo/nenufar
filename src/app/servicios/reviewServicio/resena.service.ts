import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ResenaService {
private readonly baseUrl = `${environment.apiUrl}/resena`;

  constructor(private http: HttpClient) {}

  obtenerUltimas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/ultimas`);
  }

  getMediaPorNegocio(negocioId: number): Observable<number> {
  return this.http.get<number>(`${this.baseUrl}/resena/media/${negocioId}`);
}

getResenasPorUsuario(usuarioId: number) {
  return this.http.get<any[]>(`${this.baseUrl}/usuario/${usuarioId}`);
}


}
