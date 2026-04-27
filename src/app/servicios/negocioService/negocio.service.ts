import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems
} from '../../config/api.config';

export interface NegocioSearchResult {
  id: number;
  nombre: string;
  categoria: string;
  descripcion: string;
  raw: unknown;
}

@Injectable({ providedIn: 'root' })
export class NegocioService {
  constructor(private http: HttpClient) {}

  buscarNegocios(query: string) {
    return this.http
      .get<ApiListResponse<unknown>>(buildApiUrl('/negocios'), {
        params: { q: query }
      })
      .pipe(
        map((response) => extractItems(response)),
        map((items) =>
          items
            .map((item) => this.normalizarResultadoBusqueda(item))
            .filter((item): item is NegocioSearchResult => item !== null)
        )
      );
  }

  private normalizarResultadoBusqueda(item: unknown): NegocioSearchResult | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const negocio = item as {
      id?: number | string;
      nombre?: string;
      categoria?: { nombre?: string } | string;
      categoriaNombre?: string;
      descripcion?: string;
      descripcionCorta?: string;
      historia?: string;
      direccion?: string;
    };

    const id = Number(negocio.id);
    if (!Number.isFinite(id)) {
      return null;
    }

    const categoria =
      typeof negocio.categoria === 'string'
        ? negocio.categoria
        : negocio.categoria?.nombre || negocio.categoriaNombre || 'Negocio local';

    return {
      id,
      nombre: negocio.nombre?.trim() || `Negocio ${id}`,
      categoria,
      descripcion:
        negocio.descripcionCorta?.trim() ||
        negocio.descripcion?.trim() ||
        negocio.historia?.trim() ||
        negocio.direccion?.trim() ||
        'Sin descripcion disponible.',
      raw: item
    };
  }
}
