import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  API_BASE_URL,
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';


export type ReservaEstado =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'CANCELADA'
  | 'COMPLETADA'
  | 'NO_SHOW'
  | string;

export interface AvailabilityResponse {
  date: string;
  intervalo?: number;
  slots: string[];
  [key: string]: unknown;
}

export interface QueryNegocioReservasOptions {
  page?: number;
  limit?: number;
  estado?: ReservaEstado;
  recursoId?: number;
  usuarioId?: number;
  from?: string;
  to?: string;
}

export interface UpdateReservaEstadoPayload {
  estado: ReservaEstado;
  motivoCancelacion?: string;
}

@Injectable({ providedIn: 'root' })
export class ReservaService {
  private readonly baseUrl = API_BASE_URL;

  constructor(private http: HttpClient) {}

  crearReserva(data: any) {
    return this.http.post(
      buildApiUrl(`/negocios/${data.negocioId}/reservas`),
      {
        fecha: new Date(data.fecha).toISOString(),
        nota: data.nota,
      },
    );
  }

  reservasPorUsuario(_usuarioId: number) {
    return this.http
      .get<ApiListResponse<any>>(buildApiUrl('/me/reservas'))
      .pipe(map((response) => extractItems(response)));
  }

  crear(reserva: {
    fecha: string;
    nota: string;
    negocioId: number;
    usuarioId: number;
  }): Observable<any> {
    return this.http.post<any>(
      buildApiUrl(`/negocios/${reserva.negocioId}/reservas`),
      {
        fecha: new Date(reserva.fecha).toISOString(),
        nota: reserva.nota,
      },
    );
  }

  cancelarReserva(id: number) {
    return this.http.delete(buildApiUrl(`/reservas/${id}`));
  }

  /** GET /api/negocios/:id/availability?date=YYYY-MM-DD&recursoId=:n */
  availability(negocioId: number, date: string, recursoId?: number): Observable<AvailabilityResponse> {
    let params = new HttpParams().set('date', date);
    if (recursoId !== undefined) params = params.set('recursoId', String(recursoId));
    return this.http.get<AvailabilityResponse>(
      buildApiUrl(`/negocios/${negocioId}/availability`),
      { params },
    );
  }

  /** GET /api/negocios/:id/reservas — listado para gestión del negocio */
  listByNegocio(negocioId: number, options: QueryNegocioReservasOptions = {}): Observable<any[]> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', String(options.page));
    if (options.limit) params = params.set('limit', String(options.limit));
    if (options.estado) params = params.set('estado', options.estado);
    if (options.recursoId) params = params.set('recursoId', String(options.recursoId));
    if (options.usuarioId) params = params.set('usuarioId', String(options.usuarioId));
    if (options.from) params = params.set('from', options.from);
    if (options.to) params = params.set('to', options.to);
    return this.http
      .get<any[] | ApiListResponse<any>>(
        buildApiUrl(`/negocios/${negocioId}/reservas`),
        { params },
      )
      .pipe(map((response) => extractItems(response)));
  }

  getReservasPorNegocio(negocioId: number, options: QueryNegocioReservasOptions = {}): Observable<any[]> {
    return this.listByNegocio(negocioId, options);
  }

  /** GET /api/reservas/:id */
  getById(id: number): Observable<any> {
    return this.http.get<any>(buildApiUrl(`/reservas/${id}`));
  }

  /** PATCH /api/reservas/:id — actualizar estado */
  actualizarEstado(id: number, payload: UpdateReservaEstadoPayload): Observable<any> {
    return this.http.patch<any>(buildApiUrl(`/reservas/${id}`), payload);
  }

}
