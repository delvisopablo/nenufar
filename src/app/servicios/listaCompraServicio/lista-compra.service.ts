import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';
import { Producto } from '../productoServicio/productoService.service';

export interface ListaCompraNegocio {
  id?: number | string | null;
  nombre?: string | null;
  slug?: string | null;
  nickname?: string | null;
}

export interface ListaCompraItem {
  id: number | string;
  productoId?: number | string | null;
  producto?: Producto | null;
  negocioId?: number | string | null;
  negocio?: ListaCompraNegocio | null;
  nombre?: string | null;
  cantidad?: number | string | null;
  nota?: string | null;
  precio?: number | string | null;
  foto?: string | null;
  imagen?: string | null;
  imageUrl?: string | null;
  completado?: boolean | null;
  completada?: boolean | null;
  estado?: string | null;
  creadoEn?: string | null;
  actualizadoEn?: string | null;
  [key: string]: unknown;
}

export interface AddListaCompraItemPayload {
  productoId?: number;
  negocioId?: number;
  nombreManual?: string;
  cantidad: number;
  nota?: string | null;
}

export interface UpdateListaCompraItemPayload {
  cantidad?: number;
  nota?: string | null;
  completado?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ListaCompraService {
  private readonly http = inject(HttpClient);

  /** GET /api/me/lista-compra */
  getLista(): Observable<ListaCompraItem[]> {
    return this.http
      .get<ListaCompraItem[] | ApiListResponse<ListaCompraItem>>(
        buildApiUrl('/me/lista-compra'),
        { withCredentials: true },
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** POST /api/me/lista-compra */
  addItem(payload: AddListaCompraItemPayload): Observable<ListaCompraItem> {
    return this.http.post<ListaCompraItem>(
      buildApiUrl('/me/lista-compra'),
      payload,
      { withCredentials: true },
    );
  }

  /** PATCH /api/me/lista-compra/:itemId */
  updateItem(
    itemId: number | string,
    payload: UpdateListaCompraItemPayload,
  ): Observable<ListaCompraItem> {
    return this.http.patch<ListaCompraItem>(
      buildApiUrl(`/me/lista-compra/${itemId}`),
      payload,
      { withCredentials: true },
    );
  }

  /** DELETE /api/me/lista-compra/:itemId */
  deleteItem(itemId: number | string): Observable<unknown> {
    return this.http.delete<unknown>(
      buildApiUrl(`/me/lista-compra/${itemId}`),
      { withCredentials: true },
    );
  }

  /** DELETE /api/me/lista-compra/completados */
  clearCompletados(): Observable<unknown> {
    return this.http.delete<unknown>(
      buildApiUrl('/me/lista-compra/completados'),
      { withCredentials: true },
    );
  }
}
