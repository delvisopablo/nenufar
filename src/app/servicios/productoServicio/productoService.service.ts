import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map } from 'rxjs';
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
  codigoProducto?: string;
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

export interface SolicitudProducto {
  id: number | string;
  nombre?: string;
  nombreSugerido?: string;
  productoNombre?: string;
  servicioNombre?: string;
  descripcion?: string | null;
  precioSugerido?: number | string | null;
  precio?: number | string | null;
  estado?: string | null;
  negocioId?: number | string | null;
  resenaId?: number | string | null;
  reviewId?: number | string | null;
  usuarioId?: number | string | null;
  usuarioNombre?: string | null;
  creadoEn?: string | null;
  createdAt?: string | null;
  actualizadoEn?: string | null;
  usuario?: {
    id?: number | string | null;
    nombre?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
  resena?: {
    id?: number | string | null;
    contenido?: string | null;
    texto?: string | null;
    comentario?: string | null;
  } | null;
  review?: {
    id?: number | string | null;
    contenido?: string | null;
    texto?: string | null;
    comentario?: string | null;
  } | null;
  [key: string]: unknown;
}

export interface SolicitudProductoDecisionPayload {
  motivo?: string;
  producto?: Partial<CreateProductoPayload>;
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

  getSolicitudesProducto(negocioId: number): Observable<SolicitudProducto[]> {
    const params = new HttpParams().set('negocioId', String(negocioId));

    return this.http
      .get<SolicitudProducto[] | ApiListResponse<SolicitudProducto>>(
        buildApiUrl(`/negocios/${negocioId}/solicitudes-producto`),
      )
      .pipe(
        catchError(() =>
          this.http.get<SolicitudProducto[] | ApiListResponse<SolicitudProducto>>(
            buildApiUrl('/solicitudes-producto'),
            { params },
          ),
        ),
        map((response) => extractItems(response)),
      );
  }

  aprobarSolicitud(
    id: number | string,
    payload: SolicitudProductoDecisionPayload = {},
  ): Observable<Producto | SolicitudProducto> {
    return this.http.patch<Producto | SolicitudProducto>(
      buildApiUrl(`/solicitudes-producto/${id}/aprobar`),
      payload,
    );
  }

  rechazarSolicitud(
    id: number | string,
    payload: SolicitudProductoDecisionPayload = {},
  ): Observable<SolicitudProducto | unknown> {
    return this.http.patch<SolicitudProducto | unknown>(
      buildApiUrl(`/solicitudes-producto/${id}/rechazar`),
      payload,
    );
  }

  buscarProductos(q: string): Observable<Producto[]> {
    const params = new HttpParams().set('q', q);

    return this.http
      .get<Producto[] | ApiListResponse<Producto>>(buildApiUrl('/productos/buscar'), {
        params,
      })
      .pipe(map((response) => extractItems(response)));
  }
}
