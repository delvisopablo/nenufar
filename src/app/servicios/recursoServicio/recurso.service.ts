import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export interface Recurso {
  id: number;
  nombre: string;
  descripcion?: string;
  capacidad?: number;
  activo?: boolean;
  negocioId?: number;
  [key: string]: unknown;
}

export interface CreateRecursoPayload {
  nombre: string;
  descripcion?: string;
  capacidad?: number;
  activo?: boolean;
}

export type UpdateRecursoPayload = Partial<CreateRecursoPayload>;

@Injectable({ providedIn: 'root' })
export class RecursoService {
  private readonly http = inject(HttpClient);

  /** GET /api/negocios/:id/recursos */
  listByNegocio(negocioId: number): Observable<Recurso[]> {
    return this.http
      .get<Recurso[] | ApiListResponse<Recurso>>(
        buildApiUrl(`/negocios/${negocioId}/recursos`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** POST /api/negocios/:id/recursos */
  create(negocioId: number, payload: CreateRecursoPayload): Observable<Recurso> {
    return this.http.post<Recurso>(
      buildApiUrl(`/negocios/${negocioId}/recursos`),
      payload,
    );
  }

  /** PATCH /api/recursos/:id */
  update(id: number, payload: UpdateRecursoPayload): Observable<Recurso> {
    return this.http.patch<Recurso>(buildApiUrl(`/recursos/${id}`), payload);
  }

  /** DELETE /api/recursos/:id */
  remove(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/recursos/${id}`));
  }
}
