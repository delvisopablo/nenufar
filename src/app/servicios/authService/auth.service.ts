import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { buildApiUrl } from '../../config/api.config';
import {
  clearAccessToken,
  readAccessToken,
} from './auth.storage';

export interface AuthBusiness {
  id?: number;
  nombre?: string;
  slug?: string | null;
  nickname?: string | null;
  fotoPerfil?: string | null;
  nenufarAsset?: string | null;
  horario?: unknown;
  intervaloReserva?: number | null;
  reservasActivas?: boolean;
}

export type GlobalRole = 'USUARIO' | 'MODERADOR' | 'ADMIN';

export interface AuthUser {
  id?: number;
  nombre?: string;
  nickname?: string;
  email?: string;
  emailVerificado?: boolean;
  emailVerified?: boolean;
  email_verificado?: boolean;
  rolGlobal?: GlobalRole | string;
  rol?: string;
  biografia?: string;
  foto?: string | null;
  fotoPerfil?: string | null;
  foto_perfil?: string | null;
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

export function requiresPendingEmailVerification(
  usuario: AuthUser | null | undefined,
): boolean {
  if (!usuario) {
    return false;
  }

  return [
    usuario.emailVerificado,
    usuario.emailVerified,
    usuario.email_verificado,
  ].some((value) => value === false);
}

export interface AuthResponse {
  access_token?: string;
  accessToken?: string;
  token?: string;
  usuario?: AuthUser;
  user?: AuthUser;
  data?: AuthUser;
  requiresEmailVerification?: boolean;
  emailVerification?: {
    email?: string;
    expiresInMinutes?: number;
  };
}

export type LoginResponse = AuthResponse | AuthUser;

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface EmailVerificationPayload {
  email: string;
  code: string;
}

export interface ResendEmailCodePayload {
  email: string;
}

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
  reservasActivas?: boolean;
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
  private readonly usuarioSignal = signal<AuthUser | null>(
    readStorageJson<AuthUser>('usuarioLogueado'),
  );
  private readonly authStatusSignal = signal<AuthStatus>('loading');

  readonly usuarioActual = this.usuarioSignal.asReadonly();
  readonly authStatus = this.authStatusSignal.asReadonly();

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

  login(
    email: string,
    password: string,
    rememberMe = false,
  ): Observable<LoginResponse | AuthUser | null> {
    this.authStatusSignal.set('loading');

    return this.http
      .post<LoginResponse>(
        buildApiUrl('/auth/login'),
        { email, password, rememberMe },
        { withCredentials: true },
      )
      .pipe(
        tap((response) => this.persistirUsuarioDesdeRespuesta(response)),
        switchMap((response) => {
          // Snapshot the user stored from the login response before calling me().
          // If me() returns 401 (cross-origin cookie not yet propagated) it calls
          // clearStoredAuth(), wiping the just-persisted session. We detect that
          // and restore from the login response so the user stays authenticated.
          const loginUser = this.obtenerUsuario();
          return this.me().pipe(
            map((usuario) => {
              if (!usuario && loginUser) {
                this.guardarUsuario(loginUser);
              }
              return usuario ?? response;
            }),
          );
        }),
        tap({
          error: () => {
            this.authStatusSignal.set(
              this.obtenerUsuario() ? 'authenticated' : 'unauthenticated',
            );
          },
        }),
      );
  }

  register(data: RegisterPayload): Observable<AuthResponse> {
    const codigoReferido =
      typeof data.codigoReferido === 'string' ? data.codigoReferido.trim() : '';

    return this.http
      .post<AuthResponse>(
        buildApiUrl('/auth/registro'),
        {
          nombre: data.nombre,
          nickname: data.nickname,
          email: data.email,
          password: data.password,
          biografia: data.biografia,
          ...(codigoReferido ? { codigoReferido } : {}),
        },
        { withCredentials: true },
      )
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
    const descripcionCorta =
      typeof data['descripcionCorta'] === 'string'
        ? (data['descripcionCorta'] as string).trim()
        : '';
    const codigoNenufarizacion =
      typeof data.codigoNenufarizacion === 'string'
        ? data.codigoNenufarizacion.trim().toUpperCase()
        : '';
    const nenufarActivo =
      typeof data.nenufarActivo === 'string' ? data.nenufarActivo.trim() : '';

    const payload: Record<string, unknown> = {
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
      ...(descripcionCorta ? { descripcionCorta } : {}),
      ...(codigoNenufarizacion ? { codigoNenufarizacion } : {}),
      nenufarActivo: nenufarActivo || null,
      ...(data.horario
        ? {
            horario: data.horario,
            intervaloReserva: data.intervaloReserva ?? 30,
            reservasActivas: data.reservasActivas ?? true,
          }
        : {}),
    };

    return this.http
      .post<AuthResponse>(
        buildApiUrl('/auth/registro-negocio'),
        payload,
        { withCredentials: true },
      )
      .pipe(
        tap((response) => this.persistirUsuarioDesdeRespuesta(response))
      );
  }

  hydrateSession(options: HydrateSessionOptions = {}): Observable<AuthUser | null> {
    const usuario = this.obtenerUsuario();

    if (usuario && (!options.forceRemote || this.sessionHydrated)) {
      this.usuarioSignal.set(usuario);
      if (this.sessionHydrated) {
        this.authStatusSignal.set('authenticated');
      }
      return of(usuario);
    }

    if (!options.forceRemote) {
      if (this.sessionHydrated) {
        this.authStatusSignal.set('unauthenticated');
      }
      return of(null);
    }

    if (this.sessionHydrated) {
      this.authStatusSignal.set(usuario ? 'authenticated' : 'unauthenticated');
      return of(usuario);
    }

    if (this.hydrationRequest$) {
      return this.hydrationRequest$;
    }

    this.authStatusSignal.set('loading');
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
    clearAccessToken();
    return Boolean(this.obtenerUsuario());
  }

  isAuthenticated(): boolean {
    const status = this.authStatusSignal();

    if (status === 'authenticated') {
      return true;
    }

    if (status === 'unauthenticated') {
      return false;
    }

    return Boolean(this.usuarioSignal() || this.obtenerUsuario());
  }

  isAuthLoading(): boolean {
    return this.authStatusSignal() === 'loading';
  }

  isSessionResolved(): boolean {
    return this.sessionHydrated;
  }

  esAdmin(usuario: AuthUser | null | undefined = this.obtenerUsuario()): boolean {
    return usuario?.rolGlobal === 'ADMIN';
  }

  me(): Observable<AuthUser | null> {
    return this.http.get<unknown>(
      buildApiUrl('/auth/me'),
      { withCredentials: true },
    ).pipe(
      map((response) => this.normalizarUsuario(response)),
      tap((usuario) => {
        this.sessionHydrated = true;

        if (usuario) {
          this.guardarUsuario(usuario);
          return;
        }

        this.clearStoredUser();
        this.authStatusSignal.set('unauthenticated');
      }),
      catchError((error: unknown) => {
        this.sessionHydrated = true;

        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clearStoredAuth();
          return of(null);
        }

        this.authStatusSignal.set(
          this.obtenerUsuario() ? 'authenticated' : 'unauthenticated',
        );
        return of(null);
      })
    );
  }

  persistirUsuarioDesdeRespuesta(response: unknown): void {
    clearAccessToken();

    if (this.responseRequiresEmailVerification(response)) {
      this.clearStoredUser();
      this.authStatusSignal.set('unauthenticated');
      return;
    }

    const usuario = this.normalizarUsuario(response);

    if (usuario) {
      this.guardarUsuario(usuario);
    }
  }

  clearStoredUser(): void {
    removeStorageKey('usuarioLogueado');
    this.usuarioSignal.set(null);
  }

  clearStoredAuth(): void {
    clearAccessToken();
    this.clearStoredUser();
    this.authStatusSignal.set('unauthenticated');
  }

  clearSession(): void {
    clearAccessToken();
    this.clearStoredUser();
    removeStorageKey('accesoPermitido');
    removeStorageKey('guestMode');
    this.hydrationRequest$ = null;
    this.sessionHydrated = true;
    this.authStatusSignal.set('unauthenticated');
  }

  logout(): Observable<unknown> {
    return this.http.post(
      buildApiUrl('/auth/logout'),
      {},
      { withCredentials: true },
    ).pipe(
      catchError(() => of(null)),
      tap(() => this.clearSession())
    );
  }

  guardarUsuario(usuario: AuthUser): void {
    writeStorageJson('usuarioLogueado', usuario);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('accesoPermitido', 'true');
      localStorage.removeItem('guestMode');
    }
    this.usuarioSignal.set(usuario);
    this.sessionHydrated = true;
    this.authStatusSignal.set('authenticated');
  }

  obtenerAccessToken(): string | null {
    return readAccessToken();
  }

  hasAccessToken(): boolean {
    return this.isAuthenticated();
  }

  obtenerUsuario(): AuthUser | null {
    return readStorageJson<AuthUser>('usuarioLogueado');
  }

  /** POST /api/auth/refresh — renueva access token (cookie) */
  refresh(): Observable<unknown> {
    return this.http.post<unknown>(buildApiUrl('/auth/refresh'), {});
  }

  /** POST /api/auth/verificar-email — body: { email, code } */
  verifyEmail(payload: EmailVerificationPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        buildApiUrl('/auth/verificar-email'),
        {
          email: payload.email,
          code: payload.code,
        },
        { withCredentials: true },
      )
      .pipe(
        tap((response) => this.persistirUsuarioDesdeRespuesta(response))
      );
  }

  /** POST /api/auth/reenviar-codigo-email — body: { email } */
  resendEmailCode(payload: ResendEmailCodePayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      buildApiUrl('/auth/reenviar-codigo-email'),
      {
        email: payload.email,
      },
      { withCredentials: true },
    );
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

    const fotoPerfil =
      usuario.foto_perfil ??
      usuario.fotoPerfil ??
      (typeof usuario.foto === 'string' ? usuario.foto : undefined);

    return {
      ...usuario,
      ...(rolGlobal ? { rolGlobal } : {}),
      foto: usuario.foto ?? fotoPerfil ?? null,
      fotoPerfil: fotoPerfil ?? null,
      foto_perfil: fotoPerfil ?? null,
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

  private responseRequiresEmailVerification(response: unknown): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    return (response as AuthResponse).requiresEmailVerification === true;
  }
}
