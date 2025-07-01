// negocio.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class NegocioService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  buscarNegocios(query: string) {
    return this.http.get(`${this.baseUrl}/negocio/buscar?query=${query}`);
  }
}
