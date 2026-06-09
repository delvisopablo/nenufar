import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { buildApiUrl } from '../config/api.config';

export interface ProductoFavorito {
  id: number;
  usuarioId: number;
  productoId: number;
  creadoEn: string;
  producto: {
    id: number;
    nombre: string;
    descripcion?: string;
    precio?: number;
    foto?: string;
    activo: boolean;
    negocioId: number;
    negocio: {
      id: number;
      nombre: string;
      slug?: string;
      verificado: boolean;
    };
  };
}

@Injectable({
  providedIn: 'root',
})
export class FavoritosProductoService {
  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de productos favoritos del usuario autenticado
   */
  getFavoritos(): Observable<ProductoFavorito[]> {
    const url = buildApiUrl('/me/productos-favoritos');
    return this.http
      .get<ProductoFavorito[]>(url, { withCredentials: true })
      .pipe(
        catchError((error) => {
          console.error('Error al obtener favoritos:', error);
          return throwError(
            () => new Error('La lista de productos favoritos no se cargó.'),
          );
        }),
      );
  }

  /**
   * Marcar un producto como favorito
   */
  marcarFavorito(productoId: number): Observable<ProductoFavorito> {
    const url = buildApiUrl('/me/productos-favoritos');
    return this.http
      .post<ProductoFavorito>(
        url,
        { productoId },
        { withCredentials: true },
      )
      .pipe(
        catchError((error) => {
          console.error('Error al marcar favorito:', error);
          return throwError(
            () => new Error('El producto no se añadió a favoritos.'),
          );
        }),
      );
  }

  /**
   * Quitar un producto de favoritos
   */
  quitarFavorito(productoId: number): Observable<{ ok: boolean; message: string }> {
    const url = buildApiUrl(`/me/productos-favoritos/${productoId}`);
    return this.http.delete<{ ok: boolean; message: string }>(url, {
      withCredentials: true,
    }).pipe(
      catchError((error) => {
        console.error('Error al quitar favorito:', error);
        return throwError(
          () => new Error('El producto no se quitó de favoritos.'),
        );
      }),
    );
  }

  /**
   * Verificar si un producto es favorito
   */
  isFavorito(productoId: number, favoritos: ProductoFavorito[]): boolean {
    return favoritos.some((fav) => fav.productoId === productoId);
  }
}
