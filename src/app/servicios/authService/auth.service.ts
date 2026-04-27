import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  of,
  switchMap,
  tap,
  throwError
} from 'rxjs';
import { buildApiUrl } from '../../config/api.config';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id?: number;
  nombre?: string;
  nickname?: string;
  email?: string;
  rol?: string;
  biografia?: string;
  foto_perfil?: string;
  negocio?: {
    id?: number;
    nombre?: string;
  };
  [key: string]: unknown;
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
  nickname?: string;
  email?: string;
  password?: string;
  biografia?: string;
  nombreNegocio?: string;
  direccion?: string;
  fechaFundacion?: string | null;
  historia?: string;
  categoriaNombre?: string;
  [key: string]: unknown;
}

type HydrateSessionOptions = {
  forceRemote?: boolean;
};

type CategoriaApi = {
  id?: number;
  nombre?: string;
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
  private readonly apiUrl = this.resolveApiUrl();
  private readonly token$ = new BehaviorSubject<string | null>(null);

  constructor(private http: HttpClient) {
    this.token$.next(this.getToken());
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
        `${this.apiUrl}/auth/login`,
        { email, password },
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          const token = this.extraerToken(response as AuthResponse);
          const usuario = this.normalizarUsuario(response);

          if (token) {
            this.persistSession(token, usuario);
          } else if (usuario) {
            this.guardarUsuario(usuario);
          }
        })
      );
  }

  register(data: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/registro`, {
        nombre: data.nombre,
        nickname: data.nickname,
        email: data.email,
        password: data.password,
        biografia: data.biografia
      }, { withCredentials: true })
      .pipe(
        tap((response) => {
          const token = this.extraerToken(response);
          const usuario = this.normalizarUsuario(response);

          if (token) {
            this.persistSession(token, usuario);
          } else if (usuario) {
            this.guardarUsuario(usuario);
          }
        })
      );
  }

  registerNegocio(data: RegisterPayload): Observable<AuthResponse> {
    return this.register(data).pipe(
      switchMap((response) =>
        this.obtenerUsuarioRegistrado(response).pipe(
          switchMap((usuario) => {
            const userId = Number(usuario?.id);

            if (!Number.isFinite(userId) || userId <= 0) {
              return throwError(() => new Error('No hemos podido identificar al dueño del negocio.'));
            }

            return this.crearNegocioParaUsuario(data, userId).pipe(
              map(() => response)
            );
          })
        )
      )
    );
  }

  persistSession(token: string, usuario?: AuthUser | null): void {
    this.guardarToken(token);

    if (usuario) {
      this.guardarUsuario(usuario);
    }
  }

  hydrateSession(options: HydrateSessionOptions = {}): Observable<AuthUser | null> {
    const token = this.getToken();
    const usuario = this.obtenerUsuario();

    this.token$.next(token);

    if (usuario) {
      return of(usuario);
    }

    if (!options.forceRemote && !token) {
      return of(null);
    }

    return this.me().pipe(
      catchError(() => of(null))
    );
  }

  isAuthenticated(): boolean {
    return Boolean(this.obtenerUsuario() || this.getToken());
  }

  me(): Observable<AuthUser | null> {
    return this.http.get<unknown>(`${this.apiUrl}/auth/me`, { withCredentials: true }).pipe(
      map((response) => this.normalizarUsuario(response)),
      catchError(() => of(this.obtenerUsuario())),
      tap((usuario) => {
        if (usuario) {
          this.guardarUsuario(usuario);
        }
      })
    );
  }

  guardarUsuario(usuario: AuthUser): void {
    writeStorageJson('usuarioLogueado', usuario);
  }

  obtenerUsuario(): AuthUser | null {
    return readStorageJson<AuthUser>('usuarioLogueado');
  }

  guardarToken(token: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const normalizedToken = token?.trim();

    if (!normalizedToken) {
      removeStorageKey('token');
      removeStorageKey('access_token');
      this.token$.next(null);
      return;
    }

    localStorage.setItem('token', normalizedToken);
    localStorage.setItem('access_token', normalizedToken);
    this.token$.next(normalizedToken);
  }

  getToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem('token') || localStorage.getItem('access_token');
  }

  logout(): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      catchError(() => of(null)),
      tap(() => this.clearSession())
    );
  }

  private crearNegocioParaUsuario(data: RegisterPayload, duenoId: number): Observable<unknown> {
    const payloadBase: Record<string, unknown> = {
      nombre: data.nombreNegocio?.trim() || '',
      direccion: data.direccion?.trim() || '',
      fechaFundacion: data.fechaFundacion ?? null,
      historia: data.historia?.trim() || '',
      duenoId
    };

    const categoriaNombre = data.categoriaNombre?.trim();
    const primerIntento = categoriaNombre
      ? { ...payloadBase, categoriaNombre }
      : payloadBase;

    return this.http
      .post(`${this.apiUrl}/negocios`, primerIntento, { withCredentials: true })
      .pipe(
        catchError((error) => {
          if (!categoriaNombre) {
            return throwError(() => error);
          }

          return this.resolverCategoriaId(categoriaNombre).pipe(
            switchMap((categoriaId) => {
              if (!categoriaId) {
                return throwError(() => error);
              }

              const payloadConCategoriaId = {
                ...payloadBase,
                categoriaId
              };

              return this.http.post(
                `${this.apiUrl}/negocios`,
                payloadConCategoriaId,
                { withCredentials: true }
              );
            }),
            catchError(() => throwError(() => error))
          );
        })
      );
  }

  private obtenerUsuarioRegistrado(response: AuthResponse): Observable<AuthUser | null> {
    const usuario = this.normalizarUsuario(response);
    if (usuario?.id) {
      return of(usuario);
    }

    return this.me().pipe(
      map((me) => me ?? usuario)
    );
  }

  private resolverCategoriaId(categoriaNombre: string): Observable<number | null> {
    return this.http
      .get<CategoriaApi[]>(buildApiUrl('/categorias'))
      .pipe(
        map((categorias) => {
          const exacta = categorias.find(
            (categoria) =>
              categoria.nombre?.trim().toLowerCase() === categoriaNombre.trim().toLowerCase()
          );

          const categoriaId = Number(exacta?.id);
          return Number.isFinite(categoriaId) && categoriaId > 0 ? categoriaId : null;
        }),
        catchError(() => of(null))
      );
  }

  private clearSession(): void {
    removeStorageKey('token');
    removeStorageKey('access_token');
    removeStorageKey('usuarioLogueado');
    this.token$.next(null);
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

    return wrapper.usuario ?? wrapper.user ?? wrapper.data ?? (response as AuthUser);
  }

  private extraerToken(response: AuthResponse | null | undefined): string | null {
    const token = response?.access_token ?? response?.accessToken ?? response?.token;
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  }

  private resolveApiUrl(): string {
    const envUrl = environment.api?.trim();

    if (envUrl) {
      return envUrl.replace(/\/+$/, '');
    }

    return buildApiUrl('/api').replace(/\/+$/, '');
  }
}
