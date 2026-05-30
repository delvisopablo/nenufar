import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';
import { Producto } from '../productoServicio/productoService.service';

export interface ProductoFavorito {
  id?: number | string;
  productoId?: number | string | null;
  producto?: Producto | null;
  negocio?: {
    id?: number | string | null;
    nombre?: string | null;
    slug?: string | null;
    nickname?: string | null;
  } | null;
  creadoEn?: string | null;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class ProductoFavoritoService {
  private readonly http = inject(HttpClient);

  /** GET /api/me/productos-favoritos */
  getFavoritos(): Observable<ProductoFavorito[]> {
    return this.http
      .get<ProductoFavorito[] | ApiListResponse<ProductoFavorito>>(
        buildApiUrl('/me/productos-favoritos'),
        { withCredentials: true },
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** POST /api/me/productos-favoritos */
  marcarFavorito(productoId: number): Observable<ProductoFavorito> {
    return this.http.post<ProductoFavorito>(
      buildApiUrl('/me/productos-favoritos'),
      { productoId },
      { withCredentials: true },
    );
  }

  /** DELETE /api/me/productos-favoritos/:productoId */
  quitarFavorito(productoId: number): Observable<unknown> {
    return this.http.delete<unknown>(
      buildApiUrl(`/me/productos-favoritos/${productoId}`),
      { withCredentials: true },
    );
  }
}
