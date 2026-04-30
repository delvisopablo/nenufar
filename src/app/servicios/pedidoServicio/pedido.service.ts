import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export type CanalVenta = 'LOCAL' | 'ONLINE' | string;
export type PedidoEstado = 'PENDIENTE' | 'COMPLETADO' | 'CANCELADO' | string;

export interface PedidoItem {
  id?: number;
  productoId: number;
  cantidad: number;
  precioUnit?: number;
  [key: string]: unknown;
}

export interface Pedido {
  id: number;
  negocioId: number;
  estado: PedidoEstado;
  canalVenta?: CanalVenta;
  total?: number;
  items?: PedidoItem[];
  [key: string]: unknown;
}

export interface CreatePedidoPayload {
  // El controller acepta el body del DTO de creación; lo dejamos abierto al
  // shape concreto del backend (createPedido lo recoge por completo).
  [key: string]: unknown;
}

export interface UpdatePedidoPayload {
  estado?: PedidoEstado;
  canalVenta?: CanalVenta;
}

export interface AddItemPayload {
  productoId: number;
  cantidad: number;
}

export interface UpdateItemPayload {
  cantidad: number;
}

export interface QueryNegocioPedidosOptions {
  estado?: PedidoEstado;
  fecha?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);

  /** POST /api/negocios/:negocioId/pedidos */
  createPedido(negocioId: number, payload: CreatePedidoPayload = {}): Observable<Pedido> {
    return this.http.post<Pedido>(
      buildApiUrl(`/negocios/${negocioId}/pedidos`),
      payload,
    );
  }

  /** GET /api/negocios/:negocioId/pedidos */
  listPedidosNegocio(
    negocioId: number,
    options: QueryNegocioPedidosOptions = {},
  ): Observable<Pedido[]> {
    let params = new HttpParams();
    if (options.estado) params = params.set('estado', options.estado);
    if (options.fecha) params = params.set('fecha', options.fecha);
    if (options.page) params = params.set('page', String(options.page));
    if (options.limit) params = params.set('limit', String(options.limit));

    return this.http
      .get<Pedido[] | ApiListResponse<Pedido>>(
        buildApiUrl(`/negocios/${negocioId}/pedidos`),
        { params },
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** GET /api/pedidos/:id */
  getPedido(id: number): Observable<Pedido> {
    return this.http.get<Pedido>(buildApiUrl(`/pedidos/${id}`));
  }

  /** PATCH /api/pedidos/:id */
  updatePedido(id: number, payload: UpdatePedidoPayload): Observable<Pedido> {
    return this.http.patch<Pedido>(buildApiUrl(`/pedidos/${id}`), payload);
  }

  /** POST /api/pedidos/:id/items */
  addItem(pedidoId: number, payload: AddItemPayload): Observable<PedidoItem> {
    return this.http.post<PedidoItem>(
      buildApiUrl(`/pedidos/${pedidoId}/items`),
      payload,
    );
  }

  /** PATCH /api/pedidos/:id/items/:productoId */
  updateItem(
    pedidoId: number,
    productoId: number,
    payload: UpdateItemPayload,
  ): Observable<PedidoItem> {
    return this.http.patch<PedidoItem>(
      buildApiUrl(`/pedidos/${pedidoId}/items/${productoId}`),
      payload,
    );
  }

  /** DELETE /api/pedidos/:id/items/:productoId */
  removeItem(pedidoId: number, productoId: number): Observable<unknown> {
    return this.http.delete<unknown>(
      buildApiUrl(`/pedidos/${pedidoId}/items/${productoId}`),
    );
  }
}
