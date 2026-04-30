import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export interface Categoria {
  id: number;
  nombre: string;
  [key: string]: unknown;
}

export interface Subcategoria {
  id: number;
  nombre: string;
  categoriaId: number;
  activo?: boolean;
  [key: string]: unknown;
}

export interface CreateCategoriaPayload {
  nombre: string;
}

export type UpdateCategoriaPayload = Partial<CreateCategoriaPayload>;

@Injectable({ providedIn: 'root' })
export class CategoriaServiceService {
  private readonly http = inject(HttpClient);

  list(): Observable<Categoria[]> {
    return this.http
      .get<Categoria[] | ApiListResponse<Categoria>>(buildApiUrl('/categorias'))
      .pipe(map((response) => extractItems(response)));
  }

  get(id: number): Observable<Categoria> {
    return this.http.get<Categoria>(buildApiUrl(`/categorias/${id}`));
  }

  listSubcategorias(id: number): Observable<Subcategoria[]> {
    return this.http
      .get<Subcategoria[] | ApiListResponse<Subcategoria>>(
        buildApiUrl(`/categorias/${id}/subcategorias`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  create(payload: CreateCategoriaPayload): Observable<Categoria> {
    return this.http.post<Categoria>(buildApiUrl('/categorias'), payload);
  }

  update(id: number, payload: UpdateCategoriaPayload): Observable<Categoria> {
    return this.http.patch<Categoria>(buildApiUrl(`/categorias/${id}`), payload);
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/categorias/${id}`));
  }
}
