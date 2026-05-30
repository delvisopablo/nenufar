import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import {
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

export interface ReservaUsuarioResumen {
  id?: number;
  nombre?: string;
  nickname?: string;
  foto?: string | null;
}

export interface ReservaNegocioResumen {
  id?: number;
  nombre?: string;
  nickname?: string | null;
}

export interface ReservaRecord {
  id: number;
  fecha: string;
  estado: ReservaEstado;
  usuarioId?: number;
  negocioId?: number;
  nota?: string;
  duracionMinutos?: number | null;
  numPersonas?: number | null;
  canceladaEn?: string | null;
  motivoCancelacion?: string | null;
  creadoEn?: string | null;
  actualizadoEn?: string | null;
  usuario?: ReservaUsuarioResumen;
  negocio?: ReservaNegocioResumen;
  recurso?: {
    id?: number;
    nombre?: string;
    capacidad?: number | null;
  } | null;
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

export interface QueryMisReservasOptions {
  page?: number;
  limit?: number;
}

export interface UpdateReservaEstadoPayload {
  estado: ReservaEstado;
  motivoCancelacion?: string;
}

export interface CreateReservaPayload {
  negocioId: number;
  fecha: string;
  nota?: string;
  duracionMinutos?: number;
  numPersonas?: number;
  recursoId?: number;
}

export interface UpdateReservaPayload {
  fecha?: string;
  nota?: string;
  duracionMinutos?: number;
  numPersonas?: number;
  motivoCancelacion?: string;
  estado?: ReservaEstado;
}

@Injectable({ providedIn: 'root' })
export class ReservaService {
  constructor(private http: HttpClient) {}

  getMisReservas(options: QueryMisReservasOptions = {}): Observable<ReservaRecord[]> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', String(options.page));
    if (options.limit) params = params.set('limit', String(options.limit));

    return this.http
      .get<unknown>(
        buildApiUrl('/reservas/mis-reservas'),
        { params, withCredentials: true },
      )
      .pipe(
        map((response) => this.normalizeReservaCollection(response)),
        catchError((error: unknown) => {
          if (!this.isNotImplementedAlias(error)) {
            return throwError(() => error);
          }

          return this.http
            .get<unknown>(
              buildApiUrl('/me/reservas'),
              { params, withCredentials: true },
            )
            .pipe(map((response) => this.normalizeReservaCollection(response)));
        }),
      );
  }

  reservasPorUsuario(_usuarioId: number) {
    return this.getMisReservas();
  }

  crear(reserva: {
    fecha: string;
    nota: string;
    negocioId: number;
    usuarioId: number;
  }): Observable<ReservaRecord> {
    return this.crearReserva({
      negocioId: reserva.negocioId,
      fecha: reserva.fecha,
      nota: reserva.nota,
    });
  }

  crearReserva(data: CreateReservaPayload): Observable<ReservaRecord> {
    const payload = {
      negocioId: data.negocioId,
      fecha: new Date(data.fecha).toISOString(),
      nota: data.nota?.trim() || undefined,
      duracionMinutos: data.duracionMinutos,
      numPersonas: data.numPersonas,
      recursoId: data.recursoId,
    };

    return this.http
      .post<unknown>(
        buildApiUrl('/reservas'),
        payload,
        { withCredentials: true },
      )
      .pipe(
        map((response) => this.normalizeReserva(response)),
        catchError((error: unknown) => {
          if (!this.isNotImplementedAlias(error)) {
            return throwError(() => error);
          }

          return this.http
            .post<unknown>(
              buildApiUrl(`/negocios/${data.negocioId}/reservas`),
              {
                fecha: payload.fecha,
                nota: payload.nota,
                duracionMinutos: payload.duracionMinutos,
                numPersonas: payload.numPersonas,
                recursoId: payload.recursoId,
              },
              { withCredentials: true },
            )
            .pipe(map((response) => this.normalizeReserva(response)));
        }),
      );
  }

  cancelarReserva(id: number, motivo?: string): Observable<ReservaRecord | null> {
    return this.actualizarEstadoReserva(id, 'CANCELADA', motivo).pipe(
      catchError((error: unknown) => {
        if (!this.isNotImplementedAlias(error)) {
          return throwError(() => error);
        }

          return this.http.delete(
            buildApiUrl(`/reservas/${id}`),
            { withCredentials: true },
          ).pipe(map(() => null));
      }),
    );
  }

  /** GET /api/negocios/:id/availability?date=YYYY-MM-DD&recursoId=:n */
  availability(negocioId: number, date: string, recursoId?: number): Observable<AvailabilityResponse> {
    let params = new HttpParams().set('date', date);
    if (recursoId !== undefined) params = params.set('recursoId', String(recursoId));
    return this.http.get<AvailabilityResponse>(
      buildApiUrl(`/negocios/${negocioId}/availability`),
      { params, withCredentials: true },
    );
  }

  /** GET /api/negocios/:id/reservas — listado para gestión del negocio */
  listByNegocio(negocioId: number, options: QueryNegocioReservasOptions = {}): Observable<ReservaRecord[]> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', String(options.page));
    if (options.limit) params = params.set('limit', String(options.limit));
    if (options.estado) params = params.set('estado', options.estado);
    if (options.recursoId) params = params.set('recursoId', String(options.recursoId));
    if (options.usuarioId) params = params.set('usuarioId', String(options.usuarioId));
    if (options.from) params = params.set('from', options.from);
    if (options.to) params = params.set('to', options.to);
    return this.http
      .get<unknown>(
        buildApiUrl(`/negocios/${negocioId}/reservas`),
        { params, withCredentials: true },
      )
      .pipe(map((response) => this.normalizeReservaCollection(response)));
  }

  getReservasPorNegocio(negocioId: number, options: QueryNegocioReservasOptions = {}): Observable<ReservaRecord[]> {
    return this.listByNegocio(negocioId, options);
  }

  /** GET /api/reservas/:id */
  getById(id: number): Observable<ReservaRecord> {
    return this.http
      .get<unknown>(
        buildApiUrl(`/reservas/${id}`),
        { withCredentials: true },
      )
      .pipe(map((response) => this.normalizeReserva(response)));
  }

  actualizarReserva(id: number, payload: UpdateReservaPayload): Observable<ReservaRecord> {
    const normalizedPayload = {
      ...payload,
      ...(payload.fecha ? { fecha: new Date(payload.fecha).toISOString() } : {}),
      ...(payload.nota !== undefined ? { nota: payload.nota?.trim() || '' } : {}),
      ...(payload.motivoCancelacion !== undefined
        ? { motivoCancelacion: payload.motivoCancelacion?.trim() || '' }
        : {}),
    };

    return this.http
      .patch<unknown>(
        buildApiUrl(`/reservas/${id}`),
        normalizedPayload,
        { withCredentials: true },
      )
      .pipe(map((response) => this.normalizeReserva(response)));
  }

  /** PATCH /api/reservas/:id/estado */
  actualizarEstadoReserva(
    id: number,
    estado: ReservaEstado,
    motivoCancelacion?: string,
  ): Observable<ReservaRecord> {
    const payload: UpdateReservaEstadoPayload = {
      estado,
      ...(motivoCancelacion?.trim() ? { motivoCancelacion: motivoCancelacion.trim() } : {}),
    };

    return this.http
      .patch<unknown>(
        buildApiUrl(`/reservas/${id}/estado`),
        payload,
        { withCredentials: true },
      )
      .pipe(
        map((response) => this.normalizeReserva(response)),
        catchError((error: unknown) => {
          if (!this.isNotImplementedAlias(error)) {
            return throwError(() => error);
          }

          return this.http
            .patch<unknown>(
              buildApiUrl(`/reservas/${id}`),
              payload,
              { withCredentials: true },
            )
            .pipe(map((response) => this.normalizeReserva(response)));
        }),
      );
  }

  actualizarEstado(id: number, payload: UpdateReservaEstadoPayload): Observable<ReservaRecord> {
    return this.actualizarEstadoReserva(id, payload.estado, payload.motivoCancelacion);
  }

  private normalizeReservaCollection(response: unknown): ReservaRecord[] {
    const items = Array.isArray(response)
      ? response
      : extractItems(response as ApiListResponse<unknown>);

    return items.map((item) => this.normalizeReserva(item));
  }

  private normalizeReserva(response: unknown): ReservaRecord {
    const raw = (response && typeof response === 'object'
      ? response
      : {}) as Record<string, unknown>;
    const usuarioRaw =
      this.asRecord(raw['usuario']) ??
      this.asRecord(raw['user']) ??
      this.asRecord(raw['cliente']) ??
      {};
    const negocioRaw =
      this.asRecord(raw['negocio']) ??
      this.asRecord(raw['business']) ??
      {};
    const recursoRaw =
      this.asRecord(raw['recurso']) ??
      this.asRecord(raw['recursoReserva']);

    return {
      id: Number(raw['id'] ?? 0) || 0,
      fecha: String(raw['fecha'] ?? new Date().toISOString()),
      estado: String(raw['estado'] ?? 'PENDIENTE'),
      usuarioId: this.toOptionalNumber(raw['usuarioId']),
      negocioId: this.toOptionalNumber(raw['negocioId']),
      nota: this.toOptionalString(raw['nota']) ?? '',
      duracionMinutos: this.toOptionalNumber(raw['duracionMinutos']),
      numPersonas: this.toOptionalNumber(raw['numPersonas']) ?? 1,
      canceladaEn: this.toOptionalString(raw['canceladaEn']),
      motivoCancelacion: this.toOptionalString(raw['motivoCancelacion']),
      creadoEn: this.toOptionalString(raw['creadoEn']),
      actualizadoEn: this.toOptionalString(raw['actualizadoEn']),
      usuario: Object.keys(usuarioRaw).length
        ? {
            id: this.toOptionalNumber(usuarioRaw['id']),
            nombre:
              this.toOptionalString(usuarioRaw['nombre']) ??
              this.toOptionalString(usuarioRaw['autorNombre']) ??
              this.toOptionalString(usuarioRaw['nickname']) ??
              'Cliente de Nenúfar',
            nickname: this.toOptionalString(usuarioRaw['nickname']) ?? undefined,
            foto:
              this.toOptionalString(usuarioRaw['foto']) ??
              this.toOptionalString(usuarioRaw['foto_perfil']) ??
              null,
          }
        : undefined,
      negocio: Object.keys(negocioRaw).length
        ? {
            id: this.toOptionalNumber(negocioRaw['id']),
            nombre: this.toOptionalString(negocioRaw['nombre']) ?? 'Negocio',
            nickname:
              this.toOptionalString(negocioRaw['nickname']) ??
              this.toOptionalString(negocioRaw['slug']) ??
              null,
          }
        : undefined,
      recurso: recursoRaw
        ? {
            id: this.toOptionalNumber(recursoRaw['id']),
            nombre: this.toOptionalString(recursoRaw['nombre']) ?? 'Recurso',
            capacidad: this.toOptionalNumber(recursoRaw['capacidad']),
          }
        : null,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private isNotImplementedAlias(error: unknown): boolean {
    return (
      error instanceof HttpErrorResponse &&
      (error.status === 404 || error.status === 405)
    );
  }
}
