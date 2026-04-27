import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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

  it('register uses /auth/registro and persists the returned session', () => {
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

    expect(localStorage.getItem('token')).toBe('token-registro');
    expect(localStorage.getItem('access_token')).toBe('token-registro');
    expect(service.obtenerUsuario()?.id).toBe(21);
  });

  it('login keeps using /auth/login and stores session data', () => {
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

    expect(localStorage.getItem('token')).toBe('token-login');
    expect(service.obtenerUsuario()?.id).toBe(44);
  });

  it('registerNegocio uses /auth/registro-negocio and persists the returned session', () => {
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
      nombreDueño: 'Paula',
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

    expect(localStorage.getItem('token')).toBe('token-negocio');
    expect(localStorage.getItem('access_token')).toBe('token-negocio');
    expect(service.obtenerUsuario()?.id).toBe(101);
    expect(service.obtenerUsuario()?.negocio).toEqual({
      id: 55,
      nombre: 'Cafe Nenufar'
    });
  });
});
