import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export type TipoDescuento =
  | 'PORCENTAJE'
  | 'IMPORTE_FIJO'
  | 'PACK'
  | 'DOS_X_UNO'
  | string;

export type PromocionEstado =
  | 'BORRADOR'
  | 'PUBLICADO'
  | 'OCULTO'
  | 'REPORTADO'
  | 'ELIMINADO'
  | string;

export interface Promocion {
  id: number;
  titulo: string;
  descripcion?: string | null;
  negocioId: number;
  fechaInicio?: string | null;
  fechaCaducidad: string;
  descuento: number;
  tipoDescuento: TipoDescuento;
  activa: boolean;
  estado: PromocionEstado;
  codigo?: string | null;
  stockMaximo?: number | string | null;
  usosMaximos?: number | string | null;
  usosActuales?: number;
  productoId?: number | string | null;
  packIds?: number[] | null;
  [key: string]: unknown;
}

/**
 * Payload que envía la UI al crear/actualizar una promoción.
 * El backend acepta `descripcion?`, `fechaInicio?`, `tipoDescuento?`, etc.
 * Los campos extra (`activa`, `estado`) son aceptados pero pueden no aplicar
 * a todos los flujos del backend.
 */
export interface PromocionMutationPayload {
  titulo: string;
  descripcion?: string | null;
  tipoDescuento: TipoDescuento;
  descuento: number;
  fechaInicio?: string | null;
  fechaCaducidad: string;
  activa?: boolean;
  estado?: PromocionEstado;
  stockMaximo?: number | string | null;
  usosMaximos?: number | string | null;
  codigo?: string | null;
  productoId?: number | string | null;
  packIds?: number[] | null;
}

export interface ValidarPromocionPayload {
  codigo?: string;
}

@Injectable({ providedIn: 'root' })
export class PromocionService {
  private readonly http = inject(HttpClient);

  /** GET /api/promociones/activas — promociones globalmente activas */
  findActivas(): Observable<Promocion[]> {
    return this.http
      .get<Promocion[] | ApiListResponse<Promocion>>(
        buildApiUrl('/promociones/activas'),
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** GET /api/promociones/negocio/:id */
  findByNegocio(negocioId: number): Observable<Promocion[]> {
    return this.http
      .get<Promocion[] | ApiListResponse<Promocion>>(
        buildApiUrl(`/promociones/negocio/${negocioId}`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** Alias usado por el componente de admin de promociones */
  getPromocionesPorNegocio(negocioId: number): Observable<Promocion[]> {
    return this.findByNegocio(negocioId);
  }

  /** POST /api/promociones — crear (negocioId va en el body) */
  crear(payload: PromocionMutationPayload & { negocioId: number }): Observable<Promocion> {
    return this.http.post<Promocion>(buildApiUrl('/promociones'), payload);
  }

  /**
   * Alias usado por el componente: recibe el negocioId aparte y lo añade
   * al payload antes de mandarlo.
   */
  crearPromocion(
    negocioId: number,
    payload: PromocionMutationPayload,
  ): Observable<Promocion> {
    return this.crear({ ...payload, negocioId });
  }

  /** PATCH /api/promociones/:id */
  actualizar(id: number, payload: Partial<PromocionMutationPayload>): Observable<Promocion> {
    return this.http.patch<Promocion>(buildApiUrl(`/promociones/${id}`), payload);
  }

  /** Alias semántico para el componente */
  actualizarPromocion(id: number, payload: Partial<PromocionMutationPayload>): Observable<Promocion> {
    return this.actualizar(id, payload);
  }

  /**
   * Publicar = activar y marcar estado PUBLICADO.
   * El backend de promociones no tiene un endpoint dedicado, lo hacemos
   * vía PATCH con el cambio de estado.
   */
  publicarPromocion(id: number): Observable<Promocion> {
    return this.actualizar(id, { activa: true, estado: 'PUBLICADO' });
  }

  /** Inverso: dejar oculta */
  ocultarPromocion(id: number): Observable<Promocion> {
    return this.actualizar(id, { activa: false, estado: 'OCULTO' });
  }

  /** POST /api/promociones/:id/validar */
  validar(id: number, payload: ValidarPromocionPayload = {}): Observable<unknown> {
    return this.http.post<unknown>(
      buildApiUrl(`/promociones/${id}/validar`),
      payload,
    );
  }

  /** DELETE /api/promociones/:id */
  borrar(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/promociones/${id}`));
  }

  /** Alias semántico para el componente */
  eliminarPromocion(id: number): Observable<unknown> {
    return this.borrar(id);
  }
}

/**
 * Alias retro-compatible con el nombre que generó `ng g service promocionService`.
 * Cualquier código antiguo que importase `PromocionServiceService` sigue funcionando.
 */
export { PromocionService as PromocionServiceService };
