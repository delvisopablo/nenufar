import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export interface Compra {
  id: number;
  pedidoId?: number;
  usuarioId?: number;
  negocioId?: number;
  total?: number;
  moneda?: string;
  estado?: string;
  [key: string]: unknown;
}

export interface CreateCompraPayload {
  moneda?: string;
}

@Injectable({ providedIn: 'root' })
export class CompraServiceService {
  private readonly http = inject(HttpClient);

  /** POST /api/pedidos/:id/compras — convierte un pedido en una compra del usuario */
  createCompra(pedidoId: number, payload: CreateCompraPayload = {}): Observable<Compra> {
    return this.http.post<Compra>(
      buildApiUrl(`/pedidos/${pedidoId}/compras`),
      payload,
    );
  }

  /** GET /api/compras/:id */
  getCompra(id: number): Observable<Compra> {
    return this.http.get<Compra>(buildApiUrl(`/compras/${id}`));
  }

  /** GET /api/me/compras */
  misCompras(): Observable<Compra[]> {
    return this.http
      .get<Compra[] | ApiListResponse<Compra>>(buildApiUrl('/me/compras'))
      .pipe(map((response) => extractItems(response)));
  }
}
