import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export type PostTipo = 'resena' | 'promocion' | 'logro' | string;

export interface Post {
  id: number;
  tipo: PostTipo;
  contenido?: string;
  usuarioId?: number;
  negocioId?: number;
  resenaId?: number;
  promocionId?: number;
  logroId?: number;
  creadoEn?: string;
  [key: string]: unknown;
}

export interface PostLike {
  id?: number;
  postId: number;
  usuarioId: number;
  tipo?: string;
  [key: string]: unknown;
}

export interface PostComentario {
  id: number;
  postId: number;
  usuarioId?: number;
  contenido: string;
  creadoEn?: string;
  usuario?: {
    id?: number;
    nombre?: string;
  };
  [key: string]: unknown;
}

export interface PostLikesResponse {
  count: number;
  likes: PostLike[];
}

export interface QueryPostOptions {
  tipo?: PostTipo;
  usuarioId?: number;
  negocioId?: number;
  page?: number;
  limit?: number;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly http = inject(HttpClient);

  /** GET /api/posts */
  list(options: QueryPostOptions = {}): Observable<Post[]> {
    let params = new HttpParams();
    if (options.tipo) params = params.set('tipo', options.tipo);
    if (options.usuarioId) params = params.set('usuarioId', String(options.usuarioId));
    if (options.negocioId) params = params.set('negocioId', String(options.negocioId));
    if (options.page) params = params.set('page', String(options.page));
    if (options.limit) params = params.set('limit', String(options.limit));
    if (options.q) params = params.set('q', options.q);

    return this.http
      .get<Post[] | ApiListResponse<Post>>(buildApiUrl('/posts'), { params })
      .pipe(map((response) => extractItems(response)));
  }

  /** GET /api/negocios/:id/posts */
  listByNegocio(negocioId: number): Observable<Post[]> {
    return this.http
      .get<Post[] | ApiListResponse<Post>>(
        buildApiUrl(`/negocios/${negocioId}/posts`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** GET /api/posts/:id */
  get(id: number): Observable<Post> {
    return this.http.get<Post>(buildApiUrl(`/posts/${id}`));
  }

  /** DELETE /api/posts/:id */
  remove(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/posts/${id}`));
  }

  /** POST /api/posts/:id/like */
  like(id: number): Observable<PostLike | { ok: boolean; postId: number; usuarioId: number; liked: boolean }> {
    return this.http.post<PostLike | { ok: boolean; postId: number; usuarioId: number; liked: boolean }>(
      buildApiUrl(`/posts/${id}/like`),
      {},
    );
  }

  /** DELETE /api/posts/:id/like */
  unlike(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/posts/${id}/like`));
  }

  /** GET /api/posts/:id/likes */
  listLikes(id: number): Observable<PostLikesResponse> {
    return this.http
      .get<PostLike[] | ApiListResponse<PostLike> | PostLikesResponse>(
        buildApiUrl(`/posts/${id}/likes`),
      )
      .pipe(
        map((response) => {
          if (response && !Array.isArray(response) && 'likes' in response) {
            return {
              count: Number(response.count ?? response.likes.length) || 0,
              likes: response.likes,
            };
          }

          const likes = extractItems(response);
          return { count: likes.length, likes };
        }),
      );
  }

  /** GET /api/posts/:id/comentarios */
  listComentarios(id: number): Observable<PostComentario[]> {
    return this.http
      .get<PostComentario[] | ApiListResponse<PostComentario>>(
        buildApiUrl(`/posts/${id}/comentarios`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** POST /api/posts/:id/comentarios — body: { contenido } */
  crearComentario(id: number, contenido: string): Observable<PostComentario> {
    return this.http.post<PostComentario>(
      buildApiUrl(`/posts/${id}/comentarios`),
      { contenido },
    );
  }

  /** DELETE /api/posts/:id/comentarios/:cid */
  borrarComentario(postId: number, comentarioId: number): Observable<unknown> {
    return this.http.delete<unknown>(
      buildApiUrl(`/posts/${postId}/comentarios/${comentarioId}`),
    );
  }
}
