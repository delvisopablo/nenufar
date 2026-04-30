import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  forkJoin,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { normalizeSearchText } from '../../core/search/trie';
import {
  NegocioFollowersResponse,
  NegocioService,
  NegocioSummary,
  resolveNegocioRouteKey,
} from '../negocioService/negocio.service';
import { Resena, ResenaService } from '../reviewServicio/resena.service';

export type NegocioReviewSnippet = {
  id: number;
  autorNombre: string;
  contenido: string;
  contenidoCorto: string;
  fechaISO: string;
  puntuacion: number;
  selloNenufar: boolean;
  usuarioNickname?: string;
  usuarioFoto?: string;
};

export type NegocioLite = {
  id: number;
  nombre: string;
  slug?: string;
  nickname?: string;
  categoria?: { nombre: string };
  ciudad?: string;
  provincia?: string;
  foto?: string;
  fotoPerfil?: string;
  fotoPortada?: string;
  nenufarAsset?: string;
  nenufarKey?: string;
  descripcion?: string;
  verificado?: boolean;
  routeKey?: string;
  reviewCount: number;
  averageRating: number;
  latestReviews: NegocioReviewSnippet[];
  isFollowing: boolean;
  followersCount: number;
};

type ReviewsByBusiness = Map<number, NegocioReviewSnippet[]>;

@Injectable({ providedIn: 'root' })
export class NegocioSearchService {
  private readonly negocioService = inject(NegocioService);
  private readonly resenaService = inject(ResenaService);
  private readonly resultLimit = 6;
  private readonly showcaseLimit = 8;
  private readonly detailCache = new Map<number, Observable<NegocioSummary | null>>();

  private readonly catalogo$ = this.negocioService.getNegocios().pipe(
    catchError(() => of([])),
    shareReplay(1),
  );

  private readonly reviewsByBusiness$ = this.resenaService.todas().pipe(
    map((reviews) => this.groupReviewsByBusiness(reviews)),
    catchError(() => of(new Map<number, NegocioReviewSnippet[]>())),
    shareReplay(1),
  );

  search(prefix: string): Observable<NegocioLite[]> {
    const normalized = normalizeSearchText(prefix);

    if (!normalized) {
      return of([]);
    }

    return this.catalogo$.pipe(
      map((items) => items.filter((item) => this.matches(item, normalized)).slice(0, this.resultLimit)),
      switchMap((items) => this.enrichSummaries(items)),
    );
  }

  showcase(limit = this.showcaseLimit): Observable<NegocioLite[]> {
    return this.catalogo$.pipe(
      map((items) => items.slice(0, limit)),
      switchMap((items) => this.enrichSummaries(items)),
    );
  }

  private enrichSummaries(items: NegocioSummary[]): Observable<NegocioLite[]> {
    if (!items.length) {
      return of([]);
    }

    return forkJoin({
      details: forkJoin(items.map((item) => this.getDetail(item))),
      followers: forkJoin(items.map((item) => this.getFollowers(item))),
      reviewsByBusiness: this.reviewsByBusiness$,
    }).pipe(
      map(({ details, followers, reviewsByBusiness }) =>
        items.map((item, index) => {
          const merged = {
            ...item,
            ...(details[index] ?? {}),
          };
          const reviews = reviewsByBusiness.get(item.id) ?? [];
          return this.toLite(merged, reviews, followers[index]);
        }),
      ),
    );
  }

  private getDetail(item: NegocioSummary): Observable<NegocioSummary | null> {
    const existing = this.detailCache.get(item.id);
    if (existing) {
      return existing;
    }

    // TODO(backend): ampliar GET /negocios para exponer ciudad, imagen, slug/nickname publico
    // y contadores de reseñas/seguidores. Mientras tanto enriquecemos solo los negocios visibles
    // con GET /negocios/:id para no romper buscador ni estanque.
    const request$ = this.negocioService.getNegocioById(item.id).pipe(
      catchError(() => of(item)),
      shareReplay(1),
    );
    this.detailCache.set(item.id, request$);
    return request$;
  }

  private getFollowers(item: NegocioSummary): Observable<NegocioFollowersResponse> {
    return this.negocioService.getSeguidoresNegocio(item.id).pipe(
      catchError(() => of(this.emptyFollowers(item))),
    );
  }

  private groupReviewsByBusiness(reviews: Resena[]): ReviewsByBusiness {
    const grouped = new Map<number, NegocioReviewSnippet[]>();

    const normalized = [...reviews]
      .map((item) => this.toReviewSnippet(item))
      .filter((item): item is (NegocioReviewSnippet & { negocioId: number }) => item !== null)
      .sort((left, right) => right.fechaISO.localeCompare(left.fechaISO));

    for (const review of normalized) {
      if (!grouped.has(review.negocioId)) {
        grouped.set(review.negocioId, []);
      }

      grouped.get(review.negocioId)?.push({
        id: review.id,
        autorNombre: review.autorNombre,
        contenido: review.contenido,
        contenidoCorto: review.contenidoCorto,
        fechaISO: review.fechaISO,
        puntuacion: review.puntuacion,
        selloNenufar: review.selloNenufar,
        ...(review.usuarioNickname ? { usuarioNickname: review.usuarioNickname } : {}),
        ...(review.usuarioFoto ? { usuarioFoto: review.usuarioFoto } : {}),
      });
    }

    return grouped;
  }

  private toReviewSnippet(review: Resena): (NegocioReviewSnippet & { negocioId: number }) | null {
    const negocioId = Number(review.negocioId);
    if (!Number.isFinite(negocioId) || negocioId <= 0) {
      return null;
    }

    const usuario = (review['usuario'] ?? null) as
      | {
          nombre?: string;
          autorNombre?: string;
          nickname?: string;
          foto?: string;
        }
      | null;

    const contenido = String(review.contenido ?? review['comentario'] ?? '').trim();
    const autorNombre =
      usuario?.autorNombre?.trim() ||
      usuario?.nombre?.trim() ||
      String(review['autorNombre'] ?? '').trim() ||
      'Cliente de Nenúfar';
    const fechaISO =
      String(review.creadoEn ?? review['fecha'] ?? new Date(0).toISOString()) || new Date(0).toISOString();

    return {
      negocioId,
      id: Number(review.id ?? 0) || Date.now(),
      autorNombre,
      contenido,
      contenidoCorto: contenido.length > 132 ? `${contenido.slice(0, 129)}...` : contenido,
      fechaISO,
      puntuacion: Number(review.puntuacion ?? 0) || 0,
      selloNenufar: Boolean(review.selloNenufar),
      ...(usuario?.nickname?.trim() ? { usuarioNickname: usuario.nickname.trim() } : {}),
      ...(usuario?.foto?.trim() ? { usuarioFoto: usuario.foto.trim() } : {}),
    };
  }

  private matches(item: NegocioSummary, normalized: string): boolean {
    const categoriaNombre =
      typeof item.categoria === 'string' ? item.categoria : item.categoria?.nombre;

    return [
      item.nombre,
      item.nickname,
      item.slug,
      resolveNegocioRouteKey(item),
      item.ciudad,
      item.provincia,
      categoriaNombre,
      item.direccion,
    ]
      .map((value) => normalizeSearchText(value ?? ''))
      .some((value) => value.includes(normalized));
  }

  private emptyFollowers(item: NegocioSummary): NegocioFollowersResponse {
    return {
      negocio: {
        id: item.id,
        nombre: item.nombre,
        ...(item.slug ? { slug: item.slug } : {}),
      },
      total: item.followersCount ?? 0,
      actorSiguiendo: Boolean(item.isFollowing ?? item.isFollowedByMe),
      items: [],
    };
  }

  private toLite(
    item: NegocioSummary,
    reviews: NegocioReviewSnippet[],
    followers: NegocioFollowersResponse,
  ): NegocioLite {
    const categoriaNombre =
      typeof item.categoria === 'string' ? item.categoria : item.categoria?.nombre;
    const averageRating =
      typeof item.mediaResenas === 'number'
        ? item.mediaResenas
        : reviews.length
          ? Number(
              (reviews.reduce((acc, review) => acc + review.puntuacion, 0) / reviews.length).toFixed(1),
            )
          : 0;

    return {
      id: item.id,
      nombre: item.nombre,
      ...(item.slug?.trim() ? { slug: item.slug.trim() } : {}),
      ...(item.nickname?.trim() ? { nickname: item.nickname.trim() } : {}),
      ...(item.ciudad?.trim() ? { ciudad: item.ciudad.trim() } : {}),
      ...(item.provincia?.trim() ? { provincia: item.provincia.trim() } : {}),
      ...(categoriaNombre?.trim() ? { categoria: { nombre: categoriaNombre.trim() } } : {}),
      ...(item.descripcionCorta?.trim()
        ? { descripcion: item.descripcionCorta.trim() }
        : item.descripcion?.trim()
          ? { descripcion: item.descripcion.trim() }
          : item.historia?.trim()
            ? { descripcion: item.historia.trim() }
            : {}),
      ...(item.foto?.trim() ? { foto: item.foto.trim() } : {}),
      ...(item.fotoPerfil?.trim() ? { fotoPerfil: item.fotoPerfil.trim() } : {}),
      ...(item.fotoPortada?.trim() ? { fotoPortada: item.fotoPortada.trim() } : {}),
      ...(item.nenufarAsset?.trim() ? { nenufarAsset: item.nenufarAsset.trim() } : {}),
      ...(item.nenufarKey?.trim() ? { nenufarKey: item.nenufarKey.trim() } : {}),
      ...(resolveNegocioRouteKey(item) ? { routeKey: resolveNegocioRouteKey(item) ?? undefined } : {}),
      ...(typeof item.verificado === 'boolean' ? { verificado: item.verificado } : {}),
      reviewCount: item.resenasCount ?? reviews.length,
      averageRating,
      latestReviews: reviews.slice(0, 2),
      isFollowing: Boolean(item.isFollowing ?? item.isFollowedByMe ?? followers.actorSiguiendo),
      followersCount: Number(followers.total ?? item.followersCount ?? 0) || 0,
    };
  }
}
