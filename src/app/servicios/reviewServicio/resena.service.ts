import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ResenaService {

private baseUrl = 'http://localhost:3000/resena';

  constructor(private http: HttpClient) {}

  obtenerUltimas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/ultimas`);
  }

  getMediaPorNegocio(negocioId: number): Observable<number> {
  return this.http.get<number>(`${this.baseUrl}/resena/media/${negocioId}`);
}

getResenasPorUsuario(usuarioId: number) {
  return this.http.get<any[]>(`http://localhost:3000/resena/usuario/${usuarioId}`);
}


}
