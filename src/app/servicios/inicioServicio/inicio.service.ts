import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { buildApiUrl } from '../../config/api.config';

export interface InicioResponse {
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class InicioService {
  private readonly http = inject(HttpClient);

  /** GET /api/inicio */
  inicio(): Observable<InicioResponse> {
    return this.http.get<InicioResponse>(buildApiUrl('/inicio'));
  }
}
