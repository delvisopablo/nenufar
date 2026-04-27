import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../servicios/authService/auth.service';
import { NegocioService } from '../../servicios/negocioService/negocio.service';

import { PrincipalComponent } from './principal.component';

describe('PrincipalComponent', () => {
  let component: PrincipalComponent;
  let fixture: ComponentFixture<PrincipalComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let negocioServiceSpy: jasmine.SpyObj<NegocioService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'hydrateSession',
      'isAuthenticated',
    ]);
    authServiceSpy.hydrateSession.and.returnValue(of(null));
    authServiceSpy.isAuthenticated.and.returnValue(false);

    negocioServiceSpy = jasmine.createSpyObj<NegocioService>('NegocioService', ['buscarNegocios']);
    negocioServiceSpy.buscarNegocios.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [PrincipalComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NegocioService, useValue: negocioServiceSpy },
      ],
    })
    .compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    fixture = TestBed.createComponent(PrincipalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('limpia usuarioLogueado corrupto sin romper la app', () => {
    localStorage.setItem('usuarioLogueado', 'undefined');

    fixture = TestBed.createComponent(PrincipalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(localStorage.getItem('usuarioLogueado')).toBeNull();
    expect(authServiceSpy.hydrateSession).toHaveBeenCalledWith({ forceRemote: true });
    expect(component.usuarioLogueado()).toBeNull();
  });
});
