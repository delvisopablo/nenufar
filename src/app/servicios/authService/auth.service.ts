import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  tap,
} from 'rxjs';
import { buildApiUrl } from '../../config/api.config';
import {
  clearAccessToken,
  hasAccessToken as hasStoredAccessToken,
  readAccessToken,
  writeAccessToken,
} from './auth.storage';

export interface AuthBusiness {
  id?: number;
  nombre?: string;
  slug?: string | null;
  nickname?: string | null;
  fotoPerfil?: string | null;
  nenufarAsset?: string | null;
}

export type GlobalRole = 'USUARIO' | 'MODERADOR' | 'ADMIN';

export interface AuthUser {
  id?: number;
  nombre?: string;
  nickname?: string;
  email?: string;
  rolGlobal?: GlobalRole | string;
  rol?: string;
  biografia?: string;
  foto?: string | null;
  foto_perfil?: string;
  negocio?: AuthBusiness;
  negocios?: AuthBusiness[];
  [key: string]: unknown;
}

export function resolveOwnedBusinessId(
  usuario: AuthUser | null | undefined,
): number | null {
  const directId = Number(usuario?.negocio?.id);
  if (Number.isFinite(directId) && directId > 0) {
    return directId;
  }

  const firstBusinessId = Number(usuario?.negocios?.[0]?.id);
  if (Number.isFinite(firstBusinessId) && firstBusinessId > 0) {
    return firstBusinessId;
  }

  return null;
}

export function resolvePrivateProfileRoute(
  usuario: AuthUser | null | undefined,
): string[] {
  return resolveOwnedBusinessId(usuario) ? ['/mi-negocio'] : ['/mi-perfil'];
}

export interface AuthResponse {
  access_token?: string;
  accessToken?: string;
  token?: string;
  usuario?: AuthUser;
  user?: AuthUser;
  data?: AuthUser;
}

export type LoginResponse = AuthResponse | AuthUser;

export interface RegisterPayload {
  nombre?: string;
  nombreDueño?: string;
  nombreDueno?: string;
  nickname?: string;
  email?: string;
  password?: string;
  biografia?: string;
  codigoReferido?: string;
  nombreNegocio?: string;
  direccion?: string;
  fechaFundacion?: string | null;
  descripcion?: string;
  historia?: string;
  codigoNenufarizacion?: string;
  categoriaNombre?: string;
  categoriaId?: number;
  subcategoriaId?: number;
  nenufarActivo?: string | null;
  intervaloReserva?: number;
  horario?: unknown;
  duenoId?: number;
  usuarioId?: number;
  [key: string]: unknown;
}

type HydrateSessionOptions = {
  forceRemote?: boolean;
};

function readStorageJson<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  if (raw === 'undefined' || raw === 'null') {
    localStorage.removeItem(key);
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as T | null;

    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function writeStorageJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  if (!value || typeof value !== 'object') {
    localStorage.removeItem(key);
    return;
  }

  try {
    const serialized = JSON.stringify(value);

    if (!serialized || serialized === 'undefined' || serialized === 'null') {
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, serialized);
  } catch {
    localStorage.removeItem(key);
  }
}

function removeStorageKey(key: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sessionHydrated = false;
  private hydrationRequest$: Observable<AuthUser | null> | null = null;

  constructor(private http: HttpClient) {
    readAccessToken();
  }

  usuarioExiste(usuario: string, email: string): boolean {
    const registrados = readStorageJson<Array<{ nickname?: string; email?: string }>>(
      'usuariosRegistrados'
    ) ?? [];

    return registrados.some(
      (item) => item.nickname === usuario || item.email === email
    );
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        buildApiUrl('/auth/login'),
        { email, password }
      )
      .pipe(
        tap((response) => this.persistirUsuarioDesdeRespuesta(response))
      );
  }

  register(data: RegisterPayload): Observable<AuthResponse> {
    const codigoReferido =
      typeof data.codigoReferido === 'string' ? data.codigoReferido.trim() : '';

    return this.http
      .post<AuthResponse>(buildApiUrl('/auth/registro'), {
        nombre: data.nombre,
        nickname: data.nickname,
        email: data.email,
        password: data.password,
        biografia: data.biografia,
        ...(codigoReferido ? { codigoReferido } : {}),
      })
      .pipe(
        tap((response) => this.persistirUsuarioDesdeRespuesta(response))
      );
  }

  registerNegocio(data: RegisterPayload): Observable<AuthResponse> {
    const categoriaId = Number(data.categoriaId);
    const subcategoriaId = Number(data.subcategoriaId);
    const direccion =
      typeof data.direccion === 'string' ? data.direccion.trim() : '';
    const fechaFundacion =
      typeof data.fechaFundacion === 'string' ? data.fechaFundacion.trim() : '';
    const historia =
      data.historia?.trim() ||
      data.descripcion?.trim() ||
      data.biografia?.trim() ||
      '';
    const codigoNenufarizacion =
      typeof data.codigoNenufarizacion === 'string'
        ? data.codigoNenufarizacion.trim().toUpperCase()
        : '';
    const nenufarActivo =
      typeof data.nenufarActivo === 'string' ? data.nenufarActivo.trim() : '';

    const payload = {
      nombreDueno:
        data.nombreDueno?.trim() ||
        data.nombreDueño?.trim() ||
        data.nombre?.trim() ||
        '',
      nickname: data.nickname?.trim() || '',
      email: data.email?.trim().toLowerCase() || '',
      password: data.password || '',
      nombreNegocio: data.nombreNegocio?.trim() || '',
      categoriaId,
      ...(Number.isFinite(subcategoriaId) && subcategoriaId > 0
        ? { subcategoriaId }
        : {}),
      ...(direccion ? { direccion } : {}),
      ...(fechaFundacion ? { fechaFundacion } : {}),
      ...(historia ? { historia } : {}),
      ...(codigoNenufarizacion ? { codigoNenufarizacion } : {}),
      nenufarActivo: nenufarActivo || null,
    };

    console.log('Payload registro negocio:', payload);

    return this.http
      .post<AuthResponse>(
        buildApiUrl('/auth/registro-negocio'),
        payload
      )
      .pipe(
        tap((response) => this.persistirUsuarioDesdeRespuesta(response))
      );
  }

  hydrateSession(options: HydrateSessionOptions = {}): Observable<AuthUser | null> {
    const usuario = this.obtenerUsuario();

    if (usuario && (!options.forceRemote || this.sessionHydrated)) {
      return of(usuario);
    }

    if (!options.forceRemote) {
      return of(null);
    }

    if (this.sessionHydrated) {
      return of(usuario);
    }

    if (this.hydrationRequest$) {
      return this.hydrationRequest$;
    }

    this.hydrationRequest$ = this.me().pipe(
      tap(() => {
        this.sessionHydrated = true;
      }),
      finalize(() => {
        this.hydrationRequest$ = null;
      }),
      shareReplay(1),
    );

    return this.hydrationRequest$;
  }

  hasSessionHint(): boolean {
    return this.hasAccessToken();
  }

  isAuthenticated(): boolean {
    return Boolean(this.obtenerUsuario() || this.hasAccessToken());
  }

  esAdmin(usuario: AuthUser | null | undefined = this.obtenerUsuario()): boolean {
    return usuario?.rolGlobal === 'ADMIN';
  }

  me(): Observable<AuthUser | null> {
    return this.http.get<unknown>(buildApiUrl('/auth/me')).pipe(
      map((response) => this.normalizarUsuario(response)),
      tap((usuario) => {
        this.sessionHydrated = true;

        if (usuario) {
          this.guardarUsuario(usuario);
          return;
        }

        removeStorageKey('usuarioLogueado');
      }),
      catchError((error: unknown) => {
        this.sessionHydrated = true;

        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clearStoredAuth();
          return of(null);
        }

        return of(null);
      })
    );
  }

  persistirUsuarioDesdeRespuesta(response: unknown): void {
    const accessToken = this.extraerAccessToken(response);
    if (accessToken) {
      writeAccessToken(accessToken);
    }

    const usuario = this.normalizarUsuario(response);

    if (usuario) {
      this.guardarUsuario(usuario);
    }
  }

  clearStoredUser(): void {
    removeStorageKey('usuarioLogueado');
  }

  clearStoredAuth(): void {
    clearAccessToken();
    this.clearStoredUser();
  }

  clearSession(): void {
    clearAccessToken();
    removeStorageKey('usuarioLogueado');
    removeStorageKey('accesoPermitido');
    removeStorageKey('guestMode');
    this.hydrationRequest$ = null;
    this.sessionHydrated = false;
  }

  logout(): Observable<unknown> {
    return this.http.post(buildApiUrl('/auth/logout'), {}).pipe(
      catchError(() => of(null)),
      tap(() => this.clearSession())
    );
  }

  guardarUsuario(usuario: AuthUser): void {
    writeStorageJson('usuarioLogueado', usuario);
    this.sessionHydrated = true;
  }

  obtenerAccessToken(): string | null {
    return readAccessToken();
  }

  hasAccessToken(): boolean {
    return hasStoredAccessToken();
  }

  obtenerUsuario(): AuthUser | null {
    return readStorageJson<AuthUser>('usuarioLogueado');
  }

  /** POST /api/auth/refresh — renueva access token (cookie) */
  refresh(): Observable<unknown> {
    return this.http.post<unknown>(buildApiUrl('/auth/refresh'), {});
  }

  /** POST /api/auth/verify-email — body: { token } */
  verifyEmail(token: string): Observable<unknown> {
    return this.http.post<unknown>(buildApiUrl('/auth/verify-email'), { token });
  }

  /** POST /api/auth/forgot-password — body: { email } */
  forgotPassword(email: string): Observable<unknown> {
    return this.http.post<unknown>(buildApiUrl('/auth/forgot-password'), { email });
  }

  /** POST /api/auth/reset-password — body: { token, newPassword } */
  resetPassword(token: string, newPassword: string): Observable<unknown> {
    return this.http.post<unknown>(buildApiUrl('/auth/reset-password'), {
      token,
      newPassword,
    });
  }

  private normalizarUsuario(response: unknown): AuthUser | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const wrapper = response as {
      usuario?: AuthUser;
      user?: AuthUser;
      data?: AuthUser;
    };

    const usuario = wrapper.usuario ?? wrapper.user ?? wrapper.data ?? (response as AuthUser);

    if (!usuario || typeof usuario !== 'object') {
      return null;
    }

    const usuarioRaw = usuario as AuthUser & {
      negocios?: Array<AuthBusiness | null | undefined>;
    };
    const negocios = Array.isArray(usuarioRaw.negocios)
      ? usuarioRaw.negocios
          .filter((item): item is AuthBusiness => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            ...item,
            slug: typeof item.slug === 'string' ? item.slug : null,
            nickname: typeof item.nickname === 'string' ? item.nickname : null,
          }))
      : undefined;
    const negocio =
      (usuarioRaw.negocio && typeof usuarioRaw.negocio === 'object'
        ? {
            ...usuarioRaw.negocio,
            slug: typeof usuarioRaw.negocio.slug === 'string' ? usuarioRaw.negocio.slug : null,
            nickname:
              typeof usuarioRaw.negocio.nickname === 'string'
                ? usuarioRaw.negocio.nickname
                : null,
          }
        : undefined) ??
      negocios?.[0];
    const rolGlobal =
      typeof usuarioRaw.rolGlobal === 'string' && usuarioRaw.rolGlobal.trim()
        ? usuarioRaw.rolGlobal.trim().toUpperCase()
        : undefined;

    return {
      ...usuario,
      ...(rolGlobal ? { rolGlobal } : {}),
      foto_perfil:
        usuario.foto_perfil ??
        (typeof usuario.foto === 'string' ? usuario.foto : undefined),
      ...(negocios ? { negocios } : {}),
      ...(negocio ? { negocio } : {}),
    };
  }

  private extraerAccessToken(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const wrapper = response as {
      access_token?: unknown;
      accessToken?: unknown;
      token?: unknown;
      data?: {
        access_token?: unknown;
        accessToken?: unknown;
        token?: unknown;
      };
    };

    const tokenCandidate =
      wrapper.accessToken ??
      wrapper.access_token ??
      wrapper.token ??
      wrapper.data?.accessToken ??
      wrapper.data?.access_token ??
      wrapper.data?.token;

    return typeof tokenCandidate === 'string' && tokenCandidate.trim()
      ? tokenCandidate.trim()
      : null;
  }
}
