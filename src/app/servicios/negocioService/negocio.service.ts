import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';

export interface NegocioSummary {
  id: number;
  nombre: string;
  slug?: string | null;
  categoria?: { id?: number; nombre?: string } | string;
  historia?: string;
  descripcion?: string;
  descripcionCorta?: string;
  direccion?: string;
}

export interface NegocioSearchResult {
  id: number;
  nombre: string;
  slug?: string;
  categoria: string;
  descripcion: string;
  raw: unknown;
}

export interface NegocioFollower {
  id: number;
  creadoEn: string;
  usuario: {
    id: number;
    nombre: string;
    nickname: string;
    foto?: string | null;
    biografia?: string | null;
  };
}

export interface NegocioFollowersResponse {
  negocio: {
    id: number;
    nombre: string;
    slug?: string | null;
  };
  total: number;
  actorSiguiendo?: boolean;
  items: NegocioFollower[];
}

@Injectable({ providedIn: 'root' })
export class NegocioService {
  constructor(private readonly http: HttpClient) {}

  buscarNegocios(query: string) {
    return this.http
      .get<ApiListResponse<unknown>>(buildApiUrl('/negocios'), {
        params: { q: query },
      })
      .pipe(
        map((response) => extractItems(response)),
        map((items) =>
          items
            .map((item) => this.normalizarResultadoBusqueda(item))
            .filter((item): item is NegocioSearchResult => item !== null),
        ),
      );
  }

  getBySlug(slug: string): Observable<NegocioSummary> {
    return this.http.get<NegocioSummary>(buildApiUrl(`/negocios/slug/${slug}`), {
      withCredentials: true,
    });
  }

  getById(id: number): Observable<NegocioSummary> {
    return this.http.get<NegocioSummary>(buildApiUrl(`/negocios/${id}`), {
      withCredentials: true,
    });
  }

  followNegocio(id: number) {
    return this.http.post(
      buildApiUrl(`/negocios/${id}/seguir`),
      {},
      { withCredentials: true },
    );
  }

  unfollowNegocio(id: number) {
    return this.http.delete(buildApiUrl(`/negocios/${id}/seguir`), {
      withCredentials: true,
    });
  }

  getSeguidoresNegocio(id: number): Observable<NegocioFollowersResponse> {
    return this.http.get<NegocioFollowersResponse>(
      buildApiUrl(`/negocios/${id}/seguidores`),
      { withCredentials: true },
    );
  }

  private normalizarResultadoBusqueda(
    item: unknown,
  ): NegocioSearchResult | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const negocio = item as {
      id?: number | string;
      nombre?: string;
      slug?: string | null;
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
      ...(negocio.slug?.trim() ? { slug: negocio.slug.trim() } : {}),
      categoria,
      descripcion:
        negocio.descripcionCorta?.trim() ||
        negocio.descripcion?.trim() ||
        negocio.historia?.trim() ||
        negocio.direccion?.trim() ||
        'Sin descripcion disponible.',
      raw: item,
    };
  }
}
