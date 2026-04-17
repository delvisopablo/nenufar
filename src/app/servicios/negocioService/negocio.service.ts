// negocio.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NegocioService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  buscarNegocios(query: string) {
    return this.http.get(`${this.baseUrl}/negocio/buscar?query=${query}`);
  }
}
