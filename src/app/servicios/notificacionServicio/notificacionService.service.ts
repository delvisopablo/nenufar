import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export type NotificacionTipo =
  | 'PROMOCION'
  | 'POST'
  | 'NEGOCIO'
  | 'RESENA'
  | 'SISTEMA';

export interface Notificacion {
  id: number;
  tipo: NotificacionTipo;
  titulo: string;
  contenido?: string;
  link?: string;
  leida: boolean;
  creadoEn: string;
  leidaEn?: string;
  negocioId?: number;
  promocionId?: number;
  postId?: number;
}

export interface QueryNotificacionesOpts {
  leida?: boolean;
  tipo?: NotificacionTipo;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly http = inject(HttpClient);

  list(opts: QueryNotificacionesOpts = {}): Observable<Notificacion[]> {
    let params = new HttpParams();

    if (opts.leida !== undefined) {
      params = params.set('leida', String(opts.leida));
    }
    if (opts.tipo) {
      params = params.set('tipo', opts.tipo);
    }
    if (opts.page) {
      params = params.set('page', String(opts.page));
    }
    if (opts.limit) {
      params = params.set('limit', String(opts.limit));
    }

    return this.http
      .get<Notificacion[] | ApiListResponse<Notificacion>>(
        buildApiUrl('/me/notificaciones'),
        { params },
      )
      .pipe(map((response) => extractItems(response)));
  }

  unreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(
      buildApiUrl('/me/notificaciones/no-leidas/count'),
    );
  }

  markAsRead(id: number, leida = true): Observable<Notificacion> {
    return this.http.patch<Notificacion>(
      buildApiUrl(`/me/notificaciones/${id}`),
      { leida },
    );
  }

  markAllRead(): Observable<{ actualizadas: number }> {
    return this.http.post<{ actualizadas: number }>(
      buildApiUrl('/me/notificaciones/leer-todas'),
      {},
    );
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete(buildApiUrl(`/me/notificaciones/${id}`));
  }
}

export { NotificacionService as NotificacionServiceService };
