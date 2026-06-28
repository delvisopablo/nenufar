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

export type ListaTipo = 'FAVORITOS' | 'COMPRA' | 'CURIOSOS' | 'PERSONALIZADA';

export interface Lista {
  id: number;
  usuarioId?: number;
  nombre: string;
  tipo: ListaTipo;
  descripcion?: string | null;
  color?: string | null;
  iconoNenufar?: string | null;
  creadaEn?: string;
  actualizadaEn?: string;
  itemsCount?: number;
  productosPreview?: ListaCompraItem[];
  items?: ListaCompraItem[];
}

export interface CrearListaPayload {
  nombre: string;
  tipo?: ListaTipo;
  descripcion?: string;
  color?: string;
  iconoNenufar?: string;
}

export type ActualizarListaPayload = Partial<CrearListaPayload>;

export interface PedidoCerrarListaResumen {
  pedidoId: number;
  negocioId: number;
  negocioNombre: string;
  total: number;
  items: number;
}

export interface CerrarListaResponse {
  ok: boolean;
  pedidosCreados: PedidoCerrarListaResumen[];
  avisos: string[];
}

export interface GenerarCodigoResponse {
  codigo: string;
  mensaje: string;
}

export interface CodigoSnapshotItem {
  productoId?: number | null;
  nombreManual?: string | null;
  cantidad: number;
  nota?: string | null;
  producto?: {
    id: number;
    nombre: string;
    descripcion?: string | null;
    precio: number | null;
    foto?: string | null;
    negocio: { id: number; nombre: string; slug?: string | null };
  } | null;
}

export interface PreviewCodigoResponse {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  color?: string | null;
  iconoNenufar?: string | null;
  itemsCount: number;
  items: CodigoSnapshotItem[];
  generadoEn?: string;
}

export interface ImportarCodigoResponse {
  lista: Lista;
  productosNoDisponibles: string[];
}

export interface HistorialPedidoNenulista {
  pedidoId: number;
  fecha: string;
  estado: string;
  negocio: { id: number; nombre: string; slug?: string | null; fotoPerfil?: string | null };
  total: number | string | null;
  items: Array<{
    id: number;
    productoId: number | null;
    cantidad: number;
    precioUnitario: number | string;
    subtotal: number | string;
    producto?: { id: number; nombre: string; foto?: string | null } | null;
  }>;
  listaOrigen?: { id: number; nombre: string } | null;
}

@Injectable({ providedIn: 'root' })
export class ListaCompraService {
  private readonly http = inject(HttpClient);

  // ===== API legacy: lista por defecto (usada por catalogo-negocio-modal,
  // detalle-producto-modal y ruta-local). No cambiar firmas. =====

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

  // ===== Mi Nenulista: varias listas por usuario =====

  /** GET /api/me/listas */
  getMisListas(): Observable<Lista[]> {
    return this.http.get<Lista[]>(buildApiUrl('/me/listas'), {
      withCredentials: true,
    });
  }

  /** GET /api/me/listas/:id */
  getListaPorId(listaId: number | string): Observable<Lista> {
    return this.http.get<Lista>(buildApiUrl(`/me/listas/${listaId}`), {
      withCredentials: true,
    });
  }

  /** POST /api/me/listas */
  crearLista(payload: CrearListaPayload): Observable<Lista> {
    return this.http.post<Lista>(buildApiUrl('/me/listas'), payload, {
      withCredentials: true,
    });
  }

  /** PATCH /api/me/listas/:id */
  actualizarLista(
    listaId: number | string,
    payload: ActualizarListaPayload,
  ): Observable<Lista> {
    return this.http.patch<Lista>(
      buildApiUrl(`/me/listas/${listaId}`),
      payload,
      { withCredentials: true },
    );
  }

  /** DELETE /api/me/listas/:id */
  eliminarLista(listaId: number | string): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/me/listas/${listaId}`), {
      withCredentials: true,
    });
  }

  /** POST /api/me/listas/:id/items */
  addProductoALista(
    listaId: number | string,
    payload: AddListaCompraItemPayload,
  ): Observable<ListaCompraItem> {
    return this.http.post<ListaCompraItem>(
      buildApiUrl(`/me/listas/${listaId}/items`),
      payload,
      { withCredentials: true },
    );
  }

  /** PATCH /api/me/listas/:id/items/:itemId */
  updateItemDeLista(
    listaId: number | string,
    itemId: number | string,
    payload: UpdateListaCompraItemPayload,
  ): Observable<ListaCompraItem> {
    return this.http.patch<ListaCompraItem>(
      buildApiUrl(`/me/listas/${listaId}/items/${itemId}`),
      payload,
      { withCredentials: true },
    );
  }

  /** DELETE /api/me/listas/:id/items/:itemId */
  removeItemDeLista(
    listaId: number | string,
    itemId: number | string,
  ): Observable<unknown> {
    return this.http.delete<unknown>(
      buildApiUrl(`/me/listas/${listaId}/items/${itemId}`),
      { withCredentials: true },
    );
  }

  /** POST /api/me/listas/:id/cerrar */
  cerrarLista(listaId: number | string): Observable<CerrarListaResponse> {
    return this.http.post<CerrarListaResponse>(
      buildApiUrl(`/me/listas/${listaId}/cerrar`),
      {},
      { withCredentials: true },
    );
  }

  /** GET /api/me/nenulista/pedidos */
  getHistorialPedidosNenulista(): Observable<HistorialPedidoNenulista[]> {
    return this.http.get<HistorialPedidoNenulista[]>(
      buildApiUrl('/me/nenulista/pedidos'),
      { withCredentials: true },
    );
  }

  /** POST /api/me/listas/:id/codigo-compartir */
  generarCodigoCompartir(listaId: number | string): Observable<GenerarCodigoResponse> {
    return this.http.post<GenerarCodigoResponse>(
      buildApiUrl(`/me/listas/${listaId}/codigo-compartir`),
      {},
      { withCredentials: true },
    );
  }

  /** GET /api/listas/codigo/:codigo */
  previewCodigoLista(codigo: string): Observable<PreviewCodigoResponse> {
    return this.http.get<PreviewCodigoResponse>(
      buildApiUrl(`/listas/codigo/${encodeURIComponent(codigo)}`),
      { withCredentials: true },
    );
  }

  /** POST /api/me/listas/importar-codigo */
  importarListaPorCodigo(
    codigo: string,
    nombre?: string,
  ): Observable<ImportarCodigoResponse> {
    return this.http.post<ImportarCodigoResponse>(
      buildApiUrl('/me/listas/importar-codigo'),
      { codigo, ...(nombre ? { nombre } : {}) },
      { withCredentials: true },
    );
  }
}
