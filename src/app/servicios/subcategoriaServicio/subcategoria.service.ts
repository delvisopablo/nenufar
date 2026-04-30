import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export interface Subcategoria {
  id: number;
  nombre: string;
  categoriaId: number;
  activo?: boolean;
  [key: string]: unknown;
}

export interface CreateSubcategoriaPayload {
  nombre: string;
  categoriaId: number;
  activo?: boolean;
}

export type UpdateSubcategoriaPayload = Partial<CreateSubcategoriaPayload>;

export interface QuerySubcategoriaOptions {
  categoriaId?: number;
  q?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class SubcategoriaService {
  private readonly http = inject(HttpClient);

  list(options: QuerySubcategoriaOptions = {}): Observable<Subcategoria[]> {
    let params = new HttpParams();
    if (options.categoriaId) params = params.set('categoriaId', String(options.categoriaId));
    if (options.q) params = params.set('q', options.q);
    if (options.page) params = params.set('page', String(options.page));
    if (options.limit) params = params.set('limit', String(options.limit));

    return this.http
      .get<Subcategoria[] | ApiListResponse<Subcategoria>>(
        buildApiUrl('/subcategorias'),
        { params },
      )
      .pipe(map((response) => extractItems(response)));
  }

  get(id: number): Observable<Subcategoria> {
    return this.http.get<Subcategoria>(buildApiUrl(`/subcategorias/${id}`));
  }

  create(payload: CreateSubcategoriaPayload): Observable<Subcategoria> {
    return this.http.post<Subcategoria>(buildApiUrl('/subcategorias'), payload);
  }

  update(id: number, payload: UpdateSubcategoriaPayload): Observable<Subcategoria> {
    return this.http.patch<Subcategoria>(buildApiUrl(`/subcategorias/${id}`), payload);
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/subcategorias/${id}`));
  }
}
