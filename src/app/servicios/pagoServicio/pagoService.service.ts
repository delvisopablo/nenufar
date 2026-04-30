import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export type MetodoPago = 'TARJETA' | 'BIZUM' | 'EFECTIVO' | 'STRIPE' | 'OTRO' | string;
export type PagoEstado = 'PENDIENTE' | 'PAGADO' | 'FALLIDO' | string;

export interface Pago {
  id: number;
  compraId?: number;
  usuarioId?: number;
  metodoPago: MetodoPago;
  cantidad: number;
  estado: PagoEstado;
  moneda?: string;
  refExterna?: string;
  [key: string]: unknown;
}

export interface CreatePagoPayload {
  metodoPago: MetodoPago;
  cantidad: number;
  estado: PagoEstado;
  moneda?: string;
  refExterna?: string;
}

export interface UpdatePagoEstadoPayload {
  estado: PagoEstado;
  refExterna?: string;
}

@Injectable({ providedIn: 'root' })
export class PagoServiceService {
  private readonly http = inject(HttpClient);

  /** POST /api/compras/:id/pagos */
  createPago(compraId: number, payload: CreatePagoPayload): Observable<Pago> {
    return this.http.post<Pago>(
      buildApiUrl(`/compras/${compraId}/pagos`),
      payload,
    );
  }

  /** PATCH /api/pagos/:id/estado */
  updateEstado(id: number, payload: UpdatePagoEstadoPayload): Observable<Pago> {
    return this.http.patch<Pago>(
      buildApiUrl(`/pagos/${id}/estado`),
      payload,
    );
  }

  /** GET /api/pagos/:id */
  getPago(id: number): Observable<Pago> {
    return this.http.get<Pago>(buildApiUrl(`/pagos/${id}`));
  }

  /** GET /api/me/pagos */
  misPagos(): Observable<Pago[]> {
    return this.http
      .get<Pago[] | ApiListResponse<Pago>>(buildApiUrl('/me/pagos'))
      .pipe(map((response) => extractItems(response)));
  }
}
