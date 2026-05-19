import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export interface Producto {
  id: number;
  nombre: string;
  descripcion?: string;
  precio: number;
  codigoSKU?: string;
  foto?: string | null;
  imagen?: string | null;
  imageUrl?: string | null;
  stockDisponible?: number;
  stockReservado?: number;
  negocioId?: number;
  [key: string]: unknown;
}

export interface CreateProductoPayload {
  nombre: string;
  descripcion?: string;
  precio: number;
  codigoSKU?: string;
  foto?: string | null;
  stockDisponible?: number;
  stockReservado?: number;
}

export type UpdateProductoPayload = Partial<CreateProductoPayload>;

export interface UpdateStockPayload {
  deltaDisponible?: number;
  deltaReservado?: number;
  motivo?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductoServiceService {
  private readonly http = inject(HttpClient);

  listByNegocio(negocioId: number): Observable<Producto[]> {
    return this.http
      .get<Producto[] | ApiListResponse<Producto>>(
        buildApiUrl(`/negocios/${negocioId}/productos`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  create(negocioId: number, payload: CreateProductoPayload): Observable<Producto> {
    return this.http.post<Producto>(
      buildApiUrl(`/negocios/${negocioId}/productos`),
      payload,
    );
  }

  get(id: number): Observable<Producto> {
    return this.http.get<Producto>(buildApiUrl(`/productos/${id}`));
  }

  update(id: number, payload: UpdateProductoPayload): Observable<Producto> {
    return this.http.patch<Producto>(buildApiUrl(`/productos/${id}`), payload);
  }

  adjustStock(id: number, payload: UpdateStockPayload): Observable<Producto> {
    return this.http.patch<Producto>(
      buildApiUrl(`/productos/${id}/stock`),
      payload,
    );
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/productos/${id}`));
  }
}
