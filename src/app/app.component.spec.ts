import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { HeaderComponent } from './componentes/HyF/header/header.component';
import { EstanqueComponent } from './componentes/estanque/estanque.component';
import { AuthService } from './servicios/authService/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  template: '',
})
class MockHeaderComponent {}

@Component({
  selector: 'app-estanque',
  standalone: true,
  template: '',
})
class MockEstanqueComponent {}

describe('AppComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    localStorage.clear();
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['me']);
    authServiceSpy.me.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
      ],
    })
      .overrideComponent(AppComponent, {
        remove: { imports: [HeaderComponent, EstanqueComponent] },
        add: { imports: [MockHeaderComponent, MockEstanqueComponent] },
      })
      .compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('muestra el estanque cuando no hay acceso desbloqueado', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-estanque')).not.toBeNull();
    expect(authServiceSpy.me).toHaveBeenCalled();
  });

  it('muestra la app cuando hay acceso persistido', () => {
    localStorage.setItem('accesoPermitido', 'true');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const app = fixture.componentInstance;
    expect(app.mostrarApp()).toBeTrue();
  });
});
