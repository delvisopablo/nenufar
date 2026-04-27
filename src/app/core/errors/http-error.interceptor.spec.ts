import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ErrorObservabilityService } from './error-observability.service';
import { httpErrorInterceptor } from './http-error.interceptor';
import { AppErrorModel } from './api-error.types';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let observability: jasmine.SpyObj<ErrorObservabilityService>;

  beforeEach(() => {
    observability = jasmine.createSpyObj<ErrorObservabilityService>('ErrorObservabilityService', ['report']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ErrorObservabilityService, useValue: observability },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('convierte 401 en AppErrorModel de autenticacion', (done) => {
    http.get('/private').subscribe({
      next: () => fail('La peticion deberia fallar'),
      error: (error: AppErrorModel) => {
        expect(error.kind).toBe('auth');
        expect(error.status).toBe(401);
        expect(error.code).toBe('TOKEN_EXPIRED');
        expect(observability.report).toHaveBeenCalledWith(error, jasmine.objectContaining({ surface: 'http-interceptor' }));
        done();
      },
    });

    httpMock.expectOne('/private').flush(
      {
        ok: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Sesion caducada',
        },
      },
      { status: 401, statusText: 'Unauthorized' },
    );
  });

  it('convierte 404 en AppErrorModel not-found', (done) => {
    http.get('/missing').subscribe({
      next: () => fail('La peticion deberia fallar'),
      error: (error: AppErrorModel) => {
        expect(error.kind).toBe('not-found');
        expect(error.code).toBe('NOT_FOUND');
        done();
      },
    });

    httpMock.expectOne('/missing').flush({}, { status: 404, statusText: 'Not Found' });
  });

  it('convierte 409 conservando el codigo del backend', (done) => {
    http.post('/reservas', {}).subscribe({
      next: () => fail('La peticion deberia fallar'),
      error: (error: AppErrorModel) => {
        expect(error.kind).toBe('conflict');
        expect(error.code).toBe('RESERVA_SOLAPADA');
        expect(error.message).toBe('La hora ya no esta disponible');
        done();
      },
    });

    httpMock.expectOne('/reservas').flush(
      {
        ok: false,
        error: {
          code: 'RESERVA_SOLAPADA',
          message: 'La hora ya no esta disponible',
        },
      },
      { status: 409, statusText: 'Conflict' },
    );
  });

  it('convierte 500 en error reintentable de servidor', (done) => {
    http.get('/boom').subscribe({
      next: () => fail('La peticion deberia fallar'),
      error: (error: AppErrorModel) => {
        expect(error.kind).toBe('server');
        expect(error.retryable).toBeTrue();
        done();
      },
    });

    httpMock.expectOne('/boom').flush({}, { status: 500, statusText: 'Server Error' });
  });

  it('convierte errores de red en AppErrorModel network', (done) => {
    http.get('/offline').subscribe({
      next: () => fail('La peticion deberia fallar'),
      error: (error: AppErrorModel) => {
        expect(error.kind).toBe('network');
        expect(error.code).toBe('NETWORK_ERROR');
        expect(error.retryable).toBeTrue();
        done();
      },
    });

    httpMock.expectOne('/offline').error(new ProgressEvent('error'));
  });
});

