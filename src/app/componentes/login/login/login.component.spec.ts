import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ErrorObservabilityService } from '../../../core/errors/error-observability.service';
import { httpErrorInterceptor } from '../../../core/errors/http-error.interceptor';
import { CredentialsInterceptor } from '../../../servicios/authService/credentials.interceptor';
import { EstanqueBackgroundComponent } from '../../shared/estanque-background/estanque-background.component';
import { LoginComponent } from './login.component';

@Component({
  selector: 'app-estanque-background',
  standalone: true,
  template: '',
})
class MockEstanqueBackgroundComponent {}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('accesoPermitido', 'true');
    const observability = jasmine.createSpyObj<ErrorObservabilityService>('ErrorObservabilityService', ['report']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([CredentialsInterceptor, httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ErrorObservabilityService, useValue: observability },
      ],
    })
    .overrideComponent(LoginComponent, {
      remove: { imports: [EstanqueBackgroundComponent] },
      add: { imports: [MockEstanqueBackgroundComponent] },
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra un error visible cuando el login devuelve 401', () => {
    component.loginForm.setValue({
      email: 'demo@example.com',
      password: 'wrong-password',
    });

    component.iniciarSesion();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    expect(request.request.withCredentials).toBeTrue();
    request.flush(
      {
        ok: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales incorrectas',
        },
      },
      { status: 401, statusText: 'Unauthorized' },
    );

    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alert?.textContent).toContain('Correo o contraseña incorrectos.');
  });
});
