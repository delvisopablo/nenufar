import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { buildApiUrl } from '../../config/api.config';

interface AdminCollectionResponse<T> {
  items: T[];
  total: number;
}

export interface AdminUsuario {
  id: number;
  nombre: string;
  nickname: string;
  email: string;
  rolGlobal: string;
  estadoCuenta: string;
  eliminadoEn?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
  ultimoLoginEn?: string | null;
  _count?: {
    negocios?: number;
    resenas?: number;
    reservas?: number;
  };
}

export interface AdminNegocio {
  id: number;
  nombre: string;
  slug?: string | null;
  activo: boolean;
  verificado?: boolean;
  eliminadoEn?: string | null;
  creadoEn?: string;
  categoria?: {
    id?: number;
    nombre?: string;
  } | null;
  dueno?: {
    id?: number;
    nombre?: string;
    nickname?: string;
    email?: string;
  } | null;
  _count?: {
    resenas?: number;
    promociones?: number;
    reservas?: number;
    productos?: number;
  };
}

export interface AdminResena {
  id: number;
  contenido: string;
  puntuacion: number;
  estado: string;
  creadoEn?: string;
  actualizadoEn?: string;
  eliminadoEn?: string | null;
  usuario?: {
    id?: number;
    nombre?: string;
    nickname?: string;
    email?: string;
  } | null;
  negocio?: {
    id?: number;
    nombre?: string;
    slug?: string | null;
  } | null;
}

export interface AdminPromocion {
  id: number;
  titulo: string;
  descripcion?: string | null;
  descuento?: string | number;
  tipoDescuento?: string;
  activa: boolean;
  estado: string;
  fechaInicio?: string | null;
  fechaCaducidad?: string | null;
  creadoEn?: string;
  eliminadoEn?: string | null;
  negocio?: {
    id?: number;
    nombre?: string;
    slug?: string | null;
  } | null;
}

export interface AdminReserva {
  id: number;
  fecha: string;
  estado: string;
  canceladaEn?: string | null;
  motivoCancelacion?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
  numPersonas?: number | null;
  usuario?: {
    id?: number;
    nombre?: string;
    nickname?: string;
    email?: string;
  } | null;
  negocio?: {
    id?: number;
    nombre?: string;
    slug?: string | null;
  } | null;
  recurso?: {
    id?: number;
    nombre?: string;
  } | null;
}

export interface AdminLogEntry {
  id: number;
  accion: string;
  entidad: string;
  entidadId?: number | null;
  motivo?: string | null;
  creadoEn: string;
  admin?: {
    id?: number;
    nombre?: string;
    nickname?: string;
    email?: string;
  } | null;
}

export interface AdminActionResponse<T = unknown> {
  ok: boolean;
  message: string;
  item?: T;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private readonly http: HttpClient) {}

  listUsuarios(): Observable<AdminUsuario[]> {
    return this.http
      .get<AdminCollectionResponse<AdminUsuario>>(buildApiUrl('/admin/usuarios'), {
        withCredentials: true,
      })
      .pipe(map((response) => response.items ?? []));
  }

  deleteUsuario(id: number, motivo?: string): Observable<AdminActionResponse<AdminUsuario>> {
    return this.http.delete<AdminActionResponse<AdminUsuario>>(
      buildApiUrl(`/admin/usuarios/${id}`),
      {
        withCredentials: true,
        body: this.buildReasonBody(motivo),
      },
    );
  }

  suspenderUsuario(id: number, motivo?: string): Observable<AdminActionResponse<AdminUsuario>> {
    return this.http.patch<AdminActionResponse<AdminUsuario>>(
      buildApiUrl(`/admin/usuarios/${id}/suspender`),
      this.buildReasonBody(motivo),
      { withCredentials: true },
    );
  }

  activarUsuario(id: number, motivo?: string): Observable<AdminActionResponse<AdminUsuario>> {
    return this.http.patch<AdminActionResponse<AdminUsuario>>(
      buildApiUrl(`/admin/usuarios/${id}/activar`),
      this.buildReasonBody(motivo),
      { withCredentials: true },
    );
  }

  listNegocios(): Observable<AdminNegocio[]> {
    return this.http
      .get<AdminCollectionResponse<AdminNegocio>>(buildApiUrl('/admin/negocios'), {
        withCredentials: true,
      })
      .pipe(map((response) => response.items ?? []));
  }

  deleteNegocio(id: number, motivo?: string): Observable<AdminActionResponse<AdminNegocio>> {
    return this.http.delete<AdminActionResponse<AdminNegocio>>(
      buildApiUrl(`/admin/negocios/${id}`),
      {
        withCredentials: true,
        body: this.buildReasonBody(motivo),
      },
    );
  }

  activarNegocio(id: number, motivo?: string): Observable<AdminActionResponse<AdminNegocio>> {
    return this.http.patch<AdminActionResponse<AdminNegocio>>(
      buildApiUrl(`/admin/negocios/${id}/activar`),
      this.buildReasonBody(motivo),
      { withCredentials: true },
    );
  }

  desactivarNegocio(id: number, motivo?: string): Observable<AdminActionResponse<AdminNegocio>> {
    return this.http.patch<AdminActionResponse<AdminNegocio>>(
      buildApiUrl(`/admin/negocios/${id}/desactivar`),
      this.buildReasonBody(motivo),
      { withCredentials: true },
    );
  }

  listResenas(): Observable<AdminResena[]> {
    return this.http
      .get<AdminCollectionResponse<AdminResena>>(buildApiUrl('/admin/resenas'), {
        withCredentials: true,
      })
      .pipe(map((response) => response.items ?? []));
  }

  deleteResena(id: number, motivo?: string): Observable<AdminActionResponse<AdminResena>> {
    return this.http.delete<AdminActionResponse<AdminResena>>(
      buildApiUrl(`/admin/resenas/${id}`),
      {
        withCredentials: true,
        body: this.buildReasonBody(motivo),
      },
    );
  }

  ocultarResena(id: number, motivo?: string): Observable<AdminActionResponse<AdminResena>> {
    return this.http.patch<AdminActionResponse<AdminResena>>(
      buildApiUrl(`/admin/resenas/${id}/ocultar`),
      this.buildReasonBody(motivo),
      { withCredentials: true },
    );
  }

  publicarResena(id: number, motivo?: string): Observable<AdminActionResponse<AdminResena>> {
    return this.http.patch<AdminActionResponse<AdminResena>>(
      buildApiUrl(`/admin/resenas/${id}/publicar`),
      this.buildReasonBody(motivo),
      { withCredentials: true },
    );
  }

  listPromociones(): Observable<AdminPromocion[]> {
    return this.http
      .get<AdminCollectionResponse<AdminPromocion>>(buildApiUrl('/admin/promociones'), {
        withCredentials: true,
      })
      .pipe(map((response) => response.items ?? []));
  }

  deletePromocion(
    id: number,
    motivo?: string,
  ): Observable<AdminActionResponse<AdminPromocion>> {
    return this.http.delete<AdminActionResponse<AdminPromocion>>(
      buildApiUrl(`/admin/promociones/${id}`),
      {
        withCredentials: true,
        body: this.buildReasonBody(motivo),
      },
    );
  }

  ocultarPromocion(
    id: number,
    motivo?: string,
  ): Observable<AdminActionResponse<AdminPromocion>> {
    return this.http.patch<AdminActionResponse<AdminPromocion>>(
      buildApiUrl(`/admin/promociones/${id}/ocultar`),
      this.buildReasonBody(motivo),
      { withCredentials: true },
    );
  }

  publicarPromocion(
    id: number,
    motivo?: string,
  ): Observable<AdminActionResponse<AdminPromocion>> {
    return this.http.patch<AdminActionResponse<AdminPromocion>>(
      buildApiUrl(`/admin/promociones/${id}/publicar`),
      this.buildReasonBody(motivo),
      { withCredentials: true },
    );
  }

  listReservas(): Observable<AdminReserva[]> {
    return this.http
      .get<AdminCollectionResponse<AdminReserva>>(buildApiUrl('/admin/reservas'), {
        withCredentials: true,
      })
      .pipe(map((response) => response.items ?? []));
  }

  deleteReserva(id: number, motivo?: string): Observable<AdminActionResponse<AdminReserva>> {
    return this.http.delete<AdminActionResponse<AdminReserva>>(
      buildApiUrl(`/admin/reservas/${id}`),
      {
        withCredentials: true,
        body: this.buildReasonBody(motivo),
      },
    );
  }

  cancelarReserva(id: number, motivo?: string): Observable<AdminActionResponse<AdminReserva>> {
    return this.http.patch<AdminActionResponse<AdminReserva>>(
      buildApiUrl(`/admin/reservas/${id}/cancelar`),
      this.buildReasonBody(motivo),
      { withCredentials: true },
    );
  }

  listLogs(): Observable<AdminLogEntry[]> {
    return this.http
      .get<AdminCollectionResponse<AdminLogEntry>>(buildApiUrl('/admin/logs'), {
        withCredentials: true,
      })
      .pipe(map((response) => response.items ?? []));
  }

  private buildReasonBody(motivo?: string) {
    const normalized = typeof motivo === 'string' ? motivo.trim() : '';
    return normalized ? { motivo: normalized } : {};
  }
}
