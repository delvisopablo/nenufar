import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import {
  ApiListResponse,
  buildApiUrl,
  extractItems,
} from '../../config/api.config';
import { SKIP_HTTP_ERROR_HANDLING } from '../../core/errors/http-error.interceptor';
import { normalizeSearchText } from '../../core/search/trie';

export type NegocioRouteTarget = {
  id?: number | null;
  slug?: string | null;
  nickname?: string | null;
  nombre?: string | null;
};

const RESERVED_NEGOCIO_ROUTE_PARAMS = new Set([
  '',
  'ajustes',
  'categorias',
  'compras',
  'dashboard',
  'editar',
  'estanque',
  'inicio',
  'likes',
  'login',
  'negocio',
  'negocios',
  'nenuninfo',
  'mis-logros',
  'notificaciones',
  'logos-nenufar',
  'perfil',
  'registro',
  'registro-negocio',
  'registro-opciones',
  'reservas',
  'review',
  'ruta-local',
  'usuario',
  'reseñas',
  'resenas',
]);

export function slugifyPublicSegment(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isReservedNegocioRouteParam(
  value: string | null | undefined,
): boolean {
  const normalized = slugifyPublicSegment(value);
  return !normalized || RESERVED_NEGOCIO_ROUTE_PARAMS.has(normalized);
}

export function normalizeNegocioRouteParam(
  value: string | null | undefined,
): string | null {
  const raw = String(value ?? '').trim();
  const normalized = slugifyPublicSegment(raw);

  if (!raw || !normalized || isReservedNegocioRouteParam(raw)) {
    return null;
  }

  return raw;
}

export function resolveNegocioRouteKey(
  negocio: NegocioRouteTarget | null | undefined,
): string | null {
  // TODO(backend): guardar un nickname o slug unico de negocio.
  // Si no llega ninguno, generamos una ruta publica provisional a partir del nombre.
  const nickname =
    typeof negocio?.nickname === 'string' ? negocio.nickname.trim() : '';
  if (nickname && !isReservedNegocioRouteParam(nickname)) {
    return nickname;
  }

  const slug = typeof negocio?.slug === 'string' ? negocio.slug.trim() : '';
  if (slug && !isReservedNegocioRouteParam(slug)) {
    return slug;
  }

  const generated = slugifyPublicSegment(negocio?.nombre);
  return generated && !isReservedNegocioRouteParam(generated) ? generated : null;
}

export interface NegocioSummary {
  id: number;
  nombre: string;
  slug?: string | null;
  nickname?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  categoria?: { id?: number; nombre?: string } | string;
  subcategoria?: { id?: number; nombre?: string } | string;
  historia?: string;
  descripcion?: string;
  descripcionCorta?: string;
  direccion?: string;
  aceptaReservas?: boolean;
  foto?: string | null;
  fotoPerfil?: string | null;
  fotoPortada?: string | null;
  nenufarKey?: string | null;
  nenufarAsset?: string | null;
  verificado?: boolean;
  followersCount?: number;
  resenasCount?: number;
  productosCount?: number;
  reservasCount?: number;
  mediaResenas?: number;
  isFollowing?: boolean;
  isFollowedByMe?: boolean;
  duenoId?: number;
  dueno?: {
    id?: number;
    nombre?: string;
    nickname?: string | null;
    foto?: string | null;
  };
}

export interface NegocioSearchResult {
  id: number;
  nombre: string;
  slug?: string;
  categoria: string;
  descripcion: string;
  foto?: string | null;
  fotoPerfil?: string | null;
  fotoPortada?: string | null;
  nenufarKey?: string | null;
  nenufarAsset?: string | null;
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

export interface NegocioFollowResponse {
  followed?: boolean;
  siguiendo?: boolean;
  total?: number;
}


export type RolNegocio = 'OWNER' | 'ADMIN' | 'STAFF' | string;

export interface NegocioMiembro {
  id?: number;
  usuarioId: number;
  rol: RolNegocio;
  usuario?: {
    id: number;
    nombre?: string;
    nickname?: string;
    foto?: string | null;
  };
  [key: string]: unknown;
}

export interface NegocioHorario {
  apertura?: string;
  cierre?: string;
  intervalo?: number;
  diasAbre?: string[];
  weekly?: Record<string, [string, string][]>;
  exceptions?: Record<string, [string, string][]>;
  [key: string]: unknown;
}

export interface CreateNegocioPayload {
  nombre: string;
  slug?: string;
  historia?: string;
  fechaFundacion: string;
  direccion?: string;
  categoriaId: number;
  subcategoriaId?: number;
  intervaloReserva?: number;
  horario?: NegocioHorario;
}

export interface UpdateNegocioPayload {
  nombre?: string;
  slug?: string | null;
  historia?: string | null;
  descripcionCorta?: string | null;
  fechaFundacion?: string;
  direccion?: string | null;
  aceptaReservas?: boolean;
  fotoPerfil?: string | null;
  fotoPortada?: string | null;
  nenufarKey?: string | null;
  nenufarAsset?: string | null;
  categoriaId?: number;
  subcategoriaId?: number;
  intervaloReserva?: number;
  horario?: NegocioHorario;
}

export interface ConfigHorarioPayload {
  intervaloReserva?: number;
  horario?: NegocioHorario;
}

export interface CreateMiembroPayload {
  usuarioId: number;
  rol?: RolNegocio;
}

export interface UpdateMiembroPayload {
  rol: RolNegocio;
}

export interface CreateVisitaPayload {
  origen?: string;
}

export interface QueryNegociosOptions {
  q?: string;
  categoriaId?: number;
  subcategoriaId?: number;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class NegocioService {
  private readonly silentLookupContext = new HttpContext().set(
    SKIP_HTTP_ERROR_HANDLING,
    true,
  );

  constructor(private readonly http: HttpClient) {}

  buscarNegocios(query: string) {
    const normalized = normalizeSearchText(query);
    if (!normalized) {
      return of([] as NegocioSearchResult[]);
    }

    return this.getNegocios().pipe(
      map((items) =>
        this.filterNegocios(items, normalized)
          .slice(0, 40)
          .map((item) => this.normalizarResultadoBusqueda(item))
          .filter((item): item is NegocioSearchResult => item !== null),
      ),
      catchError(() => of([] as NegocioSearchResult[])),
    );
  }

  getBySlug(slug: string): Observable<NegocioSummary> {
    return this.http
      .get<unknown>(buildApiUrl(`/negocios/slug/${slug}`), {
        context: this.silentLookupContext,
      })
      .pipe(map((response) => this.requireNegocioSummary(response, slug)));
  }

  getByNickname(nickname: string): Observable<NegocioSummary> {
    // TODO(backend): consolidar este lookup publico en GET /negocios/nickname/:nickname.
    // Por compatibilidad usamos primero ese contrato, luego /negocios/slug/:slug
    // y como ultimo recurso resolvemos el negocio dentro de GET /negocios.
    return this.http
      .get<unknown>(buildApiUrl(`/negocios/nickname/${nickname}`), {
        context: this.silentLookupContext,
      })
      .pipe(
        map((response) => this.requireNegocioSummary(response, nickname)),
        catchError((error) => {
          if (!this.isControlledLookup404(error)) {
            throw error;
          }

          return this.getBySlug(nickname);
        }),
        catchError((error) => {
          if (!this.isControlledLookup404(error)) {
            throw error;
          }

          return this.getNegocios().pipe(
            map((negocios) => {
              const match = negocios.find((negocio) =>
                this.matchesPublicRouteKey(negocio, nickname)
              );

              if (match) {
                return match;
              }

              throw new Error(`Negocio no encontrado para ${nickname}`);
            }),
          );
        }),
      );
  }

  getById(id: number): Observable<NegocioSummary> {
    return this.http
      .get<unknown>(buildApiUrl(`/negocios/${id}`))
      .pipe(map((response) => this.requireNegocioSummary(response, String(id))));
  }

  getMine(): Observable<NegocioSummary | null> {
    // TODO(backend): definir un endpoint estable para el negocio del usuario autenticado.
    // El frontend intenta primero /negocios/mio y luego /usuarios/me/negocio.
    return this.http
      .get<unknown>(buildApiUrl('/negocios/mio'))
      .pipe(
        map((response) => this.requireNegocioSummary(response, 'mio')),
        catchError(() =>
          this.http.get<unknown>(buildApiUrl('/usuarios/me/negocio')).pipe(
            map((response) => this.requireNegocioSummary(response, 'me/negocio')),
          )
        ),
        catchError(() => of(null)),
      );
  }

  getNegocios(): Observable<NegocioSummary[]> {
    return this.list().pipe(
      map((items) => items.slice(0, 250)),
      catchError(() => of([])),
    );
  }

  searchNegocios(query: string): Observable<NegocioSummary[]> {
    const normalized = normalizeSearchText(query);
    if (!normalized) {
      return of([]);
    }

    return this.getNegocios().pipe(
      map((items) => this.filterNegocios(items, normalized).slice(0, 40)),
      catchError(() => of([])),
    );
  }

  getNegocioByNickname(nickname: string): Observable<NegocioSummary> {
    return this.getByNickname(nickname);
  }

  getNegocioById(id: number): Observable<NegocioSummary> {
    return this.getById(id);
  }

  resolveNegocioFromRouteParam(param: string): Observable<NegocioSummary | null> {
    const normalizedParam = normalizeNegocioRouteParam(param);

    if (!normalizedParam) {
      return of(null);
    }

    return this.getByNickname(normalizedParam).pipe(
      catchError((error) => {
        if (
          this.isControlledLookup404(error) ||
          this.isNotFoundLookupError(error)
        ) {
          return of(null);
        }

        throw error;
      }),
    );
  }

  getRouteKey(negocio: NegocioRouteTarget | null | undefined): string | null {
    return resolveNegocioRouteKey(negocio);
  }

  normalizeRouteParam(param: string | null | undefined): string | null {
    return normalizeNegocioRouteParam(param);
  }

  isReservedRouteParam(param: string | null | undefined): boolean {
    return isReservedNegocioRouteParam(param);
  }

  getRouteKeyById(id: number): Observable<string | null> {
    return this.getById(id).pipe(
      map((negocio) => resolveNegocioRouteKey(negocio)),
      catchError(() => of(null)),
    );
  }

  followNegocio(
    id: number,
    opts?: { notificaciones?: boolean },
  ): Observable<unknown> {
    const body =
      opts && typeof opts.notificaciones === 'boolean'
        ? { notificaciones: opts.notificaciones }
        : {};

    return this.http.post(buildApiUrl(`/negocios/${id}/seguir`), body);
  }

  unfollowNegocio(id: number) {
    return this.http.delete(buildApiUrl(`/negocios/${id}/seguir`));
  }

  getSeguidoresNegocio(id: number): Observable<NegocioFollowersResponse> {
    return this.http.get<NegocioFollowersResponse>(buildApiUrl(`/negocios/${id}/seguidores`));
  }

  seguirNegocio(
    id: number,
    opts?: { notificaciones?: boolean },
  ): Observable<NegocioFollowResponse> {
    return this.followNegocio(id, opts) as Observable<NegocioFollowResponse>;
  }

  dejarDeSeguirNegocio(id: number): Observable<NegocioFollowResponse> {
    return this.unfollowNegocio(id) as Observable<NegocioFollowResponse>;
  }

  toggleNotificacionesSeguimiento(
    negocioId: number,
    activas: boolean,
  ): Observable<{ activas: boolean }> {
    return this.http.patch<{ activas: boolean }>(
      buildApiUrl(`/negocios/${negocioId}/seguir/notificaciones`),
      { activas },
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
      nickname?: string | null;
      categoria?: { nombre?: string } | string;
      categoriaNombre?: string;
      descripcion?: string;
      descripcionCorta?: string;
      historia?: string;
      direccion?: string;
      ciudad?: string | null;
      provincia?: string | null;
      dueno?: { nickname?: string | null };
      owner?: { nickname?: string | null };
      foto?: string | null;
      fotoPerfil?: string | null;
      fotoPortada?: string | null;
      nenufarKey?: string | null;
      nenufarAsset?: string | null;
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
      ...(
        negocio.nickname?.trim() || negocio.dueno?.nickname?.trim() || negocio.owner?.nickname?.trim()
          ? {
              nickname:
                negocio.nickname?.trim() ||
                negocio.dueno?.nickname?.trim() ||
                negocio.owner?.nickname?.trim() ||
                null,
            }
          : {}
      ),
      categoria,
      descripcion:
        negocio.descripcionCorta?.trim() ||
        negocio.descripcion?.trim() ||
        negocio.historia?.trim() ||
        negocio.ciudad?.trim() ||
        negocio.direccion?.trim() ||
        'Sin descripcion disponible.',
      ...(negocio.ciudad?.trim() ? { ciudad: negocio.ciudad.trim() } : {}),
      ...(negocio.provincia?.trim() ? { provincia: negocio.provincia.trim() } : {}),
      foto: negocio.foto ?? null,
      fotoPerfil: negocio.fotoPerfil ?? null,
      fotoPortada: negocio.fotoPortada ?? null,
      nenufarKey: negocio.nenufarKey ?? null,
      nenufarAsset: negocio.nenufarAsset ?? null,
      raw: item,
    };
  }

  /** GET /api/negocios — listado con filtros */
  list(options: QueryNegociosOptions = {}): Observable<NegocioSummary[]> {
    let params = new HttpParams();
    if (options.q) {
      params = params.set('q', options.q);
      params = params.set('search', options.q);
    }
    if (options.categoriaId) params = params.set('categoriaId', String(options.categoriaId));
    if (options.subcategoriaId) params = params.set('subcategoriaId', String(options.subcategoriaId));
    if (options.page) params = params.set('page', String(options.page));
    if (options.limit) params = params.set('limit', String(options.limit));

    return this.http
      .get<NegocioSummary[] | ApiListResponse<unknown>>(
        buildApiUrl('/negocios'),
        { params },
      )
      .pipe(
        map((response) => extractItems(response)),
        map((items) =>
          items
            .map((item) => this.normalizarNegocioResumen(item))
            .filter((item): item is NegocioSummary => item !== null),
        ),
      );
  }

  /** POST /api/negocios — crear (ruta administrativa, requiere auth) */
  create(payload: CreateNegocioPayload): Observable<NegocioSummary> {
    return this.http
      .post<unknown>(buildApiUrl('/negocios'), payload)
      .pipe(map((response) => this.requireNegocioSummary(response, payload.nombre)));
  }

  /** PATCH /api/negocios/:id */
  update(id: number, payload: UpdateNegocioPayload): Observable<NegocioSummary> {
    return this.http
      .patch<unknown>(buildApiUrl(`/negocios/${id}`), payload)
      .pipe(map((response) => this.requireNegocioSummary(response, String(id))));
  }

  /** DELETE /api/negocios/:id */
  remove(id: number): Observable<unknown> {
    return this.http.delete<unknown>(buildApiUrl(`/negocios/${id}`));
  }

  /** GET /api/negocios/me/siguiendo/negocios — negocios que sigue el usuario autenticado */
  listSeguidos(): Observable<NegocioSummary[]> {
    return this.http
      .get<NegocioSummary[] | ApiListResponse<unknown>>(
        buildApiUrl('/negocios/me/siguiendo/negocios'),
      )
      .pipe(
        map((response) => extractItems(response)),
        map((items) =>
          items
            .map((item) => this.normalizarNegocioResumen(item))
            .filter((item): item is NegocioSummary => item !== null),
        ),
      );
  }

  /** GET /api/negocios/:id/horario */
  getHorario(id: number): Observable<NegocioHorario | null> {
    return this.http.get<NegocioHorario | null>(buildApiUrl(`/negocios/${id}/horario`));
  }

  /** PATCH /api/negocios/:id/config-horario */
  configHorario(id: number, payload: ConfigHorarioPayload): Observable<NegocioSummary> {
    return this.http.patch<NegocioSummary>(
      buildApiUrl(`/negocios/${id}/config-horario`),
      payload,
    );
  }

  /** GET /api/negocios/:id/resenas */
  getResenas(id: number): Observable<unknown[]> {
    return this.http
      .get<unknown[] | ApiListResponse<unknown>>(
        buildApiUrl(`/negocios/${id}/resenas`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  getResenasNegocio(id: number): Observable<unknown[]> {
    return this.getResenas(id);
  }

  getReservasNegocio(id: number, options: { page?: number; limit?: number } = {}): Observable<unknown[]> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', String(options.page));
    if (options.limit) params = params.set('limit', String(options.limit));

    return this.http
      .get<unknown[] | ApiListResponse<unknown>>(
        buildApiUrl(`/negocios/${id}/reservas`),
        { params },
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** GET /api/negocios/:id/miembros */
  listMiembros(id: number): Observable<NegocioMiembro[]> {
    return this.http
      .get<NegocioMiembro[] | ApiListResponse<NegocioMiembro>>(
        buildApiUrl(`/negocios/${id}/miembros`),
      )
      .pipe(map((response) => extractItems(response)));
  }

  /** POST /api/negocios/:id/miembros */
  createMiembro(id: number, payload: CreateMiembroPayload): Observable<NegocioMiembro> {
    return this.http.post<NegocioMiembro>(
      buildApiUrl(`/negocios/${id}/miembros`),
      payload,
    );
  }

  /** PATCH /api/negocios/:id/miembros/:uid */
  updateMiembro(id: number, usuarioId: number, payload: UpdateMiembroPayload): Observable<NegocioMiembro> {
    return this.http.patch<NegocioMiembro>(
      buildApiUrl(`/negocios/${id}/miembros/${usuarioId}`),
      payload,
    );
  }

  /** DELETE /api/negocios/:id/miembros/:uid */
  removeMiembro(id: number, usuarioId: number): Observable<unknown> {
    return this.http.delete<unknown>(
      buildApiUrl(`/negocios/${id}/miembros/${usuarioId}`),
    );
  }

  /** POST /api/negocios/:id/visitas */
  registrarVisita(id: number, payload: CreateVisitaPayload = {}): Observable<unknown> {
    return this.http.post<unknown>(
      buildApiUrl(`/negocios/${id}/visitas`),
      payload,
    );
  }

  private requireNegocioSummary(
    item: unknown,
    label: string,
  ): NegocioSummary {
    const normalized = this.normalizarNegocioResumen(item);

    if (normalized) {
      return normalized;
    }

    throw new Error(`No se ha podido normalizar el negocio: ${label || 'sin etiqueta'}`);
  }

  private normalizarNegocioResumen(item: unknown): NegocioSummary | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const negocio = item as {
      id?: number | string;
      nombre?: string;
      slug?: string | null;
      nickname?: string | null;
      categoria?: { id?: number; nombre?: string } | string;
      subcategoria?: { id?: number; nombre?: string } | string;
      historia?: string;
      descripcion?: string;
      descripcionCorta?: string;
      direccion?: string;
      ciudad?: string | null;
      provincia?: string | null;
      foto?: string | null;
      fotoPerfil?: string | null;
      fotoPortada?: string | null;
      nenufarKey?: string | null;
      nenufarAsset?: string | null;
      verificado?: boolean;
      aceptaReservas?: boolean;
      followersCount?: number;
      resenasCount?: number;
      productosCount?: number;
      reservasCount?: number;
      mediaResenas?: number;
      isFollowing?: boolean;
      isFollowedByMe?: boolean;
      dueno?: {
        id?: number | string;
        nombre?: string;
        nickname?: string | null;
        foto?: string | null;
      };
      owner?: { nickname?: string | null };
      duenoId?: number | string;
    };

    const id = Number(negocio.id);
    const nombre = negocio.nombre?.trim();

    if (!Number.isFinite(id) && !nombre) {
      return null;
    }

    return {
      id: Number.isFinite(id) ? id : 0,
      nombre: nombre || `Negocio ${id || ''}`.trim(),
      ...(negocio.slug?.trim() ? { slug: negocio.slug.trim() } : {}),
      ...(
        negocio.nickname?.trim() || negocio.dueno?.nickname?.trim() || negocio.owner?.nickname?.trim()
          ? {
              nickname:
                negocio.nickname?.trim() ||
                negocio.dueno?.nickname?.trim() ||
                negocio.owner?.nickname?.trim() ||
                null,
            }
          : {}
      ),
      ...(negocio.categoria ? { categoria: negocio.categoria } : {}),
      ...(negocio.subcategoria ? { subcategoria: negocio.subcategoria } : {}),
      ...(negocio.historia?.trim() ? { historia: negocio.historia.trim() } : {}),
      ...(negocio.descripcion?.trim() ? { descripcion: negocio.descripcion.trim() } : {}),
      ...(negocio.descripcionCorta?.trim() ? { descripcionCorta: negocio.descripcionCorta.trim() } : {}),
      ...(negocio.direccion?.trim() ? { direccion: negocio.direccion.trim() } : {}),
      ...(negocio.ciudad?.trim() ? { ciudad: negocio.ciudad.trim() } : {}),
      ...(negocio.provincia?.trim() ? { provincia: negocio.provincia.trim() } : {}),
      ...(typeof negocio.foto === 'string' ? { foto: negocio.foto } : {}),
      ...(typeof negocio.fotoPerfil === 'string' ? { fotoPerfil: negocio.fotoPerfil } : {}),
      ...(typeof negocio.fotoPortada === 'string' ? { fotoPortada: negocio.fotoPortada } : {}),
      ...(typeof negocio.nenufarKey === 'string' ? { nenufarKey: negocio.nenufarKey } : {}),
      ...(typeof negocio.nenufarAsset === 'string' ? { nenufarAsset: negocio.nenufarAsset } : {}),
      ...(typeof negocio.verificado === 'boolean' ? { verificado: negocio.verificado } : {}),
      ...(typeof negocio.aceptaReservas === 'boolean' ? { aceptaReservas: negocio.aceptaReservas } : {}),
      ...(typeof negocio.followersCount === 'number' ? { followersCount: negocio.followersCount } : {}),
      ...(typeof negocio.resenasCount === 'number' ? { resenasCount: negocio.resenasCount } : {}),
      ...(typeof negocio.productosCount === 'number' ? { productosCount: negocio.productosCount } : {}),
      ...(typeof negocio.reservasCount === 'number' ? { reservasCount: negocio.reservasCount } : {}),
      ...(typeof negocio.mediaResenas === 'number' ? { mediaResenas: negocio.mediaResenas } : {}),
      ...(typeof negocio.isFollowing === 'boolean' ? { isFollowing: negocio.isFollowing } : {}),
      ...(typeof negocio.isFollowedByMe === 'boolean' ? { isFollowedByMe: negocio.isFollowedByMe } : {}),
      ...(Number.isFinite(Number(negocio.duenoId)) ? { duenoId: Number(negocio.duenoId) } : {}),
      ...(negocio.dueno
        ? {
            dueno: {
              ...(Number.isFinite(Number(negocio.dueno.id)) ? { id: Number(negocio.dueno.id) } : {}),
              ...(negocio.dueno.nombre?.trim() ? { nombre: negocio.dueno.nombre.trim() } : {}),
              ...(negocio.dueno.nickname?.trim() ? { nickname: negocio.dueno.nickname.trim() } : {}),
              ...(typeof negocio.dueno.foto === 'string' ? { foto: negocio.dueno.foto } : {}),
            },
          }
        : {}),
    };
  }

  private matchesPublicRouteKey(
    negocio: NegocioRouteTarget | null | undefined,
    routeKey: string,
  ): boolean {
    const normalizedCandidate = normalizeSearchText(routeKey);
    if (!normalizedCandidate) {
      return false;
    }

    return [
      resolveNegocioRouteKey(negocio),
      negocio?.slug ?? null,
      negocio?.nickname ?? null,
      negocio?.nombre ?? null,
      slugifyPublicSegment(negocio?.nombre),
    ]
      .map((value) => normalizeSearchText(value ?? ''))
      .filter(Boolean)
      .includes(normalizedCandidate);
  }

  private filterNegocios(items: NegocioSummary[], normalizedQuery: string): NegocioSummary[] {
    return items.filter((item) => {
      const categoriaNombre =
        typeof item.categoria === 'string'
          ? item.categoria
          : item.categoria?.nombre;

      return [
        item.nombre,
        item.nickname,
        item.slug,
        item.ciudad,
        item.provincia,
        categoriaNombre,
        item.direccion,
      ]
        .map((value) => normalizeSearchText(value ?? ''))
        .some((value) => value.includes(normalizedQuery));
    });
  }

  private isControlledLookup404(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 404;
  }

  private isNotFoundLookupError(error: unknown): boolean {
    return error instanceof Error && /negocio no encontrado/i.test(error.message);
  }

}
