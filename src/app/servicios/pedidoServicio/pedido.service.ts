import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export type CanalVenta = 'WEB' | 'APP' | 'PRESENCIAL' | 'TELEFONO' | 'OTRO' | string;
export type PedidoEstado = 'PENDIENTE' | 'COMPLETADO' | 'ENTREGADO' | 'CANCELADO' | string;
export type PedidoCanceladoPor = 'USUARIO' | 'NEGOCIO' | string;

export interface PedidoItem {
  id?: number;
  productoId?: number | null;
  nombre: string;
  foto?: string | null;
  cantidad: number;
  precioUnitario?: number;
  subtotal?: number;
  [key: string]: unknown;
}

export interface PedidoUsuarioResumen {
  id?: number;
  nombre?: string;
  nickname?: string;
  email?: string;
  foto?: string | null;
}

export interface PedidoNegocioResumen {
  id?: number;
  nombre?: string;
  slug?: string | null;
  fotoPerfil?: string | null;
}

export interface Pedido {
  id: number;
  negocioId: number;
  usuarioId?: number | null;
  estado: PedidoEstado;
  canalVenta?: CanalVenta;
  total?: number;
  creadoEn?: string;
  actualizadoEn?: string;
  motivoCancelacion?: string | null;
  canceladoEn?: string | null;
  canceladoPor?: PedidoCanceladoPor | null;
  /** Solo viene informado por GET /api/me/pedidos; ausente en otras vistas. */
  puedeCancelar?: boolean;
  usuario?: PedidoUsuarioResumen | null;
  negocio?: PedidoNegocioResumen | null;
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

export interface QueryMisPedidosOptions {
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);

  /** POST /api/negocios/:negocioId/pedidos */
  createPedido(negocioId: number, payload: CreatePedidoPayload = {}): Observable<Pedido> {
    return this.http
      .post<unknown>(buildApiUrl(`/negocios/${negocioId}/pedidos`), payload)
      .pipe(map((response) => this.normalizePedido(response)));
  }

  /** GET /api/negocios/:negocioId/pedidos — pedidos recibidos por el negocio. */
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
      .get<unknown[] | ApiListResponse<unknown>>(
        buildApiUrl(`/negocios/${negocioId}/pedidos`),
        { params },
      )
      .pipe(map((response) => extractItems(response).map((item) => this.normalizePedido(item))));
  }

  /** GET /api/me/pedidos — pedidos del usuario autenticado (historial de Nenulista). */
  misPedidos(options: QueryMisPedidosOptions = {}): Observable<Pedido[]> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', String(options.page));
    if (options.limit) params = params.set('limit', String(options.limit));

    return this.http
      .get<unknown[] | ApiListResponse<unknown>>(buildApiUrl('/me/pedidos'), { params })
      .pipe(map((response) => extractItems(response).map((item) => this.normalizePedido(item))));
  }

  /** GET /api/pedidos/:id */
  getPedido(id: number): Observable<Pedido> {
    return this.http
      .get<unknown>(buildApiUrl(`/pedidos/${id}`))
      .pipe(map((response) => this.normalizePedido(response)));
  }

  /** PATCH /api/pedidos/:id */
  updatePedido(id: number, payload: UpdatePedidoPayload): Observable<Pedido> {
    return this.http
      .patch<unknown>(buildApiUrl(`/pedidos/${id}`), payload)
      .pipe(map((response) => this.normalizePedido(response)));
  }

  /**
   * PATCH /api/pedidos/:id/estado — solo negocio (completar/entregar/cancelar).
   * El motivo es opcional (el backend lo acepta pero no lo exige).
   */
  actualizarEstadoPedido(id: number, estado: PedidoEstado, motivo?: string): Observable<Pedido> {
    const payload: { estado: PedidoEstado; motivo?: string } = { estado };
    const motivoTrim = motivo?.trim();
    if (motivoTrim) {
      payload.motivo = motivoTrim;
    }

    return this.http
      .patch<unknown>(buildApiUrl(`/pedidos/${id}/estado`), payload)
      .pipe(map((response) => this.normalizePedido(response)));
  }

  /**
   * PATCH /api/pedidos/:id/cancelar — cancelación del propio usuario (Nenulista)
   * o del negocio. El motivo es opcional.
   */
  cancelarPedido(id: number, motivo?: string): Observable<Pedido> {
    const motivoTrim = motivo?.trim();
    return this.http
      .patch<unknown>(buildApiUrl(`/pedidos/${id}/cancelar`), motivoTrim ? { motivo: motivoTrim } : {})
      .pipe(map((response) => this.normalizePedido(response)));
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

  /**
   * Normaliza la respuesta cruda del backend a un `Pedido` consistente para la UI.
   * El backend expone las líneas de producto como `pedidoProductos` (listByNegocio/getPedido)
   * o como `productos` (misPedidos); aquí se homogeneizan siempre a `items`.
   */
  private normalizePedido(raw: unknown): Pedido {
    const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

    const rawItems = Array.isArray(source['pedidoProductos'])
      ? (source['pedidoProductos'] as unknown[])
      : Array.isArray(source['productos'])
        ? (source['productos'] as unknown[])
        : Array.isArray(source['items'])
          ? (source['items'] as unknown[])
          : [];

    const items: PedidoItem[] = rawItems.map((raw) => {
      const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const producto = (item['producto'] && typeof item['producto'] === 'object'
        ? item['producto']
        : {}) as Record<string, unknown>;

      return {
        id: this.toOptionalNumber(item['id']),
        productoId: this.toOptionalNumber(item['productoId'] ?? producto['id']) ?? null,
        nombre: this.toOptionalString(producto['nombre'] ?? item['nombre']) ?? 'Producto',
        foto: this.toOptionalString(producto['foto'] ?? item['foto']),
        cantidad: this.toOptionalNumber(item['cantidad']) ?? 0,
        precioUnitario: this.toOptionalNumber(item['precioUnitario'] ?? item['precio']),
        subtotal: this.toOptionalNumber(item['subtotal']),
      };
    });

    const negocioRaw = (source['negocio'] && typeof source['negocio'] === 'object'
      ? source['negocio']
      : null) as Record<string, unknown> | null;
    const usuarioRaw = (source['usuario'] && typeof source['usuario'] === 'object'
      ? source['usuario']
      : null) as Record<string, unknown> | null;

    return {
      ...source,
      id: this.toOptionalNumber(source['id']) ?? 0,
      negocioId: this.toOptionalNumber(source['negocioId'] ?? negocioRaw?.['id']) ?? 0,
      usuarioId: this.toOptionalNumber(source['usuarioId'] ?? usuarioRaw?.['id']) ?? null,
      estado: this.toOptionalString(source['estado']) ?? 'PENDIENTE',
      canalVenta: this.toOptionalString(source['canalVenta']) ?? undefined,
      total: this.toOptionalNumber(source['total'] ?? source['totalSnapshot']),
      creadoEn: this.toOptionalString(source['creadoEn']) ?? undefined,
      actualizadoEn: this.toOptionalString(source['actualizadoEn']) ?? undefined,
      motivoCancelacion: this.toOptionalString(source['motivoCancelacion']),
      canceladoEn: this.toOptionalString(source['canceladoEn']),
      canceladoPor: this.toOptionalString(source['canceladoPor']),
      puedeCancelar: typeof source['puedeCancelar'] === 'boolean' ? source['puedeCancelar'] : undefined,
      negocio: negocioRaw
        ? {
            id: this.toOptionalNumber(negocioRaw['id']),
            nombre: this.toOptionalString(negocioRaw['nombre']) ?? 'Negocio',
            slug: this.toOptionalString(negocioRaw['slug']),
            fotoPerfil: this.toOptionalString(negocioRaw['fotoPerfil']),
          }
        : undefined,
      usuario: usuarioRaw
        ? {
            id: this.toOptionalNumber(usuarioRaw['id']),
            nombre: this.toOptionalString(usuarioRaw['nombre']) ?? 'Cliente de Nenúfar',
            nickname: this.toOptionalString(usuarioRaw['nickname']) ?? undefined,
            email: this.toOptionalString(usuarioRaw['email']) ?? undefined,
            foto: this.toOptionalString(usuarioRaw['foto']),
          }
        : undefined,
      items,
    };
  }

  private toOptionalNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }
}
