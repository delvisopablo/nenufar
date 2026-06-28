import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
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
  fotoPerfil?: string | null;
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
  fotoPerfil?: string | null;
}

export interface FotoPerfilUploadResponse {
  ok?: boolean;
  usuario?: PerfilUsuarioResponse;
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

export interface UsuarioBusquedaResultado {
  id: number;
  nombre: string;
  nickname: string;
  foto?: string | null;
  fotoPerfil?: string | null;
  biografia?: string | null;
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

  /**
   * Busca perfiles públicos por nombre o nickname. Intenta primero
   * GET /usuarios/buscar?q=<texto> y cae a GET /buscar?q=<texto> si el backend
   * expone un buscador global; siempre normaliza a campos públicos.
   */
  buscar(query: string): Observable<UsuarioBusquedaResultado[]> {
    const normalized = query.trim();
    if (!normalized) {
      return of([]);
    }

    return this.http
      .get<unknown>(
        buildApiUrl('/usuarios/buscar'),
        { params: new HttpParams().set('q', normalized) },
      )
      .pipe(
        map((response) => this.extraerUsuariosBusqueda(response, true)),
        catchError(() => this.buscarEnEndpointGlobal(normalized)),
      );
  }

  private buscarEnEndpointGlobal(query: string): Observable<UsuarioBusquedaResultado[]> {
    return this.http
      .get<unknown>(
        buildApiUrl('/buscar'),
        { params: new HttpParams().set('q', query) },
      )
      .pipe(
        map((response) => this.extraerUsuariosBusqueda(response, false)),
        catchError(() => of([] as UsuarioBusquedaResultado[])),
      );
  }

  private extraerUsuariosBusqueda(
    response: unknown,
    asumirUsuarios: boolean,
  ): UsuarioBusquedaResultado[] {
    const nestedResults = this.readObject(response, ['resultados', 'results', 'data']);
    const explicitUsers = [
      ...this.readArray(response, ['usuarios', 'users', 'personas']),
      ...this.readArray(nestedResults, ['usuarios', 'users', 'personas']),
    ];
    const genericItems = this.readArray(response, ['items', 'results', 'resultados', 'data']);
    const source = explicitUsers.length
      ? explicitUsers
      : genericItems.length
        ? genericItems
        : extractItems(response as UsuarioBusquedaResultado[] | ApiListResponse<UsuarioBusquedaResultado>);

    return source
      .map((item) => this.resolveUsuarioBusquedaItem(item, asumirUsuarios || explicitUsers.length > 0))
      .filter((item): item is UsuarioBusquedaResultado => item !== null);
  }

  private resolveUsuarioBusquedaItem(
    item: unknown,
    asumirUsuario: boolean,
  ): UsuarioBusquedaResultado | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const record = item as Record<string, unknown>;
    const tipo = String(record['tipo'] ?? record['type'] ?? record['kind'] ?? '').trim().toLowerCase();
    const rawUsuario = record['usuario'] ?? record['user'] ?? record['persona'];
    const candidate = rawUsuario && typeof rawUsuario === 'object'
      ? rawUsuario
      : asumirUsuario || ['usuario', 'user', 'persona', 'person'].includes(tipo)
        ? item
        : null;

    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    return this.normalizarUsuarioBusqueda(candidate as Record<string, unknown>);
  }

  private normalizarUsuarioBusqueda(record: Record<string, unknown>): UsuarioBusquedaResultado | null {
    const id = Number(record['id'] ?? record['usuarioId'] ?? record['userId']);
    const nombre = String(record['nombre'] ?? record['name'] ?? '').trim();
    const nickname = String(record['nickname'] ?? record['username'] ?? '').trim();

    if (!Number.isFinite(id) || id <= 0 || !nombre || !nickname) {
      return null;
    }

    const fotoPerfil = this.cleanOptionalString(record['fotoPerfil'] ?? record['foto_perfil'] ?? record['avatar']);
    const foto = this.cleanOptionalString(record['foto'] ?? record['image']);
    const biografia = this.cleanOptionalString(record['biografia'] ?? record['bio']);

    return {
      id,
      nombre,
      nickname,
      ...(fotoPerfil ? { fotoPerfil } : {}),
      ...(foto ? { foto } : {}),
      ...(biografia ? { biografia } : {}),
    };
  }

  private readArray(response: unknown, keys: string[]): unknown[] {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return [];
    }

    const record = response as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  private readObject(response: unknown, keys: string[]): Record<string, unknown> | null {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return null;
    }

    const record = response as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    }

    return null;
  }

  private cleanOptionalString(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

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
      { withCredentials: true },
    );
  }

  subirFotoPerfil(file: File): Observable<PerfilUsuarioResponse> {
    const formData = new FormData();
    formData.append('fotoPerfil', file);

    return this.http
      .post<FotoPerfilUploadResponse | PerfilUsuarioResponse>(
        buildApiUrl('/usuario/me/foto-perfil'),
        formData,
        { withCredentials: true },
      )
      .pipe(
        map((response) =>
          'usuario' in response && response.usuario
            ? response.usuario
            : (response as PerfilUsuarioResponse),
        ),
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
        { withCredentials: true },
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** GET /api/usuario/:id/siguiendo */
  getSiguiendo(id: number): Observable<SeguidorEntry[]> {
    return this.http
      .get<SeguidorEntry[] | ApiListResponse<SeguidorEntry>>(
        buildApiUrl(`/usuario/${id}/siguiendo`),
        { withCredentials: true },
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** POST /api/usuario/:id/seguir */
  seguir(id: number): Observable<unknown> {
    return this.http.post<unknown>(
      buildApiUrl(`/usuario/${id}/seguir`),
      {},
      { withCredentials: true },
    );
  }

  /** DELETE /api/usuario/:id/seguir */
  dejarDeSeguir(id: number): Observable<unknown> {
    return this.http.delete<unknown>(
      buildApiUrl(`/usuario/${id}/seguir`),
      { withCredentials: true },
    );
  }

  /** DELETE /api/usuario/:id */
  borrar(id: number): Observable<unknown> {
    return this.http.delete<unknown>(
      buildApiUrl(`/usuario/${id}`),
      { withCredentials: true },
    );
  }

}
