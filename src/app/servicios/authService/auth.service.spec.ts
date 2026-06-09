import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { ACCESS_TOKEN_STORAGE_KEY } from './auth.storage';
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

  it('register stores the returned user without persisting access_token in localStorage', () => {
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

    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(service.obtenerUsuario()?.id).toBe(21);
  });

  it('register does not store the returned user while email verification is pending', () => {
    service.register({
      nombre: 'Pablo',
      nickname: 'pablo',
      email: 'pablo@example.com',
      password: 'secret123',
      biografia: 'Hola'
    }).subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/registro');
    req.flush({
      user: { id: 21, nombre: 'Pablo', email: 'pablo@example.com' },
      requiresEmailVerification: true,
      emailVerification: {
        email: 'pa***@example.com',
        expiresInMinutes: 5,
      },
    });

    expect(service.obtenerUsuario()).toBeNull();
    expect(localStorage.getItem('accesoPermitido')).toBeNull();
  });

  it('login uses /auth/login with rememberMe false by default, verifies /auth/me and stores the returned user', () => {
    service.login('pablo@example.com', 'secret123').subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({
      email: 'pablo@example.com',
      password: 'secret123',
      rememberMe: false,
    });

    req.flush({
      id: 44,
      email: 'pablo@example.com',
      biografia: 'Bio persistida',
      foto_perfil: 'avatar.png'
    });

    const meReq = httpMock.expectOne('http://localhost:3000/api/auth/me');
    expect(meReq.request.method).toBe('GET');
    expect(meReq.request.withCredentials).toBeTrue();
    meReq.flush({
      usuario: {
        id: 44,
        email: 'pablo@example.com',
        biografia: 'Bio desde me',
        foto_perfil: 'avatar.png',
      },
    });

    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(service.obtenerUsuario()?.id).toBe(44);
    expect(service.obtenerUsuario()?.biografia).toBe('Bio desde me');
    expect(localStorage.getItem('accesoPermitido')).toBe('true');
  });

  it('login sends rememberMe true when requested', () => {
    service.login('pablo@example.com', 'secret123', true).subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/login');
    expect(req.request.body).toEqual({
      email: 'pablo@example.com',
      password: 'secret123',
      rememberMe: true,
    });
    req.flush({ usuario: { id: 44, email: 'pablo@example.com' } });

    const meReq = httpMock.expectOne('http://localhost:3000/api/auth/me');
    meReq.flush({ usuario: { id: 44, email: 'pablo@example.com' } });
  });

  it('registerNegocio uses /auth/registro-negocio without persisting access_token in localStorage', () => {
    service.registerNegocio({
      nombreDueño: 'Paula',
      nickname: 'paula-cafe',
      email: 'paula@example.com',
      password: 'secret123',
      nombreNegocio: 'Cafe Nenufar',
      categoriaId: 3,
      subcategoriaId: 8,
      direccion: 'Calle Lago 3',
      fechaFundacion: '2024-04-01',
      historia: ' Cafe de barrio ',
      codigoNenufarizacion: ' nenu-paula-8f3k ',
      nenufarActivo: 'assets/nenufares_colores/nenufar_var3.png',
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
      categoriaId: 3,
      subcategoriaId: 8,
      direccion: 'Calle Lago 3',
      fechaFundacion: '2024-04-01',
      historia: 'Cafe de barrio',
      codigoNenufarizacion: 'NENU-PAULA-8F3K',
      nenufarActivo: 'assets/nenufares_colores/nenufar_var3.png'
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

    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(service.obtenerUsuario()?.id).toBe(101);
    expect(service.obtenerUsuario()?.negocio).toEqual(
      jasmine.objectContaining({
        id: 55,
        nombre: 'Cafe Nenufar'
      }),
    );
  });

  it('registerNegocio sends horario, intervaloReserva and reservasActivas when provided', () => {
    const horario = {
      weekly: {
        mon: [['10:00', '20:00']],
        tue: [['10:00', '20:00']],
        wed: [['10:00', '20:00']],
        thu: [['10:00', '20:00']],
        fri: [['10:00', '20:00']],
        sat: [],
        sun: [],
      },
      exceptions: {},
    };

    service.registerNegocio({
      nombreDueno: 'Nerea',
      nickname: 'nerea',
      email: 'nerea@example.com',
      password: 'secret123',
      nombreNegocio: 'Nenufar Bar',
      categoriaId: 2,
      horario,
      intervaloReserva: 30,
      reservasActivas: true,
    }).subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/registro-negocio');

    expect(req.request.body).toEqual(
      jasmine.objectContaining({
        horario,
        intervaloReserva: 30,
        reservasActivas: true,
      }),
    );

    req.flush({
      access_token: 'token-negocio-horario',
      usuario: {
        id: 102,
        nombre: 'Nerea',
        negocio: {
          id: 56,
          nombre: 'Nenufar Bar',
          horario,
          intervaloReserva: 30,
          reservasActivas: true,
        },
      },
    });

    expect(service.obtenerUsuario()?.negocio).toEqual(
      jasmine.objectContaining({
        id: 56,
        horario,
        intervaloReserva: 30,
        reservasActivas: true,
      }),
    );
  });

  it('verifyEmail uses /auth/verificar-email and stores the verified user when returned', () => {
    service.verifyEmail({
      email: 'pablo@example.com',
      code: '123456',
    }).subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/verificar-email');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({
      email: 'pablo@example.com',
      code: '123456',
    });

    req.flush({
      user: {
        id: 21,
        email: 'pablo@example.com',
        emailVerificado: true,
      },
    });

    expect(service.obtenerUsuario()).toEqual(
      jasmine.objectContaining({
        id: 21,
        email: 'pablo@example.com',
        emailVerificado: true,
      }),
    );
  });

  it('resendEmailCode uses /auth/reenviar-codigo-email without storing a code', () => {
    service.resendEmailCode({
      email: 'pablo@example.com',
    }).subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/reenviar-codigo-email');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({
      email: 'pablo@example.com',
    });

    req.flush({
      emailVerification: {
        email: 'pa***@example.com',
        expiresInMinutes: 5,
      },
    });

    expect(localStorage.getItem('verificationCode')).toBeNull();
    expect(service.obtenerUsuario()).toBeNull();
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
        usuario: { id: 99, nombre: 'Fresh user', biografia: 'Desde backend' }
      }
    );

    expect(hydratedUser).toEqual(
      jasmine.objectContaining({ id: 99, nombre: 'Fresh user', biografia: 'Desde backend' }),
    );
    expect(service.obtenerUsuario()).toEqual(
      jasmine.objectContaining({ id: 99, nombre: 'Fresh user', biografia: 'Desde backend' }),
    );

    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'stale-access-token');

    service.me().subscribe((user) => {
      hydratedUser = user;
    });

    const unauthorizedReq = httpMock.expectOne('http://localhost:3000/api/auth/me');
    expect(unauthorizedReq.request.withCredentials).toBeTrue();
    expect(unauthorizedReq.request.headers.has('Authorization')).toBeFalse();
    unauthorizedReq.flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(hydratedUser).toBeNull();
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(service.obtenerUsuario()).toBeNull();
  });

  it('hasSessionHint only returns true when there is a stored non-sensitive user', () => {
    expect(service.hasSessionHint()).toBeFalse();

    localStorage.setItem('usuarioLogueado', JSON.stringify({ id: 12, nombre: 'Nenu' }));
    expect(service.hasSessionHint()).toBeTrue();

    localStorage.removeItem('usuarioLogueado');
    localStorage.setItem('access_token', 'legacy-cookie-hint');
    expect(service.hasSessionHint()).toBeFalse();
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('logout calls /auth/logout and clears local auth flags', () => {
    localStorage.setItem('usuarioLogueado', JSON.stringify({ id: 12 }));
    localStorage.setItem('accesoPermitido', 'true');
    localStorage.setItem('guestMode', 'true');
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'stable-token');
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
    expect(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
