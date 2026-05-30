import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { CredentialsInterceptor } from './credentials.interceptor';

describe('CredentialsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([CredentialsInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('adds withCredentials for API requests and clears stale accessToken values', () => {
    localStorage.setItem('accessToken', 'live-access-token');

    http.get('http://localhost:3000/api/auth/me').subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/auth/me');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(localStorage.getItem('accessToken')).toBeNull();
    req.flush({});
  });

  it('clears legacy token keys before sending cookie-authenticated API requests', () => {
    localStorage.setItem('access_token', 'legacy-access-token');

    http.get('http://localhost:3000/api/reservas/mis-reservas').subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/reservas/mis-reservas');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    req.flush([]);
  });

  it('adds withCredentials for relative /api requests', () => {
    http.get('/api/auth/me').subscribe();

    const req = httpMock.expectOne('/api/auth/me');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('does not modify requests outside the API base URL', () => {
    http.get('https://example.com/health').subscribe();

    const req = httpMock.expectOne('https://example.com/health');
    expect(req.request.withCredentials).toBeFalse();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
