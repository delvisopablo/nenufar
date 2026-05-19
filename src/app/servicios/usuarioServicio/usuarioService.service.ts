import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { ApiListResponse, buildApiUrl, extractItems } from '../../config/api.config';
import { map } from 'rxjs/operators';
import {
  ReviewProductChip,
  SuggestedReviewProduct,
} from '../../core/reviews/review-products';

export interface PerfilUsuarioResponse {
  id: number;
  nombre: string;
  nickname: string;
  email?: string;
  foto?: string | null;
  foto_perfil?: string | null;
  biografia?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
  petalosSaldo?: number;
  rolGlobal?: string;
  _count?: {
    seguidores?: number;
    siguiendo?: number;
    siguiendoNegocios?: number;
    resenas?: number;
    negocios?: number;
  };
  negocios?: Array<{
    id: number;
    nombre: string;
    slug?: string | null;
    fotoPerfil?: string | null;
    ciudad?: string | null;
    verificado?: boolean;
  }>;
  resenas?: Array<{
    id: number;
    contenido?: string;
    comentario?: string;
    puntuacion: number;
    selloNenufar?: boolean;
    creadoEn?: string;
    fecha?: string;
    productoId?: number | null;
    productoNombre?: string | null;
    precioProducto?: number | null;
    producto?: {
      id?: number;
      nombre?: string;
      precio?: number | null;
    } | null;
    productos?: ReviewProductChip[];
    productoIds?: number[];
    productosSugeridos?: SuggestedReviewProduct[];
    negocio?: {
      id: number;
      nombre: string;
      slug?: string | null;
      nickname?: string | null;
    };
  }>;
}

export interface UpdatePerfilPayload {
  nombre?: string;
  biografia?: string | null;
  foto?: string | null;
}


export interface UsuarioBasico {
  id: number;
  nombre: string;
  nickname: string;
  foto?: string | null;
  biografia?: string | null;
  [key: string]: unknown;
}

export interface SeguidorEntry {
  id: number;
  creadoEn?: string;
  usuario: UsuarioBasico;
  [key: string]: unknown;
}

export interface CreateUsuarioPayload {
  nombre: string;
  nickname: string;
  email: string;
  password: string;
  nombreNegocio?: string;
  tipoNegocio?: string;
  fotoPerfil?: string;
  biografia?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UsuarioServiceService {
  constructor(private readonly http: HttpClient) {}

  getByNickname(nickname: string): Observable<PerfilUsuarioResponse> {
    // TODO(backend): consolidar este lookup publico en GET /usuarios/nickname/:nickname.
    // Mientras tanto, mantenemos compatibilidad con el endpoint actual /usuario/by-nickname/:nickname.
    return this.http
      .get<PerfilUsuarioResponse>(buildApiUrl(`/usuarios/nickname/${nickname}`))
      .pipe(
        catchError(() =>
          this.http.get<PerfilUsuarioResponse>(buildApiUrl(`/usuario/by-nickname/${nickname}`))
        ),
      );
  }

  updatePerfil(
    id: number,
    payload: UpdatePerfilPayload,
  ): Observable<PerfilUsuarioResponse> {
    return this.http.patch<PerfilUsuarioResponse>(
      buildApiUrl(`/usuario/${id}`),
      payload,
    );
  }

  /** POST /api/usuario — alta básica de usuario (también disponible vía /auth/registro) */
  crear(payload: CreateUsuarioPayload): Observable<PerfilUsuarioResponse> {
    return this.http.post<PerfilUsuarioResponse>(
      buildApiUrl('/usuario'),
      payload,
    );
  }

  /** GET /api/usuario/:id */
  getById(id: number): Observable<PerfilUsuarioResponse> {
    return this.http.get<PerfilUsuarioResponse>(buildApiUrl(`/usuario/${id}`));
  }

  /** GET /api/usuario/:id/seguidores */
  getSeguidores(id: number): Observable<SeguidorEntry[]> {
    return this.http
      .get<SeguidorEntry[] | ApiListResponse<SeguidorEntry>>(
        buildApiUrl(`/usuario/${id}/seguidores`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** GET /api/usuario/:id/siguiendo */
  getSiguiendo(id: number): Observable<SeguidorEntry[]> {
    return this.http
      .get<SeguidorEntry[] | ApiListResponse<SeguidorEntry>>(
        buildApiUrl(`/usuario/${id}/siguiendo`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** POST /api/usuario/:id/seguir */
  seguir(id: number): Observable<unknown> {
    return this.http.post<unknown>(buildApiUrl(`/usuario/${id}/seguir`), {});
  }

  /** DELETE /api/usuario/:id/seguir */
  dejarDeSeguir(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/usuario/${id}/seguir`));
  }

  /** DELETE /api/usuario/:id */
  borrar(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/usuario/${id}`));
  }

}
