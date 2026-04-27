import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { CuentaAtrasService } from '../../../servicios/cuentaAtrasServicio/cuenta-atras.service';
import { AuthService } from '../../../servicios/authService/auth.service';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  let routerSpy: jasmine.SpyObj<Router>;
  let cuentaAtrasSpy: jasmine.SpyObj<CuentaAtrasService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);

    cuentaAtrasSpy = jasmine.createSpyObj('CuentaAtrasService', ['desbloquearAcceso']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['login', 'isAuthenticated']);
    authServiceSpy.login.and.returnValue(of({ id: 1, nombre: 'Demo' }));
    authServiceSpy.isAuthenticated.and.returnValue(false);

    localStorage.removeItem('accesoPermitido');
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('usuarioLogueado');

    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: CuentaAtrasService, useValue: cuentaAtrasSpy },
        { provide: AuthService, useValue: authServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    localStorage.removeItem('accesoPermitido');
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('usuarioLogueado');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open the modal when the canvas is clicked', () => {
    component.onCanvasClick(new MouseEvent('click'));

    expect(component.modalOpen()).toBeTrue();
  });
});
