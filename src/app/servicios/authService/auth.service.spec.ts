import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { CredentialsInterceptor } from './credentials.interceptor';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([CredentialsInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('register uses /auth/registro and persists only user info', () => {
    service.register({
      nombre: 'Pablo',
      nickname: 'pablo',
      email: 'pablo@example.com',
      password: 'secret123',
      biografia: 'Hola'
    }).subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/registro');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({
      nombre: 'Pablo',
      nickname: 'pablo',
      email: 'pablo@example.com',
      password: 'secret123',
      biografia: 'Hola'
    });

    req.flush({
      access_token: 'token-registro',
      usuario: { id: 21, nombre: 'Pablo', email: 'pablo@example.com' }
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(service.obtenerUsuario()?.id).toBe(21);
  });

  it('login keeps using /auth/login and stores only the returned user', () => {
    service.login('pablo@example.com', 'secret123').subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({
      email: 'pablo@example.com',
      password: 'secret123'
    });

    req.flush({
      access_token: 'token-login',
      usuario: { id: 44, email: 'pablo@example.com' }
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(service.obtenerUsuario()?.id).toBe(44);
  });

  it('registerNegocio uses /auth/registro-negocio and persists only the returned user', () => {
    service.registerNegocio({
      nombreDueño: 'Paula',
      nickname: 'paula-cafe',
      email: 'paula@example.com',
      password: 'secret123',
      nombreNegocio: 'Cafe Nenufar',
      direccion: 'Calle Lago 3',
      fechaFundacion: '2024-04-01',
      historia: 'Cafe de barrio',
      categoriaNombre: 'Cafeteria'
    }).subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/registro-negocio');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({
      nombreDueno: 'Paula',
      nickname: 'paula-cafe',
      email: 'paula@example.com',
      password: 'secret123',
      nombreNegocio: 'Cafe Nenufar',
      direccion: 'Calle Lago 3',
      fechaFundacion: '2024-04-01',
      historia: 'Cafe de barrio',
      categoriaNombre: 'Cafeteria'
    });

    req.flush({
      access_token: 'token-negocio',
      usuario: {
        id: 101,
        nombre: 'Paula',
        nickname: 'paula-cafe',
        email: 'paula@example.com',
        rol: 'negocio',
        negocio: {
          id: 55,
          nombre: 'Cafe Nenufar'
        }
      }
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(service.obtenerUsuario()?.id).toBe(101);
    expect(service.obtenerUsuario()?.negocio).toEqual({
      id: 55,
      nombre: 'Cafe Nenufar'
    });
  });

  it('me hydrates the stored user and clears stale storage on 401', () => {
    localStorage.setItem('usuarioLogueado', JSON.stringify({ id: 7, nombre: 'Stale' }));

    let hydratedUser: unknown;
    service.me().subscribe((user) => {
      hydratedUser = user;
    });

    const req = httpMock.expectOne('http://localhost:3000/api/auth/me');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(
      {
        usuario: { id: 99, nombre: 'Fresh user' }
      }
    );

    expect(hydratedUser).toEqual({ id: 99, nombre: 'Fresh user' });
    expect(service.obtenerUsuario()).toEqual({ id: 99, nombre: 'Fresh user' });

    service.me().subscribe((user) => {
      hydratedUser = user;
    });

    const unauthorizedReq = httpMock.expectOne('http://localhost:3000/api/auth/me');
    expect(unauthorizedReq.request.withCredentials).toBeTrue();
    unauthorizedReq.flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(hydratedUser).toBeNull();
    expect(service.obtenerUsuario()).toBeNull();
  });

  it('logout calls /auth/logout and clears local auth flags', () => {
    localStorage.setItem('usuarioLogueado', JSON.stringify({ id: 12 }));
    localStorage.setItem('accesoPermitido', 'true');
    localStorage.setItem('guestMode', 'true');
    localStorage.setItem('token', 'legacy-token');
    localStorage.setItem('access_token', 'legacy-access-token');

    service.logout().subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});

    expect(localStorage.getItem('usuarioLogueado')).toBeNull();
    expect(localStorage.getItem('accesoPermitido')).toBeNull();
    expect(localStorage.getItem('guestMode')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
