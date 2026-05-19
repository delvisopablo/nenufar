import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';
import {
  ReviewProductChip,
  SuggestedReviewProduct,
} from '../../core/reviews/review-products';

export interface Resena {
  id: number;
  negocioId: number;
  usuarioId?: number;
  puntuacion: number;
  contenido?: string;
  selloNenufar?: boolean;
  creadoEn?: string;
  productoId?: number | null;
  postId?: number | null;
  likesCount?: number;
  likedByMe?: boolean;
  comentariosCount?: number;
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
  [key: string]: unknown;
}

export interface ComentarioResena {
  id: number;
  resenaId?: number;
  postId?: number;
  usuarioId?: number;
  contenido: string;
  creadoEn?: string;
  actualizadoEn?: string;
  usuario?: {
    id?: number;
    nombre?: string;
    nickname?: string;
    foto?: string | null;
  } | null;
  [key: string]: unknown;
}

export interface ResenaLikeResponse {
  ok?: boolean;
  resenaId?: number;
  usuarioId?: number;
  liked?: boolean;
  likedByMe?: boolean;
  likesCount?: number;
  count?: number;
  [key: string]: unknown;
}

export interface CreateResenaPayload {
  negocioId: number;
  puntuacion: number;
  contenido?: string;
  selloNenufar?: boolean;
  productoIds?: number[];
  productosSugeridos?: SuggestedReviewProduct[];
}

export interface UpdateResenaPayload {
  puntuacion?: number;
  contenido?: string;
  selloNenufar?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ResenaService {
  private readonly baseUrl = buildApiUrl('/resena');

  constructor(private http: HttpClient) {}

  // ── Lecturas existentes (no las toco) ────────────────────────────────────────
  obtenerUltimas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/ultimas`);
  }

  getMediaPorNegocio(negocioId: number): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/media/${negocioId}`);
  }

  getResenasPorUsuario(usuarioId: number) {
    return this.http.get<any[]>(`${this.baseUrl}/usuario/${usuarioId}`);
  }

  // ── Nuevos métodos para CRUD completo ────────────────────────────────────────

  /** GET /api/resena — todas las reseñas (global) */
  todas(): Observable<Resena[]> {
    return this.http
      .get<Resena[] | ApiListResponse<Resena>>(this.baseUrl)
      .pipe(map((response) => extractItems(response)));
  }

  /** GET /api/resena/negocio/:id */
  porNegocio(negocioId: number): Observable<Resena[]> {
    return this.http
      .get<Resena[] | ApiListResponse<Resena>>(
        `${this.baseUrl}/negocio/${negocioId}`,
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** POST /api/resena — crear reseña (requiere auth, userId del backend) */
  crear(payload: CreateResenaPayload): Observable<Resena> {
    return this.http.post<Resena>(this.baseUrl, payload);
  }

  /** Alias POST /api/resenas (controller alias) */
  crearAlias(payload: CreateResenaPayload): Observable<Resena> {
    return this.http.post<Resena>(buildApiUrl('/resenas'), payload);
  }

  /** PATCH /api/resena/:id — actualizar reseña (solo autor) */
  actualizar(id: number, payload: UpdateResenaPayload): Observable<Resena> {
    return this.http.patch<Resena>(`${this.baseUrl}/${id}`, payload);
  }

  /** DELETE /api/resena/:id — eliminar reseña (solo autor) */
  eliminar(id: number): Observable<unknown> {
    return this.http.delete<unknown>(`${this.baseUrl}/${id}`);
  }

  /** GET /api/resena/:id/comentarios */
  listComentarios(id: number): Observable<ComentarioResena[]> {
    return this.http
      .get<ComentarioResena[] | ApiListResponse<ComentarioResena>>(
        `${this.baseUrl}/${id}/comentarios`,
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** POST /api/resena/:id/comentarios — body: { contenido } */
  crearComentario(id: number, contenido: string): Observable<ComentarioResena> {
    return this.http.post<ComentarioResena>(
      `${this.baseUrl}/${id}/comentarios`,
      { contenido },
    );
  }

  /** POST /api/resena/:id/like */
  like(id: number): Observable<ResenaLikeResponse> {
    return this.http.post<ResenaLikeResponse>(`${this.baseUrl}/${id}/like`, {});
  }

  /** DELETE /api/resena/:id/like */
  unlike(id: number): Observable<ResenaLikeResponse> {
    return this.http.delete<ResenaLikeResponse>(`${this.baseUrl}/${id}/like`);
  }
}
