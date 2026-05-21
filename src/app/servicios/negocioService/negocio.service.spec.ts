import {
  NegocioService,
  resolveNegocioRouteCommands,
  resolveNegocioRouteKey,
} from './negocio.service';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { CredentialsInterceptor } from '../authService/credentials.interceptor';

describe('negocio route helpers', () => {
  it('prioritizes the negocio slug over any other identifier', () => {
    expect(
      resolveNegocioRouteKey({
        id: 18,
        slug: 'casa-verde',
        nickname: 'casa-verde-owner',
        nombre: 'Casa Verde',
      }),
    ).toBe('casa-verde');
  });

  it('does not build a public route from the negocio name', () => {
    expect(
      resolveNegocioRouteKey({
        id: 24,
        nombre: 'Cafe con Patio',
      }),
    ).toBeNull();
  });

  it('falls back to the negocio id route when there is no slug or nickname', () => {
    expect(
      resolveNegocioRouteCommands({
        id: 24,
        nombre: 'Cafe con Patio',
      }),
    ).toEqual(['/negocio', 24]);
  });
});

describe('NegocioService horario', () => {
  let service: NegocioService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([CredentialsInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(NegocioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('guardarHorario uses PATCH /negocios/:id/horario with canonical fields', () => {
    const horario = {
      weekly: {
        mon: [['10:00', '20:00']] as [string, string][],
        tue: [['10:00', '20:00']] as [string, string][],
        wed: [['10:00', '20:00']] as [string, string][],
        thu: [['10:00', '20:00']] as [string, string][],
        fri: [['10:00', '20:00']] as [string, string][],
        sat: [],
        sun: [],
      },
      exceptions: {},
    };

    service.guardarHorario(42, {
      horario,
      intervaloReserva: 30,
      reservasActivas: true,
    }).subscribe((negocio) => {
      expect(negocio.horario).toEqual(horario);
      expect(negocio.intervaloReserva).toBe(30);
      expect(negocio.reservasActivas).toBeTrue();
    });

    const req = httpMock.expectOne('http://localhost:3000/api/negocios/42/horario');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({
      horario,
      intervaloReserva: 30,
      reservasActivas: true,
    });

    req.flush({
      id: 42,
      nombre: 'Nenufar Bar',
      horario,
      intervaloReserva: 30,
      reservasActivas: true,
    });
  });

  it('getHorario unwraps the backend config object instead of treating it as horario JSON', () => {
    const horario = {
      weekly: {
        mon: [['10:00', '20:00']] as [string, string][],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
    };

    service.getHorario(42).subscribe((config) => {
      expect(config).toEqual(
        jasmine.objectContaining({
          id: 42,
          horario,
          intervaloReserva: 30,
          reservasActivas: true,
        }),
      );
    });

    const req = httpMock.expectOne('http://localhost:3000/api/negocios/42/horario');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();

    req.flush({
      id: 42,
      nombre: 'Nenufar Bar',
      horario,
      intervaloReserva: 30,
      reservasActivas: true,
    });
  });
});
