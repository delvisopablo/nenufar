import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { buildApiUrl } from '../config/api.config';

export interface Producto {
  id: number;
  nombre: string;
  descripcion?: string;
  precio?: number;
  foto?: string;
  negocioId: number;
  negocio: {
    id: number;
    nombre: string;
    slug?: string;
    ciudad?: string;
    verificado: boolean;
  };
}

export interface ListaCompraItem {
  id: number;
  listaCompraId: number;
  productoId?: number;
  nombreManual?: string;
  cantidad: number;
  completado: boolean;
  nota?: string;
  creadoEn: string;
  producto?: Producto;
}

export interface Nenulista {
  id: number;
  usuarioId: number;
  nombre: string;
  creadaEn: string;
  actualizadaEn: string;
  items: ListaCompraItem[];
}

export interface AddNenulistaItemPayload {
  productoId?: number;
  nombreManual?: string;
  cantidad: number;
  nota?: string;
}

export interface UpdateNenulistaItemPayload {
  cantidad?: number;
  completado?: boolean;
  nota?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NenulistaService {
  constructor(private http: HttpClient) {}

  /**
   * Obtener la Nenulista del usuario autenticado
   */
  getNenulista(): Observable<Nenulista> {
    const url = buildApiUrl('/me/lista-compra');
    return this.http
      .get<Nenulista>(url, { withCredentials: true })
      .pipe(
        catchError((error) => {
          console.error('Error al obtener Nenulista:', error);
          return throwError(
            () => new Error('Tu Nenulista no se cargó.'),
          );
        }),
      );
  }

  /**
   * Añadir un producto a la Nenulista
   */
  addProducto(payload: AddNenulistaItemPayload): Observable<ListaCompraItem> {
    const url = buildApiUrl('/me/lista-compra');
    return this.http
      .post<ListaCompraItem>(url, payload, { withCredentials: true })
      .pipe(
        catchError((error) => {
          console.error('Error al añadir a Nenulista:', error);
          return throwError(
            () => new Error('El producto no se añadió a tu Nenulista.'),
          );
        }),
      );
  }

  /**
   * Actualizar un item de la Nenulista
   */
  updateItem(
    itemId: number,
    payload: UpdateNenulistaItemPayload,
  ): Observable<ListaCompraItem> {
    const url = buildApiUrl(`/me/lista-compra/${itemId}`);
    return this.http
      .patch<ListaCompraItem>(url, payload, { withCredentials: true })
      .pipe(
        catchError((error) => {
          console.error('Error al actualizar item de Nenulista:', error);
          return throwError(
            () => new Error('El producto de tu Nenulista no se actualizó.'),
          );
        }),
      );
  }

  /**
   * Eliminar un item de la Nenulista
   */
  deleteItem(itemId: number): Observable<{ ok: boolean; message: string }> {
    const url = buildApiUrl(`/me/lista-compra/${itemId}`);
    return this.http
      .delete<{ ok: boolean; message: string }>(url, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('Error al eliminar item de Nenulista:', error);
          return throwError(
            () => new Error('El producto no se eliminó de tu Nenulista.'),
          );
        }),
      );
  }

  /**
   * Eliminar todos los items completados
   */
  clearCompletados(): Observable<{ ok: boolean; deleted: number }> {
    const url = buildApiUrl('/me/lista-compra/completados');
    return this.http
      .delete<{ ok: boolean; deleted: number }>(url, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('Error al limpiar completados:', error);
          return throwError(
            () => new Error('Los productos completados no se limpiaron.'),
          );
        }),
      );
  }

  /**
   * Marcar un item como completado
   */
  marcarCompletado(itemId: number): Observable<ListaCompraItem> {
    return this.updateItem(itemId, { completado: true });
  }

  /**
   * Desmarcar un item como completado
   */
  desmarcarCompletado(itemId: number): Observable<ListaCompraItem> {
    return this.updateItem(itemId, { completado: false });
  }

  /**
   * Obtener solo los items pendientes (no completados)
   */
  getPendientes(nenulista: Nenulista): ListaCompraItem[] {
    return nenulista.items.filter((item) => !item.completado);
  }

  /**
   * Obtener solo los items completados
   */
  getCompletados(nenulista: Nenulista): ListaCompraItem[] {
    return nenulista.items.filter((item) => item.completado);
  }

  /**
   * Agrupar items por negocio
   */
  agruparPorNegocio(items: ListaCompraItem[]): Map<string, ListaCompraItem[]> {
    const grouped = new Map<string, ListaCompraItem[]>();

    items.forEach((item) => {
      const key = item.producto?.negocio?.nombre || 'Sin negocio';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    return grouped;
  }
}
