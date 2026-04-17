// negocio.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import {
  API_BASE_URL,
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

@Injectable({ providedIn: 'root' })
export class NegocioService {
  private readonly baseUrl = API_BASE_URL;

  constructor(private http: HttpClient) {}

  buscarNegocios(query: string) {
    return this.http
      .get<ApiListResponse<any>>(buildApiUrl('/negocios'), {
        params: { q: query },
      })
      .pipe(map((response) => extractItems(response)));
  }
}
