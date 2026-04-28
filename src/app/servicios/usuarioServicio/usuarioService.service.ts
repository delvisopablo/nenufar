import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { buildApiUrl } from '../../config/api.config';

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
    creadoEn?: string;
    fecha?: string;
    negocio?: {
      id: number;
      nombre: string;
      slug?: string | null;
    };
  }>;
}

export interface UpdatePerfilPayload {
  nombre?: string;
  biografia?: string | null;
  foto?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class UsuarioServiceService {
  constructor(private readonly http: HttpClient) {}

  getByNickname(nickname: string): Observable<PerfilUsuarioResponse> {
    return this.http.get<PerfilUsuarioResponse>(buildApiUrl(`/usuario/by-nickname/${nickname}`));
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
}
